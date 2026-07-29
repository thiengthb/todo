'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Light/dark control, in the two shapes the apps actually use:
 *
 *  - `icon`   — a ghost icon button (top bar, header actions). The default.
 *  - `switch` — a labelled row with a Switch (a settings list, an expanded sidebar).
 *  - `both`   — renders both and lets the sidebar's collapsed state pick, via
 *               `group-data-[collapsible=icon]` (the shadcn sidebar sets that attribute).
 *
 * Two things were inconsistent across the copies this replaces, so they are settled here:
 * the icon shows the CURRENT theme (Moon while dark), and the aria-label names the ACTION
 * ("switch to light"). One app had those two contradicting each other.
 *
 * All copy is a prop, because user-facing text follows the product's language, not this file's.
 */

// `useSyncExternalStore` with a no-op subscribe is the smallest correct mounted-guard: the server
// snapshot is always `false`, so the first client render matches the server and there is no hydration
// mismatch — without the extra render an effect-based guard costs.
const emptySubscribe = () => () => {};

interface ThemeToggleProps {
  shape?: 'icon' | 'switch' | 'both';
  labels?: {
    /** Row label in `switch`/`both` shape. */
    row?: string;
    /** aria-label while the dark theme is active (i.e. the action is "go light"). */
    toLight?: string;
    /** aria-label while the light theme is active. */
    toDark?: string;
  };
  className?: string;
}

export function ThemeToggle({ shape = 'icon', labels, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === 'dark';
  const toggle = () => setTheme(isDark ? 'light' : 'dark');
  const ariaLabel = isDark
    ? (labels?.toLight ?? 'Switch to the light theme')
    : (labels?.toDark ?? 'Switch to the dark theme');
  const Icon = isDark ? Moon : Sun;

  const iconButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={ariaLabel}
      className={cn(
        shape === 'both' && 'hidden size-7 group-data-[collapsible=icon]:flex',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );

  const switchRow = (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md px-2 py-1',
        shape === 'both' && 'group-data-[collapsible=icon]:hidden',
        shape === 'switch' && className,
      )}
    >
      <span className="flex items-center gap-2 text-sm">
        <Icon className="size-4" aria-hidden />
        {labels?.row ?? 'Dark theme'}
      </span>
      <Switch checked={isDark} onCheckedChange={toggle} aria-label={ariaLabel} />
    </div>
  );

  if (shape === 'icon') return iconButton;
  if (shape === 'switch') return switchRow;
  return (
    <>
      {switchRow}
      {iconButton}
    </>
  );
}
