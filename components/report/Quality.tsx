"use client";
import { ZoneGauge } from "../charts";
import type { ReportProps } from "./CompanyReport";

const PIOTROSKI_LABELS: Record<string, string> = {
  positive_roa: "Positive return on assets",
  positive_cfo: "Positive operating cash flow",
  improving_roa: "ROA improved vs last year",
  cfo_exceeds_net_income: "Cash flow exceeds net income (accruals)",
  lower_leverage: "Long-term leverage did not rise",
  higher_current_ratio: "Current ratio improved",
  no_dilution: "No new shares issued",
  higher_gross_margin: "Gross margin improved",
  higher_asset_turnover: "Asset turnover improved",
};
const BENEISH_LABELS: Record<string, string> = {
  DSRI: "Days sales in receivables index",
  GMI: "Gross margin index",
  AQI: "Asset quality index",
  SGI: "Sales growth index",
  DEPI: "Depreciation index",
  SGAI: "SG&A index",
  LVGI: "Leverage index",
  TATA: "Total accruals to assets",
};
const FLAG_ICONS: Record<string, string> = {
  earnings_quality: "💧", revenue_recognition: "🧾", inventory: "📦", solvency: "⚓", liquidity: "🚰",
  profitability: "📉", dilution: "🫗", cash_flow: "💸",
};

export function QualityTab({ rec }: ReportProps) {
  const ys = rec.fiscal_years;
  const last = String(ys[ys.length - 1]);
  const z = rec.models.altman_z2?.[last];
  const m = rec.models.beneish?.[last];
  const f = rec.models.piotroski?.[last];
  const flags = [...rec.models.red_flags].sort((a, b) => b.year - a.year);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h3 className="font-bold">Altman Z&apos;&apos; (distress)</h3>
          {z ? (
            <>
              <div className="num my-2 text-3xl font-extrabold">{z.z_score.toFixed(2)} <span className="text-base font-semibold capitalize text-muted">{z.zone}</span></div>
              <ZoneGauge value={z.z_score} min={-1} max={8} zones={[{ to: 1.1, color: "var(--bad)", label: "distress" }, { to: 2.6, color: "var(--gold)", label: "grey" }, { to: 8, color: "var(--good)", label: "safe" }]} />
              <ul className="mt-3 grid gap-1 text-xs text-muted">
                {Object.entries(z.components).map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span>{k.replace(/_/g, " ").replace(/^X(\d)/, "X$1:")}</span><span className="num">{v.toFixed(3)}</span></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{rec.template === "bank" ? "Not meaningful for banks." : "Not enough data (needs working capital, retained earnings and EBIT)."}</p>
          )}
        </div>
        <div className="card p-4">
          <h3 className="font-bold">Beneish M (manipulation screen)</h3>
          {m ? (
            <>
              <div className="num my-2 text-3xl font-extrabold">{m.m_score.toFixed(2)} <span className="text-base font-semibold text-muted">{m.zone}</span></div>
              <ZoneGauge value={m.m_score} min={-4} max={0} zones={[{ to: -2.22, color: "var(--good)", label: "low" }, { to: -1.78, color: "var(--gold)", label: "watch" }, { to: 0, color: "var(--bad)", label: "high" }]} />
              <ul className="mt-3 grid gap-1 text-xs text-muted">
                {Object.entries(m.components).map(([k, v]) => (
                  <li key={k} className="flex justify-between" title={BENEISH_LABELS[k]}>
                    <span>{k}{m.imputed.includes(k) ? " (n/a, set neutral)" : ""}</span><span className="num">{v.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{rec.template === "bank" ? "Not meaningful for banks." : "Not enough data."}</p>
          )}
        </div>
        <div className="card p-4">
          <h3 className="font-bold">Piotroski F (strength)</h3>
          {f ? (
            <>
              <div className="num my-2 text-3xl font-extrabold">{f.f_score}<span className="text-base text-muted">/{f.max_possible}</span> <span className="text-base font-semibold capitalize text-muted">{f.zone}</span></div>
              <ul className="mt-2 grid gap-1 text-xs">
                {Object.entries(f.tests).map(([k, v]) => (
                  <li key={k} className="flex gap-2"><span>{v === null ? "➖" : v ? "✅" : "❌"}</span><span>{PIOTROSKI_LABELS[k] ?? k}</span></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Computed for non-financial companies with two years of data.</p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-bold">🚩 Red flags</h3>
        <p className="mb-3 text-xs text-muted">Rule-based warning signs. A flag is a reason to dig deeper, not a verdict.</p>
        {flags.length === 0 ? (
          <p className="text-sm">No rule-based red flags in FY{ys[1]} to FY{last}.</p>
        ) : (
          <ul className="grid gap-2">
            {flags.map((fl, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg bg-bad-soft/50 px-3 py-2 text-sm">
                <span>{FLAG_ICONS[fl.type] ?? "🚩"}</span>
                <div className="flex-1">
                  <div className="font-medium">{fl.title}</div>
                  <div className="num text-xs text-muted">FY{fl.year} · {fl.evidence}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted">
        Altman Z&apos;&apos; uses book equity because the app has no market prices. These scores were built on specific historical samples;
        treat them as teaching tools.
      </p>
    </div>
  );
}
