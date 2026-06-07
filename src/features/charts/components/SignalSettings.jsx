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
  botName
}) => {

  const getRuleValue = (side, iv, field) => {
    if (side === 'global') return rules.global ? rules.global[iv] : false;
    return rules[side] && rules[side][iv] ? rules[side][iv][field] : false;
  };

  const getRuleNum = (side, iv, field) => {
    if (side === 'global') return rules.global ? rules.global[iv] : 0;
    return rules[side] && rules[side][iv] ? rules[side][iv][field] : 0;
  };

  const renderIntervalCards = (side) => {
    const fields = {
        adx: 'adxEnabled',
        adxLow: 'adxLow',
        adxHigh: 'adxHigh',
        macdCross: 'macdCrossEnabled',
        stochCross: 'stochCrossEnabled',
        macdVal: 'macdValueEnabled',
        macdValNum: 'macdValue',
        stochKLimit: 'stochKLimitEnabled',
        stochKLimitVal: 'stochKThreshold',
        rsiLimit: 'rsiEnabled',
        rsiLow: 'rsiLow',
        rsiHigh: 'rsiHigh'
    };

    const isLong = side === 'long';
    const sideColor = isLong ? '#26a69a' : '#ef5350';
    const sideText = isLong ? 'LONG' : 'SHORT';

    return (
      <div key={side} style={{ marginBottom: isLong ? '30px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h4 style={{ color: sideColor, fontSize: '15px', fontWeight: '900', margin: 0, borderLeft: `4px solid ${sideColor}`, paddingLeft: '10px' }}>
            {sideText} CONDITIONS
          </h4>
          {isLong && (
            <button 
              onClick={() => {
                if (window.confirm('롱 설정을 숏 설정에 그대로 복사하시겠습니까?')) {
                  ['5m', '1h', '1d'].forEach(tf => {
                    Object.keys(rules.long[tf] || {}).forEach(key => {
                      updateRule(tf, 'short', key, rules.long[tf][key]);
                    });
                  });
                  alert('롱 설정이 숏 설정에 복사되었습니다.');
                }
              }}
              style={{
                padding: '6px 12px',
                background: '#1e2329',
                color: '#26a69a',
                border: '1px solid #26a69a',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              COPY LONG TO SHORT
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {['5m', '1h', '1d'].map((iv) => {
            let isFirst = true;
            const renderAnd = () => {
                if (isFirst) {
                    isFirst = false;
                    return <span style={{ width: '26px', marginRight: '6px', display: 'inline-block' }}></span>;
                }
                return <span style={{ color: '#848e9c', fontWeight: 'bold', marginRight: '6px', fontSize: '11px', width: '26px', display: 'inline-block', textAlign: 'right' }}>AND</span>;
            };

            const hasStochKLimit = rules?.[side]?.[iv]?.stochKThreshold !== undefined || iv === '5m' || iv === '1h' || iv === '1d';

            return (
              <div key={iv} style={{ background: '#0b0e11', padding: '16px', borderRadius: '8px', border: '1px solid #2b3139', flex: '1', minWidth: '260px' }}>
                <h5 style={{ color: sideColor, fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0' }}>{iv}:</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* ADX Range */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.adx)} onChange={e => updateRule(iv, side, fields.adx, e.target.checked)} />
                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>ADX</span>
                    <input type="number" style={{ width: '45px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.adxLow) ?? (iv === '1d' ? 15 : 30)} onChange={e => updateRule(iv, side, fields.adxLow, parseFloat(e.target.value))} />
                    <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; ADX &lt;</span>
                    <input type="number" style={{ width: '45px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.adxHigh) ?? 99} onChange={e => updateRule(iv, side, fields.adxHigh, parseFloat(e.target.value))} />
                  </div>

                  {/* Stoch K Limit */}
                  {hasStochKLimit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {renderAnd()}
                      <input type="checkbox" checked={getRuleValue(side, iv, fields.stochKLimit)} onChange={e => updateRule(iv, side, fields.stochKLimit, e.target.checked)} />
                      <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>StochK</span>
                      <input type="number" style={{ width: '45px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, 'stochKLow') ?? 0} onChange={e => updateRule(iv, side, 'stochKLow', parseFloat(e.target.value))} />
                      <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; StochK &lt;</span>
                      <input type="number" style={{ width: '45px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, 'stochKHigh') ?? (getRuleNum(side, iv, fields.stochKLimitVal) || 99)} onChange={e => updateRule(iv, side, 'stochKHigh', parseFloat(e.target.value))} />
                    </div>
                  )}

                  {/* RSI Limit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.rsiLimit)} onChange={e => updateRule(iv, side, fields.rsiLimit, e.target.checked)} />
                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>RSI</span>
                    <input type="number" style={{ width: '45px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.rsiLow) ?? 5} onChange={e => updateRule(iv, side, fields.rsiLow, parseFloat(e.target.value))} />
                    <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; RSI &lt;</span>
                    <input type="number" style={{ width: '45px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.rsiHigh) ?? 95} onChange={e => updateRule(iv, side, fields.rsiHigh, parseFloat(e.target.value))} />
                  </div>

                  {/* MACD Value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.macdVal)} onChange={e => updateRule(iv, side, fields.macdVal, e.target.checked)} />
                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>|MACD| &lt;</span>
                    <input type="number" style={{ width: '60px', background: '#1e2329', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.macdValNum) ?? 0} onChange={e => updateRule(iv, side, fields.macdValNum, parseFloat(e.target.value))} />
                  </div>

                  {/* MACD Cross */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.macdCross)} onChange={e => updateRule(iv, side, fields.macdCross, e.target.checked)} />
                    <span style={{ color: '#eaebed', fontSize: '12px', marginLeft: '5px' }}>MACD Cross ({isLong ? 'Long: >' : 'Short: <'})</span>
                  </div>

                  {/* Stoch Cross */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.stochCross)} onChange={e => updateRule(iv, side, fields.stochCross, e.target.checked)} />
                    <span style={{ color: '#eaebed', fontSize: '12px', marginLeft: '5px' }}>Stoch Cross ({isLong ? 'Long: K > D' : 'Short: K < D'})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="conditions-footer" style={{ marginTop: '40px' }}>
      <div className="footer-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Info size={20} color="#f3ba2f" />
        <h2 style={{ margin: 0, fontSize: '18px', color: '#eaebed' }}>1. Entry & Exit Strategy (Order Execution)</h2>
      </div>

      <div style={{ background: '#161a1e', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139', marginBottom: '40px' }}>
          {/* Row 1: Target ROI & Stop Loss ROI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#26a69a', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Target ROI (e.g. 0.03 = 3%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" step="0.005"
                        value={getRuleNum('global', 'targetRoi')} 
                        onChange={e => updateRule('global', null, 'targetRoi', parseFloat(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>기본 익절율</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#ef5350', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Stop Loss ROI (e.g. 0.15 = 15%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" step="0.01"
                        value={getRuleNum('global', 'slRoi')} 
                        onChange={e => updateRule('global', null, 'slRoi', parseFloat(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>손절 기준율</span>
                  </div>
              </div>
          </div>

          {/* Row 2: Entry Wait & Exit Wait */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Entry Wait Limit (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'entryWaitMin')} 
                        onChange={e => updateRule('global', null, 'entryWaitMin', parseInt(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 실패</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#ff4d4d', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Exit Wait Limit (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'exitWaitMin')} 
                        onChange={e => updateRule('global', null, 'exitWaitMin', parseInt(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 강제</span>
                  </div>
              </div>
          </div>

          {/* Row 3: TP Reduction Wait & Reduced Target ROI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>TP Reduction Wait (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'reduceTpWaitMin')} 
                        onChange={e => updateRule('global', null, 'reduceTpWaitMin', parseInt(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>분 뒤 익절 하향 (0이면 비활성)</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Reduced Target ROI (e.g. 0.01)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" step="0.005"
                        value={getRuleNum('global', 'reducedTargetRoi')} 
                        onChange={e => updateRule('global', null, 'reducedTargetRoi', parseFloat(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>조정된 익절율</span>
                  </div>
              </div>
          </div>

          {/* Row 4: Trading Leverage & Max Order Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#26a69a', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Trading Leverage (x)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'leverage')} 
                        onChange={e => updateRule('global', null, 'leverage', parseInt(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>배 레버리지</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Max Order Amount ($)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'orderAmount')} 
                        onChange={e => updateRule('global', null, 'orderAmount', parseFloat(e.target.value))} 
                        style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '12px' }}>달러 ($) 최대 진입</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="footer-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Info size={20} color="#f3ba2f" />
        <h2 style={{ margin: 0, fontSize: '18px', color: '#eaebed' }}>2. Trading Indicator Conditions (Short evaluated symmetrically)</h2>
      </div>
      
      <div style={{ background: '#161a1e', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139', marginBottom: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* Unified Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {renderIntervalCards('long')}
                {renderIntervalCards('short')}
            </div>

            {/* HOLDING */}
            <div style={{ borderTop: '1px solid #2b3139', paddingTop: '20px' }}>
                <h4 style={{ color: '#f3ba2f', fontSize: '14px', fontWeight: '900', marginBottom: '10px' }}>HOLDING STATUS</h4>
                <p style={{ color: '#848e9c', fontSize: '12px' }}>
                    Occurs when the selected conditions above are not fully met (or if all active conditions evaluate to false).
                </p>
            </div>
        </div>
      </div>

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
