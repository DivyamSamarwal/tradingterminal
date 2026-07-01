# 📈 Trading Terminal Simulator

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Environment](https://img.shields.io/badge/environment-Client--Side-orange.svg)

A high-performance, real-time trading terminal simulator built entirely with client-side web technologies. 

This project provides a highly accurate, tick-by-tick financial market microstructure simulation. It is engineered for quantitative analysis, strategy backtesting, and educational purposes, allowing users to interact with synthetic markets featuring authentic liquidity constraints, timezone synchronization, and derivatives pricing models.

---

## 📑 Table of Contents

- [Core Architecture](#-core-architecture)
- [Features](#-features)
- [Installation & Usage](#-installation--usage)
- [About the Project](#️-about-the-project)
- [Contributing](#-contributing)
- [License](#-license)
- [Disclaimer](#-disclaimer)

---

## ⚡ Core Architecture

The application is built with a focus on zero-latency execution and high-frequency DOM updates.
* **Frontend Framework**: Vanilla HTML5, CSS3, JavaScript (ES5/ES6).
* **State Management**: 100% in-memory client-side architecture. Order queues, portfolio states, and tick histories are managed in browser memory without reliance on external databases or APIs.
* **Rendering Engine**: Utilizes batched DOM updates and optimized rendering loops to sustain thousands of tick updates per second without UI degradation.

---

## 🚀 Features

### 🏛️ 1. Market Microstructure & Liquidity
The simulation enforces strict market microstructure rules, rejecting the concept of infinite liquidity found in basic simulators.
* **Tick Volume Modeling**: Order book depth is mathematically scaled to the real-world daily volume of specific asset classes. Order execution is constrained by available synthetic liquidity.
* **Asynchronous Exchange Hours**: The engine tracks the operating hours of global exchanges (NYSE, NASDAQ, NSE, TSE, SSE, HKEX, LSE). Assets are only tradable during their respective timezone sessions.
* **After-Hours Processing**: When an exchange closes, its order book state is frozen. Market orders are rejected, while Limit and Stop orders are securely queued for the subsequent market open.
* **Circuit Breakers**: Simulates exchange-mandated trading halts. Assets experiencing extreme volatility (±10%) hit Upper or Lower Circuit Limits, instantly drying up order book liquidity and preventing execution.

### 📊 2. Concurrent Market-Cap Weighted Indices
* **Live Aggregation**: Global indices (e.g., S&P 500, NIFTY 50, HSI, STOXX 600) are rigorously tied to their underlying constituent stocks.
* **Market-Cap Weighting**: Index prices update concurrently based on the real-time share prices and shares outstanding of their components.
* **Overnight Gaps**: When markets open, indices accurately gap up or down based on the overnight pre-market movements of their underlying assets.

### ⚙️ 3. Advanced Order Execution Engine
A robust routing and execution engine supporting advanced order types and Time-in-Force (TIF) instructions.
* **Market & Limit Orders**: Executes immediately against available liquidity or guarantees execution at the specified limit price.
* **Stop Orders**: Triggers upon price crossing a specified threshold, instantly converting to a Market order to capture momentum.
* **Time In Force (TIF)**: Supports **DAY**, **IOC** (Immediate or Cancel), and **FOK** (Fill or Kill) instructions.
* **Position Limits**: Implements algebraic exposure calculation to enforce strict maximum position caps and prevent exploitation.

### 🤖 4. Algorithmic Custom Bot Studio
* **Integrated IDE**: A fully-featured, embedded CodeMirror IDE that allows users to write raw JavaScript trading algorithms directly within the browser.
* **Real-time Syntax Validation**: An advanced syntax checker that validates code and intercepts errors before execution to prevent engine crashes.
* **Dynamic Engine Caching**: Custom bots are intelligently compiled and cached on the fly to `new Function()`, preventing CPU overhead and allowing for high-frequency sub-millisecond execution loops.
* **Sandbox Security**: User scripts execute with robust error handling and HTML sanitization (XSS protection) on all console outputs, keeping the terminal strictly secure.

### 📉 5. Derivatives & Pricing Models
* **Synthetic Options**: Supports Call and Put options on underlying equities.
* **Live Greeks Calculation**: Dynamically computes premium pricing using standard risk metrics (Delta, Gamma, Theta, Vega).
* **Time Decay**: Options premiums realistically decay as the contract approaches expiry (Theta).
* **Clearing & Settlement**: Automated End-of-Day (EOD) processing handles the exercise or expiration of derivatives based on the underlying asset's closing price.

### 🌍 6. Global Multi-Asset Universe
* **Equities**: Instruments from US, Indian, Japanese, Chinese, Hong Kong, and European exchanges.
* **Indices**: Tracking major benchmarks (S&P 500, NIFTY 50, Nikkei 225, HSI, DAX, FTSE 100).
* **Commodities**: Futures-style contracts for precious metals and energy.
* **Cryptocurrency**: Continuous 24/7 trading for digital assets.
* **Forex (FX) & Fixed Income**: Currency pairs and sovereign debt yields.
* **Automated FX Conversion**: Real-time cross-currency conversion dynamically settles international P&L into the base portfolio currency.
* **Categorized Watchlist**: Organize and filter the vast universe of instruments via a dedicated, toggleable sidebar watchlist.

### 🏦 7. Dalal Bank & Credit System
* **Dynamic Credit Scoring**: Tracks a live CIBIL Score (300-900) based on financial behavior, affecting loan eligibility and interest rates.
* **Margin Loans**: Take out short-term, high-interest loans to multiply buying power. Daily EMI is automatically deducted from the cash margin.
* **Fixed Deposits**: Lock in excess cash for guaranteed risk-free returns over set maturity periods.
* **Liquidations & Defaults**: Failing to cover daily loan EMIs triggers CIBIL score penalties and forces immediate liquidation of trading assets to cover debts.

### 🏢 8. Real Estate & Property Market
* **Property Portfolio**: Buy, hold, and sell 30 unique global properties spanning Residential, Commercial, and Luxury sectors.
* **Dynamic Rent Collection**: Earn daily rental yields automatically based on the live fluctuating market value of owned properties.
* **Mortgages & Foreclosure**: Purchase properties with 20% down payments via 14-day mortgages. Missing EMI payments results in bank foreclosure, asset seizure, and severe credit damage.

### 📰 9. Risk Management & News Engine
* **Live Portfolio Metrics**: Real-time calculation of Portfolio Value, Cash Balance, Required Margin, and Unrealized P&L.
* **Bracket Orders**: Integrated Stop-Loss and Take-Profit functionality for automated risk management.
* **Technical Charting**: Integrated candlestick charting with customizable intervals, logarithmic scaling, and technical overlays.
* **Multi-Chart Layouts**: Split the workspace into 2x or 4x grids to simultaneously monitor and trade multiple different instruments side-by-side.
* **Interactive Drawing Tools**: Annotate charts directly with Trendlines, Horizontal Support/Resistance levels, and Fibonacci Retracements.
* **News & Sentiment Engine**: Injects simulated macroeconomic data and geopolitical events, triggering localized volatility spikes and algorithmic sentiment shifts.

### 🎨 10. Customization & Theming Engine
* **Dynamic UI Theming**: Switch between multiple highly polished color palettes including Deep Dark Mode and Light Mode.
* **Typography Control**: Swap between modern sans-serif fonts (Outfit, Inter) and developer-focused monospace fonts (Roboto Mono, JetBrains Mono).
* **Live Styling Overrides**: The UI instantly reacts and re-renders components using CSS Variables to apply user customization seamlessly.

### 📈 11. Real-Time Simulation Analytics
* **True Mathematical Fundamentals**: Generates live simulation analytics such as Total Turnover (Volume × Price), Average Daily Volume, All-Time Highs, and Historical Volatility Range calculated directly from the simulation's mathematical history rather than static data.
* **Live Technical Signals**: EOD (End of Day) tracking for 20-day Simple and Exponential Moving Averages (SMA / EMA) to provide dynamic Bullish/Bearish sentiment signals.

### 💼 12. The Syndicate (Black Market)
* **Underground Crates**: Utilize excess cash to purchase Bronze, Silver, or Gold crates that drop randomized, powerful market perks.
* **Insider Advantages**: Unlock temporary rule-bending mechanics such as **Brokerage Holiday** (zero trading fees), **Circuit Override** (bypass exchange halts), **Market Freeze** (pause time to evaluate positions), and **Profit Amplifier** (boosted returns).
* **Inventory Management**: Accumulate and deploy these perks strategically to maximize portfolio growth or survive severe market downturns.

### ⏱️ 13. Simulation Playback Controls
* **Time Acceleration**: Fast-forward the market simulation at **10x Speed** to quickly backtest strategies across multiple trading days.
* **Market Freeze**: Manually pause the simulation engine to calmly review portfolio metrics, analyze charts, and place complex order setups without latency pressure.

---

## 💻 Installation & Usage

The application requires no backend configuration or package installation.

1. **Clone the repository** to your local environment:
   ```bash
   git clone https://github.com/yourusername/tradingterminal.git
   ```
2. **Navigate** into the project directory:
   ```bash
   cd tradingterminal
   ```
3. **Open `index.html`** in any modern web browser (Google Chrome, Firefox, Safari, Edge).
4. The simulation engine will initialize automatically. No build step is required!

### Quick Start
1. **Asset Selection**: Utilize the categorical tabs (Equities, Indices, Crypto, etc.) to navigate the asset universe.
2. **Market Data**: Select an instrument to render its live chart and Level 2 Market Depth order book.
3. **Order Entry**: Navigate to the order panel, input the desired quantity, and select the order type (`MARKET`, `LIMIT`, `STOP`) and TIF instruction.
4. **Position Management**: Monitor active trades and pending orders in the lower dashboard. Close positions manually or rely on automated EOD settlement.

---

## ℹ️ About the Project

The **Trading Terminal Simulator** was conceived to bridge the gap between theoretical financial knowledge and practical market dynamics without the inherent risk of actual capital loss. 

Many basic simulators provide infinite liquidity and instant execution, which fails to prepare users for the realities of slippage, partial fills, and liquidity constraints. This project addresses these shortcomings by implementing a robust, purely client-side matching engine that accurately models order book depth, time-in-force instructions, and realistic market constraints. 

Whether you are a student learning market microstructure, a developer studying low-latency JavaScript rendering, or a quant enthusiast testing logic against synthetic ticks, this simulator provides a rich, uncompromising environment.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check [issues page](#) if you want to contribute.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

This software is a **SIMULATOR**. All market data, pricing models, and liquidity metrics are generated by mathematical algorithms. It does not reflect live data from actual financial exchanges and is strictly intended for educational, testing, and entertainment purposes. Do not use this software for actual financial trading or decision-making.
