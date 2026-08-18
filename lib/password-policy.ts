import { z } from 'zod';

export const passwordPolicy = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character (!@#$%^&*)');

export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
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
