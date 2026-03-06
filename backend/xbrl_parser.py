"""
xbrl_parser.py - XBRL file parser for extracting quarterly bank metrics.

Parses XBRL (eXtensible Business Reporting Language) files to extract:
- Revenue
- Net Profit
- Customer Accounts
- Loans Outstanding
- Deposits

Extracts bank identifier, year, and quarter from XBRL context elements.
Returns structured data ready for database storage.
"""

import io
import tempfile
import os
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional, Tuple, TYPE_CHECKING
from pathlib import Path

# Type hints only - arelle is imported lazily in parse_xbrl_file
if TYPE_CHECKING:
    from arelle.ModelXbrl import ModelXbrl


# FFIEC Call Report concept code mappings
# These are the specific codes used in FFIEC Call Report XBRL files
FFIEC_METRICS = {
    "revenue": [
        "RIAD4107",  # Total interest income (Schedule RI)
        "RIAD4058",  # Total interest income
    ],
    "net_interest_income": [
        "RIAD4074",  # Net interest income (Schedule RI item 3); use with RIAD4079 for total revenue
    ],
    "net_profit": [
        "RIAD4301",  # Net income
        "RIAD4340",  # Net income after taxes
    ],
    "customer_accounts": [
        "RCON5572",  # Number of accounts
    ],
    "loans_outstanding": [
        "RCONG641",  # Total loans and leases
        "RCON2122",  # Total loans and leases, net of unearned income
        "RCFD2122",
    ],
    "deposits": [
        "RCOND990",  # Total deposits
        "RCON2200",  # Total deposits
        "RCFD2200",
    ],
    # Additional FFIEC fields used for CAMEL-style derived ratios
    "total_assets": [
        "RCON2170",  # Total assets (domestic offices)
        "RCFD2170",  # Total assets
    ],
    "total_equity": [
        "RCON3210",  # Total equity capital (domestic offices)
        "RCFD3210",  # Total equity capital
    ],
    "allowance_for_credit_losses": [
        "RCON3123",  # Allowance for credit losses on loans and leases
        "RCFD3123",
    ],
    "non_interest_income_amount": [
        "RIAD4079",  # Total noninterest income
    ],
    "non_interest_expense_amount": [
        "RIAD4093",  # Total noninterest expense
    ],
    "num_employees": [
        "RIAD4150",  # Number of full-time equivalent employees
    ],
    "tier1_leverage_ratio": [
        "RCOA7204",
    ],
    "past_due_30_89_amount": [
        "RCON1406",  # Loans 30-89 days past due
        "RCFD1406",
    ],
    "past_due_90_plus_amount": [
        "RCON1407",  # Loans 90+ days past due and still accruing
        "RCFD1407",
    ],
    "nonaccrual_loans_amount": [
        "RCON1607",
        "RCON1608",
        "RCON5525",
        "RCON5526",
        "RCON5527",
        "RCON5528",
    ],
    "brokered_deposits_amount": [
        "RCON2365",
        "RCFD2365",
    ],
    "time_deposits_over_250k": [
        "RCONJ474",
        "RCFDJ474",
    ],
    "time_deposits_over_250k_remaining_1y": [
        "RCONK222",
        "RCFDK222",
    ],
    "reciprocal_deposits_amount": [
        "RCONJH83",
    ],
    "sweep_nonbrokered_amount": [
        "RCONMT95",
    ],
    "interest_income_loans_amount": [
        "RIAD4010",
    ],
    "interest_income_securities_agency": [
        "RIADB488",
    ],
    "interest_income_securities_mbs": [
        "RIADB489",
    ],
    "interest_income_securities_other": [
        "RIAD4060",
    ],
    "interest_expense_total_amount": [
        "RIAD4073",
    ],
    # Schedule RC-K (Quarterly Averages)
    "average_total_assets": [
        "RCON3368",  # RC-K item 9
        "RCFD3368",
    ],
    "average_loans": [
        "RCON3360",  # RC-K item 6.a
        "RCFD3360",
    ],
    "average_interest_bearing_transaction": [
        "RCON3485",
        "RCFD3485",
    ],
    "average_savings_deposits": [
        "RCONB563",
        "RCFDB563",
    ],
    "average_time_deposits_250k_or_less": [
        "RCONHK16",
        "RCFDHK16",
    ],
    "average_time_deposits_over_250k": [
        "RCONHK17",
        "RCFDHK17",
    ],
    "fed_funds_purchased_repos": [
        "RCON3353",  # Federal funds purchased and securities sold under agreements to repurchase
        "RCFD3353",
    ],
    "other_borrowed_money": [
        "RCON3355",
        "RCFD3355",
    ],
    "subchapter_s": [
        "RIADA530",
    ],
    # Schedule RC / RC-M
    "pledged_loans_leases": [
        "RCONG378",
        "RCFDG378",
    ],
    "pledged_securities": [
        "RCON0416",
        "RCFD0416",
    ],
    # Optional: tax-equivalent ratios
    "tax_exempt_securities_income": [
        "RIAD4507",
    ],
    "tax_exempt_loans_income": [
        "RIAD4313",
    ],
    "average_balances_due_from_banks": [
        "RCON3381",
        "RCFD3381",
    ],
    "average_securities_agency": [
        "RCONB558",
        "RCFDB558",
    ],
    "average_securities_mbs": [
        "RCONB559",
        "RCFDB559",
    ],
    "average_securities_other": [
        "RCONB560",
        "RCFDB560",
    ],
    "average_fed_funds_sold": [
        "RCON3365",
        "RCFD3365",
    ],
    "average_lease_financing": [
        "RCON3484",
        "RCFD3484",
    ],
}

# Target metrics to extract from XBRL files
# These are common concept names; adjust if your XBRL taxonomy uses different names
TARGET_METRICS = {
    "revenue": [
        "Revenue",
        "Revenues",
        "TotalRevenue",
        "OperatingRevenue",
        "NetRevenue",
        "Income",
        "TotalIncome",
    ],
    "net_profit": [
        "NetProfit",
        "NetIncome",
        "ProfitAfterTax",
        "NetEarnings",
        "ProfitLoss",
    ],
    "customer_accounts": [
        "CustomerAccounts",
        "NumberOfAccounts",
        "AccountHolders",
        "CustomerBase",
        "TotalAccounts",
    ],
    "loans_outstanding": [
        "LoansOutstanding",
        "TotalLoans",
        "LoanPortfolio",
        "GrossLoans",
        "LoansAndAdvances",
    ],
    "deposits": [
        "Deposits",
        "TotalDeposits",
        "CustomerDeposits",
        "DepositLiabilities",
        "DepositsFromCustomers",
    ],
}


def _normalize_concept_name(name: str) -> str:
    """
    Normalize XBRL concept name for matching.
    Removes namespace prefixes and converts to lowercase for flexible matching.
    """
    # Convert to string first in case it's a qname object
    name_str = str(name)
    # Remove namespace prefix if present (e.g., "us-gaap:Revenue" -> "Revenue")
    # Also handle qname format like "{namespace}localName"
    if ":" in name_str:
        name_str = name_str.split(":")[-1]
    elif "}" in name_str:
        # Handle {namespace}localName format
        name_str = name_str.split("}")[-1]
    return name_str.strip()


def _is_ffiec_format(model_xbrl: "ModelXbrl") -> bool:
    """
    Check if the XBRL file is in FFIEC Call Report format.
    Detects FFIEC format by checking for FFIEC namespace or FFIEC concept code patterns.
    """
    try:
        if hasattr(model_xbrl, "modelDocument") and model_xbrl.modelDocument:
            # Check namespaces in the document
            if hasattr(model_xbrl.modelDocument, "xmlDocument"):
                root = model_xbrl.modelDocument.xmlDocument.getroot()
                # Check for FFIEC namespace
                for prefix, uri in root.nsmap.items():
                    if uri and "ffiec.gov" in uri:
                        return True
            # Also check qnameConcepts for FFIEC concepts
            if hasattr(model_xbrl, "qnameConcepts"):
                for qname in model_xbrl.qnameConcepts.keys():
                    if hasattr(qname, "namespaceURI") and qname.namespaceURI:
                        if "ffiec.gov" in qname.namespaceURI:
                            return True
                    # Check local name for FFIEC pattern (RIAD, RCON prefixes)
                    if hasattr(qname, "localName"):
                        local_name = qname.localName
                        if local_name and (local_name.startswith("RIAD") or local_name.startswith("RCON") or 
                                         local_name.startswith("RCOA") or local_name.startswith("RSSD")):
                            return True
        
        # Check facts for FFIEC pattern codes
        if hasattr(model_xbrl, "facts") and model_xbrl.facts:
            for fact in list(model_xbrl.facts)[:10]:  # Check first 10 facts
                concept_name = None
                if hasattr(fact, "concept") and fact.concept:
                    if hasattr(fact.concept, "qname") and hasattr(fact.concept.qname, "localName"):
                        concept_name = fact.concept.qname.localName
                elif hasattr(fact, "qname") and hasattr(fact.qname, "localName"):
                    concept_name = fact.qname.localName
                
                if concept_name and (concept_name.startswith("RIAD") or concept_name.startswith("RCON") or 
                                   concept_name.startswith("RCOA") or concept_name.startswith("RSSD")):
                    return True
    except:
        pass
    return False


def _match_metric_name(concept_name: str, is_ffiec: bool = False) -> Optional[str]:
    """
    Match XBRL concept name to one of our target metrics.
    Returns the normalized metric name (e.g., "revenue", "net_profit") or None.
    
    Uses flexible matching:
    - For FFIEC format: exact match on FFIEC concept codes
    - For generic format: exact/starts-with match and keyword matching
    """
    # Convert to string and clean up
    concept_str = str(concept_name).strip()
    
    # For FFIEC format, check FFIEC concept codes first (before normalization)
    if is_ffiec:
        # Try direct match first (in case concept_name is already the code)
        concept_upper = concept_str.upper()
        for metric_key, codes in FFIEC_METRICS.items():
            # Check if concept matches any code in the list
            for code in codes:
                if concept_upper == code.upper():
                    return metric_key
        
        # Also try after normalization (in case there's a namespace prefix)
        normalized = _normalize_concept_name(concept_str)
        normalized_upper = normalized.upper()
        for metric_key, codes in FFIEC_METRICS.items():
            for code in codes:
                if normalized_upper == code.upper():
                    return metric_key
    
    normalized = _normalize_concept_name(concept_str)
    
    normalized_lower = normalized.lower()
    
    # First try exact/starts-with match
    for metric_key, aliases in TARGET_METRICS.items():
        for alias in aliases:
            alias_lower = alias.lower()
            if normalized_lower == alias_lower or normalized_lower.startswith(alias_lower):
                return metric_key
    
    # Then try keyword matching (more flexible)
    if any(kw in normalized_lower for kw in ["revenue", "income", "sales"]):
        return "revenue"
    if any(kw in normalized_lower for kw in ["profit", "earnings", "netincome", "net_income"]):
        return "net_profit"
    if any(kw in normalized_lower for kw in ["account", "customer", "holder", "client"]):
        return "customer_accounts"
    if any(kw in normalized_lower for kw in ["loan", "lending", "advance"]):
        return "loans_outstanding"
    if any(kw in normalized_lower for kw in ["deposit", "saving", "liability"]):
        return "deposits"
    
    return None


def _extract_period_from_context(context_id: str, model_xbrl: "ModelXbrl") -> Optional[Tuple[int, int]]:
    """
    Extract year and quarter from XBRL context element.
    Contexts typically have period elements with start/end dates or instant dates.
    Returns (year, quarter) tuple or None if not found.
    """
    context = model_xbrl.contexts.get(context_id)
    if not context:
        return None

    # Arelle ModelContext exposes period via flags/datetime attrs.
    # Prefer these fields for reliability across FFIEC call-report instances.
    try:
        if getattr(context, "isInstantPeriod", False):
            instant_dt = getattr(context, "instantDatetime", None) or getattr(context, "endDatetime", None)
            if instant_dt:
                year = instant_dt.year
                quarter = (instant_dt.month - 1) // 3 + 1
                return (year, quarter)
    except:
        pass

    try:
        if getattr(context, "isStartEndPeriod", False):
            end_dt = getattr(context, "endDatetime", None)
            if end_dt:
                year = end_dt.year
                quarter = (end_dt.month - 1) // 3 + 1
                return (year, quarter)
    except:
        pass

    # Fallback for non-Arelle context objects that expose a nested period object.
    period = getattr(context, "period", None)
    if period:
        instant = getattr(period, "instant", None)
        if instant:
            try:
                year = instant.year
                quarter = (instant.month - 1) // 3 + 1
                return (year, quarter)
            except:
                pass

        start = getattr(period, "startDate", None)
        end = getattr(period, "endDate", None)
        if start and end:
            try:
                year = end.year
                quarter = (end.month - 1) // 3 + 1
                return (year, quarter)
            except:
                pass

    return None


def _extract_bank_id(model_xbrl: "ModelXbrl") -> str:
    """
    Extract bank identifier from XBRL entity information.
    Uses entity identifier scheme/identifier or entity name.
    Returns a string identifier or "Unknown" if not found.
    """
    # Try to get entity from contexts
    for context_id, context in model_xbrl.contexts.items():
        entity = getattr(context, "entityIdentifier", None)
        if entity:
            # Entity identifier typically has scheme and identifier
            identifier = getattr(entity, "identifier", None)
            if identifier:
                return str(identifier).strip()

    # Fallback: try to extract from file metadata or first fact
    # This is a simple fallback; adjust based on your XBRL structure
    return "Unknown"


def _local_tag_name(tag: str) -> str:
    """Extract local tag name from '{ns}name' or 'prefix:name'."""
    if not tag:
        return ""
    if "}" in tag:
        return tag.split("}")[-1]
    if ":" in tag:
        return tag.split(":")[-1]
    return tag


def _parse_ffiec_xml_direct(
    file_content: bytes,
    bank_name: Optional[str] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
) -> Optional[List[Dict[str, any]]]:
    """
    Parse FFIEC call-report XBRL directly from instance XML.
    This avoids remote taxonomy dependency and works for the uploaded company format.

    Returns:
    - None: not an FFIEC call-report instance
    - list: parsed rows (possibly empty if file is FFIEC but no mapped facts)
    """
    ffiec_marker = b"ffiec.gov/xbrl/call/concepts"
    if ffiec_marker not in file_content:
        return None

    try:
        root = ET.fromstring(file_content)
    except Exception:
        return None

    metric_by_code = {}
    for metric_name, codes in FFIEC_METRICS.items():
        for code in codes:
            metric_by_code[code] = metric_name

    # Use provided bank_name, year, quarter if available, otherwise extract from file
    bank_id = bank_name.strip() if bank_name and bank_name.strip() else "Unknown"
    provided_year = year
    provided_quarter = quarter
    
    context_periods: Dict[str, Tuple[int, int]] = {}
    
    # If year and quarter are provided, use them for all contexts
    if provided_year is not None and provided_quarter is not None:
        # Use provided year/quarter for all contexts
        for elem in root:
            if _local_tag_name(elem.tag) == "context":
                context_id = elem.attrib.get("id")
                if context_id:
                    context_periods[context_id] = (provided_year, provided_quarter)
    else:
        # Build context -> (year, quarter) from file, and capture bank_id from first identifier if not provided.
        for elem in root:
            if _local_tag_name(elem.tag) != "context":
                continue

            context_id = elem.attrib.get("id")
            if not context_id:
                continue

            entity_el = None
            period_el = None
            for child in elem:
                lname = _local_tag_name(child.tag)
                if lname == "entity":
                    entity_el = child
                elif lname == "period":
                    period_el = child

            if entity_el is not None and bank_id == "Unknown":
                for e_child in entity_el:
                    if _local_tag_name(e_child.tag) == "identifier" and (e_child.text or "").strip():
                        bank_id = (e_child.text or "").strip()
                        break

            if period_el is None:
                continue

            date_text = None
            for p_child in period_el:
                lname = _local_tag_name(p_child.tag)
                if lname == "instant" and (p_child.text or "").strip():
                    date_text = (p_child.text or "").strip()
                    break
                if lname == "endDate" and (p_child.text or "").strip():
                    date_text = (p_child.text or "").strip()

            if not date_text:
                continue

            try:
                file_year = int(date_text[0:4])
                file_month = int(date_text[5:7])
                file_quarter = (file_month - 1) // 3 + 1
                context_periods[context_id] = (file_year, file_quarter)
            except Exception:
                continue

    # Deduplicate by (context, metric_name) because FFIEC files can contain multiple
    # alias concepts that map to the same normalized metric in our app.
    dedup: Dict[Tuple[str, str], float] = {}

    # Facts are top-level elements under xbrl root.
    for elem in root:
        concept_code = _local_tag_name(elem.tag)
        metric_name = metric_by_code.get(concept_code)
        if not metric_name:
            continue

        value_text = (elem.text or "").strip()
        if not value_text:
            continue

        try:
            value = float(value_text)
        except Exception:
            continue

        context_id = elem.attrib.get("contextRef")
        if not context_id:
            continue

        # Use provided year/quarter if available, otherwise use period from context
        if provided_year is not None and provided_quarter is not None:
            year, quarter = provided_year, provided_quarter
        else:
            period = context_periods.get(context_id)
            if not period:
                continue
            year, quarter = period
        dedup[(context_id, metric_name)] = value

    rows: List[Dict[str, any]] = []
    for (context_id, metric_name), value in dedup.items():
        # Use provided year/quarter if available, otherwise use period from context
        if provided_year is not None and provided_quarter is not None:
            y, q = provided_year, provided_quarter
        else:
            period = context_periods.get(context_id)
            if not period:
                continue
            y, q = period
        rows.append(
            {
                "bank_id": bank_id,
                "year": y,
                "quarter": q,
                "metric_name": metric_name,
                "value": value,
            }
        )

    return rows


def parse_xbrl_file(
    file_content: bytes,
    filename: str,
    bank_name: Optional[str] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
) -> List[Dict[str, any]]:
    """
    Parse an XBRL file and extract quarterly bank metrics.

    Steps:
    1. Load XBRL file using Arelle (or direct XML parsing for FFIEC)
    2. Iterate through facts (data points) in the instance document
    3. Match concept names to target metrics (Revenue, Net Profit, etc.)
    4. Use provided year/quarter or extract from context
    5. Use provided bank_name or extract bank identifier from entity
    6. Return list of {bank_id, year, quarter, metric_name, value} dicts

    Args:
        file_content: Raw bytes of the XBRL file
        filename: Original filename (for error messages)
        bank_name: Optional bank name to use for all metrics (overrides file extraction)
        year: Optional reporting year to use for all metrics (overrides file extraction)
        quarter: Optional reporting quarter (1-4) to use for all metrics (overrides file extraction)

    Returns:
        List of dicts with keys: bank_id, year, quarter, metric_name, value

    Raises:
        ValueError: If file is invalid XBRL or missing required data
    """
    # Fast path for FFIEC call-report files (company upload format).
    # This path does not require remote taxonomy fetch and is resilient offline.
    ffiec_rows = _parse_ffiec_xml_direct(
        file_content, bank_name=bank_name, year=year, quarter=quarter
    )
    if ffiec_rows is not None:
        if ffiec_rows:
            return ffiec_rows
        raise ValueError(
            "No matching FFIEC metrics found in XBRL file. "
            "Expected FFIEC concept codes: RIAD4074/RIAD4107 (revenue/net_interest_income), "
            "RIAD4301/RIAD4340 (net_profit), RCON5572 (customer_accounts), "
            "RCONG641 (loans_outstanding), RCOND990 (deposits)."
        )

    rows = []

    # Step 1: Import arelle (lazy import to avoid errors at module load)
    try:
        from arelle import ModelManager, Cntlr
        from arelle.ModelXbrl import ModelXbrl
    except ImportError:
        raise ValueError(
            "arelle-release is required for XBRL parsing. Install with: pip install arelle-release"
        )

    # Step 2: Initialize Arelle controller and model manager
    ctrl = Cntlr.Cntlr()
    model_manager = ModelManager.initialize(ctrl)

    # Step 3: Save file content to temporary file for Arelle to process
    # Arelle requires a file path, not bytes directly
    temp_fd, temp_path = tempfile.mkstemp(suffix=".xbrl", prefix="xbrl_upload_")
    try:
        with os.fdopen(temp_fd, "wb") as f:
            f.write(file_content)

        # Step 4: Load XBRL file using Arelle
        model_xbrl = model_manager.load(temp_path)

        if not model_xbrl:
            raise ValueError(f"Failed to load XBRL file: {filename}. File may be invalid XBRL format.")

        # Step 5: Check if this is an instance document (has facts) vs taxonomy file
        # Try to get facts - they might be accessed differently depending on XBRL version/structure
        facts_to_iterate = []
        
        # Method 1: Direct facts attribute
        if hasattr(model_xbrl, "facts") and model_xbrl.facts:
            facts_to_iterate = list(model_xbrl.facts)
        
        # Method 2: Try to get facts from modelDocument
        if not facts_to_iterate and hasattr(model_xbrl, "modelDocument"):
            try:
                # Iterate through all documents
                for doc in model_xbrl.modelDocument.referencesDocument.values():
                    if hasattr(doc, "facts") and doc.facts:
                        facts_to_iterate.extend(list(doc.facts))
            except:
                pass
        
        # Method 3: Try to iterate through modelXbrl directly
        if not facts_to_iterate:
            try:
                # Some XBRL structures store facts differently
                for item in dir(model_xbrl):
                    if "fact" in item.lower() and not item.startswith("_"):
                        attr = getattr(model_xbrl, item, None)
                        if attr and hasattr(attr, "__iter__"):
                            try:
                                facts_to_iterate = list(attr)
                                break
                            except:
                                pass
            except:
                pass
        
        if not facts_to_iterate:
            # Check if file loaded but has no facts (might be taxonomy or empty)
            file_type = "unknown"
            if hasattr(model_xbrl, "modelDocument"):
                doc_type = getattr(model_xbrl.modelDocument, "type", None)
                if doc_type:
                    file_type = str(doc_type)
            
            raise ValueError(
                f"XBRL file loaded successfully but contains no facts (data points). "
                f"File type detected: {file_type}. "
                f"This might be:\n"
                f"- A taxonomy file (.xsd) instead of an instance document (.xbrl)\n"
                f"- An empty XBRL instance document\n"
                f"- A file using a different XBRL structure\n\n"
                f"Please ensure you're uploading an XBRL instance document (.xbrl or .xml) "
                f"that contains financial data facts, not a taxonomy schema file."
            )

        # Step 6: Check if this is FFIEC Call Report format
        # Also check facts_to_iterate for FFIEC pattern codes as a fallback
        is_ffiec = _is_ffiec_format(model_xbrl)
        if not is_ffiec and facts_to_iterate:
            # Fallback: check first few facts for FFIEC pattern
            for fact in list(facts_to_iterate)[:10]:
                try:
                    concept_name = None
                    if hasattr(fact, "concept") and fact.concept:
                        if hasattr(fact.concept, "qname") and hasattr(fact.concept.qname, "localName"):
                            concept_name = fact.concept.qname.localName
                    elif hasattr(fact, "qname") and hasattr(fact.qname, "localName"):
                        concept_name = fact.qname.localName
                    
                    if concept_name and (concept_name.startswith("RIAD") or concept_name.startswith("RCON") or 
                                       concept_name.startswith("RCOA") or concept_name.startswith("RSSD")):
                        is_ffiec = True
                        break
                except:
                    pass

        # Step 7: Extract bank identifier from entity (use provided bank_name if available)
        bank_id = bank_name.strip() if bank_name and bank_name.strip() else _extract_bank_id(model_xbrl)

        # Step 8: Collect all concept names found (for better error messages)
        all_concept_names = set()
        
        # Debug: Track why facts are being skipped
        matched_concepts = set()
        skipped_no_match = set()
        skipped_no_value = set()
        skipped_no_context = set()

        # Step 9: Iterate through facts (data points) in the XBRL instance
        for fact in facts_to_iterate:
            # Get concept name (e.g., "Revenue", "NetProfit")
            # Try multiple ways to get the concept
            concept = None
            concept_name = None
            
            if hasattr(fact, "concept") and fact.concept:
                concept = fact.concept
                if hasattr(concept, "qname"):
                    if hasattr(concept.qname, "localName") and concept.qname.localName:
                        concept_name = concept.qname.localName
                    elif hasattr(concept.qname, "localname") and concept.qname.localname:
                        concept_name = concept.qname.localname
                    else:
                        # Try to extract local name from string representation
                        qname_str = str(concept.qname)
                        # Handle formats like "{namespace}localName" or "prefix:localName"
                        if "}" in qname_str:
                            concept_name = qname_str.split("}")[-1]
                        elif ":" in qname_str:
                            concept_name = qname_str.split(":")[-1]
                        else:
                            concept_name = qname_str
                elif hasattr(concept, "name"):
                    concept_name = concept.name
                elif hasattr(concept, "localName"):
                    concept_name = concept.localName
                else:
                    concept_name = str(concept)
            elif hasattr(fact, "qname"):
                # Try both localName and localname (different libraries use different casing)
                if hasattr(fact.qname, "localName"):
                    concept_name = fact.qname.localName
                elif hasattr(fact.qname, "localname"):
                    concept_name = fact.qname.localname
                elif hasattr(fact.qname, "local_name"):
                    concept_name = fact.qname.local_name
                else:
                    # Try to extract local name from string representation
                    qname_str = str(fact.qname)
                    if "}" in qname_str:
                        concept_name = qname_str.split("}")[-1]
                    elif ":" in qname_str:
                        concept_name = qname_str.split(":")[-1]
                    else:
                        concept_name = qname_str
            elif hasattr(fact, "conceptName"):
                concept_name = fact.conceptName
            elif hasattr(fact, "element"):
                concept_name = str(fact.element)
            
            if not concept_name:
                continue  # Skip facts without concept names
            
            all_concept_names.add(concept_name)

            # Step 10: Match concept to one of our target metrics
            metric_name = _match_metric_name(concept_name, is_ffiec)
            if not metric_name:
                skipped_no_match.add(concept_name)
                continue  # Skip facts that don't match our target metrics
            
            matched_concepts.add(concept_name)

            # Step 11: Extract numeric value
            # For FFIEC format, also handle NON-MONETARY units (e.g., for customer_accounts)
            # Try multiple ways to get the value
            value = None
            try:
                # Check unit - skip if it's a boolean or text concept
                unit_ref = None
                if hasattr(fact, "unitRef"):
                    unit_ref = fact.unitRef
                elif hasattr(fact, "unit"):
                    if hasattr(fact.unit, "id"):
                        unit_ref = fact.unit.id
                    else:
                        unit_ref = str(fact.unit)
                
                # Skip text/boolean facts (no unitRef or NON-MONETARY for non-count metrics)
                if not unit_ref and is_ffiec:
                    # For FFIEC, some concepts might not have unitRef but still be numeric
                    # Check if it's a known text concept
                    if concept_name.startswith("TEXT") or concept_name.startswith("RSSD"):
                        continue
                
                if hasattr(fact, "xValue"):
                    value = float(fact.xValue)
                elif hasattr(fact, "value"):
                    value = float(fact.value)
                elif hasattr(fact, "text"):
                    value = float(fact.text)
                elif hasattr(fact, "stringValue"):
                    value = float(fact.stringValue)
                else:
                    # Try to get text content
                    value_str = str(fact).strip()
                    if value_str and value_str.lower() not in ["true", "false"]:
                        try:
                            value = float(value_str)
                        except (ValueError, TypeError):
                            pass
            except (ValueError, TypeError, AttributeError):
                skipped_no_value.add(concept_name)
                continue  # Skip non-numeric facts
            
            if value is None:
                skipped_no_value.add(concept_name)
                continue

            # Step 12: Extract period (year, quarter) from context
            # Try multiple ways to get context ID
            context_id = None
            if hasattr(fact, "contextID"):
                context_id = fact.contextID
            elif hasattr(fact, "context"):
                if isinstance(fact.context, str):
                    context_id = fact.context
                elif hasattr(fact.context, "id"):
                    context_id = fact.context.id
            elif hasattr(fact, "contextRef"):
                context_id = fact.contextRef
            
            if not context_id:
                skipped_no_context.add(concept_name)
                continue

            period_info = _extract_period_from_context(context_id, model_xbrl)
            if not period_info:
                skipped_no_context.add(concept_name)
                continue  # Skip facts without valid period

            year, quarter = period_info

            # Step 13: Store extracted metric
            rows.append(
                {
                    "bank_id": bank_id,
                    "year": year,
                    "quarter": quarter,
                    "metric_name": metric_name,
                    "value": value,
                }
            )

        if not rows:
            # Provide helpful error message with found concepts
            found_concepts_sample = sorted(list(all_concept_names))[:20]  # Show first 20
            found_msg = f"Found {len(all_concept_names)} concept(s) in file"
            if found_concepts_sample:
                found_msg += f" (sample: {', '.join(found_concepts_sample)})"
            else:
                found_msg += " (no concepts found)"
            
            format_type = "FFIEC Call Report" if is_ffiec else "generic XBRL"
            expected_metrics = list(FFIEC_METRICS.keys()) if is_ffiec else list(TARGET_METRICS.keys())
            
            # For FFIEC format, check if any of the expected codes are in the found concepts
            if is_ffiec:
                expected_codes = []
                for codes in FFIEC_METRICS.values():
                    expected_codes.extend(codes)
                found_expected = [code for code in expected_codes if code in all_concept_names]
                if found_expected:
                    found_msg += f"\nNote: Found expected FFIEC codes in file: {', '.join(found_expected[:10])}"
                    # Show which ones matched vs didn't match
                    matched_expected = [code for code in found_expected if code in matched_concepts]
                    unmatched_expected = [code for code in found_expected if code not in matched_concepts]
                    if matched_expected:
                        found_msg += f"\nMatched concepts: {', '.join(matched_expected[:10])}"
                    if unmatched_expected:
                        found_msg += f"\nUnmatched (skipped): {', '.join(unmatched_expected[:10])}"
                        # Show why they were skipped
                        skipped_reasons = []
                        for code in unmatched_expected[:5]:
                            reasons = []
                            if code in skipped_no_match:
                                reasons.append("no_match")
                            if code in skipped_no_value:
                                reasons.append("no_value")
                            if code in skipped_no_context:
                                reasons.append("no_context")
                            if reasons:
                                skipped_reasons.append(f"{code}({','.join(reasons)})")
                        if skipped_reasons:
                            found_msg += f"\nSkip reasons: {', '.join(skipped_reasons)}"
                else:
                    # Check if codes exist but with different casing or format
                    all_upper = {c.upper() for c in all_concept_names}
                    found_expected_upper = [code for code in expected_codes if code.upper() in all_upper]
                    if found_expected_upper:
                        found_msg += f"\nNote: Found FFIEC codes (case-insensitive): {', '.join(found_expected_upper[:10])}"
                    else:
                        found_msg += f"\nNote: Looking for FFIEC codes: {', '.join(expected_codes[:10])}"
            
            raise ValueError(
                f"No matching metrics found in XBRL file ({format_type} format).\n"
                f"Expected metrics: {expected_metrics}\n"
                f"{found_msg}.\n"
                f"The file may use different concept names than expected. "
                f"Please check that your XBRL file contains concepts matching: Revenue, Net Profit, Customer Accounts, Loans Outstanding, or Deposits."
            )

        return rows

    except ValueError:
        # Re-raise ValueError as-is (these are expected validation errors)
        raise
    except Exception as e:
        # Wrap other errors (Arelle errors, XML parsing, etc.)
        raise ValueError(f"Error parsing XBRL file {filename}: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
