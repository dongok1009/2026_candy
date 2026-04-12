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

  // Helper to bridge data structure differences
  const getRuleValue = (iv, side, field) => {
    return rules[iv] && rules[iv][side] ? rules[iv][side][field] : false;
  };

  const getRuleNum = (iv, side, field) => {
      const v = rules[iv] && rules[iv][side] ? rules[iv][side][field] : 0;
      return v || 0;
  };

  const renderIntervalRow = (side, iv) => {
    const isLong = side === 'long';
    const color = isLong ? '#26a69a' : '#ef5350';
    
    // Mapping internal field names
    const fields = {
        adx: 'adxEnabled',
        adxVal: 'adxThreshold',
        macdCross: 'macdCrossEnabled',
        stochCross: 'stochCrossEnabled',
        macdVal: 'macdValueEnabled',
        macdValNum: 'macdValue',
        macdSigDiff: 'macdHistEnabled',
        macdSigDiffNum: 'macdHistValue'
    };

    return (
      <div key={iv} className="interval-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <span style={{ color: '#f3ba2f', fontSize: '14px', fontWeight: 'bold', width: '35px' }}>{iv}:</span>
        
        {/* ADX */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input type="checkbox" checked={getRuleValue(iv, side, fields.adx)} onChange={e => updateRule(iv, side, fields.adx, e.target.checked)} />
          <span style={{ color: '#eaebed', fontSize: '12px' }}>ADX &gt;</span>
          <input type="number" 
            style={{ width: '50px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '2px 5px', borderRadius: '4px' }} 
            value={getRuleNum(iv, side, fields.adxVal)} 
            onChange={e => updateRule(iv, side, fields.adxVal, parseFloat(e.target.value))} 
          />
          <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 5px', fontSize: '11px' }}>AND</span>
        </div>

        {/* MACD Cross */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input type="checkbox" checked={getRuleValue(iv, side, fields.macdCross)} onChange={e => updateRule(iv, side, fields.macdCross, e.target.checked)} />
          <span style={{ color: '#eaebed', fontSize: '12px' }}>MACD {isLong ? '>' : '<'} Signal</span>
          <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 5px', fontSize: '11px' }}>AND</span>
        </div>

        {/* Stoch Cross */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input type="checkbox" checked={getRuleValue(iv, side, fields.stochCross)} onChange={e => updateRule(iv, side, fields.stochCross, e.target.checked)} />
          <span style={{ color: '#eaebed', fontSize: '12px' }}>Stoch D {isLong ? '<' : '>'} Stoch K</span>
          {(iv === '1d' || iv === '5m') && <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 5px', fontSize: '11px' }}>AND</span>}
        </div>

        {/* Extra: MACD Diff (1d) */}
        {iv === '1d' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="checkbox" checked={getRuleValue(iv, side, fields.macdSigDiff)} onChange={e => updateRule(iv, side, fields.macdSigDiff, e.target.checked)} />
            <span style={{ color: '#eaebed', fontSize: '12px' }}>|MACD-Sig| &gt;</span>
            <input type="number" 
                style={{ width: '60px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '2px 5px', borderRadius: '4px' }} 
                value={getRuleNum(iv, side, fields.macdSigDiffNum)} 
                onChange={e => updateRule(iv, side, fields.macdSigDiffNum, parseFloat(e.target.value))} 
            />
          </div>
        )}

        {/* Extra: MACD Val (5m) */}
        {iv === '5m' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="checkbox" checked={getRuleValue(iv, side, fields.macdVal)} onChange={e => updateRule(iv, side, fields.macdVal, e.target.checked)} />
            <span style={{ color: '#eaebed', fontSize: '12px' }}>MACD {isLong ? '<' : '>'}</span>
            <input type="number" 
                style={{ width: '60px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '2px 5px', borderRadius: '4px' }} 
                value={getRuleNum(iv, side, fields.macdValNum)} 
                onChange={e => updateRule(iv, side, fields.macdValNum, parseFloat(e.target.value))} 
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="conditions-footer" style={{ marginTop: '40px' }}>
      <div className="footer-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Info size={20} color="#f3ba2f" />
        <h2 style={{ margin: 0, fontSize: '18px', color: '#eaebed' }}>Interactive Signal Settings</h2>
      </div>
      
      <div style={{ background: '#161a1e', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139' }}>
        <h3 style={{ fontSize: '16px', color: '#eaebed', marginBottom: '25px', fontWeight: '800' }}>1. Individual Chart Border Conditions (Check to Enable)</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* LONG */}
            <div>
                <h4 style={{ color: '#26a69a', fontSize: '14px', fontWeight: '900', marginBottom: '20px', borderLeft: '4px solid #26a69a', paddingLeft: '10px' }}>LONG (GREEN BORDER)</h4>
                {['5m', '1h', '1d'].map(iv => renderIntervalRow('long', iv))}
            </div>

            {/* SHORT */}
            <div>
                <h4 style={{ color: '#ef5350', fontSize: '14px', fontWeight: '900', marginBottom: '20px', borderLeft: '4px solid #ef5350', paddingLeft: '10px' }}>SHORT (RED BORDER)</h4>
                {['5m', '1h', '1d'].map(iv => renderIntervalRow('short', iv))}
            </div>

            {/* HOLDING */}
            <div style={{ borderTop: '1px solid #2b3139', paddingTop: '20px' }}>
                <h4 style={{ color: '#f3ba2f', fontSize: '14px', fontWeight: '900', marginBottom: '10px' }}>HOLDING (ORANGE BORDER)</h4>
                <p style={{ color: '#848e9c', fontSize: '12px' }}>
                    Occurs when the selected conditions above are not fully met (or if all active conditions evaluate to false).
                </p>
            </div>
        </div>
      </div>

      <div style={{ margin: '40px 0', borderBottom: '1px solid #2b3139' }}></div>

      <div className="footer-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Info size={20} color="#f3ba2f" />
        <h2 style={{ margin: 0, fontSize: '18px', color: '#eaebed' }}>2. Entry & Exit Strategy (Order Execution)</h2>
      </div>

      <div style={{ background: '#161a1e', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '12px', marginBottom: '8px' }}>Entry Wait Limit (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '10px 15px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', null, 'entryWaitMin')} 
                        onChange={e => updateRule('global', null, 'entryWaitMin', parseInt(e.target.value))} 
                        style={{ width: '60px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 진입 실패 처리</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#ff4d4d', fontSize: '12px', marginBottom: '8px' }}>Exit Wait Limit (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '10px 15px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', null, 'exitWaitMin')} 
                        onChange={e => updateRule('global', null, 'exitWaitMin', parseInt(e.target.value))} 
                        style={{ width: '60px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 시장가 청산 강제</span>
                  </div>
              </div>
          </div>
      </div>

      <div style={{ margin: '40px 0', borderBottom: '1px solid #2b3139' }}></div>

      <div className="footer-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <BellRing size={20} color="#f3ba2f" />
        <h2 style={{ margin: 0, fontSize: '18px', color: '#eaebed' }}>3. Notification Settings (Telegram)</h2>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#161a1e', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#848e9c', fontSize: '12px', marginBottom: '8px' }}>Telegram Bot Token</label>
            <input 
              type="password" 
              style={{ width: '100%', padding: '12px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', borderRadius: '8px' }} 
              placeholder="Enter your bot token"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
            {botName && (
              <div style={{ fontSize: '11px', marginTop: '8px', color: botName.includes('Invalid') ? '#ef5350' : '#26a69a' }}>
                {botName.includes('Invalid') ? '❌ ' : '🤖 '} {botName}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#848e9c', fontSize: '12px', marginBottom: '8px' }}>Telegram Chat ID</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '12px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', borderRadius: '8px' }} 
              placeholder="Enter your chat ID"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
          </div>
          <button 
            onClick={onTestTelegram}
            disabled={isTesting}
            style={{ 
              width: '100%', padding: '12px', background: '#f3ba2f', color: '#161a1e', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}
          >
            <Send size={16} />
            {isTesting ? 'Sending...' : 'Send Test Message'}
          </button>
        </div>

        <div style={{ background: '#161a1e', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139', color: '#848e9c', fontSize: '12px' }}>
          <h4 style={{ color: '#eaebed', marginBottom: '15px' }}>Help Guide</h4>
          <ul style={{ paddingLeft: '15px', lineHeight: '1.8' }}>
            <li>Search @BotFather to create a new bot.</li>
            <li>Search @userinfobot to find your Chat ID.</li>
            <li>Global Signal alerts are sent when all timeframes (5m, 1h, 1d) align.</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default SignalSettings;
