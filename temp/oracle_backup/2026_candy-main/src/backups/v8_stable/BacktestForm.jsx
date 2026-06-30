import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity, FileCode, Play, Copy, RefreshCcw, Layers, Info, CheckCircle2, History, Save, Download, FileSpreadsheet } from 'lucide-react';
import { OFFICIAL_STRATEGIES } from '../config/strategyConfigs';
import './BacktestForm.css';

const BacktestForm = () => {
    const [config, setConfig] = useState({
        symbol: 'BTCUSDT',
        startDate: '2025-01-01T00:00',
        endDate: '2025-03-01T00:00',
        leverage: 5,
        initialBalance: 1000,
        makerFee: 0.0002,
        takerFee: 0.0005,
        exitMakerFee: 0.0002,
        fundingFee: 0.0001,
        targetRoi: 0.03,
        slRoi: 0.15,
        version: 'v7_0_0',
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        stochP: 14,
        stochK: 3,
        stochD: 3,
        adxPeriod: 14,
        entryType: 'hybrid',
        entryWaitMin: 60,
        exitWaitMin: 2000
    });

    const [rules, setRules] = useState(OFFICIAL_STRATEGIES[0].rules);
    const [history, setHistory] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const [recordedList, setRecordedList] = useState([]);
    const [selectedRecordId, setSelectedRecordId] = useState('');
    const [displayStats, setDisplayStats] = useState(null);
    const [latestResult, setLatestResult] = useState(null);

    useEffect(() => {
        const savedHistory = localStorage.getItem('backtest_history');
        if (savedHistory) setHistory(JSON.parse(savedHistory));
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            const resp = await fetch('http://localhost:3001/api/records');
            const data = await resp.json();
            setRecordedList(data || []);
        } catch (err) { }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        const newVal = type === 'number' ? parseFloat(value) : value;
        setConfig(prev => ({ ...prev, [name]: newVal }));
        if (name === 'version') {
            const found = OFFICIAL_STRATEGIES.find(s => s.version === value);
            if (found) { setRules(found.rules); setDisplayStats(null); }
            setSelectedRecordId('');
        }
    };

    const handleRecordSelect = (e) => {
        const recordId = e.target.value;
        setSelectedRecordId(recordId);
        const record = recordedList.find(r => r.version === recordId);
        if (record) {
            setConfig(prev => ({ ...prev, ...record.config, version: record.baseVersion }));
            setDisplayStats(record.stats);
            const baseStrategy = OFFICIAL_STRATEGIES.find(s => s.version === record.baseVersion);
            if (baseStrategy) setRules(baseStrategy.rules);
        }
    };

    const handleRuleChange = (side, interval, field, value) => {
        setRules(prev => ({
            ...prev,
            [side]: { ...prev[side], [interval]: { ...prev[side][interval], [field]: value } }
        }));
    };

    const handleRun = async () => {
        setIsRunning(true);
        setLatestResult(null);
        try {
            // 사용자님이 UI에서 수정한 Rules와 Config를 통합하여 전송
            const response = await fetch('http://localhost:3001/api/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, overrideRules: rules })
            });
            const result = await response.json();
            if (result.success) {
                setLatestResult(result);
                setDisplayStats({
                    roi: `${result.roi}%`,
                    winRate: `${((result.wins / (result.wins + result.losses || 1)) * 100).toFixed(1)}%`,
                    trades: result.wins + result.losses,
                    wins: result.wins,
                    losses: result.losses,
                    period: `${config.startDate.replace('T', ' ')} ~ ${config.endDate.replace('T', ' ')}`,
                    initialBalance: config.initialBalance,
                    finalBalance: config.initialBalance * (1 + result.roi / 100)
                });
                setHistory([{ id: Date.now(), timestamp: new Date().toLocaleString(), version: config.version, roi: `${result.roi}%` }, ...history].slice(0, 10));
                fetchRecords();
            }
        } catch (error) { alert("서버 실패"); }
        finally { setIsRunning(false); }
    };

    const handleRecord = async () => {
        if (!latestResult) return;
        try {
            const response = await fetch('http://localhost:3001/api/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseVersion: config.version, config, result: latestResult })
            });
            const data = await response.json();
            if (data.success) { alert(`저장 성공: ${data.newVersion}`); fetchRecords(); }
        } catch (err) { }
    };

    const handleCopy = () => {
        const cmd = `node run_backtest.cjs ${config.version} --symbol=${config.symbol} --start=${config.startDate.split('T')[0]} --end=${config.endDate.split('T')[0]} --leverage=${config.leverage} --balance=${config.initialBalance}`;
        navigator.clipboard.writeText(cmd);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // 헬퍼: 수치 데이터 정밀 포맷팅 (기준: 100$)
    const formatValue = (val, suffix = '', isPrice = false) => {
        if (val === undefined || val === null) return '-';
        if (typeof val === 'string' && val.includes('%')) return val;
        
        let rawNum = typeof val === 'string' ? parseFloat(val.replace(/[+%$,]/g, '')) : val;
        if (isNaN(rawNum)) return val;

        const absVal = Math.abs(rawNum);
        let formatted;
        
        if (absVal >= 100) {
            formatted = Math.floor(absVal).toLocaleString();
        } else {
            formatted = absVal.toFixed(1);
        }
        
        const sign = rawNum > 0 ? (suffix === '%' ? '+' : '+') : (rawNum < 0 ? '-' : '');
        // 0인 경우 부호 없이 표시
        if (rawNum === 0) return `0${suffix}`;
        
        return `${sign}${formatted}${suffix}`;
    };

    const calculateDuration = (start, end) => {
        if (!start || !end) return '-';
        const s = new Date(start);
        const e = new Date(end);
        const diff = Math.floor((e - s) / (1000 * 60));
        return diff >= 0 ? `${diff}m` : '-';
    };

    // CSV/Excel 내보내기 로직
    const handleExportCSV = (isExcel = false) => {
        if (!tradesLog || tradesLog.length === 0) return;
        
        const headers = ["#", "진입(KST)", "청산(KST)", "시간(분)", "방향", "진입가", "청산가", "수량", "LEV", "수수료", "펀딩피", "순수익", "ROE", "실질ROE", "청산", "주문"];
        const rows = tradesLog.map((t, idx) => [
            idx + 1,
            t.entryTime,
            t.exitTime || '-',
            calculateDuration(t.entryTime, t.exitTime),
            t.side || t.direction,
            t.entryPrice,
            t.exitPrice || '-',
            t.quantity || '-',
            config.leverage,
            t.fee || 0,
            t.fundingFee || 0,
            t.netProfit,
            t.roe,
            t.realRoe || t.roe,
            t.exitReason || '전략',
            "지정가"
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `backtest_result_${config.version}_${new Date().getTime()}.${isExcel ? 'xls' : 'csv'}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 1분 지표 CSV 다운로드 (서버 파일 연동)
    const handleDownloadDetailed = async () => {
        if (!latestResult?.detailFile) {
            alert("백테스트 실행 후에만 상세 지표 다운로드가 가능합니다.");
            return;
        }
        window.open(`http://localhost:3001/api/download?file=${latestResult.detailFile}`);
    };

    const activeStats = displayStats || OFFICIAL_STRATEGIES.find(s => s.version === config.version)?.stats;
    const tradesLog = OFFICIAL_STRATEGIES.find(s => s.version === config.version)?.tradesLog || [];

    return (
        <div className="backtest-container">
            <header className="backtest-header">
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flex: 1 }}>
                    <h2><Layers /> Backtest</h2>
                    <select name="version" value={config.version} onChange={handleChange} className="header-select" style={{ minWidth: '200px', background: '#1e2329', color: '#f3ba2f', borderColor: '#f3ba2f' }}>
                        {OFFICIAL_STRATEGIES.map(s => <option key={s.version} value={s.version}>{s.name}</option>)}
                    </select>
                    <div style={{ position: 'relative' }}>
                        <select value={selectedRecordId} onChange={handleRecordSelect} className="header-select" style={{ minWidth: '220px', borderColor: '#26a69a', color: '#26a69a' }}>
                            <option value="">-- Load Result History --</option>
                            {recordedList.map(r => <option key={r.version} value={r.version}>{r.version} | ROI: {r.stats.roi}</option>)}
                        </select>
                    </div>
                </div>
                <div className="tag" style={{ padding: '8px 12px', fontSize: '12px' }}>
                    <History size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    {history.length} Runs Recorded
                </div>
            </header>

            <div className="backtest-grid">
                <section className="config-section">
                    <h3><Activity size={18} /> Core Execution Parameters</h3>
                    <div className="row-inputs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="input-group">
                            <label>Symbol</label>
                            <select name="symbol" value={config.symbol} onChange={handleChange}>
                                <option value="BTCUSDT">BTCUSDT</option>
                                <option value="ETHUSDT">ETHUSDT</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Leverage</label>
                            <input type="number" name="leverage" value={config.leverage} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label>Initial Balance ($)</label>
                            <input type="number" name="initialBalance" value={config.initialBalance} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="row-inputs" style={{ marginTop: '10px' }}>
                        <div className="input-group">
                            <label>Start Date (KST)</label>
                            <input type="datetime-local" name="startDate" value={config.startDate} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label>End Date (KST)</label>
                            <input type="datetime-local" name="endDate" value={config.endDate} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <button className={`run-button ${isRunning ? 'running' : ''}`} onClick={handleRun} disabled={isRunning}>
                            {isRunning ? <RefreshCcw size={18} className="spin" /> : <Play size={18} />}
                            {isRunning ? 'Executing...' : 'Run Backtest'}
                        </button>
                        <button className="copy-button" onClick={handleCopy}>
                            {copySuccess ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                            {copySuccess ? 'Copied' : 'Copy'}
                        </button>
                        <button className="save-button" style={{ marginLeft: 'auto', opacity: latestResult ? 1 : 0.4 }} onClick={handleRecord} disabled={!latestResult}>
                            <Save size={18} /> Record Result
                        </button>
                    </div>
                </section>
            </div>

            {activeStats && (
                <section className="config-section" style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <TrendingUp size={24} color="#f3ba2f" />
                            <h3 style={{ margin: 0, fontSize: '18px' }}>Official Strategy Performance Record</h3>
                        </div>
                        <div style={{ fontSize: '14px', color: '#848e9c' }}>Period: {activeStats.period}</div>
                    </div>
                    <div className="stats-dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {/* ROI Card */}
                        <div style={{ background: '#0b0e11', padding: '15px', borderRadius: '12px', border: '1px solid #2b3139', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#848e9c', marginBottom: '8px' }}>TOTAL ROI</div>
                            <div style={{ fontSize: '26px', fontWeight: '900', color: '#26a69a' }}>
                                {typeof activeStats.roi === 'string' ? parseInt(activeStats.roi) : Math.floor(activeStats.roi)}%
                            </div>
                        </div>

                        {/* Balance Card */}
                        <div style={{ background: '#0b0e11', padding: '15px', borderRadius: '12px', border: '1px solid #2b3139', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#848e9c', marginBottom: '10px' }}>BALANCE (INIT → FINAL)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', color: '#848e9c' }}>${activeStats.initialBalance?.toLocaleString()}</span>
                                <span style={{ color: '#2b3139' }}>→</span>
                                <span style={{ fontSize: '18px', fontWeight: '800', color: '#f3ba2f' }}>${activeStats.finalBalance?.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Win Rate Card */}
                        <div style={{ background: '#0b0e11', padding: '15px', borderRadius: '12px', border: '1px solid #2b3139', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#848e9c', marginBottom: '8px' }}>WIN RATE</div>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: '#26a69a' }}>{activeStats.winRate}</div>
                        </div>

                        {/* Trade Details Card */}
                        <div style={{ background: '#0b0e11', padding: '10px', borderRadius: '12px', border: '1px solid #2b3139', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', width: '100%' }}>
                                <div style={{ background: '#1e2329', padding: '4px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #2b3139' }}>
                                    <span style={{ fontSize: '9px', color: '#848e9c' }}>TRADES</span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#eaebed' }}>{activeStats.trades}</span>
                                </div>
                                <div style={{ background: '#1e2329', padding: '4px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #26a69a' }}>
                                    <span style={{ fontSize: '9px', color: '#26a69a' }}>WINS</span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#26a69a' }}>{activeStats.wins}</span>
                                </div>
                                <div style={{ background: '#1e2329', padding: '4px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #ff4d4d' }}>
                                    <span style={{ fontSize: '9px', color: '#ff4d4d' }}>LOSSES</span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#ff4d4d' }}>{activeStats.losses}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="config-section" style={{ marginTop: '24px', padding: '0', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '700', color: '#eaebed' }}>거래 내역</span>
                        <span style={{ fontSize: '12px', color: '#848e9c', marginTop: '4px' }}>{tradesLog.length}건</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '10px' }}>
                            <input type="checkbox" id="show-values" />
                            <label htmlFor="show-values" style={{ fontSize: '12px', color: '#848e9c', cursor: 'pointer' }}>지표값</label>
                        </div>
                        <button className="table-action-btn" onClick={() => handleExportCSV(false)}>
                            <Download size={14} /> CSV
                        </button>
                        <button className="table-action-btn" onClick={() => handleExportCSV(true)}>
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button className="table-action-btn highlight" onClick={handleDownloadDetailed}>
                            <FileCode size={14} /> 1분 지표CSV
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto', background: '#1e2329', borderRadius: '8px', border: '1px solid #2b3139', marginTop: '8px' }}>
                    <table className="trades-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #2b3139', color: '#848e9c', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px' }}>#</th>
                                <th style={{ padding: '12px 8px' }}>진입(KST)</th>
                                <th style={{ padding: '12px 8px' }}>청산(KST)</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>시간(분)</th>
                                <th style={{ padding: '12px 8px' }}>방향</th>
                                <th style={{ padding: '12px 8px' }}>진입가</th>
                                <th style={{ padding: '12px 8px' }}>청산가</th>
                                <th style={{ padding: '12px 8px' }}>수량</th>
                                <th style={{ padding: '12px 8px' }}>LEV</th>
                                <th style={{ padding: '12px 8px' }}>수수료</th>
                                <th style={{ padding: '12px 8px' }}>펀딩피</th>
                                <th style={{ padding: '12px 8px' }}>순수익</th>
                                <th style={{ padding: '12px 8px' }}>ROE</th>
                                <th style={{ padding: '12px 8px' }}>실질ROE</th>
                                <th style={{ padding: '12px 8px' }}>청산</th>
                                <th style={{ padding: '12px 8px' }}>주문</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tradesLog.map((t, idx) => {
                                const isLong = t.side === 'LONG' || t.direction === 'LONG';
                                const duration = calculateDuration(t.entryTime, t.exitTime);
                                const isProfit = String(t.netProfit || t.roe).startsWith('+') || parseFloat(t.netProfit || t.roe) > 0;

                                return (
                                    <tr key={t.id || idx} style={{ borderBottom: '1px solid #2b3139' }}>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{idx + 1}</td>
                                        <td style={{ padding: '10px 8px' }}>{t.entryTime}</td>
                                        <td style={{ padding: '10px 8px' }}>{t.exitTime || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#f3ba2f', fontWeight: 'bold' }}>{duration}</td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{
                                                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                                                background: isLong ? 'rgba(0, 192, 135, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                                                color: isLong ? '#26a69a' : '#ff4d4d'
                                            }}>
                                                {isLong ? 'LONG' : 'SHORT'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>{formatValue(t.entryPrice, '', true)}</td>
                                        <td style={{ padding: '10px 8px' }}>{formatValue(t.exitPrice, '', true)}</td>
                                        <td style={{ padding: '10px 8px' }}>{t.quantity || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{config.leverage}x</td>
                                        <td style={{ padding: '10px 8px' }}>{formatValue(t.fee)}</td>
                                        <td style={{ padding: '10px 8px' }}>{formatValue(t.fundingFee || 0)}</td>
                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: isProfit ? '#26a69a' : '#ff4d4d' }}>
                                            {formatValue(t.netProfit)}
                                        </td>
                                        <td style={{ padding: '10px 8px', color: isProfit ? '#26a69a' : '#ff4d4d' }}>
                                            {formatValue(t.roe, '%')}
                                        </td>
                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: isProfit ? '#26a69a' : '#ff4d4d' }}>
                                            {formatValue(t.realRoe || t.roe, '%')}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{
                                                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', border: '1px solid #2b3139',
                                                color: (t.exitReason || '').includes('TP') ? '#26a69a' : ((t.exitReason || '').includes('SL') ? '#ff4d4d' : '#848e9c')
                                            }}>
                                                {t.exitReason || '전략'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>지정가</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="config-section" style={{ marginTop: '24px' }}>
                <h3 style={{ color: '#eaebed', fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>
                    1. Individual Chart Border Conditions (Check to Enable)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div>
                        <h4 style={{ color: '#26a69a', fontSize: '14px', fontWeight: '900', marginBottom: '20px' }}>LONG (GREEN BORDER)</h4>
                        {['5m', '1h', '1d'].map(iv => (
                            <div key={iv} className="interval-row" style={{ marginBottom: iv !== '1d' ? '20px' : '0' }}>
                                <span className="interval-tag" style={{ color: '#f3ba2f', fontSize: '14px', marginRight: '15px' }}>{iv}:</span>
                                <div className="cond-item">
                                    <input type="checkbox" checked={rules.long[iv].useAdx} onChange={e => handleRuleChange('long', iv, 'useAdx', e.target.checked)} />
                                    <span style={{ color: '#eaebed' }}>ADX &gt;</span>
                                    <input type="number" className="cond-input-small" value={rules.long[iv].adxThreshold} onChange={e => handleRuleChange('long', iv, 'adxThreshold', parseFloat(e.target.value))} />
                                    <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 8px' }}>AND</span>
                                </div>
                                <div className="cond-item">
                                    <input type="checkbox" checked={rules.long[iv].useMacdBeyondSig} onChange={e => handleRuleChange('long', iv, 'useMacdBeyondSig', e.target.checked)} />
                                    <span style={{ color: '#eaebed' }}>MACD &gt; Signal</span>
                                    <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 8px' }}>AND</span>
                                </div>
                                <div className="cond-item">
                                    <input type="checkbox" checked={rules.long[iv].useStochCross} onChange={e => handleRuleChange('long', iv, 'useStochCross', e.target.checked)} />
                                    <span style={{ color: '#eaebed' }}>Stoch D &lt; Stoch K</span>
                                    {(iv === '1d' || iv === '5m') && <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 8px' }}>AND</span>}
                                </div>
                                {iv === '1d' && (
                                    <div className="cond-item">
                                        <input type="checkbox" checked={rules.long[iv].useMacdSigDiff} onChange={e => handleRuleChange('long', iv, 'useMacdSigDiff', e.target.checked)} />
                                        <span style={{ color: '#eaebed' }}>|MACD-Sig| &gt;</span>
                                        <input type="number" className="cond-input-small" value={rules.long[iv].macdSigDiff} onChange={e => handleRuleChange('long', iv, 'macdSigDiff', parseFloat(e.target.value))} />
                                    </div>
                                )}
                                {iv === '5m' && (
                                    <div className="cond-item">
                                        <input type="checkbox" checked={rules.long[iv].useMacdVal} onChange={e => handleRuleChange('long', iv, 'useMacdVal', e.target.checked)} />
                                        <span style={{ color: '#eaebed' }}>MACD &lt;</span>
                                        <input type="number" className="cond-input-small" value={rules.long[iv].macdVal} onChange={e => handleRuleChange('long', iv, 'macdVal', parseFloat(e.target.value))} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div>
                        <h4 style={{ color: '#ff4d4d', fontSize: '14px', fontWeight: '900', marginBottom: '20px' }}>SHORT (RED BORDER)</h4>
                        {['5m', '1h', '1d'].map(iv => (
                            <div key={iv} className="interval-row" style={{ marginBottom: iv !== '1d' ? '20px' : '0' }}>
                                <span className="interval-tag" style={{ color: '#f3ba2f', fontSize: '14px', marginRight: '15px' }}>{iv}:</span>
                                <div className="cond-item">
                                    <input type="checkbox" checked={rules.short[iv].useAdx} onChange={e => handleRuleChange('short', iv, 'useAdx', e.target.checked)} />
                                    <span style={{ color: '#eaebed' }}>ADX &gt;</span>
                                    <input type="number" className="cond-input-small" value={rules.short[iv].adxThreshold} onChange={e => handleRuleChange('short', iv, 'adxThreshold', parseFloat(e.target.value))} />
                                    <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 8px' }}>AND</span>
                                </div>
                                <div className="cond-item">
                                    <input type="checkbox" checked={rules.short[iv].useMacdBeyondSig} onChange={e => handleRuleChange('short', iv, 'useMacdBeyondSig', e.target.checked)} />
                                    <span style={{ color: '#eaebed' }}>MACD &lt; Signal</span>
                                    <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 8px' }}>AND</span>
                                </div>
                                <div className="cond-item">
                                    <input type="checkbox" checked={rules.short[iv].useStochCross} onChange={e => handleRuleChange('short', iv, 'useStochCross', e.target.checked)} />
                                    <span style={{ color: '#eaebed' }}>Stoch D &gt; Stoch K</span>
                                    {(iv === '1d' || iv === '5m') && <span style={{ color: '#848e9c', fontWeight: 'bold', margin: '0 8px' }}>AND</span>}
                                </div>
                                {iv === '1d' && (
                                    <div className="cond-item">
                                        <input type="checkbox" checked={rules.short[iv].useMacdSigDiff} onChange={e => handleRuleChange('short', iv, 'useMacdSigDiff', e.target.checked)} />
                                        <span style={{ color: '#eaebed' }}>|MACD-Sig| &gt;</span>
                                        <input type="number" className="cond-input-small" value={rules.short[iv].macdSigDiff} onChange={e => handleRuleChange('short', iv, 'macdSigDiff', parseFloat(e.target.value))} />
                                    </div>
                                )}
                                {iv === '5m' && (
                                    <div className="cond-item">
                                        <input type="checkbox" checked={rules.short[iv].useMacdVal} onChange={e => handleRuleChange('short', iv, 'useMacdVal', e.target.checked)} />
                                        <span style={{ color: '#eaebed' }}>MACD &gt;</span>
                                        <input type="number" className="cond-input-small" value={rules.short[iv].macdVal} onChange={e => handleRuleChange('short', iv, 'macdVal', parseFloat(e.target.value))} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 2. Entry & Exit Strategy 섹션 */}
            <section className="config-section" style={{ marginTop: '24px' }}>
                <h3 style={{ color: '#eaebed', fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>
                    2. Entry & Exit Strategy (Order Execution)
                </h3>
                <div style={{ background: '#0b0e11', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="input-group">
                            <label style={{ color: '#f3ba2f' }}>Entry Wait Limit (min)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                                <input type="number" name="entryWaitMin" value={config.entryWaitMin || 60} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 진입 실패 처리</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ color: '#ff4d4d' }}>Exit Wait Limit (min)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e11', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                                <input type="number" name="exitWaitMin" value={config.exitWaitMin || 2000} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 시장가 청산 강제</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BacktestForm;
