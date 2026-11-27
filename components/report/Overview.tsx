"use client";
import { useMemo, useState } from "react";
import type { RatioMeta } from "@/lib/engine/types";
import { getItem } from "@/lib/engine/core";
import { fmtUnit, money, pct } from "@/lib/format";
import { qualityChecks } from "@/lib/quality";
import { useProgress } from "@/lib/game/progress";
import { TrendChart } from "../charts";
import type { ReportProps } from "./CompanyReport";

const CAT_LABELS: Record<string, string> = {
  profitability: "Profitability", returns: "Returns", leverage: "Leverage", coverage: "Coverage", liquidity: "Liquidity",
  efficiency: "Efficiency", cash_flow: "Cash flow", growth: "Growth", per_share: "Shareholder", dupont: "DuPont",
  bank: "Bank", insurance: "Insurance",
};

export function Overview({ rec, peer, meta }: ReportProps & { meta: Record<string, RatioMeta> }) {
  const ys = rec.fiscal_years;
  const last = ys[ys.length - 1];
  const g = (k: string, y = last) => getItem(rec.statements, k, y);
  const kpis = [
    { label: "Revenue", v: g("revenue"), cagr: rec.models.cagr.revenue },
    { label: "Net income", v: g("net_income"), cagr: rec.models.cagr.net_income },
    { label: "Cash from operations", v: g("cfo"), cagr: rec.models.cagr.cfo },
    rec.template === "bank"
      ? { label: "Total assets", v: g("total_assets"), cagr: rec.models.cagr.total_assets }
      : { label: "Free cash flow", v: g("fcf"), cagr: rec.models.cagr.fcf },
  ];
  const series = ["revenue", "net_income", "cfo"].map((k) => ({
    name: rec.labels[k] ?? k,
    values: Object.fromEntries(ys.map((y) => [String(y), g(k, y)]).filter((p) => p[1] !== null)) as Record<string, number>,
  }));
  const checks = qualityChecks(rec);
  const passed = checks.filter((c) => c.pass).length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{k.label}</div>
            <div className="num mt-1 text-2xl font-bold">{money(k.v)}</div>
            <div className="mt-1 text-xs text-muted">
              FY{last}
              {k.cagr !== undefined && <> · {ys.length - 1}-yr CAGR <b className={k.cagr >= 0 ? "text-good" : "text-bad"}>{pct(k.cagr)}</b></>}
            </div>
          </div>
        ))}
      </div>

      <CallIt {...{ rec, peer, meta }} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <h3 className="mb-2 font-bold">Five-year trend</h3>
          <TrendChart years={ys} series={series} />
        </div>
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-bold">Peer scorecard</h3>
          {peer && Object.keys(peer.scorecard).length ? (
            <>
              <p className="mb-3 text-xs text-muted">Average percentile vs {peer.label}, FY{peer.year}. 100 = best in group.</p>
              <div className="grid gap-2">
                {Object.entries(peer.scorecard)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, s]) => (
                    <div key={cat} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-muted">{CAT_LABELS[cat] ?? cat}</span>
                      <div className="h-2.5 flex-1 rounded-full bg-panel-2">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round(s * 100)}%`, background: s >= 0.66 ? "var(--good)" : s <= 0.33 ? "var(--bad)" : "var(--gold)" }}
                        />
                      </div>
                      <span className="num w-8 text-right font-semibold">{Math.round(s * 100)}</span>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Peer benchmarks appear once the S&P 500 dataset has been built (see the README). Training companies are compared
              with the real companies in their sector.
            </p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-bold">Durable-business checklist</h3>
          <span className="text-sm text-muted">
            {passed} of {checks.length} passed
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">Simple tests long-term owners use to judge business quality. Hover a row to see why it matters.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {checks.map((c) => (
            <div key={c.name} className="flex items-start gap-2 rounded-lg bg-panel-2 px-3 py-2 text-sm" title={c.why}>
              <span>{c.pass === null ? "➖" : c.pass ? "✅" : "❌"}</span>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {rec.models.red_flags.length} red flag{rec.models.red_flags.length === 1 ? "" : "s"} found. See the Quality & risk tab.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Call it
interface Call {
  key: string;
  q: string;
  options: string[];
  answer: number;
  reveal: string;
}

function buildCalls(rec: ReportProps["rec"], peer: ReportProps["peer"], meta: Record<string, RatioMeta>): Call[] {
  const last = rec.fiscal_years[rec.fiscal_years.length - 1];
  const r = (id: string) => rec.ratios[id]?.[String(last)];
  const calls: Call[] = [];
  const cc = r("cash_conversion");
  if (cc !== undefined)
    calls.push({
      key: "cash_conversion",
      q: `Did ${rec.name} turn at least $1 of operating cash flow for every $1 of net income in FY${last}?`,
      options: ["Yes, CFO ≥ net income", "No, CFO < net income"],
      answer: cc >= 1 ? 0 : 1,
      reveal: `CFO / net income was ${fmtUnit(cc, "x")}. ${cc >= 1 ? "Profits are well backed by cash." : "Some profit has not turned into cash yet; check receivables and inventory."}`,
    });
  const z = rec.models.altman_z2?.[String(last)];
  if (z)
    calls.push({
      key: "altman",
      q: `Which Altman Z'' zone is ${rec.name} in for FY${last}?`,
      options: ["Safe (above 2.6)", "Grey (1.1 to 2.6)", "Distress (below 1.1)"],
      answer: z.zone === "safe" ? 0 : z.zone === "grey" ? 1 : 2,
      reveal: `Z'' = ${z.z_score.toFixed(2)}.`,
    });
  if (rec.template === "bank") {
    const e = r("efficiency_ratio");
    if (e !== undefined)
      calls.push({
        key: "efficiency",
        q: `Is ${rec.name}'s efficiency ratio below 60%?`,
        options: ["Yes", "No"],
        answer: e < 0.6 ? 0 : 1,
        reveal: `Efficiency ratio: ${pct(e)}. Large US banks usually run between 55% and 65%.`,
      });
  }
  const roe = r("roe");
  const med = peer?.ratios.roe?.median;
  if (roe !== undefined && med !== undefined)
    calls.push({
      key: "roe_vs_peers",
      q: `Is ${rec.name}'s ROE above the median of its peers (${peer!.label})?`,
      options: ["Above the median", "Below the median"],
      answer: roe > med ? 0 : 1,
      reveal: `ROE ${pct(roe)} vs peer median ${pct(med)}.`,
    });
  else {
    const nm = r("net_margin");
    if (nm !== undefined)
      calls.push({
        key: "net_margin_10",
        q: `Does ${rec.name} keep more than 10 cents of profit per dollar of revenue?`,
        options: ["Yes, net margin > 10%", "No, net margin ≤ 10%"],
        answer: nm > 0.1 ? 0 : 1,
        reveal: `${meta.net_margin?.name ?? "Net margin"}: ${pct(nm)}.`,
      });
  }
  return calls.slice(0, 3);
}

function CallIt({ rec, peer, meta }: Pick<ReportProps, "rec" | "peer"> & { meta: Record<string, RatioMeta> }) {
  const calls = useMemo(() => buildCalls(rec, peer, meta), [rec, peer, meta]);
  const { p, call, addXp } = useProgress();
  const [local, setLocal] = useState<Record<string, number>>({});
  if (!calls.length) return null;
  return (
    <div className="card border-gold/40 bg-gold-soft/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">🔮 Call it before you look</h3>
        <span className="text-xs text-muted">+15 XP for each right call (once per company)</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {calls.map((c) => {
          const k = `${rec.ticker}:${c.key}`;
          const chosen = local[c.key];
          const done = chosen !== undefined || (!rec.uploaded && k in p.calls);
          return (
            <div key={c.key} className="rounded-xl bg-panel p-3 text-sm">
              <p className="font-medium">{c.q}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.options.map((o, i) => (
                  <button
                    key={o}
                    disabled={done}
                    onClick={() => {
                      setLocal((s) => ({ ...s, [c.key]: i }));
                      const ok = i === c.answer;
                      if (!rec.uploaded && !(k in p.calls)) {
                        call(k, ok);
                        if (ok) addXp(15, "good call");
                      }
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                      done && i === c.answer
                        ? "border-good bg-accent-soft text-good"
                        : chosen === i
                          ? "border-bad bg-bad-soft text-bad"
                          : "border-line hover:bg-panel-2"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {done && <p className="pop mt-2 text-xs text-muted">{c.reveal}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
