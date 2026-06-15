import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { streamChat } from '../utils/sse';
import type { Conversation, Message, Capabilities } from '../types';
import { useAuth } from '../contexts/AuthContext';

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
    <div className="flex h-screen" style={{ background: 'var(--color-surface-0)' }}>
      {/* Sidebar */}
      <div className="w-64 flex flex-col shrink-0" style={{ background: 'var(--color-surface-1)', borderRight: '1px solid var(--color-border)' }}>
        <div className="p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button onClick={createConversation} className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors" style={{ background: 'var(--color-accent)', color: '#fff' }}>
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((conv) => (
            <div key={conv.id} className="group flex items-center gap-1">
              <button
                onClick={() => { setActiveConvId(conv.id); setCapabilities(conv.capabilities); }}
                className="flex-1 text-left px-3 py-2 rounded-lg text-sm truncate transition-colors"
                style={{
                  background: conv.id === activeConvId ? 'var(--color-surface-3)' : 'transparent',
                  color: conv.id === activeConvId ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                {conv.title}
              </button>
              <button
                onClick={() => deleteConversation(conv.id)}
                className="px-1.5 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</div>
          <div className="flex gap-1.5">
            <button onClick={() => navigate('/knowledge-base')} className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}>
              KB
            </button>
            <button onClick={logout} className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Capabilities bar */}
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {(['code_interpreter', 'rlm', 'rag', 'web_search'] as const).map((cap) => {
            const on = capabilities[cap];
            return (
              <button
                key={cap}
                onClick={() => updateCapabilities({ ...capabilities, [cap]: !on })}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: on ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: on ? '#fff' : 'var(--color-text-muted)',
                  border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                {CAP_LABELS[cap]}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-20">
                <p className="text-lg font-medium" style={{ color: 'var(--color-text-muted)' }}>Start a conversation</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-border-hover)' }}>Ask anything about your research</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-surface-2)',
                    color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                    borderBottomRightRadius: msg.role === 'user' ? '4px' : undefined,
                    borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : undefined,
                  }}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl p-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message..."
                className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 px-2"
                style={{ color: 'var(--color-text)', minHeight: '24px', maxHeight: '150px' }}
                rows={1}
                disabled={streaming}
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="p-2 rounded-lg transition-colors shrink-0"
                style={{
                  background: input.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  color: input.trim() ? '#fff' : 'var(--color-text-muted)',
                  opacity: streaming ? 0.5 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
