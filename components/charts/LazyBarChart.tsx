import { lazy, Suspense } from 'react';
import type { BarChartPanelProps } from './BarChartPanel';

// Splits recharts into its own chunk, fetched only once a chart is actually
// rendered. Use this everywhere instead of importing BarChartPanel directly.
const BarChartPanel = lazy(() => import('./BarChartPanel'));

/**
 * Reserves the chart's final height while the library loads so the surrounding
 * layout does not shift when it arrives.
 */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="w-full rounded-xl bg-muted/50 animate-pulse"
      role="img"
      aria-label="Loading chart"
    />
  );
}

export function LazyBarChart(props: BarChartPanelProps) {
  const height = props.height ?? 220;
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <BarChartPanel {...props} />
    </Suspense>
  );
}
