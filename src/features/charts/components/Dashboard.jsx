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
  '5m': {
    long: { macdValueEnabled: false, macdValue: -10, macdCrossEnabled: false, stochCrossEnabled: true, adxEnabled: true, adxThreshold: 30 },
    short: { macdValueEnabled: false, macdValue: 10, macdCrossEnabled: false, stochCrossEnabled: true, adxEnabled: true, adxThreshold: 30 }
  },
  '1h': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true, adxEnabled: true, adxThreshold: 30 },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true, adxEnabled: true, adxThreshold: 30 }
  },
  '1d': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: false, macdHistEnabled: false, macdHistValue: 0, adxEnabled: false, adxThreshold: 30 },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: false, macdHistEnabled: false, macdHistValue: 0, adxEnabled: false, adxThreshold: 30 }
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

  const [rules, setRules] = useState(() => {
    const saved = localStorage.getItem('trading_rules_v6');
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  });

  const [isTesting, setIsTesting] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('trading_rules_v6', JSON.stringify(rules));
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
      const secTime = t > 10**11 ? Math.floor(t / 1000) : t;
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

  const globalSignal = (signals['5m'] === 'long' && signals['1h'] === 'long' && signals['1d'] === 'long') ? 'LONG' :
                       (signals['5m'] === 'short' && signals['1h'] === 'short' && signals['1d'] === 'short') ? 'SHORT' : 'HOLDING';

  React.useEffect(() => {
    if (isPastMode) return; // No alerts in past mode
    if (!telegramToken || !telegramChatId) return;

    if (prevSignalRef.current !== globalSignal) {
      if (globalSignal === 'LONG' || globalSignal === 'SHORT') {
        const d_kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const kstTime = `${d_kst.getUTCFullYear()}-${String(d_kst.getUTCMonth()+1).padStart(2,'0')}-${String(d_kst.getUTCDate()).padStart(2,'0')} ${String(d_kst.getUTCHours()).padStart(2,'0')}:${String(d_kst.getUTCMinutes()).padStart(2,'0')}:${String(d_kst.getUTCSeconds()).padStart(2,'0')}`;
        const message = `🚨 <b>[v7.0.0] ${symbol} ${globalSignal} Signal!</b>\n\n` +
                        `• Time (KST): ${kstTime}\n` +
                        `• 5m: ${signals['5m']}\n` +
                        `• 1h: ${signals['1h']}\n` +
                        `• 1d: ${signals['1d']}\n\n` +
                        `📡 <b>High-Frequency Optimized</b>`;
        sendTelegramMessage(telegramToken, telegramChatId, message);
      }
      prevSignalRef.current = globalSignal;
    }
  }, [globalSignal, isPastMode, telegramToken, telegramChatId, symbol, signals]);

  const updateRule = (interval, direction, field, value) => {
    setRules(prev => ({ ...prev, [interval]: { ...prev[interval], [direction]: { ...prev[interval][direction], [field]: value } } }));
  };

  const res5m = useBinanceWebSocket(symbol, '5m');
  const res1h = useBinanceWebSocket(symbol, '1h');
  const res1d = useBinanceWebSocket(symbol, '1d');

  const handleSignalUpdate = React.useCallback((interval, state) => {
    setSignals(prev => {
      if (prev[interval] === state) return prev;
      return { ...prev, [interval]: state };
    });
  }, []);

  const handleIndicatorUpdate = (interval, data) => {
    setIndicatorData(prev => ({ ...prev, [interval]: data }));
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
  const isAllLong = signals['5m'] === 'long' && signals['1h'] === 'long' && signals['1d'] === 'long';
  const isAllShort = signals['5m'] === 'short' && signals['1h'] === 'short' && signals['1d'] === 'short';
  const status = isAllLong ? 'LONG' : (isAllShort ? 'SHORT' : 'HOLDING');

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo-section">
          <Activity color="#f3ba2f" size={32} />
          <h1>Antigravity Markets <span style={{ fontSize: '14px', verticalAlign: 'middle', background: '#f3ba2f', color: '#161a1e', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px' }}>v7.0.0 Global Official</span></h1>
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
            title="1h High / Low" 
            value={`${high1h !== '-' ? `$${high1h}` : '-'} / ${low1h !== '-' ? `$${low1h}` : '-'}`} 
            icon={TrendingUp} 
            color="#26a69a" 
          />
          <StatCard 
            title="3h High / Low" 
            value={`${high3h !== '-' ? `$${high3h}` : '-'} / ${low3h !== '-' ? `$${low1h}` : '-'}`} 
            icon={TrendingUp} 
            color="#26a69a" 
          />
          <StatCard 
            title="1d High / Low" 
            value={`${high1d !== '-' ? `$${high1d}` : '-'} / ${low1d !== '-' ? `$${low1d}` : '-'}`} 
            icon={TrendingUp} 
            color="#26a69a" 
          />
          <StatCard 
            title="v7.0.0 Target Entry (5m)" 
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
                검증 시점(KST): {inspectTime ? new Date(inspectTime * 1000 + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19) : '입력 대기 중...'}
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
              symbol={symbol} interval="5m" lastCandle={candle5m} limit={limit} rule={rules['5m']}
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
              symbol={symbol} interval="1h" lastCandle={candle1h} limit={limit} rule={rules['1h']}
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
              symbol={symbol} interval="1d" lastCandle={candle1d} limit={limit} rule={rules['1d']}
              inspectTime={inspectTime}
              onSignalUpdate={(state) => handleSignalUpdate('1d', state)}
              onDataUpdate={(data) => handleIndicatorUpdate('1d', data)}
            />
          </div>
        </section>

        <SignalSettings 
          rules={rules}
          updateRule={updateRule}
          telegramToken={telegramToken}
          setTelegramToken={setTelegramToken}
          telegramChatId={telegramChatId}
          setTelegramChatId={setTelegramChatId}
          botName={botName}
          isTesting={isTesting}
          debugLogs={debugLogs}
          onTestTelegram={async () => {
            console.log('Test button clicked');
            setDebugLogs([]); // Clear previous logs
            
            if (!telegramToken || !telegramChatId) {
              setDebugLogs(['⚠️ 오류: 토큰(Token) 또는 챗 아이디(Chat ID)가 비어있습니다.']);
              return;
            }
            
            setIsTesting(true);
            try {
              setDebugLogs(['⏳ 테스트 메시지 전송 시도 중...']);
              const res = await sendTelegramMessage(telegramToken, telegramChatId, '🔔 <b>Telegram Alert Test</b>\nConnection successful! Your dashboard is now linked to this chat.');
              
              if (res.success) {
                setDebugLogs(['✅ 전송 성공! 텔레그램 앱을 확인해 주세요.']);
              } else {
                let logs = [`❌ 전송 실패: ${res.error}`];
                
                // 원인 분석
                if (res.error.includes('chat not found')) {
                  logs.push('💡 [원인 분석] 입력하신 Chat ID를 찾을 수 없습니다.');
                  logs.push('👉 해결 방법 1: 텔레그램 앱에서 연동할 봇 방에 들어가 화면 하단의 [시작(Start)] 버튼을 눌렀는지 확인하세요.');
                  logs.push('👉 해결 방법 2: Chat ID 숫자가 본인의 고유 ID가 맞는지 확인하세요. (@userinfobot 등에서 확인 가능)');
                } else if (res.error.includes('Unauthorized') || res.code === 401) {
                  logs.push('💡 [원인 분석] 봇 토큰이 유효하지 않습니다.');
                  logs.push('👉 해결 방법: @BotFather가 발급해 준 토큰을 정확히(공백 없이) 붙여넣었는지 확인하세요.');
                }
                
                if (res.debugInfo) {
                  logs.push(`\n--- 전송 데이터 기초 확인 ---`);
                  logs.push(`• 토큰 유무: ${res.debugInfo.tokenGiven ? 'O' : 'X'}`);
                  logs.push(`• 발송 시도한 Chat ID: "${res.debugInfo.chatIdSent}"`);
                }
                
                setDebugLogs(logs);
              }
            } catch (err) {
              setDebugLogs([`❌ 시스템 오류: ${err.message}`]);
            } finally {
              setIsTesting(false);
            }
          }}
        />
      </main>

      <footer className="dashboard-footer">
        <p>&copy; 2026 Antigravity Markets. Real-time data via Binance Futures WebSocket API.</p>
      </footer>
    </div>
  );
};

export default Dashboard;
