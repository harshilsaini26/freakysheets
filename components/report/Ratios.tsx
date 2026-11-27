"use client";
import { Fragment, useState } from "react";
import type { RatioMeta } from "@/lib/engine/types";
import { fmtUnit, ordinal } from "@/lib/format";
import { PercentileBar, Sparkline } from "../charts";
import type { ReportProps } from "./CompanyReport";

export function RatiosTab({ rec, catalog, peer }: ReportProps & { meta: Record<string, RatioMeta> }) {
  const [open, setOpen] = useState<string | null>(null);
  const ys = rec.fiscal_years;
  const cats: { id: string; label: string; items: RatioMeta[] }[] = [];
  for (const m of catalog) {
    if (!m.templates.includes(rec.template) || m.category === "dupont") continue;
    const s = rec.ratios[m.id];
    if (!s || !Object.keys(s).length) continue;
    let c = cats.find((x) => x.id === m.category);
    if (!c) cats.push((c = { id: m.category, label: m.category_label, items: [] }));
    c.items.push(m);
  }
  const fallback = rec.ratios_used_ending_balance.length > 0;

  return (
    <div className="grid gap-6">
      {peer && <p className="text-sm text-muted">Peer column: {peer.label}, FY{peer.year}. The bar shows where this company sits; the grey band is the middle 50% of peers.</p>}
      {cats.map((c) => (
        <div key={c.id} className="card overflow-x-auto p-4">
          <h3 className="mb-2 font-bold">{c.label}</h3>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="py-2 text-left font-semibold">Ratio</th>
                {ys.map((y) => (
                  <th key={y} className="py-2 pl-3 text-right font-semibold">FY{y}</th>
                ))}
                <th className="py-2 pl-3 font-semibold">Trend</th>
                {peer && <th className="py-2 pl-3 text-right font-semibold">Peer median</th>}
                {peer && <th className="py-2 pl-3 text-left font-semibold">vs peers</th>}
              </tr>
            </thead>
            <tbody>
              {c.items.map((m) => {
                const s = rec.ratios[m.id];
                const pc = peer?.ratios[m.id];
                const isOpen = open === m.id;
                return (
                  <Fragment key={m.id}>
                    <tr className="cursor-pointer border-b border-line/60 hover:bg-panel-2" onClick={() => setOpen(isOpen ? null : m.id)}>
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{m.name}</span>
                        {m.better && <span className="ml-1 text-xs text-muted">{m.better === "higher" ? "↑ better" : "↓ better"}</span>}
                      </td>
                      {ys.map((y) => (
                        <td key={y} className="num py-1.5 pl-3 text-right">{fmtUnit(s[String(y)], m.unit)}</td>
                      ))}
                      <td className="py-1.5 pl-3"><Sparkline values={ys.map((y) => s[String(y)] ?? null)} /></td>
                      {peer && <td className="num py-1.5 pl-3 text-right text-muted">{pc ? fmtUnit(pc.median, m.unit) : "–"}</td>}
                      {peer && (
                        <td className="py-1.5 pl-3">
                          <div className="flex items-center gap-2">
                            <PercentileBar percentile={pc?.percentile ?? null} better={m.better} />
                            {pc?.percentile != null && <span className="text-xs text-muted">{ordinal(Math.round(pc.percentile * 100))}</span>}
                          </div>
                        </td>
                      )}
                    </tr>
                    {isOpen && (
                      <tr className="bg-panel-2/60">
                        <td colSpan={ys.length + (peer ? 4 : 2)} className="px-3 py-3 text-sm">
                          <div className="font-mono text-xs">{m.formula}</div>
                          <p className="mt-1">{m.explain}</p>
                          <p className="mt-1 text-xs text-muted">{m.cfa_reading}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-muted">
        Click any ratio for its formula. Ratios that divide a flow by a balance use the average of the opening and closing balance.
        {fallback && ` For FY${rec.ratios_used_ending_balance.join(", FY")} the opening balance was missing, so the ending balance was used.`}
      </p>
    </div>
  );
}
