import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aiAssistantApi,
  type AiCard,
  type AiMessage,
  type AiSuggestion,
  type AiQuota,
  type AiChatSession,
} from '@/api/aiAssistant.api';

/**
 * State + actions for the AI Assistant panel — ChatGPT-style: many
 * sessions per user, one active at a time.
 *
 * Maintains the active session's message array with optimistic user
 * updates and a streaming assistant placeholder that accumulates
 * tokens as SSE events arrive. Fetches the session list + the most
 * recent session's history on mount (auto-creating a first session if
 * the user has none), and re-fetches suggestions/quota after every
 * completed response so the pills and quota readout stay current.
 */
export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  card: AiCard | null;
  createdAt: string;
  isStreaming?: boolean;
  /** FREE-tier simulated response — rendered blurred with an upgrade CTA. */
  locked?: boolean;
}

interface State {
  sessions: AiChatSession[];
  activeSessionId: string | null;
  messages: UiMessage[];
  isStreaming: boolean;
  error: string | null;
  suggestedQuestions: AiSuggestion[];
  quota: AiQuota | null;
  loadingHistory: boolean;
  /**
   * Latches true after the initial load completes at least once for
   * the current open session. Callers (like the teaser pending-prompt
   * autosend) must wait for this before sending — otherwise the
   * history replace races with the optimistic user message and wipes
   * it. Reset to false whenever `active` flips false.
   */
  historyLoaded: boolean;
}

let idCounter = 0;
const genId = () => `local_${Date.now()}_${++idCounter}`;

function toUiMessage(m: AiMessage): UiMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    card: m.cardData,
    createdAt: m.createdAt,
  };
}

export function useAIAssistant(active: boolean) {
  const [state, setState] = useState<State>({
    sessions: [],
    activeSessionId: null,
    messages: [],
    isStreaming: false,
    error: null,
    suggestedQuestions: [],
    quota: null,
    loadingHistory: false,
    historyLoaded: false,
  });
  const abortRef = useRef<AbortController | null>(null);
  // sendMessage needs the latest quota synchronously (to decide whether to
  // simulate a locked response) without adding `quota` to its own useCallback
  // deps, which would tear down/rebuild the closure — and stream handlers
  // inside it — on every quota refresh.
  const quotaRef = useRef<AiQuota | null>(null);
  useEffect(() => {
    quotaRef.current = state.quota;
  }, [state.quota]);
  // Same reasoning for activeSessionId inside removeSession, which needs
  // to know synchronously (right after its own delete call) whether the
  // session it just removed was the active one.
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionIdRef.current = state.activeSessionId;
  }, [state.activeSessionId]);

  const switchSession = useCallback(async (sessionId: string) => {
    setState((s) => ({ ...s, activeSessionId: sessionId, loadingHistory: true, error: null }));
    try {
      const history = await aiAssistantApi.sessionHistory(sessionId);
      setState((s) => ({
        ...s,
        messages: history.map(toUiMessage),
        loadingHistory: false,
        historyLoaded: true,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loadingHistory: false,
        historyLoaded: true,
        error: err instanceof Error ? err.message : 'Failed to load conversation.',
      }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loadingHistory: true, error: null }));
    try {
      const [sessions, suggested, quota] = await Promise.all([
        aiAssistantApi.listSessions(),
        aiAssistantApi.suggested().catch(() => [] as AiSuggestion[]),
        aiAssistantApi.quota().catch(() => null),
      ]);
      let sessionList = sessions;
      let activeId = sessions[0]?.id ?? null;
      if (!activeId) {
        // First time this user has opened the assistant — give them a
        // session to land in rather than an empty session-list state.
        const created = await aiAssistantApi.createSession();
        sessionList = [created];
        activeId = created.id;
      }
      const history = await aiAssistantApi.sessionHistory(activeId);
      setState((s) => ({
        ...s,
        sessions: sessionList,
        activeSessionId: activeId,
        messages: history.map(toUiMessage),
        suggestedQuestions: suggested,
        quota,
        loadingHistory: false,
        historyLoaded: true,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loadingHistory: false,
        historyLoaded: true,
        error: err instanceof Error ? err.message : 'Failed to load conversation.',
      }));
    }
  }, []);

  useEffect(() => {
    if (!active) {
      // Reset ready flag so a later re-open forces a fresh wait.
      setState((s) => (s.historyLoaded ? { ...s, historyLoaded: false } : s));
      return;
    }
    void loadAll();
    return () => {
      abortRef.current?.abort();
    };
  }, [active, loadAll]);

  const refreshSuggested = useCallback(async () => {
    try {
      const q = await aiAssistantApi.suggested();
      setState((s) => ({ ...s, suggestedQuestions: q }));
    } catch {
      /* ignore */
    }
  }, []);

  const refreshQuota = useCallback(async () => {
    try {
      const q = await aiAssistantApi.quota();
      setState((s) => ({ ...s, quota: q }));
    } catch {
      /* ignore */
    }
  }, []);

  // Re-syncs the session list from the server — used after a real send
  // completes, since the backend may have just renamed "New chat" to the
  // first message's text (see chatSessions.ts's touchSession).
  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await aiAssistantApi.listSessions();
      setState((s) => ({ ...s, sessions }));
      // eslint-disable-next-line portfolioos/no-silent-catch -- best-effort title/order sync after a send; a failure here just means the sidebar title updates on the next refresh instead of immediately, not worth a user-facing error
    } catch {
      /* ignore */
    }
  }, []);

  const newChat = useCallback(async () => {
    try {
      const created = await aiAssistantApi.createSession();
      setState((s) => ({
        ...s,
        sessions: [created, ...s.sessions],
        activeSessionId: created.id,
        messages: [],
        error: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to start a new chat.',
      }));
    }
  }, []);

  const removeSession = useCallback(
    async (sessionId: string) => {
      try {
        await aiAssistantApi.deleteSession(sessionId);
        let remaining: AiChatSession[] = [];
        setState((s) => {
          remaining = s.sessions.filter((x) => x.id !== sessionId);
          return { ...s, sessions: remaining };
        });
        if (activeSessionIdRef.current === sessionId) {
          if (remaining.length > 0) {
            await switchSession(remaining[0]!.id);
          } else {
            await newChat();
          }
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'Failed to delete chat.',
        }));
      }
    },
    [switchSession, newChat],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const sessionId = activeSessionIdRef.current;
      if (!trimmed || !sessionId) return;
      const userMsg: UiMessage = {
        id: genId(),
        role: 'user',
        content: trimmed,
        card: null,
        createdAt: new Date().toISOString(),
      };
      const assistantId = genId();
      const assistantPlaceholder: UiMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        card: null,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      setState((s) => ({
        ...s,
        messages: [...s.messages, userMsg, assistantPlaceholder],
        isStreaming: true,
        error: null,
      }));

      if (quotaRef.current?.reason === 'tier_locked') {
        // FREE tier — the panel looks and behaves identically to a paid
        // user's up to this point (real send, real "thinking" dots), but
        // never calls the actual (billed) /chat endpoint. After a short
        // delay that mirrors real response latency, reveal the assistant
        // bubble as locked/blurred instead of streaming real content.
        await new Promise((resolve) => setTimeout(resolve, 1100));
        setState((s) => ({
          ...s,
          isStreaming: false,
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false, locked: true } : m,
          ),
        }));
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      await aiAssistantApi.streamChat(
        trimmed,
        sessionId,
        (event) => {
          if (event.type === 'token') {
            setState((s) => ({
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.content } : m,
              ),
            }));
          } else if (event.type === 'card') {
            setState((s) => ({
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, card: event.data } : m,
              ),
            }));
          } else if (event.type === 'error') {
            setState((s) => ({
              ...s,
              isStreaming: false,
              error: event.message,
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content || `_(${event.message})_`,
                      isStreaming: false,
                    }
                  : m,
              ),
            }));
          } else if (event.type === 'done') {
            setState((s) => ({
              ...s,
              isStreaming: false,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              ),
            }));
          }
        },
        controller.signal,
      );
      void refreshSuggested();
      void refreshQuota();
      void refreshSessions();
    },
    [refreshSuggested, refreshQuota, refreshSessions],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    ...state,
    sendMessage,
    switchSession,
    newChat,
    removeSession,
    cancelStream,
    reload: loadAll,
  };
}
