// Shapes shared by the SEC dataset (written by pipeline/build_dataset.py), the
// fictional training companies and statements users upload. Year keys are
// strings because the data round-trips through JSON.

export type Template = "standard" | "bank" | "insurer";
export type Section = "income" | "balance" | "cashflow";
export type Series = Record<string, number>;
export type Statements = Record<Section, Record<string, Series>>;

export interface RatioMeta {
  id: string;
  name: string;
  category: string;
  category_label: string;
  formula: string;
  better: "higher" | "lower" | null;
  templates: Template[];
  explain: string;
  unit: "pct" | "x" | "days" | "usd";
  cfa_reading: string;
}

export interface RedFlag {
  year: number;
  type: string;
  title: string;
  evidence: string;
}

export interface AltmanResult {
  z_score: number;
  components: Record<string, number>;
  zone: "safe" | "grey" | "distress";
}
export interface BeneishResult {
  m_score: number;
  components: Record<string, number>;
  imputed: string[];
  threshold: number;
  zone: string;
}
export interface PiotroskiResult {
  f_score: number;
  max_possible: number;
  tests: Record<string, boolean | null>;
  zone: "strong" | "weak" | "neutral";
}
export interface Forecast {
  target_year: number;
  revenue_cagr: number | null;
  revenue_growth_volatility: number | null;
  revenue_next_cagr_method: number | null;
  revenue_next_linear_method: number | null;
  linear_trend_r2: number | null;
  avg_net_margin_3y: number | null;
  net_income_next: number | null;
  eps_next: number | null;
  sustainable_growth: number | null | undefined;
  disclaimer: string;
}

export interface Models {
  common_size: Statements;
  trend_index: Record<string, Series>;
  cagr: Record<string, number>;
  red_flags: RedFlag[];
  forecast: Forecast | null;
  altman_z2?: Record<string, AltmanResult>;
  beneish?: Record<string, BeneishResult>;
  piotroski?: Record<string, PiotroskiResult>;
}

export interface CompanyRecord {
  ticker: string;
  name: string;
  entity_name?: string | null;
  cik?: number | null;
  sector: string;
  template: Template;
  peer_group: string;
  practice?: boolean;
  uploaded?: boolean;
  blurb?: string;
  lesson?: string;
  fiscal_years: number[];
  prior_year: number | null;
  period_end: Record<string, string>;
  units: string;
  labels: Record<string, string>;
  statements: Statements;
  sources: Record<string, Record<string, string>>;
  ratios: Record<string, Series>;
  ratios_used_ending_balance: number[];
  models: Models;
  coverage: { filled_share: number; missing_items: string[] };
  source: string;
}

export interface IndexRow {
  ticker: string;
  name: string;
  sector: string;
  template: Template;
  peer_group: string;
  practice?: boolean;
  blurb?: string;
  fiscal_years: number[];
  latest: {
    revenue: number | null;
    net_income: number | null;
    total_assets: number | null;
    roe: number | null;
    net_margin: number | null;
  };
  coverage: number;
}

export interface BenchStats {
  n: number;
  median: number;
  mean: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  stdev: number;
}

export interface PeerRow {
  value: number;
  peer_median: number;
  percentile: number;
  z: number;
  rank: number;
  n: number;
  score: number | null;
  universe_median: number | null;
}

export interface PeersFile {
  groups: Record<string, { members: string[]; benchmarks: Record<string, BenchStats> }>;
  universe: { members: string[]; benchmarks: Record<string, BenchStats> };
  companies: Record<
    string,
    {
      peer_group: string;
      benchmark: string;
      peers: string[];
      year: number;
      ratios: Record<string, PeerRow>;
      scorecard: Record<string, number>;
    }
  >;
  category_labels: Record<string, string>;
}

export interface ConceptDef {
  key: string;
  statement: Section;
  label: string;
}
