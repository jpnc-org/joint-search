import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Send, Trash2, Settings, FolderOpen, Sparkles, Search, ChevronRight } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import api from '@/api/client';
import { streamChat } from '@/utils/sse';
import type { Conversation, Message, Capabilities } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChatBubble } from 'performative-ui';

const CAP_LABELS: Record<keyof Capabilities, string> = {
  code_interpreter: 'Code',
  rlm: 'RLM',
  rag: 'RAG',
  web_search: 'Web',
};

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    code_interpreter: false, rlm: false, rag: false, web_search: false,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { loadConversations(); }, [searchQuery]);
  useEffect(() => { if (activeConvId) loadMessages(activeConvId); }, [activeConvId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = async () => {
    const params = searchQuery ? { q: searchQuery } : {};
    const { data } = await api.get('/conversations', { params });
    setConversations(data);
    if (conversationId && conversationId === activeConvId) {
      const conv = data.find((c: Conversation) => c.id === conversationId);
      if (conv) setCapabilities(conv.capabilities);
    }
  };

  const loadMessages = async (convId: string) => {
    const { data } = await api.get(`/conversations/${convId}/messages`);
    setMessages(data);
  };

  const resetChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setCapabilities({ code_interpreter: false, rlm: false, rag: false, web_search: false });
    navigate('/chat');
    inputRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    await api.delete(`/conversations/${id}`);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
      navigate('/chat');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput('');
    setStreaming(true);

    try {
      let convId: string;
      if (activeConvId) {
        convId = activeConvId;
      } else {
        const { data: newConv } = await api.post('/conversations', { title: content.slice(0, 80) });
        setConversations((prev) => [newConv, ...prev]);
        convId = newConv.id;
        setActiveConvId(convId);
        setCapabilities(newConv.capabilities);
        navigate(`/chat/${convId}`);
      }

      const userMsg: Message = {
        id: uuid(), conversationId: convId, role: 'user',
        content, reasoning: null, metadata: null, createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      let assistantReasoning = '';
      let assistantContent = '';

      await streamChat(convId, content, [],
        (token) => {
          assistantReasoning += token;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, reasoning: assistantReasoning }];
            }
            return [...prev, {
              id: 'streaming', conversationId: convId!, role: 'assistant' as const,
              content: '', reasoning: assistantReasoning, metadata: null, createdAt: new Date().toISOString(),
            }];
          });
        },
        (token) => {
          assistantContent += token;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: assistantContent }];
            }
            return [...prev, {
              id: 'streaming', conversationId: convId!, role: 'assistant' as const,
              content: assistantContent, reasoning: assistantReasoning, metadata: null, createdAt: new Date().toISOString(),
            }];
          });
        },
        (messageId) => {
          setMessages((prev) => prev.map((m) => (m.id === 'streaming' ? { ...m, id: messageId } : m)));
        },
        (error) => { console.error('Stream error:', error); }
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button onClick={resetChat} className="w-full cursor-pointer" size="sm">
            <Plus className="size-4" /> New Chat
          </Button>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((conv) => (
            <div key={conv.id} className="group flex items-center gap-1">
              <button
                onClick={() => { setActiveConvId(conv.id); setCapabilities(conv.capabilities); navigate(`/chat/${conv.id}`); }}
                className={cn(
                  "flex-1 truncate rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                  conv.id === activeConvId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                {conv.title}
              </button>
              <button
                onClick={() => deleteConversation(conv.id)}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Separator />
        <div className="p-3 space-y-2">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="flex flex-col gap-1.5">
            <Button onClick={() => navigate('/knowledge-base')} variant="secondary" size="sm" className="w-full cursor-pointer">
              <FolderOpen className="size-3.5" /> Knowledge Base
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="w-full cursor-pointer">
                  <Settings className="size-3.5" /> Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                onClick={() => {
                  const next = { ...capabilities, [cap]: !on };
                  setCapabilities(next);
                  if (activeConvId) {
                    api.patch(`/conversations/${activeConvId}`, { capabilities: next });
                  }
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
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
              msg.role === 'user' ? (
                <ChatBubble key={msg.id} role="user">
                  {msg.content}
                </ChatBubble>
              ) : (
                <ChatBubble key={msg.id} role="ai" agent="DeepResearch" thinking={streaming && msg.id === 'streaming' && !msg.content ? 'thinking...' : false}>
                  {msg.reasoning && (
                    <details className="mb-2 text-xs text-muted-foreground">
                      <summary className="flex cursor-pointer items-center gap-1 select-none hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                        Reasoning
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap pl-4">{msg.reasoning}</p>
                    </details>
                  )}
                  {msg.content}
                </ChatBubble>
              )
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
                className="shrink-0 cursor-pointer"
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
