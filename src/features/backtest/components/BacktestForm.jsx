import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity, FileCode, Play, Copy, RefreshCcw, Layers, Info, CheckCircle2, History, Save, Download, FileSpreadsheet } from 'lucide-react';
import { OFFICIAL_STRATEGIES } from '../../../shared/config/strategyConfigs';
import BacktestHistoryArchive from './BacktestHistoryArchive';
import './BacktestForm.css';
import './BacktestHistoryArchive.css';

const BacktestForm = ({ view = 'backtest', setView }) => {
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
    
    // WHAT-IF 동적 필터 폼 상태 선언
    const [newWhatIf, setNewWhatIf] = useState({
        side: 'both',
        action: 'block',
        timeframe: '1d',
        indicator: 'ma_slope_5',
        operator: '<',
        threshold: '0'
    });

    const handleAddWhatIf = () => {
        setRules(prev => {
            const currentGlobal = prev.global || {};
            const currentFilters = currentGlobal.whatIfFilters || [];
            return {
                ...prev,
                global: {
                    ...currentGlobal,
                    whatIfFilters: [
                        ...currentFilters,
                        { ...newWhatIf, threshold: parseFloat(newWhatIf.threshold) || 0 }
                    ]
                }
            };
        });
    };

    const handleRemoveWhatIf = (index) => {
        setRules(prev => {
            const currentGlobal = prev.global || {};
            const currentFilters = currentGlobal.whatIfFilters || [];
            return {
                ...prev,
                global: {
                    ...currentGlobal,
                    whatIfFilters: currentFilters.filter((_, idx) => idx !== index)
                }
            };
        });
    };

    const handleResetWhatIf = () => {
        setRules(prev => {
            const currentGlobal = prev.global || {};
            return {
                ...prev,
                global: {
                    ...currentGlobal,
                    whatIfFilters: []
                }
            };
        });
    };

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
                // 해당 전략의 기본 대기 시간 및 신규 8.2.4/8.2.5 매개변수 로드
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
                useStochExtremeBypass: srcTfRules.stochExtremeBypassEnabled !== undefined ? srcTfRules.stochExtremeBypassEnabled : (srcTfRules.useStochExtremeBypass !== undefined ? srcTfRules.useStochExtremeBypass : false),
                useStochKLimit: srcTfRules.stochKLimitEnabled !== undefined ? srcTfRules.stochKLimitEnabled : (srcTfRules.useStochKLimit !== undefined ? srcTfRules.useStochKLimit : false),
                stochKThreshold: srcTfRules.stochKThreshold !== undefined ? srcTfRules.stochKThreshold : 80,
                useRSI: srcTfRules.rsiEnabled !== undefined ? srcTfRules.rsiEnabled : (srcTfRules.useRSI !== undefined ? srcTfRules.useRSI : false),
                rsiLow: srcTfRules.rsiLow !== undefined ? srcTfRules.rsiLow : 5,
                rsiHigh: srcTfRules.rsiHigh !== undefined ? srcTfRules.rsiHigh : 95,
                useMacdVal: srcTfRules.macdValueEnabled !== undefined ? srcTfRules.macdValueEnabled : (srcTfRules.useMacdVal !== undefined ? srcTfRules.useMacdVal : false),
                macdVal: srcTfRules.macdValue !== undefined ? srcTfRules.macdValue : (srcTfRules.macdVal !== undefined ? srcTfRules.macdVal : 0),
                useMaSlope: srcTfRules.useMaSlope !== undefined ? srcTfRules.useMaSlope : false,
                useMaRoc: srcTfRules.useMaRoc !== undefined ? srcTfRules.useMaRoc : false,
                useMaSizeFilter: srcTfRules.useMaSizeFilter !== undefined ? srcTfRules.useMaSizeFilter : false,
                useRciCross: srcTfRules.rciCrossEnabled !== undefined ? srcTfRules.rciCrossEnabled : (srcTfRules.useRciCross !== undefined ? srcTfRules.useRciCross : false),
                useTrixCross: srcTfRules.trixCrossEnabled !== undefined ? srcTfRules.trixCrossEnabled : (srcTfRules.useTrixCross !== undefined ? srcTfRules.useTrixCross : false),
                trixSignalPeriod: srcTfRules.trixSignalPeriod !== undefined ? srcTfRules.trixSignalPeriod : 9,
                rciLongPeriod: srcTfRules.rciLongPeriod !== undefined ? srcTfRules.rciLongPeriod : 26
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

        mapped.global = {
            switchingEnabled: rawRules.global?.switchingEnabled !== undefined ? rawRules.global.switchingEnabled : false,
            maSlopeAlign5mEnabled: rawRules.global?.maSlopeAlign5mEnabled !== undefined ? rawRules.global.maSlopeAlign5mEnabled : false,
            maSlopeAlign1hEnabled: rawRules.global?.maSlopeAlign1hEnabled !== undefined ? rawRules.global.maSlopeAlign1hEnabled : false,
            maSlopeAlignPeriod5m: rawRules.global?.maSlopeAlignPeriod5m !== undefined ? parseInt(rawRules.global.maSlopeAlignPeriod5m) : (rawRules.global?.maSlopeAlignPeriod !== undefined ? parseInt(rawRules.global.maSlopeAlignPeriod) : 20),
            maSlopeAlignPeriod1h: rawRules.global?.maSlopeAlignPeriod1h !== undefined ? parseInt(rawRules.global.maSlopeAlignPeriod1h) : (rawRules.global?.maSlopeAlignPeriod !== undefined ? parseInt(rawRules.global.maSlopeAlignPeriod) : 20),
            whatIfFilters: rawRules.global?.whatIfFilters !== undefined ? rawRules.global.whatIfFilters : []
        };

        Object.keys(rawRules).forEach(k => {
            if (!timeframes.includes(k) && k !== 'long' && k !== 'short' && k !== 'global') {
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
                
                // 백테스트 연산 완료 후 자동으로 기록 아카이브에 백그라운드 저장
                try {
                    fetch(`${API_BASE}/api/save-history`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ baseVersion: config.version, config, rules, result })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            console.log("[AUTO SAVE] Saved successfully as version:", data.newVersion);
                            fetchRecords(); // 아카이브 데이터 최신화
                        }
                    })
                    .catch(err => console.error("[AUTO SAVE ERROR]", err));
                } catch (err) {
                    console.error("[AUTO SAVE FAIL]", err);
                }

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
            "5M StochK", "5M StochD", "5M ADX", "5M RSI", "5M BBW", "5M BBWP", "5M BBW ROC", "5M MA Slope 3", "5M MA Slope 5", "5M MA Slope 10", "5M MA Slope 20", "5M MA ROC",
            "1H MACD", "1H Signal", "1H StochK", "1H StochD", "1H ADX", "1H RSI", "1H BBW", "1H BBWP", "1H BBW ROC", "1H MA Slope 3", "1H MA Slope 5", "1H MA Slope 10", "1H MA Slope 20", "1H MA ROC",
            "1D MACD", "1D Signal", "1D ADX", "1D RSI", "1D BBW", "1D BBWP", "1D BBW ROC", "1D MA Slope 3", "1D MA Slope 5", "1D MA Slope 10", "1D MA Slope 20", "1D MA ROC",
            "5M RCI9", "5M RCI26", "5M TRIX", "5M TRIX Sig",
            "1H RCI9", "1H RCI26", "1H TRIX", "1H TRIX Sig",
            "1D RCI9", "1D RCI26", "1D TRIX", "1D TRIX Sig"
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
                t.m5_stochK || '-', t.m5_stochD || '-', t.m5_adx || '-', t.m5_rsi || '-', t.m5_bbw || '-', t.m5_bbwp || '-', t.m5_bbw_roc || '-', t.m5_ma_slope_3 || '-', t.m5_ma_slope_5 || '-', t.m5_ma_slope_10 || '-', t.m5_ma_slope_20 || '-', t.m5_ma_roc || '-',
                t.h1_macd || '-', t.h1_macdSig || '-', t.h1_stochK || '-', t.h1_stochD || '-', t.h1_adx || '-', t.h1_rsi || '-', t.h1_bbw || '-', t.h1_bbwp || '-', t.h1_bbw_roc || '-', t.h1_ma_slope_3 || '-', t.h1_ma_slope_5 || '-', t.h1_ma_slope_10 || '-', t.h1_ma_slope_20 || '-', t.h1_ma_roc || '-',
                t.d1_macd || '-', t.d1_macdSig || '-', t.d1_adx || '-', t.d1_rsi || '-', t.d1_bbw || '-', t.d1_bbwp || '-', t.d1_bbw_roc || '-', t.d1_ma_slope_3 || '-', t.d1_ma_slope_5 || '-', t.d1_ma_slope_10 || '-', t.d1_ma_slope_20 || '-', t.d1_ma_roc || '-',
                t.m5_rci9 || '-', t.m5_rci26 || '-', t.m5_trix || '-', t.m5_trix_sig || '-',
                t.h1_rci9 || '-', t.h1_rci26 || '-', t.h1_trix || '-', t.h1_trix_sig || '-',
                t.d1_rci9 || '-', t.d1_rci26 || '-', t.d1_trix || '-', t.d1_trix_sig || '-'
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

    if (view === 'archive') {
        return (
            <div className="backtest-container" style={{ padding: '0 20px' }}>
                <BacktestHistoryArchive 
                    records={recordedList} 
                    onSelect={(id) => {
                        handleRecordSelect({ target: { value: id } });
                        if (setView) setView('backtest');
                    }} 
                    onDelete={handleDeleteRecord}
                />
            </div>
        );
    }

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
                <div style={{ background: '#0b0e11', padding: '12px 16px', borderRadius: '12px', border: '1px solid #2b3139', marginBottom: '24px' }}>
                    {/* Row 1: Target ROI & Stop Loss ROI */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#26a69a', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Target ROI (Decimal, e.g. 0.03 = 3%)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" step="0.005" name="targetRoi" value={config.targetRoi} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>목표 수익률 (Net ROI)</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#ef5350', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Stop Loss ROI (Decimal, e.g. 0.15 = 15%)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" step="0.001" name="slRoi" value={config.slRoi} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>최대 허용 손실률</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Entry Wait & Exit Wait */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px', marginTop: '12px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Entry Wait Limit (min)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" name="entryWaitMin" value={config.entryWaitMin || 60} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>분 대기 후 진입 실패 처리</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#ff4d4d', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Exit Wait Limit (min)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" name="exitWaitMin" value={config.exitWaitMin || 2000} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>분 대기 후 시장가 청산 강제</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: TP Reduction Wait & Reduced Target ROI */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px', marginTop: '12px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Reduce TP Wait Time (min, 0 to disable)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" name="reduceTpWaitMin" value={config.reduceTpWaitMin ?? 60} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>분 뒤 익절 하향 (0이면 비활성)</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#26a69a', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Reduced Target ROI (Decimal, e.g. 0.01 = 1%)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" step="0.005" name="reducedTargetRoi" value={config.reducedTargetRoi ?? 0.01} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>조정된 목표 수익률 (Net ROI)</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Penetration Rate & Entry Mode */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 16px', marginTop: '12px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Penetration Rate (Decimal, e.g. 0.001 = 0.1%)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input type="number" step="0.0001" name="penetrationRate" value={config.penetrationRate ?? 0.001} onChange={handleChange} style={{ width: '80px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none' }} />
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>목표가 돌파 비율 (지정가 보수화)</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#26a69a', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Entry Mode (진입 방식)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <select name="entryMode" value={config.entryMode ?? 'HYBRID_5M'} onChange={handleChange} style={{ width: 'auto', minWidth: '180px', background: 'transparent', border: 'none', color: '#eaebed', fontSize: '13px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', paddingRight: '20px' }}>
                                    <option value="MARKET" style={{ background: '#1e2329', color: '#eaebed' }}>MARKET (시장가)</option>
                                    <option value="HYBRID_5M" style={{ background: '#1e2329', color: '#eaebed' }}>HYBRID_5M (5분봉기준 유리한 가격)</option>
                                    <option value="HYBRID_10M" style={{ background: '#1e2329', color: '#eaebed' }}>HYBRID_10M (10분봉기준 유리한 가격)</option>
                                    <option value="HYBRID_15M" style={{ background: '#1e2329', color: '#eaebed' }}>HYBRID_15M (15분봉기준 유리한 가격)</option>
                                </select>
                                <span style={{ color: '#848e9c', fontSize: '11px' }}>진입 기준 가격 옵션</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 5: Opposite Signal Switching */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px 16px', marginTop: '12px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>Opposite Signal Switching (스위칭 진입)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2b3139' }}>
                                <input 
                                    type="checkbox" 
                                    checked={rules.global?.switchingEnabled ?? false} 
                                    onChange={e => setRules(prev => ({
                                        ...prev,
                                        global: {
                                            ...prev.global,
                                            switchingEnabled: e.target.checked
                                        }
                                    }))} 
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                                />
                                <span style={{ color: '#eaebed', fontSize: '11px', fontWeight: 'bold' }}>포지션 보유 중 반대 방향 시그널 발생 시 즉시 시장가 청산 및 반대 진입</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 6: MA Slope Align Filters & Periods */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>MA Slope 5m Filter</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2b3139', height: '38px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={rules.global?.maSlopeAlign5mEnabled ?? false} 
                                    onChange={e => setRules(prev => ({
                                        ...prev,
                                        global: {
                                            ...prev.global,
                                            maSlopeAlign5mEnabled: e.target.checked
                                        }
                                    }))} 
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                                />
                                <span style={{ color: '#eaebed', fontSize: '11px', fontWeight: 'bold' }}>5m 방향 제한 활성</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>MA Slope 5m Period</label>
                            <input 
                                type="number" 
                                value={rules.global?.maSlopeAlignPeriod5m ?? 20} 
                                onChange={e => {
                                    const val = parseInt(e.target.value) || 20;
                                    setRules(prev => ({
                                        ...prev,
                                        global: {
                                            ...prev.global,
                                            maSlopeAlignPeriod5m: val
                                        }
                                    }));
                                }}
                                style={{ 
                                    width: '100%', 
                                    background: '#1e2329', 
                                    color: '#eaebed', 
                                    border: '1px solid #2b3139', 
                                    borderRadius: '6px', 
                                    padding: '8px 12px',
                                    fontSize: '13px'
                                }} 
                            />
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>MA Slope 1h Filter</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2329', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2b3139', height: '38px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={rules.global?.maSlopeAlign1hEnabled ?? false} 
                                    onChange={e => setRules(prev => ({
                                        ...prev,
                                        global: {
                                            ...prev.global,
                                            maSlopeAlign1hEnabled: e.target.checked
                                        }
                                    }))} 
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                                />
                                <span style={{ color: '#eaebed', fontSize: '11px', fontWeight: 'bold' }}>1h 방향 제한 활성</span>
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'block', color: '#f3ba2f', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>MA Slope 1h Period</label>
                            <input 
                                type="number" 
                                value={rules.global?.maSlopeAlignPeriod1h ?? 20} 
                                onChange={e => {
                                    const val = parseInt(e.target.value) || 20;
                                    setRules(prev => ({
                                        ...prev,
                                        global: {
                                            ...prev.global,
                                            maSlopeAlignPeriod1h: val
                                        }
                                    }));
                                }}
                                style={{ 
                                    width: '100%', 
                                    background: '#1e2329', 
                                    color: '#eaebed', 
                                    border: '1px solid #2b3139', 
                                    borderRadius: '6px', 
                                    padding: '8px 12px',
                                    fontSize: '13px'
                                }} 
                            />
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
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#1e2329', padding: '10px', borderRadius: '8px', border: '1px solid #2b3139' }}>
                            {/* 방향 선택 */}
                            <select 
                                value={newWhatIf.side} 
                                onChange={e => setNewWhatIf(prev => ({ ...prev, side: e.target.value }))}
                                style={{ background: '#0b0e11', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                            >
                                <option value="both">양방향</option>
                                <option value="long">롱</option>
                                <option value="short">숏</option>
                            </select>

                            {/* 액션 선택 */}
                            <select 
                                value={newWhatIf.action} 
                                onChange={e => setNewWhatIf(prev => ({ ...prev, action: e.target.value }))}
                                style={{ background: '#0b0e11', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                            >
                                <option value="block">차단</option>
                                <option value="size_50">50%진입</option>
                                <option value="tp_50">TP 50%축소</option>
                                <option value="sl_50">SL 50%축소</option>
                            </select>

                            {/* 타임프레임 선택 */}
                            <select 
                                value={newWhatIf.timeframe} 
                                onChange={e => setNewWhatIf(prev => ({ ...prev, timeframe: e.target.value }))}
                                style={{ background: '#0b0e11', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                            >
                                <option value="5m">5m</option>
                                <option value="1h">1h</option>
                                <option value="1d">1d</option>
                            </select>

                            {/* 지표 선택 */}
                            <select 
                                value={newWhatIf.indicator} 
                                onChange={e => setNewWhatIf(prev => ({ ...prev, indicator: e.target.value }))}
                                style={{ background: '#0b0e11', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                            >
                                <option value="ma_slope_3">3ma slope</option>
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
                                value={newWhatIf.operator} 
                                onChange={e => setNewWhatIf(prev => ({ ...prev, operator: e.target.value }))}
                                style={{ background: '#0b0e11', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                            >
                                <option value="<">&lt;</option>
                                <option value=">">&gt;</option>
                                <option value="=">=</option>
                            </select>

                            {/* 임계값 입력 */}
                            <input 
                                type="number" 
                                value={newWhatIf.threshold}
                                onChange={e => setNewWhatIf(prev => ({ ...prev, threshold: e.target.value }))}
                                placeholder="임계치"
                                style={{ background: '#0b0e11', color: '#eaebed', border: '1px solid #2b3139', padding: '6px 10px', borderRadius: '4px', width: '80px', fontSize: '12px' }}
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
                            {(Array.isArray(rules.global?.whatIfFilters) ? rules.global.whatIfFilters : []).map((filter, index) => {
                                const sideText = filter.side === 'both' ? '양방향' : (filter.side === 'long' ? '롱' : '숏');
                                const actionText = filter.action === 'block' ? '차단' : (filter.action === 'size_50' ? '50%진입' : (filter.action === 'tp_50' ? 'TP 50%축소' : 'SL 50%축소'));
                                return (
                                    <div 
                                        key={index}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e2329', border: '1px solid #f3ba2f', color: '#eaebed', padding: '4px 10px', borderRadius: '16px', fontSize: '11px' }}
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
                            {(!Array.isArray(rules.global?.whatIfFilters) || rules.global.whatIfFilters.length === 0) && (
                                <div style={{ color: '#5e6673', fontSize: '12px', fontStyle: 'italic' }}>설정된 WHAT-IF 조건이 없습니다.</div>
                            )}
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useADX} onChange={e => handleRuleChange('long', iv, 'useADX', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>ADX</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxLow ?? 30} onChange={e => handleRuleChange('long', iv, 'adxLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; ADX &lt;</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxHigh ?? 99} onChange={e => handleRuleChange('long', iv, 'adxHigh', parseFloat(e.target.value))} />
                                            </div>

                                            {/* Stoch K Limit */}
                                            {(targetRules[iv]?.stochKThreshold !== undefined || targetRules[iv]?.stochKHigh !== undefined) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useStochKLimit} onChange={e => handleRuleChange('long', iv, 'useStochKLimit', e.target.checked)} />
                                                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>StochK</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKLow ?? 0} onChange={e => handleRuleChange('long', iv, 'stochKLow', parseFloat(e.target.value))} />
                                                    <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; StochK &lt;</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKHigh ?? (targetRules[iv]?.stochKThreshold || 99)} onChange={e => handleRuleChange('long', iv, 'stochKHigh', parseFloat(e.target.value))} />
                                                </div>
                                            )}

                                            {/* RSI Limit */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useRSI} onChange={e => handleRuleChange('long', iv, 'useRSI', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>RSI</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.rsiLow ?? 5} onChange={e => handleRuleChange('long', iv, 'rsiLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; RSI &lt;</span>
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

                                            {/* Stoch Extreme Bypass (m5 전용) */}
                                            {iv === '5m' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useStochExtremeBypass} onChange={e => handleRuleChange('long', iv, 'useStochExtremeBypass', e.target.checked)} />
                                                    <span style={{ color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>극단값에서 무조건 시장가 진입</span>
                                                </div>
                                            )}



                                            {/* 1H 20MA Size Filter (1h 전용) */}
                                            {iv === '1h' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useMaSizeFilter} onChange={e => handleRuleChange('long', iv, 'useMaSizeFilter', e.target.checked)} />
                                                    <span style={{ color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>1H 20MA 포지션 규모 조절 (미만시 50%)</span>
                                                </div>
                                            )}

                                            {/* RCI 이중(9/26) 교차 필터 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useRciCross || false} onChange={e => handleRuleChange('long', iv, 'useRciCross', e.target.checked)} />
                                                <span style={{ color: '#9b8cff', fontSize: '12px', marginLeft: '5px' }}>RCI Cross (9 &gt; 장기)</span>
                                                <span style={{ color: '#888', fontSize: '11px', marginLeft: '6px' }}>장기</span>
                                                <input type="number" min="2" max="200" value={targetRules[iv]?.rciLongPeriod ?? 26}
                                                    onChange={e => handleRuleChange('long', iv, 'rciLongPeriod', parseInt(e.target.value) || 26)}
                                                    style={{ width: '48px', background: '#1e2329', color: '#eee', border: '1px solid #444', borderRadius: '3px', padding: '2px 4px', fontSize: '11px' }} />
                                            </div>

                                            {/* TRIX 시그널선 교차 필터 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useTrixCross || false} onChange={e => handleRuleChange('long', iv, 'useTrixCross', e.target.checked)} />
                                                <span style={{ color: '#4dd0e1', fontSize: '12px', marginLeft: '5px' }}>TRIX Cross (TRIX &gt; Signal)</span>
                                                <span style={{ color: '#888', fontSize: '11px', marginLeft: '6px' }}>Sig</span>
                                                <input type="number" min="2" max="50" value={targetRules[iv]?.trixSignalPeriod ?? 9}
                                                    onChange={e => handleRuleChange('long', iv, 'trixSignalPeriod', parseInt(e.target.value) || 9)}
                                                    style={{ width: '48px', background: '#1e2329', color: '#eee', border: '1px solid #444', borderRadius: '3px', padding: '2px 4px', fontSize: '11px' }} />
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useADX} onChange={e => handleRuleChange('short', iv, 'useADX', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>ADX</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxLow ?? 30} onChange={e => handleRuleChange('short', iv, 'adxLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; ADX &lt;</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.adxHigh ?? 99} onChange={e => handleRuleChange('short', iv, 'adxHigh', parseFloat(e.target.value))} />
                                            </div>

                                            {/* Stoch K Limit */}
                                            {(targetRules[iv]?.stochKThreshold !== undefined || targetRules[iv]?.stochKHigh !== undefined) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useStochKLimit} onChange={e => handleRuleChange('short', iv, 'useStochKLimit', e.target.checked)} />
                                                    <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>StochK</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKLow ?? 0} onChange={e => handleRuleChange('short', iv, 'stochKLow', parseFloat(e.target.value))} />
                                                    <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; StochK &lt;</span>
                                                    <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.stochKHigh ?? (targetRules[iv]?.stochKThreshold || 99)} onChange={e => handleRuleChange('short', iv, 'stochKHigh', parseFloat(e.target.value))} />
                                                </div>
                                            )}

                                            {/* RSI Limit */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useRSI} onChange={e => handleRuleChange('short', iv, 'useRSI', e.target.checked)} />
                                                <span style={{ display: 'inline-block', width: '70px', color: '#eaebed', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>RSI</span>
                                                <input type="number" style={{ width: '45px', background: '#0b0e11', border: '1px solid #2b3139', color: '#eaebed', padding: '3px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }} value={targetRules[iv]?.rsiLow ?? 5} onChange={e => handleRuleChange('short', iv, 'rsiLow', parseFloat(e.target.value))} />
                                                <span style={{ display: 'inline-block', minWidth: '55px', padding: '0 2px', textAlign: 'center', color: '#eaebed', fontSize: '12px' }}>&lt; RSI &lt;</span>
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

                                            {/* Stoch Extreme Bypass (m5 전용) */}
                                            {iv === '5m' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useStochExtremeBypass} onChange={e => handleRuleChange('short', iv, 'useStochExtremeBypass', e.target.checked)} />
                                                    <span style={{ color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>극단값에서 무조건 시장가 진입</span>
                                                </div>
                                            )}


                                            {/* 1H 20MA Size Filter (1h 전용) */}
                                            {iv === '1h' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {renderAnd()}
                                                    <input type="checkbox" checked={targetRules[iv]?.useMaSizeFilter} onChange={e => handleRuleChange('short', iv, 'useMaSizeFilter', e.target.checked)} />
                                                    <span style={{ color: '#f3ba2f', fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>1H 20MA 포지션 규모 조절 (초과시 50%)</span>
                                                </div>
                                            )}

                                            {/* RCI 이중(9/26) 교차 필터 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useRciCross || false} onChange={e => handleRuleChange('short', iv, 'useRciCross', e.target.checked)} />
                                                <span style={{ color: '#9b8cff', fontSize: '12px', marginLeft: '5px' }}>RCI Cross (9 &lt; 장기)</span>
                                                <span style={{ color: '#888', fontSize: '11px', marginLeft: '6px' }}>장기</span>
                                                <input type="number" min="2" max="200" value={targetRules[iv]?.rciLongPeriod ?? 26}
                                                    onChange={e => handleRuleChange('short', iv, 'rciLongPeriod', parseInt(e.target.value) || 26)}
                                                    style={{ width: '48px', background: '#1e2329', color: '#eee', border: '1px solid #444', borderRadius: '3px', padding: '2px 4px', fontSize: '11px' }} />
                                            </div>

                                            {/* TRIX 시그널선 교차 필터 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {renderAnd()}
                                                <input type="checkbox" checked={targetRules[iv]?.useTrixCross || false} onChange={e => handleRuleChange('short', iv, 'useTrixCross', e.target.checked)} />
                                                <span style={{ color: '#4dd0e1', fontSize: '12px', marginLeft: '5px' }}>TRIX Cross (TRIX &lt; Signal)</span>
                                                <span style={{ color: '#888', fontSize: '11px', marginLeft: '6px' }}>Sig</span>
                                                <input type="number" min="2" max="50" value={targetRules[iv]?.trixSignalPeriod ?? 9}
                                                    onChange={e => handleRuleChange('short', iv, 'trixSignalPeriod', parseInt(e.target.value) || 9)}
                                                    style={{ width: '48px', background: '#1e2329', color: '#eee', border: '1px solid #444', borderRadius: '3px', padding: '2px 4px', fontSize: '11px' }} />
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

                <TradeLogTable 
                    tradesLog={tradesLog} 
                    showIndicators={showIndicators} 
                    config={config} 
                />
            </section>

        </div>
    );
};

// React.memo로 감싸서, 백테스트 결과(tradesLog)와 지표 활성 여부(showIndicators)가
// 바뀌지 않는 한, rules 등 다른 상태 변경 시 테이블 전체 리렌더링을 완전히 방지합니다.
const TradeLogTable = React.memo(({ tradesLog, showIndicators, config }) => {
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

    return (
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
                                <th style={{ padding: '12px 8px', color: '#848e9c' }}>5M RSI</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M BBW</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M BBWP</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M ROC</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M MA Slope 3</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M MA Slope 5</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M MA Slope 10</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M MA Slope 20</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>5M MA ROC</th>
                                {/* 1H Group */}
                                <th style={{ padding: '12px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>1H MACD</th>
                                <th style={{ padding: '12px 8px', color: '#26a69a' }}>1H Sig</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H StochK</th>
                                <th style={{ padding: '12px 8px', color: '#848e9c' }}>1H StochD</th>
                                <th style={{ padding: '12px 8px', color: '#848e9c' }}>1H ADX</th>
                                <th style={{ padding: '12px 8px', color: '#848e9c' }}>1H RSI</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H BBW</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H BBWP</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H ROC</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H MA Slope 3</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H MA Slope 5</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H MA Slope 10</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H MA Slope 20</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1H MA ROC</th>
                                {/* 1D Group */}
                                <th style={{ padding: '12px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>1D MACD</th>
                                <th style={{ padding: '12px 8px', color: '#26a69a' }}>1D Sig</th>
                                <th style={{ padding: '12px 8px', color: '#848e9c' }}>1D ADX</th>
                                <th style={{ padding: '12px 8px', color: '#848e9c' }}>1D RSI</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D BBW</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D BBWP</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D ROC</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D MA Slope 3</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D MA Slope 5</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D MA Slope 10</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D MA Slope 20</th>
                                <th style={{ padding: '12px 8px', color: '#f3ba2f' }}>1D MA ROC</th>
                                <th style={{ padding: '12px 8px', color: '#9b8cff' }}>5M RCI9</th>
                                <th style={{ padding: '12px 8px', color: '#9b8cff' }}>5M RCI26</th>
                                <th style={{ padding: '12px 8px', color: '#4dd0e1' }}>5M TRIX</th>
                                <th style={{ padding: '12px 8px', color: '#4dd0e1' }}>5M TRIX Sig</th>
                                <th style={{ padding: '12px 8px', color: '#9b8cff' }}>1H RCI9</th>
                                <th style={{ padding: '12px 8px', color: '#9b8cff' }}>1H RCI26</th>
                                <th style={{ padding: '12px 8px', color: '#4dd0e1' }}>1H TRIX</th>
                                <th style={{ padding: '12px 8px', color: '#4dd0e1' }}>1H TRIX Sig</th>
                                <th style={{ padding: '12px 8px', color: '#9b8cff' }}>1D RCI9</th>
                                <th style={{ padding: '12px 8px', color: '#9b8cff' }}>1D RCI26</th>
                                <th style={{ padding: '12px 8px', color: '#4dd0e1' }}>1D TRIX</th>
                                <th style={{ padding: '12px 8px', color: '#4dd0e1' }}>1D TRIX Sig</th>
                            </>
                        ) }
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
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_rsi || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_bbw || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_bbwp || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_bbw_roc || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_ma_slope_3 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_ma_slope_5 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_ma_slope_10 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_ma_slope_20 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.m5_ma_roc || '-'}</td>
                                        {/* 1H */}
                                        <td style={{ padding: '10px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>{t.h1_macd || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_macdSig || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#f3ba2f' }}>{t.h1_stochK || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_stochD || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_adx || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_rsi || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_bbw || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_bbwp || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_bbw_roc || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_ma_slope_3 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_ma_slope_5 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_ma_slope_10 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_ma_slope_20 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.h1_ma_roc || '-'}</td>
                                        {/* 1D */}
                                        <td style={{ padding: '10px 8px', color: '#26a69a', borderLeft: '1px solid #2b3139' }}>{t.d1_macd || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_macdSig || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_adx || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_rsi || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_bbw || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_bbwp || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_bbw_roc || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_ma_slope_3 || t.d1_ma_3 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_ma_slope_5 || t.d1_ma_5 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_ma_slope_10 || t.d1_ma_10 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_ma_slope_20 || t.d1_ma_20 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#848e9c' }}>{t.d1_ma_roc || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#9b8cff' }}>{t.m5_rci9 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#9b8cff' }}>{t.m5_rci26 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#4dd0e1' }}>{t.m5_trix || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#4dd0e1' }}>{t.m5_trix_sig || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#9b8cff' }}>{t.h1_rci9 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#9b8cff' }}>{t.h1_rci26 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#4dd0e1' }}>{t.h1_trix || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#4dd0e1' }}>{t.h1_trix_sig || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#9b8cff' }}>{t.d1_rci9 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#9b8cff' }}>{t.d1_rci26 || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#4dd0e1' }}>{t.d1_trix || '-'}</td>
                                        <td style={{ padding: '10px 8px', color: '#4dd0e1' }}>{t.d1_trix_sig || '-'}</td>
                                    </>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}, (prevProps, nextProps) => {
    // tradesLog의 레퍼런스가 동일하고, 지표 보기 옵션(showIndicators)과 leverage 값이 일치하면 
    // rules 상태 등의 변화에 따른 불필요한 전체 테이블 리렌더링을 완전히 차단합니다.
    return prevProps.showIndicators === nextProps.showIndicators &&
           prevProps.tradesLog === nextProps.tradesLog &&
           prevProps.config?.leverage === nextProps.config?.leverage;
});

export default BacktestForm;
