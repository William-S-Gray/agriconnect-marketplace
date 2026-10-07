'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/**
 * Filters drive the URL, and the server re-queries from those params. Keeping
 * state in the URL means results are shareable and bookmarkable, and there is
 * no second copy of the filter logic in the browser.
 */
export function BrowseFilters({
  provinces,
  categories,
  initial,
}: {
  provinces: string[];
  categories: string[];
  initial: { q: string; province: string; category: string; organic: boolean; sort: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Labels are passed to SelectValue explicitly: on its own it only shows the
  // selected item's text after hydration, so the server-rendered page had
  // three empty dropdowns until the JavaScript arrived.
  const SORT_LABELS: Record<string, string> = {
    newest: 'Newest first', price_asc: 'Price: low to high', price_desc: 'Price: high to low',
  };
  const provinceLabel = initial.province === 'all' ? 'All Provinces' : initial.province;
  const categoryLabel = initial.category === 'all' ? 'All Categories' : initial.category;

  function update(key: string, value: string | boolean) {
    const next = new URLSearchParams(params.toString());
    const isDefault = value === '' || value === 'all' || value === false || (key === 'sort' && value === 'newest');
    if (isDefault) next.delete(key);
    else next.set(key, String(value));
    // New filters mean a new result set: start again from its first page.
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <form
        className="relative flex-1 min-w-[220px]"
        onSubmit={(e) => {
          e.preventDefault();
          update('q', new FormData(e.currentTarget).get('q') as string);
        }}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={initial.q}
          placeholder="Search produce…"
          className="neo-inset pl-9"
          aria-label="Search produce"
        />
      </form>

      <Select value={initial.province} onValueChange={(v) => update('province', v)}>
        <SelectTrigger className="w-44 neo-flat" aria-label="Province"><SelectValue>{provinceLabel}</SelectValue></SelectTrigger>
        <SelectContent className="neo-card">
          <SelectItem value="all">All Provinces</SelectItem>
          {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={initial.category} onValueChange={(v) => update('category', v)}>
        <SelectTrigger className="w-44 neo-flat" aria-label="Category"><SelectValue>{categoryLabel}</SelectValue></SelectTrigger>
        <SelectContent className="neo-card">
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={initial.sort} onValueChange={(v) => update('sort', v)}>
        <SelectTrigger className="w-48 neo-flat" aria-label="Sort listings"><SelectValue>{SORT_LABELS[initial.sort] ?? SORT_LABELS.newest}</SelectValue></SelectTrigger>
        <SelectContent className="neo-card">
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="price_asc">Price: low to high</SelectItem>
          <SelectItem value="price_desc">Price: high to low</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Checkbox
          id="organic"
          checked={initial.organic}
          onCheckedChange={(v) => update('organic', v === true)}
        />
        <Label htmlFor="organic" className="text-sm text-foreground">Organic only</Label>
      </div>
    </div>
  );
}
