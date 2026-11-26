import {useEffect, useState} from 'react';
import type {FormEvent} from 'react';
import {
  AlertCircle,
  Check,
  Code2,
  Columns2,
  Copy,
  Download,
  Eye,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
} from 'lucide-react';
import {downloadHtmlFile} from '../utils/download';

interface CodeViewProps {
  code: string;
  summary: string;
  customInstructions: string;
  onCodeChange: (nextCode: string, nextSummary?: string) => void;
}

type PaneLayout = 'split' | 'preview' | 'code';
type PreviewViewport = 'desktop' | 'mobile';

const WEBSITE_STARTERS = [
  'Modern SaaS landing page with pricing table and FAQ accordion',
  'Personal creative portfolio website with project showcase grid',
  'Interactive Pomodoro timer and focus task web app',
  'Local bakery website with featured menu and hours',
];

const DEFAULT_STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Starter Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
    }
    h1 {
      font-size: 1.5rem;
      color: #122B8E;
      margin-bottom: 0.75rem;
    }
    p {
      color: #475569;
      line-height: 1.6;
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>fawzy.ai Code Studio</h1>
    <p>Describe a website, game, or web app above to generate clean HTML, CSS, and JavaScript with an instant live preview here.</p>
  </main>
</body>
</html>`;

export function CodeView({
  code,
  summary,
  customInstructions,
  onCodeChange,
}: CodeViewProps) {
  const [prompt, setPrompt] = useState('');
  const [layout, setLayout] = useState<PaneLayout>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'preview' : 'split',
  );
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const activeHtml = code.trim() || DEFAULT_STARTER_HTML;
  const hasGeneratedCode = code.trim().length > 0;

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const generateCode = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          prompt: trimmed,
          currentCode: hasGeneratedCode ? code : '',
          customInstructions,
        }),
      });

      const data = (await response.json()) as {
        html?: string;
        summary?: string;
        error?: string;
      };

      if (!response.ok || !data.html) {
        throw new Error(data.error || 'Unable to generate code right now.');
      }

      onCodeChange(data.html, data.summary || 'Website code updated.');
      setPrompt('');
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong building your code.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void generateCode(prompt);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeHtml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white lg:overflow-hidden dark:bg-[#0B1120]">
      {/* Prompt & toolbar */}
      <div className="shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 sm:px-6 sm:py-3.5 dark:border-slate-800 dark:bg-[#0F172A]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                hasGeneratedCode
                  ? 'Ask fawzy.ai to change or add to this code (e.g., "Make it responsive with a restart button")...'
                  : 'Describe the website, game, or interactive tool you want fawzy.ai to build...'
              }
              aria-label="Describe code or website to build"
              className="min-h-[42px] w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#6892E8] focus:outline-none focus:ring-2 focus:ring-[#6892E8]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#122B8E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0e2273] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Building...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>{hasGeneratedCode ? 'Update code' : 'Build website'}</span>
              </>
            )}
          </button>
        </form>

        {!hasGeneratedCode && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {WEBSITE_STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                disabled={isGenerating}
                onClick={() => void generateCode(starter)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-left text-xs text-slate-600 transition-colors hover:border-[#6892E8] hover:text-[#122B8E] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-[#6892E8] dark:hover:text-[#93B4F5]"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Workspace controls row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {summary && (
              <p className="max-w-md truncate text-xs text-slate-600 dark:text-slate-400">
                {summary}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Layout tabs */}
            <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setLayout('split')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  layout === 'split'
                    ? 'bg-[#122B8E] text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('preview')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  layout === 'preview'
                    ? 'bg-[#122B8E] text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('code')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  layout === 'code'
                    ? 'bg-[#122B8E] text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Code</span>
              </button>
            </div>

            {layout !== 'code' && (
              <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  title="Desktop preview"
                  aria-label="Desktop preview"
                  className={`rounded-md p-1.5 transition-colors ${
                    viewport === 'desktop'
                      ? 'bg-[#122B8E] text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  title="Mobile preview"
                  aria-label="Mobile preview"
                  className={`rounded-md p-1.5 transition-colors ${
                    viewport === 'mobile'
                      ? 'bg-[#122B8E] text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  title="Reload preview"
                  aria-label="Reload preview"
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:text-[#122B8E] dark:text-slate-400 dark:hover:text-[#93B4F5]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  title="Fullscreen preview"
                  aria-label="Fullscreen preview"
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:text-[#122B8E] dark:text-slate-400 dark:hover:text-[#93B4F5]"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#6892E8] hover:text-[#122B8E] whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-[#6892E8]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#122B8E] dark:text-[#93B4F5]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => downloadHtmlFile(activeHtml, 'fawzy-ai-site')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#122B8E] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0e2273] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export HTML</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main split/tabbed editor & live preview */}
      <div
        className={`grid lg:min-h-0 lg:flex-1 ${
          layout === 'split'
            ? 'shrink-0 grid-cols-1 lg:grid-cols-2'
            : 'min-h-0 flex-1 grid-cols-1'
        }`}
      >
        {(layout === 'split' || layout === 'code') && (
          <div
            className={`flex flex-col border-b border-[#E2E8F0] bg-[#0F172A] lg:min-h-0 lg:border-r lg:border-b-0 dark:border-slate-800 ${
              layout === 'split' ? 'h-[300px] lg:h-auto' : 'min-h-[65dvh] lg:h-full'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
              <span className="font-mono">index.html</span>
              <span className="font-mono tabular-nums">
                {activeHtml.split('\n').length} lines
              </span>
            </div>
            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder={DEFAULT_STARTER_HTML}
              spellCheck={false}
              aria-label="HTML code editor"
              className="min-h-0 flex-1 resize-none bg-[#0F172A] p-4 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        )}

        {(layout === 'split' || layout === 'preview') && (
          <div
            className={`flex flex-col items-center bg-[#F1F5F9] p-2.5 sm:p-4 lg:min-h-0 dark:bg-slate-950 ${
              layout === 'split'
                ? 'h-[540px] lg:h-auto'
                : 'min-h-[70dvh] flex-1 lg:h-full'
            }`}
          >
            <div
              className={`h-full w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm transition-all dark:border-slate-800 ${
                viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
              }`}
            >
              <iframe
                key={previewKey}
                srcDoc={activeHtml}
                title="Live website preview"
                sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
                className="block h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen live preview overlay */}
      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen preview"
          className="fixed inset-0 z-50 flex flex-col bg-[#F1F5F9] dark:bg-slate-950"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 dark:border-slate-800 dark:bg-[#0F172A]">
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Live preview
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                aria-label="Reload preview"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2.5 text-xs font-medium text-slate-700 hover:border-[#6892E8] hover:text-[#122B8E] dark:border-slate-700 dark:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#122B8E] px-3 text-xs font-semibold text-white hover:bg-[#0e2273]"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit fullscreen</span>
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
            <div
              className={`h-full w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm dark:border-slate-800 ${
                viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
              }`}
            >
              <iframe
                key={`fs-${previewKey}`}
                srcDoc={activeHtml}
                title="Fullscreen live website preview"
                sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
                className="block h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
