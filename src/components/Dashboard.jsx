import React, { useState, useRef } from 'react';
import { useBinanceWebSocket } from '../hooks/useBinanceWebSocket';
import PriceChart from './PriceChart';
import SignalSettings from './SignalSettings';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart2 } from 'lucide-react';
import './Dashboard.css';
import { sendTelegramMessage, getBotInfo } from '../utils/telegramUtils';

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
    long: { macdValueEnabled: false, macdValue: -10, macdCrossEnabled: false, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 10, macdCrossEnabled: false, stochCrossEnabled: true }
  },
  '1h': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true }
  },
  '1d': {
    long: { macdValueEnabled: false, macdValue: -100, macdCrossEnabled: true, stochCrossEnabled: true, macdHistEnabled: true, macdHistValue: 300 },
    short: { macdValueEnabled: false, macdValue: 100, macdCrossEnabled: true, stochCrossEnabled: true, macdHistEnabled: true, macdHistValue: 300 }
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
    const saved = localStorage.getItem('trading_rules_v5');
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  });

  const [isTesting, setIsTesting] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('trading_rules_v5', JSON.stringify(rules));
  }, [rules]);

  React.useEffect(() => {
    localStorage.setItem('telegram_token', telegramToken);
  }, [telegramToken]);

  React.useEffect(() => {
    localStorage.setItem('telegram_chat_id', telegramChatId);
  }, [telegramChatId]);

  React.useEffect(() => {
    if (!isPastMode) {
      setInspectTime(null);
    }
  }, [isPastMode]);
  
  const [signals, setSignals] = useState({});
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
        const message = `🚨 <b>[${symbol}] ${globalSignal} Signal!</b>\n\n` +
                        `• Time (KST): ${kstTime}\n` +
                        `• 5m: ${signals['5m']}\n` +
                        `• 1h: ${signals['1h']}\n` +
                        `• 1d: ${signals['1d']}\n\n` +
                        `Check dashboard for details.`;
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
          <h1>Antigravity Markets <span style={{ fontSize: '14px', verticalAlign: 'middle', background: '#f3ba2f', color: '#161a1e', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px' }}>v3.4.0 Official</span></h1>
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
                    setInspectTime(Math.floor(new Date(pastDateInput).getTime() / 1000));
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
            value={`${high3h !== '-' ? `$${high3h}` : '-'} / ${low3h !== '-' ? `$${low3h}` : '-'}`} 
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
            title="v3.4.0 Target Entry (5m)" 
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
            />
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h3>{symbol} Real-Time Chart (1h)</h3>
            </div>
            <PriceChart 
              symbol={symbol} interval="1h" lastCandle={candle1h} limit={72} rule={rules['1h']}
              inspectTime={inspectTime}
              onSignalUpdate={(state) => handleSignalUpdate('1h', state)}
            />
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h3>{symbol} Real-Time Chart (1d)</h3>
            </div>
            <PriceChart 
              symbol={symbol} interval="1d" lastCandle={candle1d} limit={60} rule={rules['1d']}
              inspectTime={inspectTime}
              onSignalUpdate={(state) => handleSignalUpdate('1d', state)}
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
