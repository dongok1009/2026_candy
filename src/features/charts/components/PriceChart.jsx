import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, HistogramSeries, BaselineSeries } from 'lightweight-charts';
import {
  calculateRSI,
  calculateMACD,
  calculateStochRSI,
  calculateBollingerBands,
  calculateADX
} from '../../../shared/utils/indicatorUtils';


const PriceChart = ({ symbol, interval, lastCandle, limit = 200, rule, onSignalUpdate, onDataUpdate, inspectTime }) => {
  const priceChartContainerRef = useRef();
  const macdChartContainerRef = useRef();
  const stochChartContainerRef = useRef();
  const adxChartContainerRef = useRef();

  const priceChartRef = useRef();
  const macdChartRef = useRef();
  const stochChartRef = useRef();
  const adxChartRef = useRef();

  const candlestickSeriesRef = useRef();
  const priceGhostRef = useRef();
  const macdGhostRef = useRef();
  const stochGhostRef = useRef();
  const adxGhostRef = useRef();
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
  const adxSeriesRef = useRef();
  
  const inspectLineRef = useRef();
  const inspectLineMacdRef = useRef();
  const inspectLineStochRef = useRef();
  const inspectLineAdxRef = useRef();
  
  const dataRef = useRef([]);
  const [borderColor, setBorderColor] = useState('#242a2e');
  const [macdLegend, setMacdLegend] = useState({ hist: 0, macd: 0, signal: 0 });
  const [stochLegend, setStochLegend] = useState({ k: 0, d: 0 });
  const [adxLegend, setAdxLegend] = useState(0);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const handleWinResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  useEffect(() => {
    setDataLoaded(false);
    dataRef.current = [];
    let isDestroyed = false;
    if (!priceChartContainerRef.current || !macdChartContainerRef.current || !stochChartContainerRef.current || !adxChartContainerRef.current) return;

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
    priceChartContainerRef.current.innerHTML = '';
    macdChartContainerRef.current.innerHTML = '';
    stochChartContainerRef.current.innerHTML = '';
    adxChartContainerRef.current.innerHTML = '';

    const priceChart = createChart(priceChartContainerRef.current, {
      ...commonOptions,
      height: isMobile ? 194 : 270,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: isMobile ? 60 : 80 },
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
    inspectLineRef.current = priceChart.addSeries(HistogramSeries, { 
      lastValueVisible: false, priceLineVisible: false, color: 'rgba(255, 255, 255, 0.3)',
      autoscaleInfoProvider: () => null 
    });

    // 2. MACD Chart
    const macdChart = createChart(macdChartContainerRef.current, {
      ...commonOptions,
      height: isMobile ? 57 : 85,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: isMobile ? 60 : 80 },
      leftPriceScale: { visible: false }
    });
    macdChartRef.current = macdChart;
    macdGhostRef.current = macdChart.addSeries(LineSeries, { visible: false, lastValueVisible: false, priceLineVisible: false }); // Ghost
    macdHistRef.current = macdChart.addSeries(HistogramSeries, { lastValueVisible: true, title: '' });
    macdLineRef.current = macdChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, lastValueVisible: true, title: '' });
    macdSignalRef.current = macdChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, lastValueVisible: true, title: '' });
    inspectLineMacdRef.current = macdChart.addSeries(HistogramSeries, { 
      lastValueVisible: false, priceLineVisible: false, color: 'rgba(255, 255, 255, 0.3)',
      autoscaleInfoProvider: () => null
    });

    // 3. StochRSI Chart
    const stochChart = createChart(stochChartContainerRef.current, {
      ...commonOptions,
      height: isMobile ? 57 : 85,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: isMobile ? 60 : 80 },
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
    inspectLineStochRef.current = stochChart.addSeries(HistogramSeries, { 
      lastValueVisible: false, priceLineVisible: false, color: 'rgba(255, 255, 255, 0.3)',
      autoscaleInfoProvider: () => null
    });

    // 4. ADX Chart
    const adxChart = createChart(adxChartContainerRef.current, {
      ...commonOptions,
      height: isMobile ? 47 : 69,
      rightPriceScale: { visible: true, borderColor: 'rgba(197, 203, 206, 0.1)', minimumWidth: isMobile ? 60 : 80 },
      leftPriceScale: { visible: false }
    });
    adxChartRef.current = adxChart;
    adxGhostRef.current = adxChart.addSeries(LineSeries, { visible: false, lastValueVisible: false, priceLineVisible: false }); // Ghost
    adxSeriesRef.current = adxChart.addSeries(LineSeries, { color: '#f3ba2f', lineWidth: 2, lastValueVisible: true, title: '' });
    
    // Threshold line for ADX (e.g., 30) using createPriceLine for stability
    adxSeriesRef.current.createPriceLine({
      price: 30,
      color: 'rgba(132,142,156,0.4)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Threshold',
    });

    inspectLineAdxRef.current = adxChart.addSeries(HistogramSeries, { 
      lastValueVisible: false, priceLineVisible: false, color: 'rgba(255, 255, 255, 0.3)',
      autoscaleInfoProvider: () => null
    });

    const charts = [priceChart, macdChart, stochChart, adxChart];
    const syncSeriesList = [candlestickSeries, macdLineRef.current, stochKRef.current, adxSeriesRef.current];

    let syncCleanup = null;
    let isFetchingMore = false;

    const fetchMorePastData = async () => {
      if (isFetchingMore || dataRef.current.length === 0 || inspectTime) return;
      isFetchingMore = true;
      try {
        const firstTimestamp = dataRef.current[0].time * 1000;
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500&endTime=${firstTimestamp - 1}`;
        const response = await fetch(url);
        const moreData = await response.json();

        if (moreData.length > 0 && !isDestroyed) {
          const formattedMore = moreData.map(d => ({
            time: Math.floor(d[0] / 1000),
            open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
          }));

          const newData = [...formattedMore, ...dataRef.current];
          dataRef.current = newData;

          const allCloses = newData.map(d => d.close);
          const allRsi = calculateRSI(allCloses);
          const allMacd = calculateMACD(allCloses);
          const allStoch = calculateStochRSI(allRsi);
          const allBB = calculateBollingerBands(allCloses);
          const allAdx = calculateADX(newData);

          candlestickSeries.setData(newData);
          if (macdLineRef.current) macdLineRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allMacd.macdLine[i] })).filter(d => d.value !== null));
          if (macdSignalRef.current) macdSignalRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allMacd.signalLine[i] })).filter(d => d.value !== null));
          if (macdHistRef.current) macdHistRef.current.setData(newData.map((d, i) => ({
            time: d.time, value: allMacd.histogram[i], color: allMacd.histogram[i] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
          })).filter(d => d.value !== null));
          if (stochKRef.current) stochKRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allStoch.kLine[i] })).filter(d => d.value !== null));
          if (stochDRef.current) stochDRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allStoch.dLine[i] })).filter(d => d.value !== null));
          if (bbMiddleRef.current) bbMiddleRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allBB.middle[i] })).filter(d => d.value !== null));
          if (bbUpperRef.current) bbUpperRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allBB.upper[i] })).filter(d => d.value !== null));
          if (bbLowerRef.current) bbLowerRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allBB.lower[i] })).filter(d => d.value !== null));
          if (adxSeriesRef.current) adxSeriesRef.current.setData(newData.map((d, i) => ({ time: d.time, value: allAdx[i] })).filter(d => d.value !== null));

          if (stoch80Ref.current) stoch80Ref.current.setData(newData.map(d => ({ time: d.time, value: 80 })));
          if (stochFillRef.current) stochFillRef.current.setData(newData.map(d => ({ time: d.time, value: 80 })));

          const ghostData = newData.map(d => ({ time: d.time, value: 0 }));
          if (priceGhostRef.current) priceGhostRef.current.setData(ghostData);
          if (macdGhostRef.current) macdGhostRef.current.setData(ghostData);
          if (stochGhostRef.current) stochGhostRef.current.setData(ghostData);
          if (adxGhostRef.current) adxGhostRef.current.setData(ghostData);
          if (adxChartRef.current) {
            // Updated ghost and threshold for ADX
            const adxThreshold = parseFloat(rule?.long?.adxThreshold || 30);
            // Threshold line sync (this is a bit hacky with lightweight-charts without keeping a ref to every single series)
            // But we can just use the ghost for adx too
          }
        }
      } catch (err) { console.error('Error loading more history:', err); }
      finally { isFetchingMore = false; }
    };

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

          // Lazy load: if near the left edge, fetch more
          if (range.from < 50) fetchMorePastData();
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
              const adx = calculateADX(dataRef.current);
              setMacdLegend({ hist: histogram[dataIndex], macd: macdLine[dataIndex], signal: signalLine[dataIndex] });
              setStochLegend({ k: kLine[dataIndex], d: dLine[dataIndex] });
              setAdxLegend(adx[dataIndex]);
              if (onDataUpdate) onDataUpdate({ m: macdLine[dataIndex], s: signalLine[dataIndex], h: histogram[dataIndex], k: kLine[dataIndex], d: dLine[dataIndex], adx: adx[dataIndex] });
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
        const fetchLimit = 1000; // Increase limit to fill both sides + indicators
        let url;
        if (inspectTime) {
          const intervalSec = interval === '5m' ? 300 : interval === '1h' ? 3600 : 86400;
          // Fetch data that ends 500 candles after inspectTime to put it in the middle
          const futureEndTime = (inspectTime + (fetchLimit / 2) * intervalSec) * 1000;
          url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${fetchLimit}&endTime=${futureEndTime}`;
        } else {
          url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${fetchLimit}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        if (isDestroyed) return;

        const allData = data.map(d => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])
        }));

        dataRef.current = allData;

        const allCloses = allData.map(d => d.close);
        const allRsi = calculateRSI(allCloses);
        const allMacd = calculateMACD(allCloses);
        const allStoch = calculateStochRSI(allRsi);
        const allBB = calculateBollingerBands(allCloses);
        const allAdx = calculateADX(allData);

        candlestickSeries.setData(allData);
        if (bbMiddleRef.current) bbMiddleRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allBB.middle[i] })).filter(d => d.value !== null));
        if (bbUpperRef.current) bbUpperRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allBB.upper[i] })).filter(d => d.value !== null));
        if (bbLowerRef.current) bbLowerRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allBB.lower[i] })).filter(d => d.value !== null));
        if (macdLineRef.current) macdLineRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allMacd.macdLine[i] })).filter(d => d.value !== null));
        if (macdSignalRef.current) macdSignalRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allMacd.signalLine[i] })).filter(d => d.value !== null));
        if (macdHistRef.current) macdHistRef.current.setData(allData.map((d, i) => ({
          time: d.time, value: allMacd.histogram[i], color: allMacd.histogram[i] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        })).filter(d => d.value !== null));
        if (stochKRef.current) stochKRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allStoch.kLine[i] })).filter(d => d.value !== null));
        if (stochDRef.current) stochDRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allStoch.dLine[i] })).filter(d => d.value !== null));
        if (adxSeriesRef.current) adxSeriesRef.current.setData(allData.map((d, i) => ({ time: d.time, value: allAdx[i] })).filter(d => d.value !== null));

        if (stoch80Ref.current) stoch80Ref.current.setData(allData.map(d => ({ time: d.time, value: 80 })));
        if (stochFillRef.current) stochFillRef.current.setData(allData.map(d => ({ time: d.time, value: 80 })));

        const ghostData = allData.map(d => ({ time: d.time, value: 0 }));
        if (priceGhostRef.current) priceGhostRef.current.setData(ghostData);
        if (macdGhostRef.current) macdGhostRef.current.setData(ghostData);
        if (stochGhostRef.current) stochGhostRef.current.setData(ghostData);
        if (adxGhostRef.current) adxGhostRef.current.setData(ghostData);

        setTimeout(() => {
          const total = allData.length;
          let viewFrom, viewTo;
          
          if (inspectTime) {
            // Symmetrical Past Mode: Center at 50% AND Fill screen with data
            const targetI = allData.findIndex(d => d.time >= inspectTime);
            const pivot = targetI === -1 ? total - 1 : targetI;
            
            // Show 'limit' candles centered at pivot
            const halfLimit = Math.floor(limit / 2);
            viewFrom = pivot - halfLimit;
            viewTo = pivot + halfLimit;
          } else {
            // Live Mode: Position at 90% (Right-side margin)
            viewFrom = total - Math.floor(limit * 0.9);
            viewTo = total + Math.ceil(limit * 0.1);
          }
          
          charts.forEach(c => {
            c.timeScale().setVisibleLogicalRange({ from: viewFrom, to: viewTo });
          });
        }, 200);

        const lastI = allData.length - 1;
        setMacdLegend({ hist: allMacd.histogram[lastI], macd: allMacd.macdLine[lastI], signal: allMacd.signalLine[lastI] });
        setStochLegend({ k: allStoch.kLine[lastI], d: allStoch.dLine[lastI] });
        if (onDataUpdate) onDataUpdate({ m: allMacd.macdLine[lastI], s: allMacd.signalLine[lastI], h: allMacd.histogram[lastI], k: allStoch.kLine[lastI], d: allStoch.dLine[lastI], adx: allData.length > 0 ? calculateADX(allData)[lastI] : 0 });

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
  }, [symbol, interval, limit, inspectTime]);

  // Handle Real-time Streaming
  useEffect(() => {
    if (!dataLoaded || !lastCandle || !candlestickSeriesRef.current || inspectTime) return;
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
    const adxValues = calculateADX(fullData);

    const lastTime = formattedCandle.time;
    if (bbMiddleRef.current) bbMiddleRef.current.update({ time: lastTime, value: middle[fullData.length - 1] });
    if (bbUpperRef.current) bbUpperRef.current.update({ time: lastTime, value: upper[fullData.length - 1] });
    if (bbLowerRef.current) bbLowerRef.current.update({ time: lastTime, value: lower[fullData.length - 1] });
    if (macdLineRef.current) macdLineRef.current.update({ time: lastTime, value: mLine[fullData.length - 1] });
    if (macdSignalRef.current) macdSignalRef.current.update({ time: lastTime, value: sLine[fullData.length - 1] });
    if (macdHistRef.current) macdHistRef.current.update({ time: lastTime, value: hist[fullData.length - 1], color: hist[fullData.length - 1] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)' });
    if (stochKRef.current) stochKRef.current.update({ time: lastTime, value: kLine[fullData.length - 1] });
    if (stochDRef.current) stochDRef.current.update({ time: lastTime, value: dLine[fullData.length - 1] });
    if (adxSeriesRef.current) adxSeriesRef.current.update({ time: lastTime, value: adxValues[fullData.length - 1] });
    if (stoch20Ref.current) stoch20Ref.current.update({ time: lastTime, value: 20 });
    if (stoch80Ref.current) stoch80Ref.current.update({ time: lastTime, value: 80 });
    if (stochFillRef.current) stochFillRef.current.update({ time: lastTime, value: 80 });

    const ghostUpdate = { time: lastTime, value: 0 };
    if (priceGhostRef.current) priceGhostRef.current.update(ghostUpdate);
    if (macdGhostRef.current) macdGhostRef.current.update(ghostUpdate);
    if (stochGhostRef.current) stochGhostRef.current.update(ghostUpdate);
    if (adxGhostRef.current) adxGhostRef.current.update(ghostUpdate);

    // Update Legends for live candle
    const lastI = fullData.length - 1;
    setMacdLegend({ hist: hist[lastI], macd: mLine[lastI], signal: sLine[lastI] });
    setStochLegend({ k: kLine[lastI], d: dLine[lastI] });
    setAdxLegend(adxValues[lastI]);
    if (onDataUpdate) onDataUpdate({ m: mLine[lastI], s: sLine[lastI], h: hist[lastI], k: kLine[lastI], d: dLine[lastI], adx: adxValues[lastI] });

  }, [lastCandle, dataLoaded]);

  // Handle Signal Evaluation (Unified logic for both Live and Past)
  useEffect(() => {
    if (!dataLoaded) return;
    const fullData = dataRef.current;
    if (fullData.length === 0) return;

    const i = fullData.length - 2; // Default to last completed candle
    if (i < 0) return; // Not enough data
    const evalIdx = inspectTime ? fullData.findIndex(d => d.time <= inspectTime && d.time + (interval === '5m' ? 300 : interval === '1h' ? 3600 : 86400) > inspectTime) : i;
    const targetIdx = evalIdx === -1 ? i : evalIdx;

    const closes = fullData.map(d => d.close);
    const rsiValues = calculateRSI(closes);
    const { macdLine: mLine, signalLine: sLine } = calculateMACD(closes);
    const { kLine, dLine } = calculateStochRSI(rsiValues);
    const adxValues = calculateADX(fullData);


    // Update Legends to match the target signal point
    setMacdLegend({ hist: mLine[targetIdx] - sLine[targetIdx], macd: mLine[targetIdx], signal: sLine[targetIdx] });
    setStochLegend({ k: kLine[targetIdx], d: dLine[targetIdx] });
    setAdxLegend(adxValues[targetIdx]);

    if (onDataUpdate) onDataUpdate({ m: mLine[targetIdx], s: sLine[targetIdx], h: mLine[targetIdx] - sLine[targetIdx], k: kLine[targetIdx], d: dLine[targetIdx], adx: adxValues[targetIdx] });

    // DRAW MARKERS AT INSPECTION POINT
    if (inspectTime && dataLoaded) {
      if (candlestickSeriesRef.current && typeof candlestickSeriesRef.current.setMarkers === 'function') {
        candlestickSeriesRef.current.setMarkers([{ time: inspectTime, position: 'inBar', color: '#f3ba2f', shape: 'circle', size: 1.5 }]);
      }
      if (macdLineRef.current && typeof macdLineRef.current.setMarkers === 'function') {
        macdLineRef.current.setMarkers([{ time: inspectTime, position: 'inBar', color: '#2962FF', shape: 'circle', size: 1 }]);
      }
      if (stochKRef.current && typeof stochKRef.current.setMarkers === 'function') {
        stochKRef.current.setMarkers([{ time: inspectTime, position: 'inBar', color: '#26a69a', shape: 'circle', size: 1 }]);
      }
      if (adxSeriesRef.current && typeof adxSeriesRef.current.setMarkers === 'function') {
        adxSeriesRef.current.setMarkers([{ time: inspectTime, position: 'inBar', color: '#f3ba2f', shape: 'circle', size: 1 }]);
      }
    } else {
      if (candlestickSeriesRef.current && typeof candlestickSeriesRef.current.setMarkers === 'function') candlestickSeriesRef.current.setMarkers([]);
      if (macdLineRef.current && typeof macdLineRef.current.setMarkers === 'function') macdLineRef.current.setMarkers([]);
      if (stochKRef.current && typeof stochKRef.current.setMarkers === 'function') stochKRef.current.setMarkers([]);
      if (adxSeriesRef.current && typeof adxSeriesRef.current.setMarkers === 'function') adxSeriesRef.current.setMarkers([]);
    }

    evaluateSignal(mLine[targetIdx], sLine[targetIdx], kLine[targetIdx], dLine[targetIdx], adxValues[targetIdx]);
  }, [dataLoaded, lastCandle, inspectTime]);

  // Sync Vertical Inspection Line (Enhanced Visibility & Accuracy)
  useEffect(() => {
    if (!dataLoaded || !priceChartRef.current || !inspectTime) return;

    const updateLine = () => {
      // 차트 데이터 중 inspectTime에 가장 인접한 실제 캔들 시점 찾기 (좌표 정규화)
      const chart = priceChartRef.current;
      if (!chart || !dataRef.current) return;

      const timeScale = chart.timeScale();
      const targetCandle = dataRef.current.find(d => d.time >= inspectTime) || dataRef.current[dataRef.current.length - 1];
      if (!targetCandle) return;
      const x = timeScale.timeToCoordinate(targetCandle.time);
      
      const line = document.getElementById(`inspect-line-${interval}`);
      if (line) {
        if (x === null || x < -10 || x > (timeScale.width() || 0) + 10) {
          line.style.display = 'none';
        } else {
          line.style.display = 'block';
          line.style.left = `${x + 10}px`; // +10 for chart-wrapper padding
        }
      }
    };

    priceChartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updateLine);
    // 렌더링 완료를 기다리기 위해 다중 체크
    const timers = [100, 300, 1000].map(t => setTimeout(updateLine, t));

    return () => {
      timers.forEach(clearTimeout);
      if (priceChartRef.current) {
        priceChartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateLine);
      }
    };
  }, [dataLoaded, inspectTime, interval]);

  const evaluateSignal = (lastM, lastS, lastK, lastD, lastADX) => {
    let isLong = true; let isShort = true;
    if (lastM === null || lastS === null) { isLong = false; isShort = false; }
    else {
      // ADX Filter
      const adxOk = (rule?.long?.adxEnabled || rule?.short?.adxEnabled)
        ? (lastADX !== null && lastADX >= parseFloat(rule.long?.adxThreshold || rule.short?.adxThreshold || 30))
        : true;

      if (rule?.long) {
        let activeLongCondCount = 0;
        if (rule.long.macdValueEnabled) { activeLongCondCount++; if (!(lastM < parseFloat(rule.long.macdValue))) isLong = false; }
        if (rule.long.macdCrossEnabled) { activeLongCondCount++; if (!(lastM > lastS)) isLong = false; }
        if (rule.long.stochCrossEnabled) { activeLongCondCount++; if (!(lastD !== null && lastK !== null && lastD < lastK)) isLong = false; }
        if (rule.long.macdHistEnabled) { activeLongCondCount++; if (!(Math.abs(lastM - lastS) > parseFloat(rule.long.macdHistValue))) isLong = false; }
        if (rule.long.adxEnabled) { activeLongCondCount++; if (!adxOk) isLong = false; }
        if (activeLongCondCount === 0) isLong = false;
      } else isLong = false;

      if (rule?.short) {
        let activeShortCondCount = 0;
        if (rule.short.macdValueEnabled) { activeShortCondCount++; if (!(lastM > parseFloat(rule.short.macdValue))) isShort = false; }
        if (rule.short.macdCrossEnabled) { activeShortCondCount++; if (!(lastM < lastS)) isShort = false; }
        if (rule.short.stochCrossEnabled) { activeShortCondCount++; if (!(lastD !== null && lastK !== null && lastD > lastK)) isShort = false; }
        if (rule.short.macdHistEnabled) { activeShortCondCount++; if (!(Math.abs(lastM - lastS) > parseFloat(rule.short.macdHistValue))) isShort = false; }
        if (rule.short.adxEnabled) { activeShortCondCount++; if (!adxOk) isShort = false; }
        if (activeShortCondCount === 0) isShort = false;
      } else isShort = false;
    }

    const currentSignal = isLong ? 'long' : (isShort ? 'short' : 'hold');
    setBorderColor(isLong ? '#26a69a' : (isShort ? '#ef5350' : '#f3ba2f'));
    if (onSignalUpdate) onSignalUpdate(currentSignal);
  };

  const formatVal = (val) => (val !== undefined && val !== null && !isNaN(val) ? val.toFixed(2) : '0.00');

  return (
    <div className="chart-wrapper" style={{ border: `4px solid ${borderColor}`, borderRadius: '12px', position: 'relative', overflow: 'hidden', padding: '10px', background: '#161a1e', transition: 'border-color 0.3s ease' }}>
      
      {inspectTime && (
        <div 
          id={`inspect-line-${interval}`}
          style={{
            position: 'absolute', top: '10px', bottom: '10px', width: '0', 
            borderLeft: '2px dashed rgba(243, 186, 47, 0.6)',
            pointerEvents: 'none', zIndex: 100, display: 'none'
          }} 
        >
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(22, 26, 30, 0.85)', color: '#f3ba2f', padding: '4px 8px',
            borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
            border: '1px solid rgba(243, 186, 47, 0.3)', pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {(() => {
              const d = new Date(inspectTime * 1000);
              return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            })()}
          </div>
        </div>
      )}

      <div ref={priceChartContainerRef} style={{ width: '100%', position: 'relative' }} />

      <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '11px', display: 'flex', gap: '15px', flexWrap: 'wrap', rowGap: '5px', color: '#848e9c', marginBottom: '2px', marginTop: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>MACD</span>
        <span style={{ color: macdLegend.hist >= 0 ? '#26a69a' : '#ef5350' }}>Hist: {formatVal(macdLegend.hist)}</span>
        <span style={{ color: '#2962FF' }}>MACD: {formatVal(macdLegend.macd)}</span>
        <span style={{ color: '#FF6D00' }}>Signal: {formatVal(macdLegend.signal)}</span>
      </div>
      <div ref={macdChartContainerRef} style={{ width: '100%', position: 'relative' }} />

      <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '11px', display: 'flex', gap: '15px', flexWrap: 'wrap', rowGap: '5px', color: '#848e9c', marginBottom: '2px', marginTop: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>Stoch RSI</span>
        <span style={{ color: '#26a69a' }}>%K: {formatVal(stochLegend.k)}</span>
        <span style={{ color: '#ef5350' }}>%D: {formatVal(stochLegend.d)}</span>
      </div>
      <div ref={stochChartContainerRef} style={{ width: '100%', position: 'relative' }} />

      <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '11px', display: 'flex', gap: '15px', flexWrap: 'wrap', rowGap: '5px', color: '#848e9c', marginBottom: '2px', marginTop: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>ADX</span>
        <span style={{ color: '#f3ba2f' }}>Value: {formatVal(adxLegend)}</span>
      </div>
      <div ref={adxChartContainerRef} style={{ width: '100%', position: 'relative' }} />

    </div>
  );
};

export default PriceChart;
