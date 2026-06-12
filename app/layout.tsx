import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/app-shell';
import { prisma } from '@/lib/db';
import { todayStr } from '@/lib/dates';
import { computeStreaks } from '@/lib/streak';
import './globals.css';

// The streak shows on the menu bar => the layout must render dynamically from data on every request
export const dynamic = 'force-dynamic';

// Inter supports the Vietnamese subset (Geist on Google Fonts does not)
const interSans = Inter({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Smart Todo',
  description: 'Todo list cá nhân thông minh — AI đề xuất ngày mai từ dữ liệu thật',
};

// viewport-fit=cover to enable env(safe-area-inset-*) on iPhone (notch + home-indicator)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // the "active" days — compute the streak once here for the chip on the menu bar
  const activeRows = await prisma.task.findMany({
    where: { done: true },
    select: { date: true },
    distinct: ['date'],
  });
  const streak = computeStreaks(
    activeRows.map((r) => r.date),
    todayStr(),
  );

  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${interSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            <AppShell
              streak={{
                current: streak.current,
                atRisk: streak.atRisk,
                longest: streak.longest,
              }}
            >
              {children}
            </AppShell>
          </TooltipProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
