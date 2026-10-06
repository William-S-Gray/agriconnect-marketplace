'use client';

// A client component on purpose. React.lazy belongs to the client, and recharts
// is built on class components, which do not exist in the React Server
// Components environment — rendered from a server page without this
// directive, recharts was evaluated on the server and every page with a chart
// (/prices, /farm/earnings) failed with "Super expression must either be null
// or a function".
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
