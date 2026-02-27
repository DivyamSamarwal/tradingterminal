/**
 * Dalal Street Terminal v3
 * 25 Stocks, 80+ News Events, Modifiable Cash, Circuit Limits,
 * NIFTY Index, Trade History, Market Sentiment, Volume Simulation
 */

// ==================== CONFIG ====================
var INITIAL_MARGIN = 100000;
var START_TIME = 9 * 60 + 15;   // 9:15 AM
var END_TIME   = 15 * 60 + 30;  // 3:30 PM
var NEWS_FREQ = 0.04;           // 4% per tick
var VOL_MULTIPLIER = 1;         // volatility multiplier
var CIRCUIT_LIMIT = 0.10;       // 10% upper/lower circuit

var TIMEFRAMES = [
    { label: '5M',   viewLen: 5,    candlePeriod: 1  },
    { label: '15M',  viewLen: 15,   candlePeriod: 3  },
    { label: '30M',  viewLen: 30,   candlePeriod: 5  },
    { label: '1H',   viewLen: 60,   candlePeriod: 10 },
    { label: 'Day',  viewLen: 375,  candlePeriod: 15 },
    { label: 'Week', viewLen: 1875, candlePeriod: 75 }
];

var LOT_SIZES = {
    RELIANCE: 250, TCS: 150, HDFCBANK: 550, ITC: 1600,
    INFY: 300, SBIN: 1500, ICICIBANK: 1375, ZOMATO: 3500,
    SUNPHARMA: 700, TATAMOTORS: 1425, MARUTI: 100,
    TATASTEEL: 1500, BHARTIARTL: 1851, ADANIENT: 500,
    HINDUNILVR: 300, BAJFINANCE: 125, HCLTECH: 350,
    WIPRO: 1500, LT: 150, KOTAKBANK: 400,
    AXISBANK: 1200, POWERGRID: 2700, NTPC: 900,
    COALINDIA: 1500, JSWSTEEL: 675
};

var marketStocks = [
    // Banking & Finance
    { ticker: "HDFCBANK",   name: "HDFC Bank Ltd",           ltp: 1600, vol: 0.0020, base: 1600, history: [], open: 1600,  sector: "Banking",  volume: 0, circuitHit: null },
    { ticker: "SBIN",       name: "State Bank of India",     ltp: 600,  vol: 0.0030, base: 600,  history: [], open: 600,   sector: "Banking",  volume: 0, circuitHit: null },
    { ticker: "ICICIBANK",  name: "ICICI Bank",              ltp: 950,  vol: 0.0022, base: 950,  history: [], open: 950,   sector: "Banking",  volume: 0, circuitHit: null },
    { ticker: "KOTAKBANK",  name: "Kotak Mahindra Bank",     ltp: 1750, vol: 0.0019, base: 1750, history: [], open: 1750,  sector: "Banking",  volume: 0, circuitHit: null },
    { ticker: "AXISBANK",   name: "Axis Bank Ltd",           ltp: 1100, vol: 0.0024, base: 1100, history: [], open: 1100,  sector: "Banking",  volume: 0, circuitHit: null },
    { ticker: "BAJFINANCE", name: "Bajaj Finance Ltd",       ltp: 6800, vol: 0.0028, base: 6800, history: [], open: 6800,  sector: "Finance",  volume: 0, circuitHit: null },
    // IT
    { ticker: "TCS",        name: "Tata Consultancy",        ltp: 3400, vol: 0.0014, base: 3400, history: [], open: 3400,  sector: "IT",       volume: 0, circuitHit: null },
    { ticker: "INFY",       name: "Infosys Ltd",             ltp: 1400, vol: 0.0025, base: 1400, history: [], open: 1400,  sector: "IT",       volume: 0, circuitHit: null },
    { ticker: "HCLTECH",    name: "HCL Technologies",        ltp: 1500, vol: 0.0020, base: 1500, history: [], open: 1500,  sector: "IT",       volume: 0, circuitHit: null },
    { ticker: "WIPRO",      name: "Wipro Ltd",               ltp: 450,  vol: 0.0026, base: 450,  history: [], open: 450,   sector: "IT",       volume: 0, circuitHit: null },
    // Conglomerate / Energy
    { ticker: "RELIANCE",   name: "Reliance Industries",     ltp: 2500, vol: 0.0018, base: 2500, history: [], open: 2500,  sector: "Energy",   volume: 0, circuitHit: null },
    { ticker: "ADANIENT",   name: "Adani Enterprises",       ltp: 2200, vol: 0.0040, base: 2200, history: [], open: 2200,  sector: "Infra",    volume: 0, circuitHit: null },
    { ticker: "NTPC",       name: "NTPC Ltd",                ltp: 350,  vol: 0.0018, base: 350,  history: [], open: 350,   sector: "Power",    volume: 0, circuitHit: null },
    { ticker: "POWERGRID",  name: "Power Grid Corporation",  ltp: 290,  vol: 0.0015, base: 290,  history: [], open: 290,   sector: "Power",    volume: 0, circuitHit: null },
    // Auto
    { ticker: "TATAMOTORS", name: "Tata Motors Ltd",         ltp: 650,  vol: 0.0035, base: 650,  history: [], open: 650,   sector: "Auto",     volume: 0, circuitHit: null },
    { ticker: "MARUTI",     name: "Maruti Suzuki India",     ltp: 10500,vol: 0.0016, base: 10500,history: [], open: 10500, sector: "Auto",     volume: 0, circuitHit: null },
    // Pharma
    { ticker: "SUNPHARMA",  name: "Sun Pharma Industries",   ltp: 1150, vol: 0.0018, base: 1150, history: [], open: 1150,  sector: "Pharma",   volume: 0, circuitHit: null },
    // Metals & Mining
    { ticker: "TATASTEEL",  name: "Tata Steel Ltd",          ltp: 130,  vol: 0.0038, base: 130,  history: [], open: 130,   sector: "Metal",    volume: 0, circuitHit: null },
    { ticker: "JSWSTEEL",   name: "JSW Steel Ltd",           ltp: 850,  vol: 0.0032, base: 850,  history: [], open: 850,   sector: "Metal",    volume: 0, circuitHit: null },
    { ticker: "COALINDIA",  name: "Coal India Ltd",          ltp: 420,  vol: 0.0022, base: 420,  history: [], open: 420,   sector: "Metal",    volume: 0, circuitHit: null },
    // FMCG
    { ticker: "ITC",        name: "ITC Ltd",                 ltp: 450,  vol: 0.0010, base: 450,  history: [], open: 450,   sector: "FMCG",     volume: 0, circuitHit: null },
    { ticker: "HINDUNILVR", name: "Hindustan Unilever",      ltp: 2400, vol: 0.0012, base: 2400, history: [], open: 2400,  sector: "FMCG",     volume: 0, circuitHit: null },
    // Telecom
    { ticker: "BHARTIARTL", name: "Bharti Airtel",           ltp: 1500, vol: 0.0020, base: 1500, history: [], open: 1500,  sector: "Telecom",  volume: 0, circuitHit: null },
    // Infra / Engineering
    { ticker: "LT",         name: "Larsen & Toubro",         ltp: 3300, vol: 0.0016, base: 3300, history: [], open: 3300,  sector: "Infra",    volume: 0, circuitHit: null },
    // New Age Tech
    { ticker: "ZOMATO",     name: "Zomato Ltd",              ltp: 120,  vol: 0.0050, base: 120,  history: [], open: 120,   sector: "Tech",     volume: 0, circuitHit: null }
];

// ==================== NEWS EVENTS (80+) ====================
var newsEvents = [
    // ---- MACRO / MARKET-WIDE ----
    { text: "NIFTY drops 100 pts on global sell-off. Bearish sentiment sweeps the market.", impact: -0.012, target: "ALL" },
    { text: "FII outflows continue for 5th consecutive session. Broad weakness across sectors.", impact: -0.01, target: "ALL" },
    { text: "Crude oil surges 5%. Import-heavy sectors face headwinds.", impact: -0.015, target: "ALL" },
    { text: "India GDP growth beats estimates at 7.6%. Market rallies on optimism.", impact: 0.018, target: "ALL" },
    { text: "Rupee hits all-time low against USD. Import costs spike.", impact: -0.012, target: "ALL" },
    { text: "DII buying supports market amid FII selling. Mid-caps outperform.", impact: 0.008, target: "ALL" },
    { text: "Global rally: US Fed hints at rate cuts. Risk-on sentiment globally.", impact: 0.02, target: "ALL" },
    { text: "US inflation data comes in higher than expected. Global sell-off.", impact: -0.018, target: "ALL" },
    { text: "Geopolitical tensions in Middle East escalate. Oil prices spike.", impact: -0.014, target: "ALL" },
    { text: "India-EU free trade agreement signed. Export sectors celebrate.", impact: 0.015, target: "ALL" },
    { text: "SEBI tightens margin rules. Speculative stocks under pressure.", impact: -0.008, target: "ALL" },
    { text: "Government announces surprise fiscal stimulus package worth 2L Cr.", impact: 0.025, target: "ALL" },
    { text: "China PMI data disappoints. Asian markets sell off.", impact: -0.01, target: "ALL" },
    { text: "Japan BOJ surprises with rate hike. Carry trade unwind hits EM stocks.", impact: -0.02, target: "ALL" },
    { text: "VIX spikes 20%. Fear gauge signals extreme volatility ahead.", impact: -0.015, target: "ALL" },

    // ---- BANKING ----
    { text: "RBI keeps repo rate unchanged at 6.5%. Banks rally on status quo.", impact: 0.015, target: "BANK" },
    { text: "Interest rate hike fears rattle banking sector. NPA concerns surface.", impact: -0.018, target: "BANK" },
    { text: "RBI imposes restrictions on a mid-size private bank. Sector cautious.", impact: -0.012, target: "BANK" },
    { text: "Credit growth hits 18-month high. Banking sector upgrade by brokerages.", impact: 0.02, target: "BANK" },
    { text: "PSU bank recapitalization announced. Government injects 20K Cr.", impact: 0.025, target: "BANK" },
    { text: "HDFC Bank Q4 results: NII up 24%, asset quality improves.", impact: 0.03, target: "HDFCBANK" },
    { text: "SBI reports highest-ever quarterly profit. Dividend announced.", impact: 0.028, target: "SBIN" },
    { text: "Kotak Bank receives RBI approval for new business vertical.", impact: 0.018, target: "KOTAKBANK" },
    { text: "Axis Bank completes acquisition of Citibank India retail business.", impact: 0.015, target: "AXISBANK" },
    { text: "Bajaj Finance AUM crosses 3 lakh crore milestone.", impact: 0.022, target: "BAJFINANCE" },

    // ---- IT ----
    { text: "New multi-billion dollar deal boosts IT sector confidence.", impact: 0.018, target: "IT" },
    { text: "Global tech rout weighs on Indian IT. NASDAQ down 3%.", impact: -0.02, target: "IT" },
    { text: "TCS wins largest-ever deal worth $5B from US government.", impact: 0.035, target: "TCS" },
    { text: "Infosys raises FY guidance: revenue growth at 13-15%.", impact: 0.028, target: "INFY" },
    { text: "HCL Tech cloud revenue grows 40%. Multi-year deal pipeline strong.", impact: 0.02, target: "HCLTECH" },
    { text: "Wipro CEO resigns unexpectedly. Leadership uncertainty rattles investors.", impact: -0.035, target: "WIPRO" },
    { text: "US H-1B visa restrictions tightened. IT stocks face headwinds.", impact: -0.018, target: "IT" },
    { text: "AI adoption drives cloud spending surge. Indian IT set to benefit.", impact: 0.015, target: "IT" },

    // ---- ENERGY / OIL ----
    { text: "OPEC cuts production by 2M barrels/day. Energy stocks surge.", impact: 0.02, target: "ENERGY" },
    { text: "Reliance new energy division secures 10GW solar contract.", impact: 0.03, target: "RELIANCE" },
    { text: "Reliance Jio subscriber base crosses 500 million mark.", impact: 0.025, target: "RELIANCE" },
    { text: "NTPC commissions India's largest floating solar plant.", impact: 0.02, target: "NTPC" },
    { text: "Power Grid wins 8 new transmission projects worth 12K Cr.", impact: 0.018, target: "POWERGRID" },
    { text: "India electricity demand hits record high. Power stocks surge.", impact: 0.022, target: "POWER" },

    // ---- INFRA ----
    { text: "Government announces capex boost. Infra spending up 30% YoY.", impact: 0.02, target: "INFRA" },
    { text: "L&T bags mega order worth 25K Cr from Saudi Arabia.", impact: 0.03, target: "LT" },
    { text: "Adani group under fresh selling pressure. Hindenburg report follow-up.", impact: -0.04, target: "ADANIENT" },
    { text: "Adani Enterprises wins rights to develop 3 new airports.", impact: 0.03, target: "ADANIENT" },
    { text: "National Infrastructure Pipeline: 50 new projects worth 10L Cr announced.", impact: 0.025, target: "INFRA" },

    // ---- AUTO ----
    { text: "Auto sales surge 15% MoM. Sector outperforms on festive demand.", impact: 0.025, target: "AUTO" },
    { text: "Maruti launches new EV platform. Electric SUV bookings cross 50K.", impact: 0.028, target: "MARUTI" },
    { text: "Tata Motors EV deliveries hit record high. 30K units in one month.", impact: 0.025, target: "TATAMOTORS" },
    { text: "Auto sector faces chip shortage again. Production cuts likely.", impact: -0.02, target: "AUTO" },
    { text: "GST on hybrid cars reduced from 28% to 18%. Auto rally.", impact: 0.022, target: "AUTO" },

    // ---- PHARMA ----
    { text: "USFDA approves new blockbuster drug from Sun Pharma. Pharma rally.", impact: 0.03, target: "PHARMA" },
    { text: "USFDA issues warning letter to Sun Pharma for Halol plant.", impact: -0.04, target: "SUNPHARMA" },
    { text: "Government announces price caps on key drugs. Pharma margins squeezed.", impact: -0.02, target: "PHARMA" },
    { text: "India becomes world's largest generic drug exporter. Pharma sector rallies.", impact: 0.02, target: "PHARMA" },

    // ---- METAL ----
    { text: "Steel demand rises on infra spending. Metal stocks gain on volume.", impact: 0.022, target: "METAL" },
    { text: "China demand recovery lifts metal prices globally. Steel exports up.", impact: 0.02, target: "METAL" },
    { text: "JSW Steel capacity expansion to 50 MTPA approved by board.", impact: 0.025, target: "JSWSTEEL" },
    { text: "Coal India production up 15% in Q3. Record coal dispatch achieved.", impact: 0.02, target: "COALINDIA" },
    { text: "Anti-dumping duty on Chinese steel imports. Domestic steel makers benefit.", impact: 0.018, target: "METAL" },
    { text: "Iron ore prices crash 12%. Steel margins under severe pressure.", impact: -0.025, target: "METAL" },

    // ---- TELECOM ----
    { text: "5G subscriber adds beat estimates. Telecom stocks jump.", impact: 0.018, target: "TELECOM" },
    { text: "Airtel raises tariffs by 15%. ARPU improvement expected.", impact: 0.025, target: "BHARTIARTL" },
    { text: "TRAI proposes new spectrum allocation. Telecom capex to rise.", impact: -0.01, target: "TELECOM" },

    // ---- FMCG ----
    { text: "HUL margin pressure due to palm oil price surge.", impact: -0.02, target: "FMCG" },
    { text: "ITC FMCG segment turns profitable for first time. Stock re-rates.", impact: 0.025, target: "ITC" },
    { text: "Rural demand recovery drives FMCG volume growth to 8%.", impact: 0.015, target: "FMCG" },
    { text: "ITC demerger of hotel business completed. Unlocks value.", impact: 0.02, target: "ITC" },

    // ---- NEW AGE / TECH ----
    { text: "Zomato quick commerce grows 80% QoQ. Blinkit leads market.", impact: 0.04, target: "ZOMATO" },
    { text: "Zomato Hyperpure revenue doubles. B2B supply chain expanding.", impact: 0.025, target: "ZOMATO" },
    { text: "Zomato insider selling: Promoter offloads 2% stake via block deal.", impact: -0.03, target: "ZOMATO" },

    // ---- RANDOM / GENERIC ----
    { text: "Earnings beat for {name}! Revenue up 22% YoY. Margins expand.", impact: 0.025, target: "RANDOM" },
    { text: "Earnings miss for {name}. Revenue flat, margins contract 150bps.", impact: -0.025, target: "RANDOM" },
    { text: "SEBI initiates regulatory probe against {name}. Compliance under review.", impact: -0.04, target: "RANDOM" },
    { text: "Block deal: Institutional investor buys {name} at 3% premium to CMP.", impact: 0.015, target: "RANDOM" },
    { text: "{name} announces stock buyback program of 5,000 Cr.", impact: 0.03, target: "RANDOM" },
    { text: "Short squeeze in {name}! Bears caught off guard. Massive short covering.", impact: 0.05, target: "RANDOM" },
    { text: "Profit booking in {name} after 15% rally in 5 sessions.", impact: -0.025, target: "RANDOM" },
    { text: "Analyst upgrade: {name} target price raised 20% by Goldman Sachs.", impact: 0.02, target: "RANDOM" },
    { text: "Analyst downgrade: {name} target slashed by Morgan Stanley. Sell rating.", impact: -0.025, target: "RANDOM" },
    { text: "Insider buying detected in {name}. Promoter raises stake by 1.2%.", impact: 0.018, target: "RANDOM" },
    { text: "Promoter pledge in {name} rises to 35%. Market concerned.", impact: -0.022, target: "RANDOM" },
    { text: "Mutual fund holdings in {name} increase by 3% this quarter.", impact: 0.012, target: "RANDOM" },
    { text: "{name} board approves 1:1 bonus share issue. Record date next week.", impact: 0.035, target: "RANDOM" },
    { text: "{name} CFO resignation. Key management departure rattles street.", impact: -0.03, target: "RANDOM" },
    { text: "New strategic partnership announced by {name} with global giant.", impact: 0.022, target: "RANDOM" },
    { text: "{name} acquires competitor in 8,000 Cr all-cash deal.", impact: -0.015, target: "RANDOM" },
    { text: "Large OI buildup in {name} futures. Institutional activity surges.", impact: 0.01, target: "RANDOM" },
    { text: "{name} hits 52-week high! Momentum traders pile in.", impact: 0.03, target: "RANDOM" },
    { text: "{name} breaks key support level. Technical breakdown triggers selling.", impact: -0.03, target: "RANDOM" },
    { text: "Credit rating upgrade for {name} by CRISIL. Outlook stable.", impact: 0.015, target: "RANDOM" },

    // ---- ADDITIONAL MACRO ----
    { text: "India CPI inflation drops to 4.2%. Monetary easing hopes rise.", impact: 0.016, target: "ALL" },
    { text: "RBI announces surprise 25bps CRR cut. Liquidity injection into banking.", impact: 0.02, target: "BANK" },
    { text: "US 10-year bond yield crosses 5%. Global equity rout intensifies.", impact: -0.022, target: "ALL" },
    { text: "S&P upgrades India's sovereign rating outlook to positive.", impact: 0.025, target: "ALL" },
    { text: "India manufacturing PMI hits 16-month high at 58.3.", impact: 0.014, target: "ALL" },
    { text: "Monsoon forecast revised below normal. Rural consumption at risk.", impact: -0.01, target: "FMCG" },
    { text: "India forex reserves cross $700 billion. Record high.", impact: 0.008, target: "ALL" },
    { text: "Government raises windfall tax on oil. Energy margins hit.", impact: -0.02, target: "ENERGY" },
    { text: "GST collections hit record 2.1L Cr in March. Fiscal health strong.", impact: 0.012, target: "ALL" },
    { text: "Global recession fears mount. IMF cuts world growth projection.", impact: -0.016, target: "ALL" },
    { text: "India included in JPMorgan Global Bond Index. FII inflows surge.", impact: 0.022, target: "ALL" },
    { text: "European Central Bank surprises with 50bps rate cut. Risk-on wave.", impact: 0.015, target: "ALL" },
    { text: "Crypto crash spills into equity markets. Risk assets under pressure.", impact: -0.008, target: "ALL" },
    { text: "India trade deficit narrows sharply. Exports hit all-time high.", impact: 0.012, target: "ALL" },
    { text: "Earthquake in Taiwan disrupts semiconductor supply chain.", impact: -0.02, target: "IT" },
    { text: "US-China trade tensions re-escalate. New tariffs announced.", impact: -0.014, target: "ALL" },
    { text: "Gold hits all-time high above $2,800/oz. Safe haven demand surges.", impact: -0.006, target: "ALL" },
    { text: "India becomes 3rd largest economy by GDP. Overtakes Japan.", impact: 0.02, target: "ALL" },
    { text: "RBI Governor makes hawkish comments. Rate cut expectations dashed.", impact: -0.012, target: "BANK" },
    { text: "Union Budget announces zero tax up to 12L income. Consumption boost expected.", impact: 0.025, target: "FMCG" },

    // ---- ADDITIONAL BANKING / FINANCE ----
    { text: "ICICI Bank net profit jumps 35%. Best quarterly performance in 5 years.", impact: 0.03, target: "ICICIBANK" },
    { text: "Kotak Mahindra Bank faces RBI embargo on digital onboarding.", impact: -0.035, target: "KOTAKBANK" },
    { text: "Axis Bank NPA ratio improves to 1.4%. Clean-up cycle nearing end.", impact: 0.02, target: "AXISBANK" },
    { text: "Bajaj Finance EMI card user base crosses 80 million.", impact: 0.018, target: "BAJFINANCE" },
    { text: "NBFC liquidity crisis fears return. Shadow banking stocks tumble.", impact: -0.025, target: "BANK" },
    { text: "Digital lending regulations tightened by RBI. Fintech stocks fall.", impact: -0.015, target: "BANK" },
    { text: "Bank Nifty crosses 55,000 for the first time. Banking euphoria.", impact: 0.025, target: "BANK" },
    { text: "Home loan rates cut by 50bps across PSU banks. Housing demand to rise.", impact: 0.015, target: "BANK" },
    { text: "SBI raises 30K Cr via QIP. Institutional demand 3x oversubscribed.", impact: 0.015, target: "SBIN" },
    { text: "HDFC Bank faces deposits growth slowdown concern. Street cautious.", impact: -0.018, target: "HDFCBANK" },

    // ---- ADDITIONAL IT ----
    { text: "TCS board announces Rs 18,000 Cr share buyback at premium.", impact: 0.03, target: "TCS" },
    { text: "Infosys faces $500M tax demand from GST authorities.", impact: -0.03, target: "INFY" },
    { text: "Wipro bags $1.5B deal from European telco. Largest in 3 years.", impact: 0.035, target: "WIPRO" },
    { text: "HCL Tech launches GenAI platform. Enterprise AI revenue pipeline $2B.", impact: 0.025, target: "HCLTECH" },
    { text: "Indian IT headcount shrinks for 3rd quarter. Automation impact visible.", impact: -0.015, target: "IT" },
    { text: "US tech spending outlook improves. CIO surveys bullish for FY26.", impact: 0.018, target: "IT" },
    { text: "Currency tailwind: Rupee depreciation boosts IT earnings outlook.", impact: 0.012, target: "IT" },
    { text: "European DORA regulation creates compliance demand. IT firms benefit.", impact: 0.015, target: "IT" },

    // ---- ADDITIONAL ENERGY / POWER ----
    { text: "Reliance Retail revenue crosses 3L Cr. Fastest growing retail chain.", impact: 0.025, target: "RELIANCE" },
    { text: "Reliance warns of petrochemical margin weakness in Q3 call.", impact: -0.02, target: "RELIANCE" },
    { text: "NTPC Green Energy IPO listing at 30% premium. Parent stock rallies.", impact: 0.02, target: "NTPC" },
    { text: "Power Grid dividend yield at 5%. Defensive pick in volatile market.", impact: 0.01, target: "POWERGRID" },
    { text: "India's renewable energy capacity crosses 200GW milestone.", impact: 0.015, target: "POWER" },
    { text: "Gas price revision: APM price hiked 10%. Upstream companies benefit.", impact: 0.018, target: "ENERGY" },
    { text: "Power demand dips on unseasonable rain. Utility stocks correct.", impact: -0.012, target: "POWER" },
    { text: "Adani Green completes 25GW wind-solar hybrid project.", impact: 0.02, target: "ADANIENT" },

    // ---- ADDITIONAL AUTO ----
    { text: "Maruti Q3 profit surges 42%. SUV mix at all-time high of 60%.", impact: 0.03, target: "MARUTI" },
    { text: "Tata Motors JLR margins expand to 8.5%. Best in 4 years.", impact: 0.028, target: "TATAMOTORS" },
    { text: "EV subsidy FAME-III scheme launched. 50K Cr allocated over 5 years.", impact: 0.025, target: "AUTO" },
    { text: "Auto insurance costs rise 20%. Negative for auto demand outlook.", impact: -0.012, target: "AUTO" },
    { text: "Maruti recalls 50,000 vehicles over safety defect. Shares dip.", impact: -0.02, target: "MARUTI" },
    { text: "Tata Motors to demerge EV business. Listing expected next quarter.", impact: 0.035, target: "TATAMOTORS" },

    // ---- ADDITIONAL PHARMA ----
    { text: "Sun Pharma specialty portfolio revenue crosses $1B for first time.", impact: 0.028, target: "SUNPHARMA" },
    { text: "India pharma exports to Africa double in 2 years. New markets open.", impact: 0.015, target: "PHARMA" },
    { text: "Biosimilar approval in EU boosts Indian pharma companies.", impact: 0.02, target: "PHARMA" },
    { text: "Drug price control order expanded. 150 new drugs under ceiling.", impact: -0.018, target: "PHARMA" },

    // ---- ADDITIONAL METAL ----
    { text: "Tata Steel completes Netherlands plant restructuring. Losses to narrow.", impact: 0.02, target: "TATASTEEL" },
    { text: "JSW Steel reports record quarterly EBITDA. Volume guidance raised.", impact: 0.025, target: "JSWSTEEL" },
    { text: "Coal India e-auction premiums at 3-year high. Profitability surges.", impact: 0.022, target: "COALINDIA" },
    { text: "Global aluminum surplus leads to price crash. Metal sector bleeds.", impact: -0.022, target: "METAL" },
    { text: "India imposes export duty on iron ore. Steel input costs to rise.", impact: -0.015, target: "METAL" },
    { text: "Copper prices hit $12,000/ton. EV-driven demand reaches new high.", impact: 0.018, target: "METAL" },

    // ---- ADDITIONAL TELECOM ----
    { text: "Jio announces satellite broadband plans. Direct competition with Starlink.", impact: 0.02, target: "RELIANCE" },
    { text: "Airtel Africa revenue grows 22%. International ops becoming significant.", impact: 0.018, target: "BHARTIARTL" },
    { text: "TRAI mandates 20% tariff cut for basic plans. Revenue impact feared.", impact: -0.02, target: "TELECOM" },
    { text: "Airtel wins 700 MHz spectrum in latest auction. Rural 5G expansion.", impact: 0.015, target: "BHARTIARTL" },

    // ---- ADDITIONAL FMCG ----
    { text: "Hindustan Unilever premium portfolio grows 25%. Premiumization trend strong.", impact: 0.018, target: "HINDUNILVR" },
    { text: "ITC cigarette volumes defy ESG concerns. Tax stability helps.", impact: 0.015, target: "ITC" },
    { text: "FMCG sector faces urban slowdown. Quick commerce cannibalizes kiranas.", impact: -0.012, target: "FMCG" },
    { text: "Hindustan Unilever announces Rs 12,000 Cr buyback at premium.", impact: 0.025, target: "HINDUNILVR" },

    // ---- ADDITIONAL INFRA ----
    { text: "L&T order book crosses 5L Cr. Highest backlog in company history.", impact: 0.025, target: "LT" },
    { text: "Adani Ports handles record cargo of 40 MT in single quarter.", impact: 0.02, target: "ADANIENT" },
    { text: "Real estate demand boom fuels cement and infra stocks higher.", impact: 0.018, target: "INFRA" },
    { text: "Road construction pace drops 15%. Labour shortage impacts projects.", impact: -0.015, target: "INFRA" },
    { text: "L&T Smart World wins Rs 8,000 Cr smart city contract.", impact: 0.02, target: "LT" },

    // ---- ADDITIONAL NEW AGE / TECH ----
    { text: "Zomato enters live events and ticketing. New revenue vertical launched.", impact: 0.02, target: "ZOMATO" },
    { text: "Quick commerce war: Zomato Blinkit burns Rs 500 Cr in quarter.", impact: -0.025, target: "ZOMATO" },
    { text: "Zomato gets GST demand notice of Rs 800 Cr. Stock under pressure.", impact: -0.03, target: "ZOMATO" },
    { text: "Zomato gold membership crosses 10 million subscribers.", impact: 0.02, target: "ZOMATO" },

    // ---- MORE RANDOM / GENERIC ----
    { text: "{name} signs $2B joint venture with global PE fund.", impact: 0.028, target: "RANDOM" },
    { text: "Whistleblower complaint against {name}. Corporate governance concerns.", impact: -0.035, target: "RANDOM" },
    { text: "Board of {name} approves 5:1 stock split. Improves retail participation.", impact: 0.02, target: "RANDOM" },
    { text: "{name} enters Fortune 500 list for the first time.", impact: 0.015, target: "RANDOM" },
    { text: "Tax raid on {name} offices. I-T department seizes documents.", impact: -0.04, target: "RANDOM" },
    { text: "{name} CEO buys shares worth 50 Cr in open market. Confidence signal.", impact: 0.025, target: "RANDOM" },
    { text: "PE ratio of {name} crosses 80x. Valuation concerns intensify.", impact: -0.018, target: "RANDOM" },
    { text: "{name} production halted due to factory fire. Operations disrupted.", impact: -0.045, target: "RANDOM" },
    { text: "{name} wins government contract worth 15,000 Cr. Order book surges.", impact: 0.03, target: "RANDOM" },
    { text: "Warren Buffett's Berkshire takes 2% stake in {name}. Global attention.", impact: 0.04, target: "RANDOM" },
    { text: "{name} launches QIP worth 10,000 Cr. Equity dilution concerns.", impact: -0.02, target: "RANDOM" },
    { text: "Foreign broker initiates coverage on {name} with BUY. Target 40% upside.", impact: 0.025, target: "RANDOM" },
    { text: "{name} announced as replacement in NIFTY 50 index. Passive inflows expected.", impact: 0.035, target: "RANDOM" },
    { text: "{name} excluded from MSCI Emerging Markets index. FII selling likely.", impact: -0.03, target: "RANDOM" },
    { text: "{name} debt-to-equity ratio improves to 0.3x. Balance sheet strengthens.", impact: 0.015, target: "RANDOM" },
    { text: "ESG rating downgrade for {name}. Sustainability-focused funds exit.", impact: -0.02, target: "RANDOM" },
    { text: "{name} ROCE improves to 22%. Capital efficiency gains noted by analysts.", impact: 0.018, target: "RANDOM" },
    { text: "Unusual options activity in {name}. Massive call buying detected.", impact: 0.025, target: "RANDOM" },
    { text: "{name} subsidiary IPO valued at premium. Unlocking hidden value.", impact: 0.022, target: "RANDOM" },
    { text: "Labour strike at {name} factory enters 2nd week. Production loss mounting.", impact: -0.03, target: "RANDOM" },
    { text: "{name} dividend yield at 4.5%. Attractive for income investors.", impact: 0.01, target: "RANDOM" },
    { text: "Short selling in {name} at 3-year high. Bears circling aggressively.", impact: -0.02, target: "RANDOM" },
    { text: "{name} signs MoU with Indian Army for defense supplies.", impact: 0.02, target: "RANDOM" },
    { text: "{name} patent portfolio valued at $800M by independent assessors.", impact: 0.015, target: "RANDOM" },
    { text: "Regulatory clearance granted to {name} for new product launch.", impact: 0.018, target: "RANDOM" },
    { text: "{name} faces class action lawsuit in US courts. Legal risk escalates.", impact: -0.035, target: "RANDOM" },
    { text: "Bulk deal: Singapore sovereign fund buys 1.5% of {name}.", impact: 0.02, target: "RANDOM" },
    { text: "{name} management guides for 30% profit growth in FY26.", impact: 0.025, target: "RANDOM" },
    { text: "Data breach reported at {name}. Customer information compromised.", impact: -0.025, target: "RANDOM" },
    { text: "{name} expands to 3 new international markets. Revenue diversification.", impact: 0.018, target: "RANDOM" }
];

// Map target keywords to stocks
function getNewsTargets(target) {
    switch (target) {
        case "RANDOM":
            var s = marketStocks[Math.floor(Math.random() * marketStocks.length)];
            return { stocks: [s], name: s.name };
        case "IT":       return { stocks: marketStocks.filter(function(s) { return s.sector === "IT"; }) };
        case "BANK":     return { stocks: marketStocks.filter(function(s) { return s.sector === "Banking" || s.sector === "Finance"; }) };
        case "ENERGY":   return { stocks: marketStocks.filter(function(s) { return s.sector === "Energy"; }) };
        case "AUTO":     return { stocks: marketStocks.filter(function(s) { return s.sector === "Auto"; }) };
        case "PHARMA":   return { stocks: marketStocks.filter(function(s) { return s.sector === "Pharma"; }) };
        case "METAL":    return { stocks: marketStocks.filter(function(s) { return s.sector === "Metal"; }) };
        case "FMCG":     return { stocks: marketStocks.filter(function(s) { return s.sector === "FMCG"; }) };
        case "TELECOM":  return { stocks: marketStocks.filter(function(s) { return s.sector === "Telecom"; }) };
        case "INFRA":    return { stocks: marketStocks.filter(function(s) { return s.sector === "Infra"; }) };
        case "POWER":    return { stocks: marketStocks.filter(function(s) { return s.sector === "Power"; }) };
        case "ALL":      return { stocks: marketStocks };
        default:         return { stocks: marketStocks.filter(function(s) { return s.ticker === target; }) };
    }
}

// ==================== STATE ====================
var state = {
    day: 1,
    time: START_TIME,
    margin: INITIAL_MARGIN,
    positions: {},
    optionsPositions: {},
    tradeHistory: [],
    isRunning: true,
    speedMs: 1000,
    activeStock: null,
    historyLen: 1875,
    theme: 'dark',
    activeTab: 'equity',
    activeBottomTab: 'equity',
    newsCount: 0,
    marketOpen: true,
    niftyBase: 22500,
    niftyValue: 22500,
    niftyHistory: [],
    sentiment: 0,  // -100 to +100
    chartType: 'line',
    timeframe: '30M',
    viewLen: 30,
    candlePeriod: 5,
    slTargets: {}   // { ticker: { sl: num|null, target: num|null } }
};

var marketInterval;
var chartInstance = null;

// ==================== CANDLESTICK PLUGIN ====================
var candlestickPlugin = {
    id: 'candlestickDraw',
    afterDatasetsDraw: function(chart) {
        var ctx = chart.ctx;
        var xScale = chart.scales.x;
        var yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        var ohlc = chart._ohlc;
        if (!ohlc || !ohlc.length) return;
        var count = ohlc.length;
        var candleW = Math.max(3, Math.floor((xScale.width / (count + 1)) * 0.65));
        var isLight = state.theme === 'light';
        ohlc.forEach(function(d, i) {
            var xPos = xScale.getPixelForValue(i);
            var openY  = yScale.getPixelForValue(d.o);
            var closeY = yScale.getPixelForValue(d.c);
            var highY  = yScale.getPixelForValue(d.h);
            var lowY   = yScale.getPixelForValue(d.l);
            var isBull = d.c >= d.o;
            var color  = isBull
                ? (isLight ? '#00a846' : '#00c853')
                : (isLight ? '#d50032' : '#ff1744');
            // Wick
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.moveTo(xPos, highY);
            ctx.lineTo(xPos, lowY);
            ctx.stroke();
            // Body
            var bodyTop = Math.min(openY, closeY);
            var bodyH   = Math.max(1, Math.abs(closeY - openY));
            ctx.fillStyle = color;
            ctx.fillRect(xPos - candleW / 2, bodyTop, candleW, bodyH);
        });
    }
};

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", function() {
    initMarket();
    setupListeners();
    renderAll();
    startClock();
});

function initMarket() {
    marketStocks.forEach(function(s) {
        s.history = Array(state.historyLen).fill(s.ltp);
        s.open = s.ltp;
        s.prevClose = s.ltp;
        s.volume = 0;
        s.circuitHit = null;
        s.ohlcHistory = [];
        s.currentCandle = null;
    });
    state.niftyHistory = Array(state.historyLen).fill(state.niftyValue);
    selectStock(marketStocks[0]);
}

// ==================== LISTENERS ====================
function setupListeners() {
    document.getElementById('btn-pause').addEventListener('click', function(e) { setSpeed(0, e.currentTarget); });
    document.getElementById('btn-play').addEventListener('click', function(e) { setSpeed(1000, e.currentTarget); });
    document.getElementById('btn-fast').addEventListener('click', function(e) { setSpeed(100, e.currentTarget); });
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-new-day').addEventListener('click', startNewDay);
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-apply-settings').addEventListener('click', applySettings);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
    document.getElementById('cash-stat').addEventListener('click', openSettings);
    document.getElementById('btn-chart-line').addEventListener('click', function() { setChartType('line'); });
    document.getElementById('btn-chart-candle').addEventListener('click', function() { setChartType('candle'); });
    TIMEFRAMES.forEach(function(tf) {
        var btn = document.getElementById('tf-' + tf.label);
        if (btn) btn.addEventListener('click', function() { setTimeframe(tf.label); });
    });

    // Cash preset buttons
    document.querySelectorAll('.cash-preset').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.getElementById('settings-cash').value = btn.dataset.v;
        });
    });

    var qtyInput = document.getElementById('order-qty');
    document.querySelectorAll('.preset').forEach(function(btn) {
        btn.addEventListener('click', function() {
            qtyInput.value = parseInt(qtyInput.value || 0) + parseInt(btn.dataset.v);
            updateOrderMargin();
        });
    });
    qtyInput.addEventListener('input', updateOrderMargin);

    document.getElementById('btn-buy').addEventListener('click', function() { executeTrade('BUY'); });
    document.getElementById('btn-sell').addEventListener('click', function() { executeTrade('SELL'); });

    document.getElementById('tab-equity').addEventListener('click', function() { switchOrderTab('equity'); });
    document.getElementById('tab-options').addEventListener('click', function() { switchOrderTab('options'); });

    document.getElementById('opt-call').addEventListener('click', function() {
        document.getElementById('opt-call').classList.add('active');
        document.getElementById('opt-put').classList.remove('active');
        document.getElementById('option-type').value = 'CALL';
        updateStrikesAndPremium();
    });
    document.getElementById('opt-put').addEventListener('click', function() {
        document.getElementById('opt-put').classList.add('active');
        document.getElementById('opt-call').classList.remove('active');
        document.getElementById('option-type').value = 'PUT';
        updateStrikesAndPremium();
    });

    var optLotsInput = document.getElementById('option-lots');
    document.querySelectorAll('.preset-opt').forEach(function(btn) {
        btn.addEventListener('click', function() {
            optLotsInput.value = parseInt(optLotsInput.value || 0) + parseInt(btn.dataset.v);
            updateOptionMargin();
        });
    });
    optLotsInput.addEventListener('input', updateOptionMargin);
    document.getElementById('strike-price').addEventListener('change', updateOptionMargin);
    document.getElementById('expiry-date').addEventListener('change', function() {
        updateStrikesAndPremium();
        updateOptionMargin();
    });

    document.getElementById('btn-buy-option').addEventListener('click', function() { executeOptionTrade('BUY'); });
    document.getElementById('btn-sell-option').addEventListener('click', function() { executeOptionTrade('SELL'); });

    document.getElementById('positions-tab').addEventListener('click', function() { switchBottomTab('equity'); });
    document.getElementById('options-pos-tab').addEventListener('click', function() { switchBottomTab('options'); });
    document.getElementById('history-tab').addEventListener('click', function() { switchBottomTab('history'); });
    document.getElementById('btn-close-all').addEventListener('click', closeAllPositions);

    // SL / Target auto-set when inputs change
    document.getElementById('sl-price').addEventListener('change', saveSlTarget);
    document.getElementById('target-price').addEventListener('change', saveSlTarget);
}

// ==================== SETTINGS / MODIFIABLE CASH ====================
function openSettings() {
    document.getElementById('settings-cash').value = state.margin;
    document.getElementById('settings-news-freq').value = NEWS_FREQ.toString();
    document.getElementById('settings-volatility').value = VOL_MULTIPLIER.toString();
    document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
}

function applySettings() {
    var newCash = parseFloat(document.getElementById('settings-cash').value);
    var newFreq = parseFloat(document.getElementById('settings-news-freq').value);
    var newVol = parseFloat(document.getElementById('settings-volatility').value);

    if (isNaN(newCash) || newCash < 10000) {
        toast("Error", "Minimum capital is \u20b910,000", "error");
        return;
    }

    var cashChanged = Math.abs(newCash - state.margin) > 0.01;

    NEWS_FREQ = newFreq;
    VOL_MULTIPLIER = newVol;

    if (cashChanged) {
        // Reset everything
        INITIAL_MARGIN = newCash;
        state.margin = newCash;
        state.positions = {};
        state.optionsPositions = {};
        state.slTargets = {};
        state.tradeHistory = [];
        state.day = 1;
        state.time = START_TIME;
        state.newsCount = 0;
        state.marketOpen = true;
        state.isRunning = true;
        state.sentiment = 0;
        state.niftyValue = 22500;
        state.niftyBase = 22500;

        marketStocks.forEach(function(s) {
            s.ltp = s.base;
            s.open = s.base;
            s.prevClose = s.base;
            s.history = Array(state.historyLen).fill(s.ltp);
            s.volume = 0;
            s.circuitHit = null;
            s.ohlcHistory = [];
            s.currentCandle = null;
        });
        state.niftyHistory = Array(state.historyLen).fill(state.niftyValue);

        document.getElementById('news-container').innerHTML =
            '<div class="news-item"><span class="news-time mono">09:15</span>' +
            '<span class="news-text">Simulation reset. Starting capital: ' + fmtCur(newCash) + '</span></div>';
        document.getElementById('news-count').textContent = '0';

        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

        document.querySelectorAll('.ctrl-btn').forEach(function(b) {
            if (b.id !== 'btn-theme' && b.id !== 'btn-settings') b.classList.remove('on');
        });
        document.getElementById('btn-play').classList.add('on');

        startClock();
        toast("Reset", "Simulation reset with " + fmtCur(newCash) + " capital", "success");
    } else {
        toast("Settings", "Settings updated", "info");
    }

    closeSettings();
    renderAll();
}

// ==================== CHART TYPE TOGGLE ====================
function setChartType(type) {
    state.chartType = type;
    document.getElementById('btn-chart-line').classList.toggle('active', type === 'line');
    document.getElementById('btn-chart-candle').classList.toggle('active', type === 'candle');
    if (state.activeStock) renderChart(state.activeStock);
}

// ==================== TIMEFRAME TOGGLE ====================
function setTimeframe(label) {
    var tf = TIMEFRAMES.find(function(t) { return t.label === label; });
    if (!tf) return;
    state.timeframe = label;
    state.viewLen = tf.viewLen;
    state.candlePeriod = tf.candlePeriod;
    document.querySelectorAll('.tf-btn').forEach(function(b) { b.classList.remove('active'); });
    document.getElementById('tf-' + label).classList.add('active');
    if (state.activeStock) renderChart(state.activeStock);
}

// ==================== THEME ====================
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('light');
    document.querySelector('#btn-theme i').className = state.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (state.activeStock) renderChart(state.activeStock);
    toast('Theme', state.theme === 'light' ? 'Light Mode' : 'Dark Mode', 'info');
}

// ==================== TAB SWITCHING ====================
function switchOrderTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.o-tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('equity-form').classList.toggle('hidden', tab !== 'equity');
    document.getElementById('options-form').classList.toggle('hidden', tab !== 'options');
    if (tab === 'options') updateStrikesAndPremium();
}

function switchBottomTab(tab) {
    state.activeBottomTab = tab;
    document.querySelectorAll('.b-tab').forEach(function(t) { t.classList.remove('active'); });
    if (tab === 'equity') document.getElementById('positions-tab').classList.add('active');
    else if (tab === 'options') document.getElementById('options-pos-tab').classList.add('active');
    else document.getElementById('history-tab').classList.add('active');

    document.getElementById('equity-table').classList.toggle('hidden', tab !== 'equity');
    document.getElementById('options-table').classList.toggle('hidden', tab !== 'options');
    document.getElementById('history-table').classList.toggle('hidden', tab !== 'history');

    if (tab === 'options') renderOptionsTable();
    if (tab === 'history') renderHistoryTable();
}

// ==================== MARKET SIMULATION ====================
function startClock() {
    if (marketInterval) clearInterval(marketInterval);
    if (!state.isRunning) return;
    marketInterval = setInterval(tickMinute, state.speedMs);
}

function setSpeed(ms, btn) {
    document.querySelectorAll('.ctrl-btn').forEach(function(b) {
        if (b.id !== 'btn-theme' && b.id !== 'btn-settings') b.classList.remove('on');
    });
    btn.classList.add('on');

    if (ms === 0) {
        state.isRunning = false;
        clearInterval(marketInterval);
    } else {
        if (!state.marketOpen) {
            toast("Market Closed", "Start a new day to resume trading", "error");
            return;
        }
        state.isRunning = true;
        state.speedMs = ms;
        startClock();
    }
}

function tickMinute() {
    state.time++;
    if (state.time > END_TIME) {
        state.time = END_TIME;
        state.isRunning = false;
        state.marketOpen = false;
        clearInterval(marketInterval);
        document.querySelectorAll('.ctrl-btn').forEach(function(b) {
            if (b.id !== 'btn-theme' && b.id !== 'btn-settings') b.classList.remove('on');
        });
        document.getElementById('btn-pause').classList.add('on');
        showDayEndOverlay();
        renderAll();
        return;
    }

    // Price simulation with circuit limits & volume
    var totalChange = 0;
    marketStocks.forEach(function(stock) {
        if (stock.circuitHit) return; // frozen

        var v = stock.vol * VOL_MULTIPLIER;
        var drift = (Math.random() - 0.502) * v * 2;
        var meanRevert = (stock.base - stock.ltp) / stock.base * 0.001;
        var newPrice = stock.ltp * (1 + drift + meanRevert);
        newPrice = parseFloat(Math.max(1, newPrice).toFixed(2));

        // Circuit limit check
        var upperCircuit = stock.open * (1 + CIRCUIT_LIMIT);
        var lowerCircuit = stock.open * (1 - CIRCUIT_LIMIT);

        if (newPrice >= upperCircuit) {
            newPrice = parseFloat(upperCircuit.toFixed(2));
            if (!stock.circuitHit) {
                stock.circuitHit = 'UC';
                toast("CIRCUIT", stock.ticker + " hit upper circuit +" + (CIRCUIT_LIMIT * 100) + "%!", "success");
            }
        } else if (newPrice <= lowerCircuit) {
            newPrice = parseFloat(lowerCircuit.toFixed(2));
            if (!stock.circuitHit) {
                stock.circuitHit = 'LC';
                toast("CIRCUIT", stock.ticker + " hit lower circuit -" + (CIRCUIT_LIMIT * 100) + "%!", "error");
            }
        }

        stock.ltp = newPrice;
        stock.history.push(stock.ltp);
        if (stock.history.length > state.historyLen) stock.history.shift();

        // OHLC candle aggregation
        if (!stock.currentCandle) {
            stock.currentCandle = { o: stock.ltp, h: stock.ltp, l: stock.ltp, c: stock.ltp, ticks: 1 };
        } else {
            if (stock.ltp > stock.currentCandle.h) stock.currentCandle.h = stock.ltp;
            if (stock.ltp < stock.currentCandle.l) stock.currentCandle.l = stock.ltp;
            stock.currentCandle.c = stock.ltp;
            stock.currentCandle.ticks++;
            if (stock.currentCandle.ticks >= state.candlePeriod) {
                stock.ohlcHistory.push({ o: stock.currentCandle.o, h: stock.currentCandle.h, l: stock.currentCandle.l, c: stock.currentCandle.c });
                if (stock.ohlcHistory.length > 80) stock.ohlcHistory.shift();
                stock.currentCandle = null;
            }
        }

        // Volume simulation
        stock.volume += Math.floor(Math.random() * 5000 + 500);

        // Track for NIFTY
        totalChange += (stock.ltp - stock.open) / stock.open;
    });

    // NIFTY index simulation
    var avgChange = totalChange / marketStocks.length;
    state.niftyValue = parseFloat((state.niftyBase * (1 + avgChange * 2)).toFixed(2));
    state.niftyHistory.push(state.niftyValue);
    if (state.niftyHistory.length > state.historyLen) state.niftyHistory.shift();

    // Market sentiment (-100 to +100)
    var gainers = marketStocks.filter(function(s) { return s.ltp >= s.open; }).length;
    state.sentiment = Math.round(((gainers / marketStocks.length) - 0.5) * 200);

    // SL / Target auto-trigger
    Object.keys(state.slTargets).forEach(function(ticker) {
        var st = state.slTargets[ticker];
        if (!st) return;
        var pos = state.positions[ticker];
        if (!pos) { delete state.slTargets[ticker]; return; }
        var stock = marketStocks.find(function(s) { return s.ticker === ticker; });
        if (!stock) return;
        var isLong = pos.qty > 0;
        if (st.sl && isLong && stock.ltp <= st.sl) {
            toast('\u26d4 SL Hit', ticker + ' stop loss triggered @ \u20b9' + stock.ltp.toFixed(2), 'error');
            closeEquityPosition(ticker);
        } else if (st.sl && !isLong && stock.ltp >= st.sl) {
            toast('\u26d4 SL Hit', ticker + ' stop loss triggered @ \u20b9' + stock.ltp.toFixed(2), 'error');
            closeEquityPosition(ticker);
        } else if (st.target && isLong && stock.ltp >= st.target) {
            toast('\u2705 Target Hit', ticker + ' target reached @ \u20b9' + stock.ltp.toFixed(2), 'success');
            closeEquityPosition(ticker);
        } else if (st.target && !isLong && stock.ltp <= st.target) {
            toast('\u2705 Target Hit', ticker + ' target reached @ \u20b9' + stock.ltp.toFixed(2), 'success');
            closeEquityPosition(ticker);
        }
    });

    // News events
    if (Math.random() < NEWS_FREQ) triggerNewsEvent();

    renderAll();
}

// ==================== NEW DAY ====================
function showDayEndOverlay() {
    var pnl = calcTotalPNL();
    var posVal = 0;
    Object.entries(state.positions).forEach(function(entry) {
        var t = entry[0], p = entry[1];
        var s = marketStocks.find(function(x) { return x.ticker === t; });
        if (s) posVal += s.ltp * Math.abs(p.qty);
    });

    document.getElementById('ov-day-label').textContent = 'Day ' + state.day;
    var pnlEl = document.getElementById('ov-day-pnl');
    pnlEl.textContent = fmtCur(pnl);
    pnlEl.className = 'ov-stat-val mono ' + (pnl >= 0 ? 'up' : 'dn');
    document.getElementById('ov-portfolio').textContent = fmtCur(state.margin + posVal);
    document.getElementById('ov-cash').textContent = fmtCur(state.margin);
    document.getElementById('ov-positions').textContent = Object.keys(state.positions).length + Object.keys(state.optionsPositions).length;

    var expiringWeekly = Object.values(state.optionsPositions).filter(function(p) {
        return p.daysToExpiry <= 1 && p.expiryType === 'Weekly';
    });
    if (expiringWeekly.length > 0) {
        document.getElementById('ov-expiry-info').classList.remove('hidden');
        document.getElementById('ov-expiry-text').textContent = expiringWeekly.length + ' weekly option(s) will expire and be auto-settled.';
    } else {
        document.getElementById('ov-expiry-info').classList.add('hidden');
    }

    document.getElementById('day-overlay').classList.remove('hidden');
}

function startNewDay() {
    document.getElementById('day-overlay').classList.add('hidden');

    state.day++;
    state.time = START_TIME;
    state.marketOpen = true;
    state.isRunning = true;

    settleExpiredOptions();

    Object.values(state.optionsPositions).forEach(function(p) {
        p.daysToExpiry = Math.max(0, p.daysToExpiry - 1);
    });

    // Overnight gap
    marketStocks.forEach(function(stock) {
        stock.prevClose = stock.ltp;  // save previous day's close
        var overnightChange = (Math.random() - 0.5) * 0.02;
        stock.ltp = parseFloat((stock.ltp * (1 + overnightChange)).toFixed(2));
        stock.open = stock.ltp;
        stock.base = stock.ltp;
        stock.volume = 0;
        stock.circuitHit = null;
        var keepPoints = Math.min(375, stock.history.length);
        var kept = stock.history.slice(-keepPoints);
        var fill = Array(state.historyLen - keepPoints).fill(stock.ltp);
        stock.history = fill.concat(kept);
        stock.history.push(stock.ltp);
        if (stock.history.length > state.historyLen) stock.history.shift();
        stock.ohlcHistory = [];
        stock.currentCandle = null;
    });

    // Reset NIFTY for new day
    state.niftyBase = state.niftyValue;
    state.niftyHistory = Array(state.historyLen).fill(state.niftyValue);
    state.sentiment = 0;
    state.slTargets = {};

    document.getElementById('day-counter').textContent = 'Day ' + state.day;
    state.newsCount = 0;
    document.getElementById('news-count').textContent = '0';

    var container = document.getElementById('news-container');
    var el = document.createElement('div');
    el.className = 'news-item';
    el.innerHTML = '<span class="news-time mono">09:15</span><span class="news-text">\u2014 DAY ' + state.day + ' \u2014 Market session opened. Overnight gaps applied.</span>';
    container.prepend(el);

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    document.querySelectorAll('.ctrl-btn').forEach(function(b) {
        if (b.id !== 'btn-theme' && b.id !== 'btn-settings') b.classList.remove('on');
    });
    document.getElementById('btn-play').classList.add('on');

    renderAll();
    startClock();
    toast('Day ' + state.day, 'New trading day started! Good luck.', 'success');
}

function settleExpiredOptions() {
    var expired = [];
    Object.entries(state.optionsPositions).forEach(function(entry) {
        var id = entry[0], pos = entry[1];
        if (pos.daysToExpiry <= 1) {
            var stock = marketStocks.find(function(s) { return s.ticker === pos.ticker; });
            if (!stock) return;

            var intrinsic = pos.type === 'CALL'
                ? Math.max(0, stock.ltp - pos.strike)
                : Math.max(0, pos.strike - stock.ltp);
            var totalQty = pos.lots * pos.lotSize;
            var settlementValue = intrinsic * totalQty;
            var costBasis = pos.avgPremium * totalQty;
            var pnl = settlementValue - costBasis;

            state.margin += settlementValue;
            expired.push({ id: id, ticker: pos.ticker, type: pos.type, strike: pos.strike, pnl: pnl });
            delete state.optionsPositions[id];
        }
    });

    if (expired.length > 0) {
        var totalPnl = expired.reduce(function(sum, e) { return sum + e.pnl; }, 0);
        toast('Options Expired',
            expired.length + ' option(s) settled. P&L: ' + fmtCur(totalPnl),
            totalPnl >= 0 ? 'success' : 'error'
        );
    }
}

// ==================== NEWS ====================
function triggerNewsEvent() {
    var ev = newsEvents[Math.floor(Math.random() * newsEvents.length)];
    var text = ev.text;
    var result = getNewsTargets(ev.target);

    if (result.name) text = text.replace("{name}", result.name);

    // Apply impact with volatility multiplier
    var impact = ev.impact * VOL_MULTIPLIER;
    result.stocks.forEach(function(s) {
        if (s.circuitHit) return; // skip frozen stocks
        var newPrice = parseFloat((s.ltp * (1 + impact)).toFixed(2));
        var upperCircuit = s.open * (1 + CIRCUIT_LIMIT);
        var lowerCircuit = s.open * (1 - CIRCUIT_LIMIT);
        if (newPrice >= upperCircuit) {
            newPrice = parseFloat(upperCircuit.toFixed(2));
            s.circuitHit = 'UC';
        } else if (newPrice <= lowerCircuit) {
            newPrice = parseFloat(lowerCircuit.toFixed(2));
            s.circuitHit = 'LC';
        }
        s.ltp = newPrice;
        // News causes volume spike
        s.volume += Math.floor(Math.random() * 20000 + 5000);
    });

    // Update sentiment
    state.sentiment += Math.round(impact * 500);
    state.sentiment = Math.max(-100, Math.min(100, state.sentiment));

    state.newsCount++;
    document.getElementById('news-count').textContent = state.newsCount;

    var container = document.getElementById('news-container');
    var el = document.createElement('div');
    el.className = 'news-item ' + (impact >= 0 ? 'positive' : 'negative');
    el.innerHTML = '<span class="news-time">' + formatTime(state.time) + '</span><span class="news-text">' + text + '</span>';
    container.prepend(el);
    if (container.children.length > 100) container.removeChild(container.lastChild);

    toast("NEWS", text, impact >= 0 ? 'success' : 'error');
}

// ==================== TRADING ====================
function executeTrade(side) {
    if (!state.activeStock || !state.marketOpen) {
        if (!state.marketOpen) toast("Error", "Market is closed. Start a new day!", "error");
        return;
    }

    var stock = state.activeStock;

    // Block trading if circuit hit
    if (stock.circuitHit === 'UC' && side === 'BUY') {
        toast("Circuit", "Cannot BUY " + stock.ticker + " - Upper Circuit hit!", "error");
        return;
    }
    if (stock.circuitHit === 'LC' && side === 'SELL') {
        toast("Circuit", "Cannot SELL " + stock.ticker + " - Lower Circuit hit!", "error");
        return;
    }

    var qty = parseInt(document.getElementById('order-qty').value);
    if (isNaN(qty) || qty <= 0) { toast("Error", "Invalid quantity", "error"); return; }

    var price = stock.ltp;
    var cost = price * qty;
    var pos = state.positions[stock.ticker] || { qty: 0, avgPrice: 0 };
    var tradeType = '';

    if (side === 'BUY') {
        if (pos.qty < 0) {
            var coverQty = Math.min(qty, Math.abs(pos.qty));
            var pnl = (pos.avgPrice - price) * coverQty;
            state.margin += pnl;
            pos.qty += coverQty;

            var remaining = qty - coverQty;
            if (remaining > 0) {
                var addCost = price * remaining;
                if (state.margin < addCost) { toast("Error", "Insufficient margin", "error"); return; }
                if (pos.qty === 0) pos.avgPrice = price;
                var totalCost = pos.avgPrice * pos.qty + price * remaining;
                pos.qty += remaining;
                pos.avgPrice = totalCost / pos.qty;
                state.margin -= addCost;
            }
            if (pos.qty === 0) pos.avgPrice = 0;
            tradeType = 'COVER';
            toast("Covered", 'Covered ' + coverQty + ' ' + stock.ticker + ' @ \u20b9' + price, 'success');
        } else {
            if (state.margin < cost) { toast("Error", "Insufficient margin for BUY", "error"); return; }
            var totalCost2 = (pos.qty * pos.avgPrice) + cost;
            pos.qty += qty;
            pos.avgPrice = totalCost2 / pos.qty;
            state.margin -= cost;
            tradeType = 'BUY';
            toast("BUY", 'Bought ' + qty + ' ' + stock.ticker + ' @ \u20b9' + price, 'success');
        }
    } else {
        if (pos.qty > 0) {
            var sellQty = Math.min(qty, pos.qty);
            state.margin += price * sellQty;
            pos.qty -= sellQty;

            var remaining2 = qty - sellQty;
            if (remaining2 > 0) {
                var shortMargin = price * remaining2 * 0.2;
                if (state.margin < shortMargin) { toast("Error", "Insufficient margin for short", "error"); return; }
                pos.qty -= remaining2;
                pos.avgPrice = price;
                state.margin -= shortMargin;
                tradeType = 'SHORT';
                toast("SHORT", 'Shorted ' + remaining2 + ' ' + stock.ticker + ' @ \u20b9' + price, 'error');
            } else {
                tradeType = 'SELL';
                toast("SELL", 'Sold ' + sellQty + ' ' + stock.ticker + ' @ \u20b9' + price, 'error');
            }
            if (pos.qty === 0) pos.avgPrice = 0;
        } else {
            var shortMargin2 = price * qty * 0.2;
            if (state.margin < shortMargin2) { toast("Error", "Insufficient margin for short", "error"); return; }
            if (pos.qty === 0) {
                pos.avgPrice = price;
                pos.qty = -qty;
            } else {
                var totalVal = Math.abs(pos.qty) * pos.avgPrice + qty * price;
                pos.qty -= qty;
                pos.avgPrice = totalVal / Math.abs(pos.qty);
            }
            state.margin -= shortMargin2;
            tradeType = 'SHORT';
            toast("SHORT", 'Shorted ' + qty + ' ' + stock.ticker + ' @ \u20b9' + price, 'error');
        }
    }

    // Record trade history
    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: stock.ticker,
        side: tradeType || side,
        type: 'Equity',
        qty: qty,
        price: price,
        value: cost
    });

    // Add to volume
    stock.volume += qty * 100;

    if (pos.qty === 0) {
        delete state.positions[stock.ticker];
    } else {
        state.positions[stock.ticker] = pos;
    }

    document.getElementById('order-qty').value = 1;
    renderAll();
}

// ==================== OPTIONS ====================
function getExpiryDays() {
    var sel = document.getElementById('expiry-date');
    return sel.value === 'Monthly' ? 20 : 5;
}

function generateStrikes(ltp) {
    var step = ltp > 5000 ? 100 : ltp > 1000 ? 50 : ltp > 200 ? 10 : 5;
    var base = Math.round(ltp / step) * step;
    var strikes = [];
    for (var i = -5; i <= 5; i++) strikes.push(base + i * step);
    return strikes;
}

function calcPremium(type, strike, ltp, days) {
    if (days === undefined) days = getExpiryDays();
    var intrinsic = type === 'CALL' ? Math.max(0, ltp - strike) : Math.max(0, strike - ltp);
    var timeVal = Math.sqrt(Math.max(0.01, days) / 252) * ltp * 0.20;
    return Math.max(0.5, intrinsic + timeVal);
}

function updateStrikesAndPremium() {
    if (!state.activeStock) return;
    var stock = state.activeStock;
    var strikes = generateStrikes(stock.ltp);
    var sel = document.getElementById('strike-price');
    var optType = document.getElementById('option-type').value;
    var days = getExpiryDays();

    sel.innerHTML = '';
    strikes.forEach(function(s) {
        var prem = calcPremium(optType, s, stock.ltp, days);
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + ' (\u20b9' + prem.toFixed(2) + ')';
        sel.appendChild(opt);
    });
    var atm = strikes.find(function(s) { return s >= stock.ltp; }) || strikes[5];
    sel.value = atm;
    updateOptionMargin();
}

function updateOptionMargin() {
    if (!state.activeStock) return;
    var stock = state.activeStock;
    var optType = document.getElementById('option-type').value;
    var strike = parseFloat(document.getElementById('strike-price').value);
    var lots = parseInt(document.getElementById('option-lots').value) || 0;
    var lotSize = LOT_SIZES[stock.ticker] || 100;
    var totalQty = lots * lotSize;
    var days = getExpiryDays();
    var premium = calcPremium(optType, strike, stock.ltp, days);
    var req = premium * totalQty;

    document.getElementById('option-premium').textContent = '\u20b9 ' + premium.toFixed(2);
    document.getElementById('lot-size').textContent = lotSize;
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('req-margin-opt').textContent = fmtCur(req);
}

function executeOptionTrade(side) {
    if (!state.activeStock || !state.marketOpen) {
        if (!state.marketOpen) toast("Error", "Market is closed. Start a new day!", "error");
        return;
    }
    var stock = state.activeStock;
    var optType = document.getElementById('option-type').value;
    var strike = parseFloat(document.getElementById('strike-price').value);
    var expiryType = document.getElementById('expiry-date').value;
    var days = getExpiryDays();
    var lots = parseInt(document.getElementById('option-lots').value) || 0;
    var lotSize = LOT_SIZES[stock.ticker] || 100;
    var totalQty = lots * lotSize;

    if (lots <= 0) { toast("Error", "Invalid lot count", "error"); return; }

    var premium = calcPremium(optType, strike, stock.ltp, days);
    var cost = premium * totalQty;
    var optionId = stock.ticker + '_' + optType + '_' + strike + '_' + expiryType;

    if (side === 'BUY') {
        if (state.margin < cost) { toast("Error", "Insufficient margin", "error"); return; }
        var pos = state.optionsPositions[optionId] || {
            ticker: stock.ticker, type: optType, strike: strike, expiryType: expiryType,
            daysToExpiry: days, lots: 0, avgPremium: 0, lotSize: lotSize
        };
        var oldTotal = pos.lots * pos.lotSize * pos.avgPremium;
        pos.lots += lots;
        pos.avgPremium = (oldTotal + cost) / (pos.lots * pos.lotSize);
        state.optionsPositions[optionId] = pos;
        state.margin -= cost;
        toast("Option BUY", lots + 'L ' + stock.ticker + ' ' + optType + ' ' + strike + ' ' + expiryType, 'success');
    } else {
        var pos2 = state.optionsPositions[optionId];
        if (!pos2 || pos2.lots < lots) { toast("Error", "Insufficient option holdings", "error"); return; }
        state.margin += premium * totalQty;
        pos2.lots -= lots;
        if (pos2.lots === 0) delete state.optionsPositions[optionId];
        toast("Option SELL", lots + 'L ' + stock.ticker + ' ' + optType + ' ' + strike + ' ' + expiryType, 'error');
    }

    // Record trade
    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: stock.ticker,
        side: side,
        type: optType + ' ' + strike + ' ' + expiryType,
        qty: totalQty,
        price: premium,
        value: cost
    });

    document.getElementById('option-lots').value = 1;
    renderAll();
}

// ==================== RENDER ====================
function renderAll() {
    renderTopBar();
    renderWatchlist();
    renderActiveStock();
    renderPositionsTable();
    if (state.activeBottomTab === 'options') renderOptionsTable();
    if (state.activeBottomTab === 'history') renderHistoryTable();
}

function renderTopBar() {
    document.getElementById('market-time').textContent = formatTime(state.time);
    document.getElementById('cash-balance').textContent = fmtCur(state.margin);
    document.getElementById('day-counter').textContent = 'Day ' + state.day;

    // NIFTY
    var niftyChg = state.niftyValue - state.niftyBase;
    var niftyPct = ((niftyChg / state.niftyBase) * 100).toFixed(2);
    var niftyEl = document.getElementById('nifty-value');
    niftyEl.textContent = state.niftyValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    niftyEl.className = 'stat-val mono ' + (niftyChg >= 0 ? 'up' : 'dn');

    // Sentiment
    var sentEl = document.getElementById('market-sentiment');
    var sentIcon, sentText, sentClass;
    if (state.sentiment > 30) {
        sentIcon = 'fa-solid fa-arrow-trend-up';
        sentText = ' Bullish';
        sentClass = 'up';
    } else if (state.sentiment > 10) {
        sentIcon = 'fa-solid fa-arrow-up';
        sentText = ' Mildly Bull';
        sentClass = 'up';
    } else if (state.sentiment < -30) {
        sentIcon = 'fa-solid fa-arrow-trend-down';
        sentText = ' Bearish';
        sentClass = 'dn';
    } else if (state.sentiment < -10) {
        sentIcon = 'fa-solid fa-arrow-down';
        sentText = ' Mildly Bear';
        sentClass = 'dn';
    } else {
        sentIcon = 'fa-solid fa-minus';
        sentText = ' Neutral';
        sentClass = '';
    }
    sentEl.innerHTML = '<i class="' + sentIcon + '"></i>' + sentText;
    sentEl.className = 'stat-val mono ' + sentClass;

    // PnL
    var pnl = calcTotalPNL();
    var elPnl = document.getElementById('total-pnl');
    elPnl.textContent = fmtCur(pnl);
    elPnl.className = 'stat-val mono ' + (pnl > 0 ? 'up' : pnl < 0 ? 'dn' : '');

    // Portfolio
    var posVal = 0;
    Object.entries(state.positions).forEach(function(entry) {
        var t = entry[0], p = entry[1];
        var s = marketStocks.find(function(x) { return x.ticker === t; });
        if (s) posVal += s.ltp * Math.abs(p.qty);
    });
    document.getElementById('portfolio-value').textContent = fmtCur(state.margin + posVal);
}

function renderWatchlist() {
    var list = document.getElementById('watchlist');
    list.innerHTML = '';
    marketStocks.forEach(function(s) {
        var dayChange = ((s.ltp - s.open) / s.open * 100);
        var cls = dayChange >= 0 ? 'up' : 'dn';
        var row = document.createElement('div');
        row.className = 'wl-row' + (state.activeStock === s ? ' active' : '');
        row.onclick = function() { selectStock(s); };

        var circuitBadge = '';
        if (s.circuitHit === 'UC') circuitBadge = '<span class="circuit-badge uc">UC</span>';
        else if (s.circuitHit === 'LC') circuitBadge = '<span class="circuit-badge lc">LC</span>';

        var maxVol = 200000;
        var volPct = Math.min(100, (s.volume / maxVol) * 100);

        row.innerHTML = '<div style="flex:1.5"><span class="wl-sym">' + s.ticker + circuitBadge + '</span>' +
            '<div class="wl-sector">' + s.sector + '</div>' +
            '<div class="vol-bar"><div class="vol-fill" style="width:' + volPct + '%"></div></div></div>' +
            '<span class="wl-ltp ' + cls + '">' + s.ltp.toFixed(2) + '</span>' +
            '<span class="wl-chg ' + cls + '">' + (dayChange >= 0 ? '+' : '') + dayChange.toFixed(2) + '%</span>';
        list.appendChild(row);
    });
}

function selectStock(stock) {
    if (!stock) return;
    state.activeStock = stock;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    renderAll();
    if (state.activeTab === 'options') updateStrikesAndPremium();
}

function renderActiveStock() {
    var stock = state.activeStock;
    if (!stock) return;

    document.getElementById('active-symbol').textContent = stock.ticker;
    document.getElementById('active-name').textContent = stock.name + ' \u00b7 ' + stock.sector;
    document.getElementById('order-symbol').textContent = stock.ticker;

    var dayChg = stock.ltp - stock.open;
    var dayPct = (dayChg / stock.open * 100);
    var isUp = dayChg >= 0;

    var elPrice = document.getElementById('active-price');
    elPrice.textContent = stock.ltp.toFixed(2);
    elPrice.className = 'ct-price mono ' + (isUp ? 'up' : 'dn');

    var elChg = document.getElementById('active-change');
    var volStr = ' | Vol: ' + formatVolume(stock.volume);
    var circuitStr = stock.circuitHit ? ' | ' + stock.circuitHit : '';
    elChg.textContent = (isUp ? '+' : '') + dayChg.toFixed(2) + ' (' + dayPct.toFixed(2) + '%)' + volStr + circuitStr;
    elChg.className = 'ct-change mono ' + (isUp ? 'up' : 'dn');

    var elPrev = document.getElementById('active-prev-close');
    if (elPrev) {
        if (stock.prevClose) {
            var chgFromPrev = stock.ltp - stock.prevClose;
            var pctFromPrev = (chgFromPrev / stock.prevClose * 100);
            elPrev.textContent = 'Prev Close: \u20b9' + stock.prevClose.toFixed(2) +
                '  (' + (chgFromPrev >= 0 ? '+' : '') + pctFromPrev.toFixed(2) + '% from prev)';
            elPrev.className = 'ct-prev-close mono ' + (chgFromPrev >= 0 ? 'up' : 'dn');
        } else {
            elPrev.textContent = '';
        }
    }

    renderChart(stock);
    updateOrderMargin();
    renderPositionCard(stock);

    // Populate SL / Target fields for active stock
    var st = state.slTargets[stock.ticker];
    document.getElementById('sl-price').value     = (st && st.sl)     ? st.sl     : '';
    document.getElementById('target-price').value = (st && st.target) ? st.target : '';
}

function formatVolume(v) {
    if (v >= 10000000) return (v / 10000000).toFixed(2) + 'Cr';
    if (v >= 100000) return (v / 100000).toFixed(2) + 'L';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toString();
}

// ==================== CANDLE DATA BUILDER ====================
function buildCandleData(stock) {
    var candles = [];
    var period = state.candlePeriod;
    var hist = stock.history.slice(-state.viewLen);
    for (var i = 0; i < hist.length; i += period) {
        var slice = hist.slice(i, i + period);
        if (slice.length < 1) break;
        candles.push({
            x: candles.length,
            o: slice[0],
            h: Math.max.apply(null, slice),
            l: Math.min.apply(null, slice),
            c: slice[slice.length - 1]
        });
    }
    return candles;
}

// Fast in-place data mutator — never destroys the chart instance
function _applyChartData(stock, isLight) {
    var ds   = chartInstance.data.datasets[0];
    var scX  = chartInstance.options.scales.x;
    var scY  = chartInstance.options.scales.y;
    var tip  = chartInstance.options.plugins.tooltip;

    if (state.chartType === 'candle') {
        var ohlcData = buildCandleData(stock);
        var allH = ohlcData.map(function(d) { return d.h; });
        var allL = ohlcData.map(function(d) { return d.l; });
        var yMax = allH.length ? Math.max.apply(null, allH) : 0;
        var yMin = allL.length ? Math.min.apply(null, allL) : 0;
        var yPad = (yMax - yMin) * 0.05 || yMin * 0.01 || 1;

        chartInstance.data.labels      = ohlcData.map(function(_, i) { return i; });
        ds.data                        = ohlcData.map(function(d) { return d.c; });
        ds.borderColor                 = 'transparent';
        ds.backgroundColor             = 'transparent';
        ds.fill                        = false;
        ds.tension                     = 0;
        ds.pointHoverRadius            = 0;
        chartInstance._ohlc            = ohlcData;
        scY.min = yMin - yPad;
        scY.max = yMax + yPad;

        // Prev close line (candle mode)
        var ds2c = chartInstance.data.datasets[1];
        if (stock.prevClose && ohlcData.length) {
            ds2c.data = Array(ohlcData.length).fill(stock.prevClose);
            ds2c.hidden = false;
        } else {
            ds2c.data = [];
            ds2c.hidden = true;
        }

        tip.callbacks = {
            title: function() { return state.activeStock ? state.activeStock.ticker : ''; },
            label: function(tCtx) {
                var cd = tCtx.chart._ohlc;
                var d  = cd && cd[tCtx.dataIndex];
                if (!d) return '';
                return [
                    'O: \u20b9' + d.o.toFixed(2),
                    'H: \u20b9' + d.h.toFixed(2),
                    'L: \u20b9' + d.l.toFixed(2),
                    'C: \u20b9' + d.c.toFixed(2)
                ];
            }
        };
    } else {
        var lineSlice  = stock.history.slice(-state.viewLen);
        var lastPrice  = lineSlice[lineSlice.length - 1] || 0;
        var firstPrice = lineSlice[0] || 0;
        var lineColor  = lastPrice >= firstPrice
            ? (isLight ? '#00a846' : '#00c853')
            : (isLight ? '#d50032' : '#ff1744');

        chartInstance.data.labels   = lineSlice.map(function(_, i) { return i; });
        ds.data                     = lineSlice;
        ds.borderColor              = lineColor;
        ds.pointHoverBackgroundColor = lineColor;
        ds.fill                     = true;
        ds.tension                  = lineSlice.length > 60 ? 0 : 0.3;
        ds.pointHoverRadius         = 4;
        chartInstance._ohlc         = null;
        scY.min = undefined;
        scY.max = undefined;

        // Prev close dashed reference line
        var ds2 = chartInstance.data.datasets[1];
        if (stock.prevClose && lineSlice.length) {
            ds2.data   = Array(lineSlice.length).fill(stock.prevClose);
            ds2.hidden = false;
        } else {
            ds2.data   = [];
            ds2.hidden = true;
        }

        // Pre-compute gradient from existing chartArea (avoids per-frame callback overhead)
        var area = chartInstance.chartArea;
        if (area) {
            var grad = chartInstance.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            grad.addColorStop(0, lineColor + '30');
            grad.addColorStop(1, lineColor + '02');
            ds.backgroundColor = grad;
        } else {
            ds.backgroundColor = lineColor + '15';
        }

        tip.callbacks = {
            title: function() { return state.activeStock ? state.activeStock.ticker : ''; },
            label: function(tCtx) { return '\u20b9 ' + tCtx.parsed.y.toFixed(2); }
        };
    }

    // Theme colours
    scX.grid.color        = isLight ? '#f0f0f0' : 'rgba(255,255,255,0.02)';
    scY.grid.color        = isLight ? '#e0e0e0' : 'rgba(255,255,255,0.04)';
    scY.ticks.color       = isLight ? '#666'    : '#6b7080';
    tip.backgroundColor   = isLight ? '#fff'    : '#1a1a26';
    tip.titleColor        = isLight ? '#333'    : '#eee';
    tip.bodyColor         = isLight ? '#333'    : '#ccc';
    tip.borderColor       = isLight ? '#ddd'    : '#333';

    chartInstance.update('none');
}

function renderChart(stock) {
    var canvas  = document.getElementById('main-chart');
    var ctx     = canvas.getContext('2d');
    var isLight = state.theme === 'light';

    // Fast path — chart already exists, just mutate data in-place
    if (chartInstance) {
        _applyChartData(stock, isLight);
        return;
    }

    // Create the single chart instance (used for BOTH line and candle modes)
    chartInstance = new Chart(ctx, {
        type: 'line',
        plugins: [candlestickPlugin],
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }, {
                // Prev close reference line
                data: [],
                borderWidth: 1.5,
                borderDash: [6, 4],
                borderColor: 'rgba(255, 165, 0, 0.7)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    filter: function(item) { return item.datasetIndex === 0; },
                    callbacks: {}
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { drawBorder: false },
                    ticks: { display: false }
                },
                y: {
                    display: true,
                    position: 'right',
                    grid: { drawBorder: false },
                    ticks: {
                        font: { family: 'JetBrains Mono', size: 10 },
                        padding: 8,
                        maxTicksLimit: 8,
                        callback: function(v) { return '\u20b9' + v.toFixed(0); }
                    }
                }
            },
            interaction: { mode: 'index', axis: 'x', intersect: false },
            hover: { mode: 'index', intersect: false }
        }
    });

    _applyChartData(stock, isLight);
}

function updateOrderMargin() {
    if (!state.activeStock) return;
    var qty = parseInt(document.getElementById('order-qty').value) || 0;
    var req = state.activeStock.ltp * qty;
    document.getElementById('req-margin').textContent = fmtCur(req);
}

function renderPositionCard(stock) {
    var pos = state.positions[stock.ticker];
    if (!pos) {
        document.getElementById('pos-qty').textContent = '0';
        document.getElementById('pos-avg').textContent = '0.00';
        document.getElementById('pos-ltp').textContent = stock.ltp.toFixed(2);
        var pnlEl = document.getElementById('pos-pnl');
        pnlEl.textContent = '\u20b9 0.00';
        pnlEl.className = 'pc-val mono';
        return;
    }

    var pnl = pos.qty > 0
        ? (stock.ltp - pos.avgPrice) * pos.qty
        : (pos.avgPrice - stock.ltp) * Math.abs(pos.qty);

    document.getElementById('pos-qty').textContent = pos.qty;
    document.getElementById('pos-avg').textContent = pos.avgPrice.toFixed(2);
    document.getElementById('pos-ltp').textContent = stock.ltp.toFixed(2);
    var pnlEl2 = document.getElementById('pos-pnl');
    pnlEl2.textContent = (pnl >= 0 ? '+' : '') + fmtCur(pnl);
    pnlEl2.className = 'pc-val mono ' + (pnl >= 0 ? 'up' : 'dn');
}

// ==================== CLOSE POSITION HELPERS ====================
function closeEquityPosition(ticker, silent) {
    var pos = state.positions[ticker];
    var stock = marketStocks.find(function(s) { return s.ticker === ticker; });
    if (!pos || !stock) return;

    var absQty = Math.abs(pos.qty);
    var price = stock.ltp;
    var isShort = pos.qty < 0;
    var pnl = isShort ? (pos.avgPrice - price) * absQty : (price - pos.avgPrice) * absQty;

    if (isShort) {
        state.margin += pos.avgPrice * absQty * 0.2 + pnl;
    } else {
        state.margin += price * absQty;
    }

    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: ticker,
        side: isShort ? 'COVER' : 'SELL',
        type: 'Equity',
        qty: absQty,
        price: price,
        value: price * absQty
    });

    delete state.positions[ticker];
    delete state.slTargets[ticker];
    stock.volume += absQty * 100;

    if (state.activeStock && state.activeStock.ticker === ticker) {
        document.getElementById('sl-price').value = '';
        document.getElementById('target-price').value = '';
    }

    if (!silent) {
        toast('Closed', ticker + ' position closed @ \u20b9' + price.toFixed(2) + '  P&L: ' + (pnl >= 0 ? '+' : '') + fmtCur(pnl), pnl >= 0 ? 'success' : 'error');
        renderAll();
    }
}

function closeOptionPosition(id, silent) {
    var pos = state.optionsPositions[id];
    var stock = marketStocks.find(function(s) { return s.ticker === pos.ticker; });
    if (!pos || !stock) return;

    var curPrem = calcPremium(pos.type, pos.strike, stock.ltp, pos.daysToExpiry);
    var totalQty = pos.lots * pos.lotSize;
    var pnl = (curPrem - pos.avgPremium) * totalQty;
    state.margin += curPrem * totalQty;

    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: pos.ticker,
        side: 'SELL',
        type: pos.type + ' OPT',
        qty: totalQty,
        price: curPrem,
        value: curPrem * totalQty
    });

    delete state.optionsPositions[id];
    if (!silent) {
        toast('Closed', pos.ticker + ' ' + pos.type + ' ' + pos.strike + ' @ \u20b9' + curPrem.toFixed(2) + '  P&L: ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2), pnl >= 0 ? 'success' : 'error');
        renderAll();
    }
}

function closeAllPositions() {
    var equityKeys = Object.keys(state.positions);
    var optionKeys = Object.keys(state.optionsPositions);
    if (equityKeys.length === 0 && optionKeys.length === 0) {
        toast('Info', 'No open positions to close', 'info');
        return;
    }
    var count = equityKeys.length + optionKeys.length;
    optionKeys.slice().forEach(function(id) { closeOptionPosition(id, true); });
    equityKeys.slice().forEach(function(t) { closeEquityPosition(t, true); });
    toast('Closed All', count + ' position(s) squared off at market price', 'success');
    renderAll();
}

function saveSlTarget() {
    if (!state.activeStock) return;
    var ticker = state.activeStock.ticker;
    var sl = parseFloat(document.getElementById('sl-price').value);
    var tgt = parseFloat(document.getElementById('target-price').value);
    state.slTargets[ticker] = {
        sl:     isNaN(sl)  || sl  <= 0 ? null : sl,
        target: isNaN(tgt) || tgt <= 0 ? null : tgt
    };
    var msg = [];
    if (state.slTargets[ticker].sl)     msg.push('SL \u20b9' + sl.toFixed(2));
    if (state.slTargets[ticker].target) msg.push('Target \u20b9' + tgt.toFixed(2));
    if (msg.length) toast('Alert Set', ticker + ': ' + msg.join(', '), 'info');
}

function renderPositionsTable() {
    var tbody = document.getElementById('positions-tbody');
    var keys = Object.keys(state.positions);

    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty">No open positions</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    keys.forEach(function(ticker) {
        var pos = state.positions[ticker];
        var stock = marketStocks.find(function(s) { return s.ticker === ticker; });
        if (!stock) return;

        var isShort = pos.qty < 0;
        var absQty = Math.abs(pos.qty);
        var curVal = absQty * stock.ltp;
        var pnl = isShort
            ? (pos.avgPrice - stock.ltp) * absQty
            : (stock.ltp - pos.avgPrice) * absQty;
        var pnlPct = ((pnl / (pos.avgPrice * absQty)) * 100).toFixed(2);
        var pnlCls = pnl >= 0 ? 'up' : 'dn';
        var hasSl = state.slTargets[ticker] && (state.slTargets[ticker].sl || state.slTargets[ticker].target);

        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Click to select ' + ticker;
        tr.innerHTML =
            '<td class="sym-cell">' + ticker + (hasSl ? ' <i class="fa-solid fa-bell" style="font-size:9px;color:var(--orange)"></i>' : '') + '</td>' +
            '<td class="' + (isShort ? 'side-short' : 'side-long') + '">' + (isShort ? 'SHORT' : 'LONG') + '</td>' +
            '<td>MIS</td>' +
            '<td class="r">' + pos.qty + '</td>' +
            '<td class="r">' + pos.avgPrice.toFixed(2) + '</td>' +
            '<td class="r">' + stock.ltp.toFixed(2) + '</td>' +
            '<td class="r">' + fmtCur(curVal) + '</td>' +
            '<td class="r ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + fmtCur(pnl) + '</td>' +
            '<td class="r ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + pnlPct + '%</td>' +
            '<td class="r"><button class="btn-close-pos" onclick="event.stopPropagation();closeEquityPosition(\'' + ticker + '\')" title="Close position">&#x2715; Close</button></td>';
        tr.onclick = function() {
            var s = marketStocks.find(function(x) { return x.ticker === ticker; });
            if (s) selectStock(s);
        };
        tbody.appendChild(tr);
    });
}

function renderOptionsTable() {
    var tbody = document.getElementById('options-tbody');
    var keys = Object.keys(state.optionsPositions);

    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty">No option positions</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    keys.forEach(function(id) {
        var pos = state.optionsPositions[id];
        var stock = marketStocks.find(function(s) { return s.ticker === pos.ticker; });
        if (!stock) return;

        var curPrem = calcPremium(pos.type, pos.strike, stock.ltp, pos.daysToExpiry);
        var totalQty = pos.lots * pos.lotSize;
        var pnl = (curPrem - pos.avgPremium) * totalQty;
        var cls = pnl >= 0 ? 'up' : 'dn';

        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Click to select ' + pos.ticker;
        tr.innerHTML = '<td class="sym-cell">' + pos.ticker + '</td>' +
            '<td>' + pos.type + '</td>' +
            '<td class="r">' + pos.strike + '</td>' +
            '<td>' + pos.expiryType + ' (' + pos.daysToExpiry + 'd)</td>' +
            '<td class="r">' + pos.lots + '</td>' +
            '<td class="r">' + totalQty + '</td>' +
            '<td class="r">' + pos.avgPremium.toFixed(2) + '</td>' +
            '<td class="r">' + curPrem.toFixed(2) + '</td>' +
            '<td class="r ' + cls + '">' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '</td>' +
            '<td class="r"><button class="btn-close-pos" onclick="event.stopPropagation();closeOptionPosition(\'' + id + '\')" title="Close option">&#x2715; Close</button></td>';
        tr.onclick = function() {
            var s = marketStocks.find(function(x) { return x.ticker === pos.ticker; });
            if (s) selectStock(s);
        };
        tbody.appendChild(tr);
    });
}

function renderHistoryTable() {
    var tbody = document.getElementById('history-tbody');

    if (state.tradeHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No trades yet</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    state.tradeHistory.forEach(function(trade) {
        var sideClass = (trade.side === 'BUY' || trade.side === 'COVER') ? 'side-long' : 'side-short';
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="mono">' + trade.time + '</td>' +
            '<td>Day ' + trade.day + '</td>' +
            '<td class="sym-cell">' + trade.ticker + '</td>' +
            '<td class="' + sideClass + '">' + trade.side + '</td>' +
            '<td>' + trade.type + '</td>' +
            '<td class="r">' + trade.qty + '</td>' +
            '<td class="r">' + trade.price.toFixed(2) + '</td>' +
            '<td class="r">' + fmtCur(trade.value) + '</td>';
        tbody.appendChild(tr);
    });
}

// ==================== UTILS ====================
function calcTotalPNL() {
    var total = 0;
    Object.entries(state.positions).forEach(function(entry) {
        var t = entry[0], p = entry[1];
        var s = marketStocks.find(function(x) { return x.ticker === t; });
        if (!s) return;
        total += p.qty > 0
            ? (s.ltp - p.avgPrice) * p.qty
            : (p.avgPrice - s.ltp) * Math.abs(p.qty);
    });
    Object.values(state.optionsPositions).forEach(function(p) {
        var s = marketStocks.find(function(x) { return x.ticker === p.ticker; });
        if (!s) return;
        var cur = calcPremium(p.type, p.strike, s.ltp, p.daysToExpiry);
        total += (cur - p.avgPremium) * p.lots * p.lotSize;
    });
    return total;
}

function fmtCur(n) {
    return '\u20b9 ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0') + ' ' + ampm;
}

function toast(title, msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span class="toast-title">' + title + '</span><span class="toast-msg">' + msg + '</span>';
    container.appendChild(el);
    setTimeout(function() {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = '0.2s';
        setTimeout(function() { el.remove(); }, 200);
    }, 3000);
}
