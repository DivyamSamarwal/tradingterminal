/**
 * Dalal Street Terminal - Analytics & Fundamentals Module
 * Relies on global `state`, `marketStocks`, and `Chart` objects from app.js
 */

// ==================== PILLAR 1: GAMIFIED XP PROGRESSION ENGINE ====================

/**
 * Global Trader Profile — tracks XP, level, and unlocked derivative tiers.
 *
 * Level Tiers:
 *   Level 1 (0–999 XP)   : Spot trading only
 *   Level 2 (1,000+ XP)  : Unlocks European options
 *   Level 3 (4,000+ XP)  : Unlocks American options
 */
var TraderProfile = {
    xp: 0,
    level: 1,
    unlockedDerivatives: ['SPOT']
};

/**
 * XP thresholds and the derivative tiers they unlock.
 * Ordered ascending so we can walk them in a single pass.
 */
var XP_THRESHOLDS = [
    { xp: 1000, level: 2, derivatives: ['SPOT', 'EUROPEAN'] },
    { xp: 4000, level: 3, derivatives: ['SPOT', 'EUROPEAN', 'AMERICAN'] }
];

/**
 * Award XP on trade close.  Call this from closeEquityPosition() or wherever
 * a trade is definitively closed.
 *
 * @param {number}  pnlPercentage       - Realised PnL as a fraction (e.g. 0.10 = +10%)
 * @param {number}  tradeDurationSeconds - How long the position was open (wall-clock seconds)
 * @param {boolean} wasAutoClosed        - true if closed by SL/TP trigger, not manual click
 */
function awardTradeXP(pnlPercentage, tradeDurationSeconds, wasAutoClosed) {
    // ── Anti-Spam Gate ─────────────────────────────────────────────────────
    if (tradeDurationSeconds < 10) return 0;

    // ── Base execution XP ─────────────────────────────────────────────────
    var xpEarned = 15;

    // ── PnL Modifier: pnlPercentage is a fraction; *100 → percent, *250 → XP
    // e.g. +10% gain → +10 * 250 = 2500... divide pnl% / 100 for the fraction
    // Spec: PnL_Percentage * 250 where Percentage = the number (e.g. 10 for +10%)
    var pnlPercent = pnlPercentage * 100; // Convert fraction to percentage points
    xpEarned += pnlPercent * 250;

    // ── Discipline Bonus: closed via SL/TP instead of manual panic ────────
    if (wasAutoClosed) {
        xpEarned += 20;
    }

    // ── Floor: no trade can award fewer than +5 XP ────────────────────────
    if (xpEarned < 5) xpEarned = 5;

    // ── Apply XP and check for level-ups ─────────────────────────────────
    TraderProfile.xp += xpEarned;
    _checkLevelUp();

    return xpEarned;
}

/**
 * Internal: walk the XP_THRESHOLDS table and fire onLevelUp events
 * whenever a threshold is crossed.  Safe to call on every XP award.
 */
function _checkLevelUp() {
    for (var i = 0; i < XP_THRESHOLDS.length; i++) {
        var tier = XP_THRESHOLDS[i];
        if (TraderProfile.xp >= tier.xp && TraderProfile.level < tier.level) {
            TraderProfile.level = tier.level;
            TraderProfile.unlockedDerivatives = tier.derivatives.slice();
            window.dispatchEvent(
                new CustomEvent('onLevelUp', { detail: tier.level })
            );
            _showLevelUpToast(tier.level, tier.derivatives);
        }
    }
}

/**
 * Visual feedback when a level-up fires.
 * Uses the existing `toast()` helper from app.js if available.
 */
function _showLevelUpToast(newLevel, derivatives) {
    var tierName = newLevel === 2 ? 'European Options' : 'American Options';
    var msg = '🎉 Level ' + newLevel + ' reached! Unlocked: ' + tierName;
    if (typeof toast === 'function') {
        toast('Level Up! ▲ Tier ' + newLevel, msg, 'success');
    } else {
        console.info('[TraderProfile]', msg);
    }
}

/**
 * Render the XP/level HUD badge in the toolbar.
 * Call this after every awardTradeXP() and on initial page load.
 */
function renderXPBadge() {
    var el = document.getElementById('xp-badge');
    if (!el) return;

    var nextThreshold = null;
    for (var i = 0; i < XP_THRESHOLDS.length; i++) {
        if (TraderProfile.xp < XP_THRESHOLDS[i].xp) {
            nextThreshold = XP_THRESHOLDS[i].xp;
            break;
        }
    }

    var progress = 0;
    var prevThreshold = 0;
    if (TraderProfile.level === 1) {
        prevThreshold = 0;
        nextThreshold = nextThreshold || 1000;
    } else if (TraderProfile.level === 2) {
        prevThreshold = 1000;
        nextThreshold = nextThreshold || 4000;
    } else {
        prevThreshold = 4000;
        nextThreshold = null;
    }

    if (nextThreshold !== null) {
        progress = Math.min(100, ((TraderProfile.xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100);
    } else {
        progress = 100;
    }

    var tierLabels = { 1: 'Spot', 2: 'European', 3: 'American' };
    var tierLabel  = tierLabels[TraderProfile.level] || 'Max';

    el.innerHTML =
        '<span class="xp-level">Tier ' + TraderProfile.level + ' · ' + tierLabel + '</span>' +
        '<span class="xp-value">' + Math.floor(TraderProfile.xp) + ' XP</span>' +
        '<div class="xp-bar-track"><div class="xp-bar-fill" style="width:' + progress.toFixed(1) + '%"></div></div>';
}

// ── Wire level-up event to re-render badge ────────────────────────────────
window.addEventListener('onLevelUp', function () {
    renderXPBadge();
});

// ==================== END PILLAR 1 ====================

var analyticsChartInstance = null;
var currentAnalyticsTicker = null; // Track to prevent unnecessary chart rebuilds

// Deterministic random number generator seeded by string
function getSeededRandom(seedStr) {
	var hash = 0;
	for (var i = 0; i < seedStr.length; i++) {
		hash = (hash << 5) - hash + seedStr.charCodeAt(i);
		hash |= 0;
	}
	return function () {
		var t = (hash += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// 1. FULL RENDER (Runs once when stock is clicked)
function renderAnalytics() {
	var stock = state.activeStock;
	if (!stock) return;

	var rng = getSeededRandom(stock.ticker);

	// Generate static values deterministically
	var sharesOutstanding = Math.floor(rng() * 900000000) + 100000000;
	stock._sharesOutstanding = sharesOutstanding; // Save for live Market Cap calc

	var peRatio = (rng() * 70 + 10).toFixed(2);
	var divYield = (rng() * 5).toFixed(2);
	var high52 = (stock.base * (1 + (rng() * 0.4 + 0.1))).toFixed(2);
	var low52 = (stock.base * (1 - (rng() * 0.4 + 0.1))).toFixed(2);
	var nextEarnings = Math.floor(rng() * 90) + 1;

	// Build the grid (Notice the empty <span> tags with ID's for live data)
	var fundHTML = `
        <div class="data-row"><span class="data-label">Market Cap</span><span class="data-value" id="an-market-cap">--</span></div>
        <div class="data-row"><span class="data-label">Total Turnover</span><span class="data-value" id="an-turnover">--</span></div>
        <div class="data-row"><span class="data-label">Avg Daily Vol</span><span class="data-value" id="an-adv">--</span></div>
        <div class="data-row"><span class="data-label">All-Time High</span><span class="data-value" id="an-ath">--</span></div>
        <div class="data-row"><span class="data-label">All-Time Low</span><span class="data-value" id="an-atl">--</span></div>
        <div class="data-row"><span class="data-label">Total Range</span><span class="data-value" id="an-volatility">--</span></div>
    `;
	document.getElementById("analytics-fundamentals").innerHTML = fundHTML;

	var techHTML = `
        <div class="data-row"><span class="data-label">1 Day Return</span><span class="data-value" id="an-1d">--</span></div>
        <div class="data-row"><span class="data-label">1 Week Return</span><span class="data-value" id="an-1w">--</span></div>
        <div class="data-row"><span class="data-label">1 Month Return</span><span class="data-value" id="an-1m">--</span></div>
        <div class="data-row"><span class="data-label">SMA (20) Signal</span><span class="data-value" id="an-sma">--</span></div>
        <div class="data-row"><span class="data-label">EMA (20) Signal</span><span class="data-value" id="an-ema">--</span></div>
        <div class="data-row"><span class="data-label">Daily Volume</span><span class="data-value" id="an-volume">--</span></div>
    `;
	document.getElementById("analytics-technicals").innerHTML = techHTML;

	// Force full chart rebuild
	currentAnalyticsTicker = stock.ticker;
	var fullHistory = (stock.preHistory || []).concat(stock.history || []);
	renderAnalyticsChart(stock, fullHistory);

	// Immediately trigger the live update so fields aren't blank
	updateAnalyticsLive();
}

// 2. LIVE UPDATE (Runs every second in sync with the market)
function getBenchmarkIndex(currency) {
	if (currency === "USD") return "SPX500";
	if (currency === "EUR") return "STOXX600";
	if (currency === "JPY") return "NIKKEI225";
	if (currency === "GBP") return "FTSE100";
	if (currency === "HKD") return "HSI";
	if (currency === "CNY") return "SHCOMP";
	return "NIFTY 50";
}

function updateAnalyticsLive() {
	var stock = state.activeStock;
	if (!stock) return;

	var ticksPerDay = 375;
	// Update Market Cap & Volume
	var marketCap = stock.ltp * (stock._sharesOutstanding || 100000000);
	var elCap = document.getElementById("an-market-cap");
	if (elCap) elCap.textContent = formatLargeCurrency(marketCap, stock.currency);

	var elVol = document.getElementById("an-volume");
	if (elVol) elVol.textContent = formatLargeVolume(stock.volume);

	var turnover = stock.ltp * stock.volume;
	var elTurnover = document.getElementById("an-turnover");
	if (elTurnover) elTurnover.textContent = formatLargeCurrency(turnover, stock.currency);

	var fullHistory = (stock.preHistory || []).concat(stock.history || []);
	
	if (fullHistory.length > 0) {
		var ath = Math.max.apply(null, fullHistory);
		var atl = Math.min.apply(null, fullHistory);
		if (stock.ltp > ath) ath = stock.ltp;
		if (stock.ltp < atl) atl = stock.ltp;

		var elAth = document.getElementById("an-ath");
		if (elAth) elAth.textContent = fmtPrice(stock, ath);
		var elAtl = document.getElementById("an-atl");
		if (elAtl) elAtl.textContent = fmtPrice(stock, atl);

		var volRange = ((ath - atl) / atl * 100).toFixed(2) + "%";
		var elVolat = document.getElementById("an-volatility");
		if (elVolat) elVolat.textContent = volRange;


		var totalDays = Math.max(1, fullHistory.length / ticksPerDay);
		var adv = stock.volume / totalDays;
		var elAdv = document.getElementById("an-adv");
		if (elAdv) elAdv.textContent = formatLargeVolume(adv);
	}

	// Calculate Returns
	var dayReturn = ((stock.ltp - stock.prevClose) / stock.prevClose) * 100;
	var weekIndex = Math.max(0, fullHistory.length - 5 * ticksPerDay);
	var weekPrice = fullHistory[weekIndex] || stock.base;
	var weekReturn = ((stock.ltp - weekPrice) / weekPrice) * 100;

	var monthIndex = Math.max(0, fullHistory.length - 22 * ticksPerDay);
	var monthPrice = fullHistory[monthIndex] || stock.base;
	var monthReturn = ((stock.ltp - monthPrice) / monthPrice) * 100;

	// Helper to colorize text
	var setReturn = function (id, val) {
		var el = document.getElementById(id);
		if (!el) return;
		el.textContent = (val >= 0 ? "+" : "") + val.toFixed(2) + "%";
		el.className = "data-value " + (val >= 0 ? "up" : "dn");
	};

	setReturn("an-1d", dayReturn);
	setReturn("an-1w", weekReturn);
	setReturn("an-1m", monthReturn);

	// Update Technical Signals (Calculate using End Of Day prices, not ticks)
	var eodPrices = [];
	for (var d = 22; d >= 0; d--) {
		var tickIdx = fullHistory.length - 1 - d * ticksPerDay;
		if (tickIdx < 0) tickIdx = 0;
		eodPrices.push(fullHistory[tickIdx] || stock.base);
	}
	// Add the live price as the latest data point
	eodPrices[eodPrices.length - 1] = stock.ltp;

	var smaArr = calcSMA(eodPrices, 20);
	var emaArr = calcEMA(eodPrices, 20);
	var currentSMA = smaArr[smaArr.length - 1];
	var currentEMA = emaArr[emaArr.length - 1];

	var elSma = document.getElementById("an-sma");
	if (elSma)
		elSma.innerHTML =
			stock.ltp > currentSMA
				? '<span class="up">Bullish</span>'
				: '<span class="dn">Bearish</span>';

	var elEma = document.getElementById("an-ema");
	if (elEma)
		elEma.innerHTML =
			stock.ltp > currentEMA
				? '<span class="up">Bullish</span>'
				: '<span class="dn">Bearish</span>';

	// 3. Update the live Chart Point seamlessly
	if (analyticsChartInstance && currentAnalyticsTicker === stock.ticker) {
		// Calculate latest % change for Active Stock
		var stockBasePrice =
			fullHistory[Math.max(0, fullHistory.length - 22 * ticksPerDay)] ||
			stock.base;
		var livePct = ((stock.ltp - stockBasePrice) / stockBasePrice) * 100;

		// 4. Update Relative Performance Chart
		var benchmarkTicker = getBenchmarkIndex(stock.currency);
		var indexStock =
			marketStocks.find(function(s) { return s.ticker === benchmarkTicker; }) || marketStocks[0];
		var indexHistory = (indexStock.preHistory || []).concat(
			indexStock.history || [],
		);
		var indexMonthPrice =
			indexHistory[Math.max(0, indexHistory.length - 22 * ticksPerDay)] ||
			indexStock.base;
		var indexLivePct =
			((indexStock.ltp - indexMonthPrice) / indexMonthPrice) * 100;

		// Update the final points on the graph
		var stockDataset = analyticsChartInstance.data.datasets[0];
		stockDataset.data[stockDataset.data.length - 1] = livePct;

		var indexDataset = analyticsChartInstance.data.datasets[1];
		indexDataset.data[indexDataset.data.length - 1] = indexLivePct;

		// update('none') tells Chart.js to repaint without triggering a heavy sliding animation
		analyticsChartInstance.update("none");
	}
}

function renderAnalyticsChart(stock, stockHistory) {
	var canvas = document.getElementById("analytics-chart");
	if (!canvas) return;
	var ctx = canvas.getContext("2d");
	var isLight = state.theme === "light";

	var benchmarkTicker = getBenchmarkIndex(stock.currency);
	var indexStock =
		marketStocks.find(function(s) { return s.ticker === benchmarkTicker; }) || marketStocks[0];
	var indexHistory = (indexStock.preHistory || []).concat(
		indexStock.history || [],
	);

	var ticksPerDay = 375;
	var daysToPlot = 22;

	var stockEOD = [];
	var indexEOD = [];
	var labels = [];

	for (var d = daysToPlot; d >= 0; d--) {
		var tickIdx = stockHistory.length - 1 - d * ticksPerDay;
		if (tickIdx < 0) tickIdx = 0;

		stockEOD.push(stockHistory[tickIdx] || stock.base);
		indexEOD.push(indexHistory[tickIdx] || indexStock.base);

		if (d === 0) labels.push("Live");
		else labels.push(d + "d ago");
	}

	var stockBasePrice = stockEOD[0];
	var indexBasePrice = indexEOD[0];

	var stockPct = stockEOD.map(
		(p) => ((p - stockBasePrice) / stockBasePrice) * 100,
	);
	var indexPct = indexEOD.map(
		(p) => ((p - indexBasePrice) / indexBasePrice) * 100,
	);

	if (analyticsChartInstance) {
		analyticsChartInstance.destroy();
	}

	var grad = ctx.createLinearGradient(0, 0, 0, 300);
	grad.addColorStop(0, "rgba(41, 98, 255, 0.2)");
	grad.addColorStop(1, "rgba(41, 98, 255, 0.0)");

	analyticsChartInstance = new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: stock.ticker,
					data: stockPct,
					borderColor: "rgba(41, 98, 255, 1)",
					backgroundColor: grad,
					borderWidth: 2,
					pointRadius: 0,
					pointHoverRadius: 6,
					fill: true,
					tension: 0.4,
				},
				{
					label: indexStock.ticker,
					data: indexPct,
					borderColor: "rgba(255, 152, 0, 1)",
					borderWidth: 2,
					borderDash: [5, 5],
					pointRadius: 0,
					pointHoverRadius: 0,
					fill: false,
					tension: 0.4,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: false,
			plugins: {
				legend: {
					display: true,
					labels: {
						usePointStyle: true,
						color: isLight ? "#333" : "#D0D2D9",
						font: { family: "Outfit" },
					},
				},
				tooltip: {
					mode: "index",
					intersect: false,
					callbacks: {
						label: function (ctx) {
							return (
								ctx.dataset.label +
								": " +
								(ctx.parsed.y >= 0 ? "+" : "") +
								ctx.parsed.y.toFixed(2) +
								"%"
							);
						},
					},
				},
			},
			scales: {
				x: {
					grid: {
						color: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
					},
					ticks: { color: isLight ? "#666" : "#707888", maxTicksLimit: 7 },
				},
				y: {
					grid: {
						color: function(ctx) {
							if (ctx.tick.value === 0) {
								return isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)";
							}
							return isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
						},
						zeroLineColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)",
					},
					ticks: {
						color: isLight ? "#666" : "#707888",
						callback: function (val) {
							return (val >= 0 ? "+" : "") + val + "%";
						},
					},
				},
			},
		},
	});
}

// Helpers
function formatLargeCurrency(val, currency) {
	var sym = "₹";
	if (currency === "USD") sym = "$";
	else if (currency === "CNY" || currency === "JPY") sym = "¥";
	else if (currency === "EUR") sym = "€";
	else if (currency === "GBP") sym = "£";

	if (currency === "INR") {
		if (val >= 1e7) return sym + (val / 1e7).toFixed(2) + " Cr";
		if (val >= 1e5) return sym + (val / 1e5).toFixed(2) + " L";
	} else {
		if (val >= 1e9) return sym + (val / 1e9).toFixed(2) + " B";
		if (val >= 1e6) return sym + (val / 1e6).toFixed(2) + " M";
	}
	return sym + val.toLocaleString();
}

function formatLargeVolume(val) {
	if (val >= 1e6) return (val / 1e6).toFixed(2) + " M";
	if (val >= 1e3) return (val / 1e3).toFixed(2) + " K";
	return val.toLocaleString();
}
