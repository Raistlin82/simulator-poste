import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import { API_URL } from '../utils/api';

export default function ChatWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/ai-providers-status`)
      .then(res => setAiEnabled(res.data?.enabled ?? false))
      .catch(() => setAiEnabled(false));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.post(`${API_URL}/chat`, { messages: nextMessages });
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (err) {
      const detail = err.response?.data?.detail || t('chat.error_generic');
      setError(detail);
      // Remove the user message we optimistically added if the call failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, t]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!aiEnabled) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:brightness-110 active:scale-95 transition-all duration-200"
        aria-label={t('chat.toggle')}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-h-[70vh] flex flex-col bg-white/90 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl shadow-indigo-500/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5" />
              <div>
                <p className="text-[12px] font-black uppercase tracking-widest font-display leading-none">
                  {t('chat.title')}
                </p>
                <p className="text-[10px] text-indigo-200 font-display mt-0.5">
                  {t('chat.subtitle')}
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); }}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"
                aria-label={t('chat.clear')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: '45vh' }}>
            {messages.length === 0 && !loading && (
              <p className="text-center text-[11px] text-slate-400 font-display uppercase tracking-widest mt-8">
                {t('chat.empty_hint')}
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-black ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-purple-600'}`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm font-body leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-purple-600 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                  <span className="text-[11px] text-slate-500 font-display">{t('chat.thinking')}</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-red-500 text-center font-display px-2">{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-100">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder')}
                rows={1}
                className="flex-1 resize-none text-sm font-body text-slate-800 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                style={{ maxHeight: '100px', overflowY: 'auto' }}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-10 h-10 flex-shrink-0 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('chat.send')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-slate-400 text-center mt-2 font-display uppercase tracking-widest">
              Enter {t('chat.send_hint')} · Shift+Enter {t('chat.newline_hint')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
