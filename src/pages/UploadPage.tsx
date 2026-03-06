/**
 * UploadPage.tsx
 * Upload Data page: form to upload XBRL files to backend POST /upload.
 * Users can pick an existing bank (from prior uploads) or add a new bank name.
 */

import { useState, useEffect, useMemo } from "react";
import { uploadFile, getBanks } from "../api/client";
import { CustomSelect } from "../components/CustomSelect";
import styles from "./UploadPage.module.css";

const ACCEPT = ".xbrl,.xml";

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const y = 2021 + i;
  return { value: String(y), label: String(y) };
});

const QUARTER_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Q1 (Jan–Mar)" },
  { value: "2", label: "Q2 (Apr–Jun)" },
  { value: "3", label: "Q3 (Jul–Sep)" },
  { value: "4", label: "Q4 (Oct–Dec)" },
];

const ADD_NEW_BANK_VALUE = "__new__";

const getPreviousPeriod = (year: string, quarter: string): { year: string; quarter: string } => {
  const parsedYear = parseInt(year, 10);
  const parsedQuarter = parseInt(quarter, 10);

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedQuarter)) {
    return { year, quarter };
  }

  if (parsedQuarter <= 1) {
    return { year: String(parsedYear - 1), quarter: "4" };
  }

  return { year: String(parsedYear), quarter: String(parsedQuarter - 1) };
};

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [existingBanks, setExistingBanks] = useState<string[]>([]);
  const [bankSelectValue, setBankSelectValue] = useState<string>("");
  const [customBankName, setCustomBankName] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  useEffect(() => {
    getBanks()
      .then((res) => setExistingBanks(res.banks))
      .catch(() => setExistingBanks([]));
  }, []);

  const bankOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "", label: "Select bank or add new…" },
      ...existingBanks.map((b) => ({ value: b, label: b })),
      { value: ADD_NEW_BANK_VALUE, label: "Add new bank…" },
    ];
    return opts;
  }, [existingBanks]);

  const resolvedBankName =
    bankSelectValue && bankSelectValue !== ADD_NEW_BANK_VALUE
      ? bankSelectValue
      : customBankName.trim();

  const isAcceptedFile = (candidate: File): boolean => {
    const lowerName = candidate.name.toLowerCase();
    return lowerName.endsWith(".xbrl") || lowerName.endsWith(".xml");
  };

  const applySelectedFile = (candidate: File | null) => {
    if (!candidate) {
      setFile(null);
      setStatus({ type: "idle", message: "" });
      return;
    }

    if (!isAcceptedFile(candidate)) {
      setFile(null);
      setStatus({
        type: "error",
        message: "Only XBRL files (.xbrl or .xml) are accepted.",
      });
      return;
    }

    setFile(candidate);
    setStatus({ type: "idle", message: "" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applySelectedFile(e.target.files?.[0] ?? null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    applySelectedFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!resolvedBankName) {
      setStatus({
        type: "error",
        message:
          bankSelectValue === ADD_NEW_BANK_VALUE
            ? "Please enter a bank name"
            : "Please select a bank or add a new one",
      });
      return;
    }
    if (!year || !quarter) {
      setStatus({
        type: "error",
        message: "Please select both year and quarter",
      });
      return;
    }

    setStatus({ type: "loading", message: "Uploading..." });

    try {
      const previousPeriod = getPreviousPeriod(year, quarter);
      const result = await uploadFile(file, resolvedBankName, parseInt(year), parseInt(quarter));

      setStatus({
        type: "success",
        message: `${result.message} ${result.rows_stored} row(s) stored.`,
      });
      setFile(null);
      setYear(previousPeriod.year);
      setQuarter(previousPeriod.quarter);

      getBanks()
        .then((res) => setExistingBanks(res.banks))
        .catch(() => { });

      if (bankSelectValue === ADD_NEW_BANK_VALUE) {
        setBankSelectValue(customBankName.trim());
        setCustomBankName("");
      }
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  return (
    <div className={styles.page}>


      <div className={styles.uploadCard}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            <span className={styles.labelText}>Bank</span>
            <CustomSelect
              value={bankSelectValue}
              onChange={(v) => {
                setBankSelectValue(v);
                setStatus({ type: "idle", message: "" });
              }}
              options={bankOptions}
              placeholder="Select bank or add new…"
              id="upload-bank"
              ariaDescribedBy="bank-hint"
            />
            {bankSelectValue === ADD_NEW_BANK_VALUE && (
              <div className={styles.newBankWrap}>
                <input
                  type="text"
                  value={customBankName}
                  onChange={(e) => {
                    setCustomBankName(e.target.value);
                    setStatus({ type: "idle", message: "" });
                  }}
                  className={styles.textInput}
                  placeholder="Enter new bank name"
                  aria-describedby="bank-hint"
                  autoFocus
                />
              </div>
            )}
            <span id="bank-hint" className={styles.hint}>
              {existingBanks.length > 0
                ? "Choose an existing bank or add a new one"
                : "Add a bank name; it will appear here after the first upload"}
            </span>
          </label>
          <div className={styles.formRow}>
            <label className={styles.label}>
              <span className={styles.labelText}>Year</span>
              <CustomSelect
                name="year"
                value={year}
                onChange={(v) => {
                  setYear(v);
                  setStatus({ type: "idle", message: "" });
                }}
                options={YEAR_OPTIONS}
                placeholder="Select year"
                id="upload-year"
                ariaDescribedBy="year-hint"
                required
              />
              <span id="year-hint" className={styles.hint}>
                Reporting year
              </span>
            </label>
            <label className={styles.label}>
              <span className={styles.labelText}>Quarter</span>
              <CustomSelect
                name="quarter"
                value={quarter}
                onChange={(v) => {
                  setQuarter(v);
                  setStatus({ type: "idle", message: "" });
                }}
                options={QUARTER_OPTIONS}
                placeholder="Select quarter"
                id="upload-quarter"
                ariaDescribedBy="quarter-hint"
                required
              />
              <span id="quarter-hint" className={styles.hint}>
                Reporting quarter
              </span>
            </label>
          </div>
          <label className={styles.label}>
            <span className={styles.labelText}>Drop file here</span>
            <div
              className={`${styles.fileWrap} ${file ? styles.hasFile : ""} ${isDragOver ? styles.dragOver : ""}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={ACCEPT}
                onChange={handleFileChange}
                className={styles.fileInput}
                aria-describedby="upload-hint"
              />
              <span className={styles.fileLabel}>
                {file ? file.name : "Drag and drop XBRL file here or click to select"}
              </span>
            </div>
            <span id="upload-hint" className={styles.hint}>
              Accepted: XBRL files (.xbrl, .xml)
            </span>
          </label>
          <button
            type="submit"
            className={styles.button}
            disabled={!file || !resolvedBankName || !year || !quarter || status.type === "loading"}
          >
            {status.type === "loading" ? "Uploading…" : "Upload and process"}
          </button>
        </form>

        {status.type !== "idle" && status.message && (
          <div
            className={
              status.type === "error"
                ? styles.messageError
                : status.type === "success"
                  ? styles.messageSuccess
                  : styles.messageInfo
            }
            role="status"
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
