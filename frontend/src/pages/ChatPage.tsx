import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, Trash2, FolderOpen, LogOut, Sparkles } from 'lucide-react';
import api from '@/api/client';
import { streamChat } from '@/utils/sse';
import type { Conversation, Message, Capabilities } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const CAP_LABELS: Record<keyof Capabilities, string> = {
  code_interpreter: 'Code',
  rlm: 'RLM',
  rag: 'RAG',
  web_search: 'Web',
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    code_interpreter: false, rlm: false, rag: false, web_search: false,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (activeConvId) loadMessages(activeConvId); }, [activeConvId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = async () => {
    const { data } = await api.get('/conversations');
    setConversations(data);
    if (data.length > 0 && !activeConvId) {
      setActiveConvId(data[0].id);
      setCapabilities(data[0].capabilities);
    }
  };

  const loadMessages = async (convId: string) => {
    const { data } = await api.get(`/conversations/${convId}/messages`);
    setMessages(data);
  };

  const createConversation = async () => {
    const { data } = await api.post('/conversations', { title: 'New Conversation' });
    setConversations((prev) => [data, ...prev]);
    setActiveConvId(data.id);
    setCapabilities(data.capabilities);
    setMessages([]);
    inputRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    await api.delete(`/conversations/${id}`);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const updateCapabilities = async (caps: Capabilities) => {
    if (!activeConvId) return;
    setCapabilities(caps);
    await api.patch(`/conversations/${activeConvId}`, { capabilities: caps });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConvId || streaming) return;
    const content = input.trim();
    setInput('');

    const userMsg: Message = {
      id: crypto.randomUUID(), conversationId: activeConvId, role: 'user',
      content, metadata: null, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    let assistantContent = '';

    await streamChat(activeConvId, content, [],
      (token) => {
        assistantContent += token;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          }
          return [...prev, {
            id: 'streaming', conversationId: activeConvId!, role: 'assistant' as const,
            content: assistantContent, metadata: null, createdAt: new Date().toISOString(),
          }];
        });
      },
      (messageId) => {
        setMessages((prev) => prev.map((m) => (m.id === 'streaming' ? { ...m, id: messageId } : m)));
        setStreaming(false);
      },
      () => { setStreaming(false); }
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-3">
          <Button onClick={createConversation} className="w-full" size="sm">
            <Plus className="size-4" /> New Chat
          </Button>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((conv) => (
            <div key={conv.id} className="group flex items-center gap-1">
              <button
                onClick={() => { setActiveConvId(conv.id); setCapabilities(conv.capabilities); }}
                className={cn(
                  "flex-1 truncate rounded-md px-3 py-2 text-left text-sm transition-colors",
                  conv.id === activeConvId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                {conv.title}
              </button>
              <button
                onClick={() => deleteConversation(conv.id)}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Separator />
        <div className="p-3 space-y-2">
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          <div className="flex gap-1.5">
            <Button onClick={() => navigate('/knowledge-base')} variant="secondary" size="sm" className="flex-1">
              <FolderOpen className="size-3.5" /> KB
            </Button>
            <Button onClick={logout} variant="secondary" size="sm" className="flex-1">
              <LogOut className="size-3.5" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          {(Object.keys(CAP_LABELS) as (keyof Capabilities)[]).map((cap) => {
            const on = capabilities[cap];
            return (
              <button
                key={cap}
                onClick={() => updateCapabilities({ ...capabilities, [cap]: !on })}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:bg-accent"
                )}
              >
                {CAP_LABELS[cap]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative z-10 text-center">
                  <Sparkles className="mx-auto mb-3 size-8 text-primary" />
                  <p className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-xl font-medium text-transparent">Start a conversation</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ask anything — fact-check, research, or explore</p>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === 'user'
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-secondary-foreground"
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border bg-card p-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message..."
                className="min-h-[24px] max-h-[150px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                rows={1}
                disabled={streaming}
              />
              <Button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                size="icon"
                className="shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
