const axios = require('axios');

const calculateEMA=(d,p)=>{let e=new Array(d.length).fill(null);if(d.length<p)return e;let s=d.slice(0,p).reduce((a,b)=>a+b,0);e[p-1]=s/p;let k=2/(p+1);for(let i=p;i<d.length;i++)e[i]=(d[i]-e[i-1])*k+e[i-1];return e};
const calculateSMA=(d,p)=>{let s=new Array(d.length).fill(null);for(let i=p-1;i<d.length;i++){let sum=0;for(let j=0;j<p;j++)sum+=d[i-j];s[i]=sum/p}return s};
const calculateRSI=(c,p=14)=>{let r=new Array(c.length).fill(null);if(c.length<=p)return r;let g=0,l=0;for(let i=1;i<=p;i++){let d=c[i]-c[i-1];if(d>=0)g+=d;else l-=d}g/=p;l/=p;if(l===0)r[p]=100;else r[p]=100-100/(1+g/l);for(let i=p+1;i<c.length;i++){let d=c[i]-c[i-1];g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;if(l===0)r[i]=100;else r[i]=100-100/(1+g/l)}return r};
const calculateMACD=(c,f=12,s=26,sig=9)=>{let fe=calculateEMA(c,f),se=calculateEMA(c,s);let m=fe.map((v,i)=>(v!==null&&se[i]!==null)?v-se[i]:null);let mf=m.filter(v=>v!==null);let si=calculateEMA(mf,sig);let sl=new Array(m.length).fill(null);let siIdx=0;for(let i=0;i<m.length;i++)if(m[i]!==null&&siIdx<si.length)sl[i]=si[siIdx++];return{m,s:sl}};
const calculateStochRSI=(r,p=14,k=3,d=3)=>{let s=new Array(r.length).fill(null);for(let i=p-1;i<r.length;i++){let w=r.slice(i-p+1,i+1).filter(v=>v!==null);if(w.length<p)continue;let min=Math.min(...w),max=Math.max(...w);if(max-min===0)s[i]=100;else s[i]=((r[i]-min)/(max-min))*100}let kv=calculateSMA(s.filter(v=>v!==null),k);let kl=new Array(s.length).fill(null);let ki=0;for(let i=0;i<s.length;i++)if(s[i]!==null&&ki<kv.length)kl[i]=kv[ki++];let dv=calculateSMA(kl.filter(v=>v!==null),d);let dl=new Array(kl.length).fill(null);let di=0;for(let i=0;i<kl.length;i++)if(kl[i]!==null&&di<dv.length)dl[i]=dv[di++];return{k:kl,d:dl}};

async function checkRealtimeSignal(targetTimeKST) {
    const targetTS = new Date(targetTimeKST + '+09:00').getTime();
    const FETCH_START = targetTS - (86400000 * 300); // 300 days warm up

    async function fetch(interval) {
        let res = await axios.get('https://fapi.binance.com/fapi/v1/klines', { params: { symbol: 'BTCUSDT', interval, limit: 1500, endTime: targetTS } });
        return res.data.map(d => ({ time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
    }

    console.log(`Checking indicators for ${targetTimeKST}...`);
    const k5m = await fetch('5m');
    const k1h = await fetch('1h');
    const k1d = await fetch('1d');

    const i5m = calculateStochRSI(calculateRSI(k5m.map(k=>k.close)));
    const i1h = { m: calculateMACD(k1h.map(k=>k.close)), s: calculateStochRSI(calculateRSI(k1h.map(k=>k.close))) };
    const i1d = calculateMACD(k1d.map(k=>k.close));

    const r5 = k5m.length - 1, rh = k1h.length - 1, rd = k1d.length - 1;
    
    console.log(`[5m] K: ${i5m.k[r5].toFixed(2)} | D: ${i5m.d[r5].toFixed(2)} -> ${i5m.k[r5] < i5m.d[r5] ? 'SHORT ✅' : 'NOT SHORT ❌'}`);
    console.log(`[1h] MACD: ${i1h.m.m[rh].toFixed(2)} | Sig: ${i1h.m.s[rh].toFixed(2)} | K: ${i1h.s.k[rh].toFixed(2)} | D: ${i1h.s.d[rh].toFixed(2)} -> ${(i1h.m.m[rh] < i1h.m.s[rh] && i1h.s.k[rh] < i1h.s.d[rh]) ? 'SHORT ✅' : 'NOT SHORT ❌'}`);
    console.log(`[1d] MACD: ${i1d.m[rd].toFixed(2)} | Sig: ${i1d.s[rd].toFixed(2)} -> ${i1d.m[rd] < i1d.s[rd] ? 'SHORT ✅' : 'NOT SHORT ❌'}`);

    const isGlobalShort = (i5m.k[r5] < i5m.d[r5]) && (i1h.m.m[rh] < i1h.m.s[rh] && i1h.s.k[rh] < i1h.s.d[rh]) && (i1d.m[rd] < i1d.s[rd]);
    console.log(`\nFinal Result: ${isGlobalShort ? 'GLOBAL SHORT SIGNAL DETECTED' : 'NO GLOBAL SHORT SIGNAL'}`);
}

checkRealtimeSignal('2026-04-01 22:55:00');
