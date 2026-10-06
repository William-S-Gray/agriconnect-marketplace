export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

/**
 * Live feedback only; lib/password.ts is the authority. Its minimum is 12, so
 * nothing shorter can score above "Too weak" here — the meter used to call an
 * 8-character password "Strong" that the server then refused.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 12) return { score: 0, label: 'Too weak', color: 'bg-destructive' };
  let score = 0;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Too weak', color: 'bg-destructive' },
    { score: 1, label: 'Weak', color: 'bg-destructive' },
    { score: 2, label: 'Fair', color: 'bg-accent' },
    { score: 3, label: 'Good', color: 'bg-primary' },
    { score: 4, label: 'Strong', color: 'bg-fresh' },
  ];

  return levels[score];
}
