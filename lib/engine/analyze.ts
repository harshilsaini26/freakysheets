import { computeRatios, coverage, derive, labelsFor, runModels } from "./core";
import type { CompanyRecord, Statements, Template } from "./types";

/** Run the full analysis on statements (same output shape as the SEC dataset). */
export function analyzeStatements(
  statementsIn: Statements,
  yearsIn: number[],
  template: Template,
  meta: { name: string; sector: string; peerGroup: string; nYears?: number },
): CompanyRecord {
  const statements: Statements = structuredClone(statementsIn);
  const years = [...yearsIn].sort((a, b) => a - b);
  derive(statements, years, template);
  const data = { years, statements };
  const n = meta.nYears ?? 5;
  // Like the Python pipeline: if there is an extra early year, it is only used for averages.
  const analysisYears = years.length > n ? years.slice(-n) : years;
  const { ratios, fallback } = computeRatios(data, template, analysisYears);
  const models = runModels(data, ratios, template, analysisYears);
  return {
    ticker: "UPLOAD",
    name: meta.name,
    entity_name: meta.name,
    cik: null,
    sector: meta.sector,
    template,
    peer_group: meta.peerGroup,
    uploaded: true,
    fiscal_years: analysisYears,
    prior_year: years.length > analysisYears.length ? years[0] : null,
    period_end: {},
    units: "As uploaded (one currency unit)",
    labels: labelsFor(template),
    statements,
    sources: {},
    ratios,
    ratios_used_ending_balance: fallback,
    models,
    coverage: coverage(statements, analysisYears, template),
    source: "Uploaded by you. Analyzed in your browser; nothing is sent to a server.",
  };
}

export function peerGroupFor(sector: string, template: Template) {
  if (template === "bank") return "Banks & Brokers";
  if (template === "insurer") return "Insurance & Conglomerates";
  if (sector === "Financials") return "Payments & Financial Services";
  return sector;
}
