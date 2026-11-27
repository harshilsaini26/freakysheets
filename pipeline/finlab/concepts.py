"""Mapping from canonical line items to US-GAAP XBRL tags.

Each line item lists *alternatives* in priority order. An alternative is either
a single tag (str) or a tuple of tags that are summed together (used when a
company splits one concept across several tags, e.g. short-term debt =
current portion of LTD + commercial paper). For every fiscal year the first
alternative that has a value wins, so a company that switches tags between
years (very common) is still covered.

kind: "flow"    -> duration fact (income statement / cash flow, ~1 year)
      "instant" -> point-in-time fact (balance sheet)
unit: XBRL unit key in the companyfacts JSON.
"""

USD, EPS, SHARES = "USD", "USD/shares", "shares"


def item(statement, kind, alts, unit=USD, label=None):
    return {"statement": statement, "kind": kind, "alts": alts, "unit": unit, "label": label}


# ---------------------------------------------------------------- shared items
COMMON = {
    # income statement
    "revenue": item("income", "flow", [
        "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
        "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet",
        "SalesRevenueGoodsNet", "RevenuesNetOfInterestExpense"], label="Revenue"),
    "pretax_income": item("income", "flow", [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesForeign"], label="Pre-tax income"),
    "income_tax": item("income", "flow", ["IncomeTaxExpenseBenefit"], label="Income tax expense"),
    "net_income": item("income", "flow", [
        "NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
        label="Net income (to parent)"),
    "eps_diluted": item("income", "flow", ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
                        unit=EPS, label="Diluted EPS"),
    "shares_diluted": item("income", "flow", [
        "WeightedAverageNumberOfDilutedSharesOutstanding",
        "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"], unit=SHARES,
        label="Diluted weighted avg. shares"),
    # balance sheet
    "cash": item("balance", "instant", [
        "CashAndCashEquivalentsAtCarryingValue", "CashAndDueFromBanks",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"],
        label="Cash & equivalents"),
    "goodwill": item("balance", "instant", ["Goodwill"], label="Goodwill"),
    "intangibles": item("balance", "instant", [
        "IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"],
        label="Other intangibles"),
    "total_assets": item("balance", "instant", ["Assets"], label="Total assets"),
    "total_liabilities": item("balance", "instant", ["Liabilities"], label="Total liabilities"),
    "equity": item("balance", "instant", ["StockholdersEquity"], label="Shareholders' equity (parent)"),
    "equity_incl_nci": item("balance", "instant", [
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
        label="Total equity incl. NCI"),
    "retained_earnings": item("balance", "instant", ["RetainedEarningsAccumulatedDeficit"],
                              label="Retained earnings"),
    "shares_outstanding": item("balance", "instant", ["CommonStockSharesOutstanding"],
                               unit=SHARES, label="Shares outstanding"),
    # cash flow
    "cfo": item("cashflow", "flow", [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
        label="Cash from operations"),
    "cfi": item("cashflow", "flow", [
        "NetCashProvidedByUsedInInvestingActivities",
        "NetCashProvidedByUsedInInvestingActivitiesContinuingOperations"],
        label="Cash from investing"),
    "cff": item("cashflow", "flow", [
        "NetCashProvidedByUsedInFinancingActivities",
        "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations"],
        label="Cash from financing"),
    "dividends_paid": item("cashflow", "flow", [
        "PaymentsOfDividends", "PaymentsOfDividendsCommonStock"], label="Dividends paid"),
    "buybacks": item("cashflow", "flow", ["PaymentsForRepurchaseOfCommonStock"],
                     label="Share repurchases"),
    "sbc": item("cashflow", "flow", ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
                label="Stock-based compensation"),
    "d_and_a": item("cashflow", "flow", [
        "DepreciationDepletionAndAmortization", "DepreciationAndAmortization",
        "DepreciationAmortizationAndAccretionNet", "Depreciation"],
        label="Depreciation & amortization"),
}

# ------------------------------------------------- industrial / commercial firms
STANDARD = {
    **COMMON,
    "cost_of_revenue": item("income", "flow", [
        "CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold",
        "CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization"],
        label="Cost of revenue"),
    "gross_profit": item("income", "flow", ["GrossProfit"], label="Gross profit"),
    "rnd": item("income", "flow", [
        "ResearchAndDevelopmentExpense",
        "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"], label="R&D expense"),
    "sga": item("income", "flow", [
        "SellingGeneralAndAdministrativeExpense",
        ("SellingAndMarketingExpense", "GeneralAndAdministrativeExpense")], label="SG&A expense"),
    "operating_income": item("income", "flow", ["OperatingIncomeLoss"], label="Operating income (EBIT)"),
    "interest_expense": item("income", "flow", [
        "InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt",
        "InterestAndDebtExpense"], label="Interest expense"),
    "short_term_investments": item("balance", "instant", [
        "ShortTermInvestments", "MarketableSecuritiesCurrent",
        "AvailableForSaleSecuritiesDebtSecuritiesCurrent"], label="Short-term investments"),
    "receivables": item("balance", "instant", [
        "AccountsReceivableNetCurrent", "ReceivablesNetCurrent",
        "AccountsNotesAndLoansReceivableNetCurrent"], label="Accounts receivable"),
    "inventory": item("balance", "instant", ["InventoryNet", "InventoryFinishedGoods"], label="Inventory"),
    "current_assets": item("balance", "instant", ["AssetsCurrent"], label="Total current assets"),
    "ppe": item("balance", "instant", [
        "PropertyPlantAndEquipmentNet",
        "PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization"],
        label="PP&E, net"),
    "accounts_payable": item("balance", "instant", [
        "AccountsPayableCurrent", "AccountsPayableAndAccruedLiabilitiesCurrent"], label="Accounts payable"),
    "current_liabilities": item("balance", "instant", ["LiabilitiesCurrent"], label="Total current liabilities"),
    "short_term_debt": item("balance", "instant", [
        "DebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent",
        ("LongTermDebtCurrent", "ShortTermBorrowings", "CommercialPaper"),
        "ShortTermBorrowings"], label="Short-term debt"),
    "long_term_debt": item("balance", "instant", [
        "LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations",
        "LongTermDebtAndFinanceLeaseObligationsNoncurrent"], label="Long-term debt"),
    "capex": item("cashflow", "flow", [
        "PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets",
        "PaymentsForCapitalImprovements"], label="Capital expenditure"),
}

# --------------------------------------------------------- banks & broker-dealers
BANK = {
    **COMMON,
    "revenue": item("income", "flow", [
        "Revenues", "RevenuesNetOfInterestExpense",
        "RevenueFromContractWithCustomerExcludingAssessedTax"], label="Total net revenue"),
    "interest_income": item("income", "flow", [
        "InterestAndDividendIncomeOperating", "InterestIncomeOperating",
        "InterestAndFeeIncomeLoansAndLeases"], label="Interest income"),
    "interest_expense": item("income", "flow", [
        "InterestExpense", "InterestExpenseOperating"], label="Interest expense"),
    "net_interest_income": item("income", "flow", [
        "InterestIncomeExpenseNet", "InterestIncomeExpenseOperatingNet"], label="Net interest income"),
    "noninterest_income": item("income", "flow", ["NoninterestIncome"], label="Non-interest income"),
    "provision": item("income", "flow", [
        "ProvisionForLoanLeaseAndOtherLosses", "ProvisionForLoanAndLeaseLosses",
        "CreditLossExpenseReversal", "ProvisionForCreditLosses"], label="Provision for credit losses"),
    "noninterest_expense": item("income", "flow", ["NoninterestExpense"], label="Non-interest expense"),
    "loans": item("balance", "instant", [
        "LoansAndLeasesReceivableNetReportedAmount",
        "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
        "LoansAndLeasesReceivableNetOfDeferredIncome",
        "NotesReceivableNet"], label="Loans, net"),
    "loan_allowance": item("balance", "instant", [
        "FinancingReceivableAllowanceForCreditLossExcludingAccruedInterest",
        "LoansAndLeasesReceivableAllowance",
        "FinancingReceivableAllowanceForCreditLosses"], label="Allowance for loan losses"),
    "deposits": item("balance", "instant", ["Deposits"], label="Deposits"),
    "short_term_debt": item("balance", "instant", [
        "ShortTermBorrowings", "OtherShortTermBorrowings", "CommercialPaper"], label="Short-term borrowings"),
    "long_term_debt": item("balance", "instant", [
        "LongTermDebt", "LongTermDebtNoncurrent"], label="Long-term debt"),
}

# ----------------------------------------------------------- insurers / conglomerates
INSURER = {
    **STANDARD,
    "premiums_earned": item("income", "flow", [
        "PremiumsEarnedNet", "PremiumsEarnedNetPropertyAndCasualty"], label="Premiums earned"),
    "claims_incurred": item("income", "flow", [
        "PolicyholderBenefitsAndClaimsIncurredNet",
        "LiabilityForUnpaidClaimsAndClaimsAdjustmentExpenseIncurredClaims1",
        "IncurredClaimsPropertyCasualtyAndLiability"], label="Losses & benefits incurred"),
    "underwriting_expense": item("income", "flow", [
        "OtherUnderwritingExpense", "DeferredPolicyAcquisitionCostAmortizationExpense"],
        label="Underwriting expenses"),
    "investments": item("balance", "instant", [
        "Investments", "MarketableSecurities", "AvailableForSaleSecuritiesDebtSecurities"],
        label="Investments"),
}

TEMPLATES = {"standard": STANDARD, "bank": BANK, "insurer": INSURER}

# Human labels for derived items added in extract.derive()
DERIVED_LABELS = {
    "ebit": "EBIT", "ebitda": "EBITDA", "total_debt": "Total debt", "net_debt": "Net debt",
    "fcf": "Free cash flow (CFO - capex)", "working_capital": "Working capital",
    "invested_capital": "Invested capital (debt + equity)", "tangible_equity": "Tangible equity",
    "effective_tax_rate": "Effective tax rate",
}
