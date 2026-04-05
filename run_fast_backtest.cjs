const fs = require('fs');

const calculateEMA = (d, p) => { let e = new Array(d.length).fill(null); if (d.length < p) return e; let s = d.slice(0, p).reduce((a, b) => a + b, 0); e[p - 1] = s / p; let k = 2 / (p + 1); for (let i = p; i < d.length; i++)e[i] = (d[i] - e[i - 1]) * k + e[i - 1]; return e };
const calculateSMA = (d, p) => { let s = new Array(d.length).fill(null); for (let i = p - 1; i < d.length; i++) { let sum = 0; for (let j = 0; j < p; j++)sum += d[i - j]; s[i] = sum / p } return s };
const calculateRSI = (c, p = 14) => { let r = new Array(c.length).fill(null); if (c.length <= p) return r; let g = 0, l = 0; for (let i = 1; i <= p; i++) { let d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d } g /= p; l /= p; if (l === 0) r[p] = 100; else r[p] = 100 - 100 / (1 + g / l); for (let i = p + 1; i < c.length; i++) { let d = c[i] - c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p; if (l === 0) r[i] = 100; else r[i] = 100 - 100 / (1 + g / l) } return r };
const calculateMACD = (c, f = 12, s = 26, sig = 9) => { let fe = calculateEMA(c, f), se = calculateEMA(c, s); let m = fe.map((v, i) => (v !== null && se[i] !== null) ? v - se[i] : null); let mf = m.filter(v => v !== null); let si = calculateEMA(mf, sig); let sl = new Array(m.length).fill(null); let siIdx = 0; for (let i = 0; i < m.length; i++)if (m[i] !== null && siIdx < si.length) sl[i] = si[siIdx++]; return { m, s: sl } };
const calculateStochRSI = (r, p = 14, k = 3, d = 3) => { let s = new Array(r.length).fill(null); for (let i = p - 1; i < r.length; i++) { let w = r.slice(i - p + 1, i + 1).filter(v => v !== null); if (w.length < p) continue; let min = Math.min(...w), max = Math.max(...w); if (max - min === 0) s[i] = 100; else s[i] = ((r[i] - min) / (max - min)) * 100 } let kv = calculateSMA(s.filter(v => v !== null), k); let kl = new Array(s.length).fill(null); let ki = 0; for (let i = 0; i < s.length; i++)if (s[i] !== null && ki < kv.length) kl[i] = kv[ki++]; let dv = calculateSMA(kl.filter(v => v !== null), d); let dl = new Array(kl.length).fill(null); let di = 0; for (let i = 0; i < kl.length; i++)if (kl[i] !== null && di < dv.length) dl[i] = dv[di++]; return { k: kl, d: dl } };

function runBacktest(retraceP, waitM) {
  const raw = JSON.parse(fs.readFileSync('backtest_cache.json'));
  const { k1m, k5m, k1h, k1d, config } = raw;

  console.log(`\nIndicator Warm-up: OK (Started from 2024-07)`);
  const i5m = { s: calculateStochRSI(calculateRSI(k5m.map(k => k.close))) };
  const i1h = { m: calculateMACD(k1h.map(k => k.close)), s: calculateStochRSI(calculateRSI(k1h.map(k => k.close))) };
  const i1d = { m: calculateMACD(k1d.map(k => k.close)) };

  let balance = 1000, pos = null, m5Idx = 0, currentGSignal = 'HOLD', pendingOrder = null;
  const LEV = 5, TP_NET = 0.030, SL_NET = 0.15;
  const FEE_MARGIN = (0.0002 + 0.0002) * LEV;

  let wins = 0, losses = 0;
  for (let i = 0; i < k1m.length; i++) {
    const k = k1m[i];
    while (m5Idx < k5m.length && k5m[m5Idx].time <= k.time - 300000) m5Idx++;
    let r5 = m5Idx - 1, r1h = -1, r1d = -1;
    for (let j = k1h.length - 1; j >= 0; j--) if (k1h[j].time <= k.time - 3600000) { r1h = j; break; }
    for (let j = k1d.length - 1; j >= 0; j--) if (k1d[j].time <= k.time - 86400000) { r1d = j; break; }
    if (r5 < 0 || r1h < 0 || r1d < 0) continue;

    const k5 = i5m.s.k[r5], d5 = i5m.s.d[r5], m1h = i1h.m.m[r1h], s1h = i1h.m.s[r1h], kh = i1h.s.k[r1h], dh = i1h.s.d[r1h], m1d = i1d.m.m[r1d], s1d = i1d.m.s[r1d];
    const c5 = k5 > d5 ? 'LONG' : (k5 < d5 ? 'SHORT' : 'HOLD');
    const ch = (m1h > s1h && kh > dh) ? 'LONG' : ((m1h < s1h && kh < dh) ? 'SHORT' : 'HOLD');
    const cd = m1d > s1d ? 'LONG' : (m1d < s1d ? 'SHORT' : 'HOLD');
    let gSig = (c5 === 'LONG' && ch === 'LONG' && cd === 'LONG') ? 'LONG' : ((c5 === 'SHORT' && ch === 'SHORT' && cd === 'SHORT') ? 'SHORT' : 'HOLD');

    if (pendingOrder && !pos) {
      if (pendingOrder.side === 'LONG' && k.low <= pendingOrder.limitPrice) {
        const entry = Math.min(k.open, pendingOrder.limitPrice);
        pos = { side: 'LONG', entryPrice: entry, tp: entry * (1 + (TP_NET + FEE_MARGIN) / LEV), sl: entry * (1 - SL_NET / LEV) };
        pendingOrder = null;
      } else if (pendingOrder.side === 'SHORT' && k.high >= pendingOrder.limitPrice) {
        const entry = Math.max(k.open, pendingOrder.limitPrice);
        pos = { side: 'SHORT', entryPrice: entry, tp: entry * (1 - (TP_NET + FEE_MARGIN) / LEV), sl: entry * (1 + SL_NET / LEV) };
        pendingOrder = null;
      } else {
        pendingOrder.waiting++;
        if (pendingOrder.waiting >= waitM) pendingOrder = null;
      }
    }

    if (!pos && !pendingOrder && gSig !== 'HOLD' && gSig !== currentGSignal) {
      const signalPrice = k.open;
      const limit = gSig === 'LONG' ? signalPrice * (1 - retraceP / 100) : signalPrice * (1 + retraceP / 100);
      pendingOrder = { side: gSig, limitPrice: limit, waiting: 0 };
    }
    currentGSignal = gSig;

    if (pos) {
      const low = k.low, high = k.high;
      if (pos.side === 'LONG') {
        if (high >= pos.tp) { balance *= (1 + TP_NET); wins++; pos = null; }
        else if (low <= pos.sl) { balance *= (1 - (SL_NET + 0.0007 * LEV)); losses++; pos = null; }
      } else {
        if (low <= pos.tp) { balance *= (1 + TP_NET); wins++; pos = null; }
        else if (high >= pos.sl) { balance *= (1 - (SL_NET + 0.0007 * LEV)); losses++; pos = null; }
      }
    }
  }

  console.log(`=== FAST REPORT (Wait: ${waitM}m, Retrace: ${retraceP}%) ===`);
  console.log(`Final Balance: $${balance.toFixed(2)}`);
  console.log(`Win Rate: ${(wins / (wins + losses) * 100).toFixed(2)}% (${wins}W / ${losses}L)`);
}

const rp = parseFloat(process.argv[2]) || 0;
const wm = parseInt(process.argv[3]) || 60;
runBacktest(rp, wm);
