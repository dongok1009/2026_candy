import React from 'react';
import { Info, BellRing, Send, Layers } from 'lucide-react';

const SignalSettings = ({ 
  rules, 
  updateRule,
  newWhatIf,
  setNewWhatIf,
  handleAddWhatIf,
  handleRemoveWhatIf,
  handleResetWhatIf
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.adx)} onChange={e => updateRule(iv, side, fields.adx, e.target.checked)} />
                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>ADX</span>
                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.adxLow) ?? (iv === '1d' ? 15 : 30)} onChange={e => updateRule(iv, side, fields.adxLow, parseFloat(e.target.value))} />
                    <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; ADX &lt;</span>
                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.adxHigh) ?? 99} onChange={e => updateRule(iv, side, fields.adxHigh, parseFloat(e.target.value))} />
                  </div>

                  {/* Stoch K Limit */}
                  {hasStochKLimit && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {renderAnd()}
                      <input type="checkbox" checked={getRuleValue(side, iv, fields.stochKLimit)} onChange={e => updateRule(iv, side, fields.stochKLimit, e.target.checked)} />
                      <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>StochK</span>
                      <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, 'stochKLow') ?? 0} onChange={e => updateRule(iv, side, 'stochKLow', parseFloat(e.target.value))} />
                      <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; StochK &lt;</span>
                      <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, 'stochKHigh') ?? (getRuleNum(side, iv, fields.stochKLimitVal) || 99)} onChange={e => updateRule(iv, side, 'stochKHigh', parseFloat(e.target.value))} />
                    </div>
                  )}

                  {/* RSI Limit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.rsiLimit)} onChange={e => updateRule(iv, side, fields.rsiLimit, e.target.checked)} />
                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>RSI</span>
                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.rsiLow) ?? 5} onChange={e => updateRule(iv, side, fields.rsiLow, parseFloat(e.target.value))} />
                    <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; RSI &lt;</span>
                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.rsiHigh) ?? 95} onChange={e => updateRule(iv, side, fields.rsiHigh, parseFloat(e.target.value))} />
                  </div>

                  {/* MACD Value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {renderAnd()}
                    <input type="checkbox" checked={getRuleValue(side, iv, fields.macdVal)} onChange={e => updateRule(iv, side, fields.macdVal, e.target.checked)} />
                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>|MACD| &lt;</span>
                    <input type="number" style={{ width: '60px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={getRuleNum(side, iv, fields.macdValNum) ?? 0} onChange={e => updateRule(iv, side, fields.macdValNum, parseFloat(e.target.value))} />
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

                  {/* Stoch Extreme Bypass (m5 전용) */}
                  {iv === '5m' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {renderAnd()}
                      <input type="checkbox" checked={getRuleValue(side, iv, 'useStochExtremeBypass')} onChange={e => updateRule(iv, side, 'useStochExtremeBypass', e.target.checked)} />
                      <span style={{ color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>극단값에서 무조건 시장가 진입</span>
                    </div>
                  )}



                  {/* 1H 20MA Size Filter (1h 전용) */}
                  {iv === '1h' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {renderAnd()}
                      <input type="checkbox" checked={getRuleValue(side, iv, 'useMaSizeFilter')} onChange={e => updateRule(iv, side, 'useMaSizeFilter', e.target.checked)} />
                      <span style={{ color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>1H 20MA 포지션 규모 조절 ({isLong ? '미만시 50%' : '초과시 50%'})</span>
                    </div>
                  )}
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

      <div style={{ background: '#161a1e', padding: '12px 16px', borderRadius: '12px', border: '1px solid #2b3139', marginBottom: '40px' }}>
          {/* Row 1: Target ROI & Stop Loss ROI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#26a69a', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Target ROI (e.g. 0.03 = 3%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" step="0.005"
                        value={getRuleNum('global', 'targetRoi')} 
                        onChange={e => updateRule('global', null, 'targetRoi', parseFloat(e.target.value))} 
                        style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>기본 익절율</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#ef5350', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Stop Loss ROI (e.g. 0.15 = 15%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" step="0.01"
                        value={getRuleNum('global', 'slRoi')} 
                        onChange={e => updateRule('global', null, 'slRoi', parseFloat(e.target.value))} 
                        style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>손절 기준율</span>
                  </div>
              </div>
          </div>

          {/* Row 2: Entry Wait & Exit Wait */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px', marginTop: '12px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Entry Wait Limit (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'entryWaitMin')} 
                        onChange={e => updateRule('global', null, 'entryWaitMin', parseInt(e.target.value))} 
                        style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>분 대기 후 실패</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#ff4d4d', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Exit Wait Limit (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'exitWaitMin')} 
                        onChange={e => updateRule('global', null, 'exitWaitMin', parseInt(e.target.value))} 
                        style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>분 대기 후 강제</span>
                  </div>
              </div>
          </div>

          {/* Row 3: TP Reduction Wait & Reduced Target ROI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px', marginTop: '12px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>TP Reduction Wait (min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'reduceTpWaitMin')} 
                        onChange={e => updateRule('global', null, 'reduceTpWaitMin', parseInt(e.target.value))} 
                        style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>분 뒤 익절 하향</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Reduced Target ROI (e.g. 0.01)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" step="0.005"
                        value={getRuleNum('global', 'reducedTargetRoi')} 
                        onChange={e => updateRule('global', null, 'reducedTargetRoi', parseFloat(e.target.value))} 
                        style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>조정된 익절율</span>
                  </div>
              </div>
          </div>

          {/* Row 4: Trading Leverage & Max Order Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px', marginTop: '12px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#26a69a', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Trading Leverage (x)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'leverage')} 
                        onChange={e => updateRule('global', null, 'leverage', parseInt(e.target.value))} 
                        style={{ width: '60px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>배 레버리지</span>
                  </div>
              </div>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Max Order Amount ($)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="number" 
                        value={getRuleNum('global', 'orderAmount')} 
                        onChange={e => updateRule('global', null, 'orderAmount', parseFloat(e.target.value))} 
                        style={{ width: '100px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} 
                      />
                      <span style={{ color: '#848e9c', fontSize: '11px' }}>달러 ($) 최대 진입</span>
                  </div>
              </div>
          </div>

          {/* Row 5: Opposite Signal Switching */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px 16px', marginTop: '12px' }}>
              <div className="input-group">
                  <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Opposite Signal Switching (스위칭 진입)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0b0e11', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                      <input type="checkbox"
                        checked={getRuleValue('global', 'switchingEnabled')} 
                        onChange={e => updateRule('global', null, 'switchingEnabled', e.target.checked)} 
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ color: '#eaebed', fontSize: '11px', marginLeft: '5px', fontWeight: 'bold' }}>포지션 보유 중 반대 방향 시그널 발생 시 즉시 시장가 청산 및 반대 진입</span>
                  </div>
              </div>
          </div>

          {/* WHAT-IF 진입 필터 */}
          <div style={{ marginTop: '20px', borderTop: '1px dashed #2b3139', paddingTop: '16px' }}>
              <h4 style={{ color: '#eaebed', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="#f3ba2f" />
                  <span style={{ color: '#f3ba2f', fontWeight: 'bold' }}>WHAT-IF 진입필터</span>
              </h4>
              <p style={{ color: '#aeaeae', fontSize: '11px', marginBottom: '12px' }}>
                  진입 시그널 발생 시 지표값에 따라 해당 진입을 차단하거나, 비중/TP/SL 배수를 조정하여 진입합니다.
              </p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#0b0e11', padding: '10px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                  {/* 방향 선택 */}
                  <select 
                      value={newWhatIf?.side} 
                      onChange={e => setNewWhatIf(prev => ({ ...prev, side: e.target.value }))}
                      style={{ background: '#1e2329', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                  >
                      <option value="both">양방향</option>
                      <option value="long">롱</option>
                      <option value="short">숏</option>
                  </select>

                  {/* 액션 선택 */}
                  <select 
                      value={newWhatIf?.action} 
                      onChange={e => setNewWhatIf(prev => ({ ...prev, action: e.target.value }))}
                      style={{ background: '#1e2329', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                  >
                      <option value="block">차단</option>
                      <option value="size_50">50%진입</option>
                      <option value="tp_50">TP 50%축소</option>
                      <option value="sl_50">SL 50%축소</option>
                  </select>

                  {/* 타임프레임 선택 */}
                  <select 
                      value={newWhatIf?.timeframe} 
                      onChange={e => setNewWhatIf(prev => ({ ...prev, timeframe: e.target.value }))}
                      style={{ background: '#1e2329', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                  >
                      <option value="5m">5m</option>
                      <option value="1h">1h</option>
                      <option value="1d">1d</option>
                  </select>

                  {/* 지표 선택 */}
                  <select 
                      value={newWhatIf?.indicator} 
                      onChange={e => setNewWhatIf(prev => ({ ...prev, indicator: e.target.value }))}
                      style={{ background: '#1e2329', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                  >
                      <option value="ma_slope_5">5ma slope</option>
                      <option value="adx">5ma adx</option>
                      <option value="rsi">RSI</option>
                      <option value="macd">MACD</option>
                      <option value="stochk">StochRSI K</option>
                      <option value="stochd">StochRSI D</option>
                      <option value="bbw">BBW</option>
                      <option value="bbwp">BBWP</option>
                      <option value="ma_slope_10">10ma slope</option>
                      <option value="ma_slope_20">20ma slope</option>
                      <option value="ma_roc">MA ROC</option>
                  </select>

                  {/* 연산자 선택 */}
                  <select 
                      value={newWhatIf?.operator} 
                      onChange={e => setNewWhatIf(prev => ({ ...prev, operator: e.target.value }))}
                      style={{ background: '#1e2329', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                  >
                      <option value="<">&lt;</option>
                      <option value=">">&gt;</option>
                      <option value="=">=</option>
                  </select>

                  {/* 임계값 입력 */}
                  <input 
                      type="number" 
                      value={newWhatIf?.threshold}
                      onChange={e => setNewWhatIf(prev => ({ ...prev, threshold: e.target.value }))}
                      placeholder="임계치"
                      style={{ background: '#1e2329', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', width: '80px', fontSize: '12px' }}
                  />

                  {/* 추가 버튼 */}
                  <button 
                      type="button"
                      onClick={handleAddWhatIf}
                      style={{ background: '#f3ba2f', color: '#0b0e11', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                      + 추가
                  </button>

                  {/* 초기화 버튼 */}
                  <button 
                      type="button"
                      onClick={handleResetWhatIf}
                      style={{ background: 'transparent', color: '#aeaeae', border: '1px solid #2b3139', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                  >
                      초기화
                  </button>
              </div>

              {/* 추가된 WHAT-IF 리스트 칩 표시 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {rules?.global?.whatIfFilters?.map((filter, index) => {
                      const sideText = filter.side === 'both' ? '양방향' : (filter.side === 'long' ? '롱' : '숏');
                      const actionText = filter.action === 'block' ? '차단' : (filter.action === 'size_50' ? '50%진입' : (filter.action === 'tp_50' ? 'TP 50%축소' : 'SL 50%축소'));
                      return (
                          <div 
                              key={index}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0b0e11', border: '1px solid #f3ba2f', color: '#eaebed', padding: '4px 10px', borderRadius: '16px', fontSize: '11px' }}
                          >
                              <span style={{ color: filter.side === 'long' ? '#0ecb81' : (filter.side === 'short' ? '#f6465d' : '#f3ba2f'), fontWeight: 'bold' }}>
                                  {sideText}
                              </span>
                              <span>{filter.timeframe} {filter.indicator} {filter.operator} {filter.threshold}</span>
                              <span style={{ color: '#f3ba2f', fontWeight: 'bold' }}>➔ {actionText}</span>
                              <span 
                                  onClick={() => handleRemoveWhatIf(index)}
                                  style={{ color: '#aeaeae', marginLeft: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                  ✕
                              </span>
                          </div>
                      );
                  })}
                  {(!rules?.global?.whatIfFilters || rules.global.whatIfFilters.length === 0) && (
                      <div style={{ color: '#848e9c', fontSize: '12px', fontStyle: 'italic' }}>설정된 WHAT-IF 조건이 없습니다.</div>
                  )}
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
                <h4 style={{ color: '#f3ba2f', fontSize: '14px', fontWeight: '900', marginBottom: '10px' }}>관망 상태 (HOLDING STATUS)</h4>
                <p style={{ color: '#848e9c', fontSize: '12px' }}>
                    위에서 선택한 진입 조건들이 완전히 충족되지 않거나, 활성화된 모든 조건이 만족하지 않을 때 포지션 없이 대기(관망) 상태가 됩니다.
                </p>
            </div>
        </div>
      </div>

    </section>
  );
};

export default SignalSettings;
