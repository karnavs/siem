'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShieldAlert, ScrollText, ClipboardList, LogOut, Radar } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/alerts', label: 'Alerts', icon: ShieldAlert },
  { href: '/dashboard/logs', label: 'Log Explorer', icon: ScrollText },
  { href: '/dashboard/audit', label: 'Audit Trail', icon: ClipboardList, minRole: 'ADMIN' as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-base-border bg-base-panel">
      <div className="flex items-center gap-2 border-b border-base-border px-5 py-5">
        <Radar className="h-5 w-5 text-signal-amber" />
        <span className="font-display text-base font-bold tracking-tight text-ink">SentryGrid</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.minRole || user?.role === item.minRole).map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-signal-amber/10 text-signal-amber' : 'text-ink-muted hover:bg-base-raised hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-base-border p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-base-raised font-display text-xs font-semibold text-ink">
            {user?.name?.slice(0, 2).toUpperCase() ?? '??'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
            <p className="truncate text-xs text-ink-faint">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-base-raised hover:text-severity-critical"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
