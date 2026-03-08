import { getPasswordStrength } from '@/lib/password-policy';

interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;
  const { score, label, color } = getPasswordStrength(password);

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? color : 'bg-border'}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Strength: {label}</p>
    </div>
  );
}
