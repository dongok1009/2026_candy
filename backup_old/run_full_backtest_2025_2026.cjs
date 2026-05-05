const axios = require('axios');
const fs = require('fs');

// --- Indicators (Optimized for Speed) ---
const calculateEMA=(d,p)=>{let e=new Array(d.length).fill(null);if(d.length<p)return e;let s=d.slice(0,p).reduce((a,b)=>a+b,0);e[p-1]=s/p;let k=2/(p+1);for(let i=p;i<d.length;i++)e[i]=(d[i]-e[i-1])*k+e[i-1];return e};
const calculateSMA=(d,p)=>{let s=new Array(d.length).fill(null);for(let i=p-1;i<d.length;i++){let sum=0;for(let j=0;j<p;j++)sum+=d[i-j];s[i]=sum/p}return s};
const calculateRSI=(c,p=14)=>{let r=new Array(c.length).fill(null);if(c.length<=p)return r;let g=0,l=0;for(let i=1;i<=p;i++){let d=c[i]-c[i-1];if(d>=0)g+=d;else l-=d}g/=p;l/=p;if(l===0)r[p]=100;else r[p]=100-100/(1+g/l);for(let i=p+1;i<c.length;i++){let d=c[i]-c[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;if(l===0)r[i]=100;else r[i]=100-100/(1+g/l)}return r};
const calculateMACD=(c,f=12,s=26,sig=9)=>{let fe=calculateEMA(c,f),se=calculateEMA(c,s);let m=fe.map((v,i)=>(v!==null&&se[i]!==null)?v-se[i]:null);let mf=m.filter(v=>v!==null);let si=calculateEMA(mf,sig);let sl=new Array(m.length).fill(null);let siIdx=0;for(let i=0;i<m.length;i++)if(m[i]!==null&&siIdx<si.length)sl[i]=si[siIdx++];return{m,s:sl}};
const calculateStochRSI=(r,p=14,k=3,d=3)=>{let s=new Array(r.length).fill(null);for(let i=p-1;i<r.length;i++){let w=r.slice(i-p+1,i+1).filter(v=>v!==null);if(w.length<p)continue;let min=Math.min(...w),max=Math.max(...w);if(max-min===0)s[i]=100;else s[i]=((r[i]-min)/(max-min))*100}let kv=calculateSMA(s.filter(v=>v!==null),k);let kl=new Array(s.length).fill(null);let ki=0;for(let i=0;i<s.length;i++)if(s[i]!==null&&ki<kv.length)kl[i]=kv[ki++];let dv=calculateSMA(kl.filter(v=>v!==null),d);let dl=new Array(kl.length).fill(null);let di=0;for(let i=0;i<kl.length;i++)if(kl[i]!==null&&di<dv.length)dl[i]=dv[di++];return{k:kl,d:dl}};

function toKST(ts){let d=new Date(ts+9*60*60*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`}

async function fetchKlines(symbol, interval, startTime, endTime) {
  let all = []; let cur = startTime;
  process.stdout.write(`Fetching ${interval}... `);
  while(cur < endTime){
    try{
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, { params:{symbol,interval,startTime:cur,limit:1500}});
      if(!res.data||res.data.length===0)break;
      all.push(...res.data); cur = res.data[res.data.length-1][0]+1;
      if(res.data.length<1500)break;
      await new Promise(r=>setTimeout(r,300));
    }catch(e){console.error(e.message); break;}
  }
  console.log('Done.');
  return all.filter(d=>d[0]<=endTime).map(d=>({time:d[0],open:parseFloat(d[1]),high:parseFloat(d[2]),low:parseFloat(d[3]),close:parseFloat(d[4])}));
}

const START_TIME = new Date('2025-01-01T00:00:00+09:00').getTime();
const END_TIME = new Date('2026-04-02T00:00:00+09:00').getTime();
const FETCH_START = START_TIME - (86400000 * 180); // 180 days warm up

async function run() {
  const k1m = await fetchKlines('BTCUSDT','1m',START_TIME,END_TIME);
  const k5m = await fetchKlines('BTCUSDT','5m',FETCH_START,END_TIME);
  const k1h = await fetchKlines('BTCUSDT','1h',FETCH_START,END_TIME);
  const k1d = await fetchKlines('BTCUSDT','1d',FETCH_START,END_TIME);

  console.log('Calculating indicators...');
  const i5m = {s:calculateStochRSI(calculateRSI(k5m.map(k=>k.close)))};
  const i1h = {m:calculateMACD(k1h.map(k=>k.close)),s:calculateStochRSI(calculateRSI(k1h.map(k=>k.close)))};
  const i1d = {m:calculateMACD(k1d.map(k=>k.close))};

  let balance = 1000, pos = null, m5Idx = 0, currentGSignal = 'HOLD', pendingOrder = null;
  const LEV = 5, TP_NET = 0.03, SL_NET = 0.15;
  const FEE_MARGIN = (0.0002+0.0002)*LEV;

  const tradeLog = [];
  let wins = 0, losses = 0;

  console.log('Running backtest simulation...');
  for(let i=0; i<k1m.length; i++){
    const k = k1m[i];
    
    // Find matching completed candle indices
    while(m5Idx < k5m.length && k5m[m5Idx].time <= k.time - 300000) m5Idx++;
    let r5 = m5Idx-1;
    let r1h = -1;
    for(let j=k1h.length-1; j>=0; j--) if(k1h[j].time <= k.time - 3600000){ r1h=j; break; }
    let r1d = -1;
    for(let j=k1d.length-1; j>=0; j--) if(k1d[j].time <= k.time - 86400000){ r1d=j; break; }
    
    if(r5<0||r1h<0||r1d<0) continue;

    // Signal Logic v6.0.0
    const k5=i5m.s.k[r5], d5=i5m.s.d[r5], m1h=i1h.m.m[r1h], s1h=i1h.m.s[r1h], kh=i1h.s.k[r1h], dh=i1h.s.d[r1h], m1d=i1d.m.m[r1d], s1d=i1d.m.s[r1d];
    const c5 = k5>d5?'LONG':(k5<d5?'SHORT':'HOLD');
    const ch = (m1h>s1h&&kh>dh)?'LONG':((m1h<s1h&&kh<dh)?'SHORT':'HOLD');
    const cd = m1d>s1d?'LONG':(m1d<s1d?'SHORT':'HOLD');
    let gSig = (c5==='LONG'&&ch==='LONG'&&cd==='LONG')?'LONG':((c5==='SHORT'&&ch==='SHORT'&&cd==='SHORT')?'SHORT':'HOLD');

    // 1. Pending Order Logic (Strict Limit)
    if(pendingOrder && !pos) {
      if(pendingOrder.side === 'LONG' && k.low <= pendingOrder.limitPrice) {
        const entry = Math.min(k.open, pendingOrder.limitPrice);
        pos = { side:'LONG', entryTime: k.time, entryPrice: entry, tp: entry*(1+(TP_NET+FEE_MARGIN)/LEV), sl: entry*(1-SL_NET/LEV)};
        pendingOrder = null;
      } else if(pendingOrder.side === 'SHORT' && k.high >= pendingOrder.limitPrice) {
        const entry = Math.max(k.open, pendingOrder.limitPrice);
        pos = { side:'SHORT', entryTime: k.time, entryPrice: entry, tp: entry*(1-(TP_NET+FEE_MARGIN)/LEV), sl: entry*(1+SL_NET/LEV)};
        pendingOrder = null;
      } else {
        pendingOrder.waiting++;
        if(pendingOrder.waiting >= 60) pendingOrder = null; // 1 hour timeout
      }
    }

    // 2. New Signal Detection
    if(!pos && !pendingOrder && gSig !== 'HOLD' && gSig !== currentGSignal) {
      const limit = gSig==='LONG' ? k5m[r5].low : k5m[r5].high;
      pendingOrder = { side: gSig, limitPrice: limit, waiting: 0 };
    }
    currentGSignal = gSig;

    // 3. Position Management
    if(pos) {
      if(pos.side==='LONG'){
        if(k.high>=pos.tp){
          balance*=(1+TP_NET); tradeLog.push({type:'LONG', entry:pos.entryPrice, exit:pos.tp, roi:3.0, time:toKST(pos.entryTime), exitTime:toKST(k.time)});
          wins++; pos=null;
        } else if(k.low<=pos.sl){
          balance*=(1-(SL_NET+0.0007*LEV)); tradeLog.push({type:'LONG', entry:pos.entryPrice, exit:pos.sl, roi:-15.0, time:toKST(pos.entryTime), exitTime:toKST(k.time)});
          losses++; pos=null;
        }
      } else {
        if(k.low<=pos.tp){
          balance*=(1+TP_NET); tradeLog.push({type:'SHORT', entry:pos.entryPrice, exit:pos.tp, roi:3.0, time:toKST(pos.entryTime), exitTime:toKST(k.time)});
          wins++; pos=null;
        } else if(k.high>=pos.sl){
          balance*=(1-(SL_NET+0.0007*LEV)); tradeLog.push({type:'SHORT', entry:pos.entryPrice, exit:pos.sl, roi:-15.0, time:toKST(pos.entryTime), exitTime:toKST(k.time)});
          losses++; pos=null;
        }
      }
    }
  }

  const finalROI = ((balance-1000)/1000*100).toFixed(2);
  const winRate = (wins/(wins+losses)*100).toFixed(2);
  console.log(`\n=== Backtest Report (2025-01-01 to Present) ===`);
  console.log(`Final Balance: $${balance.toFixed(2)}`);
  console.log(`Total Return: ${finalROI}%`);
  console.log(`Win Rate: ${winRate}% (${wins}W / ${losses}L)`);
  console.log(`Total trades: ${wins+losses}`);

  fs.writeFileSync('v600_full_2025_2026_summary.csv', "Time,Side,Entry,Exit,ROI,ExitTime\n" + tradeLog.map(t=>`${t.time},${t.type},${t.entry.toFixed(2)},${t.exit.toFixed(2)},${t.roi}%,${t.exitTime}`).join('\n'));
  console.log("\nFull results saved to v600_full_2025_2026_summary.csv");
}
run();
