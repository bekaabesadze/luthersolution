export type MetricFormat = "number" | "percent" | "currency";

export interface MetricDefinition {
  id: string;
  label: string;
  format: MetricFormat;
  matcher: (name: string) => boolean;
}

const normalize = (name: string) => name.toLowerCase().replace(/[_\s]+/g, " ").trim();

const isRevenue = (name: string) => {
  const n = normalize(name).replace(/\s+/g, "");
  return (
    n === "revenue" ||
    n === "value" ||
    n === "revenues" ||
    n === "totalrevenue" ||
    n === "operatingrevenue" ||
    n === "netrevenue"
  );
};

const isGrowth = (name: string) => {
  const n = normalize(name);
  return n === "growth" || n === "growth pct" || n === "growth %" || n.includes("growth");
};

export const metricRegistry: MetricDefinition[] = [
  {
    id: "revenue",
    label: "Revenue",
    format: "currency",
    matcher: isRevenue,
  },
  {
    id: "deposits",
    label: "Deposits",
    format: "currency",
    matcher: (n) => normalize(n).includes("deposit"),
  },
  {
    id: "loans",
    label: "Loans",
    format: "currency",
    matcher: (n) => normalize(n).includes("loan") && !normalize(n).includes("growth"),
  },
  {
    id: "netProfit",
    label: "Net Profit",
    format: "currency",
    matcher: (n) => {
      const nn = normalize(n);
      return nn.includes("profit") || nn.includes("net income");
    },
  },
  {
    id: "growthPct",
    label: "Growth (%)",
    format: "percent",
    matcher: isGrowth,
  },
];

export function getMetricById(id: string): MetricDefinition | undefined {
  return metricRegistry.find((m) => m.id === id);
}

