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

// Currency exchange rates: 1 unit of foreign currency = X INR  (Feb 28, 2026)
var EXCHANGE_RATES = { INR: 1, USD: 91.03, CNY: 13.28, JPY: 0.583, HKD: 11.67, GBP: 115.50, EUR: 98.50, AUD: 54.20, CAD: 61.30, CHF: 102.40 };

var TIMEFRAMES = [
    { label: '5M',   viewLen: 5,    candlePeriod: 1   },
    { label: '15M',  viewLen: 15,   candlePeriod: 3   },
    { label: '30M',  viewLen: 30,   candlePeriod: 5   },
    { label: '1H',   viewLen: 60,   candlePeriod: 10  },
    { label: 'Day',  viewLen: 375,  candlePeriod: 15  },
    { label: 'Week', viewLen: 1875, candlePeriod: 75  },
    { label: '1M',   viewLen: 8250, candlePeriod: 375 }  // 22 trading days
];

// ==================== PRE-HISTORY GENERATOR ====================
// Generates 22 days × 375 ticks of realistic price history using a seeded LCG PRNG
// so each stock always gets the same deterministic pattern on every simulation reset.
function generatePreHistory(stock, days) {
    days = days || 22;
    var TPD = 375; // ticks per trading day

    // Deterministic seeded LCG per ticker
    var seed = 0;
    for (var ci = 0; ci < stock.ticker.length; ci++) {
        seed = ((seed * 31) + stock.ticker.charCodeAt(ci)) & 0x7fffffff;
    }
    seed = ((seed || 1) * 1234567) & 0x7fffffff;
    function rng() {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
    }
    function randn() {
        var u = rng() || 1e-10, v2 = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v2);
    }

    // Starting price ~22 days ago: random ±15% variance from current ltp
    var targetEnd = stock.ltp;
    var overallReturn = (rng() * 2 - 1) * 0.15;
    var price = targetEnd / (1 + overallReturn);
    price = Math.max(targetEnd * 0.60, Math.min(targetEnd * 1.70, price));

    var v = stock.vol;
    var history = new Array(days * TPD);
    var idx = 0;

    for (var d = 0; d < days; d++) {
        // Overnight gap (±0.8%)
        if (d > 0) {
            price *= (1 + randn() * 0.004);
        }
        var dayOpen = price;
        var ucLimit = dayOpen * 1.10;
        var lcLimit = dayOpen * 0.90;
        // Random intraday trend bias (trending or ranging day)
        var trend = (rng() * 2 - 1) * 0.00018;

        for (var t = 0; t < TPD; t++) {
            // Mean reversion gently pulls price toward current ltp over the month
            var mr = (targetEnd - price) / targetEnd * 0.0006;
            var move = randn() * v * 1.1 + trend + mr;
            price *= (1 + move);
            price = Math.max(lcLimit, Math.min(ucLimit, price));
            history[idx++] = price;
        }
    }

    // Smooth the last day (375 ticks) to land exactly on targetEnd
    var lastVal = history[history.length - 1];
    if (lastVal && Math.abs(lastVal - targetEnd) > 0.005 * targetEnd) {
        var ratio = targetEnd / lastVal;
        var smoothStart = history.length - TPD;
        for (var si = smoothStart; si < history.length; si++) {
            var alpha = (si - smoothStart) / TPD;
            history[si] = history[si] * (1 + (ratio - 1) * alpha);
        }
    }
    // Round to appropriate precision
    var decimals = (stock.currency === 'JPY') ? 0 : 2;
    return history.map(function(p) { return parseFloat(p.toFixed(decimals)); });
}

// Build OHLC candles from pre-history ticks (for candle chart on pre-data)
function buildPreOHLC(stock, period, maxCandles) {
    if (!stock.preHistory || !stock.preHistory.length) return [];
    period = period || state.candlePeriod;
    var pre = stock.preHistory;
    var preLen = pre.length;
    // Only build as many candles as needed
    var startTick = maxCandles ? Math.max(0, preLen - maxCandles * period) : 0;
    var candles = [];
    // Deterministic volume multiplier from ticker seed
    var volBase = Math.floor(stock.vol * 8000000 + 100000);
    for (var i = startTick; i < preLen; i += period) {
        var slice = pre.slice(i, i + period);
        if (!slice.length) break;
        var c = slice[slice.length - 1], o = slice[0];
        var isBull = c >= o;
        candles.push({
            o: o,
            h: Math.max.apply(null, slice),
            l: Math.min.apply(null, slice),
            c: c,
            v: Math.floor(volBase * (isBull ? 0.9 : 1.2) * (0.6 + (i % 7) * 0.08))
        });
    }
    return candles;
}

var LOT_SIZES = {
    RELIANCE: 250, TCS: 150, HDFCBANK: 550, ITC: 1600,
    INFY: 300, SBIN: 1500, ICICIBANK: 700, ZOMATO: 2000,
    SUNPHARMA: 350, TATAMOTORS: 1425, MARUTI: 100,
    TATASTEEL: 3000, BHARTIARTL: 500, ADANIENT: 250,
    HINDUNILVR: 300, BAJFINANCE: 125, HCLTECH: 350,
    WIPRO: 1500, LT: 150, KOTAKBANK: 400,
    AXISBANK: 600, POWERGRID: 2700, NTPC: 900,
    COALINDIA: 1500, JSWSTEEL: 675,
    BAJAJFINSV: 250, TECHM: 600, LTIM: 150,
    MM: 700, EICHERMOT: 125, CIPLA: 650, DRREDDY: 125,
    BRITANNIA: 200, NESTLEIND: 25, TATACONSUM: 575,
    ONGC: 1775, BPCL: 1800, TITAN: 375, ULTRACEMCO: 100,
    PAYTM: 4350, IRCTC: 450, BEL: 3500,
    // NASDAQ
    AAPL: 100, MSFT: 100, NVDA: 100, TSLA: 100, META: 100, GOOGL: 100, AMZN: 100, NFLX: 100,
    AMD: 100, ADBE: 100, AVGO: 100, COIN: 100, PLTR: 100, MU: 100,
    // SSE
    MOUTAI: 100, ICBC: 1000, CMBANK: 500, PINGAN: 500, PETROCH: 1000,
    BYD: 100, CATL: 100, LONGI: 1000, SAIC: 500, CITICS: 500,
    // TSE
    TOYOTA: 100, SONY: 100, SOFTBNK: 100, HONDA: 100, NINTNDO: 100,
    MUFG: 100, FASTRET: 10, KEYENCE: 10, DAIKIN: 10, CANON7751: 100,
    // Commodities
    GOLD: 10, SILVER: 100, COPPER: 10, ALUM: 10, ZINC: 10
};

// Helper to make a stock entry cleanly
function mkStock(ticker, name, ltp, vol, sector, market, currency) {
    market = market || 'NSE'; currency = currency || 'INR';
    return { ticker: ticker, name: name, ltp: ltp, vol: vol, base: ltp, history: [], open: ltp, sector: sector, volume: 0, circuitHit: null, _prevTick: ltp, market: market, currency: currency, volumeHistory: [] };
}

var marketStocks = [
    // ── Bonds / Fixed Income (Yields) ──
    mkStock("US10Y",      "US 10-Year Yield",          4.25,  0.0005, "Bond",  "BOND", "USD"),
    mkStock("US02Y",      "US 2-Year Yield",           4.60,  0.0006, "Bond",  "BOND", "USD"),
    mkStock("IN10Y",      "India 10-Year Yield",       7.10,  0.0004, "Bond",  "BOND", "INR"),
    mkStock("CN10Y",      "China 10-Year Yield",       2.40,  0.0005, "Bond",  "BOND", "CNY"),
    mkStock("DE10Y",      "German 10-Year Bund",       2.35,  0.0007, "Bond",  "BOND", "EUR"),
    mkStock("UK10Y",      "UK 10-Year Gilt",           4.10,  0.0005, "Bond",  "BOND", "GBP"),
    mkStock("JP10Y",      "Japan 10-Year JGB",         0.85,  0.0010, "Bond",  "BOND", "JPY"),
    mkStock("AU10Y",      "Australia 10-Year Yield",   4.15,  0.0006, "Bond",  "BOND", "AUD"),
    mkStock("CA10Y",      "Canada 10-Year Yield",      3.55,  0.0005, "Bond",  "BOND", "CAD"),
    mkStock("CH10Y",      "Swiss 10-Year Yield",       0.70,  0.0008, "Bond",  "BOND", "CHF"),
    // ── Indices ──
    mkStock("NIFTY 50",   "Nifty 50 Index",            22500, 0.0008, "Index", "INDEX", "INR"),
    mkStock("SENSEX",     "BSE Sensex",                74500, 0.0008, "Index", "INDEX", "INR"),
    mkStock("BANKNIFTY",  "Nifty Bank Index",          47800, 0.0012, "Index", "INDEX", "INR"),
    mkStock("FINNIFTY",   "Nifty Financial Services",  21200, 0.0012, "Index", "INDEX", "INR"),
    mkStock("SPX500",     "S&P 500 Index",             5100,  0.0009, "Index", "INDEX", "USD"),
    mkStock("NDX100",     "NASDAQ 100 Index",          18000, 0.0013, "Index", "INDEX", "USD"),
    mkStock("DJIA",       "Dow Jones Industrial",      39000, 0.0007, "Index", "INDEX", "USD"),
    mkStock("NIKKEI225",  "Nikkei 225",                39200, 0.0011, "Index", "INDEX", "JPY"),
    mkStock("SHCOMP",     "Shanghai Composite",        3050,  0.0010, "Index", "INDEX", "CNY"),
    mkStock("HSI",        "Hang Seng Index",           16500, 0.0014, "Index", "INDEX", "HKD"),
    // ── Banking & Finance ──  (prices: Feb 28, 2026)
    mkStock("HDFCBANK",   "HDFC Bank Ltd",            1755, 0.0020, "Banking"),
    mkStock("SBIN",       "State Bank of India",       715,  0.0030, "Banking"),
    mkStock("ICICIBANK",  "ICICI Bank",                1275, 0.0022, "Banking"),
    mkStock("KOTAKBANK",  "Kotak Mahindra Bank",       2010, 0.0019, "Banking"),
    mkStock("AXISBANK",   "Axis Bank Ltd",             1050, 0.0024, "Banking"),
    mkStock("BAJFINANCE", "Bajaj Finance Ltd",         7450, 0.0028, "Finance"),
    mkStock("BAJAJFINSV", "Bajaj Finserv Ltd",         2015, 0.0022, "Finance"),
    // ── IT ──
    mkStock("TCS",        "Tata Consultancy Services", 3560, 0.0014, "IT"),
    mkStock("INFY",       "Infosys Ltd",               1870, 0.0025, "IT"),
    mkStock("HCLTECH",    "HCL Technologies",          1720, 0.0020, "IT"),
    mkStock("WIPRO",      "Wipro Ltd",                 295,  0.0026, "IT"),
    mkStock("TECHM",      "Tech Mahindra Ltd",         1685, 0.0022, "IT"),
    mkStock("LTIM",       "LTIMindtree Ltd",           5150, 0.0020, "IT"),
    // ── Energy & Conglomerate ──
    mkStock("RELIANCE",   "Reliance Industries",       1225, 0.0018, "Energy"),
    mkStock("ONGC",       "Oil & Natural Gas Corp",    235,  0.0025, "Energy"),
    mkStock("BPCL",       "Bharat Petroleum Corp",     265,  0.0028, "Energy"),
    // ── Power ──
    mkStock("NTPC",       "NTPC Ltd",                  320,  0.0018, "Power"),
    mkStock("POWERGRID",  "Power Grid Corporation",    305,  0.0015, "Power"),
    // ── Infra ──
    mkStock("ADANIENT",   "Adani Enterprises",         2185, 0.0040, "Infra"),
    mkStock("LT",         "Larsen & Toubro",           3255, 0.0016, "Infra"),
    mkStock("BEL",        "Bharat Electronics Ltd",    255,  0.0030, "Infra"),
    // ── Auto ──
    mkStock("TATAMOTORS", "Tata Motors Ltd",           665,  0.0035, "Auto"),
    mkStock("MARUTI",     "Maruti Suzuki India",       11800,0.0016, "Auto"),
    mkStock("MM",         "Mahindra & Mahindra",       2855, 0.0022, "Auto"),
    mkStock("EICHERMOT",  "Eicher Motors Ltd",         5035, 0.0018, "Auto"),
    // ── Pharma ──
    mkStock("SUNPHARMA",  "Sun Pharma Industries",     1745, 0.0018, "Pharma"),
    mkStock("CIPLA",      "Cipla Ltd",                 1555, 0.0020, "Pharma"),
    mkStock("DRREDDY",    "Dr Reddy's Laboratories",   1165, 0.0022, "Pharma"),
    // ── Metals & Mining ──
    mkStock("TATASTEEL",  "Tata Steel Ltd",            140,  0.0038, "Metal"),
    mkStock("JSWSTEEL",   "JSW Steel Ltd",             930,  0.0032, "Metal"),
    mkStock("COALINDIA",  "Coal India Ltd",            355,  0.0022, "Metal"),
    // ── FMCG ──
    mkStock("ITC",        "ITC Ltd",                   415,  0.0010, "FMCG"),
    mkStock("HINDUNILVR", "Hindustan Unilever",        2290, 0.0012, "FMCG"),
    mkStock("BRITANNIA",  "Britannia Industries",      4755, 0.0016, "FMCG"),
    mkStock("NESTLEIND",  "Nestle India Ltd",          2155, 0.0014, "FMCG"),
    mkStock("TATACONSUM", "Tata Consumer Products",    960,  0.0022, "FMCG"),
    // ── Telecom ──
    mkStock("BHARTIARTL", "Bharti Airtel",             1730, 0.0020, "Telecom"),
    // ── Consumer ──
    mkStock("TITAN",      "Titan Company Ltd",         3155, 0.0018, "Consumer"),
    // ── Cement ──
    mkStock("ULTRACEMCO", "UltraTech Cement Ltd",     10300, 0.0016, "Cement"),
    // ── New Age Tech ──
    mkStock("ZOMATO",     "Zomato Ltd",                235,  0.0050, "Tech"),
    mkStock("PAYTM",      "One97 Communications",      855,  0.0060, "Tech"),
    mkStock("IRCTC",      "IRCTC Ltd",                 775,  0.0030, "Tech"),
    // ── NASDAQ ──  (USD prices, post-split adjusted, Feb 2026)
    mkStock("AAPL",    "Apple Inc.",              264,  0.0018, "Tech",       "NASDAQ", "USD"),
    mkStock("MSFT",    "Microsoft Corp.",          393,  0.0016, "Tech",       "NASDAQ", "USD"),
    mkStock("NVDA",    "NVIDIA Corp.",             177,  0.0040, "Semicon",    "NASDAQ", "USD"),  // post 10:1 split Jun'24
    mkStock("TSLA",    "Tesla Inc.",               403,  0.0055, "EV",         "NASDAQ", "USD"),
    mkStock("META",    "Meta Platforms",           648,  0.0030, "SocMedia",   "NASDAQ", "USD"),
    mkStock("GOOGL",   "Alphabet Inc.",            311,  0.0020, "Tech",       "NASDAQ", "USD"),
    mkStock("AMZN",    "Amazon.com Inc.",          210,  0.0025, "E-Comm",     "NASDAQ", "USD"),
    mkStock("NFLX",    "Netflix Inc.",              96,  0.0035, "Streaming",  "NASDAQ", "USD"),  // post 10:1 split Feb'26
    mkStock("AMD",     "Advanced Micro Devices",   200,  0.0045, "Semicon",    "NASDAQ", "USD"),
    mkStock("ADBE",    "Adobe Inc.",               262,  0.0022, "Software",   "NASDAQ", "USD"),
    mkStock("AVGO",    "Broadcom Inc.",            320,  0.0030, "Semicon",    "NASDAQ", "USD"),
    mkStock("COIN",    "Coinbase Global",          176,  0.0070, "Crypto",     "NASDAQ", "USD"),
    mkStock("PLTR",    "Palantir Technologies",    137,  0.0060, "AI/Data",    "NASDAQ", "USD"),
    mkStock("MU",      "Micron Technology",        412,  0.0040, "Semicon",    "NASDAQ", "USD"),
    // ── SSE (Shanghai) ──  (CNY)
    mkStock("MOUTAI",  "Kweichow Moutai",         1535, 0.0018, "Liquor",     "SSE",    "CNY"),
    mkStock("ICBC",    "Ind & Comm Bank China",     7.1, 0.0015, "Banking",    "SSE",    "CNY"),
    mkStock("CMBANK",  "China Merchants Bank",      48,  0.0020, "Banking",    "SSE",    "CNY"),
    mkStock("PINGAN",  "Ping An Insurance",          52, 0.0022, "Insurance",  "SSE",    "CNY"),
    mkStock("PETROCH", "PetroChina Co.",            10.8, 0.0020, "Energy",    "SSE",    "CNY"),
    mkStock("BYD",     "BYD Co. Ltd.",              285,  0.0035, "EV",         "SSE",    "CNY"),
    mkStock("CATL",    "CATL (CATLSH)",             242,  0.0032, "EV Battery", "SSE",    "CNY"),
    mkStock("LONGI",   "LONGi Green Energy",         18,  0.0040, "Solar",      "SSE",    "CNY"),
    mkStock("SAIC",    "SAIC Motor Corp.",           22,  0.0028, "Auto",       "SSE",    "CNY"),
    mkStock("CITICS",  "CITIC Securities",           28,  0.0025, "Finance",    "SSE",    "CNY"),
    mkStock("SINOPEC", "Sinopec Corp.",             6.5,  0.0018, "Energy",     "SSE",    "CNY"),
    mkStock("AGBANK",  "Agricultural Bank",         4.5,  0.0015, "Banking",    "SSE",    "CNY"),
    mkStock("CHINALIFE","China Life Insurance",      45,  0.0020, "Insurance",  "SSE",    "CNY"),
    mkStock("ZTE",     "ZTE Corporation",            35,  0.0035, "Telecom",    "SSE",    "CNY"),
    mkStock("BAOSTEEL","Baoshan Iron & Steel",      6.8,  0.0022, "Steel",      "SSE",    "CNY"),
    // ── TSE (Japan) ──  (JPY)
    mkStock("TOYOTA",  "Toyota Motor Corp.",      2755, 0.0018, "Auto",       "TSE",    "JPY"),
    mkStock("SONY",    "Sony Group Corp.",        2850, 0.0025, "Consumer",   "TSE",    "JPY"),
    mkStock("SOFTBNK", "SoftBank Group Corp.",   10200, 0.0035, "Tech",       "TSE",    "JPY"),
    mkStock("HONDA",   "Honda Motor Co.",          1450, 0.0022, "Auto",       "TSE",    "JPY"),
    mkStock("NINTNDO", "Nintendo Co. Ltd.",         870, 0.0028, "Gaming",     "TSE",    "JPY"),  // post 10:1 split Oct'24
    mkStock("MUFG",    "Mitsubishi UFJ Financial", 2908, 0.0020, "Banking",    "TSE",    "JPY"),
    mkStock("FASTRET", "Fast Retailing (Uniqlo)", 52000, 0.0022, "Retail",     "TSE",    "JPY"),
    mkStock("KEYENCE", "Keyence Corp.",           63000, 0.0018, "Automation", "TSE",    "JPY"),
    mkStock("DAIKIN",  "Daikin Industries",       22500, 0.0022, "HVAC",       "TSE",    "JPY"),
    mkStock("CANON7751","Canon Inc.",              4250, 0.0020, "Tech",       "TSE",    "JPY"),
    mkStock("NISSAN",  "Nissan Motor Co.",          650, 0.0025, "Auto",       "TSE",    "JPY"),
    mkStock("PANASONIC","Panasonic Holdings",      1450, 0.0022, "Electronics","TSE",    "JPY"),
    mkStock("HITACHI", "Hitachi Ltd.",            13500, 0.0020, "Industrial", "TSE",    "JPY"),
    mkStock("MITSUI",  "Mitsui & Co.",             7200, 0.0025, "Trading",    "TSE",    "JPY"),
    mkStock("NIDEC",   "Nidec Corp.",              6800, 0.0030, "Components", "TSE",    "JPY"),
    // ── Commodities ──  (USD)
    mkStock("GOLD",    "Gold (USD/oz)",            5248, 0.0012, "Precious",   "COMM",   "USD"),
    mkStock("SILVER",  "Silver (USD/oz)",             93, 0.0025, "Precious",   "COMM",   "USD"),
    mkStock("COPPER",  "Copper (USD/ton)",         13360, 0.0025, "Industrial", "COMM",   "USD"),
    mkStock("ALUM",    "Aluminium (USD/ton)",       2645, 0.0020, "Industrial", "COMM",   "USD"),
    mkStock("ZINC",    "Zinc (USD/ton)",            2955, 0.0022, "Industrial", "COMM",   "USD"),
    mkStock("CRUDE",   "Crude Oil (WTI)",             78, 0.0150, "Energy",     "COMM",   "USD"),
    mkStock("NATGAS",  "Natural Gas",                  2.5,0.0250, "Energy",     "COMM",   "USD"),
    mkStock("PLAT",    "Platinum (USD/oz)",          985, 0.0030, "Precious",   "COMM",   "USD"),
    mkStock("PALLAD",  "Palladium (USD/oz)",         950, 0.0040, "Precious",   "COMM",   "USD"),
    mkStock("LEAD",    "Lead (USD/ton)",            2100, 0.0020, "Industrial", "COMM",   "USD"),
    // ── Crypto ──  (USD)
    mkStock("BTC",     "Bitcoin",                  65000, 0.0120, "Crypto",     "CRYPTO", "USD"),
    mkStock("ETH",     "Ethereum",                  3500, 0.0150, "Crypto",     "CRYPTO", "USD"),
    mkStock("SOL",     "Solana",                     145, 0.0250, "Crypto",     "CRYPTO", "USD"),
    mkStock("BNB",     "Binance Coin",               580, 0.0180, "Crypto",     "CRYPTO", "USD"),
    mkStock("XRP",     "Ripple",                    0.55, 0.0200, "Crypto",     "CRYPTO", "USD"),
    mkStock("DOGE",    "Dogecoin",                  0.15, 0.0400, "Crypto",     "CRYPTO", "USD"),
    // ── Forex ──
    mkStock("EURUSD",  "EUR/USD",                   1.08, 0.0015, "Currency",   "FX",     "USD"),
    mkStock("GBPUSD",  "GBP/USD",                   1.25, 0.0020, "Currency",   "FX",     "USD"),
    mkStock("USDJPY",  "USD/JPY",                 155.50, 0.0025, "Currency",   "FX",     "JPY"),
    mkStock("AUDUSD",  "AUD/USD",                   0.65, 0.0020, "Currency",   "FX",     "USD"),
    mkStock("USDCAD",  "USD/CAD",                   1.37, 0.0018, "Currency",   "FX",     "USD"),
    mkStock("USDINR",  "USD/INR",                  91.03, 0.0015, "Currency",   "FX",     "INR"),
    mkStock("CNYINR",  "CNY/INR",                  13.28, 0.0020, "Currency",   "FX",     "INR"),
    mkStock("JPYINR",  "JPY/INR",                  0.583, 0.0025, "Currency",   "FX",     "INR")
];

// O(1) ticker → stock reference map (references, so in-place stock mutations are always reflected)
var stockMap = {};
(function() { marketStocks.forEach(function(s) { stockMap[s.ticker] = s; }); }());

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
    { text: "{name} expands to 3 new international markets. Revenue diversification.", impact: 0.018, target: "RANDOM" },

    // ---- AUTO (NEW) ----
    { text: "M&M electric SUV XEV 9e gets 30,000 bookings in 48 hours.", impact: 0.032, target: "MM" },
    { text: "M&M farm equipment segment: tractor volumes up 18% YoY.", impact: 0.015, target: "MM" },
    { text: "Eicher Motors Royal Enfield exports cross 1 lakh units. Southeast Asia boom.", impact: 0.025, target: "EICHERMOT" },
    { text: "Eicher Motors premium bike Guerrilla 450 fully sold out within hours.", impact: 0.022, target: "EICHERMOT" },
    { text: "Auto sector inventory normalizes after festive run. Outlook bullish.", impact: 0.018, target: "AUTO" },
    { text: "PLI scheme for auto components: 18 firms qualify. Ancillary stocks rally.", impact: 0.015, target: "AUTO" },

    // ---- PHARMA (NEW) ----
    { text: "Cipla launches biosimilar in US market. Addressable market worth $800M.", impact: 0.03, target: "CIPLA" },
    { text: "Cipla chronic care portfolio growing 24% YoY. Branded generics outperform.", impact: 0.02, target: "CIPLA" },
    { text: "Dr Reddy's receives USFDA tentative approval for 3 blockbuster generics.", impact: 0.028, target: "DRREDDY" },
    { text: "Dr Reddy's specialty formulations revenue surpasses ₹3,000 Cr milestone.", impact: 0.022, target: "DRREDDY" },
    { text: "India pharma exports cross $30B mark. Generics dominate global supply.", impact: 0.018, target: "PHARMA" },

    // ---- FMCG (NEW) ----
    { text: "Britannia launches premium biscuit range. Gross margins improve 200bps.", impact: 0.020, target: "BRITANNIA" },
    { text: "Britannia Q3 profit beats estimates by 18%. Volume recovery on rural demand.", impact: 0.025, target: "BRITANNIA" },
    { text: "Nestle India Maggi noodle market share hits all-time high of 58%.", impact: 0.022, target: "NESTLEIND" },
    { text: "Nestle India premium portfolio (Munch, KitKat) revenue up 28% YoY.", impact: 0.018, target: "NESTLEIND" },
    { text: "Tata Consumer Products expands into snacks category. ₹500 Cr investment.", impact: 0.025, target: "TATACONSUM" },
    { text: "Tata Consumer Starbucks India opens 50 new stores. Premium beverage boom.", impact: 0.018, target: "TATACONSUM" },

    // ---- ENERGY / OIL & GAS (NEW) ----
    { text: "ONGC discovers new deepwater gas field in Bay of Bengal. Reserves +8%.", impact: 0.030, target: "ONGC" },
    { text: "ONGC Q3 profit beats: crude realization at $82/bbl. Dividend announced.", impact: 0.025, target: "ONGC" },
    { text: "BPCL upgrades Mumbai refinery: throughput increases to 14.5 MMTPA.", impact: 0.022, target: "BPCL" },
    { text: "BPCL overseas E&P block Mozambique starts production ahead of schedule.", impact: 0.028, target: "BPCL" },
    { text: "Global crude oil drops below $70/bbl. OMCs rally on marketing margin expansion.", impact: 0.025, target: "OILGAS" },
    { text: "Government revises LPG price upward. OMC under-recovery narrows sharply.", impact: 0.018, target: "OILGAS" },
    { text: "Crude oil spikes to $95/bbl. Refinery margins squeezed. ONGC benefits.", impact: -0.02, target: "BPCL" },

    // ---- CEMENT (NEW) ----
    { text: "UltraTech Cement capacity expansion: 22.6 MTPA greenfield plant commissioned.", impact: 0.025, target: "ULTRACEMCO" },
    { text: "UltraTech Q3 results: EBITDA/ton at ₹1,380. Best in 6 quarters.", impact: 0.028, target: "ULTRACEMCO" },
    { text: "India cement demand grows 10% in Q3. Infra + housing demand robust.", impact: 0.020, target: "CEMENT" },
    { text: "Cement prices rise ₹20/bag pan-India. Volume growth intact.", impact: 0.022, target: "CEMENT" },
    { text: "Coal prices correction boosts cement cost structure. Margins expand.", impact: 0.018, target: "CEMENT" },

    // ---- CONSUMER (NEW) ----
    { text: "Titan Company: jewelry segment revenue crosses ₹10,000 Cr in Q3.", impact: 0.025, target: "TITAN" },
    { text: "Titan Tanishq reaches ₹50,000 Cr retail target 2 years ahead of plan.", impact: 0.030, target: "TITAN" },
    { text: "Gold prices rally 12% YTD. Titan margin expansion on studded ratio.", impact: 0.022, target: "TITAN" },
    { text: "Titan CaratLane acquisition accelerates lab-grown diamond push.", impact: 0.018, target: "TITAN" },
    { text: "Premium consumer spending surges as India's middle class expands.", impact: 0.015, target: "CONSUMER" },

    // ---- FINANCE (NEW) ----
    { text: "Bajaj Finserv health insurance subsidiary hits 5M policies. Fastest growth.", impact: 0.022, target: "BAJAJFINSV" },
    { text: "Bajaj Finserv Q3: Allianz JV exit roadmap finalized. Valuation upside.", impact: 0.025, target: "BAJAJFINSV" },
    { text: "NBFC credit growth at 22%. Bajaj Finance and Finserv set to benefit.", impact: 0.018, target: "BAJAJFINSV" },

    // ---- IT (NEW) ----
    { text: "Tech Mahindra Network Services wins ₹3,500 Cr telecom deal. Largest in 5 yrs.", impact: 0.030, target: "TECHM" },
    { text: "Tech Mahindra CEO outlines turnaround. EBIT margin to reach 15% by FY26.", impact: 0.025, target: "TECHM" },
    { text: "LTIMindtree BFSI vertical grows 28% YoY. Deal wins at record $1.2B TCV.", impact: 0.030, target: "LTIM" },
    { text: "LTIMindtree AI CoE launches enterprise LLM platform. Early adoption strong.", impact: 0.022, target: "LTIM" },
    { text: "IT sector Q3 preview: TCV deal wins at $10.5B. Beat estimates.", impact: 0.015, target: "IT" },
    { text: "IT stocks rally as US Fed cuts rates. ITES stocks up 3-5% in a day.", impact: 0.020, target: "IT" },

    // ---- DEFENSE (NEW) ----
    { text: "BEL wins ₹8,000 Cr radar contract from Indian Army. Largest ever order.", impact: 0.040, target: "DEFENSE" },
    { text: "BEL Akash missile system export order to friendly nation. ₹5,000 Cr deal.", impact: 0.035, target: "DEFENSE" },
    { text: "India defense budget raised to ₹7.5L Cr. PSU defense stocks rally.", impact: 0.025, target: "DEFENSE" },
    { text: "BEL order book crosses ₹75,000 Cr. Execution pace accelerating.", impact: 0.022, target: "DEFENSE" },

    // ---- NEW AGE TECH (NEW) ----
    { text: "Paytm receives RBI NBFC license. Path to profitability clearer.", impact: 0.045, target: "PAYTM" },
    { text: "Paytm UPI market share rebounds to 12% after regulatory pause.", impact: 0.030, target: "PAYTM" },
    { text: "Paytm founder increases stake to 20.5%. Confidence signal.", impact: 0.025, target: "PAYTM" },
    { text: "IRCTC announces dynamic pricing for premium trains. Revenue impact +18%.", impact: 0.028, target: "IRCTC" },
    { text: "IRCTC to launch 50 new Vande Bharat trains. Catering revenue uplift.", impact: 0.022, target: "IRCTC" },
    { text: "IRCTC Q3 profit up 35% YoY. Rail tourism segment doubles.", impact: 0.030, target: "IRCTC" },

    // ---- MACRO (NEW) ----
    { text: "India MSCI weight increases. Passive inflows of $1.8B expected.", impact: 0.022, target: "ALL" },
    { text: "RBI cuts repo rate by 25bps to 6.25%. Rate-sensitive sectors rally hard.", impact: 0.025, target: "ALL" },
    { text: "Union Budget: ₹11L Cr capex planned. Infrastructure and defense boost.", impact: 0.018, target: "ALL" },
    { text: "India retail inflation hits 4-year low at 3.8%. Rate cut cycle likely.", impact: 0.020, target: "ALL" },
    { text: "Global sovereign funds increase India allocations. $5B inflow expected.", impact: 0.016, target: "ALL" },
    { text: "India manufacturing PMI at 58.9 — highest in 16 years. Industrial boom.", impact: 0.018, target: "ALL" },
    { text: "Bank credit growth slows to 12%. Concerns of tightening credit cycle.", impact: -0.012, target: "BANK" },
    { text: "Moody's upgrades India outlook to positive from stable.", impact: 0.020, target: "ALL" },
    { text: "FII buying resumes: ₹12,000 Cr net inflows in single week.", impact: 0.018, target: "ALL" },
    { text: "Nifty 50 PE crosses 25x. High valuations spark profit booking.", impact: -0.015, target: "ALL" },
    { text: "Dollar index surges to 108. EM currencies under pressure including rupee.", impact: -0.018, target: "ALL" },
    { text: "China manufacturing data beats expectations. Metal and energy stocks rally.", impact: 0.020, target: "METAL" },

    // ---- WAR / GEOPOLITICAL ----
    { text: "Russia-Ukraine conflict escalates. European gas prices spike 30%. Markets risk-off.", impact: -0.018, target: "ALL", market: "WAR" },
    { text: "NATO activates Article 5 for the first time. Global equity sell-off intensifies.", impact: -0.025, target: "ALL", market: "WAR" },
    { text: "Middle East war expands. Strait of Hormuz shipping route disrupted.", impact: -0.030, target: "ALL", market: "WAR" },
    { text: "Oil tanker attacked in Red Sea. Crude surges $8/bbl on supply fears.", impact: -0.020, target: "ENERGY", market: "WAR" },
    { text: "India-Pakistan border tensions flare. Indian defence stocks surge.", impact: 0.040, target: "DEFENSE", market: "WAR" },
    { text: "India-Pakistan military standoff deepens. Markets enter risk-off mode.", impact: -0.018, target: "ALL", market: "WAR" },
    { text: "US-Iran standoff: aircraft carrier deployed to Persian Gulf.", impact: -0.022, target: "ALL", market: "WAR" },
    { text: "Taiwan Strait crisis: China PLA military drills near Taiwan.", impact: -0.025, target: "ALL", market: "WAR" },
    { text: "Ceasefire in Gaza announced. Oil eases, risk assets globally recover.", impact: 0.018, target: "ALL", market: "WAR" },
    { text: "North Korea fires ballistic missiles over Japan. Nikkei drops 2%.", impact: -0.020, target: "ALL", market: "WAR" },
    { text: "Sanctions on Russia energy exports expanded. Oil & gas prices spike.", impact: -0.015, target: "ENERGY", market: "WAR" },
    { text: "Ukraine drone attack on Russian oil depot. Energy prices surge.", impact: 0.022, target: "ENERGY", market: "WAR" },
    { text: "Ballistic missile strikes near Suez Canal. Global shipping halted.", impact: -0.020, target: "ALL", market: "WAR" },
    { text: "China invades Taiwan: worst-case geopolitical scenario hits global markets.", impact: -0.050, target: "ALL", market: "WAR" },
    { text: "UN Security Council emergency meeting on Middle East. Markets stabilize.", impact: 0.010, target: "ALL", market: "WAR" },
    { text: "War premium in gold prices rises $150/oz. Safe haven demand surges.", impact: 0.035, target: "GOLD", market: "WAR" },
    { text: "Conflict in Eastern Europe disrupts wheat supply. Global food inflation spike.", impact: -0.010, target: "FMCG", market: "WAR" },

    // ---- NASDAQ ----
    { text: "Apple iPhone 17 pre-orders hit record 50M units in first week.", impact: 0.030, target: "AAPL", market: "NASDAQ" },
    { text: "Apple Vision Pro 2 sells out in 4 hours. Services revenue upgraded.", impact: 0.022, target: "AAPL", market: "NASDAQ" },
    { text: "Microsoft Azure revenue grows 33% YoY. AI workload demand explosively.", impact: 0.025, target: "MSFT", market: "NASDAQ" },
    { text: "Microsoft Copilot enterprise subscriptions cross 50M. AI monetization.", impact: 0.030, target: "MSFT", market: "NASDAQ" },
    { text: "NVIDIA Blackwell chip demand exceeds supply. Waitlist grows to 18 months.", impact: 0.045, target: "NVDA", market: "NASDAQ" },
    { text: "US-China chip export ban tightened. NVIDIA China revenue at risk.", impact: -0.040, target: "NVDA", market: "NASDAQ" },
    { text: "Tesla misses Q4 delivery estimates. EV demand slowdown globally.", impact: -0.040, target: "TSLA", market: "NASDAQ" },
    { text: "Tesla Full Self-Driving V13 gets regulatory approval in 3 US states.", impact: 0.038, target: "TSLA", market: "NASDAQ" },
    { text: "Meta AI ad revenue surges 40%. Largest quarter in company history.", impact: 0.035, target: "META", market: "NASDAQ" },
    { text: "Meta Llama 4 model outperforms GPT on all benchmarks. Stock rockets.", impact: 0.040, target: "META", market: "NASDAQ" },
    { text: "Google loses landmark antitrust case. DOJ seeks structural breakup.", impact: -0.050, target: "GOOGL", market: "NASDAQ" },
    { text: "Google Gemini Ultra 2.0 dominates AI market. Search revenue intact.", impact: 0.025, target: "GOOGL", market: "NASDAQ" },
    { text: "Amazon AWS profitability hits all-time high. Operating margin crosses 38%.", impact: 0.030, target: "AMZN", market: "NASDAQ" },
    { text: "Amazon pharmacy segment revenue doubles. Healthcare expansion gains.", impact: 0.025, target: "AMZN", market: "NASDAQ" },
    { text: "Netflix adds 20M subscribers in Q4. Password-sharing crackdown a success.", impact: 0.040, target: "NFLX", market: "NASDAQ" },
    { text: "Netflix ad-supported tier revenue exceeds subscription in 8 countries.", impact: 0.035, target: "NFLX", market: "NASDAQ" },
    { text: "Fed cuts rates 25bps. NASDAQ 100 rallies 2.5% on liquidity hopes.", impact: 0.022, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "US CPI surprise: inflation at 3.8%. Rate cut hopes fade, tech sells off.", impact: -0.020, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "US recession fears mount. NASDAQ 100 drops 4% on PMI miss.", impact: -0.028, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "Buffett increases tech holdings. NASDAQ sentiment improves sharply.", impact: 0.018, target: "ALL_NASDAQ", market: "NASDAQ" },

    // ---- SSE (Shanghai Stock Exchange) ----
    { text: "China PBOC cuts RRR by 50bps. Massive liquidity injected into market.", impact: 0.025, target: "ALL_SSE", market: "SSE" },
    { text: "China Q3 GDP growth beats at 5.4%. Market rally on economic recovery.", impact: 0.030, target: "ALL_SSE", market: "SSE" },
    { text: "China slows: PMI falls to 48.2. Factory output at 3-year low.", impact: -0.025, target: "ALL_SSE", market: "SSE" },
    { text: "China announces RMB 10 trillion stimulus package. SSE surges.", impact: 0.040, target: "ALL_SSE", market: "SSE" },
    { text: "Evergrande liquidation completed. Property sector fears re-emerge.", impact: -0.030, target: "ALL_SSE", market: "SSE" },
    { text: "Kweichow Moutai Q3 revenue hits record 30B CNY. Premium liquor boom.", impact: 0.030, target: "MOUTAI", market: "SSE" },
    { text: "Moutai export to 60 countries launched. International expansion.", impact: 0.025, target: "MOUTAI", market: "SSE" },
    { text: "ICBC bad loan ratio rises to 1.8%. Property sector NPAs rise.", impact: -0.020, target: "ICBC", market: "SSE" },
    { text: "ICBC dividend yield at 6.5%. Value investors accumulate.", impact: 0.015, target: "ICBC", market: "SSE" },
    { text: "China Merchants Bank wealth management AUM crosses CNY 4T.", impact: 0.022, target: "CMBANK", market: "SSE" },
    { text: "Ping An Insurance dividend increased 15%. Record payout.", impact: 0.020, target: "PINGAN", market: "SSE" },
    { text: "PetroChina crude output hits 4.5M bbl/day record. Best in decade.", impact: 0.025, target: "PETROCH", market: "SSE" },
    { text: "US-China trade war re-escalates. 60% tariffs on Chinese goods.", impact: -0.035, target: "ALL_SSE", market: "SSE" },

    // ---- TSE (Tokyo Stock Exchange / Japan) ----
    { text: "Bank of Japan raises rates to 1.0%. Yen strengthens, Nikkei corrects.", impact: -0.025, target: "ALL_TSE", market: "TSE" },
    { text: "Japan GDP growth surprises at 3.1% annualized. Nikkei rally.", impact: 0.020, target: "ALL_TSE", market: "TSE" },
    { text: "Yen hits 160 vs USD. Japan exporters rally on currency tailwind.", impact: 0.018, target: "TOYOTA", market: "TSE" },
    { text: "Toyota FY net profit hits record. Hybrid vehicles outsell pure EVs.", impact: 0.030, target: "TOYOTA", market: "TSE" },
    { text: "Toyota solid-state battery production starts. EV range 900km.", impact: 0.040, target: "TOYOTA", market: "TSE" },
    { text: "Sony PlayStation 6 announcement: 40M pre-orders in 24 hours.", impact: 0.035, target: "SONY", market: "TSE" },
    { text: "Sony Music Entertainment acquires major label. IP portfolio doubles.", impact: 0.022, target: "SONY", market: "TSE" },
    { text: "SoftBank Vision Fund 3 posts $12B gain. AI startup portfolio boom.", impact: 0.040, target: "SOFTBNK", market: "TSE" },
    { text: "SoftBank ARM IPO proceeds used for $20B AI investment spree.", impact: 0.030, target: "SOFTBNK", market: "TSE" },
    { text: "Honda-Nissan merger approved by regulators. Auto consolidation.", impact: 0.025, target: "HONDA", market: "TSE" },
    { text: "Nintendo Switch 2 sells 5M units in first week. All-time record.", impact: 0.045, target: "NINTNDO", market: "TSE" },
    { text: "Nintendo next Pokemon game breaks franchise records. Stock surges.", impact: 0.030, target: "NINTNDO", market: "TSE" },
    { text: "Japan earthquake disrupts auto supply chain. Production halted.", impact: -0.030, target: "TOYOTA", market: "TSE" },

    // ---- COMMODITIES ----
    { text: "Gold hits all-time high $3,050/oz. War fears drive safe haven demand.", impact: 0.028, target: "GOLD", market: "COMM" },
    { text: "Gold falls $120/oz as US dollar strengthens sharply.", impact: -0.020, target: "GOLD", market: "COMM" },
    { text: "Central banks buy record 1,000 tonnes of gold. De-dollarization trend.", impact: 0.025, target: "GOLD", market: "COMM" },
    { text: "Silver surges on industrial demand from solar panel manufacturers.", impact: 0.030, target: "SILVER", market: "COMM" },
    { text: "Silver industrial demand from EVs grows 30% YoY. Supply deficit.", impact: 0.025, target: "SILVER", market: "COMM" },
    { text: "Silver short squeeze: hedge funds scramble to cover positions.", impact: 0.045, target: "SILVER", market: "COMM" },
    { text: "Copper prices jump 8% on China infrastructure stimulus news.", impact: 0.028, target: "COPPER", market: "COMM" },
    { text: "Copper mine strike in Chile halts 15% of global production.", impact: 0.035, target: "COPPER", market: "COMM" },
    { text: "Copper drops on slowing EV demand outlook. Surplus forecast rises.", impact: -0.022, target: "COPPER", market: "COMM" },
    { text: "Aluminium supply glut: China production surge leads to 10% price crash.", impact: -0.038, target: "ALUM", market: "COMM" },
    { text: "Aluminium demand from aircraft manufacturing hits record. Prices recover.", impact: 0.022, target: "ALUM", market: "COMM" },
    { text: "EU carbon tax on aluminium imports pressures producers.", impact: -0.018, target: "ALUM", market: "COMM" },
    { text: "Zinc mine closure in Peru disrupts 8% of global supply.", impact: 0.028, target: "ZINC", market: "COMM" },
    { text: "Zinc galvanization demand from construction sector at 5-year high.", impact: 0.020, target: "ZINC", market: "COMM" },
    { text: "Zinc prices plunge on weak Chinese steel sector demand.", impact: -0.025, target: "ZINC", market: "COMM" },
    { text: "OPEC+ announces surprise crude oil production cut.", impact: 0.045, target: "CRUDE", market: "COMM" },
    { text: "US crude inventories rise unexpectedly, easing supply fears.", impact: -0.035, target: "CRUDE", market: "COMM" },
    { text: "Natural gas futures spike 10% on severe winter storm forecast.", impact: 0.055, target: "NATGAS", market: "COMM" },
    { text: "Platinum deficit deepens as South African power cuts hit mines.", impact: 0.032, target: "PLAT", market: "COMM" },
    { text: "Palladium slumps to 4-year low as automakers switch to platinum.", impact: -0.042, target: "PALLAD", market: "COMM" },
    { text: "Lead batteries recycling rate hits new highs, pressuring primary lead prices.", impact: -0.015, target: "LEAD", market: "COMM" },

    // ---- CRYPTO ----
    { text: "SEC approves Ethereum spot ETF. Institutional inflows expected to surge.", impact: 0.060, target: "ETH", market: "CRYPTO" },
    { text: "Bitcoin halving event completed successfully. Block reward slashed.", impact: 0.045, target: "BTC", market: "CRYPTO" },
    { text: "Solana network suffers 4-hour outage. Price dumps on stability concerns.", impact: -0.080, target: "SOL", market: "CRYPTO" },
    { text: "Major US bank announces Bitcoin custody services for high-net-worth clients.", impact: 0.035, target: "BTC", market: "CRYPTO" },
    { text: "Binance reaches settlement with US DOJ. Regulatory overhang cleared.", impact: 0.050, target: "BNB", market: "CRYPTO" },
    { text: "Ripple wins major court ruling against SEC. XRP labeled not a security.", impact: 0.120, target: "XRP", market: "CRYPTO" },
    { text: "Elon Musk tweets picture of his dog. Dogecoin rallies instantly.", impact: 0.090, target: "DOGE", market: "CRYPTO" },
    { text: "US Government transfers 10,000 seized BTC to Coinbase. Massive dump expected.", impact: -0.050, target: "BTC", market: "CRYPTO" },
    { text: "Crypto exchange hacked for $500M. Sector-wide panic selling.", impact: -0.040, target: "ALL_CRYPTO", market: "CRYPTO" },
    { text: "Global crypto adoption hits 10% milestone. Strong retail buying.", impact: 0.030, target: "ALL_CRYPTO", market: "CRYPTO" },

    // ---- FOREX ----
    { text: "ECB cuts interest rates by 25bps. Euro weakens against the Dollar.", impact: -0.008, target: "EURUSD", market: "FX" },
    { text: "Bank of England unexpectedly raises rates to fight inflation. Pound surges.", impact: 0.012, target: "GBPUSD", market: "FX" },
    { text: "Bank of Japan intervenes in FX market. Massive yen buying seen.", impact: -0.020, target: "USDJPY", market: "FX" },
    { text: "US Non-Farm Payrolls crush expectations. Dollar rallies across the board.", impact: -0.006, target: "EURUSD", market: "FX" },
    { text: "US Non-Farm Payrolls crush expectations. Dollar rallies across the board.", impact: 0.010, target: "USDJPY", market: "FX" },
    { text: "Australia reports record trade surplus on commodity exports. AUD gains.", impact: 0.008, target: "AUDUSD", market: "FX" },
    { text: "Bank of Canada pauses rate hikes. Canadian Dollar drops.", impact: 0.005, target: "USDCAD", market: "FX" },

    // ---- NASDAQ — AMD ----
    { text: "AMD MI300X AI accelerator ships to 12 new hyperscaler clients. Data center revenue doubles.", impact: 0.040, target: "AMD", market: "NASDAQ" },
    { text: "AMD Ryzen 9000 series captures 35% consumer CPU market share. Intel losing ground.", impact: 0.028, target: "AMD", market: "NASDAQ" },
    { text: "AMD supply chain issues delay RDNA 4 GPU launch. Stock falls on news.", impact: -0.030, target: "AMD", market: "NASDAQ" },
    { text: "AMD partners with Microsoft for custom AI training chips. Multi-year $3B deal.", impact: 0.035, target: "AMD", market: "NASDAQ" },

    // ---- NASDAQ — ADBE ----
    { text: "Adobe Firefly AI generated 9 billion images. Creatives enterprise subscriptions up 28%.", impact: 0.030, target: "ADBE", market: "NASDAQ" },
    { text: "Adobe Creative Cloud price increases 10%. Wall Street cheers margin expansion.", impact: 0.025, target: "ADBE", market: "NASDAQ" },
    { text: "Adobe Q2 results: Digital Media ARR hits $16.8B. Beat by $400M.", impact: 0.032, target: "ADBE", market: "NASDAQ" },
    { text: "Adobe faces growing pressure from Canva and Figma. Market share risk.", impact: -0.025, target: "ADBE", market: "NASDAQ" },

    // ---- NASDAQ — AVGO ----
    { text: "Broadcom custom AI ASIC revenue surges: hyperscaler AI pods driving $10B opportunity.", impact: 0.040, target: "AVGO", market: "NASDAQ" },
    { text: "Broadcom VMware integration complete. Enterprise software ARR at $8.5B run rate.", impact: 0.030, target: "AVGO", market: "NASDAQ" },
    { text: "Broadcom Ethernet networking chips win deals from Meta and Google. AI infrastructure play.", impact: 0.028, target: "AVGO", market: "NASDAQ" },
    { text: "Broadcom loses one hyperscaler AI chip contract. Revenue concentration risk.", impact: -0.025, target: "AVGO", market: "NASDAQ" },

    // ---- NASDAQ — COIN ----
    { text: "Coinbase approved for crypto futures trading in 3 new countries. Regulatory win.", impact: 0.045, target: "COIN", market: "NASDAQ" },
    { text: "Bitcoin ETF inflows hit $2B single day. Coinbase custody fees surge.", impact: 0.050, target: "COIN", market: "NASDAQ" },
    { text: "Coinbase Q2 revenue triples on crypto bull run. Record trading volumes.", impact: 0.055, target: "COIN", market: "NASDAQ" },
    { text: "SEC launches new probe into Coinbase staking products. Regulatory overhang.", impact: -0.050, target: "COIN", market: "NASDAQ" },
    { text: "Crypto winter hits Coinbase: trading revenue drops 60% QoQ on low volatility.", impact: -0.040, target: "COIN", market: "NASDAQ" },

    // ---- NASDAQ — PLTR ----
    { text: "Palantir wins $1.5B US Army AI decision-making platform contract. Largest ever.", impact: 0.055, target: "PLTR", market: "NASDAQ" },
    { text: "Palantir AIP commercial revenue grows 55% YoY. Boot camp model driving enterprise deals.", impact: 0.040, target: "PLTR", market: "NASDAQ" },
    { text: "Palantir added to S&P 500. Passive inflows expected of $2B.", impact: 0.045, target: "PLTR", market: "NASDAQ" },
    { text: "Palantir CEO dumps $300M of shares. Insider selling weighs on sentiment.", impact: -0.030, target: "PLTR", market: "NASDAQ" },

    // ---- NASDAQ — MU ----
    { text: "Micron HBM3E memory wins NVIDIA H200 design. AI memory revenue to triple.", impact: 0.045, target: "MU", market: "NASDAQ" },
    { text: "Micron raises Q3 guidance: data center DRAM pricing up 30%. Memory supercycle.", impact: 0.040, target: "MU", market: "NASDAQ" },
    { text: "Micron's new NAND factory in Idaho starts production. Cost structure improves.", impact: 0.025, target: "MU", market: "NASDAQ" },
    { text: "PC DRAM oversupply hits Micron. Spot prices down 18%. Margin pressure.", impact: -0.030, target: "MU", market: "NASDAQ" },

    // ---- MORE ALL_NASDAQ ----
    { text: "NASDAQ 100 hits all-time high. AI-driven earnings euphoria sweeps tech sector.", impact: 0.025, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "Mag-7 earnings season: all 7 companies beat estimates. NASDAQ rallies 3%.", impact: 0.030, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "US antitrust regulator files sweeping Big Tech breakup proposal. Sector tanks.", impact: -0.030, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "AI capex spending upgraded by all hyperscalers. Semicon and cloud stocks surge.", impact: 0.028, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "US Treasury yield drops to 4.1%. Growth stocks re-rate higher.", impact: 0.020, target: "ALL_NASDAQ", market: "NASDAQ" },
    { text: "Tech layoffs resume: 25,000 jobs cut across 10 companies. Margin expansion.", impact: 0.015, target: "ALL_NASDAQ", market: "NASDAQ" },

    { text: "SAIC Motor EV sales jump 30% in Europe.", impact: 0.022, target: "SAIC", market: "SSE" },
    { text: "CITIC Securities reports record trading volumes in Q2.", impact: 0.025, target: "CITICS", market: "SSE" },
    { text: "Sinopec discovers major new oil field in Tarim Basin.", impact: 0.035, target: "SINOPEC", market: "SSE" },
    { text: "Agricultural Bank of China expands rural lending by 15%.", impact: 0.018, target: "AGBANK", market: "SSE" },
    { text: "China Life Insurance premium income hits all-time high.", impact: 0.020, target: "CHINALIFE", market: "SSE" },
    { text: "ZTE wins massive 5G infrastructure contract in Middle East.", impact: 0.040, target: "ZTE", market: "SSE" },
    { text: "Baosteel announces aggressive carbon-neutral transition plan.", impact: 0.015, target: "BAOSTEEL", market: "SSE" },
    // ---- SSE — BYD ----
    { text: "BYD monthly EV sales hit 500,000 units for first time. Global No.1 title defended.", impact: 0.040, target: "BYD", market: "SSE" },
    { text: "BYD launches next-gen Blade Battery 2.0: 800km range. Orders flood in.", impact: 0.035, target: "BYD", market: "SSE" },
    { text: "BYD opens first Europe gigafactory in Hungary. EU tariff bypass strategy.", impact: 0.030, target: "BYD", market: "SSE" },
    { text: "BYD EV price war escalates. Entry-model cut to CNY 69,800. Margins squeezed.", impact: -0.025, target: "BYD", market: "SSE" },

    // ---- SSE — CATL ----
    { text: "CATL solid-state battery mass production announced for 2027. Revolution ahead.", impact: 0.045, target: "CATL", market: "SSE" },
    { text: "CATL signs €8B battery supply deal with BMW and Mercedes. European dominance.", impact: 0.035, target: "CATL", market: "SSE" },
    { text: "CATL Shenxing super-fast charging battery: 400km in 10 minutes. Game changer.", impact: 0.030, target: "CATL", market: "SSE" },
    { text: "US CATL battery blacklist expands. North American market access blocked.", impact: -0.035, target: "CATL", market: "SSE" },

    // ---- SSE — LONGI ----
    { text: "LONGi breaks solar efficiency world record at 33.9%. Revolutionary milestone.", impact: 0.040, target: "LONGI", market: "SSE" },
    { text: "LONGi bifacial Hi-MO 9 module wins 10GW tender from Saudi Arabia.", impact: 0.030, target: "LONGI", market: "SSE" },
    { text: "Solar panel oversupply crisis: LONGi cuts ASP guidance by 15%.", impact: -0.030, target: "LONGI", market: "SSE" },

    // ---- SSE — SAIC ----
    { text: "SAIC IM Motors launches L4 autonomous EV. Robotaxi permit in 5 Chinese cities.", impact: 0.030, target: "SAIC", market: "SSE" },
    { text: "SAIC-GM joint venture sales drop 40% YoY. ICE vehicle demand collapses.", impact: -0.030, target: "SAIC", market: "SSE" },
    { text: "SAIC MG brand hits record overseas sales in Europe and India. Export strategy pays.", impact: 0.025, target: "SAIC", market: "SSE" },

    // ---- SSE — CITICS ----
    { text: "CITIC Securities IPO pipeline at 5-year high. Capital markets activity booming.", impact: 0.025, target: "CITICS", market: "SSE" },
    { text: "CITIC Securities reports record wealth management AUM of CNY 5.2 trillion.", impact: 0.022, target: "CITICS", market: "SSE" },
    { text: "China brokerage industry consolidation: CITIC merges with CSC Securities.", impact: 0.030, target: "CITICS", market: "SSE" },

    // ---- MORE ALL_SSE ----
    { text: "China PBOC announces targeted easing: CNY 500B injected via MLF.", impact: 0.022, target: "ALL_SSE", market: "SSE" },
    { text: "China property market stabilizes: home prices rise for 1st time in 18 months.", impact: 0.028, target: "ALL_SSE", market: "SSE" },
    { text: "China consumer confidence index hits 2-year high. Domestic demand recovering.", impact: 0.025, target: "ALL_SSE", market: "SSE" },
    { text: "China retaliatory tariffs on US semiconductors. Tech sector under pressure.", impact: -0.028, target: "ALL_SSE", market: "SSE" },
    { text: "China stock connect sees record HK northbound inflow of CNY 15B in one week.", impact: 0.022, target: "ALL_SSE", market: "SSE" },
    { text: "China imposes platform economy regulation on big tech. Ant, Tencent selloff.", impact: -0.020, target: "ALL_SSE", market: "SSE" },

    // ---- TSE — MUFG ----
    { text: "MUFG benefits from BOJ rate hike: net interest income rises CNY 800B YoY.", impact: 0.030, target: "MUFG", market: "TSE" },
    { text: "MUFG sells remaining Morgan Stanley stake for $5B profit. Capital boost.", impact: 0.025, target: "MUFG", market: "TSE" },
    { text: "MUFG announces record share buyback: JPY 500B. Highest ever by a Japanese bank.", impact: 0.028, target: "MUFG", market: "TSE" },

    // ---- TSE — FASTRET (Uniqlo) ----
    { text: "Fast Retailing Uniqlo India opens 50th store. Asia revenue contribution hits 40%.", impact: 0.025, target: "FASTRET", market: "TSE" },
    { text: "Uniqlo LifeWear collaboration with Lemaire sells out in 3 hours globally.", impact: 0.022, target: "FASTRET", market: "TSE" },
    { text: "Fast Retailing raises FY profit guidance 15%. Overseas same-store sales +18%.", impact: 0.030, target: "FASTRET", market: "TSE" },
    { text: "Uniqlo faces copycat competition in China. Market share erosion risk.", impact: -0.020, target: "FASTRET", market: "TSE" },

    // ---- TSE — KEYENCE ----
    { text: "Keyence factory automation sensors see record orders from EV gigafactories.", impact: 0.035, target: "KEYENCE", market: "TSE" },
    { text: "Keyence launches AI-vision inspection system. Semiconductor fab clients surge.", impact: 0.030, target: "KEYENCE", market: "TSE" },
    { text: "Keyence Q3 operating margin at 55%. World-class profitability sustained.", impact: 0.025, target: "KEYENCE", market: "TSE" },

    // ---- TSE — DAIKIN ----
    { text: "Daikin India air conditioner sales up 35% on record heat wave. Market share 30%.", impact: 0.030, target: "DAIKIN", market: "TSE" },
    { text: "Daikin Europe heat pump revenue doubles. EU energy transition accelerates.", impact: 0.028, target: "DAIKIN", market: "TSE" },
    { text: "Daikin launches next-gen refrigerant R-290 ACs. Ahead of 2025 EU regulation.", impact: 0.022, target: "DAIKIN", market: "TSE" },

    // ---- TSE — CANON ----
    { text: "Canon medical imaging division wins 1,000-unit CT scanner order from US hospitals.", impact: 0.025, target: "CANON7751", market: "TSE" },
    { text: "Canon semiconductor lithography equipment orders surge 40% on AI chip demand.", impact: 0.030, target: "CANON7751", market: "TSE" },
    { text: "Canon mirrorless camera R6 III sells out globally. Camera segment revenue up 22%.", impact: 0.018, target: "CANON7751", market: "TSE" },

    { text: "Nissan announces aggressive solid-state battery timeline for 2028.", impact: 0.035, target: "NISSAN", market: "TSE" },
    { text: "Panasonic ramps up 4680 battery cell production for Tesla.", impact: 0.032, target: "PANASONIC", market: "TSE" },
    { text: "Hitachi energy grid solutions see record demand from US and Europe.", impact: 0.028, target: "HITACHI", market: "TSE" },
    { text: "Mitsui & Co. reports stellar earnings on strong commodities trading.", impact: 0.025, target: "MITSUI", market: "TSE" },
    { text: "Nidec precision motor sales soar on data center cooling demand.", impact: 0.038, target: "NIDEC", market: "TSE" },

    // ---- MORE ALL_TSE ----
    { text: "Yen weakens to 155 vs USD. Japan exporters hit 12-month earnings high.", impact: 0.022, target: "ALL_TSE", market: "TSE" },
    { text: "Yen strengthens sharply to 135. Japan export stocks face earnings downgrade.", impact: -0.022, target: "ALL_TSE", market: "TSE" },
    { text: "Tokyo Stock Exchange corporate governance reforms: 80% of listed firms now buy back shares.", impact: 0.020, target: "ALL_TSE", market: "TSE" },
    { text: "Japan PM announces ¥50 trillion economic package. Domestic demand stocks rally.", impact: 0.025, target: "ALL_TSE", market: "TSE" },
    { text: "Japan core inflation hits 3.5%. BOJ signals faster pace of rate normalization.", impact: -0.018, target: "ALL_TSE", market: "TSE" },
    { text: "Warren Buffett increases Japan trading house stake to 9.9%. Nikkei rally.", impact: 0.025, target: "ALL_TSE", market: "TSE" },
    { text: "Japan GPIF rebalances: $12B shift into domestic equities from bonds.", impact: 0.022, target: "ALL_TSE", market: "TSE" }
];

// Map target keywords to stocks
function getNewsTargets(target) {
    switch (target) {
        case "RANDOM":
            var nseStocks = marketStocks.filter(function(s){ return s.market === 'NSE'; });
            var s = nseStocks[Math.floor(Math.random() * nseStocks.length)];
            return { stocks: [s], name: s.name };
        case "IT":         return { stocks: marketStocks.filter(function(s) { return s.sector === "IT" && s.market === 'NSE'; }) };
        case "BANK":       return { stocks: marketStocks.filter(function(s) { return (s.sector === "Banking" || s.sector === "Finance") && s.market === 'NSE'; }) };
        case "ENERGY":     return { stocks: marketStocks.filter(function(s) { return s.sector === "Energy" && s.market === 'NSE'; }) };
        case "AUTO":       return { stocks: marketStocks.filter(function(s) { return s.sector === "Auto" && s.market === 'NSE'; }) };
        case "PHARMA":     return { stocks: marketStocks.filter(function(s) { return s.sector === "Pharma"; }) };
        case "METAL":      return { stocks: marketStocks.filter(function(s) { return s.sector === "Metal" && s.market === 'NSE'; }) };
        case "FMCG":       return { stocks: marketStocks.filter(function(s) { return s.sector === "FMCG"; }) };
        case "TELECOM":    return { stocks: marketStocks.filter(function(s) { return s.sector === "Telecom"; }) };
        case "INFRA":      return { stocks: marketStocks.filter(function(s) { return s.sector === "Infra"; }) };
        case "POWER":      return { stocks: marketStocks.filter(function(s) { return s.sector === "Power"; }) };
        case "CEMENT":     return { stocks: marketStocks.filter(function(s) { return s.sector === "Cement"; }) };
        case "CONSUMER":   return { stocks: marketStocks.filter(function(s) { return s.sector === "Consumer"; }) };
        case "TECH":       return { stocks: marketStocks.filter(function(s) { return s.sector === "Tech" && s.market === 'NSE'; }) };
        case "DEFENSE":    return { stocks: marketStocks.filter(function(s) { return s.ticker === "BEL"; }) };
        case "OILGAS":     return { stocks: marketStocks.filter(function(s) { return s.ticker === "ONGC" || s.ticker === "BPCL"; }) };
        case "ALL":        return { stocks: marketStocks.filter(function(s) { return s.market === 'NSE'; }) };
        case "ALL_NASDAQ": return { stocks: marketStocks.filter(function(s) { return s.market === 'NASDAQ'; }) };
        case "ALL_SSE":    return { stocks: marketStocks.filter(function(s) { return s.market === 'SSE'; }) };
        case "ALL_TSE":    return { stocks: marketStocks.filter(function(s) { return s.market === 'TSE'; }) };
        case "ALL_COMM":   return { stocks: marketStocks.filter(function(s) { return s.market === 'COMM'; }) };
        case "ALL_CRYPTO": return { stocks: marketStocks.filter(function(s) { return s.market === 'CRYPTO'; }) };
        case "ALL_FX":     return { stocks: marketStocks.filter(function(s) { return s.market === 'FX'; }) };
        default:           return { stocks: marketStocks.filter(function(s) { return s.ticker === target; }) };
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
    sensexBase: 74500,
    sensexValue: 74500,
    sentiment: 0,  // -100 to +100
    chartType: 'line',
    chartScale: 'linear',  // 'linear' | 'log' | 'pct'
    timeframe: '30M',
    viewLen: 30,
    candlePeriod: 5,
    slTargets: {},   // { ticker: { sl: num|null, target: num|null } }
    wlMarketFilter: 'ALL',   // watchlist market filter
    newsMarketFilter: 'ALL',  // news feed market filter
    showSMA: false,
    showEMA: false,
    pendingOrders: [],
    marginCallThrottle: 0
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
        var volumes = chart._volumes;
        var isLight = state.theme === 'light';
        var chartArea = chart.chartArea;
        if (!chartArea) return;

        // ── Volume histogram (bottom 18% of chart) ──
        if (volumes && volumes.length) {
            var volAreaH = (chartArea.bottom - chartArea.top) * 0.18;
            var volBottom = chartArea.bottom;
            var maxVol = 0;
            for (var vi = 0; vi < volumes.length; vi++) { if (volumes[vi] > maxVol) maxVol = volumes[vi]; }
            if (maxVol > 0) {
                var volCW = Math.max(2, Math.floor((xScale.width / (volumes.length + 1)) * 0.65));
                for (var vi2 = 0; vi2 < volumes.length; vi2++) {
                    if (!volumes[vi2]) continue;
                    var xv = xScale.getPixelForValue(vi2);
                    var barH = (volumes[vi2] / maxVol) * volAreaH * 0.88;
                    var isBullV = ohlc && ohlc[vi2]
                        ? ohlc[vi2].c >= ohlc[vi2].o
                        : (chart._lineData && vi2 > 0 ? chart._lineData[vi2] >= chart._lineData[vi2 - 1] : true);
                    ctx.fillStyle = isBullV
                        ? (isLight ? 'rgba(0,168,70,0.30)' : 'rgba(0,200,83,0.25)')
                        : (isLight ? 'rgba(213,0,50,0.30)'  : 'rgba(255,23,68,0.25)');
                    ctx.fillRect(xv - volCW / 2, volBottom - barH, volCW, barH);
                }
            }
        }

        if (!ohlc || !ohlc.length) return;
        var count = ohlc.length;
        var rawW = xScale.width / (count + 1);
        var candleW = Math.max(2, Math.min(18, Math.floor(rawW * 0.70)));
        var wickW = candleW > 6 ? 1.5 : 1;

        ohlc.forEach(function(d, i) {
            var xPos = xScale.getPixelForValue(i);
            var openY  = yScale.getPixelForValue(d.o);
            var closeY = yScale.getPixelForValue(d.c);
            var highY  = yScale.getPixelForValue(d.h);
            var lowY   = yScale.getPixelForValue(d.l);
            var isBull = d.c >= d.o;

            var bodyTop = Math.min(openY, closeY);
            var bodyH   = Math.max(1.5, Math.abs(closeY - openY));

            var bullHi  = isLight ? '#00d068' : '#00e676';
            var bullLo  = isLight ? '#007a33' : '#00a846';
            var bearHi  = isLight ? '#ff455a' : '#ff5252';
            var bearLo  = isLight ? '#a80025' : '#c62828';

            // Wick (upper)
            ctx.beginPath();
            ctx.strokeStyle = isBull ? bullLo : bearLo;
            ctx.lineWidth = wickW;
            ctx.moveTo(xPos, highY);
            ctx.lineTo(xPos, bodyTop);
            ctx.stroke();
            // Wick (lower)
            ctx.beginPath();
            ctx.moveTo(xPos, bodyTop + bodyH);
            ctx.lineTo(xPos, lowY);
            ctx.stroke();

            // Candle body
            if (candleW >= 4) {
                try {
                    var grad = ctx.createLinearGradient(xPos, bodyTop, xPos, bodyTop + bodyH);
                    grad.addColorStop(0, isBull ? bullHi : bearHi);
                    grad.addColorStop(1, isBull ? bullLo : bearLo);
                    ctx.fillStyle = grad;
                } catch (e) {
                    ctx.fillStyle = isBull ? bullLo : bearLo;
                }
            } else {
                ctx.fillStyle = isBull ? bullLo : bearLo;
            }
            ctx.fillRect(xPos - candleW / 2, bodyTop, candleW, bodyH);

            // Doji / thin candle border highlight
            if (bodyH <= 2) {
                ctx.strokeStyle = isBull ? bullHi : bearHi;
                ctx.lineWidth = 1;
                ctx.strokeRect(xPos - candleW / 2, bodyTop, candleW, Math.max(1, bodyH));
            }
        });
    }
};

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", function() {
    initMarket();
    setupListeners();
    renderAll();
    renderFxRates();
    startClock();
});

function initMarket() {
    marketStocks.forEach(function(s) {
        // Generate 1 month (22 days × 375 ticks) of realistic price history
        s.preHistory = generatePreHistory(s, 22);
        // Live history starts with a single tick (preHistory fills the visual history)
        s.history = [s.ltp];
        s.volumeHistory = [0];
        s.open = s.ltp;
        // prevClose = last tick of pre-history (the "previous day's close")
        s.prevClose = s.preHistory.length > 0 ? s.preHistory[s.preHistory.length - 1] : s.ltp;
        s._prevTick = s.ltp;
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
    document.getElementById('cash-stat').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openSettings();
        }
    });
    document.getElementById('btn-chart-line').addEventListener('click', function() { setChartType('line'); });
    document.getElementById('btn-chart-candle').addEventListener('click', function() { setChartType('candle'); });

    // Order type change (Market vs Limit)
    document.getElementById('order-type').addEventListener('change', function(e) {
        var grp = document.getElementById('limit-price-group');
        if (e.target.value === 'LIMIT') {
            grp.classList.remove('hidden');
            var stock = state.activeStock;
            if (stock) {
                document.getElementById('order-limit-price').value = stock.ltp;
            }
        } else {
            grp.classList.add('hidden');
        }
    });

    // Scale buttons
    document.getElementById('btn-scale-linear').addEventListener('click', function() { setChartScale('linear'); });
    document.getElementById('btn-scale-log').addEventListener('click', function() { setChartScale('log'); });
    document.getElementById('btn-scale-pct').addEventListener('click', function() { setChartScale('pct'); });

    // Technical Indicators
    document.getElementById('btn-toggle-sma').addEventListener('click', function(e) {
        state.showSMA = !state.showSMA;
        e.currentTarget.classList.toggle('active', state.showSMA);
        if (state.activeStock) renderChart(state.activeStock);
    });
    document.getElementById('btn-toggle-ema').addEventListener('click', function(e) {
        state.showEMA = !state.showEMA;
        e.currentTarget.classList.toggle('active', state.showEMA);
        if (state.activeStock) renderChart(state.activeStock);
    });
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
    document.getElementById('pending-orders-tab').addEventListener('click', function() { switchBottomTab('pending'); });
    document.getElementById('history-tab').addEventListener('click', function() { switchBottomTab('history'); });
    document.getElementById('btn-close-all').addEventListener('click', closeAllPositions);
    document.getElementById('btn-export-csv').addEventListener('click', exportTradeHistoryCSV);

    // SL / Target auto-set when inputs change
    document.getElementById('sl-price').addEventListener('change', saveSlTarget);
    document.getElementById('target-price').addEventListener('change', saveSlTarget);

    // Watchlist search
    var searchInp = document.getElementById('wl-search-input');
    if (searchInp) {
        searchInp.addEventListener('input', renderWatchlist);
        searchInp.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { searchInp.value = ''; renderWatchlist(); }
        });
    }

    // Watchlist market filter buttons
    document.querySelectorAll('.wl-mf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.wl-mf-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.wlMarketFilter = btn.dataset.market;
            renderWatchlist();
        });
    });

    // News market filter buttons
    document.querySelectorAll('.news-mf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.news-mf-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.newsMarketFilter = btn.dataset.market;
            // Show/hide existing news items
            var nf = state.newsMarketFilter;
            var container = document.getElementById('news-container');
            Array.from(container.children).forEach(function(el) {
                if (nf === 'ALL') {
                    el.style.display = '';
                } else {
                    var dm = el.getAttribute('data-market') || 'NSE';
                    el.style.display = (dm === nf) ? '' : 'none';
                }
            });
        });
    });
}

// ==================== SETTINGS / MODIFIABLE CASH ====================
function openSettings() {
    document.getElementById('settings-cash').value = INITIAL_MARGIN;
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
        state.pendingOrders = [];
        state.tradeHistory = [];
        state.day = 1;
        state.time = START_TIME;
        state.newsCount = 0;
        state.marketOpen = true;
        state.isRunning = true;
        state.sentiment = 0;
        state.niftyValue = 22500;
        state.niftyBase = 22500;
        state.sensexValue = 74500;
        state.sensexBase = 74500;

        marketStocks.forEach(function(s) {
            s.ltp = s.base;
            s.open = s.base;
            s.prevClose = s.base;
            s._prevTick = s.base;
            s.preHistory = generatePreHistory(s, 22);
            s.history = [s.ltp];
            s.volumeHistory = [0];
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
        _wlCache = {}; _wlLastOrder = ''; // force watchlist DOM rebuild

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

// ==================== CHART SCALE TOGGLE ====================
function setChartScale(scale) {
    var wasLog = state.chartScale === 'log';
    var willLog = scale === 'log';
    state.chartScale = scale;
    document.querySelectorAll('.scale-btn').forEach(function(b) { b.classList.remove('active'); });
    var btn = document.getElementById('btn-scale-' + scale);
    if (btn) btn.classList.add('active');
    // Log ↔ Linear axis type switch requires chart rebuild
    if (wasLog !== willLog && chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
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
    else if (tab === 'pending') document.getElementById('pending-orders-tab').classList.add('active');
    else document.getElementById('history-tab').classList.add('active');

    document.getElementById('equity-table').classList.toggle('hidden', tab !== 'equity');
    document.getElementById('options-table').classList.toggle('hidden', tab !== 'options');
    document.getElementById('pending-table').classList.toggle('hidden', tab !== 'pending');
    document.getElementById('history-table').classList.toggle('hidden', tab !== 'history');

    if (tab === 'options') renderOptionsTable();
    if (tab === 'pending') renderPendingTable();
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

    // Price simulation: 3 micro-steps per tick for smooth, realistic movement
    var totalChange = 0;
    var microSteps = 3;
    // Shared market factor (correlation / sector rotation)
    var marketFactor = (Math.random() - 0.5) * 0.004 * VOL_MULTIPLIER;
    var sectorFactors = {};

    marketStocks.forEach(function(stock) {
        stock._prevTick = stock.ltp; // save for flash animation
        if (stock.circuitHit) return;

        var v = stock.vol * VOL_MULTIPLIER;
        var isNoCircuit = stock.market === 'CRYPTO' || stock.market === 'FX' || stock.market === 'BOND';
        var limitMult = isNoCircuit ? 100.0 : CIRCUIT_LIMIT;
        var upperCircuit = stock.open * (1 + limitMult);
        var lowerCircuit = stock.open * (1 - limitMult);
        var price = stock.ltp;

        // Sector factor (each sector moves together slightly)
        if (!sectorFactors[stock.sector]) {
            sectorFactors[stock.sector] = (Math.random() - 0.5) * 0.006 * VOL_MULTIPLIER;
        }
        var sectorBias = sectorFactors[stock.sector];

        // 3 micro-ticks for realism
        for (var step = 0; step < microSteps; step++) {
            var drift = (Math.random() - 0.502) * v * 1.4;
            var meanRevert = (stock.base - price) / stock.base * 0.0008;
            // Combine: stock drift + sector bias + broad market
            var totalMove = drift + meanRevert + sectorBias * 0.4 + marketFactor * 0.3;
            price = price * (1 + totalMove);
            price = Math.max(0.0001, price);

            if (price >= upperCircuit) {
                price = upperCircuit;
                if (step === microSteps - 1 && !stock.circuitHit) {
                    stock.circuitHit = 'UC';
                    toast("CIRCUIT", stock.ticker + " hit upper circuit +" + (CIRCUIT_LIMIT * 100) + "%!", "success");
                }
                break;
            } else if (price <= lowerCircuit) {
                price = lowerCircuit;
                if (step === microSteps - 1 && !stock.circuitHit) {
                    stock.circuitHit = 'LC';
                    toast("CIRCUIT", stock.ticker + " hit lower circuit -" + (CIRCUIT_LIMIT * 100) + "%!", "error");
                }
                break;
            }
        }

        var pDecimals = stock.ltp < 10 ? 4 : 2;
        stock.ltp = parseFloat(price.toFixed(pDecimals));
        stock.history.push(stock.ltp);
        if (stock.history.length > state.historyLen) stock.history.shift();

        // OHLCV candle aggregation
        var tickVol = Math.floor(Math.random() * 8000 + 800);
        stock.volumeHistory.push(tickVol);
        if (stock.volumeHistory.length > state.historyLen) stock.volumeHistory.shift();
        if (!stock.currentCandle) {
            stock.currentCandle = { o: stock.ltp, h: stock.ltp, l: stock.ltp, c: stock.ltp, v: tickVol, ticks: 1 };
        } else {
            if (stock.ltp > stock.currentCandle.h) stock.currentCandle.h = stock.ltp;
            if (stock.ltp < stock.currentCandle.l) stock.currentCandle.l = stock.ltp;
            stock.currentCandle.c = stock.ltp;
            stock.currentCandle.v += tickVol;
            stock.currentCandle.ticks++;
            if (stock.currentCandle.ticks >= state.candlePeriod) {
                stock.ohlcHistory.push({ o: stock.currentCandle.o, h: stock.currentCandle.h, l: stock.currentCandle.l, c: stock.currentCandle.c, v: stock.currentCandle.v });
                if (stock.ohlcHistory.length > 120) stock.ohlcHistory.shift();
                stock.currentCandle = null;
            }
        }

        // Volume simulation (realistic ranges based on stock liquidity)
        stock.volume += tickVol;

        // Track for NIFTY
        totalChange += (stock.ltp - stock.open) / stock.open;
    });

    // NIFTY index simulation
    var avgChange = totalChange / marketStocks.length;
    state.niftyValue = parseFloat((state.niftyBase * (1 + avgChange * 2)).toFixed(2));
    state.niftyHistory.push(state.niftyValue);
    if (state.niftyHistory.length > state.historyLen) state.niftyHistory.shift();
    // SENSEX follows NIFTY closely (ratio ~3.3x, with slight independent noise)
    var sensexChange = avgChange * 2.05 + (Math.random() - 0.5) * 0.0008;
    state.sensexValue = parseFloat((state.sensexBase * (1 + sensexChange)).toFixed(2));

    // Market sentiment (-100 to +100)
    var gainers = marketStocks.filter(function(s) { return s.ltp >= s.open; }).length;
    state.sentiment = Math.round(((gainers / marketStocks.length) - 0.5) * 200);

    // SL / Target auto-trigger
    Object.keys(state.slTargets).forEach(function(ticker) {
        var st = state.slTargets[ticker];
        if (!st) return;
        var pos = state.positions[ticker];
        if (!pos) { delete state.slTargets[ticker]; return; }
        var stock = stockMap[ticker];
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

    // Forex Sync
    if (stockMap["USDINR"]) EXCHANGE_RATES.USD = stockMap["USDINR"].ltp;
    if (stockMap["CNYINR"]) EXCHANGE_RATES.CNY = stockMap["CNYINR"].ltp;
    if (stockMap["JPYINR"]) EXCHANGE_RATES.JPY = stockMap["JPYINR"].ltp;

    // Margin Check Loop
    if (state.margin < 0) {
        if (state.marginCallThrottle <= 0) {
            toast("MARGIN CALL", "Your cash balance is below zero (\u20b9" + state.margin.toFixed(2) + ")! Square off some positions to avoid forced liquidation.", "error");
            state.marginCallThrottle = 15; // throttle warning toast
        } else {
            state.marginCallThrottle--;
        }
    } else {
        state.marginCallThrottle = 0;
    }

    // Forced Liquidation Check
    var portVal = calcPortfolioValue();
    var hasOpenPositions = Object.keys(state.positions).length > 0 || Object.keys(state.optionsPositions).length > 0;
    if (portVal < INITIAL_MARGIN * 0.1 && hasOpenPositions) {
        liquidateAllForced();
    }

    // Limit Order Matching
    if (state.pendingOrders && state.pendingOrders.length > 0) {
        var remainingPending = [];
        state.pendingOrders.forEach(function(order) {
            var stock = stockMap[order.ticker];
            if (!stock) return;
            var ltp = stock.ltp;
            var triggered = false;

            if (order.side === 'BUY' || order.side === 'COVER') {
                if (ltp <= order.limitPrice) triggered = true;
            } else if (order.side === 'SELL' || order.side === 'SHORT') {
                if (ltp >= order.limitPrice) triggered = true;
            }

            if (triggered) {
                // Block execution on circuit hit
                if (stock.circuitHit === 'UC' && (order.side === 'BUY' || order.side === 'COVER')) {
                    remainingPending.push(order);
                } else if (stock.circuitHit === 'LC' && (order.side === 'SELL' || order.side === 'SHORT')) {
                    remainingPending.push(order);
                } else {
                    var fillPrice = stock.ltp;
                    var success = processEquityTrade(stock, order.side, order.qty, fillPrice);
                    if (success) {
                        toast("Order Executed", "Limit order filled: " + order.side + " " + order.qty + " " + order.ticker + " @ " + fillPrice.toFixed(2), "success");
                    } else {
                        toast("Order Cancelled", "Limit order cancelled (Insufficient Margin): " + order.side + " " + order.qty + " " + order.ticker + " @ " + fillPrice.toFixed(2), "error");
                    }
                }
            } else {
                remainingPending.push(order);
            }
        });
        state.pendingOrders = remainingPending;
    }

    // News events
    if (Math.random() < NEWS_FREQ) triggerNewsEvent();

    renderAll();
}

// ==================== NEW DAY ====================
function showDayEndOverlay() {
    var pnl = calcTotalPNL();

    document.getElementById('ov-day-label').textContent = 'Day ' + state.day;
    var pnlEl = document.getElementById('ov-day-pnl');
    pnlEl.textContent = fmtCur(pnl);
    pnlEl.className = 'ov-stat-val mono ' + (pnl >= 0 ? 'up' : 'dn');
    document.getElementById('ov-portfolio').textContent = fmtCur(calcPortfolioValue());
    document.getElementById('ov-cash').textContent = fmtCur(state.margin);
    var ovBrokerageEl = document.getElementById('ov-brokerage');
    if (ovBrokerageEl) ovBrokerageEl.textContent = fmtCur(state.totalBrokerage || 0);
    document.getElementById('ov-positions').textContent = Object.keys(state.positions).length + Object.keys(state.optionsPositions).length;

    var expiringOptions = Object.values(state.optionsPositions).filter(function(p) {
        return p.daysToExpiry <= 1;
    });
    if (expiringOptions.length > 0) {
        document.getElementById('ov-expiry-info').classList.remove('hidden');
        document.getElementById('ov-expiry-text').textContent = expiringOptions.length + ' option(s) will expire and be auto-settled.';
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

    // Overnight gap + roll pre-history forward
    marketStocks.forEach(function(stock) {
        stock.prevClose = stock.ltp;  // save previous day's close
        var overnightChange = (Math.random() - 0.5) * 0.02;
        stock.ltp = parseFloat((stock.ltp * (1 + overnightChange)).toFixed(2));
        stock.open = stock.ltp;
        stock.base = stock.ltp;
        stock._prevTick = stock.ltp;
        stock.volume = 0;
        stock.circuitHit = null;

        // Roll preHistory: append this day's live ticks and trim to last 22 days (8250 ticks)
        if (stock.preHistory && stock.history.length > 1) {
            var todayTicks = stock.history.slice(1);  // skip the opening placeholder
            stock.preHistory = stock.preHistory.concat(todayTicks).slice(-22 * 375);
        }
        // Reset live history for new day
        stock.history = [stock.ltp];
        stock.volumeHistory = [0];
        stock.ohlcHistory = [];
        stock.currentCandle = null;
    });

    // Reset NIFTY for new day
    state.niftyBase = state.niftyValue;
    state.sensexBase = state.sensexValue;
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
    _wlCache = {}; _wlLastOrder = ''; // force watchlist DOM rebuild for new day

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
            var stock = stockMap[pos.ticker];
            if (!stock) return;

            var intrinsic = pos.type === 'CALL'
                ? Math.max(0, stock.ltp - pos.strike)
                : Math.max(0, pos.strike - stock.ltp);
            var totalQty = pos.lots * pos.lotSize;
            var settlementValue = intrinsic * totalQty;
            var costBasis = pos.avgPremium * totalQty;
            var fxRate = EXCHANGE_RATES[stock.currency] || 1;
            var settlementValueINR = settlementValue * fxRate;
            var brokerage = settlementValueINR * 0.001;
            var pnl = (settlementValue - costBasis) * fxRate - brokerage;

            state.margin += (settlementValueINR - brokerage);
            state.totalBrokerage = (state.totalBrokerage || 0) + brokerage;
            expired.push({ id: id, ticker: pos.ticker, type: pos.type, strike: pos.strike, pnl: pnl });

            // Record trade history for settlement
            state.tradeHistory.unshift({
                time: formatTime(state.time),
                day: state.day,
                ticker: pos.ticker,
                side: intrinsic > 0 ? 'SETTLE' : 'EXPIRED',
                type: pos.type + ' ' + pos.strike + ' EXPIRY',
                qty: totalQty,
                price: intrinsic,
                value: settlementValueINR
            });

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
    if (!result.stocks || result.stocks.length === 0) return;

    if (result.name) text = text.replace("{name}", result.name);

    var evMarket = ev.market || 'NSE';

    // Apply impact with volatility multiplier
    var impact = ev.impact * VOL_MULTIPLIER;
    result.stocks.forEach(function(s) {
        if (s.circuitHit) return; // skip frozen stocks
        var newPrice = parseFloat((s.ltp * (1 + impact)).toFixed(2));
        var isNoCircuit = s.market === 'CRYPTO' || s.market === 'FX';
        var limitMult = isNoCircuit ? 100.0 : CIRCUIT_LIMIT;
        var upperCircuit = s.open * (1 + limitMult);
        var lowerCircuit = s.open * (1 - limitMult);
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
    el.setAttribute('data-market', evMarket);

    // Show/hide based on current news filter
    var nf = state.newsMarketFilter;
    if (nf !== 'ALL' && evMarket !== nf) el.style.display = 'none';

    var warIcon = evMarket === 'WAR' ? '<i class="fa-solid fa-gun" style="color:#ff9100;font-size:9px"></i> ' : '';
    var badgeCls = 'news-mkt-badge nmb-' + evMarket.toLowerCase();
    var marketBadge = '<span class="' + badgeCls + '">' + evMarket + '</span>';
    el.innerHTML = '<span class="news-time">' + formatTime(state.time) + '</span>' + marketBadge + '<span class="news-text">' + warIcon + text + '</span>';
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

    var orderType = document.getElementById('order-type').value;
    if (orderType === 'LIMIT') {
        var limitPrice = parseFloat(document.getElementById('order-limit-price').value);
        if (isNaN(limitPrice) || limitPrice <= 0) {
            toast("Error", "Invalid limit price", "error");
            return;
        }
        state.pendingOrders.push({
            time: formatTime(state.time),
            day: state.day,
            ticker: stock.ticker,
            side: side,
            qty: qty,
            limitPrice: limitPrice,
            currency: stock.currency
        });
        toast("Pending Order", "Limit order placed: " + side + " " + qty + " " + stock.ticker + " @ " + limitPrice.toFixed(2), "info");
        document.getElementById('order-qty').value = 1;
        document.getElementById('order-type').value = 'MARKET';
        document.getElementById('limit-price-group').classList.add('hidden');
        renderAll();
        return;
    }

    if (processEquityTrade(stock, side, qty, stock.ltp)) {
        document.getElementById('order-qty').value = 1;
        renderAll();
    }
}

function processEquityTrade(stock, side, qty, price) {
    var fxRate = EXCHANGE_RATES[stock.currency] || 1;  // INR per 1 unit of stock's currency
    var cost = price * qty;          // in native currency
    var costINR = cost * fxRate;     // in INR
    var brokerage = costINR * 0.001; // 0.1% Brokerage
    var currentPos = state.positions[stock.ticker] || { qty: 0, avgPrice: 0 };
    var pos = { qty: currentPos.qty, avgPrice: currentPos.avgPrice };
    var nextMargin = state.margin;
    var tradeType = '';
    var toastArgs = null;

    if (side === 'BUY') {
        if (pos.qty < 0) {
            var coverQty = Math.min(qty, Math.abs(pos.qty));
            var pnl = (pos.avgPrice - price) * coverQty;   // native currency
            var releasedShortMargin = pos.avgPrice * coverQty * 0.2;
            nextMargin += (releasedShortMargin + pnl) * fxRate;
            pos.qty += coverQty;

            var remaining = qty - coverQty;
            if (remaining > 0) {
                var addCost = price * remaining;                // native
                var addCostINR = addCost * fxRate;              // INR
                if (nextMargin < addCostINR) { toast("Error", "Insufficient margin", "error"); return false; }
                if (pos.qty === 0) pos.avgPrice = price;
                var totalCost = pos.avgPrice * pos.qty + price * remaining;  // native
                pos.qty += remaining;
                pos.avgPrice = totalCost / pos.qty;             // stored in native currency
                nextMargin -= addCostINR;
            }
            if (pos.qty === 0) pos.avgPrice = 0;
            tradeType = 'COVER';
            toastArgs = ["Covered", 'Covered ' + coverQty + ' ' + stock.ticker + ' @ ' + fmtPrice(stock, price) + ' (\u20b9' + (price * fxRate).toFixed(2) + ')', 'success'];
        } else {
            if (nextMargin < costINR) { toast("Error", "Insufficient margin for BUY", "error"); return false; }
            var totalCost2 = (pos.qty * pos.avgPrice) + cost;  // native
            pos.qty += qty;
            pos.avgPrice = totalCost2 / pos.qty;               // stored in native currency
            nextMargin -= costINR;
            tradeType = 'BUY';
            toastArgs = ["BUY", 'Bought ' + qty + ' ' + stock.ticker + ' @ ' + fmtPrice(stock, price) + ' (\u20b9' + costINR.toFixed(2) + ' deducted)', 'success'];
        }
    } else {
        if (pos.qty > 0) {
            var sellQty = Math.min(qty, pos.qty);
            nextMargin += price * sellQty * fxRate;      // convert proceeds to INR
            pos.qty -= sellQty;

            var remaining2 = qty - sellQty;
            if (remaining2 > 0) {
                var shortMargin = price * remaining2 * 0.2;        // native
                var shortMarginINR = shortMargin * fxRate;          // INR
                if (nextMargin < shortMarginINR) { toast("Error", "Insufficient margin for short", "error"); return false; }
                pos.qty -= remaining2;
                pos.avgPrice = price;                               // stored in native currency
                nextMargin -= shortMarginINR;
                tradeType = 'SHORT';
                toastArgs = ["SHORT", 'Shorted ' + remaining2 + ' ' + stock.ticker + ' @ ' + fmtPrice(stock, price), 'error'];
            } else {
                tradeType = 'SELL';
                toastArgs = ["SELL", 'Sold ' + sellQty + ' ' + stock.ticker + ' @ ' + fmtPrice(stock, price) + ' (\u20b9' + (price * sellQty * fxRate).toFixed(2) + ' added)', 'success'];
            }
            if (pos.qty === 0) pos.avgPrice = 0;
        } else {
            var shortMargin2 = price * qty * 0.2;             // native
            var shortMargin2INR = shortMargin2 * fxRate;       // INR
            if (nextMargin < shortMargin2INR) { toast("Error", "Insufficient margin for short", "error"); return false; }
            if (pos.qty === 0) {
                pos.avgPrice = price;                          // stored in native currency
                pos.qty = -qty;
            } else {
                var totalVal = Math.abs(pos.qty) * pos.avgPrice + qty * price;  // native
                pos.qty -= qty;
                pos.avgPrice = totalVal / Math.abs(pos.qty);  // stored in native currency
            }
            nextMargin -= shortMargin2INR;
            tradeType = 'SHORT';
            toastArgs = ["SHORT", 'Shorted ' + qty + ' ' + stock.ticker + ' @ ' + fmtPrice(stock, price), 'error'];
        }
    }

    state.margin = nextMargin;

    // Record trade history (value stored in INR)
    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: stock.ticker,
        side: tradeType || side,
        type: 'Equity',
        qty: qty,
        price: price,
        value: costINR
    });

    // Add to volume
    stock.volume += qty * 100;
    
    // Check if margin is sufficient to cover brokerage too
    if (nextMargin - brokerage < 0 && side === 'BUY') {
        toast("Error", "Insufficient margin to cover brokerage", "error");
        return false;
    }

    state.margin = nextMargin - brokerage;
    state.totalBrokerage = (state.totalBrokerage || 0) + brokerage;
    
    if (pos.qty === 0) {
        delete state.positions[stock.ticker];
    } else {
        state.positions[stock.ticker] = pos;
    }

    if (toastArgs) toast(toastArgs[0], toastArgs[1], toastArgs[2]);
    return true;
}

// ==================== OPTIONS ====================
function getExpiryDays() {
    var sel = document.getElementById('expiry-date');
    return sel.value === 'Monthly' ? 20 : 5;
}

function getDayFraction() {
    return (state.time - START_TIME) / 375;
}

function generateStrikes(stock) {
    var ltp = stock.ltp;
    var step;
    if (stock.market === 'FX') {
        step = ltp > 50 ? 0.5 : 0.005; // USDJPY vs others
    } else if (stock.market === 'CRYPTO') {
        if (ltp > 10000) step = 1000;
        else if (ltp > 1000) step = 50;
        else if (ltp > 100) step = 5;
        else if (ltp > 10) step = 1;
        else if (ltp > 0.5) step = 0.05;
        else step = 0.01;
    } else {
        if (ltp > 5000) step = 100;
        else if (ltp > 1000) step = 50;
        else if (ltp > 200) step = 10;
        else if (ltp > 50) step = 5;
        else if (ltp > 10) step = 1;
        else if (ltp > 2) step = 0.5;
        else if (ltp > 0.5) step = 0.1;
        else step = 0.05;
    }

    var base = Math.round(ltp / step) * step;
    var strikes = [];
    for (var i = -5; i <= 5; i++) {
        var s = base + i * step;
        if (s > 0) strikes.push(parseFloat(s.toFixed(4)));
    }
    if (strikes.length === 0) strikes.push(parseFloat(step.toFixed(4)));
    return strikes;
}

// Black-Scholes Math
function stdNormPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function stdNormCDF(x) {
    var sign = x < 0 ? -1 : 1;
    var xAbs = Math.abs(x) / Math.sqrt(2.0);
    var t = 1.0 / (1.0 + 0.3275911 * xAbs);
    var erf = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-xAbs * xAbs);
    return 0.5 * (1.0 + sign * erf);
}

function calcGreeks(type, strike, ltp, days) {
    if (days === undefined) days = getExpiryDays() - getDayFraction();
    var T = Math.max(0.001, days) / 252.0; // Time in years
    var r = 0.05; // 5% Risk-free rate
    var sigma = 0.25; // 25% Volatility

    var d1 = (Math.log(ltp / strike) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    var d2 = d1 - sigma * Math.sqrt(T);

    var callPrice = ltp * stdNormCDF(d1) - strike * Math.exp(-r * T) * stdNormCDF(d2);
    var putPrice = strike * Math.exp(-r * T) * stdNormCDF(-d2) - ltp * stdNormCDF(-d1);

    var delta = type === 'CALL' ? stdNormCDF(d1) : stdNormCDF(d1) - 1;
    var gamma = stdNormPDF(d1) / (ltp * sigma * Math.sqrt(T));
    var vega = ltp * stdNormPDF(d1) * Math.sqrt(T) / 100.0; // per 1% change

    var thetaCall = -(ltp * sigma * stdNormPDF(d1)) / (2 * Math.sqrt(T)) - r * strike * Math.exp(-r * T) * stdNormCDF(d2);
    var thetaPut = -(ltp * sigma * stdNormPDF(d1)) / (2 * Math.sqrt(T)) + r * strike * Math.exp(-r * T) * stdNormCDF(-d2);
    var theta = type === 'CALL' ? thetaCall / 252.0 : thetaPut / 252.0; // daily theta

    var price = type === 'CALL' ? callPrice : putPrice;
    
    // Ensure it never drops below intrinsic value due to numerical instability
    var intrinsic = type === 'CALL' ? Math.max(0, ltp - strike) : Math.max(0, strike - ltp);
    price = Math.max(price, intrinsic);

    return { price: price, delta: delta, gamma: gamma, theta: theta, vega: vega };
}

function calcPremium(type, strike, ltp, days) {
    return calcGreeks(type, strike, ltp, days).price;
}

function updateGreeksUI(greeks) {
    var dEl = document.getElementById('g-delta');
    var gEl = document.getElementById('g-gamma');
    var tEl = document.getElementById('g-theta');
    var vEl = document.getElementById('g-vega');
    if (!dEl) return;
    
    var flash = function(el, val, oldVal) {
        if (Math.abs(val - oldVal) < 0.0001) return;
        el.classList.remove('flash-up', 'flash-dn');
        void el.offsetWidth;
        el.classList.add(val > oldVal ? 'flash-up' : 'flash-dn');
        setTimeout(function() { el.classList.remove('flash-up', 'flash-dn'); }, 200);
    };

    var oldD = parseFloat(dEl.textContent) || 0;
    var oldG = parseFloat(gEl.textContent) || 0;
    var oldT = parseFloat(tEl.textContent) || 0;
    var oldV = parseFloat(vEl.textContent) || 0;

    dEl.textContent = greeks.delta.toFixed(3);
    gEl.textContent = greeks.gamma.toFixed(4);
    tEl.textContent = greeks.theta.toFixed(3);
    vEl.textContent = greeks.vega.toFixed(3);

    flash(dEl, greeks.delta, oldD);
    flash(gEl, greeks.gamma, oldG);
    flash(tEl, greeks.theta, oldT);
    flash(vEl, greeks.vega, oldV);
}

function updateStrikesAndPremium() {
    if (!state.activeStock) return;
    var stock = state.activeStock;
    var strikes = generateStrikes(stock);
    var sel = document.getElementById('strike-price');
    var optType = document.getElementById('option-type').value;
    var days = getExpiryDays() - getDayFraction();

    var currentVal = sel.value;
    sel.innerHTML = '';
    var selectedGreeks = null;

    strikes.forEach(function(s) {
        var greeks = calcGreeks(optType, s, stock.ltp, days);
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + ' (' + fmtPrice(stock, greeks.price) + ')';
        sel.appendChild(opt);
        if (currentVal && parseFloat(currentVal) === s) selectedGreeks = greeks;
    });

    var atm = strikes.find(function(s) { return s >= stock.ltp; }) || strikes[5];
    if (!currentVal || strikes.indexOf(parseFloat(currentVal)) === -1) {
        sel.value = atm;
        selectedGreeks = calcGreeks(optType, atm, stock.ltp, days);
    } else {
        sel.value = currentVal;
    }
    
    if (selectedGreeks) updateGreeksUI(selectedGreeks);
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
    var days = getExpiryDays() - getDayFraction();
    var premium = calcPremium(optType, strike, stock.ltp, days);
    var fxRate = EXCHANGE_RATES[stock.currency] || 1;
    var req = premium * totalQty * fxRate;   // convert to INR

    document.getElementById('option-premium').textContent = fmtPrice(stock, premium);
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
    var lots = parseInt(document.getElementById('option-lots').value) || 0;
    var lotSize = LOT_SIZES[stock.ticker] || 100;
    var totalQty = lots * lotSize;

    if (lots <= 0) { toast("Error", "Invalid lot count", "error"); return; }

    var fxRate = EXCHANGE_RATES[stock.currency] || 1;
    var premium = 0;
    var cost = 0;
    var costINR = 0;
    var optionId = stock.ticker + '_' + optType + '_' + strike + '_' + expiryType;

    if (side === 'BUY') {
        var pos = state.optionsPositions[optionId];
        var remainingDays = pos ? pos.daysToExpiry - getDayFraction() : getExpiryDays() - getDayFraction();
        premium = calcPremium(optType, strike, stock.ltp, remainingDays);
        cost = premium * totalQty;          // in native currency
        costINR = cost * fxRate;            // converted to INR

        var brokerage = costINR * 0.001;
        if (state.margin < costINR + brokerage) { toast("Error", "Insufficient margin including brokerage", "error"); return; }
        if (!pos) {
            pos = {
                ticker: stock.ticker, type: optType, strike: strike, expiryType: expiryType,
                daysToExpiry: getExpiryDays(), lots: 0, avgPremium: 0, lotSize: lotSize
            };
        }
        var oldTotal = pos.lots * pos.lotSize * pos.avgPremium;
        pos.lots += lots;
        pos.avgPremium = (oldTotal + cost) / (pos.lots * pos.lotSize);  // stored in native currency
        state.optionsPositions[optionId] = pos;
        state.margin -= (costINR + brokerage);
        state.totalBrokerage = (state.totalBrokerage || 0) + brokerage;
        toast("Option BUY", lots + 'L ' + stock.ticker + ' ' + optType + ' ' + strike + ' ' + expiryType + ' @ ' + fmtPrice(stock, premium), 'success');
    } else {
        var pos2 = state.optionsPositions[optionId];
        if (!pos2 || pos2.lots < lots) { toast("Error", "Insufficient option holdings", "error"); return; }
        var remainingDays = pos2.daysToExpiry - getDayFraction();
        premium = calcPremium(optType, strike, stock.ltp, remainingDays);
        cost = premium * totalQty;          // in native currency
        costINR = cost * fxRate;            // converted to INR

        var brokerage = costINR * 0.001;
        if (state.margin + costINR - brokerage < 0) { toast("Error", "Insufficient margin for brokerage", "error"); return; }
        state.margin += (costINR - brokerage);   // convert proceeds to INR minus brokerage
        state.totalBrokerage = (state.totalBrokerage || 0) + brokerage;
        pos2.lots -= lots;
        if (pos2.lots === 0) delete state.optionsPositions[optionId];
        toast("Option SELL", lots + 'L ' + stock.ticker + ' ' + optType + ' ' + strike + ' ' + expiryType + ' @ ' + fmtPrice(stock, premium), 'error');
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
        value: costINR
    });

    document.getElementById('option-lots').value = 1;
    renderAll();
}

// ==================== RENDER ====================
// Coalesce multiple rapid renderAll() calls into one paint per animation frame
var _rafPending = false;
function renderAll() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(function() {
        _rafPending = false;
        renderTopBar();
        renderWatchlist();
        renderActiveStock();
        renderPositionsTable();
        if (state.activeTab === 'options') updateStrikesAndPremium();
        if (state.activeBottomTab === 'options') renderOptionsTable();
        if (state.activeBottomTab === 'pending') renderPendingTable();
        if (state.activeBottomTab === 'history') renderHistoryTable();
    });
}

// Watchlist DOM row cache — built once per filter change, updated in-place every tick
var _wlCache = {};
var _wlLastOrder = '';

function renderTopBar() {
    document.getElementById('market-time').textContent = formatTime(state.time);
    document.getElementById('cash-balance').textContent = fmtCur(state.margin);
    document.getElementById('day-counter').textContent = 'Day ' + state.day;

    // NIFTY
    var niftyStock = marketStocks.find(s => s.ticker === 'NIFTY 50');
    if (niftyStock) {
        var niftyChg = niftyStock.ltp - niftyStock.base;
        var niftyEl = document.getElementById('nifty-value');
        niftyEl.textContent = niftyStock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        niftyEl.className = 'stat-val ' + (niftyChg >= 0 ? 'up' : 'dn');
    }

    // SENSEX
    var sensexStock = marketStocks.find(s => s.ticker === 'SENSEX');
    var sensexEl = document.getElementById('sensex-value');
    if (sensexStock && sensexEl) {
        var sensexChg = sensexStock.ltp - sensexStock.base;
        sensexEl.textContent = sensexStock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        sensexEl.className = 'stat-val ' + (sensexChg >= 0 ? 'up' : 'dn');
    }

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
    sentEl.className = 'stat-val ' + sentClass;

    // PnL
    var pnl = calcTotalPNL();
    var elPnl = document.getElementById('total-pnl');
    if (elPnl) {
        elPnl.textContent = fmtCur(pnl);
        elPnl.className = 'stat-val ' + (pnl > 0 ? 'up' : pnl < 0 ? 'dn' : '');
    }

    var portValEl = document.getElementById('portfolio-value');
    if (portValEl) portValEl.textContent = fmtCur(calcPortfolioValue());

    var cashBalEl = document.getElementById('cash-balance');
    if (cashBalEl) cashBalEl.textContent = fmtCur(state.margin);

    var pendingCountEl = document.getElementById('pending-count');
    if (pendingCountEl) pendingCountEl.textContent = state.pendingOrders.length;
    
    var brokerageEl = document.getElementById('brokerage-paid');
    if (brokerageEl) brokerageEl.textContent = fmtCur(state.totalBrokerage || 0);
}

function renderWatchlist() {
    var list = document.getElementById('watchlist');
    var searchEl = document.getElementById('wl-search-input');
    var query = searchEl ? searchEl.value.trim().toUpperCase() : '';
    var mf = state.wlMarketFilter;
    var byMarket = mf === 'ALL' ? marketStocks : marketStocks.filter(function(s) { return s.market === mf; });
    var filtered = query
        ? byMarket.filter(function(s) {
            return s.ticker.indexOf(query) !== -1 ||
                   s.name.toUpperCase().indexOf(query) !== -1 ||
                   s.sector.toUpperCase().indexOf(query) !== -1;
          })
        : byMarket;

    var orderKey = filtered.map(function(s) { return s.ticker; }).join(',');
    var needsRebuild = (orderKey !== _wlLastOrder);

    if (filtered.length === 0) {
        if (needsRebuild) {
            list.innerHTML = '<div class="wl-empty">No stocks match "' + query + '"</div>';
            _wlLastOrder = orderKey;
        }
        var cntEl0 = document.getElementById('wl-count');
        if (cntEl0) cntEl0.textContent = '0/' + marketStocks.length;
        return;
    }

    // Structural rebuild only when the visible stock list or order changes
    if (needsRebuild) {
        var scrollTop = list.scrollTop;
        var frag = document.createDocumentFragment();
        _wlCache = {};
        filtered.forEach(function(s) {
            var row = document.createElement('div');
            var left = document.createElement('div');
            left.style.flex = '1.5';

            var symLine = document.createElement('span');
            symLine.className = 'wl-sym';
            symLine.textContent = s.ticker;
            if (s.market !== 'NSE') {
                var badge = document.createElement('span');
                badge.className = 'wl-mkt-badge wlm-' + s.market.toLowerCase();
                badge.textContent = s.market;
                symLine.appendChild(badge);
            }
            var circuitEl = document.createElement('span');
            circuitEl.className = 'circuit-badge';
            circuitEl.style.display = 'none';
            symLine.appendChild(circuitEl);

            var sectorEl = document.createElement('div');
            sectorEl.className = 'wl-sector';
            sectorEl.textContent = s.sector;

            var bar = document.createElement('div');
            bar.className = 'vol-bar';
            var barFill = document.createElement('div');
            barFill.className = 'vol-fill';
            bar.appendChild(barFill);

            left.appendChild(symLine);
            left.appendChild(sectorEl);
            left.appendChild(bar);

            var ltpEl = document.createElement('span');
            ltpEl.className = 'wl-ltp';
            var chgEl = document.createElement('span');
            chgEl.className = 'wl-chg';

            var sparkEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            sparkEl.setAttribute("class", "wl-spark");
            sparkEl.setAttribute("viewBox", "0 0 100 30");
            sparkEl.setAttribute("preserveAspectRatio", "none");
            var polyEl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            polyEl.setAttribute("fill", "none");
            polyEl.setAttribute("stroke-width", "2.5");
            polyEl.setAttribute("stroke-linejoin", "round");
            sparkEl.appendChild(polyEl);

            row.appendChild(left);
            row.appendChild(sparkEl);
            row.appendChild(ltpEl);
            row.appendChild(chgEl);
            row.addEventListener('click', (function(stock) {
                return function() { selectStock(stock); };
            })(s));

            _wlCache[s.ticker] = { row: row, ltpEl: ltpEl, chgEl: chgEl, barFill: barFill, circuitEl: circuitEl, polyEl: polyEl };
            frag.appendChild(row);
        });
        list.innerHTML = '';
        list.appendChild(frag);
        list.scrollTop = scrollTop;
        _wlLastOrder = orderKey;
    }

    // In-place value updates every tick — only touches DOM when value actually changed
    var maxVol = 300000;
    filtered.forEach(function(s) {
        var c = _wlCache[s.ticker];
        if (!c) return;
        var dayChange = (s.ltp - s.open) / s.open * 100;
        var cls = dayChange >= 0 ? 'up' : 'dn';
        var flashCls = (s._prevTick !== undefined && s.ltp !== s._prevTick)
            ? (s.ltp > s._prevTick ? ' flash-up' : ' flash-dn') : '';
        var rowCls = 'wl-row' + (state.activeStock === s ? ' active' : '') + flashCls;
        if (c.row.className !== rowCls) c.row.className = rowCls;

        var ltpText = fmtPrice(s, s.ltp);
        var ltpCls = 'wl-ltp ' + cls;
        if (c.ltpEl.className !== ltpCls) c.ltpEl.className = ltpCls;
        if (c.ltpEl.textContent !== ltpText) c.ltpEl.textContent = ltpText;

        var chgText = (dayChange >= 0 ? '+' : '') + dayChange.toFixed(2) + '%';
        var chgCls = 'wl-chg ' + cls;
        if (c.chgEl.className !== chgCls) c.chgEl.className = chgCls;
        if (c.chgEl.textContent !== chgText) c.chgEl.textContent = chgText;

        var volPct = Math.min(100, (s.volume / maxVol) * 100).toFixed(1) + '%';
        if (c.barFill.style.width !== volPct) c.barFill.style.width = volPct;

        if (s.history && s.history.length > 1) {
            var slice = s.history.slice(-30);
            var minP = Math.min.apply(null, slice);
            var maxP = Math.max.apply(null, slice);
            var range = maxP - minP || 1;
            var pts = '';
            for (var i = 0; i < slice.length; i++) {
                var x = (i / (slice.length - 1)) * 100;
                var y = 28 - ((slice[i] - minP) / range) * 26;
                pts += x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            }
            if (c.polyEl.getAttribute('points') !== pts) {
                c.polyEl.setAttribute('points', pts);
                var strokeColor = dayChange >= 0 ? 'var(--green)' : 'var(--red)';
                if (c.polyEl.getAttribute('stroke') !== strokeColor) {
                    c.polyEl.setAttribute('stroke', strokeColor);
                }
            }
        }

        if (s.circuitHit) {
            var cbCls = 'circuit-badge ' + (s.circuitHit === 'UC' ? 'uc' : 'lc');
            if (c.circuitEl.className !== cbCls) c.circuitEl.className = cbCls;
            if (c.circuitEl.textContent !== s.circuitHit) c.circuitEl.textContent = s.circuitHit;
            if (c.circuitEl.style.display !== '') c.circuitEl.style.display = '';
        } else if (c.circuitEl.style.display !== 'none') {
            c.circuitEl.style.display = 'none';
        }
    });

    var cntEl = document.getElementById('wl-count');
    if (cntEl) {
        var cntText = filtered.length + '/' + marketStocks.length;
        if (cntEl.textContent !== cntText) cntEl.textContent = cntText;
    }
}

function selectStock(stock) {
    if (!stock) return;
    state.activeStock = stock;
    renderAll();
    if (state.activeTab === 'options') updateStrikesAndPremium();
}

function renderActiveStock() {
    var stock = state.activeStock;
    if (!stock) return;

    document.getElementById('active-symbol').textContent = stock.ticker;
    document.getElementById('active-name').textContent = stock.name + ' \u00b7 ' + stock.sector + ' [' + stock.market + ']';
    document.getElementById('order-symbol').textContent = stock.ticker;

    var dayChg = stock.ltp - stock.open;
    var dayPct = (dayChg / stock.open * 100);
    var isUp = dayChg >= 0;

    var elPrice = document.getElementById('active-price');
    elPrice.textContent = fmtPrice(stock, stock.ltp);
    elPrice.className = 'ct-price ' + (isUp ? 'up' : 'dn');

    var elChg = document.getElementById('active-change');
    var volStr = ' | Vol: ' + formatVolume(stock.volume);
    var circuitStr = stock.circuitHit ? ' | ' + stock.circuitHit : '';
    elChg.textContent = (isUp ? '+' : '') + dayChg.toFixed(2) + ' (' + dayPct.toFixed(2) + '%)' + volStr + circuitStr;
    elChg.className = 'ct-change ' + (isUp ? 'up' : 'dn');

    var elPrev = document.getElementById('active-prev-close');
    if (elPrev) {
        if (stock.prevClose) {
            var chgFromPrev = stock.ltp - stock.prevClose;
            var pctFromPrev = (chgFromPrev / stock.prevClose * 100);
            var colorClass = chgFromPrev >= 0 ? 'up' : 'dn';
            var sign = chgFromPrev >= 0 ? '+' : '';
            elPrev.innerHTML = 'Prev Close: ' + fmtPrice(stock, stock.prevClose) +
                ' &nbsp;<span class="' + colorClass + '">' + sign + pctFromPrev.toFixed(2) + '%</span>';
            elPrev.className = 'ct-prev-close';
        } else {
            elPrev.innerHTML = '';
        }
    }

    renderChart(stock);
    updateOrderMargin();
    renderPositionCard(stock);

    // Populate SL / Target fields for active stock
    var st = state.slTargets[stock.ticker];
    document.getElementById('sl-price').value     = (st && st.sl)     ? st.sl     : '';
    document.getElementById('target-price').value = (st && st.target) ? st.target : '';

    renderMarketDepth(stock);
}

function renderMarketDepth(stock) {
    if (!stock) return;
    var bidsContainer = document.getElementById('l2-bids');
    var asksContainer = document.getElementById('l2-asks');
    if (!bidsContainer || !asksContainer) return;

    var step = stock.ltp > 5000 ? 5 : stock.ltp > 1000 ? 1 : stock.ltp > 200 ? 0.5 : stock.ltp > 10 ? 0.05 : stock.ltp > 1 ? 0.01 : 0.001;
    var decimals = stock.currency === 'JPY' ? 0 : stock.ltp < 10 ? 4 : 2;

    // Seeded-ish quantities that fluctuate with time
    var baseSeed = stock.ticker.charCodeAt(0) + state.time;
    function getQty(level, isBid) {
        var rand = Math.sin(baseSeed + level + (isBid ? 10 : 20));
        return Math.floor(500 + Math.abs(rand) * 3500);
    }

    var bidHTML = '';
    var askHTML = '';
    var totalBidQty = 0;
    var totalAskQty = 0;
    var bids = [];
    var asks = [];
    var maxQty = 0;

    for (var i = 0; i < 5; i++) {
        var isLC = stock.circuitHit === 'LC';
        var isUC = stock.circuitHit === 'UC';
        
        var bidQty = isLC ? 0 : (isUC ? (i === 0 ? getQty(i, true) * 20 : (i === 1 ? getQty(i, true) * 5 : 0)) : getQty(i, true));
        var askQty = isUC ? 0 : (isLC ? (i === 0 ? getQty(i, false) * 20 : (i === 1 ? getQty(i, false) * 5 : 0)) : getQty(i, false));
        
        var bidP = isUC ? (i === 0 ? stock.ltp : stock.ltp - step) : stock.ltp - (i + 1) * step;
        var askP = isLC ? (i === 0 ? stock.ltp : stock.ltp + step) : stock.ltp + (i + 1) * step;
        
        bidP = Math.max(0.0001, bidP);

        bids.push({ p: bidP, q: bidQty });
        asks.push({ p: askP, q: askQty });
        
        totalBidQty += bidQty;
        totalAskQty += askQty;
        if (bidQty > maxQty) maxQty = bidQty;
        if (askQty > maxQty) maxQty = askQty;
    }

    for (var i = 0; i < 5; i++) {
        var bid = bids[i];
        var ask = asks[i];
        var bidW = maxQty > 0 ? (bid.q / maxQty) * 100 : 0;
        var askW = maxQty > 0 ? (ask.q / maxQty) * 100 : 0;

        var dispBidP = bid.q === 0 ? '-' : bid.p.toFixed(decimals);
        var dispBidQ = bid.q === 0 ? '-' : bid.q;
        var dispAskP = ask.q === 0 ? '-' : ask.p.toFixed(decimals);
        var dispAskQ = ask.q === 0 ? '-' : ask.q;

        var bidClick = bid.q > 0 ? ' onclick="setLimitPrice(' + bid.p + ')" ' : ' ';
        var askClick = ask.q > 0 ? ' onclick="setLimitPrice(' + ask.p + ')" ' : ' ';

        bidHTML += '<div class="l2-row"' + bidClick + 'style="position:relative; padding:2px 4px;"><div style="position:absolute; right:0; top:1px; bottom:1px; width:' + bidW + '%; background:var(--green-dim); z-index:0; border-radius:2px;"></div><span class="up mono" style="z-index:1">' + dispBidP + '</span><span class="mono" style="z-index:1">' + dispBidQ + '</span></div>';
        
        askHTML += '<div class="l2-row"' + askClick + 'style="position:relative; padding:2px 4px;"><div style="position:absolute; left:0; top:1px; bottom:1px; width:' + askW + '%; background:var(--red-dim); z-index:0; border-radius:2px;"></div><span class="dn mono" style="z-index:1">' + dispAskP + '</span><span class="mono" style="z-index:1">' + dispAskQ + '</span></div>';
    }

    bidsContainer.innerHTML = bidHTML;
    asksContainer.innerHTML = askHTML;

    var total = totalBidQty + totalAskQty;
    var bidPct = total > 0 ? (totalBidQty / total * 100) : 50;
    var askPct = 100 - bidPct;

    var ratioBidEl = document.getElementById('l2-ratio-bid');
    var ratioAskEl = document.getElementById('l2-ratio-ask');
    if (ratioBidEl) ratioBidEl.style.width = bidPct + '%';
    if (ratioAskEl) ratioAskEl.style.width = askPct + '%';

    var bidPctEl = document.getElementById('l2-bid-pct');
    var askPctEl = document.getElementById('l2-ask-pct');
    if (bidPctEl) bidPctEl.textContent = Math.round(bidPct) + '%';
    if (askPctEl) askPctEl.textContent = Math.round(askPct) + '%';
}

window.setLimitPrice = function(price) {
    var orderTypeEl = document.getElementById('order-type');
    var limitPriceGroup = document.getElementById('limit-price-group');
    var limitPriceInput = document.getElementById('order-limit-price');
    if (orderTypeEl && limitPriceGroup && limitPriceInput) {
        orderTypeEl.value = 'LIMIT';
        limitPriceGroup.classList.remove('hidden');
        var decimals = (state.activeStock && state.activeStock.currency === 'JPY') ? 0 : 2;
        limitPriceInput.value = price.toFixed(decimals);
        
        limitPriceInput.style.transition = 'background 0.3s';
        limitPriceInput.style.backgroundColor = 'var(--accent)';
        limitPriceInput.style.color = '#fff';
        setTimeout(function() {
            limitPriceInput.style.backgroundColor = '';
            limitPriceInput.style.color = '';
        }, 200);
    }
};

function formatVolume(v) {
    if (v >= 10000000) return (v / 10000000).toFixed(2) + 'Cr';
    if (v >= 100000) return (v / 100000).toFixed(2) + 'L';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toString();
}

// ==================== CANDLE DATA BUILDER ====================
function buildCandleData(stock, totalNeeded) {
    var period = state.candlePeriod;
    if (totalNeeded === undefined) {
        totalNeeded = Math.min(200, Math.ceil(state.viewLen / period) + 2);
    }

    // ── Live OHLCV candles (from this session) ──
    var liveCandles = [];
    if (stock.ohlcHistory && stock.ohlcHistory.length > 0) {
        liveCandles = stock.ohlcHistory.slice(-totalNeeded);
    } else {
        var hist = stock.history;
        for (var i = 0; i < hist.length; i += period) {
            var sl = hist.slice(i, i + period);
            if (!sl.length) break;
            liveCandles.push({ o: sl[0], h: Math.max.apply(null, sl), l: Math.min.apply(null, sl), c: sl[sl.length - 1], v: 0 });
        }
        liveCandles = liveCandles.slice(-totalNeeded);
    }

    // ── Pre-history candles to fill remaining slots ──
    var preCount = totalNeeded - liveCandles.length;
    var preCandles = buildPreOHLC(stock, period, preCount);

    // ── Combine and re-index ──
    var combined = preCandles.concat(liveCandles).slice(-totalNeeded);
    return combined.map(function(c, i) {
        return { x: i, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 };
    });
}

// Fast in-place data mutator — never destroys the chart instance
function _applyChartData(stock, isLight) {
    var ds   = chartInstance.data.datasets[0];
    var scX  = chartInstance.options.scales.x;
    var scY  = chartInstance.options.scales.y;
    var tip  = chartInstance.options.plugins.tooltip;
    var isPct = state.chartScale === 'pct';

    var firstPrice = 1;
    var dataLen = 0;
    var smaData = [];
    var emaData = [];

    if (state.chartType === 'candle') {
        var baseTotal = Math.min(200, Math.ceil(state.viewLen / state.candlePeriod) + 2);
        var ohlcData = buildCandleData(stock, baseTotal);
        var ohlcDataForIndicators = buildCandleData(stock, baseTotal + 20); // extra 20 for indicators
        firstPrice = ohlcData.length > 0 ? (ohlcData[0].o || 1) : 1;

        var closePrices = ohlcDataForIndicators.map(function(c) { return c.c; });
        var rawSMA = calcSMA(closePrices, 20).slice(-ohlcData.length);
        var rawEMA = calcEMA(closePrices, 20).slice(-ohlcData.length);

        var allH = ohlcData.map(function(d) { return d.h; });
        var allL = ohlcData.map(function(d) { return d.l; });
        var yMax = allH.length ? Math.max.apply(null, allH) : 0;
        var yMin = allL.length ? Math.min.apply(null, allL) : 0;
        var yRange = yMax - yMin || yMin * 0.01 || 1;
        var yPad = yRange * 0.06;
        var yBottomPad = yRange * 0.22;

        // % Change transform for candle
        if (isPct) {
            var baseC = firstPrice;
            ohlcData = ohlcData.map(function(d, i) {
                return {
                    x: i,
                    o: ((d.o - baseC) / baseC) * 100,
                    h: ((d.h - baseC) / baseC) * 100,
                    l: ((d.l - baseC) / baseC) * 100,
                    c: ((d.c - baseC) / baseC) * 100,
                    v: d.v
                };
            });
            var allHp = ohlcData.map(function(d) { return d.h; });
            var allLp = ohlcData.map(function(d) { return d.l; });
            yMax = allHp.length ? Math.max.apply(null, allHp) : 0;
            yMin = allLp.length ? Math.min.apply(null, allLp) : 0;
            yRange = yMax - yMin || 1;
            yPad = yRange * 0.06;
            yBottomPad = yRange * 0.22;

            smaData = rawSMA.map(function(v) { return v === null ? null : ((v - baseC) / baseC) * 100; });
            emaData = rawEMA.map(function(v) { return v === null ? null : ((v - baseC) / baseC) * 100; });
        } else {
            smaData = rawSMA;
            emaData = rawEMA;
        }

        chartInstance.data.labels = ohlcData.map(function(_, i) { return i; });
        ds.data                   = ohlcData.map(function(d) { return d.c; });
        ds.borderColor            = 'transparent';
        ds.backgroundColor        = 'transparent';
        ds.fill                   = false;
        ds.tension                = 0;
        ds.pointHoverRadius       = 0;
        chartInstance._ohlc       = ohlcData;
        chartInstance._volumes    = ohlcData.map(function(d) { return d.v || 0; });
        scY.min = yMin - yBottomPad;
        scY.max = yMax + yPad;

        var ds2c = chartInstance.data.datasets[1];
        if (stock.prevClose && ohlcData.length) {
            var pc = isPct ? 0 : stock.prevClose; // 0% = prev close baseline in pct mode
            ds2c.data   = Array(ohlcData.length).fill(pc);
            ds2c.hidden = false;
        } else {
            ds2c.data   = [];
            ds2c.hidden = true;
        }
        dataLen = ohlcData.length;

        tip.callbacks = {
            title: function(ctx) {
                var d = chartInstance._ohlc && chartInstance._ohlc[ctx[0] && ctx[0].dataIndex];
                if (!d) return state.activeStock ? state.activeStock.ticker : '';
                return (state.activeStock ? state.activeStock.ticker : '') + '  #' + (ctx[0].dataIndex + 1);
            },
            label: function(tCtx) {
                var cd = tCtx.chart._ohlc;
                var d  = cd && cd[tCtx.dataIndex];
                if (!d) return '';
                var fmt = isPct
                    ? function(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
                    : function(n) { return fmtPrice(state.activeStock, n); };
                var volStr = d.v ? '  Vol: ' + formatVolume(d.v) : '';
                return [
                    'O: ' + fmt(d.o),
                    'H: ' + fmt(d.h) + '  \u2197',
                    'L: ' + fmt(d.l) + '  \u2198',
                    'C: ' + fmt(d.c) + (d.c >= d.o ? '  \u25b2' : '  \u25bc') + volStr
                ];
            }
        };
    } else {
        // ── Line chart ──
        // Merge preHistory + live history for full-depth view
        var fullHistory = (stock.preHistory && stock.preHistory.length)
            ? stock.preHistory.concat(stock.history)
            : stock.history;
        var lineSlice = fullHistory.slice(-state.viewLen);

        firstPrice = lineSlice[0] || 1;
        var lastPrice  = lineSlice[lineSlice.length - 1] || 0;

        // Indicators for line chart
        var lineSliceForIndicators = fullHistory.slice(-(state.viewLen + 20));
        var rawSMA = calcSMA(lineSliceForIndicators, 20).slice(-lineSlice.length);
        var rawEMA = calcEMA(lineSliceForIndicators, 20).slice(-lineSlice.length);

        // % Change transform
        if (isPct) {
            lineSlice = lineSlice.map(function(p) { return ((p - firstPrice) / firstPrice) * 100; });
            lastPrice  = lineSlice[lineSlice.length - 1] || 0;
            smaData = rawSMA.map(function(v) { return v === null ? null : ((v - firstPrice) / firstPrice) * 100; });
            emaData = rawEMA.map(function(v) { return v === null ? null : ((v - firstPrice) / firstPrice) * 100; });
        } else {
            smaData = rawSMA;
            emaData = rawEMA;
        }

        var lineColor = (isPct ? lastPrice >= 0 : lastPrice >= firstPrice)
            ? (isLight ? '#00a846' : '#00c853')
            : (isLight ? '#d50032' : '#ff1744');

        chartInstance.data.labels = lineSlice.map(function(_, i) { return i; });
        ds.data                   = lineSlice;
        ds.borderColor            = lineColor;
        ds.pointHoverBackgroundColor = lineColor;
        ds.fill                   = true;
        ds.tension                = 0.15;
        ds.pointHoverRadius       = 4;
        chartInstance._ohlc       = null;
        chartInstance._volumes    = null; // no volume overlay on line chart (volumeHistory is live-only and misaligns with pre-history)
        chartInstance._lineData = lineSlice;
        scY.min = undefined;
        scY.max = undefined;

        // Prev close reference line
        var ds2 = chartInstance.data.datasets[1];
        if (!isPct && stock.prevClose && lineSlice.length) {
            ds2.data   = Array(lineSlice.length).fill(stock.prevClose);
            ds2.hidden = false;
        } else {
            ds2.data   = [];
            ds2.hidden = true;
        }

        var area = chartInstance.chartArea;
        if (area) {
            var grad = chartInstance.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            grad.addColorStop(0, lineColor + '30');
            grad.addColorStop(1, lineColor + '02');
            ds.backgroundColor = grad;
        } else {
            ds.backgroundColor = lineColor + '15';
        }
        dataLen = lineSlice.length;

        tip.callbacks = {
            title: function() { return state.activeStock ? state.activeStock.ticker : ''; },
            label: function(tCtx) {
                if (isPct) return (tCtx.parsed.y >= 0 ? '+' : '') + tCtx.parsed.y.toFixed(2) + '%';
                return fmtPrice(state.activeStock, tCtx.parsed.y);
            }
        };
    }

    // ── Update Position Cost, SL, Target Lines ──
    var dsAvg = chartInstance.data.datasets[2];
    var pos = state.positions[stock.ticker];
    if (pos && dataLen) {
        var avgVal = isPct ? ((pos.avgPrice - firstPrice) / firstPrice) * 100 : pos.avgPrice;
        dsAvg.data = Array(dataLen).fill(avgVal);
        dsAvg.hidden = false;
    } else {
        dsAvg.data = [];
        dsAvg.hidden = true;
    }

    var dsSL = chartInstance.data.datasets[3];
    var st = state.slTargets[stock.ticker];
    if (st && st.sl && dataLen) {
        var slVal = isPct ? ((st.sl - firstPrice) / firstPrice) * 100 : st.sl;
        dsSL.data = Array(dataLen).fill(slVal);
        dsSL.hidden = false;
    } else {
        dsSL.data = [];
        dsSL.hidden = true;
    }

    var dsTgt = chartInstance.data.datasets[4];
    if (st && st.target && dataLen) {
        var tgtVal = isPct ? ((st.target - firstPrice) / firstPrice) * 100 : st.target;
        dsTgt.data = Array(dataLen).fill(tgtVal);
        dsTgt.hidden = false;
    } else {
        dsTgt.data = [];
        dsTgt.hidden = true;
    }

    // ── Update SMA & EMA Indicators ──
    var dsSMA = chartInstance.data.datasets[5];
    if (state.showSMA && dataLen) {
        dsSMA.data = smaData;
        dsSMA.hidden = false;
    } else {
        dsSMA.data = [];
        dsSMA.hidden = true;
    }

    var dsEMA = chartInstance.data.datasets[6];
    if (state.showEMA && dataLen) {
        dsEMA.data = emaData;
        dsEMA.hidden = false;
    } else {
        dsEMA.data = [];
        dsEMA.hidden = true;
    }

    // Y-axis tick format (pct mode overrides price format)
    scY.ticks.callback = isPct
        ? function(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }
        : function(v) {
            var cur = state.activeStock ? state.activeStock.currency : 'INR';
            var sym = '\u20b9';
            if (cur === 'USD') sym = '$';
            else if (cur === 'CNY' || cur === 'JPY') sym = '\u00a5';
            else if (cur === 'HKD') sym = 'HK$';
            else if (cur === 'GBP') sym = '\u00a3';
            else if (cur === 'EUR') sym = '\u20ac';
            else if (cur === 'AUD') sym = 'A$';
            else if (cur === 'CAD') sym = 'C$';
            else if (cur === 'CHF') sym = 'CHF ';
            
            if (cur === 'JPY') return sym + v.toFixed(0);
            if (v >= 10000) return sym + (v / 1000).toFixed(1) + 'k';
            if (v >= 1000)  return sym + v.toFixed(0);
            return sym + v.toFixed((state.activeStock && state.activeStock.ltp < 10) ? 4 : 2);
        };

    // Theme colours
    scX.grid.color      = isLight ? 'rgba(0,0,0,0.06)'    : 'rgba(255,255,255,0.03)';
    scY.grid.color      = isLight ? 'rgba(0,0,0,0.07)'    : 'rgba(255,255,255,0.05)';
    scY.ticks.color     = isLight ? '#666'                 : '#707888';
    tip.backgroundColor = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(18,18,26,0.97)';
    tip.titleColor      = isLight ? '#111'                 : '#eeeef2';
    tip.bodyColor       = isLight ? '#333'                 : '#9ba0b0';
    tip.borderColor     = isLight ? '#ddd'                 : '#2a2a3a';

    chartInstance.update('none');
}

function renderChart(stock) {
    var canvas  = document.getElementById('main-chart');
    var ctx     = canvas.getContext('2d');
    var isLight = state.theme === 'light';
    var needsLog = state.chartScale === 'log';

    // Destroy chart if Y-axis type needs to change (log ↔ linear)
    if (chartInstance) {
        var curLog = chartInstance._isLogAxis || false;
        if (curLog !== needsLog) {
            chartInstance.destroy();
            chartInstance = null;
        }
    }

    // Fast path — chart already exists, just mutate data in-place
    if (chartInstance) {
        _applyChartData(stock, isLight);
        return;
    }

    // Create the single chart instance
    chartInstance = new Chart(ctx, {
        type: 'line',
        plugins: [candlestickPlugin],
        data: {
            labels: [],
            datasets: [{
                // 0: Main price line
                data: [],
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }, {
                // 1: Prev close reference line
                data: [],
                borderWidth: 1.5,
                borderDash: [6, 4],
                borderColor: 'rgba(255, 165, 0, 0.7)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0
            }, {
                // 2: Avg Buy Price Line (blue dotted)
                label: 'Avg Cost',
                data: [],
                borderWidth: 1.5,
                borderDash: [5, 5],
                borderColor: 'rgba(41, 98, 255, 0.8)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0,
                hidden: true
            }, {
                // 3: Stop Loss Line (red dotted)
                label: 'Stop Loss',
                data: [],
                borderWidth: 1.5,
                borderDash: [5, 5],
                borderColor: 'rgba(255, 23, 68, 0.8)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0,
                hidden: true
            }, {
                // 4: Target Line (green dotted)
                label: 'Target',
                data: [],
                borderWidth: 1.5,
                borderDash: [5, 5],
                borderColor: 'rgba(0, 200, 83, 0.8)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0,
                hidden: true
            }, {
                // 5: SMA 20 (orange solid line)
                label: 'SMA 20',
                data: [],
                borderWidth: 1.5,
                borderColor: 'rgba(255, 152, 0, 0.85)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0.1,
                hidden: true
            }, {
                // 6: EMA 20 (purple solid line)
                label: 'EMA 20',
                data: [],
                borderWidth: 1.5,
                borderColor: 'rgba(156, 39, 176, 0.85)',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0.1,
                hidden: true
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
                    backgroundColor: 'rgba(10, 10, 20, 0.75)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#D0D2D9',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    filter: function(item) { return item.datasetIndex === 0; },
                    titleFont: { family: 'Outfit', size: 11, weight: '700' },
                    bodyFont: { family: 'Outfit', size: 11 },
                    callbacks: {}
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        drawBorder: false,
                        color: 'rgba(255,255,255,0.03)',
                        drawTicks: false
                    },
                    ticks: { display: false }
                },
                y: {
                    type: needsLog ? 'logarithmic' : 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawBorder: false,
                        color: 'rgba(255,255,255,0.015)',
                        lineWidth: 1
                    },
                    ticks: {
                        font: { family: 'Outfit', size: 10 },
                        padding: 10,
                        maxTicksLimit: 12,
                        callback: function(v) {
                            var cur = state.activeStock ? state.activeStock.currency : 'INR';
                            var sym = '\u20b9';
                            if (cur === 'USD') sym = '$';
                            else if (cur === 'CNY' || cur === 'JPY') sym = '\u00a5';
                            else if (cur === 'HKD') sym = 'HK$';
                            else if (cur === 'GBP') sym = '\u00a3';
                            else if (cur === 'EUR') sym = '\u20ac';
                            else if (cur === 'AUD') sym = 'A$';
                            else if (cur === 'CAD') sym = 'C$';
                            else if (cur === 'CHF') sym = 'CHF ';
                            
                            if (cur === 'JPY') return sym + v.toFixed(0);
                            if (v >= 10000) return sym + (v / 1000).toFixed(1) + 'k';
                            if (v >= 1000)  return sym + v.toFixed(0);
                            return sym + v.toFixed((state.activeStock && state.activeStock.ltp < 10) ? 4 : 2);
                        }
                    }
                }
            },
            interaction: { mode: 'index', axis: 'x', intersect: false },
            hover: { mode: 'index', intersect: false },
            onHover: function(event, elements, chart) {
                var canvas = chart.canvas;
                canvas.style.cursor = elements.length ? 'crosshair' : 'default';
            }
        }
    });

    chartInstance._isLogAxis = needsLog;
    _applyChartData(stock, isLight);
}

function updateOrderMargin() {
    if (!state.activeStock) return;
    var qty = parseInt(document.getElementById('order-qty').value) || 0;
    var req = toINR(state.activeStock.ltp * qty, state.activeStock.currency);
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
        ? toINR((stock.ltp - pos.avgPrice) * pos.qty, stock.currency)
        : toINR((pos.avgPrice - stock.ltp) * Math.abs(pos.qty), stock.currency);

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
    var stock = stockMap[ticker];
    if (!pos || !stock) return;

    var absQty = Math.abs(pos.qty);
    var price = stock.ltp;
    var fxRate = EXCHANGE_RATES[stock.currency] || 1;
    var isShort = pos.qty < 0;
    var pnl = isShort ? (pos.avgPrice - price) * absQty : (price - pos.avgPrice) * absQty;  // native
    var pnlINR = pnl * fxRate;

    if (isShort) {
        state.margin += (pos.avgPrice * absQty * 0.2 + pnl) * fxRate;
    } else {
        state.margin += price * absQty * fxRate;
    }

    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: ticker,
        side: isShort ? 'COVER' : 'SELL',
        type: 'Equity',
        qty: absQty,
        price: price,
        value: price * absQty * fxRate
    });

    delete state.positions[ticker];
    delete state.slTargets[ticker];
    stock.volume += absQty * 100;

    if (state.activeStock && state.activeStock.ticker === ticker) {
        document.getElementById('sl-price').value = '';
        document.getElementById('target-price').value = '';
    }

    if (!silent) {
        toast('Closed', ticker + ' position closed @ ' + fmtPrice(stock, price) + '  P&L: ' + (pnlINR >= 0 ? '+' : '') + fmtCur(pnlINR), pnlINR >= 0 ? 'success' : 'error');
        renderAll();
    }
}

function closeOptionPosition(id, silent) {
    var pos = state.optionsPositions[id];
    var stock = stockMap[pos && pos.ticker];
    if (!pos || !stock) return;

    var fxRate = EXCHANGE_RATES[stock.currency] || 1;
    var remainingDays = pos.daysToExpiry - getDayFraction();
    var curPrem = calcPremium(pos.type, pos.strike, stock.ltp, remainingDays);
    var totalQty = pos.lots * pos.lotSize;
    var pnlNative = (curPrem - pos.avgPremium) * totalQty;
    var pnlINR = pnlNative * fxRate;
    state.margin += curPrem * totalQty * fxRate;   // convert proceeds to INR

    state.tradeHistory.unshift({
        time: formatTime(state.time),
        day: state.day,
        ticker: pos.ticker,
        side: 'SELL',
        type: pos.type + ' OPT',
        qty: totalQty,
        price: curPrem,
        value: curPrem * totalQty * fxRate
    });

    delete state.optionsPositions[id];
    if (!silent) {
        toast('Closed', pos.ticker + ' ' + pos.type + ' ' + pos.strike + ' @ ' + fmtPrice(stock, curPrem) + '  P&L: ' + (pnlINR >= 0 ? '+' : '') + fmtCur(pnlINR), pnlINR >= 0 ? 'success' : 'error');
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

function liquidateAllForced() {
    var equityKeys = Object.keys(state.positions);
    var optionKeys = Object.keys(state.optionsPositions);
    if (equityKeys.length === 0 && optionKeys.length === 0) return;

    equityKeys.forEach(function(ticker) {
        var pos = state.positions[ticker];
        var stock = stockMap[ticker];
        if (!pos || !stock) return;

        var absQty = Math.abs(pos.qty);
        var price = stock.ltp;
        var fxRate = EXCHANGE_RATES[stock.currency] || 1;
        var isShort = pos.qty < 0;
        var pnl = isShort ? (pos.avgPrice - price) * absQty : (price - pos.avgPrice) * absQty;

        if (isShort) {
            state.margin += (pos.avgPrice * absQty * 0.2 + pnl) * fxRate;
        } else {
            state.margin += price * absQty * fxRate;
        }
        
        var brokerage = price * absQty * fxRate * 0.001;
        state.margin -= brokerage;
        state.totalBrokerage = (state.totalBrokerage || 0) + brokerage;

        state.tradeHistory.unshift({
            time: formatTime(state.time),
            day: state.day,
            ticker: ticker,
            side: 'LIQUIDATED',
            type: 'Equity',
            qty: absQty,
            price: price,
            value: price * absQty * fxRate
        });

        delete state.positions[ticker];
        delete state.slTargets[ticker];
        stock.volume += absQty * 100;
    });

    optionKeys.forEach(function(id) {
        var pos = state.optionsPositions[id];
        var stock = stockMap[pos && pos.ticker];
        if (!pos || !stock) return;

        var fxRate = EXCHANGE_RATES[stock.currency] || 1;
        var remainingDays = pos.daysToExpiry - getDayFraction();
        var curPrem = calcPremium(pos.type, pos.strike, stock.ltp, remainingDays);
        var totalQty = pos.lots * pos.lotSize;
        var valueINR = curPrem * totalQty * fxRate;
        var brokerage = valueINR * 0.001;
        state.margin += (valueINR - brokerage);
        state.totalBrokerage = (state.totalBrokerage || 0) + brokerage;

        state.tradeHistory.unshift({
            time: formatTime(state.time),
            day: state.day,
            ticker: pos.ticker,
            side: 'LIQUIDATED',
            type: pos.type + ' OPT',
            qty: totalQty,
            price: curPrem,
            value: curPrem * totalQty * fxRate
        });

        delete state.optionsPositions[id];
    });

    state.pendingOrders = [];
    toast("PORTFOLIO LIQUIDATED", "All positions force closed: Portfolio value fell below 10% of starting capital!", "error");
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
        var stock = stockMap[ticker];
        if (!stock) return;

        var isShort = pos.qty < 0;
        var absQty = Math.abs(pos.qty);
        var curVal = toINR(absQty * stock.ltp, stock.currency);
        var pnl = isShort
            ? toINR((pos.avgPrice - stock.ltp) * absQty, stock.currency)
            : toINR((stock.ltp - pos.avgPrice) * absQty, stock.currency);
        var pnlPct = ((pnl / toINR(pos.avgPrice * absQty, stock.currency)) * 100).toFixed(2);
        var pnlCls = pnl >= 0 ? 'up' : 'dn';
        var hasSl = state.slTargets[ticker] && (state.slTargets[ticker].sl || state.slTargets[ticker].target);

        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Click to select ' + ticker;
        tr.innerHTML =
            '<td class="sym-cell">' + ticker + (hasSl ? ' <i class="fa-solid fa-bell" style="font-size:9px;color:var(--orange)"></i>' : '') + '</td>' +
            '<td class="' + (isShort ? 'side-short' : 'side-long') + '">' + (isShort ? 'SHORT' : 'LONG') + '</td>' +
            '<td>CNC</td>' +
            '<td class="r">' + pos.qty + '</td>' +
            '<td class="r">' + pos.avgPrice.toFixed(2) + '</td>' +
            '<td class="r">' + stock.ltp.toFixed(2) + '</td>' +
            '<td class="r">' + fmtCur(curVal) + '</td>' +
            '<td class="r ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + fmtCur(pnl) + '</td>' +
            '<td class="r ' + pnlCls + '">' + (pnl >= 0 ? '+' : '') + pnlPct + '%</td>' +
            '<td class="r"><button class="btn-close-pos" onclick="event.stopPropagation();closeEquityPosition(\'' + ticker + '\')" title="Close position">&#x2715; Close</button></td>';
        tr.onclick = function() { selectStock(stockMap[ticker]); };
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
        var stock = stockMap[pos.ticker];
        if (!stock) return;

        var remainingDays = pos.daysToExpiry - getDayFraction();
        var curPrem = calcPremium(pos.type, pos.strike, stock.ltp, remainingDays);
        var totalQty = pos.lots * pos.lotSize;
        var pnlNative = (curPrem - pos.avgPremium) * totalQty;
        var pnlINR = toINR(pnlNative, stock.currency);  // convert P&L to INR
        var cls = pnlINR >= 0 ? 'up' : 'dn';

        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Click to select ' + pos.ticker;
        tr.innerHTML = '<td class="sym-cell">' + pos.ticker + '</td>' +
            '<td>' + pos.type + '</td>' +
            '<td class="r">' + pos.strike + '</td>' +
            '<td>' + pos.expiryType + ' (' + pos.daysToExpiry + 'd)</td>' +
            '<td class="r">' + pos.lots + '</td>' +
            '<td class="r">' + totalQty + '</td>' +
            '<td class="r">' + fmtPrice(stock, pos.avgPremium) + '</td>' +
            '<td class="r">' + fmtPrice(stock, curPrem) + '</td>' +
            '<td class="r ' + cls + '">' + (pnlINR >= 0 ? '+' : '') + fmtCur(pnlINR) + '</td>' +
            '<td class="r"><button class="btn-close-pos" onclick="event.stopPropagation();closeOptionPosition(\'' + id + '\')" title="Close option">&#x2715; Close</button></td>';
        tr.onclick = function() { selectStock(stockMap[pos.ticker]); };
        tbody.appendChild(tr);
    });
}

function renderPendingTable() {
    var tbody = document.getElementById('pending-tbody');
    if (state.pendingOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">No pending orders</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    state.pendingOrders.forEach(function(order, index) {
        var stock = stockMap[order.ticker];
        var curLTP = stock ? stock.ltp : 0;
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Click to select ' + order.ticker;
        var sideClass = (order.side === 'BUY' || order.side === 'COVER') ? 'side-long' : 'side-short';

        tr.innerHTML = '<td class="mono">' + order.time + '</td>' +
            '<td>Day ' + order.day + '</td>' +
            '<td class="sym-cell">' + order.ticker + '</td>' +
            '<td class="' + sideClass + '">' + order.side + '</td>' +
            '<td>LIMIT</td>' +
            '<td class="r">' + order.qty + '</td>' +
            '<td class="r">' + (stock ? fmtPrice(stock, order.limitPrice) : order.limitPrice.toFixed(2)) + '</td>' +
            '<td class="r">' + (stock ? fmtPrice(stock, curLTP) : '0.00') + '</td>' +
            '<td class="r"><button class="btn-cancel-order" onclick="event.stopPropagation();cancelPendingOrder(' + index + ')" title="Cancel order">&#x2715; Cancel</button></td>';

        if (stock) {
            tr.onclick = function() { selectStock(stock); };
        }
        tbody.appendChild(tr);
    });
}

function cancelPendingOrder(index) {
    if (index >= 0 && index < state.pendingOrders.length) {
        var order = state.pendingOrders[index];
        state.pendingOrders.splice(index, 1);
        toast("Pending Order", "Limit order cancelled: " + order.side + " " + order.qty + " " + order.ticker + " @ " + order.limitPrice.toFixed(2), "info");
        renderAll();
    }
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

function exportTradeHistoryCSV() {
    if (state.tradeHistory.length === 0) {
        toast("Export", "No trade history to export", "error");
        return;
    }

    // Header row
    var rows = ['"Time","Day","Symbol","Side","Type","Qty","Price (Native)","Value (INR)"'];

    // Trade rows – oldest first (tradeHistory is stored newest-first)
    var history = state.tradeHistory.slice().reverse();
    history.forEach(function(trade) {
        rows.push([
            '"' + trade.time + '"',
            '"Day ' + trade.day + '"',
            '"' + trade.ticker + '"',
            '"' + trade.side + '"',
            '"' + trade.type + '"',
            trade.qty,
            trade.price.toFixed(2),
            trade.value.toFixed(2)
        ].join(','));
    });

    // ── Portfolio Summary ──
    rows.push('');
    rows.push('"=== PORTFOLIO SUMMARY ==="');
    rows.push('"Starting Capital (INR)",' + INITIAL_MARGIN.toFixed(2));
    rows.push('"Current Cash (INR)",' + state.margin.toFixed(2));

    var posValue = calcEquityValue();
    var optValue = calcOptionsValue();

    var unrealizedPNL = calcTotalPNL();
    var portfolioValue = calcPortfolioValue();
    var overallPNL = portfolioValue - INITIAL_MARGIN;
    var overallPNLPct = ((overallPNL / INITIAL_MARGIN) * 100).toFixed(2);

    rows.push('"Open Positions Value (INR)",' + posValue.toFixed(2));
    rows.push('"Options Value (INR)",' + optValue.toFixed(2));
    rows.push('"Unrealized P&L (INR)",' + unrealizedPNL.toFixed(2));
    rows.push('"Portfolio Value (INR)",' + portfolioValue.toFixed(2));
    rows.push('"Overall P&L (INR)",' + overallPNL.toFixed(2));
    rows.push('"Overall P&L %",' + overallPNLPct + '%');
    rows.push('"Total Trades",' + state.tradeHistory.length);
    rows.push('"Exported on Day",' + state.day);

    // BOM prefix for Excel UTF-8 compatibility
    var csv = '\uFEFF' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'trade_history_day' + state.day + '.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Export", "Trade history exported to CSV!", "success");
}

// ==================== UTILS ====================
function calcTotalPNL() {
    var total = 0;
    Object.entries(state.positions).forEach(function(entry) {
        var t = entry[0], p = entry[1];
        var s = stockMap[t];
        if (!s) return;
        var pnlNative = p.qty > 0
            ? (s.ltp - p.avgPrice) * p.qty
            : (p.avgPrice - s.ltp) * Math.abs(p.qty);
        total += toINR(pnlNative, s.currency);
    });
    Object.values(state.optionsPositions).forEach(function(p) {
        var s = stockMap[p.ticker];
        if (!s) return;
        var remainingDays = p.daysToExpiry - getDayFraction();
        var cur = calcPremium(p.type, p.strike, s.ltp, remainingDays);
        total += toINR((cur - p.avgPremium) * p.lots * p.lotSize, s.currency);  // convert to INR
    });
    return total;
}

function toINR(amount, currency) {
    return amount * (EXCHANGE_RATES[currency] || 1);
}

function fmtCur(n) {
    return '\u20b9 ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcEquityValue() {
    var total = 0;
    Object.entries(state.positions).forEach(function(entry) {
        var ticker = entry[0], pos = entry[1];
        var stock = stockMap[ticker];
        if (!stock) return;
        if (pos.qty > 0) {
            total += toINR(stock.ltp * pos.qty, stock.currency);
        } else {
            var absQty = Math.abs(pos.qty);
            var reservedMargin = pos.avgPrice * absQty * 0.2;
            var unrealized = (pos.avgPrice - stock.ltp) * absQty;
            total += toINR(reservedMargin + unrealized, stock.currency);
        }
    });
    return total;
}

function calcOptionsValue() {
    var total = 0;
    Object.values(state.optionsPositions).forEach(function(pos) {
        var stock = stockMap[pos.ticker];
        if (!stock) return;
        var remainingDays = pos.daysToExpiry - getDayFraction();
        var curPrem = calcPremium(pos.type, pos.strike, stock.ltp, remainingDays);
        total += toINR(curPrem * pos.lots * pos.lotSize, stock.currency);
    });
    return total;
}

function calcPortfolioValue() {
    return state.margin + calcEquityValue() + calcOptionsValue();
}


function fmtPrice(stock, value) {
    if (value === undefined || value === null || isNaN(value)) return value;
    var fraction = (stock && stock.ltp < 10) ? 4 : 2;
    if (!stock || stock.currency === 'INR')
        return '\u20b9' + value.toLocaleString('en-IN', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'USD')
        return '$' + value.toLocaleString('en-US', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'CNY')
        return '\u00a5' + value.toFixed(fraction);
    if (stock.currency === 'JPY')
        return '\u00a5' + (stock.ltp < 10 ? value.toFixed(2) : value.toFixed(0));
    if (stock.currency === 'HKD')
        return 'HK$' + value.toLocaleString('en-HK', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'GBP')
        return '\u00a3' + value.toLocaleString('en-GB', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'EUR')
        return '\u20ac' + value.toLocaleString('en-IE', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'AUD')
        return 'A$' + value.toLocaleString('en-AU', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'CAD')
        return 'C$' + value.toLocaleString('en-CA', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    if (stock.currency === 'CHF')
        return 'CHF ' + value.toLocaleString('de-CH', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    return value.toFixed(fraction);
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

function calcSMA(prices, period) {
    var sma = [];
    for (var i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            var sum = 0;
            for (var j = 0; j < period; j++) sum += prices[i - j];
            sma.push(sum / period);
        }
    }
    return sma;
}

function calcEMA(prices, period) {
    var ema = [];
    var k = 2 / (period + 1);
    var emaVal = 0;
    for (var i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            ema.push(null);
        } else if (i === period - 1) {
            var sum = 0;
            for (var j = 0; j < period; j++) sum += prices[i - j];
            emaVal = sum / period;
            ema.push(emaVal);
        } else {
            emaVal = prices[i] * k + emaVal * (1 - k);
            ema.push(emaVal);
        }
    }
    return ema;
}
