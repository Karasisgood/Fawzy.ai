import {useEffect, useState} from 'react';
import {LogOut, Monitor, Moon, Sun, Trash2, UserCheck, X} from 'lucide-react';
import {BLUEPRINT_LIMITS} from '../firebase';
import type {ResponseStyle, ThemePreference, UserAccount, UserSettings} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  user: UserAccount | null;
  hasChats: boolean;
  onClose: () => void;
  onUpdateSettings: (next: Partial<UserSettings>) => void;
  onClearChats: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

const THEME_OPTIONS: Array<{value: ThemePreference; label: string; icon: typeof Sun}> = [
  {value: 'light', label: 'Light', icon: Sun},
  {value: 'dark', label: 'Dark', icon: Moon},
  {value: 'system', label: 'System', icon: Monitor},
];

const STYLE_OPTIONS: Array<{value: ResponseStyle; label: string; hint: string}> = [
  {value: 'balanced', label: 'Balanced', hint: 'Clear and helpful'},
  {value: 'concise', label: 'Concise', hint: 'Brief and direct'},
  {value: 'detailed', label: 'Detailed', hint: 'Step-by-step depth'},
];

export function SettingsModal({
  isOpen,
  settings,
  user,
  hasChats,
  onClose,
  onUpdateSettings,
  onClearChats,
  onOpenAuth,
  onSignOut,
}: SettingsModalProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0F172A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#F8FAFC] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {/* Appearance */}
          <section>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Appearance
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Choose how fawzy.ai looks on your device.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = settings.theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onUpdateSettings({theme: option.value})}
                    className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                      active
                        ? 'border-[#122B8E] bg-[#122B8E] text-white'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-slate-700 hover:border-[#6892E8] hover:text-[#122B8E] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-[#6892E8] dark:hover:text-[#93B4F5]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* AI Response Style */}
          <section className="border-t border-[#E2E8F0] pt-5 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Response style
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Control how detailed fawzy.ai answers are in Chat mode.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((option) => {
                const active = settings.responseStyle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onUpdateSettings({responseStyle: option.value})}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                      active
                        ? 'border-[#122B8E] bg-[#122B8E] text-white'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-slate-700 hover:border-[#6892E8] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-[#6892E8]'
                    }`}
                  >
                    <span className="text-xs font-semibold">{option.label}</span>
                    <span
                      className={`mt-0.5 text-[11px] ${
                        active ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Custom Instructions */}
          <section className="border-t border-[#E2E8F0] pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label
                htmlFor="custom-instructions"
                className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                Custom instructions
              </label>
              <span className="text-xs tabular-nums text-slate-400">
                {settings.customInstructions.length}/{BLUEPRINT_LIMITS.CUSTOM_INSTRUCTIONS_MAX}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Tell fawzy.ai about your tech stack, coding preferences, or tone.
            </p>
            <textarea
              id="custom-instructions"
              rows={3}
              maxLength={BLUEPRINT_LIMITS.CUSTOM_INSTRUCTIONS_MAX}
              value={settings.customInstructions}
              onChange={(e) => onUpdateSettings({customInstructions: e.target.value})}
              placeholder="e.g., Prefer semantic HTML, clean CSS Grid, and accessible contrast."
              className="mt-2.5 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#6892E8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6892E8]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
            />
          </section>

          {/* Code preview toggle */}
          <section className="flex items-center justify-between gap-4 border-t border-[#E2E8F0] pt-5 dark:border-slate-800">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Inline HTML preview in Chat
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Show quick Preview buttons on HTML website code returned inside Chat.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoPreviewHtml}
              onClick={() => onUpdateSettings({autoPreviewHtml: !settings.autoPreviewHtml})}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                settings.autoPreviewHtml ? 'bg-[#122B8E]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoPreviewHtml ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </section>

          {/* Account & Data */}
          <section className="space-y-3 border-t border-[#E2E8F0] pt-5 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Account &amp; history
            </h3>

            {user ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#122B8E] text-white">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user.username}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#6892E8] hover:text-[#122B8E] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-[#6892E8]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Create an account or sign in to save your chats across sessions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg bg-[#122B8E] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0e2273] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8]"
                >
                  Sign in
                </button>
              </div>
            )}

            {hasChats && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Remove all saved conversations from Recents.
                </span>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClearChats();
                        setConfirmClear(false);
                      }}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Confirm clear
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear chats</span>
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
