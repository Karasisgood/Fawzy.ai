import {useEffect, useState} from 'react';
import type {FormEvent} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  MailCheck,
  Moon,
  RefreshCw,
  Sun,
  UserPlus,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {auth, BLUEPRINT_LIMITS} from '../firebase';
import type {ThemePreference} from '../types';
import {BrandLogo} from './BrandLogo';

interface AuthGateProps {
  theme: ThemePreference;
  unverifiedEmail: string | null;
  onToggleTheme: () => void;
  onVerificationSent: (email: string) => void;
  onCheckVerification: () => Promise<boolean>;
  onResendVerification: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

function mapAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as {code?: unknown}).code)
      : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');

  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters long.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Incorrect email or password. Please check your details and try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled in Firebase Console.';
  }
  return msg || 'Unable to complete authentication. Please try again.';
}

export function AuthGate({
  theme,
  unverifiedEmail,
  onToggleTheme,
  onVerificationSent,
  onCheckVerification,
  onResendVerification,
  onSignOut,
}: AuthGateProps) {
  const [tab, setTab] = useState<'signup' | 'signin'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const isDarkActive =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail || trimmedEmail.length > BLUEPRINT_LIMITS.EMAIL_MAX) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (tab === 'signup') {
      if (
        trimmedUsername.length < BLUEPRINT_LIMITS.USERNAME_MIN ||
        trimmedUsername.length > BLUEPRINT_LIMITS.USERNAME_MAX
      ) {
        setError(
          `Username must be between ${BLUEPRINT_LIMITS.USERNAME_MIN} and ${BLUEPRINT_LIMITS.USERNAME_MAX} characters.`,
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (tab === 'signup') {
        const validateRes = await fetch('/api/auth/validate-email', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: trimmedEmail}),
        });

        const validateData = (await validateRes.json()) as {
          valid?: boolean;
          error?: string;
        };

        if (!validateRes.ok || !validateData.valid) {
          setError(
            validateData.error ||
              'Please use a real, valid email address. Fake or disposable emails are not allowed.',
          );
          return;
        }

        const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(credential.user, {displayName: trimmedUsername});
        await sendEmailVerification(credential.user);

        setUsername('');
        setEmail('');
        setPassword('');
        setResendCooldown(30);
        onVerificationSent(trimmedEmail);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        setPassword('');
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your account email above first, then click Forgot password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setNotice(`Password reset link sent to ${trimmedEmail}. Check your inbox and spam folder.`);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheck = async () => {
    setError(null);
    setNotice(null);
    setIsChecking(true);
    try {
      const verified = await onCheckVerification();
      if (!verified) {
        setError(
          'Your email is not verified yet. Open the verification link in your inbox (or spam folder), then try again.',
        );
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      await onResendVerification();
      setResendCooldown(30);
      setNotice('A new verification email has been sent. Please check your inbox and spam folder.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#F8FAFC] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      {/* Minimal top header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-[#0F172A]">
        <div className="flex items-center gap-2.5">
          <BrandLogo size="sm" />
          <span className="font-display text-base font-bold tracking-tight text-[#122B8E] whitespace-nowrap shrink-0 dark:text-[#93B4F5]">
            fawzy.ai
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDarkActive ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#6892E8] hover:text-[#122B8E] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-[#6892E8] dark:hover:text-[#93B4F5]"
        >
          {isDarkActive ? (
            <>
              <Sun className="h-3.5 w-3.5" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Centered Auth / Verification Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-[#0F172A]">
          {unverifiedEmail ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#122B8E] text-white">
                  <MailCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Verify your email
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    One step left to unlock fawzy.ai
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                We sent a verification link to{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {unverifiedEmail}
                </span>
                . Fake or unverified email addresses cannot access fawzy.ai.
              </p>

              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Open the email (check your spam or junk folder if you don&apos;t see it), click the
                verification link, and then press the button below.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleCheck()}
                  disabled={isChecking}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#122B8E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0e2273] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8]"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking verification...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>I&apos;ve verified my email</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={isResending || resendCooldown > 0}
                  className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-[#6892E8] hover:text-[#122B8E] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-[#6892E8]"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <span>Resend available in {resendCooldown}s</span>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Resend verification email</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Use a different account</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#122B8E] text-white">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {tab === 'signup' ? 'Create an account' : 'Sign in to fawzy.ai'}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sign in or create a verified account to access Chat &amp; Code Studio.
                  </p>
                </div>
              </div>

              {/* Segmented mode switcher */}
              <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setError(null);
                    setNotice(null);
                  }}
                  className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                    tab === 'signup'
                      ? 'bg-[#122B8E] text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setError(null);
                    setNotice(null);
                  }}
                  className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] ${
                    tab === 'signin'
                      ? 'bg-[#122B8E] text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Sign in
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {tab === 'signup' && (
                  <div>
                    <label
                      htmlFor="gate-username"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Username
                    </label>
                    <input
                      id="gate-username"
                      type="text"
                      required
                      minLength={BLUEPRINT_LIMITS.USERNAME_MIN}
                      maxLength={BLUEPRINT_LIMITS.USERNAME_MAX}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your_username"
                      autoComplete="username"
                      className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#6892E8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6892E8]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="gate-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Email
                  </label>
                  <input
                    id="gate-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    autoComplete="email"
                    className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#6892E8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6892E8]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
                  />
                  {tab === 'signup' && (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Use a real email address. Disposable or fake emails are blocked and require
                      verification.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="gate-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Password
                    </label>
                    {tab === 'signin' && (
                      <button
                        type="button"
                        onClick={() => void handleForgotPassword()}
                        disabled={isSubmitting}
                        className="text-xs font-medium text-[#122B8E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-[#93B4F5]"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="gate-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                    className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#6892E8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6892E8]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#122B8E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0e2273] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{tab === 'signup' ? 'Validating & creating...' : 'Signing in...'}</span>
                    </>
                  ) : tab === 'signup' ? (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Create account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Sign in</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
