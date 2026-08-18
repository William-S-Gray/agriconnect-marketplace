interface PriceTagProps {
  price: number;
  unit: string;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

export function PriceTag({ price, unit, currency = '$', size = 'md' }: PriceTagProps) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`price-display ${sizes[size]}`}>
        {currency}{price.toFixed(2)}
      </span>
      <span className="text-muted-foreground text-xs">/ {unit}</span>
    </span>
  );
}
