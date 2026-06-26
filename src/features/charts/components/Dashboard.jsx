import React, { useState, useRef } from 'react';
import { useBinanceWebSocket } from '../../../shared/hooks/useBinanceWebSocket';
import PriceChart from './PriceChart';
import SignalSettings from './SignalSettings';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart2 } from 'lucide-react';
import './Dashboard.css';
import { sendTelegramMessage, getBotInfo } from '../../../shared/utils/telegramUtils';

const StatCard = ({ title, value, change, icon: Icon, color }) => (
  <div className="stat-card">
    <div className="stat-card-header">
      <span className="stat-card-title">{title}</span>
      <Icon size={18} color={color || '#f3ba2f'} />
    </div>
    <div className="stat-card-value">{value}</div>
    {change && (
      <div className={`stat-card-change ${parseFloat(change) >= 0 ? 'up' : 'down'}`}>
        {parseFloat(change) >= 0 ? '+' : ''}{change}%
      </div>
    )}
  </div>
);

const DEFAULT_RULES = {
  long: {
    '5m': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: false, stochCrossEnabled: true, adxEnabled: true, adxLow: 30, adxHigh: 99, stochKLimitEnabled: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, rsiEnabled: false, rsiLow: 5, rsiHigh: 95, useStochExtremeBypass: true, useMaSlope: true, useMaRoc: false },
    '1h': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: true, stochCrossEnabled: true, adxEnabled: false, adxLow: 30, adxHigh: 99, stochKLimitEnabled: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, rsiEnabled: false, rsiLow: 5, rsiHigh: 95, useMaSizeFilter: true },
    '1d': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: true, stochCrossEnabled: false, adxEnabled: false, adxLow: 15, adxHigh: 99, stochKLimitEnabled: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, rsiEnabled: false, rsiLow: 5, rsiHigh: 95 }
  },
  short: {
    '5m': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: false, stochCrossEnabled: true, adxEnabled: true, adxLow: 30, adxHigh: 99, stochKLimitEnabled: true, stochKThreshold: 99, stochKLow: 0, stochKHigh: 99, rsiEnabled: false, rsiLow: 5, rsiHigh: 95, useStochExtremeBypass: true, useMaSlope: true, useMaRoc: false },
    '1h': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: true, stochCrossEnabled: true, adxEnabled: false, adxLow: 30, adxHigh: 99, stochKLimitEnabled: false, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, rsiEnabled: false, rsiLow: 5, rsiHigh: 95, useMaSizeFilter: true },
    '1d': { macdValueEnabled: false, macdValue: 0, macdCrossEnabled: true, stochCrossEnabled: false, adxEnabled: false, adxLow: 15, adxHigh: 99, stochKLimitEnabled: true, stochKThreshold: 98, stochKLow: 0, stochKHigh: 98, rsiEnabled: false, rsiLow: 5, rsiHigh: 95 }
  },
  global: {
    entryWaitMin: 180,
    exitWaitMin: 1500,
    leverage: 5,
    targetRoi: 0.05,
    slRoi: 0.14,
    reduceTpWaitMin: 0,
    reducedTargetRoi: 0.03,
    orderAmount: 10000,
    switchingEnabled: true
  }
};


const Dashboard = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [limit, setLimit] = useState(200);
  const [inspectTime, setInspectTime] = useState(null);
  const [isPastMode, setIsPastMode] = useState(false);
  const [pastDateInput, setPastDateInput] = useState('');
  const [telegramToken, setTelegramToken] = useState(() => localStorage.getItem('telegram_token') || '');
  const [telegramChatId, setTelegramChatId] = useState(() => localStorage.getItem('telegram_chat_id') || '');
  const [botName, setBotName] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);
  const prevSignalRef = useRef(null);

  const isValidRules = (r) => {
    if (!r || !r.long || !r.short || !r.global) return false;
    const requiredGlobalKeys = ['entryWaitMin', 'exitWaitMin', 'leverage', 'targetRoi', 'slRoi', 'reduceTpWaitMin', 'reducedTargetRoi', 'orderAmount'];
    for (const key of requiredGlobalKeys) {
      const val = r.global[key];
      if (val === undefined || val === null || isNaN(val) || val === '') {
        return false;
      }
    }
    return true;
  };

  const [rules, setRules] = useState(() => {
    const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_RULES));
    let saved = localStorage.getItem('trading_rules_v24');
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (isValidRules(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('[DASHBOARD] Parse error for saved rules:', e);
      }
    }

    const oldSaved = localStorage.getItem('trading_rules_v23') || localStorage.getItem('trading_rules_v22') || localStorage.getItem('trading_rules_v21') || localStorage.getItem('trading_rules_v20') || localStorage.getItem('trading_rules_v19');
    if (oldSaved) {
      try {
        const parsedOld = JSON.parse(oldSaved);
        if (isValidRules(parsedOld)) {
          return parsedOld;
        }
      } catch (e) {
        console.error('[DASHBOARD] Parse error for old rules:', e);
      }
    }

    return defaultCopy;
  });

  const [isTesting, setIsTesting] = useState(false);

  React.useEffect(() => {
    if (isValidRules(rules)) {
      localStorage.setItem('trading_rules_v24', JSON.stringify(rules));
    }
  }, [rules]);

  React.useEffect(() => {
    localStorage.setItem('telegram_token', telegramToken);
  }, [telegramToken]);

  React.useEffect(() => {
    localStorage.setItem('telegram_chat_id', telegramChatId);
  }, [telegramChatId]);

  // URL Parameters Handling
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const timeParam = params.get('inspectTime');
    const symbolParam = params.get('symbol');

    if (symbolParam) setSymbol(symbolParam);
    if (timeParam) {
      const t = parseInt(timeParam);
      // URL 파라미터는 ms 단위일 수 있으므로 초 단위로 변환 지원
      const secTime = t > 10 ** 11 ? Math.floor(t / 1000) : t;
      setInspectTime(secTime);
      setIsPastMode(true);

      // 입력창에도 시간 표시
      const date = new Date(secTime * 1000);
      const offset = date.getTimezoneOffset() * 60000;
      const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 19);
      setPastDateInput(localISOTime);
    }
  }, []);

  React.useEffect(() => {
    if (!isPastMode) {
      setInspectTime(null);
      // URL 파라미터 제거
      const url = new URL(window.location);
      url.searchParams.delete('inspectTime');
      window.history.replaceState({}, '', url);
    }
  }, [isPastMode]);

  const [signals, setSignals] = useState({});
  const [indicatorData, setIndicatorData] = useState({ '5m': {}, '1h': {}, '1d': {} });
  const [history1h, setHistory1h] = useState([]);

  // Fetch 1h history for 3h and 24h high/low calculation
  React.useEffect(() => {
    const fetch1hHistory = async () => {
      try {
        const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=25`);
        const data = await response.json();
        const formatted = data.map(d => ({
          high: parseFloat(d[2]),
          low: parseFloat(d[3])
        }));
        setHistory1h(formatted);
      } catch (err) {
        console.error('Failed to fetch 1h history:', err);
      }
    };
    fetch1hHistory();
  }, [symbol]);

  const globalSignal = (signals?.['5m'] === 'long' && signals?.['1h'] === 'long' && signals?.['1d'] === 'long') ? 'LONG' :
    (signals?.['5m'] === 'short' && signals?.['1h'] === 'short' && signals?.['1d'] === 'short') ? 'SHORT' : 'HOLDING';

  React.useEffect(() => {
    if (isPastMode) return; // No alerts in past mode
    if (!telegramToken || !telegramChatId) return;

    if (prevSignalRef.current !== globalSignal) {
      if (globalSignal === 'LONG' || globalSignal === 'SHORT') {
        const kstTime = new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        }).replace(/\. /g, '-').replace('.', '');
        
        // [DYNAMIC] Calculate TP/SL for Dashboard Alert using UI Leverage
        const lev = rules?.global?.leverage || 5;
        const entryPrice = globalSignal === 'LONG' ? (candle5m?.low || 0) : (candle5m?.high || 0);
        const tpPrice = globalSignal === 'LONG' ? (entryPrice * (1 + 0.03 / lev)) : (entryPrice * (1 - 0.03 / lev));
        const slPrice = globalSignal === 'LONG' ? (entryPrice * (1 - 0.15 / lev)) : (entryPrice * (1 + 0.15 / lev));

        const message = `🚨 <b>[v7.0.3 UI] ${symbol} ${globalSignal} Signal!</b>\n\n` +
          `• Time (KST): ${kstTime}\n` +
          `• Price: $${(candle5m?.close || 0).toLocaleString()}\n` +
          `• Entry : $${entryPrice.toLocaleString()}\n` +
          `• TP(3%) : $${tpPrice.toLocaleString()}\n` +
          `• SL(15%) : $${slPrice.toLocaleString()}\n\n` +
          `📡 <b>Leverage ${lev}x Applied from UI</b>`;
        sendTelegramMessage(telegramToken, telegramChatId, message);
      }
      prevSignalRef.current = globalSignal;
    }
  }, [globalSignal, isPastMode, telegramToken, telegramChatId, symbol, signals]);

  const updateRule = (interval, direction, field, value) => {
    if (interval === 'global') {
        setRules(prev => ({ ...prev, global: { ...prev.global, [field]: value } }));
    } else {
        if (direction === 'long' || direction === 'short') {
            setRules(prev => ({
                ...prev,
                [direction]: {
                    ...prev[direction],
                    [interval]: {
                        ...prev[direction][interval],
                        [field]: value
                    }
                }
            }));
        } else {
            // fallback (롱/숏 둘 다 동일하게 업데이트)
            setRules(prev => ({
                ...prev,
                long: {
                    ...prev.long,
                    [interval]: { ...prev.long[interval], [field]: value }
                },
                short: {
                    ...prev.short,
                    [interval]: { ...prev.short[interval], [field]: value }
                }
            }));
        }
    }
  };

  const res5m = useBinanceWebSocket(symbol, '5m');
  const res1h = useBinanceWebSocket(symbol, '1h');
  const res1d = useBinanceWebSocket(symbol, '1d');

  const handleSignalUpdate = React.useCallback((iv, state) => {
    setSignals(prev => {
      if (prev?.[iv] === state) return prev;
      return { ...prev, [iv]: state };
    });
  }, []);

  const handleIndicatorUpdate = (iv, data) => {
    setIndicatorData(prev => ({
      ...prev,
      [iv]: { ...prev?.[iv], ...data }
    }));
  };

  const [prevSymbol, setPrevSymbol] = useState(symbol);

  // Immediate reset on symbol change (during render)
  if (prevSymbol !== symbol) {
    setHistory1h([]);
    setPrevSymbol(symbol);
  }

  // Formatting Helper for Prices (Adaptive Precision)
  const formatPrice = (val) => {
    if (val === '-' || val === null || val === undefined) return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    // Use 4 decimals for prices < 10 (covering XRP/SOL even if they fluctuate)
    if (num < 10) return num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (num < 100) return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Math.round(num).toLocaleString();
  };

  // Helper to get non-stale candle
  const getValidCandle = (res) => {
    if (res.lastCandle && res.lastCandle.symbol === symbol) {
      return res.lastCandle;
    }
    return null;
  };

  const candle5m = getValidCandle(res5m);
  const candle1h = getValidCandle(res1h);
  const candle1d = getValidCandle(res1d);

  // Price Calculations
  const currentPrice = candle5m ? formatPrice(candle5m.close) : 'Loading...';

  // 1d (24h Rolling) High/Low using 24 hourly candles
  const recent24h = candle1h ? [...history1h.slice(-24, -1), candle1h] : history1h.slice(-24);
  const high1d = recent24h.length > 0 ? formatPrice(Math.max(...recent24h.map(c => c.high))) : '-';
  const low1d = recent24h.length > 0 ? formatPrice(Math.min(...recent24h.map(c => c.low))) : '-';

  // 3h High/Low (Last 3 hours including current)
  const recent3h = candle1h ? [...history1h.slice(-3, -1), candle1h] : history1h.slice(-3);
  const high3h = recent3h.length > 0 ? formatPrice(Math.max(...recent3h.map(c => c.high))) : '-';
  const low3h = recent3h.length > 0 ? formatPrice(Math.min(...recent3h.map(c => c.low))) : '-';

  // 1h High/Low (Current Hourly Candle)
  const high1h = candle1h ? formatPrice(candle1h.high) : '-';
  const low1h = candle1h ? formatPrice(candle1h.low) : '-';

  const volume5m = candle5m ? Math.round(candle5m.volume).toLocaleString() : '-';

  // Global Signal Logic (Single Column)
  const isAllLong = signals?.['5m'] === 'long' && signals?.['1h'] === 'long' && signals?.['1d'] === 'long';
  const isAllShort = signals?.['5m'] === 'short' && signals?.['1h'] === 'short' && signals?.['1d'] === 'short';
  const status = isAllLong ? 'LONG' : (isAllShort ? 'SHORT' : 'HOLDING');

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo-section">
          <Activity color="#f3ba2f" size={32} />
          <h1>Antigravity Markets <span style={{ fontSize: '14px', verticalAlign: 'middle', background: '#f3ba2f', color: '#161a1e', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px' }}>v7.0.0.2 Global Official</span></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="connection-status" style={{ cursor: 'pointer', userSelect: 'none', border: isPastMode ? '1px solid #f3ba2f' : '1px solid transparent' }} onClick={() => setIsPastMode(!isPastMode)}>
            <div className={`status-dot ${!isPastMode && res5m.isConnected ? 'online' : 'offline'}`} style={{ backgroundColor: isPastMode ? '#f3ba2f' : undefined }}></div>
            {isPastMode ? 'PAST MODE' : (res5m.isConnected ? 'LIVE' : 'RECONNECTING...')}
          </div>

          {isPastMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: '#f3ba2f', fontWeight: 'bold' }}>Target Past Date:</span>
              <input
                type="datetime-local"
                step="1"
                value={pastDateInput}
                onChange={(e) => setPastDateInput(e.target.value)}
                style={{ background: '#1e2329', border: '1px solid #f3ba2f', color: '#d1d4dc', padding: '6px 10px', borderRadius: '4px', outline: 'none', colorScheme: 'dark' }}
              />
              <button
                onClick={() => {
                  if (pastDateInput) {
                    const sec = Math.floor(new Date(pastDateInput).getTime() / 1000);
                    setInspectTime(sec);

                    // URL 업데이트 (공유 가능하게)
                    const url = new URL(window.location);
                    url.searchParams.set('inspectTime', (sec * 1000).toString());
                    window.history.replaceState({}, '', url);
                  } else {
                    setInspectTime(null);
                  }
                }}
                style={{ background: '#f3ba2f', color: '#161a1e', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={e => e.target.style.backgroundColor = '#dcb030'}
                onMouseLeave={e => e.target.style.backgroundColor = '#f3ba2f'}
              >
                검색
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-controls" style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="symbol-selector" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '8px' }}>
            {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map(s => (
              <button
                key={s}
                className={`symbol-btn ${symbol === s ? 'active' : ''}`}
                onClick={() => setSymbol(s)}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                {s.replace('USDT', '')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#848e9c' }}>History:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{ background: '#1e2329', border: '1px solid #242a2e', color: '#d1d4dc', padding: '6px 10px', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            >
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={1500}>1,500</option>
            </select>
          </div>
        </div>
        <section className="stats-grid">
          <StatCard
            title="Price / Volume (5m)"
            value={`$${currentPrice} / ${volume5m}`}
            icon={DollarSign}
            color="#f3ba2f"
          />

          <StatCard
            title="v7.0.1 Target Entry (5m)"
            value={candle5m ? `$${formatPrice(candle5m.low)} (L) / $${formatPrice(candle5m.high)} (S)` : 'Loading...'}
            icon={BarChart2}
            color="#f3ba2f"
          />
        </section>

        {/* Global Signal Buttons (Back to Top) */}
        <div className="global-signal-header">
          <div className={`signal-btn long ${status === 'LONG' ? 'active' : ''}`}>LONG</div>
          <div className={`signal-btn holding ${status === 'HOLDING' ? 'active' : ''}`}>HOLDING</div>
          <div className={`signal-btn short ${status === 'SHORT' ? 'active' : ''}`}>SHORT</div>
        </div>

        {/* Backtest Verification Panel (Past Mode Info) */}
        {(isPastMode || inspectTime) && (
          <div className="verification-panel" style={{ background: '#1e2329', border: '2px solid #f3ba2f', borderRadius: '12px', padding: '16px', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #2b3139', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#f3ba2f', fontSize: '16px' }}>📊 Backtest Verification Data</h3>
              <span style={{ fontSize: '14px', color: '#d1d4dc', fontWeight: 'bold' }}>
                검증 시점(KST): {inspectTime ? new Date(inspectTime * 1000).toLocaleString('ko-KR', {
                  timeZone: 'Asia/Seoul',
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  hour12: false
                }).replace(/\. /g, '-').replace('.', '') : '입력 대기 중...'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              {['5m', '1h', '1d'].map(itv => (
                <div key={itv} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${signals[itv] === 'long' ? '#26a69a' : (signals[itv] === 'short' ? '#ef5350' : '#848e9c')}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: '#f3ba2f' }}>Timeframe: {itv}</span>
                    <span style={{ color: signals[itv] === 'long' ? '#26a69a' : (signals[itv] === 'short' ? '#ef5350' : '#848e9c'), fontWeight: 'bold' }}>
                      {signals[itv]?.toUpperCase() || 'HOLD'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#d1d4dc' }}>
                    <div>MACD: <span style={{ color: '#2962FF' }}>{(indicatorData[itv]?.m || 0).toFixed(2)}</span></div>
                    <div>Hist: <span style={{ color: (indicatorData[itv]?.h || 0) >= 0 ? '#26a69a' : '#ef5350' }}>{(indicatorData[itv]?.h || 0).toFixed(2)}</span></div>
                    <div>StochK: <span style={{ color: '#26a69a' }}>{(indicatorData[itv]?.k || 0).toFixed(1)}</span></div>
                    <div>StochD: <span style={{ color: '#ef5350' }}>{(indicatorData[itv]?.d || 0).toFixed(1)}</span></div>
                    <div style={{ gridColumn: 'span 2' }}>ADX: <span style={{ color: '#f3ba2f' }}>{(indicatorData[itv]?.adx || 0).toFixed(1)}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '15px', fontSize: '12px', color: '#848e9c', fontStyle: 'italic' }}>
              * 차트의 십자선을 움직이면 해당 시점의 데이터로 값이 실시간 업데이트됩니다.
            </div>
          </div>
        )}

        <section className="charts-container single-col">
          <div className="chart-section">
            <div className="chart-header">
              <h3>{symbol} Real-Time Chart (5m)</h3>
              <div className="indicator-tags">
                <span className="indicator-tag">Unified Signals</span>
              </div>
            </div>
            <PriceChart
              symbol={symbol} interval="5m" lastCandle={candle5m} limit={limit} 
              rules={rules}
              inspectTime={inspectTime}
              onSignalUpdate={(state) => handleSignalUpdate('5m', state)}
              onDataUpdate={(data) => handleIndicatorUpdate('5m', data)}
            />
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h3>{symbol} Real-Time Chart (1h)</h3>
            </div>
            <PriceChart
              symbol={symbol} interval="1h" lastCandle={candle1h} limit={limit} 
              rules={rules}
              inspectTime={inspectTime}
              onSignalUpdate={(state) => handleSignalUpdate('1h', state)}
              onDataUpdate={(data) => handleIndicatorUpdate('1h', data)}
            />
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h3>{symbol} Real-Time Chart (1d)</h3>
            </div>
            <PriceChart
              symbol={symbol} interval="1d" lastCandle={candle1d} limit={limit} 
              rules={rules}
              inspectTime={inspectTime}
              onSignalUpdate={(state) => handleSignalUpdate('1d', state)}
              onDataUpdate={(data) => handleIndicatorUpdate('1d', data)}
            />
          </div>
        </section>



        <SignalSettings
          rules={rules}
          updateRule={updateRule}
        />
      </main>

      <footer className="dashboard-footer">
        <p>&copy; 2026 Antigravity Markets. Real-time data via Binance Futures WebSocket API.</p>
      </footer>
    </div>
  );
};

export default Dashboard;
