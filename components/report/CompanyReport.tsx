"use client";
import { useEffect, useMemo, useState } from "react";
import type { CompanyRecord, RatioMeta } from "@/lib/engine/types";
import type { PeerView } from "@/lib/peers";
import { useProgress } from "@/lib/game/progress";
import { Overview } from "./Overview";
import { StatementsTab } from "./Statements";
import { RatiosTab } from "./Ratios";
import { DuPontTab } from "./DuPont";
import { QualityTab } from "./Quality";
import { ForecastTab } from "./Forecast";

export interface ReportProps {
  rec: CompanyRecord;
  catalog: RatioMeta[];
  peer: PeerView | null;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "statements", label: "Statements" },
  { id: "ratios", label: "Ratios" },
  { id: "dupont", label: "DuPont" },
  { id: "quality", label: "Quality & risk" },
  { id: "forecast", label: "Forecast" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function CompanyReport(props: ReportProps) {
  const { rec } = props;
  const [tab, setTab] = useState<TabId>("overview");
  const { view } = useProgress();
  const meta = useMemo(() => Object.fromEntries(props.catalog.map((c) => [c.id, c])), [props.catalog]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
    if (!rec.uploaded) view(rec.ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.ticker]);

  const select = (t: TabId) => {
    setTab(t);
    if (!rec.uploaded) {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", t);
      window.history.replaceState(null, "", u);
    }
  };

  const y0 = rec.fiscal_years[0];
  const y1 = rec.fiscal_years[rec.fiscal_years.length - 1];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {!rec.uploaded && <span className="chip font-mono">{rec.ticker}</span>}
            <span className="chip">{rec.sector}</span>
            {rec.practice && <span className="chip bg-gold-soft text-gold">Fictional training company</span>}
            {rec.uploaded && <span className="chip bg-accent-soft text-accent">Your upload</span>}
            {rec.template !== "standard" && <span className="chip">{rec.template === "bank" ? "Bank layout" : "Insurer layout"}</span>}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{rec.name}</h1>
          <p className="mt-1 text-sm text-muted">
            FY{y0} to FY{y1} · {rec.source}
          </p>
          {rec.blurb && <p className="mt-2 max-w-2xl text-sm">{rec.blurb}</p>}
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => select(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview {...props} meta={meta} />}
      {tab === "statements" && <StatementsTab {...props} />}
      {tab === "ratios" && <RatiosTab {...props} meta={meta} />}
      {tab === "dupont" && <DuPontTab {...props} />}
      {tab === "quality" && <QualityTab {...props} />}
      {tab === "forecast" && <ForecastTab {...props} />}
    </div>
  );
}
