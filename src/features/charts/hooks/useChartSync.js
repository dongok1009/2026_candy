import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to manage synchronization of multiple lightweight-charts instances.
 * @param {Array} charts - Array of chart instances.
 */
export const useChartSync = (charts) => {
  const isSyncing = useRef(false);

  const syncVisibleRange = useCallback((range) => {
    if (isSyncing.current || !range) return;
    isSyncing.current = true;
    charts.forEach((c) => {
      if (c) c.timeScale().setVisibleLogicalRange(range);
    });
    isSyncing.current = false;
  }, [charts]);

  useEffect(() => {
    charts.forEach((chart) => {
      if (!chart) return;
      const ts = chart.timeScale();
      ts.subscribeVisibleLogicalRangeChange(syncVisibleRange);
    });

    return () => {
      charts.forEach((chart) => {
        if (!chart) return;
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncVisibleRange);
      });
    };
  }, [charts, syncVisibleRange]);

  return { syncVisibleRange };
};
