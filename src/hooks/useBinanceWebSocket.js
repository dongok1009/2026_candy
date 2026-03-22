import { useState, useEffect, useRef } from 'react';

export const useBinanceWebSocket = (symbol = 'BTCUSDT', interval = '1m') => {
  const [lastCandle, setLastCandle] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [prevParams, setPrevParams] = useState({ symbol, interval });
  const ws = useRef(null);

  // Immediate reset on symbol/interval change (during render)
  if (prevParams.symbol !== symbol || prevParams.interval !== interval) {
    setLastCandle(null);
    setPrevParams({ symbol, interval });
  }

  useEffect(() => {
    let isMounted = true;
    const reconnectTimeout = { id: null };
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const url = `wss://fstream.binance.com/ws/${streamName}`;

    const connect = () => {
      if (!isMounted) return;
      
      if (ws.current) {
        ws.current.close();
      }

      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        if (isMounted) {
          console.log(`WebSocket Connected: ${streamName}`);
          setIsConnected(true);
        }
      };

      ws.current.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.e === 'kline') {
            const k = data.k;
            setLastCandle({
              symbol: symbol,
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isFinal: k.x
            });
          }
        } catch (e) {
          console.error('WS Parse Error', e);
        }
      };

      ws.current.onclose = () => {
        if (isMounted) {
          console.log('WebSocket Disconnected. Reconnecting...');
          setIsConnected(false);
          reconnectTimeout.id = setTimeout(connect, 3000);
        }
      };

      ws.current.onerror = (err) => {
        console.error('WS Error:', err);
        if (ws.current) ws.current.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout.id) clearTimeout(reconnectTimeout.id);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [symbol, interval]);

  return { lastCandle, isConnected };
};
