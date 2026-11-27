// Checks the TypeScript engine against the Python pipeline on the training
// companies: same CSV in, same ratios, scores and red flags out.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { RATIO_FNS } from "../lib/engine/core";
import { analyzeStatements } from "../lib/engine/analyze";
import { parseRows, toStatements } from "../lib/engine/parse";
import type { CompanyRecord } from "../lib/engine/types";
import catalog from "../pipeline/data/ratio_catalog.json";

const PIPE = join(__dirname, "..", "pipeline");
const practice = readdirSync(join(PIPE, "data", "practice")).filter((f) => f !== "index.json");

function close(a: unknown, b: unknown, path: string) {
  if (typeof a === "number" && typeof b === "number") {
    const tol = Math.max(1e-5, Math.abs(b) * 1e-6);
    expect(Math.abs(a - b), `${path}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    expect(Object.keys(a).sort(), `${path} keys`).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(b)) close((a as never)[k], (b as never)[k], `${path}.${k}`);
  } else {
    expect(a, path).toEqual(b);
  }
}

describe("ratio catalog", () => {
  it("has a TypeScript formula for every Python ratio", () => {
    expect(Object.keys(RATIO_FNS).sort()).toEqual(catalog.map((c) => c.id).sort());
    for (const c of catalog) expect(RATIO_FNS[c.id][0], c.id).toEqual(c.templates);
  });
});

describe.each(practice)("parity with Python: %s", (file) => {
  const py: CompanyRecord = JSON.parse(readFileSync(join(PIPE, "data", "practice", file), "utf8"));
  const csv = readFileSync(join(PIPE, "..", "public", "samples", `${py.ticker.toLowerCase()}_sample.csv`), "utf8");
  const rows = Papa.parse<string[]>(csv.trim()).data;
  const parsed = parseRows(rows, py.template);
  const st = toStatements(parsed, py.template);
  const ts = analyzeStatements(st, parsed.years, py.template, {
    name: py.name, sector: py.sector, peerGroup: py.peer_group,
  });

  it("maps every row of the template", () => {
    expect(parsed.rows.filter((r) => !r.key)).toEqual([]);
  });
  it("derives the same statements", () => close(ts.statements, py.statements, "statements"));
  it("computes the same ratios", () => close(ts.ratios, py.ratios, "ratios"));
  it("computes the same models", () => {
    const { red_flags, ...rest } = ts.models;
    const { red_flags: pyFlags, ...pyRest } = py.models;
    close(rest, pyRest, "models");
    expect(red_flags).toEqual(pyFlags);
  });
});
