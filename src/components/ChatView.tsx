import {useEffect, useRef, useState} from 'react';
import type {ComponentPropsWithoutRef, KeyboardEvent} from 'react';
import ReactMarkdown from 'react-markdown';
import {ArrowUp, Check, Code2, Copy, Eye, RotateCcw, Square, X} from 'lucide-react';
import type {ChatMessage} from '../types';
import {BrandLogo} from './BrandLogo';

interface ChatViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  autoPreviewHtml: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onRetryLast: () => void;
  onOpenInCodeStudio: (htmlCode: string) => void;
}

const STARTER_PROMPTS = [
  {
    title: 'Build a landing page',
    prompt: 'Build a clean, responsive portfolio website in a single HTML file with a hero, projects grid, and contact section.',
  },
  {
    title: 'Interactive UI component',
    prompt: 'Create a self-contained HTML pricing section with a monthly/annual toggle and clean styling.',
  },
  {
    title: 'Explain a concept simply',
    prompt: 'Explain how DNS, HTTPS, and web hosting work together when someone opens a website.',
  },
  {
    title: 'Debug or refactor code',
    prompt: 'Write a clean TypeScript form validation helper for email, username, and password.',
  },
];

function looksLikePreviewableHtml(language: string, codeText: string): boolean {
  const lang = language.toLowerCase();
  if (lang === 'html' || lang === 'htm') return true;
  const trimmed = codeText.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    (trimmed.includes('<div') && trimmed.includes('</'))
  );
}

function wrapHtmlIfFragment(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')) {
    return trimmed;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 1.5rem; margin: 0; color: #0f172a; background: #ffffff; }
  </style>
</head>
<body>
${trimmed}
</body>
</html>`;
}

export function ChatView({
  messages,
  isStreaming,
  autoPreviewHtml,
  onSendMessage,
  onStopStreaming,
  onRetryLast,
  onOpenInCodeStudio,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, isStreaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    if (!previewHtml) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewHtml(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewHtml]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-[#0B1120]">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {isEmpty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-8 text-center">
            <BrandLogo size="lg" className="mb-5 shadow-xs" />
            <h1
              className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
              style={{textWrap: 'balance'}}
            >
              What are we building today?
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Ask fawzy.ai to write code, design websites with live previews, debug issues, or answer questions.
            </p>

            <div className="mt-8 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => onSendMessage(item.prompt)}
                  className="group flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition-all duration-150 hover:border-[#6892E8] hover:bg-[#6892E8]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:border-slate-800 dark:bg-[#0F172A] dark:hover:border-[#6892E8] dark:hover:bg-slate-800/70"
                >
                  <span className="font-display text-sm font-semibold text-slate-900 group-hover:text-[#122B8E] dark:text-slate-100 dark:group-hover:text-[#93B4F5]">
                    {item.title}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 pb-4">
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1;

              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#122B8E] px-4 py-3 text-[15px] leading-relaxed text-white whitespace-pre-wrap sm:max-w-[75%]">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const showStreamingIndicator = isStreaming && isLast && msg.text.length === 0;
              const isCopied = copiedId === msg.id;

              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <BrandLogo size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-display text-xs font-semibold text-[#122B8E] dark:text-[#93B4F5]">
                        fawzy.ai
                      </span>
                    </div>

                    {msg.isError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                        <p>{msg.text}</p>
                        {isLast && !isStreaming && (
                          <button
                            type="button"
                            onClick={onRetryLast}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#122B8E] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0e2273] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8]"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Try again</span>
                          </button>
                        )}
                      </div>
                    ) : showStreamingIndicator ? (
                      <div className="flex items-center gap-1.5 py-2" aria-label="fawzy.ai is typing">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6892E8] [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6892E8] [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6892E8]" />
                      </div>
                    ) : (
                      <>
                        <div className="fawzy-prose break-words">
                          <ReactMarkdown
                            components={{
                              code(props: ComponentPropsWithoutRef<'code'> & {inline?: boolean}) {
                                const {className, children, ...rest} = props;
                                const match = /language-([\w-]+)/.exec(className || '');
                                const lang = match?.[1] ?? '';
                                const codeString = String(children ?? '').replace(/\n$/, '');
                                const isBlock = Boolean(match) || codeString.includes('\n');

                                if (!isBlock) {
                                  return (
                                    <code className={className} {...rest}>
                                      {children}
                                    </code>
                                  );
                                }

                                const canPreview =
                                  autoPreviewHtml &&
                                  (!isStreaming || !isLast) &&
                                  looksLikePreviewableHtml(lang, codeString);

                                return (
                                  <div className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-[#0F172A]">
                                    <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2 text-xs text-slate-400">
                                      <span className="font-mono">{lang || 'code'}</span>
                                      <div className="flex items-center gap-2">
                                        {canPreview && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewHtml(wrapHtmlIfFragment(codeString))
                                              }
                                              className="inline-flex items-center gap-1 rounded-md bg-[#122B8E] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#1b3cb8]"
                                            >
                                              <Eye className="h-3 w-3" />
                                              <span>Preview</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onOpenInCodeStudio(wrapHtmlIfFragment(codeString))
                                              }
                                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:border-[#6892E8] hover:text-white"
                                            >
                                              <Code2 className="h-3 w-3" />
                                              <span>Edit in Code</span>
                                            </button>
                                          </>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleCopy(`${msg.id}-${lang}`, codeString)
                                          }
                                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                                        >
                                          {copiedId === `${msg.id}-${lang}` ? (
                                            <>
                                              <Check className="h-3 w-3 text-[#6892E8]" />
                                              <span>Copied</span>
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="h-3 w-3" />
                                              <span>Copy</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    <pre className="!m-0 !border-0 !rounded-none">
                                      <code className={className} {...rest}>
                                        {codeString}
                                      </code>
                                    </pre>
                                  </div>
                                );
                              },
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>

                        {(!isStreaming || !isLast) && msg.text.trim().length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.text)}
                              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-[#F8FAFC] hover:text-[#122B8E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-[#93B4F5]"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-[#122B8E] dark:text-[#93B4F5]" />
                                  <span className="text-[#122B8E] dark:text-[#93B4F5]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Bottom message composer */}
      <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-[#0B1120]">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-2 transition-colors focus-within:border-[#6892E8] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6892E8]/25 dark:border-slate-800 dark:bg-[#0F172A] dark:focus-within:bg-slate-900">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message fawzy.ai..."
              aria-label="Message fawzy.ai"
              className="max-h-[180px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label="Stop response"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#122B8E] text-white transition-colors hover:bg-[#0e2273] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6892E8] dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
            Press Enter to send, Shift + Enter for a new line.
          </p>
        </div>
      </div>

      {/* Inline HTML preview modal */}
      {previewHtml && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Website code preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0F172A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 dark:border-slate-800">
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Live Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const html = previewHtml;
                    setPreviewHtml(null);
                    onOpenInCodeStudio(html);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#122B8E] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0e2273]"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Open in Code Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewHtml(null)}
                  aria-label="Close preview"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              srcDoc={previewHtml}
              title="HTML code preview"
              sandbox="allow-scripts allow-forms allow-modals"
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
