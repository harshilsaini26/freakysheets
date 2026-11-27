import type { RatioMeta } from "./engine/types";

export function money(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function num(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtUnit(v: number | null | undefined, unit: RatioMeta["unit"] | string) {
  if (v === null || v === undefined) return "–";
  switch (unit) {
    case "pct":
      return pct(v);
    case "days":
      return `${v.toFixed(0)} days`;
    case "usd":
      return `$${v.toFixed(2)}`;
    default:
      return `${v.toFixed(2)}x`;
  }
}

/** Format a raw statement line: per-share figures and share counts are not dollars. */
export function fmtItem(key: string, v: number | null | undefined) {
  if (v === null || v === undefined) return "–";
  if (key === "eps_diluted") return `$${v.toFixed(2)}`;
  if (key.startsWith("shares")) return `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M sh`;
  if (key === "effective_tax_rate") return pct(v);
  return money(v);
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
