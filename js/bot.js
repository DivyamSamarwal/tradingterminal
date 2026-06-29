// ==================== ALGO BOT MANAGER ====================

function BotInstance(ticker, config) {
	this.ticker = ticker;
	this.strategy = config.strategy || "CONFLUENCE";
	this.riskPct = config.riskPct || 5;
	this.direction = config.direction || "LONG_SHORT"; // LONG_ONLY, SHORT_ONLY, LONG_SHORT
	this.asset = config.asset || "EQUITY"; // EQUITY, OPTIONS
	this.useTrailingStop = config.useTrailingStop || false;
	
	this.state = "FLAT"; // FLAT, LONG, SHORT
	this.entryPrice = 0;
	this.qty = 0;
	this.slPrice = 0;
	this.tpPrice = 0;
	this.highestPrice = 0; // For trailing stop LONG
	this.lowestPrice = 0;  // For trailing stop SHORT
	this.optionId = null;  // For tracking the specific option contract traded
}

BotInstance.prototype.tick = function() {
	var stock = stockMap[this.ticker];
	if (!stock) return;
	
	var ltp = stock.ltp;
	var fxRate = EXCHANGE_RATES[stock.currency] || 1;

	// Manual Position Sync
	if (this.state !== "FLAT") {
		if (this.asset === "EQUITY") {
			var currentPos = state.positions[this.ticker];
			var actualQty = currentPos ? Math.abs(currentPos.qty) : 0;
			if (actualQty <= 0) {
				this.state = "FLAT";
				this.qty = 0;
			} else if (actualQty < this.qty) {
				this.qty = actualQty; // Sync partial manual exit
			}
		} else if (this.asset === "OPTIONS" && this.optionId) {
			var posOpt = state.optionsPositions[this.optionId];
			var actualLots = posOpt ? posOpt.lots : 0;
			var actualQtyOpt = actualLots * (posOpt ? posOpt.lotSize : (LOT_SIZES[this.ticker] || 100));
			if (actualQtyOpt <= 0) {
				this.state = "FLAT";
				this.qty = 0;
				this.optionId = null;
			} else if (actualQtyOpt < this.qty) {
				this.qty = actualQtyOpt; // Sync partial manual exit
			}
		}
	}

	// Trailing Stop Logic Updates
	if (this.useTrailingStop && this.state !== "FLAT") {
		if (this.state === "LONG" && ltp > this.highestPrice) {
			this.highestPrice = ltp;
			var newSl = this.highestPrice * 0.99;
			if (newSl > this.slPrice) this.slPrice = newSl;
		}
		if (this.state === "SHORT" && ltp < this.lowestPrice) {
			this.lowestPrice = ltp;
			var newSl2 = this.lowestPrice * 1.01;
			if (newSl2 < this.slPrice) this.slPrice = newSl2;
		}
	}

	// Exit Logic
	if (this.state === "LONG" || this.state === "SHORT") {
		var hitSL = (this.state === "LONG" && ltp <= this.slPrice) || (this.state === "SHORT" && ltp >= this.slPrice);
		var hitTP = (this.state === "LONG" && ltp >= this.tpPrice) || (this.state === "SHORT" && ltp <= this.tpPrice);

		if (hitSL || hitTP) {
			if (this.asset === "EQUITY") {
				// Determine exit direction (Inverse of entry)
				var exitSide = this.state === "LONG" ? "SELL" : "BUY";
				
				if (stock.circuitHit === "LC" && exitSide === "SELL") return;
				if (stock.circuitHit === "UC" && exitSide === "BUY") return;

				var avail = stock.available_liquidity || 0;
				var fillQty = Math.min(this.qty, avail);

				if (fillQty > 0) {
					if (processEquityTrade(stock, exitSide, fillQty, ltp, true)) {
						stock.available_liquidity -= fillQty;
						this.qty -= fillQty;
						
						if (this.qty <= 0) {
							this.state = "FLAT";
							toast("Bot ("+this.ticker+")", "Squared off " + exitSide + " position", "success");
						}
					}
				}
			} else if (this.asset === "OPTIONS" && this.optionId) {
				// Options Exit
				var posOpt = state.optionsPositions[this.optionId];
				if (posOpt && posOpt.lots > 0) {
					var parts = this.optionId.split("_");
					var optType = parts[1];
					var strike = parseFloat(parts[2]);
					var expiryType = parts[3];

					var lotsToSell = Math.min(posOpt.lots, Math.floor(this.qty / posOpt.lotSize));
					if (lotsToSell > 0) {
						if (processOptionTrade(stock, "SELL", optType, strike, expiryType, lotsToSell, posOpt.lotSize, fxRate, true)) {
							this.state = "FLAT";
							this.qty = 0;
							this.optionId = null;
							toast("Bot ("+this.ticker+")", "Squared off Option position", "success");
						}
					} else {
						this.state = "FLAT";
						this.qty = 0;
						this.optionId = null;
					}
				} else {
					this.state = "FLAT"; // User manually closed it probably
				}
			}
		}
		return; // Wait for FLAT to look for new entries
	}
	
	// Warmup check for new entries
	var prices = stock.history;
	if (prices.length < 40) return; 

	// Signal Generation
	var signal = null; // null, "LONG", "SHORT"
	
	if (this.strategy === "CONFLUENCE") {
		var rsiData = calcRSI(prices, 14);
		var rsi = rsiData[rsiData.length - 1];
		var macdData = calcMACD(prices, 12, 26, 9);
		var hist = macdData.histogram;
		var histCurr = hist[hist.length - 1];
		var histPrev = hist[hist.length - 2];
		
		if (histCurr !== null && histPrev !== null) {
			// Bullish Cross
			if (rsi < 40 && histPrev < 0 && histCurr > 0) {
				if (this.direction === "LONG_SHORT" || this.direction === "LONG_ONLY") signal = "LONG";
			}
			// Bearish Cross
			if (rsi > 60 && histPrev > 0 && histCurr < 0) {
				if (this.direction === "LONG_SHORT" || this.direction === "SHORT_ONLY") signal = "SHORT";
			}
		}
	} else if (this.strategy === "MOMENTUM") {
		var r = Math.random();
		if (r < 0.05) {
			if (this.direction === "LONG_SHORT" || this.direction === "LONG_ONLY") signal = "LONG";
		} else if (r > 0.95) {
			if (this.direction === "LONG_SHORT" || this.direction === "SHORT_ONLY") signal = "SHORT";
		}
	}
	
	// Entry Execution
	if (signal) {
		var ltpINR = ltp * fxRate;
		var riskAmount = state.margin * (this.riskPct / 100);

		if (this.asset === "EQUITY") {
			var side = signal === "LONG" ? "BUY" : "SELL"; // SELL opens a short position
			if (stock.circuitHit === "UC" && side === "BUY") return;
			if (stock.circuitHit === "LC" && side === "SELL") return;

			var maxQty = Math.floor(riskAmount / ltpINR);
			if (maxQty > 0) {
				var avail = stock.available_liquidity || 0;
				var fillQty = Math.min(maxQty, avail);
				
				if (fillQty > 0) {
					if (processEquityTrade(stock, side, fillQty, ltp, true)) {
						stock.available_liquidity -= fillQty;
						this.qty = fillQty;
						this.entryPrice = ltp;
						this.highestPrice = ltp;
						this.lowestPrice = ltp;
						this.slPrice = signal === "LONG" ? ltp * 0.99 : ltp * 1.01; 
						this.tpPrice = signal === "LONG" ? ltp * 1.02 : ltp * 0.98;
						this.state = signal;
						toast("Bot ("+this.ticker+")", "Opened " + signal + " Equity position for " + fillQty, "success");
					}
				}
			}
		} else if (this.asset === "OPTIONS") {
			var optType = signal === "LONG" ? "CE" : "PE";
			
			// Find ATM Strike
			var step = stock.step || 10;
			var strike = Math.round(ltp / step) * step;
			var expiryType = "W1";
			var remainingDays = getExpiryDays() - getDayFraction();
			
			var premium = calcPremium(optType, strike, ltp, Math.max(0.01, remainingDays));
			var lotSize = LOT_SIZES[this.ticker] || 100;
			var lotCostINR = (premium * lotSize) * fxRate;
			
			var lots = Math.floor(riskAmount / lotCostINR);
			if (lots > 0) {
				if (processOptionTrade(stock, "BUY", optType, strike, expiryType, lots, lotSize, fxRate, true)) {
					this.qty = lots * lotSize;
					this.entryPrice = ltp;
					this.highestPrice = ltp;
					this.lowestPrice = ltp;
					this.slPrice = signal === "LONG" ? ltp * 0.99 : ltp * 1.01; 
					this.tpPrice = signal === "LONG" ? ltp * 1.02 : ltp * 0.98;
					this.state = signal;
					this.optionId = stock.ticker + "_" + optType + "_" + strike + "_" + expiryType;
					toast("Bot ("+this.ticker+")", "Opened " + signal + " Options position ("+lots+" Lots)", "success");
				}
			}
		}
	}
};


var BotManager = {
	activeBots: {},

	start: function(ticker, config) {
		if (this.activeBots[ticker]) {
			toast("Bot Error", "Bot is already running on " + ticker, "error");
			return;
		}
		var stock = stockMap[ticker];
		if (!stock) return;
		if (stock.market === "INDEX" && config.asset === "EQUITY") {
			toast("Bot Error", "Cannot trade Equity on Indices. Use Options asset class.", "error");
			return;
		}

		this.activeBots[ticker] = new BotInstance(ticker, config);
		toast("Bot Engine", "Bot launched on " + ticker, "success");
		this.updateUI(ticker);
		this.renderStats();
	},

	stop: function(ticker) {
		if (this.activeBots[ticker]) {
			delete this.activeBots[ticker];
			toast("Bot Engine", "Bot stopped on " + ticker, "warning");
			this.updateUI(ticker);
			this.renderStats();
		}
	},

	toggle: function() {
		var ticker = state.activeStock ? state.activeStock.ticker : null;
		if (!ticker) return toast("Bot Error", "Select a stock first", "error");

		if (this.activeBots[ticker]) {
			this.stop(ticker);
		} else {
			var config = {
				direction: document.getElementById("bot-direction").value,
				asset: document.getElementById("bot-asset").value,
				strategy: document.getElementById("bot-strategy").value,
				riskPct: parseInt(document.getElementById("bot-risk-slider").value),
				useTrailingStop: document.getElementById("bot-trailing-stop").checked
			};
			this.start(ticker, config);
		}
	},

	updateUI: function(currentTicker) {
		if (!state.activeStock || state.activeStock.ticker !== currentTicker) return;
		
		var bot = this.activeBots[currentTicker];
		var display = document.getElementById("bot-state-display");
		var btnText = document.getElementById("bot-btn-text");
		var btnToggle = document.getElementById("btn-toggle-bot");

		if (bot) {
			if (display) {
				display.textContent = bot.state === "FLAT" ? "RUNNING" : (bot.state + " (" + bot.qty + ")");
				display.style.color = bot.state === "FLAT" ? "var(--green)" : "var(--accent)";
			}
			if (btnText) btnText.innerHTML = '<i class="fa-solid fa-stop"></i> STOP ENGINE';
			if (btnToggle) btnToggle.style.setProperty('--accent', 'var(--red)');
		} else {
			if (display) {
				display.textContent = "OFFLINE";
				display.style.color = "var(--text-dim)";
			}
			if (btnText) btnText.innerHTML = '<i class="fa-solid fa-power-off"></i> START ENGINE';
			if (btnToggle) btnToggle.style.setProperty('--accent', 'var(--accent)');
		}
	},

	tickAll: function() {
		if (!state.marketOpen) return;
		var tickers = Object.keys(this.activeBots);
		for (var i = 0; i < tickers.length; i++) {
			this.activeBots[tickers[i]].tick();
		}
		
		// Update active stock UI dynamically
		if (state.activeStock && this.activeBots[state.activeStock.ticker]) {
			this.updateUI(state.activeStock.ticker);
		}

		if (state.activeBottomTab === "bot-stats") {
			this.renderStats();
		}
	},

	renderStats: function() {
		var tbody = document.getElementById("bot-stats-tbody");
		if (!tbody) return;
		
		var tickers = Object.keys(this.activeBots);
		if (tickers.length === 0) {
			tbody.innerHTML = '<tr><td colspan="9" class="empty">No active bots running</td></tr>';
			return;
		}

		var html = "";
		for (var i = 0; i < tickers.length; i++) {
			var ticker = tickers[i];
			var bot = this.activeBots[ticker];
			var stock = stockMap[ticker];
			if (!stock) continue;
			
			var ltp = stock.ltp;
			var pnlNative = 0;
			
			if (bot.state !== "FLAT") {
				if (bot.asset === "EQUITY") {
					pnlNative = bot.state === "LONG" ? (ltp - bot.entryPrice) * bot.qty : (bot.entryPrice - ltp) * bot.qty;
				} else if (bot.asset === "OPTIONS" && bot.optionId) {
					var posOpt = state.optionsPositions[bot.optionId];
					if (posOpt) {
						var remainingDays = posOpt.daysToExpiry - getDayFraction();
						var currentPrem = calcPremium(posOpt.type, posOpt.strike, ltp, remainingDays);
						pnlNative = (currentPrem - posOpt.avgPremium) * bot.qty;
					}
				}
			}
			
			var fxRate = EXCHANGE_RATES[stock.currency] || 1;
			var pnlINR = pnlNative * fxRate;
			var pnlCls = pnlINR >= 0 ? "up" : "dn";
			
			html += '<tr style="cursor:pointer;" onclick="selectStock(stockMap[\''+ticker+'\'])">' +
				'<td class="sym-cell">'+ticker+'</td>' +
				'<td>'+bot.asset+'</td>' +
				'<td class="'+(bot.state === 'LONG'?'side-long':(bot.state==='SHORT'?'side-short':''))+'">'+bot.state+'</td>' +
				'<td class="r">'+bot.qty+'</td>' +
				'<td class="r">'+bot.entryPrice.toFixed(2)+'</td>' +
				'<td class="r">'+(bot.state !== "FLAT" ? bot.slPrice.toFixed(2) : "-")+'</td>' +
				'<td class="r">'+ltp.toFixed(2)+'</td>' +
				'<td class="r '+pnlCls+'">'+fmtCur(pnlINR)+'</td>' +
				'<td class="r"><button class="btn-sm" style="background:var(--red);color:white;border:none;padding:2px 6px;border-radius:4px;cursor:pointer;" onclick="event.stopPropagation(); BotManager.stop(\''+ticker+'\')">STOP</button></td>' +
			'</tr>';
		}
		tbody.innerHTML = html;
	}
};

// Bind UI event once on load
document.addEventListener("DOMContentLoaded", function() {
	var btnToggle = document.getElementById("btn-toggle-bot");
	// Note: btn-toggle-bot has its listener bound in app.js as well!
	// We need to unbind old app.js listeners if they exist, or just overwrite it.
	if (btnToggle) {
		// Replacing the element clears existing event listeners set in app.js
		var newBtnToggle = btnToggle.cloneNode(true);
		btnToggle.parentNode.replaceChild(newBtnToggle, btnToggle);
		newBtnToggle.addEventListener("click", function() {
			BotManager.toggle();
		});
	}
	
	var botRiskSlider = document.getElementById("bot-risk-slider");
	if (botRiskSlider) {
		var newSlider = botRiskSlider.cloneNode(true);
		botRiskSlider.parentNode.replaceChild(newSlider, botRiskSlider);
		newSlider.addEventListener("input", function() {
			document.getElementById("bot-risk-val").textContent = this.value + "%";
		});
	}

	// Override selectStock slightly to hook BotManager UI
	var oldSelectStock = window.selectStock;
	if (typeof oldSelectStock === "function") {
		window.selectStock = function(stockArg) {
			oldSelectStock(stockArg);
			var t = (typeof stockArg === "string") ? stockArg : (stockArg ? stockArg.ticker : null);
			if (t) BotManager.updateUI(t);
		};
	}
});
