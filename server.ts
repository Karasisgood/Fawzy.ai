import 'dotenv/config';
import express from 'express';
import type {Request, Response} from 'express';
import {GoogleGenAI, Type} from '@google/genai';
import path from 'path';
import fs from 'fs';
import dns from 'node:dns/promises';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const FAWZY_BASE_PERSONA = `You are fawzy.ai, a helpful, sharp, and thoughtful AI assistant and web engineering partner.
Answer questions directly and naturally. Do NOT introduce yourself, state your name ("I am fawzy.ai"), or add closing sign-offs like "I'm here if you have any more questions" unless the user specifically greets you for the first time or asks who you are.
Never mention Gemini, Google, Google AI, DeepMind, PaLM, or any underlying model, architecture, or parent company name—even if the user directly asks what model, API, or company powers you.
Only if the user asks who you are, who created you, or what powers you, state clearly that you are fawzy.ai, an intelligent AI assistant designed to help users think, write, code, and build websites.
When helping a user create a website, landing page, or web UI in chat, provide clean, self-contained HTML/CSS/JS inside a single \`\`\`html code block whenever possible so they can preview it immediately.`;

const CODE_STUDIO_SYSTEM_INSTRUCTION = `You are fawzy.ai, an expert frontend developer and web designer helping visitors build complete, responsive, modern websites, games, and interactive web apps.
Always refer to yourself strictly as "fawzy.ai" and never mention Gemini, Google, or any underlying model or company.
Generate a complete, self-contained HTML5 document (<!DOCTYPE html>...</html>) with all CSS inside <style> and all interactivity inside <script>.
Format the HTML cleanly across multiple lines with 2-space indentation—never minify everything onto one line and never truncate the closing </html>.
Ensure strong visual design, clean typography, mobile and desktop responsiveness (box-sizing: border-box, max-width: 100%, no horizontal clipping, and both touch/click + keyboard controls for games), high contrast, and zero broken external image URLs (use clean SVG illustrations, Canvas graphics, or CSS gradients instead).`;

type ResponseStyle = 'balanced' | 'concise' | 'detailed';

interface IncomingChatMessage {
  role: 'user' | 'model';
  text: string;
}

function buildChatSystemInstruction(
  responseStyle?: ResponseStyle,
  customInstructions?: string,
): string {
  const parts = [FAWZY_BASE_PERSONA];

  if (responseStyle === 'concise') {
    parts.push('Keep your answers brief, direct, and to the point.');
  } else if (responseStyle === 'detailed') {
    parts.push('Provide thorough, step-by-step explanations with clear examples.');
  }

  const trimmedCustom = customInstructions?.trim().slice(0, 500);
  if (trimmedCustom) {
    parts.push(`Follow these user preferences when helpful:\n${trimmedCustom}`);
  }

  return parts.join('\n\n');
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractReadableMessage(raw: string): string {
  let current = raw.trim();
  for (let depth = 0; depth < 3; depth++) {
    if (!current.startsWith('{')) break;
    try {
      const parsed = JSON.parse(current) as {
        message?: string;
        error?: {message?: string} | string;
      };
      if (typeof parsed.error === 'object' && parsed.error?.message) {
        current = parsed.error.message.trim();
        continue;
      }
      if (typeof parsed.error === 'string') {
        current = parsed.error.trim();
        continue;
      }
      if (typeof parsed.message === 'string') {
        current = parsed.message.trim();
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return current;
}

function isTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('econnreset') ||
    msg.includes('timeout')
  );
}

function isQuotaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return msg.includes('resource_exhausted') || msg.includes('429') || msg.includes('quota');
}

function parseApiError(err: unknown): {status: number; message: string} {
  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = rawMessage.toLowerCase();
  const readable = extractReadableMessage(rawMessage);

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('403')
  ) {
    return {
      status: 403,
      message:
        'API access was denied. Please check or select a valid API key in the Settings > Secrets panel.',
    };
  }

  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Daily or rate-limit quota was reached on the current API key. You can configure a fresh or billing-enabled API key in Settings > Secrets.',
    };
  }

  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      message:
        'The AI service is experiencing temporary high demand right now. Please try again in a few seconds.',
    };
  }

  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'The requested AI capability could not be reached. Please try again.',
    };
  }

  if (lower.includes('400') || lower.includes('invalid_argument')) {
    return {
      status: 400,
      message: 'The request could not be processed. Please adjust your prompt and try again.',
    };
  }

  return {
    status: 500,
    message: readable || 'Something went wrong while contacting fawzy.ai.',
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

function fallbackTopicTitle(prompt: string): string {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'to',
    'for',
    'of',
    'in',
    'on',
    'with',
    'and',
    'or',
    'can',
    'you',
    'me',
    'help',
    'please',
    'make',
    'create',
    'build',
    'write',
    'how',
    'what',
    'why',
    'i',
    'want',
    'need',
  ]);
  const words = prompt
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()));
  const selected = (words.length >= 2 ? words : prompt.trim().split(/\s+/)).slice(0, 4);
  if (selected.length === 0) return 'New Conversation';
  return selected
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 60);
}

function sanitizeCodeHtml(rawHtml: string): string {
  let html = rawHtml.trim();
  const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    html = fenced[1].trim();
  }
  return html;
}

const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const RESERVED_OR_INVALID_TLDS = new Set([
  'local',
  'localhost',
  'invalid',
  'test',
  'example',
  'arpa',
  'lan',
  'internal',
  'home',
]);

const DISPOSABLE_OR_FAKE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'fake.com',
  'fakemail.com',
  'fakemailgenerator.com',
  'emailfake.com',
  'none.com',
  'noreply.com',
  'no-reply.com',
  'invalid.com',
  'asdf.com',
  'qwerty.com',
  'abc.com',
  'xyz.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.net',
  'tempmailo.com',
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'guerrillamail.de',
  'sharklasers.com',
  'grr.la',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'trashmail.de',
  'fakeinbox.com',
  'throwawaymail.com',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'maildrop.cc',
  'mohmal.com',
  'mintemail.com',
  'mytemp.email',
  'emailondeck.com',
  'burnermail.io',
  'mailnesia.com',
  'spamgourmet.com',
  'tempr.email',
  'discard.email',
  'inboxbear.com',
  'dropmail.me',
  'moakt.com',
  'crazymailing.com',
  'tmail.ws',
  'tmpmail.org',
  'tmpmail.net',
  'harakirimail.com',
  'mailcatch.com',
  'mailsac.com',
  'spam4.me',
  'tempinbox.com',
  'wegwerfmail.de',
  'byom.de',
  'anonbox.net',
  'guerrillamailblock.com',
  'pokemail.net',
  'spambox.us',
  'incognitomail.org',
  'meltmail.com',
  'mailtothis.com',
  'dodgit.com',
]);

function isBlockedEmailDomain(domain: string): boolean {
  const parts = domain.toLowerCase().split('.');
  if (parts.length < 2) return true;
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2 || /^\d+$/.test(tld) || RESERVED_OR_INVALID_TLDS.has(tld)) {
    return true;
  }
  for (let i = 0; i <= parts.length - 2; i++) {
    const candidate = parts.slice(i).join('.');
    if (DISPOSABLE_OR_FAKE_DOMAINS.has(candidate)) {
      return true;
    }
  }
  return false;
}

async function resolveMxWithTimeout(domain: string, timeoutMs = 4000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '10mb'}));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({status: 'ok'});
  });

  app.post('/api/auth/validate-email', async (req: Request, res: Response) => {
    const body = req.body as {email?: unknown};
    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!rawEmail || rawEmail.length > 254 || !EMAIL_REGEX.test(rawEmail)) {
      res.status(400).json({valid: false, error: 'Please enter a valid email address.'});
      return;
    }

    const atIndex = rawEmail.lastIndexOf('@');
    const localPart = rawEmail.slice(0, atIndex);
    const domain = rawEmail.slice(atIndex + 1);

    if (
      !localPart ||
      localPart.length > 64 ||
      localPart.startsWith('.') ||
      localPart.endsWith('.') ||
      localPart.includes('..') ||
      domain.includes('..')
    ) {
      res.status(400).json({valid: false, error: 'Please enter a valid email address.'});
      return;
    }

    if (isBlockedEmailDomain(domain)) {
      res.status(400).json({
        valid: false,
        error:
          'Disposable, temporary, or test email addresses are not accepted. Please use a real email.',
      });
      return;
    }

    try {
      const mxRecords = await resolveMxWithTimeout(domain);
      const hasValidMx = Array.isArray(mxRecords)
        ? mxRecords.some((rec) => Boolean(rec.exchange && rec.exchange.trim() && rec.exchange !== '.'))
        : false;

      if (!hasValidMx) {
        res.status(400).json({
          valid: false,
          error: 'This email domain cannot receive emails. Please use a real email address.',
        });
        return;
      }

      res.json({valid: true});
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as {code?: unknown}).code)
          : '';
      const msg = err instanceof Error ? err.message : '';

      if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ENOTIMP') {
        res.status(400).json({
          valid: false,
          error: 'This email domain does not appear to exist. Please use a real email address.',
        });
        return;
      }

      if (msg === 'DNS_TIMEOUT' || code === 'ETIMEOUT' || code === 'EAI_AGAIN' || code === 'ESERVFAIL') {
        // Transient DNS failure: Firebase email verification will still enforce real inbox ownership.
        res.json({valid: true});
        return;
      }

      res.json({valid: true});
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    const body = req.body as {
      messages?: unknown;
      responseStyle?: unknown;
      customInstructions?: unknown;
    };
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      res.status(400).json({error: 'Messages array is required.'});
      return;
    }

    const sanitizedMessages: IncomingChatMessage[] = body.messages
      .filter(
        (m): m is IncomingChatMessage =>
          typeof m === 'object' &&
          m !== null &&
          (m.role === 'user' || m.role === 'model') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0,
      )
      .map((m) => ({
        role: m.role,
        text: m.text,
      }));

    if (sanitizedMessages.length === 0) {
      res.status(400).json({error: 'Please enter a valid message.'});
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'API key is not configured. Please set GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const responseStyle: ResponseStyle =
      body.responseStyle === 'concise' || body.responseStyle === 'detailed'
        ? body.responseStyle
        : 'balanced';
    const customInstructions =
      typeof body.customInstructions === 'string' ? body.customInstructions : '';
    const systemInstruction = buildChatSystemInstruction(responseStyle, customInstructions);

    const ai = getGenAIClient();
    const contents = sanitizedMessages.map((msg) => ({
      role: msg.role,
      parts: [{text: msg.text}],
    }));

    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    const streamWithModel = async (model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite') => {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
        },
      });

      let sentAnyText = false;
      for await (const chunk of stream) {
        if (clientDisconnected) {
          return true;
        }
        const text = chunk.text;
        if (text) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();
          }
          sentAnyText = true;
          res.write(`data: ${JSON.stringify({text})}\n\n`);
        }
      }

      if (!sentAnyText && !clientDisconnected) {
        const fallback = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
          },
        });
        const fallbackText = fallback.text?.trim();
        if (fallbackText) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();
          }
          sentAnyText = true;
          res.write(`data: ${JSON.stringify({text: fallbackText})}\n\n`);
        }
      }

      return sentAnyText;
    };

    try {
      let sent = false;
      try {
        sent = await withRetry(() => streamWithModel('gemini-4-hydrogen'), 2);
      } catch (primaryErr) {
        if (res.headersSent || (!isTransientError(primaryErr) && !isQuotaError(primaryErr))) {
          throw primaryErr;
        }
        sent = await withRetry(() => streamWithModel('gemini-3.1-flash-lite'), 2);
      }

      if (clientDisconnected) {
        return;
      }

      if (!sent) {
        if (!res.headersSent) {
          res.status(502).json({
            error: 'No response text was generated for this message. Please try again.',
          });
        } else if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              error: 'No response text was generated for this message. Please try again.',
            })}\n\n`,
          );
          res.end();
        }
        return;
      }

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({done: true})}\n\n`);
        res.end();
      }
    } catch (err) {
      console.error('Chat API error:', err);
      const parsed = parseApiError(err);
      if (!res.headersSent) {
        res.status(parsed.status).json({error: parsed.message});
      } else if (!clientDisconnected && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({error: parsed.message})}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/chat/title', async (req: Request, res: Response) => {
    const body = req.body as {userMessage?: unknown; assistantMessage?: unknown};
    const userMessage = typeof body?.userMessage === 'string' ? body.userMessage.trim() : '';
    const assistantMessage =
      typeof body?.assistantMessage === 'string' ? body.assistantMessage.trim() : '';

    if (!userMessage) {
      res.status(400).json({error: 'userMessage is required.'});
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.json({title: fallbackTopicTitle(userMessage)});
      return;
    }

    const ai = getGenAIClient();
    const prompt = `Summarize the topic of this conversation in 2 to 5 concise words (Title Case). Do NOT copy the first words verbatim unless that is already the exact topic name. Return ONLY the plain title with no quotes, no markdown, and no trailing punctuation.\n\nUser: ${userMessage.slice(0, 600)}\nAssistant: ${assistantMessage.slice(0, 600)}`;

    const generateTitleWithModel = async (model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite') => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'You generate short, clean, natural 2-to-5-word conversation topic titles.',
        },
      });
      return (response.text ?? '').trim();
    };

    try {
      let rawTitle = '';
      try {
        rawTitle = await generateTitleWithModel('gemini-4-hydrogen');
      } catch (primaryErr) {
        if (!isTransientError(primaryErr) && !isQuotaError(primaryErr)) {
          throw primaryErr;
        }
        rawTitle = await generateTitleWithModel('gemini-3.1-flash-lite');
      }

      const cleaned = rawTitle
        .replace(/^["'`#*]+|["'`#*.:!?]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);

      res.json({title: cleaned || fallbackTopicTitle(userMessage)});
    } catch {
      res.json({title: fallbackTopicTitle(userMessage)});
    }
  });

  app.post('/api/code', async (req: Request, res: Response) => {
    const body = req.body as {
      prompt?: unknown;
      currentCode?: unknown;
      customInstructions?: unknown;
    };
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const currentCode = typeof body?.currentCode === 'string' ? body.currentCode.trim() : '';
    const customInstructions =
      typeof body?.customInstructions === 'string' ? body.customInstructions.trim().slice(0, 500) : '';

    if (!prompt) {
      res.status(400).json({error: 'Please describe what website or code you want to build.'});
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'API key is not configured. Please set GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const ai = getGenAIClient();
    const userContent = currentCode
      ? `Current HTML code:\n\`\`\`html\n${currentCode.slice(0, 28000)}\n\`\`\`\n\nUpdate or rebuild the code based on this request:\n${prompt}`
      : `Build a complete, polished, responsive single-file HTML5 website or interactive web app for this request:\n${prompt}`;

    const fullSystemInstruction = customInstructions
      ? `${CODE_STUDIO_SYSTEM_INSTRUCTION}\n\nAdditional user preferences:\n${customInstructions}`
      : CODE_STUDIO_SYSTEM_INSTRUCTION;

    const runCodeGen = async (model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite') => {
      const response = await ai.models.generateContent({
        model,
        contents: userContent,
        config: {
          systemInstruction: fullSystemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'A brief 1-2 sentence explanation of what was built or updated.',
              },
              html: {
                type: Type.STRING,
                description:
                  'Complete, valid, self-contained HTML5 document starting with <!DOCTYPE html> including inline <style> and <script>.',
              },
            },
            required: ['summary', 'html'],
          },
        },
      });
      return response.text ?? '';
    };

    try {
      let rawJson = '';
      try {
        rawJson = await withRetry(() => runCodeGen('gemini-4-hydrogen'), 2);
      } catch (primaryErr) {
        if (!isTransientError(primaryErr) && !isQuotaError(primaryErr)) {
          throw primaryErr;
        }
        rawJson = await withRetry(() => runCodeGen('gemini-3.1-flash-lite'), 2);
      }

      const parsed = JSON.parse(rawJson) as {summary?: string; html?: string};
      const html = sanitizeCodeHtml(parsed.html ?? '');
      if (!html) {
        res.status(422).json({
          error: 'Could not generate runnable HTML code for that request. Please try rephrasing.',
        });
        return;
      }

      res.json({
        summary: parsed.summary?.trim() || 'Built your interactive web code.',
        html,
      });
    } catch (err) {
      console.error('Code API error:', err);
      const parsed = parseApiError(err);
      res.status(parsed.status).json({error: parsed.message});
    }
  });

  if (!IS_PROD) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`fawzy.ai server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
