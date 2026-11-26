import {Menu, Settings, User} from 'lucide-react';
import type {AppMode, UserAccount} from '../types';
import {BrandLogo} from './BrandLogo';

interface TopHeaderProps {
  mode: AppMode;
  user: UserAccount | null;
  onOpenMobileSidebar: () => void;
  onLogoClick: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
}

const MODE_TITLES: Record<AppMode, string> = {
  chat: 'Chat',
  code: 'Code Studio',
};

export function TopHeader({
  mode,
  user,
  onOpenMobileSidebar,
  onLogoClick,
  onOpenSettings,
  onOpenAuth,
}: TopHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-[#0B1120]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-[#6892E8]/12 hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] lg:hidden dark:text-slate-300 dark:hover:text-[#93B4F5]"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8]"
        >
          <BrandLogo size="sm" />
          <span className="font-display text-base font-bold tracking-tight text-[#122B8E] whitespace-nowrap shrink-0 dark:text-[#93B4F5]">
            fawzy.ai
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden text-sm font-medium text-slate-500 whitespace-nowrap shrink-0 sm:inline dark:text-slate-400">
          {MODE_TITLES[mode]}
        </span>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Open settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-[#F8FAFC] hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-[#93B4F5]"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>

        {!user && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#122B8E] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0e2273] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8]"
          >
            <User className="h-3.5 w-3.5" />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </header>
  );
}
