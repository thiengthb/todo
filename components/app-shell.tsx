'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpen,
  CalendarDays,
  History,
  Home,
  ListTodo,
  PanelLeft,
  PanelLeftClose,
  Repeat,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { StreakChip, type StreakProps } from '@/components/streak-chip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Điều hướng chính desktop — 7 mục, nhóm nhẹ bằng divider (mục giao diện, đại tu 2026-06). */
const NAV_GROUPS: NavItem[][] = [
  [
    { href: '/', label: 'Hôm nay', icon: Home },
    { href: '/schedule', label: 'Lịch tuần', icon: CalendarDays },
    { href: '/plans', label: 'Kế hoạch', icon: Target },
    { href: '/routines', label: 'Nhịp sống', icon: Repeat },
  ],
  [{ href: '/history', label: 'Lịch sử', icon: History }],
  [
    { href: '/notifications', label: 'Thông báo', icon: Bell },
    { href: '/guide', label: 'Hướng dẫn', icon: BookOpen },
  ],
];

/** 5 tab bottom bar mobile — các điểm đến dùng hằng ngày (mục giao diện). */
const MOBILE_TABS: NavItem[] = [
  { href: '/', label: 'Hôm nay', icon: Home },
  { href: '/schedule', label: 'Lịch', icon: CalendarDays },
  { href: '/plans', label: 'Kế hoạch', icon: Target },
  { href: '/routines', label: 'Nhịp sống', icon: Repeat },
  { href: '/history', label: 'Lịch sử', icon: History },
];

/** Mục "hệ thống" làm icon trên top-bar mobile (không vào bottom bar). */
const MOBILE_SECONDARY: NavItem[] = [
  { href: '/notifications', label: 'Thông báo', icon: Bell },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpen },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function SecondaryLink({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md transition-colors sm:size-8',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-[18px]" />
    </Link>
  );
}

/**
 * Khung app (mục giao diện, đại tu 2026-06): sidebar trái 7 mục trên desktop (thu gọn được),
 * top-bar + bottom tab bar 5 mục trên mobile. Nội dung căn giữa max-w-5xl.
 */
export function AppShell({ streak, children }: { streak: StreakProps; children: ReactNode }) {
  const isActive = useIsActive();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-svh w-full">
      {/* ───────── Sidebar (desktop ≥ lg) ───────── */}
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border/70 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-14 items-center gap-2 px-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <ListTodo className="size-4" />
            </span>
            {!collapsed && <span className="truncate text-sm">Smart Todo</span>}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Thu gọn thanh bên"
              className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Mở rộng thanh bên"
            className="mx-auto mb-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeft className="size-4" />
          </button>
        )}

        <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1 px-2 py-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {gi > 0 && (
                <div className={cn('my-1 h-px bg-border/70', collapsed ? 'mx-2' : 'mx-3')} />
              )}
              {group.map((item) => {
                const active = isActive(item.href);
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={item.href}>{link}</div>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          className={cn(
            'flex items-center border-t border-border/70 p-2',
            collapsed ? 'flex-col gap-1' : 'justify-between px-3',
          )}
        >
          <StreakChip {...streak} />
          <ThemeToggle />
        </div>
      </aside>

      {/* ───────── Cột nội dung ───────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top-bar (mobile) — chừa safe-area trên cùng (notch / PWA) */}
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <ListTodo className="size-4" />
            </span>
            <span className="text-sm">Smart Todo</span>
          </Link>
          <div className="flex items-center gap-0.5">
            <StreakChip {...streak} />
            {MOBILE_SECONDARY.map((item) => (
              <SecondaryLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>

        {/* Bottom tab bar (mobile) — 5 mục, chừa safe-area home-indicator iPhone */}
        <nav
          aria-label="Điều hướng chính"
          className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          {MOBILE_TABS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <item.icon className={cn('size-5 transition-transform', active && 'scale-110')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
