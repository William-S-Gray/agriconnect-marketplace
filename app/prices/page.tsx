import { TrendingUp, TrendingDown, Minus as Flat } from 'lucide-react';
import { sql } from '@/lib/db';
import { num } from '@/lib/serialize';
import { SiteNav } from '@/components/SiteNav';
import { Footer } from '@/components/Footer';
import { LazyBarChart } from '@/components/charts/LazyBarChart';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Market Prices — AgriConnect' };

export default async function MarketPricesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ province?: string; category?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const province = searchParams.province && searchParams.province !== 'all' ? searchParams.province : null;
  const category = searchParams.category && searchParams.category !== 'all' ? searchParams.category : null;

  const prices = await sql<{
    id: string; produce_type: string; category: string; province: string;
    avg_price: string; min_price: string; max_price: string; listings_count: number;
  }>`
    SELECT id, produce_type, category, province, avg_price, min_price, max_price, listings_count
      FROM price_history
     WHERE (${province}::text IS NULL OR province = ${province})
       AND (${category}::text IS NULL OR category = ${category})
     ORDER BY produce_type
  `;

  // Average price per crop, highest first — the same shape the old chart used.
  const byCrop = new Map<string, { total: number; count: number }>();
  for (const p of prices) {
    const entry = byCrop.get(p.produce_type) ?? { total: 0, count: 0 };
    entry.total += num(p.avg_price);
    entry.count += 1;
    byCrop.set(p.produce_type, entry);
  }
  const chartData = [...byCrop.entries()]
    .map(([name, v]) => ({ name, price: +(v.total / v.count).toFixed(2) }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 10);

  const COLORS = ['#4f7c3f', '#7ab85a', '#a8d87f', '#c8e6a0', '#e8f5c8',
                  '#f0f9e0', '#3d6b2f', '#5a9048', '#78b560'];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Current Market Prices
          </h1>
          <p className="text-muted-foreground mt-1">
            Zimbabwe agricultural produce prices — {prices.length} data points
          </p>
        </div>

        {chartData.length > 0 && (
          <div className="neo-card p-6 mb-8">
            <h2 className="font-heading text-base font-semibold text-foreground mb-4">
              Average Price by Crop (USD / unit)
            </h2>
            <LazyBarChart
              data={chartData}
              xKey="name"
              dataKey="price"
              name="Avg Price"
              height={220}
              currency
              radius={[6, 6, 0, 0]}
              margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
              cellColor={(i) => COLORS[i % COLORS.length]!}
            />
          </div>
        )}

        <div className="neo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="neo-inset">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Crop</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Category</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">Avg</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground hidden sm:table-cell">Min</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground hidden sm:table-cell">Max</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground hidden md:table-cell">Province</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground hidden md:table-cell">Trend</th>
                </tr>
              </thead>
              <tbody>
                {prices.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">
                    No price data for the selected filters.
                  </td></tr>
                ) : prices.map((p, i) => (
                  <tr key={p.id} className={`border-t border-border/30 ${i % 2 ? 'bg-muted/10' : ''}`}>
                    <td className="p-4 font-medium text-foreground text-sm">{p.produce_type}</td>
                    <td className="p-4 text-sm text-muted-foreground">{p.category}</td>
                    <td className="p-4 text-right font-mono font-bold text-accent">
                      ${num(p.avg_price).toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                      ${num(p.min_price).toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                      ${num(p.max_price).toFixed(2)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{p.province}</td>
                    <td className="p-4 text-center hidden md:table-cell">
                      {trendIcon(num(p.min_price), num(p.max_price), num(p.avg_price))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function trendIcon(min: number, max: number, avg: number) {
  const spread = max - min;
  if (avg === 0 || spread / avg < 0.15) return <Flat className="h-4 w-4 text-muted-foreground mx-auto" />;
  if (avg > (min + max) / 2) return <TrendingUp className="h-4 w-4 text-fresh mx-auto" />;
  return <TrendingDown className="h-4 w-4 text-destructive mx-auto" />;
}
