import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import { getGeneratedAt, hasSecData } from "@/lib/data";

export const metadata: Metadata = { title: "Method & sources" };

export default function About() {
  const at = getGeneratedAt();
  return (
    <article className="mx-auto max-w-3xl leading-relaxed">
      <h1 className="text-3xl font-extrabold tracking-tight">Method &amp; sources</h1>
      <h2 className="mt-6 text-xl font-bold">Where the numbers come from</h2>
      <p className="mt-2">
        {APP_NAME} reads the XBRL data that companies file with their 10-K annual reports, through the SEC&apos;s free
        <code className="mx-1 font-mono text-sm">companyfacts</code> API. That is US government public-domain data and needs no API key.
        Only annual 10-K facts covering about twelve months are used; when a figure is restated, the latest filing wins.
        {hasSecData() ? ` The current dataset was built on ${at?.slice(0, 10)}.` : " The SEC dataset has not been built on this deployment yet."}
      </p>
      <p className="mt-2">
        Companies tag the same concept differently over time (for example, revenue moved from <code className="font-mono text-sm">SalesRevenueNet</code> to
        <code className="mx-1 font-mono text-sm">RevenueFromContractWithCustomerExcludingAssessedTax</code>), so each line item has a ranked list of tags and the
        first one with a value is chosen year by year. Hover a line on any statement to see the tag used. Missing items stay blank;
        nothing is invented.
      </p>
      <h2 className="mt-6 text-xl font-bold">What is computed</h2>
      <ul className="mt-2 list-disc pl-6">
        <li>Common-size and trend statements, five-year CAGRs</li>
        <li>70+ ratios across profitability, returns, leverage, coverage, liquidity, efficiency, cash-flow quality, growth and payout, using average balances as the CFA curriculum does</li>
        <li>Three- and five-step DuPont, checked so the legs multiply back to ROE</li>
        <li>Bank and insurer layouts with their own ratios (NII / assets, efficiency ratio, loan-to-deposit, credit cost, loss ratio)</li>
        <li>Altman Z&apos;&apos;, Beneish M, Piotroski F, a Sloan-style accruals ratio and twelve rule-based red flags</li>
        <li>Transparent next-year projections (CAGR and linear trend) and sustainable growth</li>
        <li>Peer percentiles within GICS-style sector groups, with banks and payment networks split out</li>
      </ul>
      <p className="mt-2">
        The same calculations run in Python (the data pipeline) and in TypeScript (your browser, for uploads). Automated tests check that
        both give identical results.
      </p>
      <h2 className="mt-6 text-xl font-bold">Inspiration</h2>
      <p className="mt-2">
        Reference projects: JerBouma/FinanceToolkit (a broad open-source ratio and model library, which shaped the breadth of the ratio
        set here) and xbtlin/ai-berkshire (a Berkshire-style investing project, which inspired the durable-business checklist).
        bukosabino/ta (technical indicators) and shiyu-coder/Kronos (a forecasting model for price candles) work on market prices,
        which SEC filings do not include, so they are candidates for a later version that adds price data.
      </p>
      <h2 className="mt-6 text-xl font-bold">Limits</h2>
      <ul className="mt-2 list-disc pl-6">
        <li>Altman Z&apos;&apos; uses book equity because there are no market prices.</li>
        <li>NIM is approximated with total assets; regulatory capital ratios (CET1) are not in XBRL company facts.</li>
        <li>Projections and scores are teaching tools, not investment advice.</li>
        <li>CFA® and Chartered Financial Analyst® are trademarks of CFA Institute, which does not endorse this app. Lesson topics follow the public Level I curriculum outline, written in our own words.</li>
      </ul>
    </article>
  );
}
