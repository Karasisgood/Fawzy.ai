import {
  Code2,
  History,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import type {AppMode, ChatSession, UserAccount} from '../types';
import {BrandLogo} from './BrandLogo';

interface SidebarProps {
  mode: AppMode;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  user: UserAccount | null;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectMode: (mode: AppMode) => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  mode,
  isCollapsed,
  isMobileOpen,
  sessions,
  activeSessionId,
  user,
  onToggleCollapse,
  onCloseMobile,
  onNewChat,
  onSelectMode,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
  onOpenAuth,
  onSignOut,
}: SidebarProps) {
  const handleNewChat = () => {
    onNewChat();
    onCloseMobile();
  };

  const handleModeClick = (nextMode: AppMode) => {
    onSelectMode(nextMode);
    onCloseMobile();
  };

  const handleSessionClick = (sessionId: string) => {
    onSelectSession(sessionId);
    onCloseMobile();
  };

  const handleRecentsCollapsedClick = () => {
    if (isCollapsed) {
      onToggleCollapse();
    }
  };

  const isCodeActive = mode === 'code';
  const isNewChatActive = mode === 'chat' && activeSessionId === null;

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[1px] transition-opacity lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#E2E8F0] bg-[#F8FAFC] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-slate-800 dark:bg-[#0F172A] lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        } ${isCollapsed ? 'w-[268px] lg:w-[72px]' : 'w-[268px]'}`}
      >
        {/* Sidebar brand + collapse controls */}
        <div
          className={`flex h-14 shrink-0 items-center border-b border-[#E2E8F0] px-3 dark:border-slate-800 ${
            isCollapsed ? 'justify-between lg:justify-center' : 'justify-between'
          }`}
        >
          <button
            type="button"
            onClick={handleNewChat}
            className={`flex items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:hover:bg-slate-800 ${
              isCollapsed ? 'lg:hidden' : ''
            }`}
          >
            <BrandLogo size="md" />
            <span className="font-display text-base font-bold tracking-tight text-[#122B8E] whitespace-nowrap shrink-0 dark:text-[#93B4F5]">
              fawzy.ai
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#6892E8]/12 hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] lg:flex dark:text-slate-400 dark:hover:text-[#93B4F5]"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#6892E8]/12 hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] lg:hidden dark:text-slate-400 dark:hover:text-[#93B4F5]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation: New chat, Code, Recents */}
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {/* 1. New chat */}
          <button
            type="button"
            onClick={handleNewChat}
            title="New chat"
            className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
              isNewChatActive
                ? 'bg-[#122B8E] text-white'
                : 'text-slate-700 hover:bg-[#6892E8]/12 hover:text-[#122B8E] dark:text-slate-300 dark:hover:text-[#93B4F5]'
            } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <SquarePen className="h-[18px] w-[18px] shrink-0" />
            <span className={`whitespace-nowrap shrink-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              New chat
            </span>
          </button>

          {/* 2. Code Studio */}
          <button
            type="button"
            onClick={() => handleModeClick('code')}
            title="Code Studio"
            className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
              isCodeActive
                ? 'bg-[#122B8E] text-white'
                : 'text-slate-700 hover:bg-[#6892E8]/12 hover:text-[#122B8E] dark:text-slate-300 dark:hover:text-[#93B4F5]'
            } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <Code2 className="h-[18px] w-[18px] shrink-0" />
            <span className={`whitespace-nowrap shrink-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              Code
            </span>
          </button>

          {/* 3. Recents */}
          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
            {isCollapsed ? (
              <button
                type="button"
                onClick={handleRecentsCollapsedClick}
                title="Recents"
                aria-label="Expand sidebar to view Recents"
                className="hidden min-h-[42px] items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-[#6892E8]/12 hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] lg:flex dark:text-slate-400 dark:hover:text-[#93B4F5]"
              >
                <History className="h-[18px] w-[18px] shrink-0" />
              </button>
            ) : null}

            <div className={isCollapsed ? 'lg:hidden' : 'flex min-h-0 flex-1 flex-col'}>
              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-slate-400" />
                  <span>Recents</span>
                </span>
                {sessions.length > 0 && (
                  <span className="tabular-nums text-slate-400">{sessions.length}</span>
                )}
              </div>

              <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
                {sessions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                    Topic names for your conversations will appear here.
                  </p>
                ) : (
                  sessions.map((session) => {
                    const isActive = mode === 'chat' && activeSessionId === session.id;
                    return (
                      <div key={session.id} className="group relative flex items-center">
                        <button
                          type="button"
                          onClick={() => handleSessionClick(session.id)}
                          className={`flex min-h-[38px] w-full items-center rounded-lg py-1.5 pl-3 pr-8 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                            isActive
                              ? 'bg-[#122B8E] font-medium text-white'
                              : 'text-slate-600 hover:bg-[#6892E8]/12 hover:text-[#122B8E] dark:text-slate-300 dark:hover:text-[#93B4F5]'
                          }`}
                        >
                          <span className="truncate">{session.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          title="Delete chat"
                          aria-label={`Delete ${session.title}`}
                          className={`absolute right-1 flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                            isActive
                              ? 'text-white/75 hover:bg-white/15 hover:text-white'
                              : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Bottom footer: Settings & Account */}
        <div className="shrink-0 space-y-1.5 border-t border-[#E2E8F0] p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onCloseMobile();
            }}
            title="Settings"
            className={`flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#6892E8]/12 hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-slate-300 dark:hover:text-[#93B4F5] ${
              isCollapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span className={`whitespace-nowrap shrink-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              Settings
            </span>
          </button>

          {user ? (
            <div
              className={`flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900 ${
                isCollapsed ? 'lg:justify-center lg:border-0 lg:bg-transparent lg:px-0' : ''
              }`}
            >
              <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {user.username}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  onCloseMobile();
                }}
                title="Log out"
                aria-label="Log out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-[#93B4F5]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onOpenAuth();
                onCloseMobile();
              }}
              title="Sign in or create account"
              className={`flex min-h-[40px] w-full items-center gap-3 rounded-xl bg-[#122B8E] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0e2273] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                isCollapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <LogIn className="h-[18px] w-[18px] shrink-0" />
              <span className={`whitespace-nowrap shrink-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                Create account / Sign in
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
