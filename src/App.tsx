import {useCallback, useEffect, useRef, useState} from 'react';
import type {User} from 'firebase/auth';
import {onAuthStateChanged, sendEmailVerification, signOut} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {AuthGate} from './components/AuthGate';
import {BrandLogo} from './components/BrandLogo';
import {ChatView} from './components/ChatView';
import {CodeView} from './components/CodeView';
import {SettingsModal} from './components/SettingsModal';
import {Sidebar} from './components/Sidebar';
import {TopHeader} from './components/TopHeader';
import {auth, BLUEPRINT_LIMITS, db, handleFirestoreError, OperationType} from './firebase';
import type {
  AppMode,
  ChatMessage,
  ChatSession,
  ResponseStyle,
  ThemePreference,
  UserAccount,
  UserSettings,
} from './types';

const SETTINGS_STORAGE_KEY = 'fawzy_settings_v2';
const THEME_STORAGE_KEY = 'fawzy_theme';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  responseStyle: 'balanced',
  customInstructions: '',
  autoPreviewHtml: true,
};

function loadJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function applyThemeClass(theme: ThemePreference) {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', shouldBeDark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage error
  }
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJsonStorage<Partial<UserSettings>>(SETTINGS_STORAGE_KEY, {}),
  }));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [user, setUser] = useState<UserAccount | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);

  const [studioCode, setStudioCode] = useState('');
  const [studioSummary, setStudioSummary] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedMessageChatsRef = useRef<Set<string>>(new Set());

  // Apply theme preference to <html> and listen for system theme changes
  useEffect(() => {
    applyThemeClass(settings.theme);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage error
    }

    if (settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyThemeClass('system');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [settings]);

  const loadOrCreateVerifiedProfile = useCallback(
    async (firebaseUser: User) => {
      const fallbackUsername =
        firebaseUser.displayName?.trim() ||
        firebaseUser.email?.split('@')[0] ||
        'Visitor';
      const userEmail = firebaseUser.email || 'user@example.com';

      const profileRef = doc(db, 'users', firebaseUser.uid);
      const profilePath = `users/${firebaseUser.uid}`;

      try {
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          const data = snap.data() as {
            username?: string;
            email?: string;
            theme?: ThemePreference;
            responseStyle?: ResponseStyle;
            customInstructions?: string;
          };
          setUser({
            uid: firebaseUser.uid,
            username: data.username || fallbackUsername,
            email: data.email || userEmail,
          });
          setSettings((prev) => ({
            ...prev,
            theme: data.theme ?? prev.theme,
            responseStyle: data.responseStyle ?? prev.responseStyle,
            customInstructions: data.customInstructions ?? prev.customInstructions,
          }));
        } else {
          await setDoc(profileRef, {
            uid: firebaseUser.uid,
            username: fallbackUsername.slice(0, BLUEPRINT_LIMITS.USERNAME_MAX),
            email: userEmail.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX),
            theme: settings.theme,
            responseStyle: settings.responseStyle,
            customInstructions: settings.customInstructions.slice(
              0,
              BLUEPRINT_LIMITS.CUSTOM_INSTRUCTIONS_MAX,
            ),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUser({
            uid: firebaseUser.uid,
            username: fallbackUsername,
            email: userEmail,
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, profilePath);
        } catch (loggedErr) {
          console.error(loggedErr);
        }
        setUser({
          uid: firebaseUser.uid,
          username: fallbackUsername,
          email: userEmail,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Firebase Auth listener & verified user profile bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setUnverifiedEmail(null);
        loadedMessageChatsRef.current.clear();
        setSessions([]);
        setActiveSessionId(null);
        setIsAuthReady(true);
        return;
      }

      if (!firebaseUser.emailVerified) {
        setUser(null);
        setUnverifiedEmail(firebaseUser.email || 'your email');
        loadedMessageChatsRef.current.clear();
        setSessions([]);
        setActiveSessionId(null);
        setIsAuthReady(true);
        return;
      }

      setUnverifiedEmail(null);
      await loadOrCreateVerifiedProfile(firebaseUser);
      loadedMessageChatsRef.current.clear();
      setActiveSessionId(null);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [loadOrCreateVerifiedProfile]);

  // Subscribe to authenticated user's chats in Firestore
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const chatsPath = `users/${user.uid}/chats`;
    const chatsQuery = query(
      collection(db, 'users', user.uid, 'chats'),
      where('ownerUid', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        setSessions((prev) => {
          const prevMap = new Map(prev.map((s) => [s.id, s]));
          return snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as {
              id?: string;
              title?: string;
              updatedAt?: {toMillis?: () => number};
            };
            const existing = prevMap.get(docSnap.id);
            return {
              id: docSnap.id,
              title: data.title || existing?.title || 'New Conversation',
              messages: existing?.messages ?? [],
              updatedAt: data.updatedAt?.toMillis?.() ?? existing?.updatedAt ?? Date.now(),
            };
          });
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, chatsPath);
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Lazy-load messages for selected Firestore chat session
  useEffect(() => {
    if (!user || !activeSessionId) return;
    if (loadedMessageChatsRef.current.has(activeSessionId)) return;

    const messagesPath = `users/${user.uid}/chats/${activeSessionId}/messages`;
    const msgsQuery = query(
      collection(db, 'users', user.uid, 'chats', activeSessionId, 'messages'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'asc'),
    );

    getDocs(msgsQuery)
      .then((snap) => {
        loadedMessageChatsRef.current.add(activeSessionId);
        const loaded: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data() as {
            role: 'user' | 'model';
            text: string;
            createdAt?: {toMillis?: () => number};
          };
          return {
            id: d.id,
            role: data.role,
            text: data.text,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
          };
        });
        if (loaded.length > 0) {
          setSessions((prev) =>
            prev.map((s) => (s.id === activeSessionId ? {...s, messages: loaded} : s)),
          );
        }
      })
      .catch((error) => {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      });
  }, [activeSessionId, user]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const currentMessages = activeSession?.messages ?? [];
  const isCurrentStreaming =
    streamingSessionId !== null && streamingSessionId === activeSessionId;

  const persistUserMessage = useCallback(
    async (chatId: string, message: ChatMessage) => {
      if (!user) return;
      const msgPath = `users/${user.uid}/chats/${chatId}/messages/${message.id}`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'chats', chatId, 'messages', message.id),
          {
            id: message.id,
            ownerUid: user.uid,
            role: message.role,
            text: message.text.slice(0, BLUEPRINT_LIMITS.MESSAGE_TEXT_MAX),
            createdAt: serverTimestamp(),
          },
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, msgPath);
      }
    },
    [user],
  );

  const generateTopicTitle = useCallback(
    async (sessionId: string, firstUserText: string, firstAssistantText: string) => {
      try {
        const res = await fetch('/api/chat/title', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userMessage: firstUserText,
            assistantMessage: firstAssistantText,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {title?: string};
        const aiTitle = data.title?.trim().slice(0, BLUEPRINT_LIMITS.CHAT_TITLE_MAX);
        if (!aiTitle) return;

        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? {...s, title: aiTitle} : s)),
        );

        if (user) {
          const chatPath = `users/${user.uid}/chats/${sessionId}`;
          try {
            await updateDoc(doc(db, 'users', user.uid, 'chats', sessionId), {
              title: aiTitle,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, chatPath);
          }
        }
      } catch {
        // Keep temporary title if topic naming call fails
      }
    },
    [user],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingSessionId(null);
  }, []);

  const handleNewChat = useCallback(() => {
    stopStreaming();
    setActiveSessionId(null);
    setMode('chat');
  }, [stopStreaming]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (streamingSessionId && streamingSessionId !== sessionId) {
        stopStreaming();
      }
      setActiveSessionId(sessionId);
      setMode('chat');
    },
    [stopStreaming, streamingSessionId],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (activeSessionId === sessionId) {
        stopStreaming();
        setActiveSessionId(null);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (user) {
        const chatPath = `users/${user.uid}/chats/${sessionId}`;
        try {
          const msgsSnap = await getDocs(
            query(
              collection(db, 'users', user.uid, 'chats', sessionId, 'messages'),
              where('ownerUid', '==', user.uid),
            ),
          );
          await Promise.all(msgsSnap.docs.map((m) => deleteDoc(m.ref)));
          await deleteDoc(doc(db, 'users', user.uid, 'chats', sessionId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, chatPath);
        }
      }
    },
    [activeSessionId, stopStreaming, user],
  );

  const handleClearAllChats = useCallback(async () => {
    stopStreaming();
    const toDelete = [...sessions];
    setActiveSessionId(null);
    setSessions([]);

    if (user) {
      for (const s of toDelete) {
        await handleDeleteSession(s.id);
      }
    }
  }, [handleDeleteSession, sessions, stopStreaming, user]);

  const streamReply = useCallback(
    async (
      sessionId: string,
      historyForApi: Array<{role: 'user' | 'model'; text: string}>,
      assistantMsgId: string,
      shouldNameTopic: boolean,
      firstUserPrompt: string,
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStreamingSessionId(sessionId);

      let accumulatedText = '';

      const updateAssistantMessage = (updater: (prev: ChatMessage) => ChatMessage) => {
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((msg) =>
                msg.id === assistantMsgId ? updater(msg) : msg,
              ),
            };
          }),
        );
      };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            messages: historyForApi,
            responseStyle: settings.responseStyle,
            customInstructions: settings.customInstructions,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errMessage = 'Unable to reach fawzy.ai right now. Please try again.';
          try {
            const errJson = (await response.json()) as {error?: string};
            if (errJson.error) errMessage = errJson.error;
          } catch {
            // Non-JSON error
          }
          updateAssistantMessage((msg) => ({
            ...msg,
            text: errMessage,
            isError: true,
          }));
          return;
        }

        if (!response.body) {
          throw new Error('Streaming response body is unavailable.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedAnyText = false;

        const processEvents = (events: string[]): boolean => {
          for (const event of events) {
            const lines = event.split(/\r?\n/);
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payloadRaw = line.slice(6).trim();
              if (!payloadRaw) continue;

              let payload: {text?: string; error?: string; done?: boolean};
              try {
                payload = JSON.parse(payloadRaw) as {text?: string; error?: string; done?: boolean};
              } catch {
                continue;
              }

              if (payload.error) {
                updateAssistantMessage((msg) => ({
                  ...msg,
                  text: payload.error || 'An error occurred while generating a response.',
                  isError: true,
                }));
                return true;
              }

              if (payload.text) {
                receivedAnyText = true;
                accumulatedText += payload.text;
                updateAssistantMessage((msg) => ({
                  ...msg,
                  text: msg.text + payload.text,
                }));
              }
            }
          }
          return false;
        };

        while (true) {
          const {value, done} = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              const stopped = processEvents(buffer.split(/\r?\n\r?\n/));
              if (stopped) return;
            }
            break;
          }

          buffer += decoder.decode(value, {stream: true});
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? '';

          const stopped = processEvents(events);
          if (stopped) return;
        }

        if (!receivedAnyText) {
          updateAssistantMessage((msg) => ({
            ...msg,
            text: msg.text || 'No response was received. Please try again.',
            isError: !msg.text,
          }));
          return;
        }

        if (accumulatedText.trim()) {
          await persistUserMessage(sessionId, {
            id: assistantMsgId,
            role: 'model',
            text: accumulatedText,
            createdAt: Date.now(),
          });

          if (shouldNameTopic) {
            void generateTopicTitle(sessionId, firstUserPrompt, accumulatedText);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Connection interrupted. Please try again.';
        updateAssistantMessage((msg) => ({
          ...msg,
          text: msg.text ? `${msg.text}\n\n${message}` : message,
          isError: !msg.text,
        }));
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setStreamingSessionId((prev) => (prev === sessionId ? null : prev));
      }
    },
    [
      generateTopicTitle,
      persistUserMessage,
      settings.customInstructions,
      settings.responseStyle,
    ],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      const now = Date.now();
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        createdAt: now,
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: '',
        createdAt: now + 1,
      };

      let targetSessionId = activeSessionId;
      let apiHistory: Array<{role: 'user' | 'model'; text: string}> = [];
      let isNewChat = false;

      if (!targetSessionId || !activeSession) {
        isNewChat = true;
        targetSessionId = crypto.randomUUID();
        loadedMessageChatsRef.current.add(targetSessionId);
        const newSession: ChatSession = {
          id: targetSessionId,
          title: 'New Conversation',
          messages: [userMessage, assistantMessage],
          updatedAt: now,
        };
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(targetSessionId);
        apiHistory = [{role: 'user', text}];

        if (user) {
          const chatPath = `users/${user.uid}/chats/${targetSessionId}`;
          try {
            await setDoc(doc(db, 'users', user.uid, 'chats', targetSessionId), {
              id: targetSessionId,
              ownerUid: user.uid,
              title: 'New Conversation',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, chatPath);
          }
        }
      } else {
        const cleanExisting = activeSession.messages.filter((m) => !m.isError);
        apiHistory = [
          ...cleanExisting.map((m) => ({role: m.role, text: m.text})),
          {role: 'user', text},
        ];
        setSessions((prev) => {
          const updated = prev.map((session) =>
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: now,
                  messages: [...session.messages, userMessage, assistantMessage],
                }
              : session,
          );
          const current = updated.find((s) => s.id === targetSessionId);
          const others = updated.filter((s) => s.id !== targetSessionId);
          return current ? [current, ...others] : updated;
        });

        if (user) {
          const chatPath = `users/${user.uid}/chats/${targetSessionId}`;
          try {
            await updateDoc(doc(db, 'users', user.uid, 'chats', targetSessionId), {
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, chatPath);
          }
        }
      }

      await persistUserMessage(targetSessionId, userMessage);

      const shouldNameTopic = isNewChat || activeSession?.title === 'New Conversation';
      void streamReply(
        targetSessionId,
        apiHistory,
        assistantMessage.id,
        shouldNameTopic,
        text,
      );
    },
    [activeSession, activeSessionId, persistUserMessage, streamReply, user],
  );

  const handleRetryLast = useCallback(() => {
    if (!activeSession || isCurrentStreaming) return;
    const messages = activeSession.messages;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'model' || !lastMsg.isError) return;

    const preceding = messages.slice(0, -1).filter((m) => !m.isError);
    if (preceding.length === 0) return;

    const retryAssistantId = crypto.randomUUID();
    const freshAssistant: ChatMessage = {
      id: retryAssistantId,
      role: 'model',
      text: '',
      createdAt: Date.now(),
    };

    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: [...messages.slice(0, -1), freshAssistant],
            }
          : session,
      ),
    );

    const apiHistory = preceding.map((m) => ({role: m.role, text: m.text}));
    const shouldName =
      activeSession.title === 'New Conversation' && preceding.length === 1;
    void streamReply(
      activeSession.id,
      apiHistory,
      retryAssistantId,
      shouldName,
      preceding[0].text,
    );
  }, [activeSession, isCurrentStreaming, streamReply]);

  const handleUpdateSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      const next: UserSettings = {
        ...settings,
        ...partial,
        customInstructions: (partial.customInstructions ?? settings.customInstructions).slice(
          0,
          BLUEPRINT_LIMITS.CUSTOM_INSTRUCTIONS_MAX,
        ),
      };
      setSettings(next);

      if (user) {
        const profilePath = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            theme: next.theme,
            responseStyle: next.responseStyle,
            customInstructions: next.customInstructions,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, profilePath);
        }
      }
    },
    [settings, user],
  );

  const handleSignOut = useCallback(async () => {
    stopStreaming();
    setIsSettingsOpen(false);
    setStudioCode('');
    setStudioSummary('');
    setSessions([]);
    setActiveSessionId(null);
    setUnverifiedEmail(null);
    await signOut(auth);
  }, [stopStreaming]);

  const handleCheckVerification = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    await current.reload();
    if (!current.emailVerified) {
      return false;
    }
    await current.getIdToken(true);
    setUnverifiedEmail(null);
    await loadOrCreateVerifiedProfile(current);
    return true;
  }, [loadOrCreateVerifiedProfile]);

  const handleResendVerification = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return;
    await sendEmailVerification(current);
  }, []);

  const handleToggleAuthTheme = useCallback(() => {
    const isCurrentlyDark =
      settings.theme === 'dark' ||
      (settings.theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    setSettings((prev) => ({
      ...prev,
      theme: isCurrentlyDark ? 'light' : 'dark',
    }));
  }, [settings.theme]);

  const handleOpenInCodeStudio = useCallback((htmlCode: string) => {
    setStudioCode(htmlCode);
    setStudioSummary('Loaded from Chat into Code Studio.');
    setMode('code');
  }, []);

  if (!isAuthReady) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-[#F8FAFC] text-slate-700 dark:bg-[#0B1120] dark:text-slate-200">
        <BrandLogo size="lg" />
        <p className="font-display text-sm font-semibold text-[#122B8E] dark:text-[#93B4F5]">
          Loading fawzy.ai...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        theme={settings.theme}
        unverifiedEmail={unverifiedEmail}
        onToggleTheme={handleToggleAuthTheme}
        onVerificationSent={(sentEmail) => setUnverifiedEmail(sentEmail)}
        onCheckVerification={handleCheckVerification}
        onResendVerification={handleResendVerification}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      <Sidebar
        mode={mode}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        user={user}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectMode={setMode}
        onSelectSession={handleSelectSession}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => {}}
        onSignOut={() => void handleSignOut()}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          mode={mode}
          user={user}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onLogoClick={handleNewChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAuth={() => {}}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mode === 'chat' && (
            <ChatView
              messages={currentMessages}
              isStreaming={isCurrentStreaming}
              autoPreviewHtml={settings.autoPreviewHtml}
              onSendMessage={(text) => void handleSendMessage(text)}
              onStopStreaming={stopStreaming}
              onRetryLast={handleRetryLast}
              onOpenInCodeStudio={handleOpenInCodeStudio}
            />
          )}

          {mode === 'code' && (
            <CodeView
              code={studioCode}
              summary={studioSummary}
              customInstructions={settings.customInstructions}
              onCodeChange={(nextCode, nextSummary) => {
                setStudioCode(nextCode);
                if (nextSummary !== undefined) {
                  setStudioSummary(nextSummary);
                }
              }}
            />
          )}
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        user={user}
        hasChats={sessions.length > 0}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={(partial) => void handleUpdateSettings(partial)}
        onClearChats={() => void handleClearAllChats()}
        onOpenAuth={() => {}}
        onSignOut={() => void handleSignOut()}
      />
    </div>
  );
}
