# 📈 Trading Terminal Simulator (Pro Edition)

A high-performance, real-time simulated trading terminal built entirely with frontend technologies (HTML, CSS, JavaScript). 

This project simulates a highly realistic, tick-by-tick financial market environment. It is designed for traders, developers, and financial enthusiasts who want to practice trading, test strategies, and experience authentic market mechanics—complete with liquidity constraints, timezone synchronization, and derivatives—without risking real capital.

---

## 🚀 Comprehensive Feature List

### 🌍 Global Multi-Asset & Market Support
The terminal features a diverse universe of tradable assets, each bound to their real-world exchange hours and base currencies.
* **Equities**: Trade blue-chip and high-growth stocks from the **NSE** (India), **NASDAQ** (US), **SSE** (China), and **TSE** (Japan).
* **Global Indices**: Track macroeconomic trends with major indices including the **NIFTY 50**, **S&P 500**, **Nikkei 225**, and **Hang Seng**.
* **Commodities**: Trade physical goods like **Gold**, **Silver**, **Crude Oil**, and **Natural Gas** via futures-style contracts.
* **Cryptocurrency**: Trade high-volatility digital assets like **BTC**, **ETH**, and **DOGE**, which trade continuously 24/7 without market closure.
* **Forex (FX)**: Trade major currency pairs like **EUR/USD**, **GBP/USD**, and **USD/JPY**.
* **Bonds (Fixed Income)**: Track global sovereign debt yields including **US10Y**, **IN10Y**, and **DE10Y** to monitor global interest rate sentiment.

### ⏱️ Multi-Market Timezone Synchronization
Unlike basic simulators, this engine natively tracks the exact operating hours of global exchanges:
* **US Stocks** only trade during New York market hours.
* **Japanese Stocks** trade during Asian market hours.
* **Indian Stocks** trade during IST market hours.
* **Ironclad Market Closure**: The exact second an exchange closes, its order book enters an "After-Hours Freeze". All price action halts, market orders are instantly blocked, and any pending Limit or Stop orders are securely queued for the next day's opening bell.

### 🌊 Extreme Liquidity Realism & Order Execution
The simulation does not grant you "infinite liquidity." It features a mathematical order book model that forces you to respect market volume.
* **Tick Volume Liquidity**: Order book depth is mathematically scaled to the real-world daily volume of each specific asset class. A 1,000-share order on a massive tech stock fills instantly, while a 1,000-share order on an illiquid asset will take significant time to execute.
* **Market Orders**: Instantly sweeps the currently available liquidity. If your massive order exceeds the available buyers/sellers, it will **partially fill** and sit in the queue until more volume arrives.
* **Limit Orders**: Guarantees your execution price *or better*. Limit orders are not instantly granted fills when triggered; they must siphon available `Tick Vol` from the market, draining tick-by-tick just like a Market order.
* **STOP Market Orders**: Use BUY STOPs to catch breakouts or SELL STOPs to short breakdowns. Triggered automatically when an asset crosses your target price, instantly converting to a Market order.
* **Strict Position Caps**: An advanced validation logic firewall prevents you from exploiting maximum position limits (e.g., 1,000,000 shares). The engine algebraically calculates your net exposure by summing your **Current Positions + All Pending Orders** before allowing a trade.

### 📈 Options Trading & Derivatives Engine
A fully modeled synthetic options market built into the terminal.
* **Call & Put Options**: Trade synthetic derivatives on underlying equities to leverage your capital or hedge your portfolio.
* **Live Greeks Pricing Engine**: Calculates dynamic premium pricing in real-time using modeled variables:
  * **Delta**: Premium sensitivity to the underlying asset's price movement.
  * **Gamma**: The rate of change of Delta.
  * **Theta (Time Decay)**: Options realistically and mathematically lose value as they approach their expiry date.
  * **Vega**: Sensitivity to implied volatility.
* **End-of-Day Settlement**: Options are automatically settled or exercised at expiry based on the underlying asset's closing price, simulating real clearinghouse mechanics.

### 🛑 Circuit Breakers & Market Halts
* Accurately simulates exchange freezes. 
* If a highly volatile asset crashes or skyrockets by 10% (hitting its Lower or Upper Circuit Limit), trading is instantly halted. 
* Liquidity dries up realistically on the order book, preventing you from panic-selling during a limit-down, or FOMO-buying during a limit-up.

### 📊 Advanced Portfolio Management & Risk
* **Live Risk Metrics**: A dynamic dashboard tracks your Live Portfolio Value, Cash Balance, Required Margin, and Unrealized Day P&L.
* **Native Currency Conversion**: A built-in real-time FX engine automatically converts international P&L (USD, EUR, GBP, JPY, CNY) back into your base portfolio currency (INR).
* **Stop-Loss & Take-Profit Brackets**: Auto square-off functionality built directly into position management to protect your capital while you step away.

### 📰 Breaking News & Sentiment Engine
* A simulated live news feed dynamically injects macroeconomic data, earnings reports, and geopolitical events into the terminal.
* News events instantly trigger volatility spikes and sentiment shifts (bullish/bearish) into specific stocks or entire sectors, forcing you to react to changing market conditions in real-time.

### 🕯️ Advanced Charting & Technicals
* Integrated candlestick and line charts.
* Customizable timeframes (5M, 15M, 1H, 1D, 1W).
* Toggle between Logarithmic and Linear scaling.
* Overlay technical indicators including Simple Moving Averages (SMA) and Exponential Moving Averages (EMA).

---

## 🛠️ Technology Stack & Architecture

This application represents a masterclass in frontend performance optimization.
* **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES5/ES6)
* **Zero Backend**: 100% Client-side architecture. No backend server, database, or API keys are required to run the core simulation.
* **In-Memory State**: Data, order queues, portfolio state, and price histories are managed entirely in browser memory, providing zero-latency execution.
* **Optimized DOM Rendering**: The terminal uses batched DOM updates and highly optimized rendering loops to handle thousands of tick updates per second without lagging the browser.

---

## 📦 Installation & How to Run

Because this application runs entirely in the browser, installation is instantaneous:

1. **Clone** or download the repository to your local machine.
2. **Extract** the folder.
3. **Run**: Double-click the `index.html` file to open it in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).
4. **Trade**: The global multi-asset simulation will boot up and start ticking immediately!

*(Note: If you plan on extending this into a multiplayer, session-based platform in the future, you can easily attach a Node.js + Socket.io backend to broadcast the tick stream.)*

---

## 🎮 Quick Start Guide

1. **The Watchlist**: Use the top-left tabs (All, Index, Bond, NSE, NASDAQ, Crypto, etc.) to filter the massive universe of assets.
2. **Market Depth**: Click any asset in the watchlist to load its live chart and open its Level 2 Market Depth order book.
3. **Execution**: Use the right-hand panel to enter a Quantity. 
   - Select **MARKET** for instant liquidity.
   - Select **LIMIT** to guarantee your price.
   - Select **STOP** to trigger a trade on a breakout/breakdown. 
   - *Note: Orders will be queued in the Pending list or blocked entirely if the specific global exchange is currently closed!*
4. **Monitoring**: Watch your open positions, P&L, and pending orders in the bottom dock. Use the "Close" button to exit a trade and realize your profit or loss!

---

## ⚠️ Disclaimer

This is a **SIMULATOR**. The prices, volumes, Greeks, and market depth are generated by mathematical algorithms for educational, testing, and entertainment purposes. It does **NOT** reflect real-time live data from actual stock exchanges, and cannot be used for actual financial trading. 
