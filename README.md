# Trading Terminal Simulator

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Environment](https://img.shields.io/badge/environment-Client--Side-orange.svg)]()

A high-performance, real-time trading terminal simulator built entirely with client-side web technologies. 

This project provides a highly accurate, tick-by-tick financial market microstructure simulation. It is engineered for quantitative analysis, strategy backtesting, and educational purposes, allowing users to interact with synthetic markets featuring authentic liquidity constraints, timezone synchronization, and derivatives pricing models.

---

## Core Architecture

The application is built with a focus on zero-latency execution and high-frequency DOM updates.
* **Frontend Framework**: Vanilla HTML5, CSS3, JavaScript (ES5/ES6).
* **State Management**: 100% in-memory client-side architecture. Order queues, portfolio states, and tick histories are managed in browser memory without reliance on external databases or APIs.
* **Rendering Engine**: Utilizes batched DOM updates and optimized rendering loops to sustain thousands of tick updates per second without UI degradation.

---

## Features

### 1. Market Microstructure & Liquidity
The simulation enforces strict market microstructure rules, rejecting the concept of infinite liquidity found in basic simulators.
* **Tick Volume Modeling**: Order book depth is mathematically scaled to the real-world daily volume of specific asset classes. Order execution is constrained by available synthetic liquidity.
* **Asynchronous Exchange Hours**: The engine tracks the operating hours of global exchanges (NYSE, NASDAQ, NSE, TSE, SSE). Assets are only tradable during their respective timezone sessions.
* **After-Hours Processing**: When an exchange closes, its order book state is frozen. Market orders are rejected, while Limit and Stop orders are securely queued for the subsequent market open.
* **Circuit Breakers**: Simulates exchange-mandated trading halts. Assets experiencing extreme volatility (±10%) hit Upper or Lower Circuit Limits, instantly drying up order book liquidity and preventing execution.

### 2. Order Execution Engine
A robust routing and execution engine supporting advanced order types and Time-in-Force (TIF) instructions.
* **Market Orders**: Executes immediately against available liquidity. Excess quantity exceeding the current order book depth is queued as pending.
* **Limit Orders**: Guarantees execution at the specified limit price or better. Fills tick-by-tick based on available market volume.
* **Stop Orders**: Triggers upon price crossing a specified threshold, instantly converting to a Market order to capture momentum.
* **Time In Force (TIF)**:
  * **DAY**: Orders remain active in the pending queue until filled or canceled at the End-of-Day (EOD) settlement.
  * **IOC (Immediate or Cancel)**: Fills the maximum possible quantity against current liquidity; any unfilled remainder is immediately canceled.
  * **FOK (Fill or Kill)**: Requires the entire order quantity to be filled instantly. If insufficient liquidity exists, the entire order is canceled.
* **Position Limits**: Implements algebraic exposure calculation (Current Position + Pending Orders) to enforce strict maximum position caps (e.g., 1,000,000 shares) and prevent exploitation.

### 3. Derivatives & Pricing Models
* **Synthetic Options**: Supports Call and Put options on underlying equities.
* **Live Greeks Calculation**: Dynamically computes premium pricing using standard risk metrics (Delta, Gamma, Theta, Vega).
* **Time Decay**: Options premiums realistically decay as the contract approaches expiry (Theta).
* **Clearing & Settlement**: Automated End-of-Day (EOD) processing handles the exercise or expiration of derivatives based on the underlying asset's closing price.

### 4. Global Multi-Asset Universe
* **Equities**: Instruments from US, Indian, Japanese, and Chinese exchanges.
* **Indices**: Tracking major benchmarks (S&P 500, NIFTY 50, Nikkei 225).
* **Commodities**: Futures-style contracts for precious metals and energy.
* **Cryptocurrency**: Continuous 24/7 trading for digital assets.
* **Forex (FX) & Fixed Income**: Currency pairs and sovereign debt yields.
* **Automated FX Conversion**: Real-time cross-currency conversion dynamically settles international P&L into the base portfolio currency.

### 5. Risk Management & Analysis
* **Live Portfolio Metrics**: Real-time calculation of Portfolio Value, Cash Balance, Required Margin, and Unrealized P&L.
* **Bracket Orders**: Integrated Stop-Loss and Take-Profit functionality for automated risk management.
* **Technical Charting**: Integrated candlestick charting with customizable intervals, logarithmic scaling, and technical overlays (SMA, EMA).
* **News & Sentiment Engine**: Injects simulated macroeconomic data and geopolitical events, triggering localized volatility spikes and algorithmic sentiment shifts.

---

## Installation

The application requires no backend configuration or package installation.

1. Clone the repository to your local environment.
2. Navigate to the project directory.
3. Open `index.html` in any modern web browser (Google Chrome, Firefox, Safari, Edge).
4. The simulation engine will initialize automatically.

---

## Usage Guide

1. **Asset Selection**: Utilize the categorical tabs (Equities, Indices, Crypto, etc.) to navigate the asset universe.
2. **Market Data**: Select an instrument to render its live chart and Level 2 Market Depth order book.
3. **Order Entry**: Navigate to the order panel, input the desired quantity, and select the order type (MARKET, LIMIT, STOP) and TIF instruction.
4. **Position Management**: Monitor active trades and pending orders in the lower dashboard. Close positions manually or rely on automated EOD settlement.

---

## Disclaimer

This software is a **SIMULATOR**. All market data, pricing models, and liquidity metrics are generated by mathematical algorithms. It does not reflect live data from actual financial exchanges and is strictly intended for educational, testing, and entertainment purposes. Do not use this software for actual financial trading or decision-making.
