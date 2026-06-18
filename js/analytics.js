/**
 * Dalal Street Terminal - Analytics & Fundamentals Module
 * Relies on global `state`, `marketStocks`, and `Chart` objects from app.js
 */

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
        <div class="data-row"><span class="data-label">P/E Ratio</span><span class="data-value">${peRatio}</span></div>
        <div class="data-row"><span class="data-label">Dividend Yield</span><span class="data-value">${divYield}%</span></div>
        <div class="data-row"><span class="data-label">52-Week High</span><span class="data-value">${fmtPrice(stock, parseFloat(high52))}</span></div>
        <div class="data-row"><span class="data-label">52-Week Low</span><span class="data-value">${fmtPrice(stock, parseFloat(low52))}</span></div>
        <div class="data-row"><span class="data-label">Next Earnings</span><span class="data-value">In ${nextEarnings} Days</span></div>
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
function updateAnalyticsLive() {
	var stock = state.activeStock;
	if (!stock) return;

	// Update Market Cap & Volume
	var marketCap = stock.ltp * (stock._sharesOutstanding || 100000000);
	var elCap = document.getElementById("an-market-cap");
	if (elCap) elCap.textContent = formatLargeCurrency(marketCap, stock.currency);

	var elVol = document.getElementById("an-volume");
	if (elVol) elVol.textContent = formatLargeVolume(stock.volume);

	// Calculate Returns
	var ticksPerDay = 375;
	var fullHistory = (stock.preHistory || []).concat(stock.history || []);

	var dayReturn = ((stock.ltp - stock.open) / stock.open) * 100;
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

	// Update Technical Signals
	var smaArr = calcSMA(fullHistory, 20);
	var emaArr = calcEMA(fullHistory, 20);
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

		// Calculate latest % change for NIFTY
		var indexStock =
			marketStocks.find((s) => s.ticker === "NIFTY 50") || marketStocks[0];
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

	var indexStock =
		marketStocks.find((s) => s.ticker === "NIFTY 50") || marketStocks[0];
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

	analyticsChartInstance = new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: stock.ticker,
					data: stockPct,
					borderColor: "rgba(41, 98, 255, 1)",
					backgroundColor: "rgba(41, 98, 255, 0.1)",
					borderWidth: 2,
					pointRadius: 3,
					fill: true,
					tension: 0.2,
				},
				{
					label: indexStock.ticker,
					data: indexPct,
					borderColor: "rgba(255, 152, 0, 1)",
					borderWidth: 2,
					borderDash: [5, 5],
					pointRadius: 0,
					fill: false,
					tension: 0.2,
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
						color: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
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
