'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The theme itself is applied before first paint by the inline script in
 * app/layout.tsx, which sets or clears the `dark` class on <html>.
 *
 * This button therefore renders the same markup on the server and the client,
 * and lets CSS pick the icon from that class. It used to read the class into
 * state during render; the server had no document and rendered the moon, the
 * client rendered the sun, and the resulting hydration error (#418) made React
 * re-render the page — dropping the `dark` class, so dark mode only survived
 * on pages without this button.
 */
export function ThemeToggle() {
  // Follow a theme change made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        document.documentElement.classList.toggle('dark', e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* private mode: the toggle still works for this page view */
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="neo-flat h-9 w-9"
      aria-label="Toggle dark mode"
    >
      <Moon className="h-4 w-4 text-foreground dark:hidden" aria-hidden />
      <Sun className="hidden h-4 w-4 text-accent dark:block" aria-hidden />
    </Button>
  );
}
