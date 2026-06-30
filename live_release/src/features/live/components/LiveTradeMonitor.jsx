import React, { useState, useEffect } from 'react';
import { Shield, Zap, Power, AlertCircle, TrendingUp, Clock } from 'lucide-react';

const LiveTradeMonitor = ({ currentRules }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const resp = await fetch('http://localhost:3001/api/live-status');
            const data = await resp.json();
            setStatus(data);
        } catch (e) {
            console.error("Live status error", e);
        } finally {
            setLoading(false);
        }
    };

    const applyRulesToLive = async () => {
        if (!window.confirm("현재 설정된 규칙들을 실전 매매 엔진에 적용하시겠습니까?")) return;
        try {
            await fetch('http://localhost:3001/api/live-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: currentRules })
            });
            alert("전략이 실물 엔진에 성공적으로 전송되었습니다!");
        } catch (e) { alert("전송 실패"); }
    };

    useEffect(() => {
        const timer = setInterval(fetchStatus, 5000);
        fetchStatus();
        return () => clearInterval(timer);
    }, []);

    if (!status || status.status === 'OFFLINE') {
        return (
            <div className="live-monitor offline" style={{ padding: '20px', background: '#1c1c1c', borderRadius: '12px', border: '1px solid #333', marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#888' }}>
                    <Power size={20} />
                    <h3 style={{ margin: 0 }}>Live Trader: <span style={{ color: '#ff4d4d' }}>OFFLINE</span></h3>
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>서버에서 live_trader.cjs를 실행해 주세요.</p>
                <button onClick={applyRulesToLive} style={{ marginTop: '10px', padding: '8px 16px', background: '#f3ba2f', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Sync Logic to Live
                </button>
            </div>
        );
    }

    const isProfit = status.roe >= 0;

    return (
        <div className="live-monitor online" style={{ padding: '24px', background: '#0b0e11', borderRadius: '12px', border: '2px solid #f3ba2f', marginTop: '20px', boxShadow: '0 0 20px rgba(243, 186, 47, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={20} color="#f3ba2f" />
                    <h3 style={{ margin: 0, color: '#eaebed' }}>Live Trading Engine <span className="pulse-dot"></span></h3>
                </div>
                <span style={{ fontSize: '11px', color: '#848e9c' }}>Last Sync: {status.lastUpdate}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: '#161a1e', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '8px' }}>STATUS</div>
                    <div style={{ fontWeight: '900', color: status.status === 'IN_POSITION' ? '#f3ba2f' : '#26a69a' }}>
                        {status.status}
                    </div>
                </div>
                <div style={{ background: '#161a1e', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '8px' }}>POSITION</div>
                    <div style={{ fontWeight: '900', color: status.position === 'LONG' ? '#26a69a' : (status.position === 'SHORT' ? '#ef5350' : '#888') }}>
                        {status.position || 'NONE'}
                    </div>
                </div>
                {status.status === 'IN_POSITION' && (
                    <>
                        <div style={{ background: '#161a1e', padding: '15px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '8px' }}>LIVE ROE</div>
                            <div style={{ fontWeight: '900', fontSize: '20px', color: isProfit ? '#26a69a' : '#ef5350' }}>
                                {(status.pnl || 0).toFixed(2)}%
                            </div>
                        </div>
                        <div style={{ background: '#161a1e', padding: '15px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#848e9c', marginBottom: '8px' }}>ENTRY PRICE</div>
                            <div style={{ fontWeight: '900', color: '#eaebed' }}>{status.entryPrice}</div>
                        </div>
                    </>
                )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button onClick={applyRulesToLive} style={{ flex: 1, padding: '12px', background: '#f3ba2f', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Zap size={16} /> Update Live Logic
                </button>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .pulse-dot { width: 8px; height: 8px; background: #26a69a; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
            `}} />
        </div>
    );
};

export default LiveTradeMonitor;
