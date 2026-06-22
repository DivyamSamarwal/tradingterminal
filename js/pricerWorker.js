/**
 * Dalal Street Terminal - CRR Binomial Tree Pricer (Web Worker)
 * ==============================================================
 * Runs the Cox-Ross-Rubinstein binomial tree for American option pricing
 * entirely off the main thread.  Hard-capped at N=40 steps to keep
 * O(N²) complexity browser-safe.
 *
 * Message In:  { S, K, T, r, sigma, type }
 *   S     - Current underlying price
 *   K     - Strike price
 *   T     - Time to expiry in years (e.g. 20/252 for 20 trading days)
 *   r     - Risk-free rate (e.g. 0.05 for 5%)
 *   sigma - Implied volatility (e.g. 0.25)
 *   type  - 'CALL' | 'PUT'
 *
 * Message Out: { callPrice, putPrice, delta, gamma }
 */

'use strict';

// ── Hard safety ceiling ────────────────────────────────────────────────────
var N = 40; // Never increase this; O(N²) = 1,600 nodes is already safe

/**
 * Cox-Ross-Rubinstein (CRR) Binomial Tree for American options.
 * Backward induction from expiry, applying early-exercise at each node.
 *
 * @param {number} S      - Spot price
 * @param {number} K      - Strike price
 * @param {number} T      - Time to expiry in years
 * @param {number} r      - Continuous risk-free rate
 * @param {number} sigma  - Volatility (annualised)
 * @param {string} type   - 'CALL' or 'PUT'
 * @returns {number}       - American option price
 */
function crrAmericanPrice(S, K, T, r, sigma, type) {
    if (T <= 0) {
        // At or past expiry: return intrinsic value only
        if (type === 'CALL') return Math.max(0, S - K);
        return Math.max(0, K - S);
    }

    var dt      = T / N;                        // Length of each time step
    var u       = Math.exp(sigma * Math.sqrt(dt)); // Up-factor
    var d       = 1.0 / u;                     // Down-factor (CRR: d = 1/u)
    var disc    = Math.exp(-r * dt);            // Per-step discount factor
    // Risk-neutral probability of an up-move
    var p       = (Math.exp(r * dt) - d) / (u - d);
    var q       = 1.0 - p;

    // Guard: clamp p to (0, 1) to handle extreme sigma/T combos
    p = Math.max(1e-9, Math.min(1 - 1e-9, p));
    q = 1.0 - p;

    // ── 1. Build terminal node values ─────────────────────────────────────
    // Terminal stock prices: S * u^(N-2j) for j = 0..N
    // We only need the values array (length N+1), not the full tree.
    var values = new Float64Array(N + 1);
    for (var j = 0; j <= N; j++) {
        var terminalS = S * Math.pow(u, N - 2 * j);
        if (type === 'CALL') {
            values[j] = Math.max(0, terminalS - K);
        } else {
            values[j] = Math.max(0, K - terminalS);
        }
    }

    // ── 2. Backward induction ─────────────────────────────────────────────
    for (var i = N - 1; i >= 0; i--) {
        for (var j2 = 0; j2 <= i; j2++) {
            // Continuation value (risk-neutral expectation, discounted one step)
            var continuation = disc * (p * values[j2] + q * values[j2 + 1]);

            // Intrinsic value at this node (early exercise for American)
            var nodeS = S * Math.pow(u, i - 2 * j2);
            var intrinsic;
            if (type === 'CALL') {
                intrinsic = Math.max(0, nodeS - K);
            } else {
                intrinsic = Math.max(0, K - nodeS);
            }

            // American: max(Intrinsic, Continuation)
            values[j2] = Math.max(intrinsic, continuation);
        }
    }

    return values[0]; // Root node = today's price
}

/**
 * Compute delta and gamma via finite-difference bumps.
 * Uses a ±0.5% bump relative to spot for numerical stability.
 */
function crrGreeks(S, K, T, r, sigma, type) {
    var bump  = S * 0.005; // 0.5% bump
    var Sup   = S + bump;
    var Sdown = S - bump;

    var Vmid  = crrAmericanPrice(S,     K, T, r, sigma, type);
    var Vup   = crrAmericanPrice(Sup,   K, T, r, sigma, type);
    var Vdown = crrAmericanPrice(Sdown, K, T, r, sigma, type);

    var delta = (Vup - Vdown) / (2 * bump);
    var gamma = (Vup - 2 * Vmid + Vdown) / (bump * bump);

    return { price: Vmid, delta: delta, gamma: gamma };
}

// ── Worker message handler ─────────────────────────────────────────────────
self.onmessage = function (e) {
    var d     = e.data;
    var S     = d.S;
    var K     = d.K;
    var T     = Math.max(0, d.T);  // Guard: no negative time
    var r     = d.r     || 0.05;
    var sigma = d.sigma || 0.25;

    // Price both CALL and PUT in one worker message to halve round-trips
    var callResult = crrGreeks(S, K, T, r, sigma, 'CALL');
    var putResult  = crrGreeks(S, K, T, r, sigma, 'PUT');

    self.postMessage({
        callPrice: callResult.price,
        callDelta: callResult.delta,
        callGamma: callResult.gamma,
        putPrice:  putResult.price,
        putDelta:  putResult.delta,
        putGamma:  putResult.gamma
    });
};
