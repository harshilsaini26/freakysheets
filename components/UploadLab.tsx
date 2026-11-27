"use client";
import { useMemo, useRef, useState } from "react";
import type { CompanyRecord, PeersFile, RatioMeta, Template } from "@/lib/engine/types";
import { CONCEPTS } from "@/lib/engine/core";
import { analyzeStatements, peerGroupFor } from "@/lib/engine/analyze";
import { detectScale, parseCsvText, parseRows, toStatements, type Cell, type ParseResult } from "@/lib/engine/parse";
import { peerViewFor } from "@/lib/peers";
import { fmtItem } from "@/lib/format";
import { useProgress } from "@/lib/game/progress";
import { CompanyReport } from "./report/CompanyReport";

const SAMPLES = [
  { file: "ironwk_sample.csv", name: "Ironworks Machinery", sector: "Industrials", template: "standard" as Template },
  { file: "nimbus_sample.csv", name: "Nimbus Cloud Software", sector: "Information Technology", template: "standard" as Template },
  { file: "harbor_sample.csv", name: "Harbor National Bank", sector: "Financials", template: "bank" as Template },
];
const SCALES = [
  { v: 1, label: "As written (units)" },
  { v: 1e3, label: "Thousands" },
  { v: 1e6, label: "Millions" },
  { v: 1e9, label: "Billions" },
];

async function readFile(f: File): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(f.name)) {
    const { default: readXlsx } = await import("read-excel-file/browser");
    const sheets = await readXlsx(f);
    // Stack every sheet so an income statement, balance sheet and cash flow on separate tabs all get read.
    // Each sheet's own header row is kept; parseRows uses the first one it finds.
    return sheets.flatMap((s) => s.data as Cell[][]);
  }
  if (/\.xls$/i.test(f.name)) throw new Error("Old .xls files are not supported. Save the file as .xlsx or .csv and try again.");
  return parseCsvText(await f.text());
}

export function UploadLab({ catalog, peers, sectors }: { catalog: RatioMeta[]; peers: PeersFile | null; sectors: string[] }) {
  const { p, addXp, badge } = useProgress();
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("standard");
  const [scale, setScale] = useState(1);
  const [name, setName] = useState("My company");
  const [sector, setSector] = useState("Industrials");
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [rec, setRec] = useState<CompanyRecord | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const parsed: ParseResult | null = useMemo(() => {
    if (!rows) return null;
    const res = parseRows(rows, template, scale);
    return {
      ...res,
      rows: res.rows.map((r) => (r.rowIndex in overrides ? { ...r, key: overrides[r.rowIndex], how: "manual" as const } : r)),
    };
  }, [rows, template, scale, overrides]);

  const load = async (f: File) => {
    setError(null);
    setRec(null);
    setOverrides({});
    try {
      const data = await readFile(f);
      setRows(data);
      setScale(detectScale(data));
      setFileName(f.name);
      setName(f.name.replace(/\.(csv|xlsx)$/i, "").replace(/[_-]+/g, " "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const loadSample = async (s: (typeof SAMPLES)[number]) => {
    const text = await (await fetch(`/samples/${s.file}`)).text();
    setRows(await parseCsvText(text));
    setFileName(s.file);
    setName(`${s.name} (sample)`);
    setSector(s.sector);
    setTemplate(s.template);
    setScale(1);
    setOverrides({});
    setRec(null);
    setError(null);
  };

  const analyze = () => {
    if (!parsed) return;
    const st = toStatements(parsed, template);
    const r = analyzeStatements(st, parsed.years, template, { name, sector, peerGroup: peerGroupFor(sector, template) });
    setRec(r);
    if (!p.badges.includes("uploader")) {
      addXp(30, "first analysis");
      badge("uploader");
    }
    setTimeout(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const keys = CONCEPTS[template];
  const matched = parsed?.rows.filter((r) => r.key).length ?? 0;
  const mustHave = ["revenue", "net_income", "total_assets"];
  const missing = mustHave.filter((k) => !parsed?.rows.some((r) => r.key === k));
  const lastYear = parsed?.years[parsed.years.length - 1];
  const better = Object.fromEntries(catalog.map((c) => [c.id, c.better]));
  const cats = Object.fromEntries(catalog.map((c) => [c.id, c.category]));
  const peer = rec ? peerViewFor(rec, peers, better, cats) : null;

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) load(f);
          }}
          onClick={() => input.current?.click()}
          className={`card grid cursor-pointer place-items-center border-2 border-dashed p-10 text-center ${drag ? "border-accent bg-accent-soft" : ""}`}
        >
          <div>
            <div className="text-4xl">📤</div>
            <p className="mt-2 font-semibold">{fileName ? `Loaded: ${fileName}` : "Drop a .csv or .xlsx file here, or click to choose"}</p>
            <p className="mt-1 text-xs text-muted">Rows = line items, columns = fiscal years. Negative numbers in (brackets) are fine.</p>
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          />
        </div>
        <div className="card p-4 text-sm">
          <h3 className="font-bold">No file handy?</h3>
          <p className="mt-1 text-muted">Try a sample, or download the template and fill in your own numbers.</p>
          <div className="mt-3 grid gap-2">
            {SAMPLES.map((s) => (
              <button key={s.file} className="btn btn-ghost justify-between" onClick={() => loadSample(s)}>
                <span>{s.name}</span>
                <span className="text-xs text-muted">sample</span>
              </button>
            ))}
            <a className="btn btn-primary justify-center" href="/samples/template.csv" download>
              Download the CSV template
            </a>
          </div>
        </div>
      </div>
      {error && <div className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{error}</div>}

      {parsed && (
        <div className="card p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              <span className="text-xs font-semibold text-muted">Company name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-muted">Sector (for peer comparison)</span>
              <select value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2">
                {sectors.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-muted">Statement layout</span>
              <select value={template} onChange={(e) => { setTemplate(e.target.value as Template); setOverrides({}); }} className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2">
                <option value="standard">Company (industrial / commercial)</option>
                <option value="bank">Bank</option>
                <option value="insurer">Insurer / conglomerate</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold text-muted">Numbers are in</span>
              <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2">
                {SCALES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {parsed.warnings.map((w) => (
            <p key={w} className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold">{w}</p>
          ))}

          {parsed.years.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">Check the line-item mapping</h3>
                <span className="text-sm text-muted">
                  {matched} of {parsed.rows.length} rows matched · years FY{parsed.years[0]} to FY{lastYear}
                </span>
              </div>
              <p className="text-xs text-muted">Fix anything the matcher got wrong. Unmatched rows are ignored. Subtotals like EBIT, free cash flow and total debt are derived for you.</p>
              <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-panel-2 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Row in your file</th>
                      <th className="px-3 py-2 text-right">FY{lastYear}</th>
                      <th className="px-3 py-2 text-left">Maps to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r) => (
                      <tr key={r.rowIndex} className={`border-t border-line/60 ${r.key ? "" : "text-muted"}`}>
                        <td className="px-3 py-1.5">{r.label}</td>
                        <td className="num px-3 py-1.5 text-right">{r.key ? fmtItem(r.key, r.values[String(lastYear)]) : r.values[String(lastYear)]?.toLocaleString() ?? "–"}</td>
                        <td className="px-3 py-1.5">
                          <select
                            value={r.key ?? ""}
                            onChange={(e) => setOverrides((o) => ({ ...o, [r.rowIndex]: e.target.value || null }))}
                            className={`w-full rounded-md border px-2 py-1 text-sm ${r.key ? "border-accent/50 bg-accent-soft/40" : "border-line bg-panel"}`}
                          >
                            <option value="">(ignore)</option>
                            {keys.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted">
                  {missing.length ? `Still needed: ${missing.join(", ").replace(/_/g, " ")}.` : "Ready to analyze."}
                </span>
                <button className="btn btn-primary" disabled={missing.length > 0} onClick={analyze}>
                  Run the analysis →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {rec && (
        <div id="report" className="border-t border-line pt-6">
          <CompanyReport rec={rec} catalog={catalog} peer={peer} />
        </div>
      )}
    </div>
  );
}
