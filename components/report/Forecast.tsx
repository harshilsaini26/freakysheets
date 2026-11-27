"use client";
import { getItem } from "@/lib/engine/core";
import { money, pct } from "@/lib/format";
import { TrendChart } from "../charts";
import type { ReportProps } from "./CompanyReport";

export function ForecastTab({ rec }: ReportProps) {
  const fc = rec.models.forecast;
  const ys = rec.fiscal_years;
  if (!fc) return <div className="card p-4 text-sm">Forecasts need at least three years of revenue.</div>;
  const hist = Object.fromEntries(ys.map((y) => [String(y), getItem(rec.statements, "revenue", y)]).filter((p) => p[1] !== null)) as Record<string, number>;
  const last = String(ys[ys.length - 1]);
  const cagrPath = { ...(hist[last] !== undefined ? { [last]: hist[last] } : {}), ...(fc.revenue_next_cagr_method !== null ? { [fc.target_year]: fc.revenue_next_cagr_method } : {}) };
  const linPath = { ...(hist[last] !== undefined ? { [last]: hist[last] } : {}), ...(fc.revenue_next_linear_method !== null ? { [fc.target_year]: fc.revenue_next_linear_method } : {}) };

  const rows: [string, string, string][] = [
    ["Revenue CAGR", pct(fc.revenue_cagr), `Compound growth from FY${ys[0]} to FY${last}`],
    ["Growth volatility", pct(fc.revenue_growth_volatility), "Standard deviation of yearly revenue growth"],
    [`FY${fc.target_year} revenue (CAGR method)`, money(fc.revenue_next_cagr_method), "Last revenue × (1 + CAGR)"],
    [`FY${fc.target_year} revenue (linear trend)`, money(fc.revenue_next_linear_method), `Least-squares line, R² = ${fc.linear_trend_r2 ?? "–"}`],
    ["Average net margin (3 yrs)", pct(fc.avg_net_margin_3y), "Used to turn revenue into earnings"],
    [`FY${fc.target_year} net income`, money(fc.net_income_next), "Projected revenue × average margin"],
    [`FY${fc.target_year} EPS`, fc.eps_next === null ? "–" : `$${fc.eps_next.toFixed(2)}`, "Projected NI / latest diluted shares"],
    ["Sustainable growth (g = b × ROE)", pct(fc.sustainable_growth ?? null), "Growth fundable without new equity or extra leverage"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="card p-4 lg:col-span-3">
        <h3 className="mb-2 font-bold">Revenue: history and next-year projections</h3>
        <TrendChart
          years={[...ys, fc.target_year]}
          series={[
            { name: "Reported revenue", values: hist },
            { name: "CAGR projection", values: cagrPath },
            { name: "Linear-trend projection", values: linPath },
          ]}
        />
      </div>
      <div className="card p-4 lg:col-span-2">
        <h3 className="mb-2 font-bold">How the numbers are built</h3>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([a, b, c]) => (
              <tr key={a} className="border-b border-line/60">
                <td className="py-2 pr-2">
                  <div className="font-medium">{a}</div>
                  <div className="text-xs text-muted">{c}</div>
                </td>
                <td className="num py-2 text-right font-semibold">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">{fc.disclaimer}</p>
      </div>
    </div>
  );
}
