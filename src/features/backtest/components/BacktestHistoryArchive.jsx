import React from 'react';
import { History, Play, Trash2, Download, ExternalLink, TrendingUp, Calendar, Activity } from 'lucide-react';
import './BacktestHistoryArchive.css';

const BacktestHistoryArchive = ({ records, onSelect, onDelete }) => {
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
                                </div>
                                <div className="timestamp">
                                    <Calendar size={12} />
                                    {(() => {
                                        try {
                                            const d = new Date(record.timestamp);
                                            return isNaN(d.getTime()) ? record.timestamp.split(' ').slice(0, 3).join(' ') : d.toLocaleDateString();
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
                                    <span className="label">TRADES</span>
                                    <span className="value">{record.stats.trades}</span>
                                </div>
                            </div>

                            <div className="period-box">
                                <span className="label">PERIOD</span>
                                <span className="period-text">{record.stats.period}</span>
                            </div>

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
                                <button className="action-btn delete" onClick={() => onDelete(record.version)} title="Delete Record">
                                    <Trash2 size={14} />
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
