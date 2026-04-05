import React from 'react';
import { Info, BellRing, Send } from 'lucide-react';

const SignalSettings = ({ 
  rules, 
  updateRule, 
  telegramToken, 
  setTelegramToken, 
  telegramChatId, 
  setTelegramChatId, 
  onTestTelegram,
  isTesting,
  botName,
  debugLogs
}) => {
  return (
    <section className="conditions-footer">
      <div className="footer-header">
        <Info size={20} color="#f3ba2f" />
        <h2>Interactive Signal Settings</h2>
      </div>
      
      <h3 style={{ fontSize: '1rem', color: '#d1d4dc', marginBottom: '15px', fontWeight: '600' }}>1. Individual Chart Border Conditions (Check to Enable)</h3>
      <div className="conditions-grid">
        <div className="condition-item long">
          <h4>LONG (GREEN BORDER)</h4>
          
          <div className="rule-group">
            <strong>5m:</strong>
            <label>
              <input type="checkbox" checked={rules['5m'].long.macdCrossEnabled} onChange={e => updateRule('5m', 'long', 'macdCrossEnabled', e.target.checked)} />
              MACD &gt; Signal
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['5m'].long.stochCrossEnabled} onChange={e => updateRule('5m', 'long', 'stochCrossEnabled', e.target.checked)} />
              Stoch D &lt; Stoch K
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['5m'].long.adxEnabled} onChange={e => updateRule('5m', 'long', 'adxEnabled', e.target.checked)} />
              ADX &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '60px' }} value={rules['5m'].long.adxThreshold || 30} onChange={e => updateRule('5m', 'long', 'adxThreshold', e.target.value)} />
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['5m'].long.macdValueEnabled} onChange={e => updateRule('5m', 'long', 'macdValueEnabled', e.target.checked)} />
              MACD &lt; 
            </label>
            <input type="number" className="rule-input" value={rules['5m'].long.macdValue} onChange={e => updateRule('5m', 'long', 'macdValue', e.target.value)} />
          </div>



          <div className="rule-group">
            <strong>1h:</strong>
            <label>
              <input type="checkbox" checked={rules['1h'].long.macdCrossEnabled} onChange={e => updateRule('1h', 'long', 'macdCrossEnabled', e.target.checked)} />
              MACD &gt; Signal
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1h'].long.stochCrossEnabled} onChange={e => updateRule('1h', 'long', 'stochCrossEnabled', e.target.checked)} />
              Stoch D &lt; Stoch K
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1h'].long.adxEnabled} onChange={e => updateRule('1h', 'long', 'adxEnabled', e.target.checked)} />
              ADX &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '60px' }} value={rules['1h'].long.adxThreshold || 30} onChange={e => updateRule('1h', 'long', 'adxThreshold', e.target.value)} />
          </div>


          <div className="rule-group">
            <strong>1d:</strong>
            <label>
              <input type="checkbox" checked={rules['1d'].long.macdCrossEnabled} onChange={e => updateRule('1d', 'long', 'macdCrossEnabled', e.target.checked)} />
              MACD &gt; Signal
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1d'].long.stochCrossEnabled} onChange={e => updateRule('1d', 'long', 'stochCrossEnabled', e.target.checked)} />
              Stoch D &lt; Stoch K
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1d'].long.adxEnabled} onChange={e => updateRule('1d', 'long', 'adxEnabled', e.target.checked)} />
              ADX &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '60px' }} value={rules['1d'].long.adxThreshold || 30} onChange={e => updateRule('1d', 'long', 'adxThreshold', e.target.value)} />
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1d'].long.macdHistEnabled} onChange={e => updateRule('1d', 'long', 'macdHistEnabled', e.target.checked)} />
              |MACD-Sig| &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '90px' }} value={rules['1d'].long.macdHistValue} onChange={e => updateRule('1d', 'long', 'macdHistValue', e.target.value)} />
          </div>



        </div>

        <div className="condition-item short">
          <h4>SHORT (RED BORDER)</h4>
          
          <div className="rule-group">
            <strong>5m:</strong>
            <label>
              <input type="checkbox" checked={rules['5m'].short.macdCrossEnabled} onChange={e => updateRule('5m', 'short', 'macdCrossEnabled', e.target.checked)} />
              MACD &lt; Signal
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['5m'].short.stochCrossEnabled} onChange={e => updateRule('5m', 'short', 'stochCrossEnabled', e.target.checked)} />
              Stoch D &gt; Stoch K
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['5m'].short.adxEnabled} onChange={e => updateRule('5m', 'short', 'adxEnabled', e.target.checked)} />
              ADX &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '60px' }} value={rules['5m'].short.adxThreshold || 30} onChange={e => updateRule('5m', 'short', 'adxThreshold', e.target.value)} />
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['5m'].short.macdValueEnabled} onChange={e => updateRule('5m', 'short', 'macdValueEnabled', e.target.checked)} />
              MACD &gt; 
            </label>
            <input type="number" className="rule-input" value={rules['5m'].short.macdValue} onChange={e => updateRule('5m', 'short', 'macdValue', e.target.value)} />
          </div>



          <div className="rule-group">
            <strong>1h:</strong>
            <label>
              <input type="checkbox" checked={rules['1h'].short.macdCrossEnabled} onChange={e => updateRule('1h', 'short', 'macdCrossEnabled', e.target.checked)} />
              MACD &lt; Signal
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1h'].short.stochCrossEnabled} onChange={e => updateRule('1h', 'short', 'stochCrossEnabled', e.target.checked)} />
              Stoch D &gt; Stoch K
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1h'].short.adxEnabled} onChange={e => updateRule('1h', 'short', 'adxEnabled', e.target.checked)} />
              ADX &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '60px' }} value={rules['1h'].short.adxThreshold || 30} onChange={e => updateRule('1h', 'short', 'adxThreshold', e.target.value)} />
          </div>


          <div className="rule-group">
            <strong>1d:</strong>
            <label>
              <input type="checkbox" checked={rules['1d'].short.macdCrossEnabled} onChange={e => updateRule('1d', 'short', 'macdCrossEnabled', e.target.checked)} />
              MACD &lt; Signal
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1d'].short.stochCrossEnabled} onChange={e => updateRule('1d', 'short', 'stochCrossEnabled', e.target.checked)} />
              Stoch D &gt; Stoch K
            </label>
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1d'].short.adxEnabled} onChange={e => updateRule('1d', 'short', 'adxEnabled', e.target.checked)} />
              ADX &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '60px' }} value={rules['1d'].short.adxThreshold || 30} onChange={e => updateRule('1d', 'short', 'adxThreshold', e.target.value)} />
            <span className="and-text">AND</span>
            <label>
              <input type="checkbox" checked={rules['1d'].short.macdHistEnabled} onChange={e => updateRule('1d', 'short', 'macdHistEnabled', e.target.checked)} />
              |MACD-Sig| &gt;
            </label>
            <input type="number" className="rule-input" style={{ width: '90px' }} value={rules['1d'].short.macdHistValue} onChange={e => updateRule('1d', 'short', 'macdHistValue', e.target.value)} />
          </div>



        </div>

        <div className="condition-item hold">
          <h4>HOLDING (ORANGE BORDER)</h4>
          <p style={{ color: '#848e9c', fontSize: '0.85rem', lineHeight: '1.5' }}>
            Occurs when the selected conditions above are not fully met (or if all active conditions evaluate to false).
          </p>
        </div>
      </div>

      <div style={{ margin: '30px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}></div>

      <h3 style={{ fontSize: '1rem', color: '#d1d4dc', marginBottom: '15px', fontWeight: '600' }}>2. Global Strategy Conditions (Combined)</h3>
      <div className="condition-item" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px', width: '100%' }}>
        <p style={{ color: '#848e9c', fontSize: '0.85rem', lineHeight: '1.6' }}>
          차트 상단의 <strong>전역 신호(Global Signal)</strong>는 아래 세 가지 타임프레임의 신호가 모두 일치할 때만 발생합니다:
        </p>
        <ul style={{ color: '#f3ba2f', fontSize: '0.9rem', fontWeight: '700', marginTop: '10px', listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '5px' }}>✅ <strong>LONG</strong> = (5m LONG) AND (1h LONG) AND (1d LONG)</li>
          <li>✅ <strong>SHORT</strong> = (5m SHORT) AND (1h SHORT) AND (1d SHORT)</li>
        </ul>
        <p style={{ color: '#848e9c', fontSize: '0.85rem', marginTop: '10px' }}>
          그 외의 모든 상황(데이터 부족 포함)은 <strong>HOLDING</strong>으로 표시됩니다.
        </p>
      </div>

      <div style={{ margin: '30px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}></div>

      <div className="footer-header">
        <BellRing size={20} color="#f3ba2f" />
        <h2>3. Notification Settings (Telegram)</h2>
      </div>
      
      <div className="conditions-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="condition-item" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', color: '#848e9c', fontSize: '0.85rem', marginBottom: '8px' }}>Telegram Bot Token</label>
            <input 
              type="password" 
              className="rule-input" 
              style={{ width: '100%', padding: '10px' }} 
              placeholder="Enter your bot token from @BotFather"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
            {botName && (
              <div style={{ 
                fontSize: '0.75rem', 
                marginTop: '5px', 
                color: botName.includes('Invalid') ? '#ef5350' : '#26a69a',
                fontWeight: '600'
              }}>
                {botName.includes('Invalid') ? '❌ ' : '🤖 '} {botName}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', color: '#848e9c', fontSize: '0.85rem', marginBottom: '8px' }}>Telegram Chat ID</label>
            <input 
              type="text" 
              className="rule-input" 
              style={{ width: '100%', padding: '10px' }} 
              placeholder="Enter your chat ID from @userinfobot"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
          </div>
          <button 
            className="test-button"
            onClick={onTestTelegram}
            disabled={isTesting}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: isTesting ? '#474d57' : '#f3ba2f', 
              color: '#161a1e', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: '6px', 
              fontWeight: '600', 
              cursor: isTesting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Send size={16} className={isTesting ? 'animate-pulse' : ''} />
            {isTesting ? 'Sending...' : 'Send Test Message'}
          </button>

          {debugLogs && debugLogs.length > 0 && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#0b0e11', border: '1px solid #ef5350', borderRadius: '8px' }}>
              <h5 style={{ color: '#ef5350', margin: '0 0 10px 0', fontSize: '0.9rem' }}>🔍 Debug Analysis</h5>
              {debugLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: '10px', fontSize: '0.85rem', color: '#d1d4dc', whiteSpace: 'pre-wrap' }}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="condition-item" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px' }}>
          <h4 style={{ color: '#d1d4dc', marginBottom: '10px' }}>How to setup Telegram:</h4>
          <ol style={{ color: '#848e9c', fontSize: '0.85rem', marginLeft: '1.2rem', paddingLeft: '0' }}>
            <li style={{ marginBottom: '8px' }}>Search for <strong>@BotFather</strong> on Telegram and send <code>/newbot</code> command to get your <strong>Token</strong>.</li>
            <li style={{ marginBottom: '8px' }}>Search for <strong>@userinfobot</strong> and send any message to get your <strong>Chat ID</strong>.</li>
            <li>Paste them here. All settings are stored locally on your device for privacy.</li>
          </ol>
        </div>
      </div>
    </section>
  );
};

export default SignalSettings;
