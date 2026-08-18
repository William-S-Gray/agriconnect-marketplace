/**
 * The only module in the app that imports recharts.
 *
 * recharts is ~364 kB of the build, so it is isolated here and pulled in via
 * React.lazy from LazyBarChart. Keeping it out of the route chunks lets the
 * page shell paint before the charting library finishes downloading — worth it
 * on the slow mobile connections this product targets.
 *
 * Import this module only through LazyBarChart, never directly.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface BarChartPanelProps {
  data: Array<Record<string, string | number>>;
  /** Field plotted along the x-axis. */
  xKey: string;
  /** Field plotted as bar height. */
  dataKey: string;
  height?: number;
  /** Series name shown in the tooltip. */
  name?: string;
  /** Format axis ticks and tooltip values as USD. */
  currency?: boolean;
  /** Solid bar colour. Ignored when cellColor is supplied. */
  fill?: string;
  /** Per-bar colour, by index — for palette-coloured or highlighted bars. */
  cellColor?: (index: number) => string;
  radius?: [number, number, number, number];
  margin?: { top: number; right: number; left: number; bottom: number };
}

const TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const;

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
} as const;

export default function BarChartPanel({
  data,
  xKey,
  dataKey,
  height = 220,
  name,
  currency = false,
  fill = '#4f7c3f',
  cellColor,
  radius = [4, 4, 0, 0],
  margin,
}: BarChartPanelProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={margin}>
        <XAxis dataKey={xKey} tick={TICK} />
        <YAxis tick={TICK} tickFormatter={currency ? (v) => `$${v}` : undefined} />
        <Tooltip
          formatter={currency ? (value: number) => [`$${value}`, name ?? dataKey] : undefined}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
        />
        {/*
          isAnimationActive={false} fixes a pre-existing bug: with the entry
          animation on, recharts rendered the axes but left every bar group
          empty, so the charts came up blank and only filled in once a scroll
          or resize forced a re-render. These panels are small enough that the
          grow-in animation buys nothing.
        */}
        <Bar
          dataKey={dataKey}
          name={name}
          radius={radius}
          fill={cellColor ? undefined : fill}
          isAnimationActive={false}
        >
          {cellColor && data.map((_, i) => <Cell key={i} fill={cellColor(i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
