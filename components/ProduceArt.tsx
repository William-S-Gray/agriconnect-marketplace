import { Apple, Bean, Beef, Carrot, Egg, Leaf, Milk, Sprout, Wheat, type LucideIcon } from 'lucide-react';
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
const CATEGORY: Record<string, { icon: LucideIcon; tint: string }> = {
  Vegetables: { icon: Carrot, tint: 'bg-primary/10 text-primary' },
  Fruits: { icon: Apple, tint: 'bg-warning/10 text-warning' },
  Grains: { icon: Wheat, tint: 'bg-accent/15 text-accent-dark' },
  Legumes: { icon: Bean, tint: 'bg-earth/10 text-earth' },
  Livestock: { icon: Beef, tint: 'bg-earth/10 text-earth' },
  Dairy: { icon: Milk, tint: 'bg-secondary text-secondary-foreground' },
  Poultry: { icon: Egg, tint: 'bg-accent/15 text-accent-dark' },
  Herbs: { icon: Leaf, tint: 'bg-fresh/15 text-primary' },
};

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
  const { icon: Icon, tint } = CATEGORY[category] ?? { icon: Sprout, tint: 'bg-primary/10 text-primary' };
  const iconSize = { sm: 'h-7 w-7', md: 'h-12 w-12', lg: 'h-20 w-20' }[size];

  return (
    <div
      className={cn('flex h-full w-full flex-col items-center justify-center gap-2', tint, className)}
      role="img"
      aria-label={produceType ? `${produceType} (${category})` : category}
    >
      <Icon className={iconSize} strokeWidth={1.5} aria-hidden />
      {produceType && size !== 'sm' && (
        <span className={cn('font-medium', size === 'lg' ? 'text-base' : 'text-xs')}>{produceType}</span>
      )}
    </div>
  );
}
