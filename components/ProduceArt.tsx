import { Apple, Bean, Beef, Carrot, Drumstick, Egg, Leaf, Milk, Sprout, Wheat, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Placeholder artwork for a listing without a photo.
 *
 * One icon per category, tinted with the brand tokens, plus the produce name.
 * It replaces per-category emoji, which rendered differently on every device
 * and were often wrong for the item (tomatoes, onions and butternut all showed
 * lettuce). Naming the produce keeps the tile honest even when the icon is
 * only the category's.
 */
// `tint` colours the tile and icon only; the label stays in the text colour so
// it reads in both themes (the earth brown alone was illegible in dark mode).
const CATEGORY: Record<string, { icon: LucideIcon; tint: string }> = {
  Vegetables: { icon: Carrot, tint: 'bg-primary/10 text-primary dark:text-fresh' },
  Fruits: { icon: Apple, tint: 'bg-warning/10 text-warning' },
  Grains: { icon: Wheat, tint: 'bg-accent/15 text-accent-dark dark:text-accent' },
  Legumes: { icon: Bean, tint: 'bg-earth/10 text-earth dark:text-accent' },
  Livestock: { icon: Beef, tint: 'bg-earth/10 text-earth dark:text-accent' },
  Dairy: { icon: Milk, tint: 'bg-secondary text-secondary-foreground dark:text-fresh' },
  Poultry: { icon: Drumstick, tint: 'bg-accent/15 text-accent-dark dark:text-accent' },
  Herbs: { icon: Leaf, tint: 'bg-fresh/15 text-primary dark:text-fresh' },
};

/** A closer icon than the category's when the produce name names one. */
const BY_NAME: [RegExp, LucideIcon][] = [[/egg/i, Egg], [/milk/i, Milk]];

export function ProduceArt({
  category,
  produceType,
  size = 'md',
  className,
}: {
  category: string;
  produceType?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const base = CATEGORY[category] ?? { icon: Sprout, tint: 'bg-primary/10 text-primary dark:text-fresh' };
  const Icon = BY_NAME.find(([re]) => produceType && re.test(produceType))?.[1] ?? base.icon;
  const { tint } = base;
  const iconSize = { sm: 'h-7 w-7', md: 'h-12 w-12', lg: 'h-20 w-20' }[size];

  return (
    <div
      className={cn('flex h-full w-full flex-col items-center justify-center gap-2', tint, className)}
      role="img"
      aria-label={produceType ? `${produceType} (${category})` : category}
    >
      <Icon className={iconSize} strokeWidth={1.5} aria-hidden />
      {produceType && size !== 'sm' && (
        <span className={cn('font-medium text-foreground/80', size === 'lg' ? 'text-base' : 'text-xs')}>{produceType}</span>
      )}
    </div>
  );
}
