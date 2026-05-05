const fs = require('fs');

const targetYear = '2025';
const fileName = `backtest_cache_${targetYear}.json`;
const resFile = `ULTIMATE_TRADE_LEDGER_JAN_MAR.csv`;

const calculateEMA=(d,p)=>{let e=new Array(d.length).fill(null);if(d.length<p)return e;let s=d.slice(0,p).reduce((a,b)=>a+b,0);e[p-1]=s/p;let k=2/(p+1);for(let i=p;i<d.length;i++)e[i]=(d[i]-e[i-1])*k+e[i-1];return e};
const calculateSMA=(d,p)=>{let s=new Array(d.length).fill(null);for(let i=p-1;i<d.length;i++){let sum=0;for(let j=0;j<p;j++)sum+=d[i-j];s[i]=sum/p}return s};
const calculateRSI=(c,p=14)=>{let r=new Array(c.length).fill(null);if(c.length<=p)return r;let g=0,l=0;for(let i=1;i<=p;i++){let d=c[i]-c[i-1];if(d>=0)g+=d;else l-=d}g/=p;l/=p;if(l===0)r[p]=100;else r[p]=100-100/(1+g/l);for(let i=p+1;i<c.length;i++){let d=c[i]-c[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;if(l===0)r[i]=100;else r[i]=100-100/(1+g/l)}return r};
const calculateMACD=(c,f=12,s=26,sig=9)=>{let fe=calculateEMA(c,f),se=calculateEMA(c,s);let m=fe.map((v,i)=>(v!==null&&se[i]!==null)?v-se[i]:null);let mf=m.filter(v=>v!==null);let si=calculateEMA(mf,sig);let sl=new Array(m.length).fill(null);let siIdx=0;for(let i=0;i<m.length;i++)if(m[i]!==null&&siIdx<si.length)sl[i]=si[siIdx++];return{m,s:sl}};
const calculateStochRSI=(r,p=14,k=3,d=3)=>{let s=new Array(r.length).fill(null);for(let i=p-1;i<r.length;i++){let w=r.slice(i-p+1,i+1).filter(v=>v!==null);if(w.length<p)continue;let min=Math.min(...w),max=Math.max(...w);if(max-min===0)s[i]=100;else s[i]=((r[i]-min)/(max-min))*100}let kv=calculateSMA(s.filter(v=>v!==null),k);let kl=new Array(s.length).fill(null);let ki=0;for(let i=0;i<s.length;i++)if(s[i]!==null&&ki<kv.length)kl[i]=kv[ki++];let dv=calculateSMA(kl.filter(v=>v!==null),d);let dl=new Array(kl.length).fill(null);let di=0;for(let i=0;i<kl.length;i++)if(kl[i]!==null&&di<dv.length)dl[i]=dv[di++];return{k:kl,d:dl}};

async function run() {
  const raw = JSON.parse(fs.readFileSync(fileName));
  const { k1m, k5m, k1h, k1d } = raw;
  const i5m = {s:calculateStochRSI(calculateRSI(k5m.map(k=>k.close)))};
  const i1h = {m:calculateMACD(k1h.map(k=>k.close)),s:calculateStochRSI(calculateRSI(k1h.map(k=>k.close)))};
  const i1d = {m:calculateMACD(k1d.map(k=>k.close))};

  let balance = 10000, pos = null, m5Idx = 0, currentGSignal = 'HOLD', pendingOrder = null;
  const LEV = 5, TP_NET = 0.030, FIXED_SL = 0.15, retraceP_pct = 1.5, waitM = 180;
  const MAKER_FEE_RATE = 0.0002;
  const FEE_MARGIN = (MAKER_FEE_RATE + MAKER_FEE_RATE) * LEV;
  let trades = [];

  const startDate = new Date('2025-01-01').getTime();
  const endDate = new Date('2025-03-01').getTime();

  for(let i=0; i<k1m.length; i++){
    const k = k1m[i];
    if(k.time < startDate) continue;
    if(k.time > endDate) break;

    while(m5Idx < k5m.length && k5m[m5Idx].time <= k.time - 300000) m5Idx++;
    let r5 = m5Idx-1, r1h = -1, r1d = -1;
    for(let j=k1h.length-1; j>=0; j--) if(k1h[j].time <= k.time - 3600000){ r1h=j; break; }
    for(let j=k1d.length-1; j>=0; j--) if(k1d[j].time <= k.time - 86400000){ r1d=j; break; }
    if(r5<0||r1h<0||r1d<0) continue;

    const k5=i5m.s.k[r5], d5=i5m.s.d[r5], m1h=i1h.m.m[r1h], s1h=i1h.m.s[r1h], kh=i1h.s.k[r1h], dh=i1h.s.d[r1h], m1d=i1d.m.m[r1d], s1d=i1d.m.s[r1d];
    const c5 = k5>d5?'LONG':(k5<d5?'SHORT':'HOLD');
    const ch = (m1h>s1h&&kh>dh)?'LONG':((m1h<s1h&&kh<dh)?'SHORT':'HOLD');
    const cd = m1d>s1d?'LONG':(m1d<s1d?'SHORT':'HOLD');
    let gSig = (c5=='LONG'&&ch=='LONG'&&cd=='LONG')?'LONG':((c5=='SHORT'&&ch=='SHORT'&&cd=='SHORT')?'SHORT':'HOLD');

    if(pendingOrder && !pos) {
      const waitTimeMins = Math.floor((k.time - pendingOrder.signalTime) / 60000);
      if(pendingOrder.side === 'LONG' && k.low <= pendingOrder.limitPrice) {
        const entry = Math.min(k.open, pendingOrder.limitPrice);
        pos = {
          side:'LONG', entryPrice: entry, signalPrice: pendingOrder.signalPrice, signalTime: pendingOrder.signalTime,
          tp: entry*(1+(TP_NET+FEE_MARGIN)/LEV), sl: entry*(1-FIXED_SL/LEV), entryTime: k.time,
          margin: balance, qty: (balance * LEV) / entry, waitTime: waitTimeMins
        };
        pendingOrder = null;
      } else if(pendingOrder.side === 'SHORT' && k.high >= pendingOrder.limitPrice) {
        const entry = Math.max(k.open, pendingOrder.limitPrice);
        pos = { 
          side:'SHORT', entryPrice: entry, signalPrice: pendingOrder.signalPrice, signalTime: pendingOrder.signalTime,
          tp: entry*(1-(TP_NET+FEE_MARGIN)/LEV), sl: entry*(1+FIXED_SL/LEV), entryTime: k.time,
          margin: balance, qty: (balance * LEV) / entry, waitTime: waitTimeMins
        };
        pendingOrder = null;
      } else if(waitTimeMins >= waitM) {
        pendingOrder = null; 
      }
    }

    if(!pos && !pendingOrder && gSig !== 'HOLD' && gSig !== currentGSignal) {
      const limit = gSig==='LONG' ? k.open * (1 - retraceP_pct/100) : k.open * (1 + retraceP_pct/100);
      pendingOrder = { side: gSig, limitPrice: limit, signalPrice: k.open, signalTime: k.time };
    }
    currentGSignal = gSig;

    if(pos) {
      if(pos.side==='LONG'){
        if(k.high>=pos.tp){
          const profit = balance*TP_NET; balance+=profit; 
          trades.push({
            sigTime: new Date(pos.signalTime).toLocaleString(), entryTime: new Date(pos.entryTime).toLocaleString(), exitTime: new Date(k.time).toLocaleString(),
            side: pos.side, sigPrice: pos.sigPrice, targetEntry: pos.entryPrice, tp: pos.tp, sl: pos.sl,
            qty: pos.qty, totalValue: pos.qty * pos.entryPrice, margin: pos.margin, fee: (pos.qty * pos.entryPrice * MAKER_FEE_RATE * 2),
            pnl: profit, result:'TP', waitM: pos.waitTime, balance
          });
          pos=null;
        } else if(k.low<=pos.sl){
          const profit = balance*(-FIXED_SL-0.0035); balance+=profit;
          trades.push({
            sigTime: new Date(pos.signalTime).toLocaleString(), entryTime: new Date(pos.entryTime).toLocaleString(), exitTime: new Date(k.time).toLocaleString(),
            side: pos.side, sigPrice: pos.sigPrice, targetEntry: pos.entryPrice, tp: pos.tp, sl: pos.sl,
            qty: pos.qty, totalValue: pos.qty * pos.entryPrice, margin: pos.margin, fee: (pos.qty * pos.entryPrice * MAKER_FEE_RATE * 2),
            pnl: profit, result:'SL', waitM: pos.waitTime, balance
          });
          pos=null;
        }
      } else {
        if(k.low<=pos.tp){
          const profit = balance*TP_NET; balance+=profit;
          trades.push({
            sigTime: new Date(pos.signalTime).toLocaleString(), entryTime: new Date(pos.entryTime).toLocaleString(), exitTime: new Date(k.time).toLocaleString(),
            side: pos.side, sigPrice: pos.sigPrice, targetEntry: pos.entryPrice, tp: pos.tp, sl: pos.sl,
            qty: pos.qty, totalValue: pos.qty * pos.entryPrice, margin: pos.margin, fee: (pos.qty * pos.entryPrice * MAKER_FEE_RATE * 2),
            pnl: profit, result:'TP', waitM: pos.waitTime, balance
          });
          pos=null;
        } else if(k.high>=pos.sl){
          const profit = balance*(-FIXED_SL-0.0035); balance+=profit;
          trades.push({
            sigTime: new Date(pos.signalTime).toLocaleString(), entryTime: new Date(pos.entryTime).toLocaleString(), exitTime: new Date(k.time).toLocaleString(),
            side: pos.side, sigPrice: pos.sigPrice, targetEntry: pos.entryPrice, tp: pos.tp, sl: pos.sl,
            qty: pos.qty, totalValue: pos.qty * pos.entryPrice, margin: pos.margin, fee: (pos.qty * pos.entryPrice * MAKER_FEE_RATE * 2),
            pnl: profit, result:'SL', waitM: pos.waitTime, balance
          });
          pos=null;
        }
      }
    }
  }

  const columns = [
    "신호 일시(KST)", "진입 일시(KST)", "청산 일시(KST)", "포지션", "신호가(Signal)", "진입 희망가(1.5%)", "실제 체결가(Fill)", "익절가(TP)", "손절가(SL)", 
    "수량(Qty)", "총 포지션 금액(Value)", "증거금(Margin)", "수수료(Total Fees)", "순수익(Net PnL)", "청산유형", "대기 시간(분)", "최종 잔고($)"
  ];
  const out = fs.createWriteStream(resFile);
  out.write('\ufeff' + columns.join(",") + "\n");
  trades.forEach(t => {
    out.write(`${t.sigTime},${t.entryTime},${t.exitTime},${t.side},${parseFloat(t.sigPrice).toFixed(2)},${parseFloat(t.targetEntry).toFixed(2)},${parseFloat(t.targetEntry).toFixed(2)},${parseFloat(t.tp).toFixed(2)},${parseFloat(t.sl).toFixed(2)},${t.qty.toFixed(6)},${t.totalValue.toFixed(2)},${t.margin.toFixed(2)},${t.fee.toFixed(4)},${t.pnl.toFixed(4)},${t.result},${t.waitM},${t.balance.toFixed(2)}\n`);
  });
  out.end();
  console.log(`✅ Ultimate Trade Ledger Created: ${resFile}`);
}
run();
