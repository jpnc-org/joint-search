import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { streamChat } from '../utils/sse';
import type { Conversation, Message, Capabilities } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities>({
    code_interpreter: false,
    rlm: false,
    rag: false,
    web_search: false,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      id: crypto.randomUUID(),
      conversationId: activeConvId,
      role: 'user',
      content,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setStreaming(true);
    let assistantContent = '';

    await streamChat(
      activeConvId,
      content,
      [],
      (token) => {
        assistantContent += token;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          }
          return [
            ...prev,
            {
              id: 'streaming',
              conversationId: activeConvId!,
              role: 'assistant' as const,
              content: assistantContent,
              metadata: null,
              createdAt: new Date().toISOString(),
            },
          ];
        });
      },
      (messageId) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === 'streaming' ? { ...m, id: messageId } : m))
        );
        setStreaming(false);
      },
      (error) => {
        console.error('Stream error:', error);
        setStreaming(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={createConversation}
            className="w-full py-2 px-3 bg-indigo-600 rounded hover:bg-indigo-700 text-sm"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setActiveConvId(conv.id);
                setCapabilities(conv.capabilities);
              }}
              className={`w-full text-left px-3 py-2 rounded text-sm mb-1 ${
                conv.id === activeConvId
                  ? 'bg-gray-700'
                  : 'hover:bg-gray-800'
              }`}
            >
              {conv.title}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/knowledge-base')}
              className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
            >
              Knowledge Base
            </button>
            <button
              onClick={logout}
              className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Capability Toggles */}
        <div className="px-4 py-2 border-b flex gap-3 text-sm">
          {(['code_interpreter', 'rlm', 'rag', 'web_search'] as const).map((cap) => (
            <label key={cap} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={capabilities[cap]}
                onChange={(e) =>
                  updateCapabilities({ ...capabilities, [cap]: e.target.checked })
                }
                className="rounded"
              />
              <span className="capitalize">{cap.replace('_', ' ')}</span>
            </label>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (use @ to mention files)"
              className="flex-1 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              disabled={streaming}
            />
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
