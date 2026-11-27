// Build-time data access (server only). Reads the JSON written by the Python
// pipeline: SEC companies in pipeline/data/companies and the fictional
// training companies in pipeline/data/practice.
import "server-only";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CompanyRecord, IndexRow, PeersFile, RatioMeta } from "./engine/types";

// LEDGER_DATA_DIR lets you point a local build at another dataset (used for testing).
const DATA = process.env.LEDGER_DATA_DIR ?? join(process.cwd(), "pipeline", "data");

function readJson<T>(...parts: string[]): T | null {
  const p = join(DATA, ...parts);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
}

let cache: { records: Map<string, CompanyRecord>; index: IndexRow[]; generatedAt: string | null } | null = null;

function load() {
  if (cache) return cache;
  const records = new Map<string, CompanyRecord>();
  for (const dir of ["companies", "practice"]) {
    const full = join(DATA, dir);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full)) {
      if (!f.endsWith(".json") || f === "index.json") continue;
      const rec = readJson<CompanyRecord>(dir, f);
      if (rec) records.set(rec.ticker, rec);
    }
  }
  const secIndex = readJson<{ companies: IndexRow[]; generated_at?: string }>("index.json");
  const practiceIndex = readJson<{ companies: IndexRow[] }>("practice", "index.json");
  const index = [...(secIndex?.companies ?? []), ...(practiceIndex?.companies ?? [])].filter((r) =>
    records.has(r.ticker),
  );
  cache = { records, index, generatedAt: secIndex?.generated_at ?? null };
  return cache;
}

export const getIndex = () => load().index;
export const getGeneratedAt = () => load().generatedAt;
export const getCompany = (ticker: string) => load().records.get(ticker) ?? null;
export const getAllCompanies = () => [...load().records.values()];
export const getCatalog = () => readJson<RatioMeta[]>("ratio_catalog.json") ?? [];
export const getPeers = () => readJson<PeersFile>("peers.json");
export const hasSecData = () => load().index.some((r) => !r.practice);
