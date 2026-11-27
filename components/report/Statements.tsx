"use client";
import { useState } from "react";
import type { Section } from "@/lib/engine/types";
import { CONCEPTS } from "@/lib/engine/core";
import { fmtItem, pct } from "@/lib/format";
import type { ReportProps } from "./CompanyReport";

const SECTIONS: { id: Section; label: string; base: string }[] = [
  { id: "income", label: "Income statement", base: "revenue" },
  { id: "balance", label: "Balance sheet", base: "total_assets" },
  { id: "cashflow", label: "Cash flow", base: "revenue" },
];
const DERIVED_ORDER: Record<Section, string[]> = {
  income: ["ebit", "ebitda", "effective_tax_rate"],
  balance: ["total_debt", "net_debt", "working_capital", "invested_capital", "tangible_equity"],
  cashflow: ["fcf"],
};
// Display order that reads like a real statement.
const ORDER: Record<Section, string[]> = {
  income: ["revenue", "interest_income", "interest_expense_bank", "net_interest_income", "noninterest_income", "premiums_earned",
    "cost_of_revenue", "gross_profit", "rnd", "sga", "provision", "noninterest_expense", "claims_incurred", "underwriting_expense",
    "operating_income", "interest_expense", "pretax_income", "income_tax", "net_income", "eps_diluted", "shares_diluted"],
  balance: ["cash", "short_term_investments", "receivables", "inventory", "current_assets", "loans", "loan_allowance", "investments",
    "ppe", "goodwill", "intangibles", "total_assets", "accounts_payable", "deposits", "short_term_debt", "current_liabilities",
    "long_term_debt", "total_liabilities", "retained_earnings", "equity", "equity_incl_nci", "shares_outstanding"],
  cashflow: ["cfo", "d_and_a", "sbc", "capex", "cfi", "dividends_paid", "buybacks", "cff"],
};
const BOLD = new Set(["revenue", "gross_profit", "operating_income", "net_income", "total_assets", "total_liabilities", "equity",
  "current_assets", "current_liabilities", "cfo", "cfi", "cff", "fcf", "net_interest_income"]);

type Mode = "reported" | "common" | "trend";

export function StatementsTab({ rec }: ReportProps) {
  const [sect, setSect] = useState<Section>("income");
  const [mode, setMode] = useState<Mode>("reported");
  const ys = rec.fiscal_years;
  const present = new Set(Object.keys(rec.statements[sect]));
  const templateKeys = new Set(CONCEPTS[rec.template].filter((c) => c.statement === sect).map((c) => c.key));
  const rows = [
    ...ORDER[sect].filter((k) => templateKeys.has(k) && present.has(k)),
    ...[...templateKeys].filter((k) => present.has(k) && !ORDER[sect].includes(k)),
  ];
  const derived = DERIVED_ORDER[sect].filter((k) => present.has(k));
  const base = SECTIONS.find((s) => s.id === sect)!.base;

  const cell = (k: string, y: number) => {
    const v = rec.statements[sect][k]?.[String(y)];
    if (mode === "reported") return fmtItem(k, v);
    if (mode === "common") {
      const cs = rec.models.common_size[sect]?.[k]?.[String(y)];
      return cs === undefined || k.startsWith("shares") || k === "eps_diluted" ? "" : pct(cs);
    }
    const first = rec.statements[sect][k]?.[String(ys[0])];
    if (v === undefined || !first || k === "effective_tax_rate") return "";
    return ((100 * v) / first).toFixed(0);
  };

  const Row = ({ k, derivedRow }: { k: string; derivedRow?: boolean }) => {
    const src = rec.sources[k]?.[String(ys[ys.length - 1])];
    return (
      <tr className={`border-b border-line/60 ${BOLD.has(k) ? "font-semibold" : ""}`}>
        <td className="py-1.5 pr-4" title={src ? `XBRL tag: us-gaap:${src}` : derivedRow ? "Derived by the app from reported lines" : undefined}>
          {rec.labels[k] ?? k}
          {derivedRow && <span className="ml-1 text-xs text-muted">(derived)</span>}
        </td>
        {ys.map((y) => (
          <td key={y} className="num py-1.5 pl-3 text-right">
            {cell(k, y)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-panel-2 p-1">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSect(s.id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${sect === s.id ? "bg-panel shadow-sm" : "text-muted"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-panel-2 p-1 text-sm">
          {([["reported", "As reported"], ["common", `Common-size (% of ${base === "revenue" ? "revenue" : "assets"})`], ["trend", `Trend (FY${ys[0]} = 100)`]] as [Mode, string][]).map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 font-semibold ${mode === m ? "bg-panel shadow-sm" : "text-muted"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="py-2 text-left font-semibold">Line item</th>
              {ys.map((y) => (
                <th key={y} className="py-2 pl-3 text-right font-semibold">
                  FY{y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <Row key={k} k={k} />
            ))}
            {derived.length > 0 && (
              <tr>
                <td colSpan={ys.length + 1} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  Analyst subtotals
                </td>
              </tr>
            )}
            {derived.map((k) => (
              <Row key={k} k={k} derivedRow />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        {rec.sources && Object.keys(rec.sources).length
          ? "Hover a line to see the US-GAAP XBRL tag it came from. "
          : ""}
        Blank cells mean the company did not report that line in a way the parser could match; ratios that need it are left blank
        rather than guessed. Coverage: {Math.round(rec.coverage.filled_share * 100)}% of line items.
      </p>
    </div>
  );
}
