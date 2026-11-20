/**
 * English locale resource (key structure mirrors zh-CN.ts).
 * The key structure is the shared contract across the three locale resources (zh-CN / zh-Hant / en):
 * - Any key added or removed must be changed in all three files at the same time;
 * - {{xxx}} interpolation placeholder names must stay identical across all three;
 * - Source annotations from the data layer (long texts such as the note fields of
 *   taxTables / rentParams / regional) describe data provenance rather than UI copy;
 *   they are not localized for now and are presented in Simplified Chinese uniformly.
 */
const en = {
  app: {
    title: "Financial Freedom Planner",
    currencyLabel: "Currency",
    colorBlindLabel: "Color-blind",
    themeToDark: "Switch to dark theme",
    themeToLight: "Switch to light theme",
    languageLabel: "Language",
    wasmFailed:
      "Failed to load the calculation core: {{message}}. The page remains browsable, but all computed results are unavailable for now; please refresh the page and try again, or make sure the wasm static assets were deployed intact.",
    currencyNotice:
      "Amounts are now shown converted at 1 CNY = {{rate}} {{code}} (rate as of: {{time}}); enter inputs in the display currency and they are written back to CNY automatically; all formulas are currency-agnostic.",
    currencyFallback:
      "Exchange rates are unavailable: only the currency symbol has switched and values remain in CNY terms; you can retry fetching later in the “Tax estimation and multi-currency check” panel.",
    footerDisclaimer:
      "This tool is based on public statistics and simplified assumptions and is for planning reference only; it does not constitute investment advice.",
    footerPrivacy:
      "Purely front-end local computation (Rust → WebAssembly); nothing is collected or uploaded.",
  },
  units: {
    yuan: "yuan",
    yuanPerMonth: "yuan/month",
    yuanPerChild: "yuan/child",
    yuanPerYear: "yuan/year",
    yearUnit: "years",
    wan: "×10k",
    wanUnit: "million CNY",
    localPerYear: "(local currency)/year",
  },
  field: {
    errorRange: "Please enter a value between {{min}} and {{max}}",
  },
  basic: {
    outputTitle: "Financial Freedom Reference Line (480 Rule Baseline)",
    liveUpdate: "Updates in real time as inputs change",
    invalidRealReturn:
      "The real return rate is {{pct}} (≤ 0): the nominal return rate must be higher than the inflation rate to form the positive loop of “returns beating inflation”, so the critical value cannot be computed. Please expand “Core Parameters” to adjust.",
    summaryPrefix:
      "Based on the current inputs, your financial-freedom reference line is about ",
    summarySuffix:
      " (including children, health and major-investment reserves).",
    savePrefix: "Every additional ",
    saveSuffix: " saved buys 1 more of monthly spending.",
    breakdown:
      "Breakdown: monthly expense {{expense}} × multiplier {{multiplier}} + children {{children}} × {{childCost}} + health reserve {{health}} + major investment {{major}}",
    breakdownTitle: "Detailed breakdown",
    expand: "Expand",
    collapse: "Collapse",
    inputTitle: "Basic Parameters",
    monthlyExpense: "Monthly expense",
    monthlyExpenseTooltip:
      "Your average total monthly spending under your current lifestyle; it is the anchor of the whole reference line.",
    planChildren: "Plan to have children",
    planChildrenHint:
      "When enabled, the cost of raising each child is added to the reference line as a lump sum",
    childCount: "Number of children",
    childCountTooltip:
      "How many children you plan to raise; each child's cost is counted separately.",
    childCountHint:
      "Cumulative child-raising cost for ages 0–18; see “Cost per child”.",
    childCost: "Cost per child",
    childCostTooltip:
      "The total cost of raising one child to adulthood (cumulative for ages 0–18).",
    childCostHint:
      "The average cost per child typically drops about 15% with each additional child (ignored by default under the video claim); fold it in yourself if needed.",
    healthReserve: "Lifetime health reserve",
    healthReserveTooltip:
      "A lump sum set aside once for medical spending such as serious illness and long-term care; set it as you see fit.",
    majorInvestment: "Major outlays such as buying a home",
    majorInvestmentTooltip:
      "One-time spending such as a home down payment or large education costs; it does not affect the “multiplier × monthly expense” part and is simply added on top.",
    majorInvestmentHint:
      "Planning to rent for good? Leave this blank and count your monthly rent in the monthly expense instead.",
    coreParams: "Core Parameters (Returns and Inflation; defaults: nominal 4.5% / inflation 2%)",
    nominalReturn: "Nominal return rate (annualized)",
    nominalReturnTooltip:
      "The annualized return on investments before inflation is removed — the figure investment products usually advertise.",
    inflation: "Inflation rate (annualized)",
    inflationTooltip:
      "How fast prices rise each year; the higher inflation is, the less the same money buys in the future.",
    realReturn: "Real return rate (nominal − inflation): ",
    multiplierLine: "480 multiplier = 12 ÷ real return rate: ",
    ruleOrigin:
      "Once you have saved a principal of “monthly expense × multiplier”, investment returns alone (net of inflation) can cover your monthly expenses. With the default parameters (nominal return {{nominal}}, inflation {{inflation}}), the real return rate is {{real}} and the corresponding multiplier is {{multiplier}} — hence the name “480 Rule”.",
  },
  presets: {
    custom: "Custom",
    tagTitle: "Spending mix ({{total}} yuan/month in total)",
    note: "Compiled for tier-1 city terms; edit freely",
    appliedHint: "Applied the “{{name}}” profile parameters",
    cancelHint: "Click again to cancel this profile; basic parameters will fall back to their defaults",
    cancelled: "Cancelled the “{{name}}” profile; basic parameters fell back to their defaults",
    names: {
      singleRenter: "Single renter",
      coupleNoKids: "Couple without kids",
      familyOneKid: "Family with one child",
      zenFrugal: "Frugal minimal",
    },
    breakdown: {
      food: "Food",
      housing: "Housing",
      transport: "Transport",
      communication: "Communication",
      other: "Other",
    },
  },
  progress: {
    assetsLabel: "Existing assets (optional)",
    assetsTooltip:
      "The investable assets you have already saved up; once filled in, a progress ring relative to the reference line appears beside the big number.",
    caption: "Existing assets are about {{pct}}% of the reference line",
    ariaLabel: "Freedom gauge: existing assets are about {{pct}}% of the reference line",
  },
  advanced: {
    cardTitle: "Advanced estimates and formula rationale (at most one panel expanded at a time)",
    reverseTitle: "Reverse estimation",
    reverseDesc: "How much your existing assets can support per month",
    loanTitle: "Loan calculator",
    loanDesc: "Monthly payment, total interest and amortization schedule",
    rentalTitle: "Buy and rent out",
    rentalDesc: "Annual net cash flow and payback period",
    mcTitle: "Monte Carlo simulation",
    mcDesc: "Depletion probability and wealth distribution",
    taxTitle: "Tax estimation",
    taxDesc: "Multi-currency basis check",
    accumulationTitle: "Work-years simulation",
    accumulationDesc: "How many years to reach your goal on a salary",
    pensionTitle: "Public pension",
    pensionDesc: "How much you can draw monthly after retirement",
    scenarioTitle: "Multi-scenario comparison",
    scenarioDesc: "Save named parameters and compare side by side",
    insightsTitle: "Formula rationale",
    insightsDesc: "Where 480 comes from: derivation, assumptions and sources",
  },
  insights: {
    formulaTitle: "Formula derivation",
    formulaBody:
      "The principal needed for an annual expense X is X ÷ r (r being the real annual return rate) — each year's actual returns on that principal exactly cover the expense while the principal stays untouched. Substituting a monthly expense X as the annual expense 12X gives: assets = monthly expense × 12 ÷ r. When r = 2.5% (default nominal return 4.5% − inflation 2%), 12 ÷ 0.025 = 480: every 480 yuan of principal supports 1 yuan of monthly spending — hence the name “480 Rule”. The total critical value then stacks three one-off reserves on top: number of children × cost per child + health reserve + major investment.",
    chainTitle: "The assumption chain: from deposit rates to the 480 multiplier",
    chainIntro:
      "The derivation path of the return assumptions is as follows (values build up step by step from top to bottom); each entry carries its source, year, terms and verification level — entries tagged “video claim” do not feed this tool's calculations and serve only to explain where the assumptions come from.",
    chainDeposit1y: "1-year fixed-deposit posted rate",
    chainDeposit5y: "5-year fixed-deposit posted rate",
    chainCoreInflation: "Core inflation (as of end-2025)",
    chainSsf: "National Social Security Fund average annual investment return",
    chainAnnuity: "Enterprise annuity average annual investment return",
    chainFeeDrag: "Combined drag from funds to retail investors",
    chainNominal: "Ordinary investors' nominal return (planning assumption)",
    chainInflation: "Long-run inflation (planning assumption)",
    chainReal: "Long-run real return (nominal − inflation)",
    chainMultiplier: "Corresponding multiplier (12 ÷ real return rate)",
    tagOfficial: "Officially verified",
    tagMedia: "Media-verified",
    tagVideo: "Video claim",
    anchorTitle: "Intuitive conversion anchors",
    anchorNote:
      "The anchors below are arithmetic demonstrations based on a multiplier of 480 (2.5% real return), in CNY terms; the actual parameters are yours to adjust, and the multiplier changes with the real return rate.",
    anchorExpense1: "Monthly spending 10,000 → principal needed 4.8 million",
    anchorExpense2: "Monthly spending 5,000 → principal needed 2.4 million",
    anchorAsset1: "Principal on hand 48,000 → 100 yuan more to spend each month",
    anchorAsset2: "Every extra 480 saved → 1 yuan more to spend each month",
    marketTitle: "Average market consumption reference (2025)",
    marketNote:
      "The basis is per-capita resident consumer spending, covering the three major categories of housing, health care, and education, culture and recreation; this tool's default monthly expense of 2,990 yuan/month is rounded from the urban figure.",
    childTitle: "Child-raising cost reference by city",
    childNote:
      "Original figures from the “China Fertility Cost Report (2024 edition)”: the national average for ages 0–17 is 538,000 yuan; raising a child through undergraduate graduation costs about 680,000 yuan; birth-order cost coefficients are 1 : 0.79 : 0.60 (about −21% for a second child and about −24% for a third); it equals 6.3 times GDP per capita — the second highest among the countries listed in the report (behind only South Korea at 7.79 times).",
    childVideoNote:
      "The original video claimed “580,000 nationally / 1 million in Beijing / 1.08 million in Shanghai / 430,000 in Guizhou as the lowest / about 15% lower for each additional child”, which does not match the report's original figures; the Guizhou number and the “2,543.84 yuan per month on average” could not be verified — this panel uses the report's original figures (the video claim is not adopted). The −15% in the “cost per child” hint is a conservative simplification of the video claim; for the report's basis, adjust it to −21% yourself.",
    healthTitle: "Medical spending reference",
    healthNote:
      "“About 200,000 over a lifetime” and “150,000–300,000 in tier-2 cities / 300,000–600,000 in tier-1 cities” are estimates from the original video, not independently verified (conservative range 150,000–500,000, at 2024 price levels); as a no-discounting, equal-amount upper-bound reference: 6,454.4 yuan/year × 80 years ≈ 516,000 yuan — actual medical intensity shifts to later in life, so a young or middle-aged starting point can sit well below the cap.",
    strictTitle: "Strict vs. loose versions",
    strictBody:
      "Strict version: requires that assets never shrink (only actual returns are drawn on; principal stays untouched). It corresponds to the perpetual withdrawal basis of this tool's basic mode “financial freedom reference line” and of reverse estimation's “safe monthly spending”.",
    looseBody:
      "Loose version: allows assets to decline slowly in later years in exchange for higher spending today. It corresponds to the “threshold-band adjustment” and “percentage of balance” withdrawal strategies in the Monte Carlo panel — in the simulation you can watch the trade-off between depletion probability and end-of-period purchasing power.",
    evidenceNote:
      "Tag legend: “officially verified” = read directly from the official source page; “media-verified” = an officially published figure confirmed consistent by two or more independent media outlets; “video claim” = seen only in the original video or an analytical assumption, with no independent authoritative source found. For each entry, the year and terms follow the inline annotation; the verification log is in docs/research-video-data.md.",
  },
  pension: {
    formulaNote:
      "Simplified two-tier formula: basic pension ≈ (average wage + average wage × contribution base index) ÷ 2 × contribution years × 1%; individual account pension = estimated individual account balance ÷ months divisor. No year-by-year growth is assumed for the average wage or the contribution base index (a deliberate simplification; see the disclaimer below).",
    currentAge: "Current age",
    currentAgeTooltip:
      "Used to estimate the years until retirement; a years-to-retirement estimate only, and not a commitment of any social-insurance benefits.",
    retireAge: "Retirement age",
    retireAgeTooltip:
      "The age at which you expect to retire; the months divisor is linked by default to the lookup table (age 60 = 139, age 55 = 170, age 50 = 195 months), and editing “Months divisor” by hand breaks the link.",
    retireAgeDelayNote:
      "From 2025-01-01 the statutory retirement age is being raised in gradual steps (male workers step up to age 63); enter your own expectation — this tool makes no policy determination.",
    contribYears: "Contribution years (through retirement)",
    contribYearsTooltip:
      "Your estimated cumulative contribution years by retirement (years already paid included); convert deemed contribution years yourself before entering them.",
    contribIndex: "Contribution base index",
    contribIndexTooltip:
      "The average ratio of your historical contribution base to the local average wage (a decimal: 0.6 ≈ contributing at 60% of the average wage, 1.0 = exactly the average). Most provinces floor it at 0.6 and cap it at 3.",
    accountBalance: "Estimated individual account balance",
    accountBalanceTooltip:
      "Your current estimate of the “pension insurance individual account balance”; look it up in the electronic social security card or your local social-insurance app and enter it here.",
    avgWage: "Average wage (benefit-computation basis)",
    avgWageTooltip:
      "The “previous year's average wage” in the basic pension formula; it defaults to the National Bureau of Statistics' 2024 urban non-private-sector figure (see the source line below) — please replace it with the pension computation base of your own province/city.",
    monthsDivisor: "Months divisor",
    monthsDivisorTooltip:
      "The divisor of the individual account pension (lookup-table basis: age 60 = 139, age 55 = 170, age 50 = 195 months); linked to the retirement age by default, and editing it by hand breaks the link.",
    monthsSyncedHint:
      "The months divisor is currently linked to the retirement age through the data-layer lookup table; editing it by hand breaks the link.",
    monthsResync: "Re-link to retirement age",
    wageSourceLine: "Average wage source: {{source}}",
    monthlyPension: "Estimated monthly pension",
    basicPart: "of which: basic pension",
    accountPart: "of which: individual account pension",
    yearsToRetire: "Years to retirement",
    monthsUsed: "Months divisor",
    monthsUnit: "months",
    adjustedTitle:
      "Adjusted reference line (monthly expense net of the pension-covered portion)",
    adjustedExpense: "Adjusted monthly expense",
    adjustedCritical: "Adjusted financial-freedom reference line",
    coverage: "Pension coverage ratio (monthly pension ÷ monthly expense)",
    coverageHint:
      "The portion of the monthly expense covered by the pension no longer needs principal support, so the reference line falls accordingly; a coverage ratio above 100% means the projected pension already covers all of your current monthly expense.",
    coverageFull:
      "The projected pension already covers all of your current monthly expense",
    resultNote:
      "The above is a “retirement-point” estimate: no year-by-year growth is assumed for the average wage or the contribution index, and the individual account balance is divided by the months divisor at its current estimated value, with no assumption of future appreciation.",
    disclaimer:
      "A simplified estimate, not social-insurance advice; actual benefits are subject to the computation by the social insurance agency.",
  },
  common: {
    computing: "Computing…",
    nominalReturn: "Nominal return rate (annualized)",
    nominalReturnTooltip:
      "The annualized return on investments before inflation is removed.",
    inflation: "Inflation rate (annualized)",
    inflationTooltip: "How fast prices rise each year.",
    healthReserve: "Health reserve",
    healthReserveTooltip:
      "A lump sum set aside once for medical spending such as serious illness and long-term care.",
    majorInvestment: "Major investment",
    majorInvestmentTooltip:
      "One-time spending such as a home down payment or large education costs.",
    regionUrbanCn: "Urban China",
    swipeHint: "Swipe left / right to see all columns",
  },
  reverse: {
    totalAssets: "Total existing assets",
    totalAssetsTooltip:
      "The total financial assets you currently have at your disposal (excluding your primary residence).",
    childReserve: "Children's reserve",
    childReserveTooltip:
      "Money set aside from total assets for child-raising and excluded from the “safe monthly spending” calculation.",
    syncButton: "Sync reserves and return assumptions with basic mode",
    investable: "Investable assets",
    sustainableMonthly: "Safe monthly spending",
    leverageYears: "Return leverage years (multiplier ÷ 100)",
    leverageTooltip:
      "Definition: 12 ÷ real return rate (in percentage points) = 480 multiplier ÷ 100; it measures how strongly the return rate leverages asset longevity. It does not mean “the assets will only last N years” — if you withdraw at the critical-principal level (i.e. the “safe monthly spending” amount), actual returns exactly cover all spending and the assets never run out.",
    note: "“Safe monthly spending” = investable assets × real return rate ÷ 12 (perpetual withdrawal basis: only returns are spent, principal is untouched); “Return leverage years” = 12 ÷ real return rate (= 480 multiplier ÷ 100), not the years until the assets run out — at the withdrawal level above, the assets never run out.",
    exampleLegend: "Worked examples (video-demonstration basis)",
    exampleA: "Example A: 6M − 1 child 700k − health 500k",
    exampleB: "Example B: 6M − 0 children − home 1.2M",
    exampleApplied:
      "“{{name}}” filled in; return assumptions synced to the default 4.5% − 2.0%; see the results below.",
    exampleNote:
      "Both worked examples come from the original video's demonstration (illustrative, not official documents): the video derives the target by straight division, “net investable amount ÷ 480 months”; this tool computes on the perpetual withdrawal basis (investable assets × real return rate ÷ 12), and under the default return assumptions (4.5% − 2.0%, i.e. 2.5% real) the two bases agree numerically.",
    exampleBNote:
      "For Example B the original video claimed a result of about 9,000 yuan/month (including an extra discount of about 10%, whose source could not be reconstructed); on the same basis this tool faithfully reports 10,000 yuan/month and is not adjusted down to 9,000.",
  },
  loan: {
    principal: "Loan amount",
    principalTooltip:
      "The loan principal — the amount borrowed from the bank in one go.",
    annualRate: "Annual interest rate",
    annualRateTooltip:
      "The share of interest the bank charges per year; monthly rate = annual rate ÷ 12.",
    years: "Loan term (years)",
    yearsTooltip:
      "The number of years needed to pay off the whole loan; a longer term lowers the monthly payment but raises total interest.",
    yearsHint: "1 ~ {{max}} years (upper bound guarding against typos in the UI)",
    loanType: "Loan type",
    loanCommercial: "Commercial loan",
    loanHousingFund: "Housing provident fund loan",
    commercialHint:
      "Commercial loan rates move with the LPR and the added margin; please enter the latest quoted rate.",
    housingFundHint:
      "Housing provident fund rates are usually lower than commercial rates; please update “Annual interest rate” yourself to the latest rate published by your local housing fund center.",
    repayMethod: "Repayment method",
    repayMethodHint:
      "Equal payment (annuity): the same amount every month; equal principal: fixed principal every month, with the payment decreasing month by month",
    equalPayment: "Equal payment (annuity)",
    equalPrincipal: "Equal principal",
    monthlyPaymentFixed: "Monthly payment (fixed)",
    monthlyPaymentFirst: "First-month payment (decreasing month by month)",
    totalInterest: "Total interest",
    totalRepayment: "Total repayment",
    colPeriod: "Period",
    colPayment: "Payment",
    colPrincipal: "Principal",
    colInterest: "Interest",
    colRemaining: "Remaining principal",
    period: "Period {{n}}",
    rowsNote:
      "{{total}} periods in total; the first 12 are shown here in detail. With equal principal, payments keep decreasing period by period afterwards; with equal payment (annuity), every payment is fixed.",
  },
  rental: {
    cityParams: "City parameters",
    cityParamsHint:
      "Selecting a city fills in that city's default holding costs (enter the property price / rent yourself)",
    tierPlaceholder: "Select a city group…",
    cityEmpty:
      "City parameter presets (rentParams.ts) are pending input from data researchers; all parameters below can be filled in manually, which does not affect the calculation.",
    tierHint:
      "{{tier}}: cities in this group — {{cities}}; reference gross rental yield range {{lo}}% ~ {{hi}}% (Numbeo, read 2026-11){{currencyNote}}",
    price: "Total property price",
    priceTooltip:
      "The full price of the home at purchase; both the loan and the down payment are based on it.",
    monthlyRent: "Monthly rent",
    monthlyRentTooltip:
      "The monthly rent the home can reliably fetch on the market.",
    downPayment: "Down payment ratio",
    downPaymentTooltip:
      "The share paid upfront at purchase; the rest is financed by the loan.",
    loanRate: "Loan rate (annualized)",
    loanRateTooltip:
      "The annualized mortgage rate; the monthly payment is computed with equal payment (annuity).",
    loanYears: "Loan term (years)",
    loanYearsTooltip: "The number of years needed to pay off the mortgage.",
    vacancy: "Vacancy rate",
    vacancyTooltip:
      "The share of the year the home cannot be rented out, losing rent in proportion.",
    maintenance: "Maintenance rate (annual)",
    maintenanceTooltip:
      "Yearly cost of repairs and upkeep, estimated as a percentage of the property price.",
    propertyFee: "Property management fee",
    propertyFeeTooltip:
      "The monthly management fee paid to the property manager.",
    otherCost: "Other annual holding costs",
    otherCostTooltip:
      "Other fixed yearly spending such as insurance and renovation amortization.",
    rentTax: "Rent tax rate",
    rentTaxTooltip:
      "The share of rental income paid as tax, computed on effective rent; enter 0 where rental income is not taxed.",
    monthlyPayment: "Monthly payment (equal payment)",
    annualNetCashFlow: "Annual net cash flow",
    paybackYears: "Static payback period",
    paybackNever:
      "Cash flow is not positive, so payback is not possible for now",
    breakdownTitle: "Annual Breakdown",
    breakdown: {
      loanAmount: "Loan amount",
      downPayment: "Down payment",
      annualGrossRent: "Annual gross rent",
      annualVacancyLoss: "Annual vacancy loss",
      annualEffectiveRent: "Annual effective rent",
      annualRentTax: "Annual rent tax",
      annualMaintenance: "Annual maintenance",
      annualPropertyFee: "Annual property fee",
      annualOtherCost: "Other annual costs",
      annualLoanPayment: "Annual loan payment",
    },
    currencyNote: "; note: the preset pricing currency is {{currency}}.",
    note: "Annual net cash flow = annual effective rent − rent tax − maintenance − property management fee − other holding costs − annual loan payment; static payback period = down payment ÷ annual net cash flow (home price changes and the opportunity cost of funds are not counted).",
    waterfallAria:
      "Rental annual cash-flow waterfall: from annual gross rent, deducted item by item through vacancy, taxes, maintenance, property fees, other costs and annual loan payments, down to annual net cash flow",
    waterfallNote:
      "Blue bars are the start / subtotal / end bars (readable from zero); green-up / red-down bars (blue / orange in the color-blind-friendly palette) are deduction bars; dashed lines connect each bar's cumulative level to the next. The down payment and the loan amount are one-off figures and are not part of the annual cash flow.",
  },
  tiers: {
    cnSection: "Chinese cities (Tier-1 to Tier-4)",
    intlSection: "International cities (grouped by GaWC 2024, not on the Chinese tier scale)",
    cnTier1: "Tier-1 cities",
    cnTier2: "Tier-2 cities",
    cnTier3: "Tier-3 cities",
    cnTier4: "Tier-4 cities",
    intlGlobal: "Intl · Global financial hubs",
    intlRegional: "Intl · Regional hubs",
    gradingNote:
      "Grading: Chinese cities are classified into Tier-1 to Tier-4 following the Yicai City Business Attractiveness Ranking conventions (strong tier-2 cities such as Chengdu and Wuhan are grouped as Tier-2); international cities differ from Chinese cities in living costs and tax systems, so they are NOT forced onto the Chinese four-tier scale — they are grouped by the GaWC 2024 classification: Alpha++ and Alpha+ (New York / London / Tokyo / Singapore / Dubai) form \"Global financial hubs\", while Alpha and below / unclassified (Kuala Lumpur / Chiang Mai) form \"Regional hubs\". Group defaults come from the representative city of each group and can be fine-tuned manually.",
    representativeNote:
      "Group defaults use the representative city ({{city}}); fine-tune the parameters below for other cities.",
    cityJoiner: " / ",
    exampleJoiner: " / ",
  },
  city: {
    北京: "Beijing",
    上海: "Shanghai",
    深圳: "Shenzhen",
    广州: "Guangzhou",
    成都: "Chengdu",
    武汉: "Wuhan",
    东京: "Tokyo",
    纽约: "New York",
    伦敦: "London",
    新加坡: "Singapore",
    迪拜: "Dubai",
    珠海: "Zhuhai",
    海口: "Haikou",
    吉隆坡: "Kuala Lumpur",
    桂林: "Guilin",
    清迈: "Chiang Mai",
  },
  countries: {
    CN: "China",
    US: "United States",
    GB: "United Kingdom",
    DE: "Germany",
    JP: "Japan",
    SG: "Singapore",
    AU: "Australia",
    CA: "Canada",
  },
  mc: {
    currentAssets: "Current assets",
    currentAssetsTooltip:
      "Starting point of the simulation: the total investment assets you have now.",
    annualSpend: "Annual spending (base year)",
    annualSpendTooltip:
      "Total annual spending in the current (base) year; from year 1 on it rises each year by the inflation rate (year 1 spending already includes year 1's inflation sample).",
    returnMean: "Mean nominal return rate",
    returnMeanTooltip:
      "The long-run average annualized return (not adjusted for inflation).",
    returnStd: "Nominal return std. dev.",
    returnStdTooltip:
      "How widely returns swing: the bigger it is, the wilder the market's ups and downs and the more extreme the good and bad years.",
    inflationMean: "Mean inflation rate",
    inflationMeanTooltip:
      "The long-run average pace of price increases.",
    inflationStd: "Inflation std. dev.",
    inflationStdTooltip: "How widely inflation swings.",
    years: "Simulation years",
    yearsTooltip: "How many years of the asset trajectory to simulate.",
    yearsHint: "1 ~ {{max}} years (upper bound guarding against typos in the UI)",
    paths: "Number of simulation paths",
    pathsTooltip:
      "How many randomized “life scripts” to simulate; more paths give steadier results but slower computation.",
    pathsHint: "1000 ~ 20000 paths (default 5000)",
    seed: "Random seed",
    seedTooltip:
      "The starting point of the random numbers: same seed + same inputs → fully reproducible results, handy for checking and sharing.",
    run: "Run simulation",
    running: "Simulation in progress…",
    depletionLabel:
      "Asset depletion probability (share of paths whose assets are ≤ 0 at any year-end)",
    medianTerminal: "Median terminal value",
    p5: "5th percentile (pessimistic)",
    p25: "25th percentile",
    p75: "75th percentile",
    p95: "95th percentile (optimistic)",
    pathsYears: "{{paths}} paths × {{years}} years",
    chartNote:
      "The horizontal axis is years and the vertical axis is in 10k CNY units; the chart shows {{count}} representative sampled paths (thin light lines) and the year-by-year median (thick line, computed from the sampled paths). Same seed + same inputs → fully reproducible results (guaranteed by contract).",
    placeholder:
      "After you click “Run simulation”, the tool simulates the asset trajectory year by year with normally distributed random returns and reports the depletion probability and the end-of-period wealth distribution. Same seed + same inputs → fully reproducible results.",
    returnMode: "Return mode",
    returnModeTooltip:
      "Normal parameters: sampling from a normal distribution of “mean ± standard deviation” (the classic approach). Historical bootstrap: random resampling with replacement (i.i.d.) from the real annual return series of the selected index, preserving the fat tails and skewness of real history while ignoring year order (serial correlation such as volatility clustering is not covered).",
    modeNormal: "Normal parameters",
    modeBootstrap: "Historical bootstrap",
    bootstrapModeNote:
      "In historical bootstrap mode, the “mean / std. dev. of nominal returns” take no part in the computation (the distribution is determined by the selected series); inflation is still sampled from a normal distribution.",
    seriesLabel: "Return series",
    seriesTooltip:
      "The index's annual return series used for bootstrapping; values and sources are documented in the note below and in the README data-source table.",
    indexCsi300: "CSI 300 (China)",
    indexSp500: "S&P 500 (international)",
    seriesNote:
      "{{name}}: annual returns for {{firstYear}}–{{lastYear}}, {{count}} samples in total ({{kind}}); source: {{source}}",
    seriesPriceOnly:
      "Price index (dividends excluded; slightly understates total return)",
    seriesTotalReturn: "Total return (dividends reinvested)",
    placeholderBootstrap:
      "After you click “Run simulation”, return samples are resampled at random from the selected index's annual return series and the asset trajectory is simulated year by year, yielding the depletion probability and the end-of-period wealth distribution. Same seed + same inputs → fully reproducible results.",
    chartNoteBootstrap:
      "The horizontal axis is years and the vertical axis is in 10k CNY units; the chart shows {{count}} representative sampled paths (thin light lines) and the year-by-year median (thick line). Return samples are drawn with replacement (i.i.d., ignoring year order) from the selected index's annual series. Same seed + same inputs → fully reproducible results (guaranteed by contract).",
    strategy: "Withdrawal strategy",
    strategyFixed: "Fixed nominal",
    strategyThreshold: "Threshold-band adjustment",
    strategyPercent: "Percentage of balance",
    thresholdExceedPct: "Over-band threshold",
    thresholdCutPct: "Withdrawal cut",
    thresholdFallPct: "Below-band threshold",
    thresholdRaisePct: "Withdrawal raise",
    thresholdNoCutYears: "Final no-cut years",
    thresholdFreeze: "Freeze raises in negative-return years",
    thresholdBandTooltip:
      "This year's withdrawal rate = last year's withdrawal amount ÷ start-of-year assets. When the rate drifts above the initial withdrawal rate by more than the “over-band threshold”, this year's spending is cut by the “withdrawal cut” and then re-indexed to inflation; when it falls below the initial rate by more than the “below-band threshold”, spending is raised by the “withdrawal raise”. Defaults: ±20% / ±10% (the literature's optimal solution — tighter thresholds or larger cuts do not further improve success rates).",
    thresholdFreezeTooltip:
      "If last year's return was negative and this year's withdrawal rate is above the initial withdrawal rate, the inflation raise is skipped for that year (a one-year nominal freeze, with no catch-up later).",
    percentRealReturn: "Real-return assumption",
    percentRealReturnTooltip:
      "The long-run real-return assumption used to amortize the current balance (annuitize it) out to the planning horizon; it defaults to “mean nominal return − mean inflation” ({{value}}%) and can be edited. Each percentage point added to the real-return assumption lifts the initial withdrawal rate by roughly 0.6–0.8 percentage points.",
    percentBoundTooltip:
      "Spending floor: this year's spending will not fall below this percentage of last year's withdrawal amount (0 = off; 95 is a common choice — once enabled, mid-horizon depletion can occur again). Spending cap: this year's spending will not exceed this percentage of the first year's actual amortized spending, inflated forward (0 = off).",
    percentFloor: "Spending floor (% of last year's withdrawal)",
    percentCap: "Spending cap (% of first year's actual amortized spending)",
    initialWithdrawalRate: "Initial withdrawal rate",
    initialWithdrawalRateTooltip:
      "Annual spending (base year) ÷ current assets; the threshold-band strategy anchors to it, and the percentage-of-balance strategy uses it jointly as the purchasing-power reference.",
    withdrawalP5: "Final-year withdrawal, 5th percentile (pessimistic)",
    withdrawalMedian: "Final-year withdrawal, median",
    withdrawalP95: "Final-year withdrawal, 95th percentile (optimistic)",
    strategyNote:
      "Threshold band: the literature's optimal parameters are ±20% / ±10% with no cuts in the final 15 years (tighter thresholds or larger cuts do not further improve success rates). Percentage of balance: the balance is amortized in real terms out to the planning horizon, so depletion is ruled out by construction — purchasing-power risk shows up in the final-year withdrawal percentiles. Arithmetic anchor: with assets down 25%, the same withdrawal amount pushes the withdrawal rate from 4.00% up to 5.33% — this rebound of the withdrawal rate after bad years is at the core of how sequence risk transmits.",
    chartAria:
      "Monte Carlo simulation chart: {{paths}} paths simulated over {{years}} years, depletion probability {{prob}}%, median terminal value {{median}}",
    doneAria: "Simulation finished: depletion probability {{prob}}, median terminal value {{median}}",
  },
  accumulation: {
    currentAssets: "Current assets",
    currentAssetsTooltip: "Starting point of the simulation: the total investment assets you have now.",
    monthlyIncome: "After-tax monthly income",
    monthlyIncomeTooltip:
      "Take-home monthly income (after-tax terms); monthly saving = income − expense, which can be negative.",
    monthlyExpense: "Monthly expense",
    monthlyExpenseTooltip:
      "Your average total monthly spending under the current lifestyle; it rises with inflation from year 1 on.",
    targetValue: "Financial freedom target (base year)",
    targetValueTooltip:
      "The asset threshold for judging “reached”; it is raised year by year with inflation (year-t target = this value × the cumulative inflation factor).",
    syncButton: "Sync the critical value with basic mode",
    syncedHint:
      "The target is currently linked live to the basic mode's critical value; editing the target by hand breaks the link.",
    savingLine: "Current terms: monthly saving = {{income}} − {{expense}} = {{saving}} yuan/month",
    fiLabel: "Probability of reaching financial freedom",
    fiHint:
      "Share of paths whose assets at any year-end are ≥ that year's target (the target rises with inflation)",
    yearsTitle:
      "First-hit year distribution (integer years, reaching paths only; “—” means no path reaches the target)",
    finalTitle: "End-of-period asset distribution (all paths)",
    chartNote:
      "The horizontal axis is years and the vertical axis is in 10k CNY units; thin light lines are {{count}} representative sampled paths, the thick line is the year-by-year median, and the dashed line is the year-by-year target drawn at the mean inflation rate (each path's actual judgement uses its own inflation sample). Same seed + same inputs → fully reproducible results (guaranteed by contract).",
    placeholder:
      "After you click “Run simulation”, the tool simulates “income − expense” accumulation paths year by year with normally distributed random market conditions, reporting the probability of reaching financial freedom, the first-hit-year percentiles and the end-of-period wealth distribution. Same seed + same inputs → fully reproducible results.",
    mode: "Simulation mode",
    modeForward: "Forward simulation",
    modeReverse: "Back-solve savings",
    yearsToTarget: "Target years",
    requiredSaving: "Required monthly saving",
    reverseNote:
      "Closed-form solution: a deterministic projection in which returns and inflation always equal their means, solving back for the monthly saving that makes year-{{years}} end-of-period assets exactly equal the inflation-adjusted target; a negative value means current assets are already ahead of the target and the goal can be reached with no further saving.",
    verify: "Monte Carlo verification",
    verifyResult:
      "Probability of reaching the goal within {{years}} years: {{pct}}% ({{paths}} paths, monthly saving = {{saving}})",
    verifyNote:
      "Verification reruns the Monte Carlo with “target years = {{years}}, monthly saving = {{saving}}”; the median path compounds at the geometric mean (≈ arithmetic mean − σ²/2), which usually lags the deterministic solution, so a success probability below 50% is normal — the gap is the cost of volatility.",
    chartAria:
      "Work-years accumulation simulation chart: {{paths}} paths simulated over {{years}} years, {{prob}}% probability of reaching the target",
  },
  seq: {
    title: "Sequence-risk comparison (deterministic)",
    modeRolling: "Rolling start years",
    modeReorder: "Three-order comparison",
    direction: "Cash-flow direction",
    directionWithdrawal: "Withdrawal basis",
    directionAccumulation: "Accumulation basis",
    windowYears: "Rolling window length (years)",
    initialRate: "Initial withdrawal rate",
    annualSaving: "Annual saving (deposited at year-end)",
    run: "Run comparison",
    windowsCount: "{{count}} start-year windows × {{years}} years (number of starts = series length − window + 1)",
    fateBest: "Best (start year {{year}})",
    fateMedian: "Median",
    fateWorst: "Worst (start year {{year}})",
    terminalMultiple: "Terminal multiple",
    depletedYear: "Depleted in year {{year}}",
    originalOrder: "Original order",
    worstFirst: "Bad years first (ascending)",
    bestFirst: "Good years first (descending)",
    note: "Deterministic simulation: returns are taken year by year from the selected series, inflation is set to 0 (nominal = real), and no random sampling is involved. Rolling-start mode: the sample contains only {{count}} rolling windows, so the conclusions are illustrative rather than statistically guaranteed; three-order mode: ascending / descending merely reorders the returns (the geometric mean is unchanged), and every terminal-value difference comes from the ordering itself. Series provenance follows the data-layer annotations.",
    chartAria:
      "Sequence-risk fate curves: the best, median and worst year-by-year asset paths, {{count}} start-year windows × {{years}} years",
    doneAria: "Sequence comparison finished: best {{best}}, median {{median}}, worst {{worst}}",
    placeholder:
      "Pick a series and a basis, then click “Run comparison”: real historical annual returns are used in a deterministic simulation, showing how different starting points (or orderings) over the same stretch of history lead to different terminal fates.",
  },
  scenario: {
    namePlaceholder: "Scenario name, e.g. Frugal edition",
    nameLabel: "Scenario name",
    save: "Save current parameters",
    saved: "Saved scenario “{{name}}”",
    saveFailedFull: "The scenario library is full (limit {{max}}); please delete scenarios you no longer need first",
    saveFailedStorage: "Save failed: the browser's local storage is unavailable or full",
    listTitle: "Saved scenarios ({{count}})",
    listEmpty: "No scenarios yet: name and save the full set of current panel parameters above first, then load different versions to compare them side by side",
    load: "Load",
    loaded: "Loaded scenario “{{name}}”",
    delete: "Delete",
    deleteConfirm: "Delete this scenario? This cannot be undone.",
    deleted: "Deleted scenario “{{name}}”",
    versionMismatch: "Cannot load (version or data mismatch)",
    compareTitle: "Key metric comparison (recomputed per scenario by the deterministic calculation core)",
    metricCritical: "Financial freedom reference line",
    metricRentalNet: "Rental net annual cash flow",
    metricPayback: "Rental payback period (years)",
    metricPension: "Estimated monthly pension",
    metricCoverage: "Pension coverage ratio",
    metricNetIncome: "After-tax annual income",
    metricSustainable: "Sustainable monthly spending",
    metricSaving: "Monthly saving (salary basis)",
    export: "Export image",
    exportNote: "Computed locally · Not investment advice",
    exportDone: "Comparison image exported",
    exportFailed: "Failed to export the comparison image",
  },
  tax: {
    countryLabel: "Country / region",
    countryHint: "Tax tables are given in each country/region's local currency",
    grossIncome: "Pre-tax annual income (local currency)",
    grossIncomeTooltip:
      "Total annual pre-tax income, entered in the local currency of the selected country/region.",
    manualRate: "Simplified effective tax rate",
    manualRateHint:
      "With “Other” selected, you can enter a simplified effective tax rate by hand (tax actually paid ÷ pre-tax income)",
    manualRatePlaceholder: "e.g. 18 (i.e. 18%)",
    manualRateEmpty: "Enter an effective tax rate before computing.",
    manualRateApplied:
      "Taxed directly at a single flat rate of {{rate}} (no deductions).",
    disclaimer:
      "Built-in simplified tax rates based on the public 2025 tax brackets; not tax advice.",
    otherDisclaimer:
      "“Other” approximates with a manually entered effective rate and does not represent the country/region's actual tax system; {{disclaimer}}",
    tableMissing:
      "The tax table for “{{country}}” is pending input from data researchers (src/data/taxTables.ts is currently a placeholder empty array), so it cannot be computed yet; you can switch to “Other” and enter a simplified effective tax rate by hand.",
    taxableIncome: "Taxable income",
    taxAmount: "Annual tax",
    netIncome: "After-tax income",
    effectiveRate: "Effective tax rate",
    currencySectionTitle: "Multi-Currency and Regional Checks",
    other: "Other",
  },
  currency: {
    label: "Currency",
    hint: "After switching, global amounts use the corresponding symbol as a prefix; all formulas are currency-agnostic (multiplier × monthly expense holds in any currency)",
    refreshRates: "Refresh exchange rates",
    online: "Online fetch",
    offline: "Offline snapshot",
    rateUnavailable: "Exchange rates pending data",
    rateLine: "1 {{base}} ≈ {{rate}} {{target}}",
    sourceLine:
      "Source: {{source}}{{offlineNote}}; data as of: {{updated}}; fetched locally: {{fetchedAt}}{{note}}",
    offlineNote: " (offline snapshot; live fetch failed or timed out)",
    loadingRates: "Loading exchange rates…",
    cnyNotice:
      "Default parameters are given in CNY terms; after switching currencies, please adjust the values yourself.",
    benchmarkBelow:
      "Your monthly expense is clearly below the per-capita consumer spending level of {{region}} (about {{anchor}} yuan/month, per the National Bureau of Statistics for {{year}}); please confirm the definitions match (e.g. whether rent is included).",
    benchmarkAbove:
      "Your monthly expense is clearly above the per-capita consumer spending level of {{region}} (about {{anchor}} yuan/month, per the National Bureau of Statistics for {{year}}); please confirm whether the figure reflects a high-spending city.",
    benchmarkNoticePrefix: "Non-blocking notice: ",
    benchmarkInfoCny:
      "The deviation check is anchored to China's urban per-capita consumer spending (National Bureau of Statistics); it is advisory only and never blocks usage.",
    benchmarkInfoOther:
      "The monthly-expense deviation check is anchored to CNY terms (China's urban per-capita consumer spending) and is not compared for now after switching currencies; default parameters are given in CNY terms.",
    benchmarkEmpty:
      "The regional per-capita consumer spending reference (regional.ts) is still placeholder-empty data; the deviation check will turn on automatically once the data is filled in.",
    engelLabel: "Your Engel coefficient (optional)",
    engelHint:
      "Food spending ÷ total spending; a lower value usually indicates a higher standard of living",
    engelPlaceholder: "Optional, 0 ~ 1",
    engelEmpty: "Not filled in; optional to provide, for comparison.",
    engelNoBenchmark:
      "Your Engel coefficient is {{value}}; the typical regional range is pending data.",
    engelCompare:
      "Your Engel coefficient is {{value}}, {{position}} the typical range for {{region}} ({{lo}} ~ {{hi}}, {{year}} terms).",
    engelBelow: "below",
    engelAbove: "above",
    engelWithin: "within",
    noTimestamp: "Data unavailable",
  },
  sensitivity: {
    title: "Monthly-expense sensitivity",
    expand: "Expand",
    collapse: "Collapse",
    plusTitle: "Raise the monthly expense (a costlier life)",
    minusTitle: "Lower the monthly expense (a leaner life)",
    plusRow: "+{{pct}}%",
    minusRow: "−{{pct}}%",
    note: "At a given multiplier, the reference line moves linearly and proportionally with the monthly expense: for every {{pct}}% change in monthly expense the reference line moves by about {{delta}}; the children, health and major-investment reserves are unaffected by the monthly expense — the “appetite that can never be filled” shows up here exactly as how far the reference line rises.",
    unavailable:
      "The real return rate is ≤ 0, so the sensitivity cannot be computed (please adjust “Core Parameters”).",
    baseRefLabel: "Baseline reference line",
    chartAria:
      "Monthly-expense sensitivity tornado chart: the financial freedom reference lines for six monthly-expense levels, sorted by deviation in descending order, with the baseline reference line dashed",
    legendHigher: "Above baseline (harder to reach)",
    legendLower: "Below baseline (easier to reach)",
  },
  share: {
    copy: "Copy share link",
    copyShort: "Copy link",
    copyTooltip:
      "Encodes all of your current business inputs (UI preferences such as theme / language / currency excluded) into the link; anyone who opens the pasted link gets the exact same parameter set.",
    copied: "Share link copied to the clipboard",
    copyFailed:
      "Copy failed: please update the app or browser and try again",
    restored: "All business inputs restored from the share link",
    restoreIgnored:
      "The share link content could not be recognized (ignored; default parameters are shown)",
  },
  a11y: {
    skipToContent: "Skip to main content",
    resultAnnouncement: "Reference line updated: {{value}}",
    resultAnnouncementAssets: "Existing assets are about {{pct}}% of the reference line",
  },
};

export default en;
