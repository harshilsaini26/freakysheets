# Statement pipeline

Python scripts (standard library only, Python 3.9+) that pull the last five
fiscal years of 10-K financial statements for the companies in
`companies.csv` from **SEC EDGAR** and turn them into CFA-style analysis files
for the web app.

## Quick start

```bash
cd pipeline
export SEC_USER_AGENT="Your Name your.email@example.com"   # required by the SEC
python build_dataset.py                 # ~50 companies, about 1-2 minutes
python -m unittest discover -s tests    # offline tests
```

Windows PowerShell: `$env:SEC_USER_AGENT="Your Name your.email@example.com"`.

## Data source

`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`. This is the XBRL
data companies file with their 10-Ks. It is US government public-domain data,
free, and needs no API key. Downloads are cached in `.cache/sec/`.

How the extraction works (`finlab/extract.py`, `finlab/concepts.py`):

* Only annual 10-K facts are used (10-K, 10-K/A, 10-KT). Flows must cover about 12 months,
  so quarterly numbers inside a 10-K are dropped.
* When a period appears in several filings, the **latest filing wins**, so restatements are applied.
* Each line item has a priority list of US-GAAP tags. Companies change tags over time
  (for example `SalesRevenueNet` became `RevenueFromContractWithCustomer...`), so the first
  tag with a value is chosen **year by year**. The tag used is stored in `sources` so the app
  can answer "where did this number come from?".
* There are three layouts: `standard` (industrial and commercial companies), `bank` (JPM, BAC, WFC,
  MS, GS, AXP: net interest income, provisions, loans, deposits) and `insurer` (BRK: premiums, claims).
* Gaps are filled with accounting identities: gross profit = revenue - COGS, and
  liabilities = assets - equity. Subtotals are added: EBIT, EBITDA, total and net debt, FCF,
  invested capital, working capital and tangible equity.
* Fiscal year means the year the period ends. A 52/53-week year that ends in the first week of
  January counts as the previous year.

## What gets computed

| Study | Contents | File |
|---|---|---|
| Descriptive | Common-size (vertical) statements, trend index (horizontal, base = 100), 5-year CAGRs | `finlab/models.py` |
| Ratios (70+) | Profitability, returns (ROA, ROE, ROTE, ROIC, ROCE), leverage, coverage, liquidity, efficiency (DSO, DOH, DPO, CCC), cash-flow quality, growth, payout, sustainable growth | `finlab/ratios.py` |
| DuPont | 3-step (margin x turnover x leverage) and 5-step (tax burden x interest burden x EBIT margin x turnover x leverage). The product is checked against ROE | `finlab/ratios.py` |
| Bank / insurer | NII/assets (NIM proxy), efficiency ratio, loan-to-deposit, credit cost, reserve coverage, equity/assets, loss ratio | `finlab/ratios.py` |
| Diagnostic | Beneish M-score, Piotroski F-score, Sloan-style accruals ratio, 12 rule-based red flags | `finlab/models.py` |
| Predictive | Altman Z''-score (distress), next-year revenue (CAGR and linear trend), NI and EPS projection, sustainable growth | `finlab/models.py` |
| Peers | Sector peer groups (banks and payments split out), median, quartiles, percentile, z-score, rank, category scorecard | `finlab/peers.py` |

Ratios that divide a flow by a stock use **average** balances, as the CFA curriculum does.
ROE and the equity multiplier are left blank when average equity is negative
(MCD, PM and others, mostly because of buybacks), and a red flag explains why.

## Outputs (`pipeline/data/`)

* `companies/<TICKER>.json`: statements, labels, XBRL sources, ratios, models, red flags and coverage
* `index.json`: the company list for the app
* `peers.json`: peer benchmarks and per-company percentiles and scorecards
* `ratio_catalog.json`: formula, explanation, "higher/lower is better", display unit and CFA reading for each ratio
* `csv/statements_long.csv`, `csv/ratios_long.csv`: flat files for Excel or pandas
* `csv/coverage.csv`: data-quality report showing which line items are missing for each company

## Training companies

`python build_practice.py` writes five fictional companies to `data/practice/` (Nimbus Cloud Software,
BigBox Grocers, Ironworks Machinery, Harbor National Bank, SunRay Power & Light). Their statements are
generated from a few business-model parameters so they always tie out, and each one teaches a pattern.
The same script writes sample CSVs to `../public/samples/`, plus `data/ratio_catalog.json` and
`data/concepts.json`, which the web app's TypeScript engine reads. Rerun it after changing
`finlab/concepts.py` or `finlab/ratios.py`, then run `npm test` to confirm the TypeScript port still matches.

## Analyze your own statement

Copy `templates/custom_statement_template.csv`, replace the numbers (one column per year,
oldest to newest, one currency unit), and run:

```bash
python analyze_file.py my_company.csv --peers data/peers.json --group "Consumer Staples"
python analyze_file.py my_bank.csv --template bank
```

## Editing the company list

`companies.csv` holds an approximate list of the 50 largest S&P 500 companies by market cap
(late 2026). Add or swap rows freely. `template` must be `standard`, `bank` or `insurer`.
Tickers with a dot use a dash (`BRK-B`).

## Caveats

* XBRL tags vary between companies, so check `csv/coverage.csv` after a build. Missing items
  give blank ratios, never invented numbers.
* The NIM here is a proxy (NII / total assets). Regulatory capital ratios such as CET1 are not in XBRL company facts.
* Altman Z'' uses book equity because there is no price data. Models and projections are teaching tools, not investment advice.
