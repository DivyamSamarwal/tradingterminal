/**
 * Dalal Street Terminal - "Hydra" Anti-Bot Stochastic Engine
 * ============================================================
 * A Dynamic Regime-Switching Ensemble that replaces the old 0.502-biased
 * random walk. Three sub-models (Momentum, MeanRevert, Chaos Wildcard) are
 * blended with cryptographically-seeded weights that shift based on an
 * internal 10-period EMA and Z-Score, making price action unpredictable
 * from the browser console.
 *
 * Public API:
 *   HydraEngine.getTick(stock, price, trend, traderXP) -> newPrice
 */

var HydraEngine = (function () {
    'use strict';

    // ── EMA α for the internal 10-period tracker ──────────────────────────
    var EMA_ALPHA = 2 / (10 + 1); // ≈ 0.1818…

    /**
     * Lazily initialise the _hydra state bag attached to each stock.
     * Stored directly on the stock object for O(1) access per tick.
     */
    function _ensureHydra(stock, currentPrice) {
        if (!stock._hydra) {
            stock._hydra = {
                ema: currentPrice,   // 10-period EMA
                m2:  0,              // Running sum of squared deviations (Welford's)
                n:   1,              // Sample count (starts at 1 to avoid div/0)
                mean: currentPrice   // Running mean for Welford variance
            };
        }
    }

    /**
     * Update the EMA and rolling variance using a numerically-stable
     * Welford online algorithm.  Returns { ema, stdDev } for the Z-Score.
     */
    function _updateMarketPosture(hydra, newPrice) {
        // ── EMA update ────────────────────────────────────────────────────
        hydra.ema = EMA_ALPHA * newPrice + (1 - EMA_ALPHA) * hydra.ema;

        // ── Welford's online variance update ─────────────────────────────
        hydra.n++;
        var delta  = newPrice - hydra.mean;
        hydra.mean += delta / hydra.n;
        var delta2 = newPrice - hydra.mean;
        hydra.m2   += delta * delta2;

        // Cap n so old data doesn't dominate forever (rolling ≈ 50-period)
        if (hydra.n > 50) {
            hydra.n  = 50;
            // Mild mean decay toward EMA to stay "live"
            hydra.mean = 0.9 * hydra.mean + 0.1 * hydra.ema;
        }

        var variance = hydra.n > 1 ? hydra.m2 / (hydra.n - 1) : 0;
        var stdDev   = variance > 0 ? Math.sqrt(variance) : newPrice * 0.001;
        return { ema: hydra.ema, stdDev: stdDev };
    }

    /**
     * The three sub-model personalities.
     * Each returns a dimensionless price *move* (not yet applied).
     */
    var SubModels = {
        momentum: function (v, trend) {
            return (Math.random() - 0.48) * v * 1.8 + trend;
        },
        meanRevert: function (v, basePrice, currentPrice) {
            return ((basePrice - currentPrice) / basePrice) * (v * 4.0);
        },
        wildcard: function (v) {
            return Math.random() > 0.95
                ? (Math.random() - 0.5) * v * 8
                : 0;
        }
    };

    /**
     * Derive the charCode sum of a ticker string once, then cache it.
     * Used as part of the cryptographic salt so two different stocks
     * produce different weight distributions even at the same XP/timestamp.
     */
    function _getCharCodeSum(stock) {
        if (stock._hydraCharSum !== undefined) return stock._hydraCharSum;
        var sum = 0;
        for (var i = 0; i < stock.ticker.length; i++) {
            sum += stock.ticker.charCodeAt(i);
        }
        stock._hydraCharSum = sum;
        return sum;
    }

    /**
     * Core public method: returns the new price after one Hydra tick.
     *
     * @param {object} stock       - Stock object from marketStocks (mutated: stock._hydra)
     * @param {number} price       - Current price (pre-tick)
     * @param {number} trend       - Intraday trend bias from the caller
     * @param {number} traderXP    - TraderProfile.xp, used in the salt
     * @returns {number}           - New price
     */
    function getTick(stock, price, trend, traderXP) {
        var v = stock.vol * (window.VOL_MULTIPLIER || 1);

        // ── 1. Initialise / update internal market posture tracker ────────
        _ensureHydra(stock, price);
        var posture = _updateMarketPosture(stock._hydra, price);

        var ema    = posture.ema;
        var stdDev = posture.stdDev;

        // ── 2. Z-Score: how far is the price from its own EMA? ────────────
        var zScore    = stdDev > 0 ? (price - ema) / stdDev : 0;
        var absZ      = Math.abs(zScore);

        // ── 3. Base weights [Momentum, MeanRevert, Wildcard] ──────────────
        var wM  = 1.0;  // Momentum
        var wMR = 1.0;  // Mean-Revert
        var wW  = 0.2;  // Wildcard / Chaos

        // ── 4. Regime Shift ───────────────────────────────────────────────
        if (absZ > 2.2) {
            // Over-extended: force a mean-reversion snap-back
            wM  = 0.1;
            wMR = 3.5 * absZ;
            wW  = 0.05;
        } else if (absZ < 0.3) {
            // Dead sideways: trigger a chaotic breakout
            wM  = 0.8;
            wMR = 0.2;
            wW  = 2.0;
        }

        // ── 5. Cryptographic Salt ─────────────────────────────────────────
        // Math.sin() maps any float to [-1, 1]; shift to [0, 1].
        var tickerCharCodeSum = _getCharCodeSum(stock);
        var saltRaw    = Math.sin(traderXP + tickerCharCodeSum + Date.now());
        var dynamicSalt = (saltRaw + 1) * 0.5; // normalise to [0, 1]

        // Modulate weights by salt
        wM  *= (0.5 + dynamicSalt);
        wMR *= (1.5 - dynamicSalt);
        // wW is intentionally not modulated — chaos stays pure

        // ── 6. Normalise weights to sum = 1.0 ────────────────────────────
        var totalW = wM + wMR + wW;
        wM  /= totalW;
        wMR /= totalW;
        wW  /= totalW;

        // ── 7. Sample each sub-model ──────────────────────────────────────
        var moveMomentum   = SubModels.momentum(v, trend);
        var moveMeanRevert = SubModels.meanRevert(v, stock.base, price);
        var moveWildcard   = SubModels.wildcard(v);

        // ── 8. Dot-product ensemble price move ────────────────────────────
        var totalMove = wM * moveMomentum + wMR * moveMeanRevert + wW * moveWildcard;

        // ── 9. Apply and guard against zero/negative prices ───────────────
        var newPrice = price * (1 + totalMove);
        return Math.max(0.0001, newPrice);
    }

    // Public interface
    return { getTick: getTick };
}());
