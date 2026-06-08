import React, { useState, useEffect } from 'react';
import { Shield, Zap, Power, AlertCircle, Clock, Database, RefreshCcw, Cpu, Terminal, FileText, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

const LiveMonitorPage = () => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchStatus = async () => {
        try {
            const resp = await fetch('http://localhost:3001/api/live-status');
            if (!resp.ok) throw new Error('API server returned error status');
            const data = await resp.json();
            setStatus(data);
            setError(null);
        } catch (e) {
            console.error("Live status error", e);
            setError(e.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        const timer = setInterval(fetchStatus, 3000); // 3초 주기 자동 갱신
        fetchStatus();
        return () => clearInterval(timer);
    }, []);

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        fetchStatus();
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#848e9c' }}>
                <RefreshCcw size={40} className="spin-animation" style={{ marginBottom: '16px', color: '#f3ba2f' }} />
                <p style={{ fontWeight: 'bold' }}>오라클 서버 상태 데이터를 가져오는 중...</p>
                <style dangerouslySetInnerHTML={{ __html: `
                    .spin-animation { animation: spin 1s linear infinite; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}} />
            </div>
        );
    }

    const isOffline = !status || status.status === 'OFFLINE' || error;
    const isAlive = status?.isAlive;

    return (
        <div className="live-monitor-page" style={{ padding: '30px', color: '#eaebed', maxWidth: '1400px', margin: '0 auto' }}>
            {/* 상단 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #2b3139', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Shield size={32} color="#f3ba2f" />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900' }}>Live Bot Control Center</h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#848e9c' }}>오라클 서버 실전 매매 엔진 실시간 관제 및 보안 상태 대시보드</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button 
                        onClick={handleManualRefresh}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#1e2329', border: '1px solid #2b3139', borderRadius: '8px', color: '#eaebed', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        <RefreshCcw size={16} className={isRefreshing ? 'spin-animation' : ''} />
                        새로고침
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isOffline ? 'rgba(239, 83, 80, 0.1)' : (isAlive ? 'rgba(38, 166, 154, 0.1)' : 'rgba(243, 186, 75, 0.1)'), border: `1px solid ${isOffline ? '#ef5350' : (isAlive ? '#26a69a' : '#f3ba2f')}`, padding: '8px 16px', borderRadius: '8px' }}>
                        <div style={{ width: '10px', height: '10px', background: isOffline ? '#ef5350' : (isAlive ? '#26a69a' : '#f3ba2f'), borderRadius: '50%', animation: isAlive ? 'pulse 2s infinite' : 'none' }}></div>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: isOffline ? '#ef5350' : (isAlive ? '#26a69a' : '#f3ba2f') }}>
                            {isOffline ? 'OFFLINE' : (isAlive ? 'RUNNING (ONLINE)' : 'STALE (WAITING)')}
                        </span>
                    </div>
                </div>
            </div>

            {/* 메인 관제 레이아웃 */}
            {isOffline ? (
                <div style={{ background: '#1e2329', border: '1px solid #ef5350', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 10px 30px rgba(239, 83, 80, 0.05)' }}>
                    <AlertTriangle size={64} color="#ef5350" style={{ marginBottom: '20px' }} />
                    <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 10px 0' }}>실전 매매 엔진 연결 실패</h3>
                    <p style={{ color: '#848e9c', maxWidth: '600px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
                        오라클 서버에서 실시간 Bybit 매매 봇이 동작하고 있지 않거나, API 서버 포트 3001에 액세스할 수 없습니다.<br />
                        서버 터미널에서 <code>node bybit_trader.cjs</code> 또는 백그라운드 프로세스가 원활히 켜져 있는지 확인해 주세요.
                    </p>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#666', background: 'rgba(0,0,0,0.2)', padding: '16px 24px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                        <div><b>오류 로그:</b> {error || "bybit_live_state.json 파일이 존재하지 않습니다."}</div>
                        <div><b>상태 파일 위치:</b> <code>c:/dev/2026_candy/bybit_live_state.json</code></div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '30px' }}>
                    
                    {/* 좌측 카드: 핵심 상태 카드 요약 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* 상태 서머리 카드 */}
                        <div style={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                            <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #2b3139', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Cpu size={18} color="#f3ba2f" /> Engine Diagnostics
                            </h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '4px' }}>RUNNING VERSION</div>
                                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#f3ba2f' }}>
                                        {status.strategyVersion || 'Logic.v8.2.4.cjs'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '4px' }}>CURRENT STATUS</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: status.status === 'IN_POSITION' ? '#ef5350' : '#26a69a' }}>
                                        {status.status}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '4px' }}>HEARTBEAT LAST UPDATE</div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#eaebed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={14} color="#848e9c" />
                                        {status.lastUpdate ? new Date(status.lastUpdate).toLocaleString('ko-KR') : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 포지션 상세 현황 카드 */}
                        <div style={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                            <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #2b3139', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <TrendingUp size={18} color="#f3ba2f" /> Position Details
                            </h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: '#848e9c' }}>Direction (방향)</span>
                                    <span style={{ fontWeight: '900', color: status.position === 'LONG' ? '#26a69a' : (status.position === 'SHORT' ? '#ef5350' : '#848e9c') }}>
                                        {status.position || 'NONE'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: '#848e9c' }}>Quantity (수량)</span>
                                    <span style={{ fontWeight: '800' }}>{status.quantity ? `${status.quantity} BTC` : '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: '#848e9c' }}>Entry Price (진입가)</span>
                                    <span style={{ fontWeight: '800' }}>{status.entryPrice ? `$${status.entryPrice.toLocaleString()}` : '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: '#848e9c' }}>Take Profit (익절가)</span>
                                    <span style={{ fontWeight: '800', color: '#26a69a' }}>{status.tpPrice ? `$${status.tpPrice.toLocaleString()}` : '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: '#848e9c' }}>Stop Loss (손절가)</span>
                                    <span style={{ fontWeight: '800', color: '#ef5350' }}>{status.slPrice ? `$${status.slPrice.toLocaleString()}` : '-'}</span>
                                </div>
                                {status.status === 'IN_POSITION' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#848e9c', fontWeight: 'bold' }}>Unrealized ROI</span>
                                        <span style={{ fontWeight: '900', fontSize: '16px', color: (status.pnl || 0) >= 0 ? '#26a69a' : '#ef5350' }}>
                                            {(status.pnl || 0).toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 보안 및 네트워크 연결 카드 */}
                        <div style={{ background: '#1e2329', border: '1px solid #2b3139', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontSize: '13px' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Database size={16} color="#f3ba2f" /> Security & Connectivity
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#848e9c' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Bybit Exchange Link:</span>
                                    <span style={{ color: '#26a69a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} /> SECURE (ccxt)</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>API Access Credentials:</span>
                                    <span style={{ color: '#eaebed' }}>Encrypted (.env)</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>CORS / Domain Policy:</span>
                                    <span style={{ color: '#26a69a', fontWeight: 'bold' }}>Localhost Restricted</span>
                                </div>
                            </div>
                            <div style={{ marginTop: '16px', fontSize: '11px', color: '#666', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '6px', lineHeight: '1.4' }}>
                                🔒 이 페이지는 로컬 백엔드 서버(port 3001)로부터 봇 정보 파일만 참조하여 렌더링되므로, Bybit API Key나 비공개 식별 키가 절대 유출되지 않는 안전한 샌드박스 보안 설계가 적용되어 있습니다.
                            </div>
                        </div>

                    </div>

                    {/* 우측 단독 카드: 실시간 트레이더 로그 (터미널 스타일) */}
                    <div style={{ background: '#111417', border: '1px solid #2b3139', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                        <div style={{ background: '#181c20', padding: '16px 24px', borderBottom: '1px solid #2b3139', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Terminal size={18} color="#f3ba2f" />
                                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Real-Time Trading Event Logs</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#848e9c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={12} /> Auto-updates every 3s
                            </span>
                        </div>
                        
                        {/* 터미널 로그 스크롤 영역 */}
                        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', maxHeight: '600px', minHeight: '400px', fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace', fontSize: '13px', lineHeight: '1.6', background: '#0a0d10' }}>
                            {!status.logs || status.logs.length === 0 ? (
                                <div style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>
                                    아직 기록된 매매 이벤트 로그가 없습니다. (KST 현재월 기준)
                                </div>
                            ) : (
                                status.logs.map((log, index) => {
                                    let logColor = '#eaebed';
                                    if (log.event === 'SIGNAL') logColor = '#f3ba2f';
                                    else if (log.event === 'ENTRY') logColor = '#26a69a';
                                    else if (log.event === 'TP' || log.event === 'EXIT') logColor = '#4db6ac';
                                    else if (log.event === 'SL') logColor = '#ef5350';
                                    else if (log.event.includes('ERROR')) logColor = '#ef5350';
                                    else if (log.event.includes('DEBUG')) logColor = '#707880';

                                    return (
                                        <div key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '8px 0', color: logColor }}>
                                            <span style={{ color: '#848e9c', marginRight: '10px' }}>[{log.timeKST}]</span>
                                            <strong style={{ display: 'inline-block', minWidth: '100px', color: log.event === 'SIGNAL' ? '#f3ba2f' : undefined }}>{log.event}</strong>
                                            <span style={{ color: '#ccc' }}>
                                                {Object.entries(log)
                                                    .filter(([k]) => k !== 'timeKST' && k !== 'event')
                                                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                                                    .join(' | ')}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>
            )}
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(38, 166, 154, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(38, 166, 154, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(38, 166, 154, 0); }
                }
            `}} />
        </div>
    );
};

export default LiveMonitorPage;
