import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, HistogramSeries, BaselineSeries } from 'lightweight-charts';
import { 
  calculateRSI, 
  calculateMACD, 
  calculateStochRSI, 
  calculateBollingerBands 
} from '../utils/indicatorUtils';

const PriceChart = ({ symbol, interval, lastCandle, limit = 200, rule, onSignalUpdate, inspectTime }) => {
  const priceChartContainerRef = useRef();
  const macdChartContainerRef = useRef();
  const stochChartContainerRef = useRef();
  
  const priceChartRef = useRef();
  const macdChartRef = useRef();
  const stochChartRef = useRef();
  
  const candlestickSeriesRef = useRef();
  const priceGhostRef = useRef();
  const macdGhostRef = useRef();
  const stochGhostRef = useRef();
  const macdLineRef = useRef();
  const macdSignalRef = useRef();
  const macdHistRef = useRef();
  const stochKRef = useRef();
  const stochDRef = useRef();
  const stoch20Ref = useRef();
  const stoch80Ref = useRef();
  const stochFillRef = useRef();
  const bbMiddleRef = useRef();
  const bbUpperRef = useRef();
  const bbLowerRef = useRef();
  
  const dataRef = useRef([]);
  const [borderColor, setBorderColor] = useState('#242a2e');
  const [macdLegend, setMacdLegend] = useState({ hist: 0, macd: 0, signal: 0 });
  const [stochLegend, setStochLegend] = useState({ k: 0, d: 0 });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    setDataLoaded(false);
    dataRef.current = [];
    let isDestroyed = false;
    if (!priceChartContainerRef.current || !macdChartContainerRef.current || !stochChartContainerRef.current) return;

    const commonOptions = {
      layout: { background: { type: ColorType.Solid, color: '#161a1e' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#242a2e' }, horzLines: { color: '#242a2e' } },
      localization: {
        dateFormat: 'yyyy-MM-dd',
        timeFormatter: (time) => {
          const d = new Date(time * 1000);
          return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
      },
      timeScale: { 
        borderColor: 'rgba(197, 203, 206, 0.1)', 
        timeVisible: true, 
        secondsVisible: false,
        fixRightEdge: false,
        fixLeftEdge: false
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true }
    };

    // 1. Price Chart
    const priceChart = createChart(priceChartContainerRef.current, {
      ...commonOptions,
      height: 350,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: 80 },
      leftPriceScale: { visible: false }
    });
    priceChartRef.current = priceChart;
    const candlestickSeries = priceChart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    candlestickSeriesRef.current = candlestickSeries;
    priceGhostRef.current = priceChart.addSeries(LineSeries, { visible: false, lastValueVisible: false, priceLineVisible: false }); // Ghost
    bbMiddleRef.current = priceChart.addSeries(LineSeries, { color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    bbUpperRef.current = priceChart.addSeries(LineSeries, { color: 'rgba(38, 166, 154, 0.4)', lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    bbLowerRef.current = priceChart.addSeries(LineSeries, { color: 'rgba(239, 83, 80, 0.4)', lineWidth: 1, lastValueVisible: false, priceLineVisible: false });

    // 2. MACD Chart
    const macdChart = createChart(macdChartContainerRef.current, {
      ...commonOptions,
      height: 150,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: 80 },
      leftPriceScale: { visible: false }
    });
    macdChartRef.current = macdChart;
    macdGhostRef.current = macdChart.addSeries(LineSeries, { visible: false, lastValueVisible: false, priceLineVisible: false }); // Ghost
    macdHistRef.current = macdChart.addSeries(HistogramSeries, { lastValueVisible: true, title: '' });
    macdLineRef.current = macdChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, lastValueVisible: true, title: '' });
    macdSignalRef.current = macdChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, lastValueVisible: true, title: '' });

    // 3. StochRSI Chart
    const stochChart = createChart(stochChartContainerRef.current, {
      ...commonOptions,
      height: 150,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: 80 },
      leftPriceScale: { visible: false }
    });
    stochChartRef.current = stochChart;
    stochGhostRef.current = stochChart.addSeries(LineSeries, { visible: false, lastValueVisible: false, priceLineVisible: false }); // Ghost
    stochKRef.current = stochChart.addSeries(LineSeries, { color: '#26a69a', lineWidth: 2, lastValueVisible: true, title: '' });
    stochDRef.current = stochChart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 2, lastValueVisible: true, title: '' });
    stoch20Ref.current = stochChart.addSeries(LineSeries, { color: 'rgba(132,142,156,0.2)', lineWidth: 1, lineStyle: 2, lastValueVisible: false });
    stoch80Ref.current = stochChart.addSeries(LineSeries, { color: 'rgba(132,142,156,0.2)', lineWidth: 1, lineStyle: 2, lastValueVisible: false });
    stochFillRef.current = stochChart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 20 }, topFillColor1: 'rgba(41, 98, 255, 0.1)', topFillColor2: 'rgba(41, 98, 255, 0.1)',
      topLineColor: 'transparent', bottomFillColor1: 'transparent', bottomFillColor2: 'transparent', bottomLineColor: 'transparent',
      lastValueVisible: false, priceLineVisible: false,
    });

    const charts = [priceChart, macdChart, stochChart];
    const syncSeriesList = [candlestickSeries, macdLineRef.current, stochKRef.current];

    let syncCleanup = null;
    const setupSync = () => {
      if (isDestroyed) return;
      let isSyncing = false;

      charts.forEach((chart, index) => {
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncing || !range) return;
          isSyncing = true;
          charts.forEach((c, i) => {
            if (i !== index) c.timeScale().setVisibleLogicalRange(range);
          });
          isSyncing = false;
        });

        chart.subscribeCrosshairMove((param) => {
          if (isSyncing || !param || !param.time) return;
          isSyncing = true;
          charts.forEach((c, i) => {
            if (i !== index) c.setCrosshairPosition(param.point ? param.point.y : 0, param.time, syncSeriesList[i]);
          });
          isSyncing = false;
          
          if (param.time) {
            const dataIndex = dataRef.current.findIndex(d => d.time === param.time);
            if (dataIndex > -1) {
              const closes = dataRef.current.map(d => d.close);
              const rsiValues = calculateRSI(closes);
              const { macdLine, signalLine, histogram } = calculateMACD(closes);
              const { kLine, dLine } = calculateStochRSI(rsiValues);
              setMacdLegend({ hist: histogram[dataIndex], macd: macdLine[dataIndex], signal: signalLine[dataIndex] });
              setStochLegend({ k: kLine[dataIndex], d: dLine[dataIndex] });
            }
          }
        });
      });
      return () => {
        charts.forEach(chart => {
          chart.timeScale().unsubscribeVisibleTimeRangeChange();
          chart.unsubscribeCrosshairMove();
        });
      };
    };

    const handleResize = () => {
      const width = priceChartContainerRef.current?.clientWidth;
      if (width) charts.forEach(c => c.applyOptions({ width }));
    };
    window.addEventListener('resize', handleResize);

    const fetchHistory = async () => {
      try {
        const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        const data = await response.json();
        if (isDestroyed) return;
        const formattedData = data.map(d => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));
        dataRef.current = formattedData;
        candlestickSeries.setData(formattedData);
        
        const closes = formattedData.map(d => d.close);
        const rsiValues = calculateRSI(closes);
        const { macdLine: mLine, signalLine: sLine, histogram: hist } = calculateMACD(closes);
        const { kLine, dLine } = calculateStochRSI(rsiValues);
        const { middle, upper, lower } = calculateBollingerBands(closes);
        
        if (bbMiddleRef.current) bbMiddleRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: middle[i] })).filter(d => d.value !== null));
        if (bbUpperRef.current) bbUpperRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: upper[i] })).filter(d => d.value !== null));
        if (bbLowerRef.current) bbLowerRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: lower[i] })).filter(d => d.value !== null));
        if (macdLineRef.current) macdLineRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: mLine[i] })).filter(d => d.value !== null));
        if (macdSignalRef.current) macdSignalRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: sLine[i] })).filter(d => d.value !== null));
        if (macdHistRef.current) macdHistRef.current.setData(formattedData.map((d, i) => ({ 
          time: d.time, value: hist[i], color: hist[i] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        })).filter(d => d.value !== null));
        if (stochKRef.current) stochKRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: kLine[i] })).filter(d => d.value !== null));
        if (stochDRef.current) stochDRef.current.setData(formattedData.map((d, i) => ({ time: d.time, value: dLine[i] })).filter(d => d.value !== null));
        if (stoch80Ref.current) stoch80Ref.current.setData(formattedData.map(d => ({ time: d.time, value: 80 })));
        if (stochFillRef.current) stochFillRef.current.setData(formattedData.map(d => ({ time: d.time, value: 80 })));
        
        // Ghost data (all time points)
        const ghostData = formattedData.map(d => ({ time: d.time, value: 0 }));
        if (priceGhostRef.current) priceGhostRef.current.setData(ghostData);
        if (macdGhostRef.current) macdGhostRef.current.setData(ghostData);
        if (stochGhostRef.current) stochGhostRef.current.setData(ghostData);
        
        const lastIdx = formattedData.length - 1;
        setMacdLegend({ hist: hist[lastIdx], macd: mLine[lastIdx], signal: sLine[lastIdx] });
        setStochLegend({ k: kLine[lastIdx], d: dLine[lastIdx] });

        setDataLoaded(true);
        syncCleanup = setupSync();
      } catch (err) { console.error('Error fetching history:', err); }
    };
    fetchHistory();

    return () => {
      isDestroyed = true;
      window.removeEventListener('resize', handleResize);
      if (syncCleanup) syncCleanup();
      charts.forEach(c => c.remove());
    };
  }, [symbol, interval, limit]);

  useEffect(() => {
    if (!dataLoaded || !lastCandle || !candlestickSeriesRef.current) return;
    if (lastCandle.symbol !== symbol) return; // Guard against stale data from other symbols
    const { time, open, high, low, close } = lastCandle;
    const formattedCandle = { time, open, high, low, close };
    candlestickSeriesRef.current.update(formattedCandle);

    const fullData = [...dataRef.current];
    const lastIdx = fullData.findIndex(d => d.time === formattedCandle.time);
    if (lastIdx > -1) fullData[lastIdx] = formattedCandle;
    else fullData.push(formattedCandle);

    const closes = fullData.map(d => d.close);
    const rsiValues = calculateRSI(closes);
    const { macdLine: mLine, signalLine: sLine, histogram: hist } = calculateMACD(closes);
    const { kLine, dLine } = calculateStochRSI(rsiValues);
    const { middle, upper, lower } = calculateBollingerBands(closes);

    const lastTime = formattedCandle.time;
    const i = fullData.length - 1;
    if (bbMiddleRef.current) bbMiddleRef.current.update({ time: lastTime, value: middle[i] });
    if (bbUpperRef.current) bbUpperRef.current.update({ time: lastTime, value: upper[i] });
    if (bbLowerRef.current) bbLowerRef.current.update({ time: lastTime, value: lower[i] });
    if (macdLineRef.current) macdLineRef.current.update({ time: lastTime, value: mLine[i] });
    if (macdSignalRef.current) macdSignalRef.current.update({ time: lastTime, value: sLine[i] });
    if (macdHistRef.current) macdHistRef.current.update({ time: lastTime, value: hist[i], color: hist[i] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)' });
    if (stochKRef.current) stochKRef.current.update({ time: lastTime, value: kLine[i] });
    if (stochDRef.current) stochDRef.current.update({ time: lastTime, value: dLine[i] });
    if (stoch20Ref.current) stoch20Ref.current.update({ time: lastTime, value: 20 });
    if (stoch80Ref.current) stoch80Ref.current.update({ time: lastTime, value: 80 });
    if (stochFillRef.current) stochFillRef.current.update({ time: lastTime, value: 80 });

    const ghostUpdate = { time: lastTime, value: 0 };
    if (priceGhostRef.current) priceGhostRef.current.update(ghostUpdate);
    if (macdGhostRef.current) macdGhostRef.current.update(ghostUpdate);
    if (stochGhostRef.current) stochGhostRef.current.update(ghostUpdate);

    setMacdLegend({ hist: hist[i], macd: mLine[i], signal: sLine[i] });
    setStochLegend({ k: kLine[i], d: dLine[i] });

    const evalIdx = inspectTime ? fullData.findIndex(d => d.time <= inspectTime && d.time + (interval === '5m' ? 300 : interval === '1h' ? 3600 : 86400) > inspectTime) : i;
    const targetIdx = evalIdx === -1 ? i : evalIdx;
    evaluateSignal(mLine[targetIdx], sLine[targetIdx], kLine[targetIdx], dLine[targetIdx]);
  }, [lastCandle, dataLoaded, inspectTime]);

  const evaluateSignal = (lastM, lastS, lastK, lastD) => {
    let isLong = true; let isShort = true;
    if (lastM === null || lastS === null) { isLong = false; isShort = false; }
    else {
      if (rule?.long) {
        let activeLongCondCount = 0;
        if (rule.long.macdValueEnabled) { activeLongCondCount++; if (!(lastM < parseFloat(rule.long.macdValue))) isLong = false; }
        if (rule.long.macdCrossEnabled) { activeLongCondCount++; if (!(lastM > lastS)) isLong = false; }
        if (rule.long.stochCrossEnabled) { activeLongCondCount++; if (!(lastD !== null && lastK !== null && lastD < lastK)) isLong = false; }
        if (activeLongCondCount === 0) isLong = false;
      } else isLong = false;
      if (rule?.short) {
        let activeShortCondCount = 0;
        if (rule.short.macdValueEnabled) { activeShortCondCount++; if (!(lastM > parseFloat(rule.short.macdValue))) isShort = false; }
        if (rule.short.macdCrossEnabled) { activeShortCondCount++; if (!(lastM < lastS)) isShort = false; }
        if (rule.short.stochCrossEnabled) { activeShortCondCount++; if (!(lastD !== null && lastK !== null && lastD > lastK)) isShort = false; }
        if (activeShortCondCount === 0) isShort = false;
      } else isShort = false;
    }
    const currentSignal = isLong ? 'long' : (isShort ? 'short' : 'hold');
    setBorderColor(isLong ? '#26a69a' : (isShort ? '#ef5350' : '#f3ba2f'));
    if (onSignalUpdate) onSignalUpdate(currentSignal);
  };

  const formatVal = (val) => (val !== undefined && val !== null && !isNaN(val) ? val.toFixed(2) : '0.00');

  return (
    <div className="chart-wrapper" style={{ border: `4px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden', padding: '10px', background: '#161a1e', transition: 'border-color 0.3s ease' }}>
      <div ref={priceChartContainerRef} style={{ width: '100%', position: 'relative' }} />
      
      <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '11px', display: 'flex', gap: '15px', color: '#848e9c', marginBottom: '2px', marginTop: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>MACD</span>
        <span style={{ color: macdLegend.hist >= 0 ? '#26a69a' : '#ef5350' }}>Hist: {formatVal(macdLegend.hist)}</span>
        <span style={{ color: '#2962FF' }}>MACD: {formatVal(macdLegend.macd)}</span>
        <span style={{ color: '#FF6D00' }}>Signal: {formatVal(macdLegend.signal)}</span>
      </div>
      <div ref={macdChartContainerRef} style={{ width: '100%', position: 'relative' }} />
      
      <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '11px', display: 'flex', gap: '15px', color: '#848e9c', marginBottom: '2px', marginTop: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>Stoch RSI</span>
        <span style={{ color: '#26a69a' }}>%K: {formatVal(stochLegend.k)}</span>
        <span style={{ color: '#ef5350' }}>%D: {formatVal(stochLegend.d)}</span>
      </div>
      <div ref={stochChartContainerRef} style={{ width: '100%', position: 'relative' }} />
    </div>
  );
};

export default PriceChart;
