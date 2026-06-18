/**
 * Dalal Street Terminal - Analytics & Fundamentals Module
 * Relies on global `state`, `marketStocks`, and `Chart` objects from app.js
 */

var analyticsChartInstance = null;

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

function renderAnalytics() {
	var stock = state.activeStock;
	if (!stock) return;

	var rng = getSeededRandom(stock.ticker);

	// 1. GENERATE DETERMINISTIC FUNDAMENTALS
	// Generate Market Cap (Based on LTP and a seeded multiplier)
	var sharesOutstanding = Math.floor(rng() * 900000000) + 100000000;
	var marketCap = stock.ltp * sharesOutstanding;

	// PE Ratio (10 to 80)
	var peRatio = (rng() * 70 + 10).toFixed(2);

	// Dividend Yield (0% to 5%)
	var divYield = (rng() * 5).toFixed(2);

	// 52 Week High/Low (derived from base price)
	var high52 = (stock.base * (1 + (rng() * 0.4 + 0.1))).toFixed(2);
	var low52 = (stock.base * (1 - (rng() * 0.4 + 0.1))).toFixed(2);

	// Next Earnings Day (1 to 90 days from now)
	var nextEarnings = Math.floor(rng() * 90) + 1;

	var fundHTML = `
        <div class="data-row"><span class="data-label">Market Cap</span><span class="data-value">${formatLargeCurrency(marketCap, stock.currency)}</span></div>
        <div class="data-row"><span class="data-label">P/E Ratio</span><span class="data-value">${peRatio}</span></div>
        <div class="data-row"><span class="data-label">Dividend Yield</span><span class="data-value">${divYield}%</span></div>
        <div class="data-row"><span class="data-label">52-Week High</span><span class="data-value">${fmtPrice(stock, parseFloat(high52))}</span></div>
        <div class="data-row"><span class="data-label">52-Week Low</span><span class="data-value">${fmtPrice(stock, parseFloat(low52))}</span></div>
        <div class="data-row"><span class="data-label">Next Earnings</span><span class="data-value">In ${nextEarnings} Days</span></div>
    `;
	document.getElementById("analytics-fundamentals").innerHTML = fundHTML;

	// 2. CALCULATE TECHNICALS
	var ticksPerDay = 375;
	var preHist = stock.preHistory || [];
	var fullHistory = preHist.concat(stock.history || []);

	// 1 Day Return
	var dayReturn = ((stock.ltp - stock.open) / stock.open) * 100;

	// 1 Week Return (5 trading days ago)
	var weekIndex = Math.max(0, fullHistory.length - 5 * ticksPerDay);
	var weekPrice = fullHistory[weekIndex] || stock.base;
	var weekReturn = ((stock.ltp - weekPrice) / weekPrice) * 100;

	// 1 Month Return (22 trading days ago)
	var monthIndex = Math.max(0, fullHistory.length - 22 * ticksPerDay);
	var monthPrice = fullHistory[monthIndex] || stock.base;
	var monthReturn = ((stock.ltp - monthPrice) / monthPrice) * 100;

	// SMA / EMA Signals
	var smaArr = calcSMA(fullHistory, 20);
	var emaArr = calcEMA(fullHistory, 20);
	var currentSMA = smaArr[smaArr.length - 1];
	var currentEMA = emaArr[emaArr.length - 1];

	var smaSignal =
		stock.ltp > currentSMA
			? '<span class="up">Bullish</span>'
			: '<span class="dn">Bearish</span>';
	var emaSignal =
		stock.ltp > currentEMA
			? '<span class="up">Bullish</span>'
			: '<span class="dn">Bearish</span>';

	var techHTML = `
        <div class="data-row"><span class="data-label">1 Day Return</span><span class="data-value ${dayReturn >= 0 ? "up" : "dn"}">${dayReturn >= 0 ? "+" : ""}${dayReturn.toFixed(2)}%</span></div>
        <div class="data-row"><span class="data-label">1 Week Return</span><span class="data-value ${weekReturn >= 0 ? "up" : "dn"}">${weekReturn >= 0 ? "+" : ""}${weekReturn.toFixed(2)}%</span></div>
        <div class="data-row"><span class="data-label">1 Month Return</span><span class="data-value ${monthReturn >= 0 ? "up" : "dn"}">${monthReturn >= 0 ? "+" : ""}${monthReturn.toFixed(2)}%</span></div>
        <div class="data-row"><span class="data-label">SMA (20) Signal</span><span class="data-value">${smaSignal}</span></div>
        <div class="data-row"><span class="data-label">EMA (20) Signal</span><span class="data-value">${emaSignal}</span></div>
        <div class="data-row"><span class="data-label">Daily Volume</span><span class="data-value">${formatLargeVolume(stock.volume)}</span></div>
    `;
	document.getElementById("analytics-technicals").innerHTML = techHTML;

	// 3. RENDER RELATIVE PERFORMANCE CHART
	renderAnalyticsChart(stock, fullHistory);
}

function renderAnalyticsChart(stock, stockHistory) {
	var canvas = document.getElementById("analytics-chart");
	if (!canvas) return;
	var ctx = canvas.getContext("2d");
	var isLight = state.theme === "light";

	// Get Index Data (NIFTY 50 is base)
	var indexStock =
		marketStocks.find((s) => s.ticker === "NIFTY 50") || marketStocks[0];
	var indexHistory = (indexStock.preHistory || []).concat(
		indexStock.history || [],
	);

	// We want to plot the End-Of-Day prices for the last 22 days (1 month)
	var ticksPerDay = 375;
	var daysToPlot = 22;

	var stockEOD = [];
	var indexEOD = [];
	var labels = [];

	// Extract EOD (End of Day) prices
	for (var d = daysToPlot; d >= 0; d--) {
		var tickIdx = stockHistory.length - 1 - d * ticksPerDay;
		if (tickIdx < 0) tickIdx = 0;

		stockEOD.push(stockHistory[tickIdx] || stock.base);
		indexEOD.push(indexHistory[tickIdx] || indexStock.base);

		if (d === 0) labels.push("Today");
		else labels.push(d + "d ago");
	}

	// Normalize to Percentage base 100 for comparison
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

// Helpers for Analytics formatting
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
