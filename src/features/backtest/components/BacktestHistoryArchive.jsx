// 백테스트 아카이브 기록을 가로형 한 줄 목록 스타일로 보여주는 컴포넌트입니다.
import React, { useState } from 'react';
import { History, Play, Trash2, Download, Calendar, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import './BacktestHistoryArchive.css';

const BacktestHistoryArchive = ({ records, onSelect, onDelete }) => {
    const [expandedVersions, setExpandedVersions] = useState({});

    const toggleRules = (version) => {
        setExpandedVersions(prev => ({
            ...prev,
            [version]: !prev[version]
        }));
    };

    const renderRulesForSide = (sideRules, side) => {
        if (!sideRules) return <div className="no-rules">설정된 조건이 없습니다.</div>;
        
        const tfRows = Object.entries(sideRules).map(([tf, tfRules]) => {
            const activeRules = [];
            
            if (tfRules.useMacdVal) {
                activeRules.push(`|MACD| < ${tfRules.macdVal ?? 0}`);
            }
            if (tfRules.useMacdBeyondSig) {
                const operator = side === 'long' ? '>' : '<';
                activeRules.push(`MACD ${operator} Signal`);
            }
            if (tfRules.useMacdSigDiff) {
                activeRules.push(`MACD차이 > ${tfRules.macdSigDiff ?? 0}`);
            }
            if (tfRules.useStochCross) {
                const crossText = side === 'long' ? 'K > D' : 'K < D';
                activeRules.push(`Stoch 크로스 (${crossText})`);
            }
            if (tfRules.useStochKLimit) {
                const low = tfRules.stochKLow ?? 0;
                const high = tfRules.stochKHigh ?? tfRules.stochKThreshold ?? 80;
                activeRules.push(`${low} < Stoch K < ${high}`);
            }
            if (tfRules.useADX) {
                const low = tfRules.adxLow ?? tfRules.adxThreshold ?? 25;
                const high = tfRules.adxHigh ?? 99;
                activeRules.push(`${low} < ADX < ${high}`);
            }
            if (tfRules.useRSI) {
                const low = tfRules.rsiLow ?? 30;
                const high = tfRules.rsiHigh ?? 70;
                activeRules.push(`${low} < RSI < ${high}`);
            }
            if (tfRules.useStochExtremeBypass) {
                activeRules.push("극단값 시장가 진입");
            }
            if (tfRules.useMaSizeFilter) {
                const filterDesc = side === 'long' ? '미만시 50%' : '초과시 50%';
                activeRules.push(`1H 20MA 규모 조절 (${filterDesc})`);
            }
            
            if (activeRules.length === 0) return null;
            
            return (
                <div key={tf} className="tf-rule-row">
                    <span className="tf-badge">{tf}</span>
                    <span className="tf-rules-text">{activeRules.join(', ')}</span>
                </div>
            );
        }).filter(Boolean);
        
        if (tfRows.length === 0) {
            return <div className="no-rules">활성화된 지표 필터 없음</div>;
        }
        
        return <div className="tf-rules-list">{tfRows}</div>;
    };

    if (!records || records.length === 0) {
        return (
            <div className="history-empty">
                <History size={48} opacity={0.2} />
                <p>저장된 백테스트 기록이 존재하지 않습니다.</p>
            </div>
        );
    }

    // 헬퍼: 브라우저 환경에 관계없이 한글 날짜와 AM/PM이 섞인 문자열을 완벽히 타임스탬프로 분석
    const parseCustomDate = (str) => {
        if (!str) return 0;
        try {
            const isPM = str.includes('PM') || str.includes('오후');
            const isAM = str.includes('AM') || str.includes('오전');
            const nums = str.match(/\d+/g);
            if (!nums || nums.length < 3) {
                const d = new Date(str).getTime();
                return isNaN(d) ? 0 : d;
            }
            const year = parseInt(nums[0]) || 0;
            const month = parseInt(nums[1]) - 1 || 0;
            const day = parseInt(nums[2]) || 0;
            let hour = 0;
            let minute = 0;
            let second = 0;
            if (nums.length >= 4) {
                hour = parseInt(nums[3]) || 0;
                if (isPM && hour < 12) hour += 12;
                if (isAM && hour === 12) hour = 0;
            }
            if (nums.length >= 5) {
                minute = parseInt(nums[4]) || 0;
            }
            if (nums.length >= 6) {
                second = parseInt(nums[5]) || 0;
            }
            return new Date(year, month, day, hour, minute, second).getTime();
        } catch (e) {
            return 0;
        }
    };

    const sortedRecords = [...records].sort((a, b) => {
        const timeA = parseCustomDate(a.timestamp);
        const timeB = parseCustomDate(b.timestamp);
        if (timeA !== timeB) {
            return timeB - timeA;
        }
        const getVerNum = (v) => {
            if (!v) return 0;
            const parts = v.split('.');
            return parseInt(parts[parts.length - 1]) || 0;
        };
        return getVerNum(b.version) - getVerNum(a.version);
    });

    // 헬퍼: 수익률 및 MDD를 소수점 없는 정수형으로 반올림 포맷
    const formatRoiInt = (roiStr) => {
        if (!roiStr) return '-';
        const num = parseFloat(roiStr.replace('%', ''));
        return isNaN(num) ? roiStr : `${Math.round(num)}%`;
    };

    const formatMddInt = (mddStr) => {
        if (!mddStr || mddStr === '-') return '-';
        const num = parseFloat(mddStr.replace('%', ''));
        return isNaN(num) ? mddStr : `${Math.round(num)}%`;
    };

    return (
        <section className="history-archive">
            <div className="archive-header">
                <h3><History size={18} /> Saved Backtest Archive</h3>
                <span className="count-badge">{records.length} Records</span>
            </div>

            <div className="archive-list-container">
                {sortedRecords.map((record) => {
                    const roiNum = parseFloat(record.stats.roi.replace('%', ''));
                    const isPositive = roiNum > 0;
                    const isExpanded = !!expandedVersions[record.version];
                    
                    return (
                        <div key={record.version} className={`archive-row-group ${isExpanded ? 'expanded' : ''}`}>
                            {/* 가로형 한 줄 기본 정보 영역 */}
                            <div className="archive-row-bar" onClick={() => toggleRules(record.version)}>
                                <div className="bar-cell version-cell">
                                    <span className="row-version">{record.version}</span>
                                    <span className="row-base-version">{record.baseVersion}</span>
                                </div>

                                <div className="bar-cell symbol-cell">
                                    <span className="row-symbol">{record.config?.symbol || 'BTCUSDT'}</span>
                                </div>

                                <div className="bar-cell date-cell">
                                    <Calendar size={12} style={{ color: '#848e9c' }} />
                                    <span className="row-date">
                                        {(() => {
                                            try {
                                                const d = new Date(record.timestamp);
                                                return isNaN(d.getTime()) ? record.timestamp : d.toLocaleString('ko-KR', {
                                                    timeZone: 'Asia/Seoul',
                                                    year: 'numeric', month: '2-digit', day: '2-digit',
                                                    hour: '2-digit', minute: '2-digit',
                                                    hour12: false
                                                }).replace(/\. /g, '-').replace('.', '');
                                            } catch(e) { return record.timestamp; }
                                        })()}
                                    </span>
                                </div>

                                <div className="bar-cell period-cell">
                                    <span className="row-period-lbl">PERIOD:</span>
                                    <span className="row-period-val">{record.stats.period}</span>
                                </div>

                                <div className="bar-cell stats-cell">
                                    <div className="mini-stat-item">
                                        <span className="lbl">ROI</span>
                                        <span className={`val ${isPositive ? 'positive' : 'negative'}`}>{formatRoiInt(record.stats.roi)}</span>
                                    </div>
                                    <div className="mini-stat-item">
                                        <span className="lbl">WIN %</span>
                                        <span className="val text-gold">{record.stats.winRate}</span>
                                    </div>
                                    <div className="mini-stat-item">
                                        <span className="lbl">MDD</span>
                                        <span className="val text-red">{formatMddInt(record.stats.mdd)}</span>
                                    </div>
                                    <div className="mini-stat-item">
                                        <span className="lbl">TRADES</span>
                                        <span className="val">{record.stats.trades}</span>
                                    </div>
                                </div>

                                <div className="bar-cell rules-toggle-cell" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        type="button" 
                                        className={`bar-rules-btn ${isExpanded ? 'active' : ''}`}
                                        onClick={() => toggleRules(record.version)}
                                    >
                                        지표 조건 (Rules) {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                </div>

                                <div className="bar-cell actions-cell" onClick={(e) => e.stopPropagation()}>
                                    <button className="row-btn load" onClick={() => onSelect(record.version)}>
                                        <Play size={12} /> Restore Config
                                    </button>
                                    {record.detailFile && (
                                        <a 
                                            className="row-btn download" 
                                            href={`http://localhost:3001/api/download?file=${encodeURIComponent(record.detailFile)}`}
                                            title="Download Detailed CSV"
                                        >
                                            <Download size={12} />
                                        </a>
                                    )}
                                    <button 
                                        className="row-btn delete" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onDelete(record.version);
                                        }} 
                                        title="Delete Record"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* 지표 조건 아코디언 드롭다운 영역 */}
                            {isExpanded && (
                                <div className="archive-row-detail">
                                    <div className="detail-inner-grid">
                                        {record.rules && (
                                            <div className="detail-block">
                                                <div className="rules-section-title">⏱️ Entry / Exit Wait</div>
                                                <div className="rules-grid-mini">
                                                    <div className="rule-item-mini">
                                                        <span className="rule-lbl">Entry 대기:</span>
                                                        <span className="rule-val">{record.rules.entryWaitMin ?? record.config?.entryWaitMin ?? 0}분</span>
                                                    </div>
                                                    <div className="rule-item-mini">
                                                        <span className="rule-lbl">Exit 대기:</span>
                                                        <span className="rule-val">{record.rules.exitWaitMin ?? record.config?.exitWaitMin ?? 0}분</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Global Rules (Switching / MA Slope Filters) */}
                                                {record.rules.global && (record.rules.global.switchingEnabled || 
                                                  record.rules.global.maSlopeAlign5mEnabled || 
                                                  record.rules.global.maSlopeAlign1hEnabled) && (
                                                    <>
                                                        <div className="rules-section-title global-header" style={{ color: '#f3ba2f', marginTop: '14px' }}>🌐 Global Direction Filters</div>
                                                        <div className="rules-grid-mini" style={{ gridTemplateColumns: '1fr', gap: '6px' }}>
                                                            {record.rules.global.switchingEnabled && (
                                                                <div className="rule-item-mini" style={{ borderColor: 'rgba(243, 186, 47, 0.2)' }}>
                                                                    <span className="rule-lbl" style={{ color: '#f3ba2f' }}>Opposite Signal Switching (스위칭 진입):</span>
                                                                    <span className="rule-val" style={{ color: '#f3ba2f' }}>활성 (시장가 즉시 청산 및 스위칭)</span>
                                                                </div>
                                                            )}
                                                            {record.rules.global.maSlopeAlign5mEnabled && (
                                                                <div className="rule-item-mini">
                                                                    <span className="rule-lbl">MA Slope 5m Filter (5분봉 방향 필터):</span>
                                                                    <span className="rule-val">활성 (기준: {record.rules.global.maSlopeAlignPeriod5m ?? 20}MA)</span>
                                                                </div>
                                                            )}
                                                            {record.rules.global.maSlopeAlign1hEnabled && (
                                                                <div className="rule-item-mini">
                                                                    <span className="rule-lbl">MA Slope 1h Filter (1시간봉 방향 필터):</span>
                                                                    <span className="rule-val">활성 (기준: {record.rules.global.maSlopeAlignPeriod1h ?? 20}MA)</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                <div className="rules-section-title long-header">📈 Long Entry Conditions</div>
                                                {renderRulesForSide(record.rules.long, 'long')}

                                                <div className="rules-section-title short-header">📉 Short Entry Conditions</div>
                                                {renderRulesForSide(record.rules.short, 'short')}
                                            </div>
                                        )}
                                        
                                        {record.config && (
                                            <div className="detail-block">
                                                <div className="rules-section-title config-header">⚙️ System Parameters</div>
                                                <div className="rules-grid-mini three-cols">
                                                    <div className="rule-item-mini">
                                                        <span className="rule-lbl">Target ROI:</span>
                                                        <span className="rule-val">{record.config.targetRoi !== undefined ? `${(record.config.targetRoi * 100).toFixed(1)}%` : '-'}</span>
                                                    </div>
                                                    <div className="rule-item-mini">
                                                        <span className="rule-lbl">Stop Loss:</span>
                                                        <span className="rule-val">{record.config.slRoi !== undefined ? `${(record.config.slRoi * 100).toFixed(1)}%` : '-'}</span>
                                                    </div>
                                                    <div className="rule-item-mini">
                                                        <span className="rule-lbl">레버리지:</span>
                                                        <span className="rule-val">{record.config.leverage ? `${record.config.leverage}x` : '-'}</span>
                                                    </div>
                                                    <div className="rule-item-mini">
                                                        <span className="rule-lbl">초기 잔고:</span>
                                                        <span className="rule-val">{record.config.initialBalance ? `$${record.config.initialBalance.toLocaleString()}` : '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default React.memo(BacktestHistoryArchive, (prevProps, nextProps) => {
    return prevProps.records === nextProps.records;
});
