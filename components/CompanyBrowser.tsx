"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { IndexRow } from "@/lib/engine/types";
import { money, pct } from "@/lib/format";
import { useProgress } from "@/lib/game/progress";

function Card({ r, seen }: { r: IndexRow; seen: boolean }) {
  return (
    <Link href={`/company/${r.ticker}`} className="card group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="chip font-mono">{r.ticker}</span>
        {seen && <span className="text-xs text-muted" title="You have opened this report">✓ seen</span>}
      </div>
      <div className="mt-2 font-bold leading-tight group-hover:text-accent">{r.name}</div>
      <div className="text-xs text-muted">{r.sector}</div>
      {r.blurb && <p className="mt-2 line-clamp-3 text-xs text-muted">{r.blurb}</p>}
      <div className="mt-auto grid grid-cols-3 gap-2 pt-3 text-xs">
        <div><div className="text-muted">Revenue</div><div className="num font-semibold">{money(r.latest.revenue)}</div></div>
        <div><div className="text-muted">Net margin</div><div className="num font-semibold">{pct(r.latest.net_margin)}</div></div>
        <div><div className="text-muted">ROE</div><div className="num font-semibold">{pct(r.latest.roe)}</div></div>
      </div>
    </Link>
  );
}

export function CompanyBrowser({ sec, practice }: { sec: IndexRow[]; practice: IndexRow[] }) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const { p } = useProgress();
  const sectors = useMemo(() => ["All", ...[...new Set(sec.map((r) => r.sector))].sort()], [sec]);
  const shown = sec.filter(
    (r) =>
      (sector === "All" || r.sector === sector) &&
      (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.ticker.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="mt-6 grid gap-8">
      <section>
        <h2 className="mb-1 text-lg font-bold">🎯 Training grounds</h2>
        <p className="mb-3 text-sm text-muted">Fictional companies with clean, tied-out statements. Each one teaches a pattern.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {practice.map((r) => <Card key={r.ticker} r={r} seen={p.viewed.includes(r.ticker)} />)}
        </div>
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">S&amp;P 500 top 50</h2>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ticker" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
              {sectors.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {sec.length === 0 ? (
          <div className="card p-6 text-sm">
            <p className="font-semibold">The SEC dataset has not been built yet.</p>
            <p className="mt-1 text-muted">
              Run the <b>Refresh SEC data</b> GitHub Action (or <code className="font-mono">python pipeline/build_dataset.py</code>) to
              download the last five 10-Ks for all 50 companies. Until then, the training companies above power every lesson and game.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((r) => <Card key={r.ticker} r={r} seen={p.viewed.includes(r.ticker)} />)}
          </div>
        )}
      </section>
    </div>
  );
}
