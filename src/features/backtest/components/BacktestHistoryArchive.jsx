import React, { useState } from 'react';
import { History, Play, Trash2, Download, ExternalLink, TrendingUp, Calendar, Activity } from 'lucide-react';
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
                <p>No saved backtest records found.</p>
            </div>
        );
    }

    // Sort by timestamp descending
    const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return (
        <section className="history-archive">
            <div className="archive-header">
                <h3><History size={18} /> Saved Backtest Archive</h3>
                <span className="count-badge">{records.length} Records</span>
            </div>

            <div className="archive-grid">
                {sortedRecords.map((record) => {
                    const roiNum = parseFloat(record.stats.roi.replace('%', ''));
                    const isPositive = roiNum > 0;
                    
                    return (
                        <div key={record.version} className="archive-card">
                            <div className="card-top">
                                <div className="version-info">
                                    <span className="version-tag">{record.version}</span>
                                    <span className="base-version">Base: {record.baseVersion}</span>
                                    <span className="symbol-tag" style={{ 
                                        marginLeft: '8px', 
                                        fontSize: '10px', 
                                        color: '#f3ba2f', 
                                        background: 'rgba(243, 186, 47, 0.1)', 
                                        padding: '1px 6px', 
                                        borderRadius: '4px',
                                        fontWeight: 'bold',
                                        border: '1px solid rgba(243, 186, 47, 0.2)'
                                    }}>
                                        {record.config?.symbol || 'BTCUSDT'}
                                    </span>
                                </div>
                                <div className="timestamp">
                                    <Calendar size={12} />
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
                                </div>
                            </div>

                            <div className="stats-row">
                                <div className="stat-mini">
                                    <span className="label">ROI</span>
                                    <span className={`value ${isPositive ? 'positive' : 'negative'}`}>
                                        {record.stats.roi}
                                    </span>
                                </div>
                                <div className="stat-mini">
                                    <span className="label">WIN RATE</span>
                                    <span className="value text-gold">{record.stats.winRate}</span>
                                </div>
                                <div className="stat-mini">
                                    <span className="label">MDD</span>
                                    <span className="value" style={{ color: '#ff4d4d' }}>{record.stats.mdd || '-'}</span>
                                </div>
                                <div className="stat-mini">
                                    <span className="label">TRADES</span>
                                    <span className="value">{record.stats.trades}</span>
                                </div>
                            </div>

                            <div className="period-box">
                                <span className="label">PERIOD</span>
                                <span className="period-text">{record.stats.period}</span>
                            </div>

                            {/* 지표 조건 아코디언 토글 추가 */}
                            {(record.rules || record.config) && (
                                <div className="rules-accordion">
                                    <button 
                                        type="button"
                                        className={`rules-toggle-btn ${expandedVersions[record.version] ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            toggleRules(record.version);
                                        }}
                                    >
                                        <span>지표 조건 (Rules)</span>
                                        <span className="arrow">{expandedVersions[record.version] ? '▲' : '▼'}</span>
                                    </button>
                                    
                                    {expandedVersions[record.version] && (
                                        <div className="rules-detail-panel">
                                            {record.rules && (
                                                <>
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

                                                    <div className="rules-section-title long-header">📈 Long Entry Conditions</div>
                                                    {renderRulesForSide(record.rules.long, 'long')}

                                                    <div className="rules-section-title short-header">📉 Short Entry Conditions</div>
                                                    {renderRulesForSide(record.rules.short, 'short')}
                                                </>
                                            )}
                                            
                                            {record.config && (
                                                <>
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
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="card-actions">
                                <button className="action-btn load" onClick={() => onSelect(record.version)}>
                                    <Play size={14} /> Restore Config
                                </button>
                                {record.detailFile && (
                                    <a 
                                        className="action-btn download" 
                                        href={`http://localhost:3001/api/download?file=${encodeURIComponent(record.detailFile)}`}
                                        title="Download Detailed CSV"
                                    >
                                        <Download size={14} />
                                    </a>
                                )}
                                <button 
                                    className="action-btn delete" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("!!! DELETE CLICK DETECTED !!!", record.version);
                                        onDelete(record.version);
                                    }} 
                                    title="Delete Record"
                                    style={{ cursor: 'pointer', zIndex: 100 }}
                                >
                                    <Trash2 size={14} style={{ pointerEvents: 'none' }} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default BacktestHistoryArchive;
