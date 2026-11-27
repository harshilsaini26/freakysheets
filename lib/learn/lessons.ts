// The learning path. Each lesson is a short read, a few concept questions and
// drills that use real company numbers. Topics follow the CFA Level I
// Financial Statement Analysis readings, written in our own words.

export interface ConceptQ {
  q: string;
  choices: string[];
  answer: number;
  explain: string;
}

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  reading: string;
  minutes: number;
  summary: string;
  cards: { title: string; body: string; formula?: string }[];
  questions: ConceptQ[];
  drills: string[]; // ids from lib/game/questions.ts DRILLS
  explore?: { ticker: string; tab: string; prompt: string };
  badge?: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "income-statement",
    title: "The Income Statement",
    icon: "🧾",
    reading: "Understanding Income Statements",
    minutes: 6,
    summary: "How a company gets from revenue to earnings per share, and which lines are operating versus financing.",
    cards: [
      { title: "Top to bottom", body: "Revenue minus the direct cost of producing it gives gross profit. Subtract operating expenses such as R&D and SG&A to reach operating income (EBIT). Subtract interest to get pre-tax income, then tax to get net income.", formula: "Revenue − COGS = Gross profit → − OpEx = EBIT → − Interest = EBT → − Tax = Net income" },
      { title: "Accrual accounting", body: "Revenue is recognized when it is earned (control of the good or service passes to the customer), not when cash arrives. Expenses are matched to the revenue they helped produce. That is why profit and cash flow differ." },
      { title: "EBIT vs EBITDA", body: "EBITDA adds back depreciation and amortization, which are non-cash charges. It is popular for comparing companies with different asset ages, but it ignores the real cost of replacing equipment." },
      { title: "EPS: basic vs diluted", body: "Basic EPS divides earnings available to common shareholders by weighted average shares. Diluted EPS also counts shares that options, warrants and convertibles could create, so it is never higher than basic EPS.", formula: "Diluted EPS = (NI − preferred dividends) / (weighted avg. shares + dilutive securities)" },
    ],
    questions: [
      { q: "A company ships goods in December but the customer pays in February. Under accrual accounting, when is the revenue recognized?", choices: ["February, when cash arrives", "December, when control transfers", "Split evenly between the two months", "When the invoice is sent"], answer: 1, explain: "Revenue is recognized when the performance obligation is satisfied, usually when control passes to the customer." },
      { q: "Which line sits between gross profit and operating income?", choices: ["Interest expense", "Income tax", "SG&A and R&D", "Dividends"], answer: 2, explain: "Operating expenses (SG&A, R&D) are subtracted from gross profit to reach operating income. Interest and taxes come after EBIT. Dividends never appear on the income statement." },
      { q: "Why is diluted EPS less than or equal to basic EPS?", choices: ["It uses a higher tax rate", "It includes potential shares from options and convertibles", "It excludes one-off gains", "It uses ending shares instead of average shares"], answer: 1, explain: "Dilutive securities add shares to the denominator; anti-dilutive ones are excluded, so diluted EPS can never exceed basic." },
    ],
    drills: ["gross_margin", "operating_margin", "net_margin"],
    explore: { ticker: "NIMBUS", tab: "statements", prompt: "Open Nimbus Cloud Software's income statement and switch to common-size view." },
  },
  {
    id: "balance-sheet",
    title: "The Balance Sheet",
    icon: "⚖️",
    reading: "Understanding Balance Sheets",
    minutes: 6,
    summary: "A snapshot of what a company owns, what it owes, and what is left for shareholders.",
    cards: [
      { title: "The identity", body: "Assets always equal liabilities plus equity. Every transaction keeps both sides in balance.", formula: "Assets = Liabilities + Shareholders' equity" },
      { title: "Current vs non-current", body: "Current items are expected to turn into cash, or be paid, within one year (or one operating cycle). Working capital is current assets minus current liabilities." },
      { title: "Goodwill and intangibles", body: "When a company buys another for more than the fair value of its net identifiable assets, the excess is goodwill. It is not amortized under US GAAP but is tested for impairment." },
      { title: "Negative equity is not always distress", body: "Companies that buy back large amounts of stock (McDonald's, for example) can show negative book equity while being very profitable. That makes ROE and debt-to-equity meaningless, so analysts switch to measures based on assets or EBITDA." },
    ],
    questions: [
      { q: "A company borrows $100 in cash from a bank. What happens to its balance sheet?", choices: ["Assets +100, equity +100", "Assets +100, liabilities +100", "Liabilities +100, equity −100", "No change until interest is paid"], answer: 1, explain: "Cash (an asset) rises and a loan (a liability) of the same size is recorded." },
      { q: "Which item is a current liability?", choices: ["Goodwill", "Accounts payable", "Long-term bonds due in 2035", "Retained earnings"], answer: 1, explain: "Accounts payable is usually due within a year. Retained earnings is equity, goodwill is an asset." },
      { q: "Firm X pays $500 for a company with net identifiable assets worth $380. How much goodwill is recorded?", choices: ["$0", "$120", "$380", "$500"], answer: 1, explain: "Goodwill = purchase price − fair value of net identifiable assets = 500 − 380." },
    ],
    drills: ["current_ratio", "debt_to_equity"],
    explore: { ticker: "IRONWK", tab: "statements", prompt: "See how goodwill and debt jumped at Ironworks Machinery after its 2023 acquisition." },
  },
  {
    id: "cash-flow",
    title: "The Cash Flow Statement",
    icon: "💵",
    reading: "Understanding Cash Flow Statements",
    minutes: 6,
    summary: "Where cash actually came from and went: operating, investing and financing.",
    cards: [
      { title: "Three buckets", body: "Operating activities (CFO) are the cash effects of running the business. Investing (CFI) covers buying and selling long-term assets and investments. Financing (CFF) covers debt, share issues, buybacks and dividends." },
      { title: "The indirect method", body: "Most companies start from net income, add back non-cash charges (depreciation, stock-based pay), then adjust for working capital. An increase in receivables or inventory reduces CFO; an increase in payables increases it." },
      { title: "Free cash flow", body: "A simple version is CFO minus capital expenditure: the cash left over after keeping and growing the asset base.", formula: "FCF = CFO − Capex" },
      { title: "Cash conversion", body: "CFO divided by net income tells you whether profits are turning into cash. Healthy firms are usually around or above 1.", formula: "Cash conversion = CFO / Net income" },
    ],
    questions: [
      { q: "Accounts receivable increased by $40 during the year. Under the indirect method, the adjustment to net income is:", choices: ["+40", "−40", "0, it is an investing item", "+40 in financing"], answer: 1, explain: "Sales were recorded but cash was not yet collected, so CFO is lower than net income by the increase in receivables." },
      { q: "Under US GAAP, where are dividends paid classified?", choices: ["Operating", "Investing", "Financing", "Not shown"], answer: 2, explain: "US GAAP puts dividends paid in financing. IFRS lets companies choose operating or financing." },
      { q: "A company reports rising net income but falling CFO for two years. The most likely concern is:", choices: ["Too much cash", "Weak earnings quality", "Low leverage", "Higher dividends"], answer: 1, explain: "Profit that does not convert to cash can signal aggressive revenue recognition or working-capital build-up." },
    ],
    drills: ["fcf", "cash_conversion"],
    explore: { ticker: "IRONWK", tab: "quality", prompt: "Ironworks' profit rises while its cash falls. Find the red flags." },
    badge: "three_statements",
  },
  {
    id: "profitability",
    title: "Margins & Common-Size",
    icon: "📊",
    reading: "Financial Analysis Techniques",
    minutes: 5,
    summary: "Compare companies of any size by expressing every line as a percentage.",
    cards: [
      { title: "Vertical (common-size) analysis", body: "Divide each income statement line by revenue and each balance sheet line by total assets. A $3 trillion company and a $3 billion company become directly comparable." },
      { title: "Horizontal (trend) analysis", body: "Index each line to 100 in a base year to see what is growing faster than what. Costs growing faster than revenue erode margins." },
      { title: "Reading margins", body: "Gross margin reflects pricing power and production costs. Operating margin adds overhead and R&D. Net margin includes financing and taxes, so it is the least comparable across capital structures." },
    ],
    questions: [
      { q: "In a common-size balance sheet, each line is divided by:", choices: ["Revenue", "Total assets", "Equity", "Net income"], answer: 1, explain: "Balance sheet items are scaled by total assets; income statement items by revenue." },
      { q: "Which business would you expect to have the lowest gross margin?", choices: ["Software publisher", "Warehouse grocer", "Payment network", "Drug developer"], answer: 1, explain: "Grocers resell physical goods at small markups; gross margins of 10 to 15% are typical." },
    ],
    drills: ["gross_margin", "operating_margin"],
    explore: { ticker: "BIGBOX", tab: "statements", prompt: "Compare BigBox Grocers' common-size income statement with Nimbus Cloud's." },
  },
  {
    id: "liquidity-solvency",
    title: "Liquidity & Solvency",
    icon: "🛟",
    reading: "Financial Analysis Techniques",
    minutes: 5,
    summary: "Can the company pay its bills this year, and can it carry its debt over time?",
    cards: [
      { title: "Liquidity ladder", body: "The current ratio counts all current assets. The quick ratio drops inventory, which can be slow to sell. The cash ratio keeps only cash and marketable securities.", formula: "Quick = (Cash + ST investments + Receivables) / Current liabilities" },
      { title: "Leverage", body: "Debt-to-equity and debt-to-capital show how much of the capital base is borrowed. Net debt / EBITDA estimates how many years of operating earnings it would take to repay debt." },
      { title: "Coverage", body: "Interest coverage (EBIT / interest) shows how comfortably operating profit pays interest. Below about 3x deserves a closer look.", formula: "Interest coverage = EBIT / Interest expense" },
    ],
    questions: [
      { q: "A retailer has a current ratio of 1.4 and a quick ratio of 0.3. What does that tell you?", choices: ["Most current assets are inventory", "It has too much cash", "It has no payables", "It is insolvent"], answer: 0, explain: "The gap between current and quick ratios is mostly inventory." },
      { q: "Which ratio best measures a firm's ability to service interest from operations?", choices: ["Current ratio", "Debt-to-assets", "Interest coverage", "Payout ratio"], answer: 2, explain: "Coverage ratios compare earnings (or cash flow) with fixed financing charges." },
    ],
    drills: ["current_ratio", "debt_to_equity", "interest_coverage"],
    explore: { ticker: "SUNRAY", tab: "ratios", prompt: "SunRay Power is heavily indebted. Check its coverage and leverage ratios." },
  },
  {
    id: "efficiency",
    title: "Activity & the Cash Cycle",
    icon: "🔄",
    reading: "Financial Analysis Techniques",
    minutes: 5,
    summary: "How fast a company turns inventory and receivables into cash, and how long it takes to pay suppliers.",
    cards: [
      { title: "Turnover and days", body: "Turnover ratios divide a flow by an average balance. Days ratios divide 365 by the turnover.", formula: "DSO = 365 / (Revenue / Avg receivables), DOH = 365 / (COGS / Avg inventory)" },
      { title: "Cash conversion cycle", body: "DSO + DOH − DPO is the number of days between paying suppliers and collecting from customers. Grocers and some retailers run negative cycles: their suppliers fund their inventory.", formula: "CCC = DSO + DOH − DPO" },
      { title: "Use averages", body: "Because the numerator covers the whole year and the balance sheet is a snapshot, the CFA curriculum uses the average of opening and closing balances." },
    ],
    questions: [
      { q: "Inventory turnover rises from 6x to 8x. Days inventory on hand:", choices: ["Rises from 61 to 46 days", "Falls from about 61 to about 46 days", "Stays the same", "Cannot be computed"], answer: 1, explain: "DOH = 365 / turnover: 365/6 ≈ 61, 365/8 ≈ 46." },
      { q: "A negative cash conversion cycle means:", choices: ["The firm is losing money", "Customers pay before suppliers must be paid", "Inventory is negative", "Receivables exceed payables"], answer: 1, explain: "The company collects cash from customers before it has to pay its suppliers." },
    ],
    drills: ["dso", "dio", "asset_turnover"],
    explore: { ticker: "BIGBOX", tab: "ratios", prompt: "Find BigBox Grocers' cash conversion cycle under Efficiency." },
  },
  {
    id: "returns-dupont",
    title: "Returns & DuPont",
    icon: "🧩",
    reading: "Financial Analysis Techniques",
    minutes: 7,
    summary: "Break ROE into margin, efficiency and leverage to see what really drives returns.",
    cards: [
      { title: "Three-step DuPont", body: "ROE is the product of net margin, asset turnover and the equity multiplier. Two firms with the same ROE can get there very differently.", formula: "ROE = (NI / Revenue) × (Revenue / Avg assets) × (Avg assets / Avg equity)" },
      { title: "Five-step DuPont", body: "Net margin is split further into tax burden (NI / EBT), interest burden (EBT / EBIT) and EBIT margin, which separates operating skill from financing and tax.", formula: "ROE = Tax burden × Interest burden × EBIT margin × Asset turnover × Equity multiplier" },
      { title: "ROIC", body: "Return on invested capital uses after-tax operating profit over debt plus equity, so it is not distorted by leverage. Compare it with the cost of capital: growth only creates value when ROIC is above it." },
    ],
    questions: [
      { q: "Net margin 5%, asset turnover 2.0x, equity multiplier 1.5x. ROE is:", choices: ["8.5%", "10%", "15%", "20%"], answer: 2, explain: "5% × 2.0 × 1.5 = 15%." },
      { q: "A firm's ROE rose only because its equity multiplier went up. This suggests:", choices: ["Better pricing", "Higher efficiency", "More leverage and more risk", "Lower taxes"], answer: 2, explain: "A higher equity multiplier means more assets per dollar of equity, i.e. more debt." },
      { q: "In five-step DuPont, an interest burden of 0.95 means:", choices: ["5% of EBIT goes to interest", "95% of EBIT goes to interest", "Tax rate is 5%", "Debt is 95% of assets"], answer: 0, explain: "Interest burden = EBT / EBIT; 0.95 means pre-tax profit keeps 95% of operating profit." },
    ],
    drills: ["roe", "roa", "asset_turnover"],
    explore: { ticker: "BIGBOX", tab: "dupont", prompt: "See how a 2% net margin still gives BigBox a double-digit ROE." },
    badge: "dupont",
  },
  {
    id: "earnings-quality",
    title: "Earnings Quality & Red Flags",
    icon: "🚩",
    reading: "Financial Reporting Quality",
    minutes: 7,
    summary: "Spot profits that are not backed by cash and the classic warning signs.",
    cards: [
      { title: "Accruals", body: "The gap between net income and cash flow is accruals. Sloan's research shows high accruals predict weaker future earnings.", formula: "Accruals ratio (cash-flow basis) = (NI − CFO − CFI) / Avg total assets" },
      { title: "Warning signs", body: "Receivables growing much faster than revenue (possible channel stuffing or lax credit), inventory piling up, CFO falling while net income rises, frequent 'one-time' charges, and rising share counts." },
      { title: "Beneish M-score", body: "Eight indices (receivables, margins, asset quality, growth, depreciation, SG&A, leverage and accruals) combine into one score. Above about −1.78 suggests a higher chance of manipulation. It is a screening tool, not proof." },
    ],
    questions: [
      { q: "Revenue grows 4% while receivables grow 30%. The best first question is:", choices: ["Is the dividend safe?", "Are sales being booked before cash is likely to be collected?", "Is the tax rate rising?", "Are buybacks too small?"], answer: 1, explain: "Receivables outpacing sales can signal aggressive revenue recognition or weakening customer credit." },
      { q: "A higher Beneish M-score (closer to zero) indicates:", choices: ["Lower probability of manipulation", "Higher probability of manipulation", "Bankruptcy risk", "Better profitability"], answer: 1, explain: "Scores above about −1.78 are associated with manipulators in Beneish's sample." },
    ],
    drills: ["cash_conversion", "fcf"],
    explore: { ticker: "IRONWK", tab: "quality", prompt: "Read Ironworks' red flags and Beneish components." },
  },
  {
    id: "distress-scores",
    title: "Distress & Strength Scores",
    icon: "🩺",
    reading: "Credit analysis and fundamental screening",
    minutes: 5,
    summary: "Altman's Z-score for distress and Piotroski's F-score for fundamental strength.",
    cards: [
      { title: "Altman Z''", body: "A weighted mix of working capital, retained earnings, EBIT and book equity, each scaled by assets or liabilities. Above 2.6 is the safe zone; below 1.1 signals distress.", formula: "Z'' = 6.56·WC/TA + 3.26·RE/TA + 6.72·EBIT/TA + 1.05·BE/TL" },
      { title: "Piotroski F", body: "Nine pass/fail tests on profitability, leverage and liquidity, and operating efficiency. 7 to 9 is strong, 0 to 3 weak. It was designed to separate winners from losers among cheap stocks." },
      { title: "Use with judgement", body: "These models were built on specific samples (manufacturers, small value stocks). Utilities and banks often look 'distressed' on Altman simply because of their business model." },
    ],
    questions: [
      { q: "A utility scores 1.0 on Altman Z''. The best interpretation is:", choices: ["It will default soon", "Its capital-heavy, debt-funded model drags the score; check coverage and regulation", "The score is wrong", "It should be sold immediately"], answer: 1, explain: "Models must fit the business. Regulated utilities carry high debt by design." },
      { q: "Which is one of Piotroski's nine tests?", choices: ["Dividend increased", "No new shares issued", "Price above 200-day average", "CEO bought shares"], answer: 1, explain: "No dilution (shares outstanding did not increase) is one of the tests." },
    ],
    drills: ["interest_coverage", "current_ratio"],
    explore: { ticker: "SUNRAY", tab: "quality", prompt: "See why SunRay lands in Altman's distress zone." },
  },
  {
    id: "banks",
    title: "Reading a Bank",
    icon: "🏦",
    reading: "Analysis of Financial Institutions",
    minutes: 6,
    summary: "Banks earn a spread, are funded by deposits and are judged on capital and credit quality.",
    cards: [
      { title: "Different statements", body: "A bank's 'revenue' is net interest income (interest earned minus interest paid) plus fee income. Loans are its main assets and deposits its main liabilities." },
      { title: "Key ratios", body: "Net interest margin (here NII / average assets as a proxy), efficiency ratio (cost per dollar of revenue, lower is better), loan-to-deposit, credit cost (provisions / loans) and equity / assets.", formula: "Efficiency ratio = Non-interest expense / Total net revenue" },
      { title: "What does not apply", body: "Current ratio, inventory turnover and gross margin are meaningless for banks, and the Altman score was not built for them." },
    ],
    questions: [
      { q: "A bank's efficiency ratio falls from 62% to 56%. That means:", choices: ["Costs per dollar of revenue fell", "Loans fell", "Credit losses rose", "Deposits fell"], answer: 0, explain: "The efficiency ratio is expense / revenue, so lower is better." },
      { q: "Why is ROA for banks typically around 1%?", choices: ["Banks are unprofitable", "Banks are highly leveraged with huge balance sheets", "Banks pay no tax", "Banks have no equity"], answer: 1, explain: "Assets are roughly 10x equity, so a 1% ROA becomes roughly a 10% ROE." },
    ],
    drills: ["efficiency_ratio", "loan_to_deposit"],
    explore: { ticker: "HARBOR", tab: "ratios", prompt: "Open Harbor National Bank's bank-specific ratios." },
  },
  {
    id: "forecasting",
    title: "Simple Forecasting",
    icon: "🔭",
    reading: "Introduction to Financial Statement Modeling",
    minutes: 5,
    summary: "Turn history into a transparent next-year projection, and know its limits.",
    cards: [
      { title: "Growth rates", body: "The compound annual growth rate smooths multi-year growth into one number.", formula: "CAGR = (End / Start)^(1/years) − 1" },
      { title: "Sustainable growth", body: "How fast a company can grow without new equity or more leverage: the share of earnings it keeps times the return it earns on equity.", formula: "g = b × ROE, where b = 1 − payout ratio" },
      { title: "Margin-driven earnings", body: "Project revenue first, then apply an average margin. This is how most analyst models start, and it shows how sensitive EPS is to small margin changes." },
    ],
    questions: [
      { q: "ROE is 18% and the payout ratio is 40%. The sustainable growth rate is:", choices: ["7.2%", "10.8%", "18%", "22%"], answer: 1, explain: "g = (1 − 0.40) × 18% = 10.8%." },
      { q: "Revenue grew from 100 to 146 over 4 years. The CAGR is about:", choices: ["9.9%", "11.5%", "14.6%", "46%"], answer: 0, explain: "(146/100)^(1/4) − 1 ≈ 9.9%." },
    ],
    drills: ["payout", "net_margin"],
    explore: { ticker: "NIMBUS", tab: "forecast", prompt: "Check Nimbus Cloud's projection and its sustainable growth rate." },
    badge: "graduate",
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const PASS_MARK = 0.6;
