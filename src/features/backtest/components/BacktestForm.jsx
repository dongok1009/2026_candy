import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity, FileCode, Play, Copy, RefreshCcw, Layers, Info, CheckCircle2, History, Save, Download, FileSpreadsheet } from 'lucide-react';
import { OFFICIAL_STRATEGIES } from '../../../shared/config/strategyConfigs';
import BacktestHistoryArchive from './BacktestHistoryArchive';
import './BacktestForm.css';
import './BacktestHistoryArchive.css';

const BacktestForm = () => {
    const API_BASE = "http://localhost:3001";
    const [config, setConfig] = useState({
        symbol: 'BTCUSDT',
        startDate: '2026-01-01T00:00',
        endDate: '2026-03-01T00:00',
        leverage: 5,
        initialBalance: 1000,
        makerFee: 0.0002,
        takerFee: 0.0005,
        exitMakerFee: 0.0002,
        fundingFee: 0.0001,
        targetRoi: 0.05,
        slRoi: 0.14,
        version: OFFICIAL_STRATEGIES[0].version,
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        stochP: 14,
        stochK: 3,
        stochD: 3,
        adxPeriod: 14,
        entryType: 'hybrid',
        entryWaitMin: 180,
        exitWaitMin: 1500,
        reduceTpWaitMin: 0,
        reducedTargetRoi: 0.02,
        penetrationRate: OFFICIAL_STRATEGIES[0].rules.penetrationRate !== undefined ? OFFICIAL_STRATEGIES[0].rules.penetrationRate : 0.001,
        entryMode: OFFICIAL_STRATEGIES[0].rules.entryMode || 'HYBRID_5M'
    });

    const [rules, setRules] = useState(() => {
        // OFFICIAL_STRATEGIES[0]이 아직 로드되지 않았을 경우의 예외 처리를 담아 정규화 적용
        return OFFICIAL_STRATEGIES[0] ? {
            long: OFFICIAL_STRATEGIES[0].rules.long || {},
            short: OFFICIAL_STRATEGIES[0].rules.short || {},
            global: OFFICIAL_STRATEGIES[0].rules.global || {}
        } : {};
    });
    const [activeDirectionTab, setActiveDirectionTab] = useState('long');
    const [history, setHistory] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const [recordedList, setRecordedList] = useState([]);
    const [selectedRecordId, setSelectedRecordId] = useState('');
    const [displayStats, setDisplayStats] = useState(null);
    const [latestResult, setLatestResult] = useState(null);
    const [resultsTrades, setResultsTrades] = useState([]);
    const [showIndicators, setShowIndicators] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    // 최적화 변수 상태값 정의 (콤마 구분자 형태 문자열 & boolean 배열)
    const [optParams, setOptParams] = useState({
        long: {
            m5_useADX: [true],
            m5_adxLow: '30',
            m5_adxHigh: '99',
            m5_useMacdBeyondSig: [false],
            m5_useStochCross: [true],
            m5_useStochKLimit: [true],
            m5_stochKThreshold: '75, 80',
            m5_useRSI: [false],
            m5_rsiLow: '5',
            m5_rsiHigh: '95',
            m5_useMacdVal: [false],
            m5_macdVal: '0',

            h1_useADX: [false],
            h1_adxLow: '30',
            h1_adxHigh: '99',
            h1_useMacdBeyondSig: [true],
            h1_useStochCross: [true],
            h1_useStochKLimit: [false],
            h1_stochKThreshold: '80',
            h1_useRSI: [false],
            h1_rsiLow: '5',
            h1_rsiHigh: '95',
            h1_useMacdVal: [false],
            h1_macdVal: '0',

            d1_useADX: [false],
            d1_adxLow: '15',
            d1_adxHigh: '99',
            d1_useMacdBeyondSig: [true],
            d1_useStochCross: [false],
            d1_useStochKLimit: [true],
            d1_stochKThreshold: '80',
            d1_useRSI: [false],
            d1_rsiLow: '5',
            d1_rsiHigh: '95',
            d1_useMacdVal: [false],
            d1_macdVal: '0'
        },
        short: {
            m5_useADX: [true],
            m5_adxLow: '30',
            m5_adxHigh: '99',
            m5_useMacdBeyondSig: [false],
            m5_useStochCross: [true],
            m5_useStochKLimit: [true],
            m5_stochKThreshold: '75, 80',
            m5_useRSI: [false],
            m5_rsiLow: '5',
            m5_rsiHigh: '95',
            m5_useMacdVal: [false],
            m5_macdVal: '0',

            h1_useADX: [false],
            h1_adxLow: '30',
            h1_adxHigh: '99',
            h1_useMacdBeyondSig: [true],
            h1_useStochCross: [true],
            h1_useStochKLimit: [false],
            h1_stochKThreshold: '80',
            h1_useRSI: [false],
            h1_rsiLow: '5',
            h1_rsiHigh: '95',
            h1_useMacdVal: [false],
            h1_macdVal: '0',

            d1_useADX: [false],
            d1_adxLow: '15',
            d1_adxHigh: '99',
            d1_useMacdBeyondSig: [true],
            d1_useStochCross: [false],
            d1_useStochKLimit: [true],
            d1_stochKThreshold: '80',
            d1_useRSI: [false],
            d1_rsiLow: '5',
            d1_rsiHigh: '95',
            d1_useMacdVal: [false],
            d1_macdVal: '0'
        },
        targetRoi: '0.03, 0.04',
        slRoi: '0.15'
    });
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optRankings, setOptRankings] = useState([]);

    const handleOptCheckboxChange = (side, key, val, checked) => {
        setOptParams(prev => {
            if (side === 'global') {
                const current = prev[key] || [];
                let next;
                if (checked) {
                    if (!current.includes(val)) next = [...current, val];
                    else next = current;
                } else {
                    next = current.filter(v => v !== val);
                }
                return { ...prev, [key]: next };
            } else {
                const current = prev[side][key] || [];
                let next;
                if (checked) {
                    if (!current.includes(val)) next = [...current, val];
                    else next = current;
                } else {
                    next = current.filter(v => v !== val);
                }
                return {
                    ...prev,
                    [side]: {
                        ...prev[side],
                        [key]: next
                    }
                };
            }
        });
    };

    useEffect(() => {
        const savedHistory = localStorage.getItem('backtest_history');
        if (savedHistory) setHistory(JSON.parse(savedHistory));
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            const resp = await fetch('http://localhost:3001/api/list-history');
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
            if (found) { 
                setRules(normalizeAndMapRules(found.rules)); 
                setDisplayStats(null); 
                // 해당 전략의 기본 대기 시간 및 신규 8.2.4 매개변수 로드
                if (found.rules.entryWaitMin) {
                    setConfig(prev => ({ 
                        ...prev, 
                        entryWaitMin: found.rules.entryWaitMin, 
                        exitWaitMin: found.rules.exitWaitMin,
                        penetrationRate: found.rules.penetrationRate !== undefined ? found.rules.penetrationRate : 0.001,
                        entryMode: found.rules.entryMode || 'HYBRID_5M'
                    }));
                } else {
                    setConfig(prev => ({
                        ...prev,
                        penetrationRate: found.rules.penetrationRate !== undefined ? found.rules.penetrationRate : 0.001,
                        entryMode: found.rules.entryMode || 'HYBRID_5M'
                    }));
                }
            }
            setResultsTrades([]); // 버전 전환 시 이전 결과 초기화
            setSelectedRecordId('');
        }
    };

    const normalizeAndMapRules = (rawRules) => {
        if (!rawRules) return null;
        
        const timeframes = ['5m', '1h', '1d'];
        const mapped = { long: {}, short: {} };

        const hasLongShort = rawRules.long && (rawRules.long['5m'] || rawRules.long.adxEnabled !== undefined || rawRules.long.useADX !== undefined);
        
        const mapTf = (srcTfRules, tf) => {
            if (!srcTfRules) srcTfRules = {};
            return {
                useADX: srcTfRules.adxEnabled !== undefined ? srcTfRules.adxEnabled : (srcTfRules.useADX !== undefined ? srcTfRules.useADX : false),
                adxLow: srcTfRules.adxLow !== undefined ? srcTfRules.adxLow : (srcTfRules.adxThreshold !== undefined ? srcTfRules.adxThreshold : (tf === '1d' ? 15 : 30)),
                adxHigh: srcTfRules.adxHigh !== undefined ? srcTfRules.adxHigh : 99,
                useMacdBeyondSig: srcTfRules.macdCrossEnabled !== undefined ? srcTfRules.macdCrossEnabled : (srcTfRules.useMacdBeyondSig !== undefined ? srcTfRules.useMacdBeyondSig : false),
                useStochCross: srcTfRules.stochCrossEnabled !== undefined ? srcTfRules.stochCrossEnabled : (srcTfRules.useStochCross !== undefined ? srcTfRules.useStochCross : false),
                useStochKLimit: srcTfRules.stochKLimitEnabled !== undefined ? srcTfRules.stochKLimitEnabled : (srcTfRules.useStochKLimit !== undefined ? srcTfRules.useStochKLimit : false),
                stochKThreshold: srcTfRules.stochKThreshold !== undefined ? srcTfRules.stochKThreshold : 80,
                useRSI: srcTfRules.rsiEnabled !== undefined ? srcTfRules.rsiEnabled : (srcTfRules.useRSI !== undefined ? srcTfRules.useRSI : false),
                rsiLow: srcTfRules.rsiLow !== undefined ? srcTfRules.rsiLow : 5,
                rsiHigh: srcTfRules.rsiHigh !== undefined ? srcTfRules.rsiHigh : 95,
                useMacdVal: srcTfRules.macdValueEnabled !== undefined ? srcTfRules.macdValueEnabled : (srcTfRules.useMacdVal !== undefined ? srcTfRules.useMacdVal : false),
                macdVal: srcTfRules.macdValue !== undefined ? srcTfRules.macdValue : (srcTfRules.macdVal !== undefined ? srcTfRules.macdVal : 0)
            };
        };

        if (hasLongShort) {
            timeframes.forEach(tf => {
                mapped.long[tf] = mapTf(rawRules.long[tf], tf);
                mapped.short[tf] = mapTf(rawRules.short[tf], tf);
            });
        } else {
            timeframes.forEach(tf => {
                const srcRules = rawRules[tf] || {};
                mapped.long[tf] = mapTf(srcRules, tf);
                mapped.short[tf] = mapTf({ ...srcRules }, tf);
            });
        }

        Object.keys(rawRules).forEach(k => {
            if (!timeframes.includes(k) && k !== 'long' && k !== 'short') {
                mapped[k] = rawRules[k];
            }
        });

        return mapped;
    };

    const handleRecordSelect = (e) => {
        const recordId = e.target.value;
        setSelectedRecordId(recordId);
        const record = recordedList.find(r => r.version === recordId);
        if (record) {
            setConfig(prev => ({ ...prev, ...record.config, version: record.baseVersion }));
            setDisplayStats(record.stats);
            // 저장된 거래 내역 불러오기
            setResultsTrades(record.tradesLog || []);
            setLatestResult(record); // 다운로드 경로(detailFile) 포함하여 상태 업데이트
            const baseStrategy = OFFICIAL_STRATEGIES.find(s => s.version === record.baseVersion);
            if (record.rules) setRules(normalizeAndMapRules(record.rules));
            else if (baseStrategy) setRules(normalizeAndMapRules(baseStrategy.rules));
        }
    };

    const handleRuleChange = (side, interval, field, value) => {
        const targetSide = side || activeDirectionTab;
        setRules(prev => ({
            ...prev,
            [targetSide]: {
                ...prev[targetSide],
                [interval]: {
                    ...prev[targetSide][interval],
                    [field]: value
                }
            }
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
            console.log("[BACKTEST RESULT]", result);

            if (result.success) {
                console.log("[BACKTEST SUCCESS] Received trades:", result.trades?.length);
                setLatestResult(result);
                // 실시간 거래 기록 상태 업데이트 (테이블용)
                setResultsTrades(result.trades || []);
                setSelectedRecordId(''); // 이전 기록 선택 상태 초기화 (새 결과 우선)
                
                setDisplayStats({
                    roi: `${result.roi}%`,
                    winRate: `${((result.wins / (result.wins + result.losses || 1)) * 100).toFixed(1)}%`,
                    mdd: result.mdd ? `${parseFloat(result.mdd).toFixed(2)}%` : '-',
                    trades: result.wins + result.losses,
                    wins: result.wins,
                    losses: result.losses,
                    period: `${config.startDate.replace('T', ' ')} ~ ${config.endDate.replace('T', ' ')}`,
                    initialBalance: config.initialBalance,
                    finalBalance: result.finalBalance || (config.initialBalance * (1 + result.roi / 100))
                });
                setHistory([{ id: Date.now(), timestamp: new Date().toLocaleString(), version: config.version, roi: `${result.roi}%` }, ...history].slice(0, 10));
                await fetchRecords();
            } else {
                alert(`백테스트 실패: ${result.error || '알 수 없는 오류'}`);
            }
        } catch (error) { alert("서버 실패"); }
        finally { setIsRunning(false); }
    };

    const handleVerify = async () => {
        setIsVerifying(true);
        try {
            const resp = await fetch('http://localhost:3001/api/verify', { method: 'POST' });
            const data = await resp.json();
            alert("--- LOGIC VERIFICATION RESULT ---\n\n" + data.output);
        } catch (err) {
            alert("검증 요청 중 오류가 발생했습니다: " + err.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleOptimize = async () => {
        setIsOptimizing(true);
        try {
            // Helper to parse strings to arrays of appropriate types
            const parseParam = (str, type = 'number') => {
                if (!str) return [];
                return str.split(',').map(s => {
                    const trimmed = s.trim();
                    if (type === 'boolean') {
                        return trimmed === 'true' || trimmed === '1';
                    }
                    return parseFloat(trimmed);
                }).filter(v => !isNaN(v) || type === 'boolean');
            };

            const buildSideSpace = (side) => {
                const sideParams = optParams[side];
                const prefixMap = { m5: 'm5_', h1: 'h1_', d1: 'd1_' };
                const space = {};
                
                ['m5', 'h1', 'd1'].forEach(tf => {
                    const prefix = prefixMap[tf];
                    space[`${prefix}useADX`] = sideParams[`${prefix}useADX`]?.length > 0 ? sideParams[`${prefix}useADX`] : [false];
                    space[`${prefix}adxLow`] = parseParam(sideParams[`${prefix}adxLow`] || '');
                    space[`${prefix}adxHigh`] = parseParam(sideParams[`${prefix}adxHigh`] || '');
                    space[`${prefix}useMacdBeyondSig`] = sideParams[`${prefix}useMacdBeyondSig`]?.length > 0 ? sideParams[`${prefix}useMacdBeyondSig`] : [false];
                    space[`${prefix}useStochCross`] = sideParams[`${prefix}useStochCross`]?.length > 0 ? sideParams[`${prefix}useStochCross`] : [false];
                    space[`${prefix}useStochKLimit`] = sideParams[`${prefix}useStochKLimit`]?.length > 0 ? sideParams[`${prefix}useStochKLimit`] : [false];
                    space[`${prefix}stochKLow`] = parseParam(sideParams[`${prefix}stochKLow`] || '');
                    space[`${prefix}stochKHigh`] = parseParam(sideParams[`${prefix}stochKHigh`] || '');
                    space[`${prefix}useRSI`] = sideParams[`${prefix}useRSI`]?.length > 0 ? sideParams[`${prefix}useRSI`] : [false];
                    space[`${prefix}rsiLow`] = parseParam(sideParams[`${prefix}rsiLow`] || '');
                    space[`${prefix}rsiHigh`] = parseParam(sideParams[`${prefix}rsiHigh`] || '');
                    space[`${prefix}useMacdVal`] = sideParams[`${prefix}useMacdVal`]?.length > 0 ? sideParams[`${prefix}useMacdVal`] : [false];
                    space[`${prefix}macdVal`] = parseParam(sideParams[`${prefix}macdVal`] || '');
                });
                return space;
            };

            const searchSpace = {
                long: buildSideSpace('long'),
                short: buildSideSpace('short'),
                targetRoi: parseParam(optParams.targetRoi),
                slRoi: parseParam(optParams.slRoi)
            };

            const globalConfig = {
                version: config.version,
                symbol: config.symbol,
                start: config.startDate.split('T')[0],
                end: config.endDate.split('T')[0],
                leverage: config.leverage,
                balance: config.initialBalance,
                entryWaitMin: config.entryWaitMin,
                exitWaitMin: config.exitWaitMin,
                reduceTpWaitMin: config.reduceTpWaitMin,
                reducedTargetRoi: config.reducedTargetRoi
            };

            console.log("[OPTIMIZE] Sending searchSpace:", searchSpace);

            const resp = await fetch('http://localhost:3001/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchSpace, globalConfig })
            });
            const data = await resp.json();
            if (data.success) {
                setOptRankings(data.rankings || []);
                alert("다차원 격자 최적화가 성공적으로 완료되었습니다! 하단에서 랭킹을 확인하세요.");
            } else {
                alert("최적화 실패: " + (data.error || "알 수 없는 오류"));
            }
        } catch (err) {
            alert("최적화 요청 중 서버 실패: " + err.message);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleLoadOptConfig = (rankItem) => {
        if (!rankItem || !rankItem.config || !rankItem.rules) return;
        
        // 메인 config와 rules 상태 덮어쓰기
        setConfig(prev => ({
            ...prev,
            ...rankItem.config,
            targetRoi: rankItem.config.targetRoi,
            slRoi: rankItem.config.slRoi ?? prev.slRoi
        }));
        
        setRules(normalizeAndMapRules(rankItem.rules));
        alert(`선택하신 파라미터 조합이 대시보드 폼에 성공적으로 적용되었습니다!\n- 수익률: ${rankItem.stats.roi} | MDD: ${rankItem.stats.mdd}%`);
    };

    const handleRecord = async () => {
        if (!latestResult) return;
        try {
            const response = await fetch('http://localhost:3001/api/save-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseVersion: config.version, config, rules, result: latestResult })
            });
            const data = await response.json();
            if (data.success) { 
                alert(`저장 성공: ${data.newVersion}`); 
                await fetchRecords(); // 목록 먼저 갱신
                setSelectedRecordId(data.newVersion); // 새 버전으로 자동 선택
            } else {
                alert(`저장 실패: ${data.error || '알 수 없는 오류'}`);
            }
        } catch (err) { 
            console.error("[RECORD SAVE ERR]", err);
            alert(`저장 버튼 작동 실패: ${err.message}`); 
        }
    };

    const handleDeleteRecord = async (version) => {
        if (!version) return;
        console.log("-> handleDeleteRecord START:", version);
        
        try {
            console.log("-> Fetching delete API...");
            const resp = await fetch(`${API_BASE}/api/delete-history`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version })
            });
            
            const data = await resp.json();
            console.log("-> Server response:", data);
            
            if (data.success) {
                alert('삭제 완료되었습니다.');
                await fetchRecords();
                if (selectedRecordId === version) setSelectedRecordId('');
            } else {
                alert(`오류: ${data.error}`);
            }
        } catch (err) { 
            console.error("-> DELETE FATAL ERROR:", err);
            alert(`시스템 오류: ${err.message}`); 
        }
    };

    // [VALIDATION] 통합 검증 마스터 파일 다운로드
    const handleDownloadValidation = () => {
        if (!latestResult?.validationFile) {
            alert("검증용 마스터 파일이 존재하지 않습니다.");
            return;
        }
        const safeFile = encodeURIComponent(latestResult.validationFile);
        window.location.href = `http://localhost:3001/api/download?file=${safeFile}`;
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
            formatted = absVal.toFixed(3);
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

    const renderOptIntervalCards = (side) => {
        const isLong = side === 'long';
        const sideColor = isLong ? '#26a69a' : '#ef5350';
        const sideText = isLong ? 'LONG' : 'SHORT';
        const sideParams = optParams[side] || {};

        const tfs = [
            { id: 'm5', label: '5m' },
            { id: 'h1', label: '1h' },
            { id: 'd1', label: '1d' }
        ];

        return (
            <div key={`opt-${side}`} style={{ marginBottom: '24px' }}>
                <h4 style={{ color: sideColor, fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0', borderLeft: `4px solid ${sideColor}`, paddingLeft: '10px' }}>
                    {sideText} OPTIMIZATION SPACE
                </h4>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {tfs.map(({ id, label }) => {
                        const getChecked = (key, val) => (sideParams[`${id}_${key}`] || []).includes(val);
                        const getValue = (key) => sideParams[`${id}_${key}`] || '';
                        const handleTextChange = (key, val) => {
                            setOptParams(prev => ({
                                ...prev,
                                [side]: {
                                    ...prev[side],
                                    [`${id}_${key}`]: val
                                }
                            }));
                        };

                        return (
                            <div key={`opt-${side}-${id}`} style={{ background: '#1e2329', padding: '16px', borderRadius: '8px', border: '1px solid #2b3139', flex: '1', minWidth: '280px' }}>
                                <h5 style={{ color: sideColor, fontSize: '14px', fontWeight: 'bold', margin: '0 0 14px 0' }}>{label} Timeframe</h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* ADX */}
                                    <div style={{ borderBottom: '1px solid #2b3139', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '12px', color: '#eaebed', fontWeight: 'bold', width: '105px', flexShrink: 0 }}>Use ADX:</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useADX', true)} onChange={e => handleOptCheckboxChange(side, `${id}_useADX`, true, e.target.checked)} /> True
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useADX', false)} onChange={e => handleOptCheckboxChange(side, `${id}_useADX`, false, e.target.checked)} /> False
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input type="text" placeholder="Low (e.g. 30)" value={getValue('adxLow')} onChange={e => handleTextChange('adxLow', e.target.value)} style={{ width: '45%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                            <span style={{ color: '#848e9c', fontSize: '11px' }}>~</span>
                                            <input type="text" placeholder="High (e.g. 99)" value={getValue('adxHigh')} onChange={e => handleTextChange('adxHigh', e.target.value)} style={{ width: '45%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                        </div>
                                    </div>

                                    {/* Stoch K Limit */}
                                    <div style={{ borderBottom: '1px solid #2b3139', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '12px', color: '#eaebed', fontWeight: 'bold', width: '105px', flexShrink: 0 }}>StochK Limit:</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useStochKLimit', true)} onChange={e => handleOptCheckboxChange(side, `${id}_useStochKLimit`, true, e.target.checked)} /> True
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useStochKLimit', false)} onChange={e => handleOptCheckboxChange(side, `${id}_useStochKLimit`, false, e.target.checked)} /> False
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input type="text" placeholder="Lows (e.g. 0)" value={getValue('stochKLow')} onChange={e => handleTextChange('stochKLow', e.target.value)} style={{ width: '45%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                            <span style={{ color: '#848e9c', fontSize: '11px' }}>~</span>
                                            <input type="text" placeholder="Highs (e.g. 99)" value={getValue('stochKHigh')} onChange={e => handleTextChange('stochKHigh', e.target.value)} style={{ width: '45%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                        </div>
                                    </div>

                                    {/* RSI */}
                                    <div style={{ borderBottom: '1px solid #2b3139', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '12px', color: '#eaebed', fontWeight: 'bold', width: '105px', flexShrink: 0 }}>Use RSI:</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useRSI', true)} onChange={e => handleOptCheckboxChange(side, `${id}_useRSI`, true, e.target.checked)} /> True
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useRSI', false)} onChange={e => handleOptCheckboxChange(side, `${id}_useRSI`, false, e.target.checked)} /> False
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input type="text" placeholder="Low (e.g. 5)" value={getValue('rsiLow')} onChange={e => handleTextChange('rsiLow', e.target.value)} style={{ width: '45%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                            <span style={{ color: '#848e9c', fontSize: '11px' }}>~</span>
                                            <input type="text" placeholder="High (e.g. 95)" value={getValue('rsiHigh')} onChange={e => handleTextChange('rsiHigh', e.target.value)} style={{ width: '45%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                        </div>
                                    </div>

                                    {/* MACD Value */}
                                    <div style={{ borderBottom: '1px solid #2b3139', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '12px', color: '#eaebed', fontWeight: 'bold', width: '105px', flexShrink: 0 }}>|MACD| &lt;:</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useMacdVal', true)} onChange={e => handleOptCheckboxChange(side, `${id}_useMacdVal`, true, e.target.checked)} /> True
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" checked={getChecked('useMacdVal', false)} onChange={e => handleOptCheckboxChange(side, `${id}_useMacdVal`, false, e.target.checked)} /> False
                                            </label>
                                        </div>
                                        <input type="text" placeholder="Threshold (e.g. 0)" value={getValue('macdVal')} onChange={e => handleTextChange('macdVal', e.target.value)} style={{ width: '95%', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '11px' }} />
                                    </div>

                                    {/* MACD Cross */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #2b3139', paddingBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', color: '#eaebed', fontWeight: 'bold', width: '105px', flexShrink: 0 }}>MACD Cross:</span>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                            <input type="checkbox" checked={getChecked('useMacdBeyondSig', true)} onChange={e => handleOptCheckboxChange(side, `${id}_useMacdBeyondSig`, true, e.target.checked)} /> True
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                            <input type="checkbox" checked={getChecked('useMacdBeyondSig', false)} onChange={e => handleOptCheckboxChange(side, `${id}_useMacdBeyondSig`, false, e.target.checked)} /> False
                                        </label>
                                    </div>

                                    {/* Stoch Cross */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: '#eaebed', fontWeight: 'bold', width: '105px', flexShrink: 0 }}>Stoch Cross:</span>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                            <input type="checkbox" checked={getChecked('useStochCross', true)} onChange={e => handleOptCheckboxChange(side, `${id}_useStochCross`, true, e.target.checked)} /> True
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#848e9c', cursor: 'pointer', margin: 0 }}>
                                            <input type="checkbox" checked={getChecked('useStochCross', false)} onChange={e => handleOptCheckboxChange(side, `${id}_useStochCross`, false, e.target.checked)} /> False
                                        </label>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };


    // 백테스트 결과가 있거나 기록을 선택한 경우에는 비어있더라도 실제 결과를 보여주고, 초기 상태에서만 샘플을 보여줌
    const isShowingRealResult = latestResult !== null || selectedRecordId !== '';
    const tradesLog = isShowingRealResult ? resultsTrades : (OFFICIAL_STRATEGIES.find(s => s.version === config.version)?.tradesLog || []);

    // CSV/Excel 내보내기 로직 (Base64 방식 - 호환성 극대화)
    const handleExportCSV = (isExcel = false) => {
        if (!tradesLog || tradesLog.length === 0) {
            alert("내보낼 데이터가 없습니다.");
            return;
        }
        
        const baseHeaders = ["#", "진입(KST)", "청산(KST)", "시간(분)", "방향", "진입가", "청산가", "수량", "LEV", "수수료", "펀딩피", "순수익", "잔액", "누적ROI", "ROE", "실질ROE", "청산", "주문"];
        const indicatorHeaders = [
            "5M StochK", "5M StochD", "5M ADX", "5M RSI",
            "1H MACD", "1H Signal", "1H StochK", "1H StochD", "1H ADX", "1H RSI",
            "1D MACD", "1D Signal", "1D ADX", "1D RSI"
        ];
        const headers = showIndicators ? [...baseHeaders, ...indicatorHeaders] : baseHeaders;

        const rows = tradesLog.map((t, idx) => {
            const baseRow = [
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
                t.balance,
                `${((parseFloat(t.balance) / config.initialBalance - 1) * 100).toFixed(3)}%`,
                t.roe,
                t.realRoe || t.roe,
                t.exitReason || '전략',
                "지정가"
            ];
            const indicatorRow = [
                t.m5_stochK || '-', t.m5_stochD || '-', t.m5_adx || '-', t.m5_rsi || '-',
                t.h1_macd || '-', t.h1_macdSig || '-', t.h1_stochK || '-', t.h1_stochD || '-', t.h1_adx || '-', t.h1_rsi || '-',
                t.d1_macd || '-', t.d1_macdSig || '-', t.d1_adx || '-', t.d1_rsi || '-'
            ];
            return showIndicators ? [...baseRow, ...indicatorRow] : baseRow;
        });

        // BOM 추가하여 엑셀 한글 깨짐 방지
        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
        const exportVersion = (selectedRecordId || config.version).replace(/_/g, '.');
        const fileName = `backtest_summary_${exportVersion}_${new Date().getTime()}.csv`;
        
        const link = document.createElement("a");
        // Base64 인코딩을 통한 데이터 주입
        const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 1분 지표 CSV 다운로드 (서버 파일 연동)
    const handleDownloadDetailed = () => {
        if (!latestResult?.detailFile) {
            alert("백테스트 실행 후에만 상세 지표 다운로드가 가능합니다.");
            return;
        }
        const safeFile = encodeURIComponent(latestResult.detailFile);
        const downloadUrl = `${API_BASE}/api/download?file=${safeFile}`;
        
        console.log("[DOWNLOAD] Triggering download for:", downloadUrl);
        // 가장 강력한 방식: 페이지의 location을 직접 이동 (브라우저가 파일임을 감지하면 즉시 다운로드 창 띄움)
        window.location.href = downloadUrl;
    };

    const activeStats = displayStats || OFFICIAL_STRATEGIES.find(s => s.version === config.version)?.stats;

    return (
        <div className="backtest-container">
            <header className="backtest-header">
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ margin: 0 }}><Layers /> Backtest Dashboard</h2>
                        <span style={{ fontSize: '11px', color: '#f3ba2f', opacity: 0.8, marginLeft: '32px' }}>System Version: UI.v7.0.2</span>
                    </div>
                    <select name="version" value={config.version} onChange={handleChange} className="header-select" style={{ minWidth: '220px', background: '#1e2329', color: '#f3ba2f', borderColor: '#f3ba2f' }}>
                        {OFFICIAL_STRATEGIES.map(s => <option key={s.version} value={s.version}>{s.name}</option>)}
                    </select>
                    <div style={{ position: 'relative' }}>
                        <select value={selectedRecordId} onChange={handleRecordSelect} className="header-select" style={{ minWidth: '220px', borderColor: '#26a69a', color: '#26a69a' }}>
                            <option value="">-- Load Result History --</option>
                            {recordedList.map(r => <option key={r.version} value={r.version}>{r.version} | ROI: {r.stats.roi}</option>)}
                        </select>
                    </div>
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
                        <button 
                            className="verify-button" 
                            onClick={handleVerify} 
                            disabled={isVerifying}
                            style={{ 
                                background: '#673ab7', 
                                color: 'white', 
                                padding: '10px 16px', 
                                borderRadius: '8px', 
                                border: 'none', 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                opacity: isVerifying ? 0.6 : 1
                            }}
                        >
                            {isVerifying ? <RefreshCcw size={18} className="spin" /> : <FileCode size={18} />}
                            {isVerifying ? 'Verifying...' : 'Verify Rules'}
                        </button>
                        <button className="copy-button" onClick={handleCopy}>
                            {copySuccess ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                            {copySuccess ? 'Copied' : 'Copy'}
                        </button>
                        <button className="save-button" style={{ marginLeft: 'auto', opacity: latestResult ? 1 : 0.4 }} onClick={handleRecord} disabled={!latestResult}>
                            <Save size={18} /> Record Result
                        </button>
                        {latestResult?.validationFile && (
                            <button className="download-val-button" onClick={handleDownloadValidation} style={{ background: '#673ab7', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileCode size={18} /> Audit Report (1m)
                            </button>
                        )}
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
                    <div className="stats-dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
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

                        {/* MDD Card */}
                        <div style={{ background: '#0b0e11', padding: '15px', borderRadius: '12px', border: '1px solid #2b3139', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#848e9c', marginBottom: '8px' }}>MAX DRAWDOWN (MDD)</div>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: '#ff4d4d' }}>{activeStats.mdd || '-'}</div>
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

            <section className="config-section" style={{ marginTop: '24px' }}>
                <h3 style={{ color: '#eaebed', fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>
                    1. Individual Chart Border Conditions (Check to Enable)
                </h3>
                
                {/* 2번에서 이동한 익절률, 손절률 및 글로벌 매개변수 입력 필드 */}
                <div style={{ background: '#0b0e11', padding: '20px', borderRadius: '12px', border: '1px solid #2b3139', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="input-group">
                        <label style={{ color: '#26a69a', fontSize: '13px', fontWeight: 'bold' }}>Target ROI (Decimal, e.g. 0.03 = 3%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" step="0.005" name="targetRoi" value={config.targetRoi} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>목표 수익률 (Net ROI)</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#ef5350', fontSize: '13px', fontWeight: 'bold' }}>Stop Loss ROI (Decimal, e.g. 0.15 = 15%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" step="0.001" name="slRoi" value={config.slRoi} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>최대 허용 손실률</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#f3ba2f', fontSize: '13px', fontWeight: 'bold' }}>Entry Wait Limit (min)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" name="entryWaitMin" value={config.entryWaitMin || 60} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 진입 실패 처리</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#ff4d4d', fontSize: '13px', fontWeight: 'bold' }}>Exit Wait Limit (min)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" name="exitWaitMin" value={config.exitWaitMin || 2000} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>분 대기 후 시장가 청산 강제</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#f3ba2f', fontSize: '13px', fontWeight: 'bold' }}>Reduce TP Wait Time (min, 0 to disable)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" name="reduceTpWaitMin" value={config.reduceTpWaitMin ?? 60} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>분 뒤 익절 하향 (0이면 비활성)</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#26a69a', fontSize: '13px', fontWeight: 'bold' }}>Reduced Target ROI (Decimal, e.g. 0.01 = 1%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" step="0.005" name="reducedTargetRoi" value={config.reducedTargetRoi ?? 0.01} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>조정된 목표 수익률 (Net ROI)</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#f3ba2f', fontSize: '13px', fontWeight: 'bold' }}>Penetration Rate (Decimal, e.g. 0.001 = 0.1%)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <input type="number" step="0.0001" name="penetrationRate" value={config.penetrationRate ?? 0.001} onChange={handleChange} style={{ width: '120px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '16px', fontWeight: '800', outline: 'none' }} />
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>목표가 돌파 비율 (지정가 보수화)</span>
                        </div>
                    </div>
                    <div className="input-group">
                        <label style={{ color: '#26a69a', fontSize: '13px', fontWeight: 'bold' }}>Entry Mode (진입 방식)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e2329', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <select name="entryMode" value={config.entryMode ?? 'HYBRID_5M'} onChange={handleChange} style={{ width: 'auto', minWidth: '320px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '15px', fontWeight: '800', outline: 'none', cursor: 'pointer', paddingRight: '20px' }}>
                                <option value="MARKET" style={{ background: '#1e2329', color: '#eaebed' }}>MARKET (시장가)</option>
                                <option value="HYBRID_5M" style={{ background: '#1e2329', color: '#eaebed' }}>HYBRID_5M (5분봉기준 유리한 가격)</option>
                                <option value="HYBRID_10M" style={{ background: '#1e2329', color: '#eaebed' }}>HYBRID_10M (10분봉기준 유리한 가격)</option>
                                <option value="HYBRID_15M" style={{ background: '#1e2329', color: '#eaebed' }}>HYBRID_15M (15분봉기준 유리한 가격)</option>
                            </select>
                            <span style={{ color: '#848e9c', fontSize: '12px' }}>진입 기준 가격 옵션</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* LONG CONDITIONS */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h4 style={{ color: '#26a69a', fontSize: '14px', fontWeight: '900', margin: 0, borderLeft: '4px solid #26a69a', paddingLeft: '10px' }}>LONG CONDITIONS</h4>
                            <button 
                                onClick={() => {
                                    if (window.confirm('롱 설정을 숏 설정에 그대로 복사하시겠습니까?')) {
                                        ['5m', '1h', '1d'].forEach(tf => {
                                            Object.keys(rules.long[tf] || {}).forEach(key => {
                                                handleRuleChange('short', tf, key, rules.long[tf][key]);
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
                                const targetRules = rules.long || {};
                                return (
                                    <div key={`long-${iv}`} style={{ background: '#1e2329', padding: '16px', borderRadius: '8px', border: '1px solid #2b3139', flex: '1', minWidth: '260px' }}>
                                        <h5 style={{ color: '#26a69a', fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0' }}>{iv}:</h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {/* ADX Range */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useADX} onChange={e => handleRuleChange('long', iv, 'useADX', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>ADX</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxLow ?? 30} onChange={e => handleRuleChange('long', iv, 'adxLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; ADX &lt;</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxHigh ?? 99} onChange={e => handleRuleChange('long', iv, 'adxHigh', parseFloat(e.target.value))} />
                                            </div>

                                            {/* Stoch K Limit */}
                                            {(targetRules[iv]?.stochKThreshold !== undefined || targetRules[iv]?.stochKHigh !== undefined) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useStochKLimit} onChange={e => handleRuleChange('long', iv, 'useStochKLimit', e.target.checked)} />
                                                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>StochK</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKLow ?? 0} onChange={e => handleRuleChange('long', iv, 'stochKLow', parseFloat(e.target.value))} />
                                                    <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; StochK &lt;</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKHigh ?? (targetRules[iv]?.stochKThreshold || 99)} onChange={e => handleRuleChange('long', iv, 'stochKHigh', parseFloat(e.target.value))} />
                                                </div>
                                            )}

                                            {/* RSI Limit */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useRSI} onChange={e => handleRuleChange('long', iv, 'useRSI', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>RSI</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.rsiLow ?? 5} onChange={e => handleRuleChange('long', iv, 'rsiLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; RSI &lt;</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.rsiHigh ?? 95} onChange={e => handleRuleChange('long', iv, 'rsiHigh', parseFloat(e.target.value))} />
                                            </div>

                                            {/* MACD Value */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useMacdVal} onChange={e => handleRuleChange('long', iv, 'useMacdVal', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>|MACD| &lt;</span>
                                                <input type="number" style={{ width: '60px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.macdVal ?? 0} onChange={e => handleRuleChange('long', iv, 'macdVal', parseFloat(e.target.value))} />
                                            </div>

                                            {/* MACD Cross */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useMacdBeyondSig} onChange={e => handleRuleChange('long', iv, 'useMacdBeyondSig', e.target.checked)} />
                                                <span style={{ color: '#eaebed', fontSize: '12px', marginLeft: '5px' }}>MACD Cross (Long: &gt;)</span>
                                            </div>

                                            {/* Stoch Cross */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useStochCross} onChange={e => handleRuleChange('long', iv, 'useStochCross', e.target.checked)} />
                                                <span style={{ color: '#eaebed', fontSize: '12px', marginLeft: '5px' }}>Stoch Cross (Long: K &gt; D)</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SHORT CONDITIONS */}
                    <div style={{ marginTop: '10px' }}>
                        <h4 style={{ color: '#ef5350', fontSize: '14px', fontWeight: '900', marginBottom: '20px', borderLeft: '4px solid #ef5350', paddingLeft: '10px' }}>SHORT CONDITIONS</h4>

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
                                const targetRules = rules.short || {};
                                return (
                                    <div key={`short-${iv}`} style={{ background: '#1e2329', padding: '16px', borderRadius: '8px', border: '1px solid #2b3139', flex: '1', minWidth: '260px' }}>
                                        <h5 style={{ color: '#ef5350', fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0' }}>{iv}:</h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {/* ADX Range */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useADX} onChange={e => handleRuleChange('short', iv, 'useADX', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>ADX</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxLow ?? 30} onChange={e => handleRuleChange('short', iv, 'adxLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; ADX &lt;</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxHigh ?? 99} onChange={e => handleRuleChange('short', iv, 'adxHigh', parseFloat(e.target.value))} />
                                            </div>

                                            {/* Stoch K Limit */}
                                            {(targetRules[iv]?.stochKThreshold !== undefined || targetRules[iv]?.stochKHigh !== undefined) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useStochKLimit} onChange={e => handleRuleChange('short', iv, 'useStochKLimit', e.target.checked)} />
                                                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>StochK</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKLow ?? 0} onChange={e => handleRuleChange('short', iv, 'stochKLow', parseFloat(e.target.value))} />
                                                    <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; StochK &lt;</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKHigh ?? (targetRules[iv]?.stochKThreshold || 99)} onChange={e => handleRuleChange('short', iv, 'stochKHigh', parseFloat(e.target.value))} />
                                                </div>
                                            )}

                                            {/* RSI Limit */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useRSI} onChange={e => handleRuleChange('short', iv, 'useRSI', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>RSI</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.rsiLow ?? 5} onChange={e => handleRuleChange('short', iv, 'rsiLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', width: '85px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; RSI &lt;</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.rsiHigh ?? 95} onChange={e => handleRuleChange('short', iv, 'rsiHigh', parseFloat(e.target.value))} />
                                            </div>

                                            {/* MACD Value */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useMacdVal} onChange={e => handleRuleChange('short', iv, 'useMacdVal', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>|MACD| &lt;</span>
                                                <input type="number" style={{ width: '60px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.macdVal ?? 0} onChange={e => handleRuleChange('short', iv, 'macdVal', parseFloat(e.target.value))} />
                                            </div>

                                            {/* MACD Cross */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useMacdBeyondSig} onChange={e => handleRuleChange('short', iv, 'useMacdBeyondSig', e.target.checked)} />
                                                <span style={{ color: '#eaebed', fontSize: '12px', marginLeft: '5px' }}>MACD Cross (Short: &lt;)</span>
                                            </div>

                                            {/* Stoch Cross */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useStochCross} onChange={e => handleRuleChange('short', iv, 'useStochCross', e.target.checked)} />
                                                <span style={{ color: '#eaebed', fontSize: '12px', marginLeft: '5px' }}>Stoch Cross (Short: K &lt; D)</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>



            {/* 3. 전략 다차원 최적화 (Parameter Optimization Grid) 섹션 */}
            <section className="config-section" style={{ marginTop: '24px' }}>
                <h3 style={{ color: '#eaebed', fontSize: '16px', fontWeight: '800', marginBottom: '24px' }}>
                    3. Strategy Parameter Optimization Grid (Grid Search)
                </h3>
                <div style={{ background: '#0b0e11', padding: '24px', borderRadius: '12px', border: '1px solid #2b3139' }}>
                    <p style={{ color: '#848e9c', fontSize: '12px', marginTop: '0', marginBottom: '20px' }}>
                        탐색할 지표들의 기준값을 콤마(<code>,</code>)로 구분하여 여러 개 나열하면, 최적화 에이전트가 모든 조합 경우의 수를 자동 시뮬레이션합니다. (예: <code>30, 35</code>)<br />
                        True/False 선택 체크박스는 둘 다 체크할 경우 켰을 때와 껐을 때(True/False) 둘 다 탐색 범위에 포함하여 시뮬레이션합니다.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* 롱 조건 최적화 공간 */}
                        {renderOptIntervalCards('long')}

                        {/* 숏 조건 최적화 공간 */}
                        {renderOptIntervalCards('short')}

                        {/* 글로벌 스페이스 */}
                        <div style={{ background: '#1e2329', padding: '14px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            <h4 style={{ color: '#eaebed', fontSize: '13px', margin: '0 0 14px 0', borderBottom: '1px solid #2b3139', paddingBottom: '6px' }}>Global Space</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '10px', color: '#848e9c' }}>Target ROI (Decimal: 0.03, 0.04)</label>
                                    <input type="text" value={optParams.targetRoi} onChange={e => setOptParams(prev => ({ ...prev, targetRoi: e.target.value }))} style={{ background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '6px', borderRadius: '4px', width: '100%', fontSize: '12px' }} />
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '10px', color: '#848e9c' }}>Stop Loss ROI (Decimal: 0.12, 0.15)</label>
                                    <input type="text" value={optParams.slRoi} onChange={e => setOptParams(prev => ({ ...prev, slRoi: e.target.value }))} style={{ background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '6px', borderRadius: '4px', width: '100%', fontSize: '12px' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-start' }}>
                        <button className={`run-button ${isOptimizing ? 'running' : ''}`} onClick={handleOptimize} disabled={isOptimizing} style={{ background: '#f3ba2f', color: '#0b0e11', fontWeight: '900', padding: '12px 24px' }}>
                            {isOptimizing ? <RefreshCcw size={18} className="spin" /> : <Play size={18} />}
                            {isOptimizing ? 'Analyzing Grid Combinations...' : 'Run Optimization Grid'}
                        </button>
                    </div>

                    {/* Rankings Table */}
                    {optRankings.length > 0 && (
                        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
                            <h4 style={{ color: '#eaebed', fontSize: '14px', fontWeight: '800', margin: '0 0 16px 0' }}>🏆 Optimization Strategy Performance Rankings</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', background: '#1e2329', border: '1px solid #2b3139', borderRadius: '8px' }}>
                                <thead>
                                    <tr style={{ background: '#0b0e11', color: '#848e9c', textAlign: 'left', borderBottom: '1px solid #2b3139' }}>
                                        <th style={{ padding: '12px 10px' }}>Rank</th>
                                        <th style={{ padding: '12px 10px' }}>Config Name</th>
                                        <th style={{ padding: '12px 10px', color: '#26a69a' }}>ROI</th>
                                        <th style={{ padding: '12px 10px' }}>Win Rate</th>
                                        <th style={{ padding: '12px 10px', color: '#ff4d4d' }}>MDD</th>
                                        <th style={{ padding: '12px 10px' }}>Trades</th>
                                        <th style={{ padding: '12px 10px', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {optRankings.map((r, idx) => (
                                        <tr key={r.filename} style={{ borderBottom: '1px solid #2b3139' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{idx + 1}</td>
                                            <td style={{ padding: '10px', color: '#f3ba2f' }}>{r.filename.replace('.json', '')}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#26a69a' }}>{r.stats.roi}%</td>
                                            <td style={{ padding: '10px' }}>{r.stats.winRate}</td>
                                            <td style={{ padding: '10px', color: '#ff4d4d' }}>{r.stats.mdd}%</td>
                                            <td style={{ padding: '10px' }}>{r.stats.trades}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <button onClick={() => handleLoadOptConfig(r)} style={{ background: '#26a69a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '10px' }}>
                                                    Apply to Dashboard
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            <section className="config-section" style={{ marginTop: '24px', padding: '0', background: 'transparent', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '700', color: '#eaebed' }}>거래 내역</span>
                        <span style={{ fontSize: '12px', color: '#848e9c', marginTop: '4px' }}>
                            {isShowingRealResult ? `[결과 데이터: ${tradesLog.length}건]` : `[공식 샘플: ${tradesLog.length}건]`}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '10px' }}>
                            <input 
                                type="checkbox" 
                                id="show-values" 
                                checked={showIndicators}
                                onChange={e => setShowIndicators(e.target.checked)}
                            />
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
                                <th style={{ padding: '12px 8px', minWidth: '85px' }}>순수익</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f', minWidth: '95px' }}>잔액</th>
                                <th style={{ padding: '12px 8px', color: '#26a69a', minWidth: '110px' }}>누적 ROI</th>
                                <th style={{ padding: '12px 8px', minWidth: '90px' }}>ROE</th>
                                <th style={{ padding: '12px 8px', minWidth: '100px' }}>실질ROE</th>
                                <th style={{ padding: '12px 8px' }}>청산</th>
                                <th style={{ padding: '12px 8px' }}>주문</th>
                                {showIndicators && (
                                    <>
                                        {/* 5M Group */}
                                        <th style={{ padding: '12px 8px', color: '#f3ba2f', borderLeft: '1px solid #2b3139' }}>5M StochK</th>
                                        <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M StochD</th>
                                        <th style={{ padding: '12px 8px', color: '#848e9c' }}>5M ADX</th>
                                        {/* 1H Group */}
                                        <th style={{ padding: '12px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>1H MACD</th>
                                        <th style={{ padding: '12px 8px', color: '#26a69a' }}>1H Sig</th>
                                        <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H StochK</th>
                                        <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H StochD</th>
                                        <th style={{ padding: '12px 8px', color: '#848e9c' }}>1H ADX</th>
                                        {/* 1D Group */}
                                        <th style={{ padding: '12px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>1D MACD</th>
                                        <th style={{ padding: '12px 8px', color: '#26a69a' }}>1D Sig</th>
                                        <th style={{ padding: '12px 8px', color: '#848e9c' }}>1D ADX</th>
                                    </>
                                )}
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
                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: isProfit ? '#26a69a' : '#ff4d4d', minWidth: '85px' }}>
                                            {formatValue(t.netProfit)}
                                        </td>
                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#f3ba2f', minWidth: '95px' }}>
                                            {formatValue(t.balance)}
                                        </td>
                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#26a69a', minWidth: '110px' }}>
                                            {((parseFloat(t.balance) / config.initialBalance - 1) * 100).toFixed(3)}%
                                        </td>
                                        <td style={{ padding: '10px 8px', color: isProfit ? '#26a69a' : '#ff4d4d', minWidth: '90px' }}>
                                            {formatValue(t.roe, '%')}
                                        </td>
                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: isProfit ? '#26a69a' : '#ff4d4d', minWidth: '100px' }}>
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
                                        {showIndicators && (
                                            <>
                                                {/* 5M */}
                                                <td style={{ padding: '10px 8px', color: '#f3ba2f', borderLeft: '1px solid #2b3139' }}>{t.m5_stochK || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_stochD || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_adx || '-'}</td>
                                                {/* 1H */}
                                                <td style={{ padding: '10px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>{t.h1_macd || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_macdSig || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#f3ba2f' }}>{t.h1_stochK || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_stochD || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_adx || '-'}</td>
                                                {/* 1D */}
                                                <td style={{ padding: '10px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>{t.d1_macd || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_macdSig || '-'}</td>
                                                <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_adx || '-'}</td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <BacktestHistoryArchive 
                records={recordedList} 
                onSelect={(id) => handleRecordSelect({ target: { value: id } })} 
                onDelete={handleDeleteRecord}
            />
        </div>
    );
};

export default BacktestForm;
