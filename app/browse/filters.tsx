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
  initial: { q: string; province: string; category: string; organic: boolean };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string | boolean) {
    const next = new URLSearchParams(params.toString());
    const isDefault = value === '' || value === 'all' || value === false;
    if (isDefault) next.delete(key);
    else next.set(key, String(value));
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
          className="neo-inset border-none pl-9"
          aria-label="Search produce"
        />
      </form>

      <Select value={initial.province} onValueChange={(v) => update('province', v)}>
        <SelectTrigger className="w-44 neo-flat border-none"><SelectValue placeholder="All Provinces" /></SelectTrigger>
        <SelectContent className="neo-card border-none">
          <SelectItem value="all">All Provinces</SelectItem>
          {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={initial.category} onValueChange={(v) => update('category', v)}>
        <SelectTrigger className="w-44 neo-flat border-none"><SelectValue placeholder="All Categories" /></SelectTrigger>
        <SelectContent className="neo-card border-none">
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
