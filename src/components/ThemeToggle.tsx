import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The initial theme is applied by the inline script in index.html before first
 * paint, so this component only has to read back what that script decided and
 * write on explicit user action.
 *
 * Previously two effects raced here: the [dark] effect ran first and wrote
 * `theme: 'light'` to localStorage before the mount effect could read the saved
 * value, which silently destroyed a saved dark preference on every reload.
 */
function getInitialTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function ThemeToggle() {
  const [dark, setDark] = useState(getInitialTheme);

  // Keep the DOM in sync if the theme is changed elsewhere (e.g. another tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) setDark(e.newValue === 'dark');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="neo-flat h-9 w-9"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
    >
      {dark ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-foreground" />}
    </Button>
  );
}
