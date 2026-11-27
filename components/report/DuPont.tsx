"use client";
import { useState } from "react";
import { fmtUnit, pct } from "@/lib/format";
import { BarsChart } from "../charts";
import type { ReportProps } from "./CompanyReport";

function Box({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${strong ? "border-accent bg-accent-soft" : "border-line bg-panel"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-lg font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

const Op = ({ c }: { c: string }) => <div className="self-center text-xl font-bold text-muted">{c}</div>;

export function DuPontTab({ rec }: ReportProps) {
  const ys = rec.fiscal_years;
  const [y, setY] = useState(ys[ys.length - 1]);
  const r = (id: string) => rec.ratios[id]?.[String(y)];
  const nm = r("dupont_net_margin");
  const at = r("dupont_asset_turnover");
  const em = r("dupont_equity_multiplier");
  const tb = r("dupont_tax_burden");
  const ib = r("dupont_interest_burden");
  const eb = r("dupont_ebit_margin");
  const roe = r("roe");
  const check = r("dupont_roe_check");
  const five = tb !== undefined && ib !== undefined && eb !== undefined;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Year:</span>
        {ys.map((yy) => (
          <button key={yy} onClick={() => setY(yy)} className={`rounded-lg px-3 py-1 text-sm font-semibold ${yy === y ? "bg-accent text-white" : "bg-panel-2 text-muted"}`}>
            FY{yy}
          </button>
        ))}
      </div>

      {em === undefined ? (
        <div className="card p-4 text-sm">
          Average shareholders&apos; equity is negative or missing for FY{y}, so ROE and the equity multiplier are not meaningful.
          This usually happens after years of large buybacks. Use ROA and ROIC instead.
        </div>
      ) : (
        <>
          <div className="card p-4">
            <h3 className="font-bold">Three-step DuPont</h3>
            <p className="mb-4 text-xs text-muted">ROE = profitability × efficiency × leverage</p>
            <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <Box label="ROE" value={pct(roe ?? check)} strong />
              <Op c="=" />
              <Box label="Net margin" value={pct(nm)} sub="NI / Revenue" />
              <Op c="×" />
              <Box label="Asset turnover" value={fmtUnit(at, "x")} sub="Revenue / Avg assets" />
              <Op c="×" />
              <Box label="Equity multiplier" value={fmtUnit(em, "x")} sub="Avg assets / Avg equity" />
            </div>
          </div>
          {five && (
            <div className="card p-4">
              <h3 className="font-bold">Five-step DuPont</h3>
              <p className="mb-4 text-xs text-muted">Splits net margin into tax, interest and operating pieces.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
                <Box label="Tax burden" value={fmtUnit(tb, "x")} sub="NI / EBT" />
                <Op c="×" />
                <Box label="Interest burden" value={fmtUnit(ib, "x")} sub="EBT / EBIT" />
                <Op c="×" />
                <Box label="EBIT margin" value={pct(eb)} sub="EBIT / Revenue" />
                <Op c="×" />
                <Box label="Asset turnover" value={fmtUnit(at, "x")} />
                <Op c="×" />
                <Box label="Equity multiplier" value={fmtUnit(em, "x")} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="card p-4">
        <h3 className="mb-2 font-bold">Which lever moved?</h3>
        <BarsChart
          years={ys}
          format={(v) => v.toFixed(2)}
          series={[
            { name: "Net margin ×10", values: Object.fromEntries(Object.entries(rec.ratios.dupont_net_margin ?? {}).map(([k, v]) => [k, v * 10])) },
            { name: "Asset turnover", values: rec.ratios.dupont_asset_turnover ?? {} },
            { name: "Equity multiplier", values: rec.ratios.dupont_equity_multiplier ?? {} },
          ]}
        />
        <p className="mt-2 text-xs text-muted">Net margin is scaled ×10 so all three legs fit on one axis.</p>
      </div>
    </div>
  );
}
