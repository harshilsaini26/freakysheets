"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/lib/format";

export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function Sparkline({ values, width = 84, height = 24 }: { values: (number | null)[]; width?: number; height?: number }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />;
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={x(last[0])} cy={y(last[1])} r={2.4} fill="var(--accent)" />
    </svg>
  );
}

/** Where a value sits among peers: quartile box plus a marker. */
export function PercentileBar({ percentile, better }: { percentile: number | null; better: "higher" | "lower" | null }) {
  if (percentile === null) return <span className="text-xs text-muted">–</span>;
  const good = better === null ? null : better === "higher" ? percentile : 1 - percentile;
  const color = good === null ? "var(--muted)" : good >= 0.66 ? "var(--good)" : good <= 0.33 ? "var(--bad)" : "var(--gold)";
  return (
    <div className="relative h-2.5 w-28 rounded-full bg-panel-2" title={`${Math.round(percentile * 100)}th percentile`}>
      <div className="absolute inset-y-0 left-1/4 right-1/4 rounded-full bg-line" />
      <div
        className="absolute -top-0.5 h-3.5 w-1.5 rounded-sm"
        style={{ left: `calc(${percentile * 100}% - 3px)`, background: color }}
      />
    </div>
  );
}

export function TrendChart({
  years,
  series,
  format = money,
  height = 260,
}: {
  years: number[];
  series: { name: string; values: Record<string, number> }[];
  format?: (v: number) => string;
  height?: number;
}) {
  const data = years.map((y) => {
    const row: Record<string, number | string> = { year: `FY${y}` };
    for (const s of series) if (s.values[String(y)] !== undefined) row[s.name] = s.values[String(y)];
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => format(v)} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          formatter={(v) => format(Number(v))}
          contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.name} animationDuration={500} type="monotone" dataKey={s.name} stroke={SERIES_COLORS[i % 4]} strokeWidth={2.2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({
  years,
  series,
  format,
  height = 220,
}: {
  years: number[];
  series: { name: string; values: Record<string, number> }[];
  format: (v: number) => string;
  height?: number;
}) {
  const data = years.map((y) => {
    const row: Record<string, number | string> = { year: `FY${y}` };
    for (const s of series) if (s.values[String(y)] !== undefined) row[s.name] = s.values[String(y)];
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => format(v)} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          formatter={(v) => format(Number(v))}
          cursor={{ fill: "var(--panel-2)" }}
          contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar key={s.name} dataKey={s.name} fill={SERIES_COLORS[i % 4]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal zone gauge for scores such as Altman Z or Piotroski F. */
export function ZoneGauge({
  value,
  min,
  max,
  zones,
}: {
  value: number;
  min: number;
  max: number;
  zones: { to: number; color: string; label: string }[];
}) {
  const clamp = Math.min(Math.max(value, min), max);
  const pos = ((clamp - min) / (max - min)) * 100;
  let from = min;
  return (
    <div>
      <div className="relative flex h-3 overflow-hidden rounded-full">
        {zones.map((z) => {
          const w = ((Math.min(z.to, max) - from) / (max - min)) * 100;
          from = z.to;
          return <div key={z.label} style={{ width: `${w}%`, background: z.color, opacity: 0.35 }} />;
        })}
        <div className="absolute -top-1 h-5 w-1.5 rounded bg-ink" style={{ left: `calc(${pos}% - 3px)` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        {zones.map((z) => (
          <span key={z.label}>{z.label}</span>
        ))}
      </div>
    </div>
  );
}
