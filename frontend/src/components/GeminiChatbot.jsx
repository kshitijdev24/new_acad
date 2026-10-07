import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Search,
  ExternalLink,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

export const GeminiChatbot = () => {
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [selectedRole, setSelectedRole] = useState('academic_tutor');
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);

  // Chat message thread
  const [messages, setMessages] = useState([
    {
      id: 'msg-init',
      role: 'model',
      text: 'Welcome to the AcadLytic Technical Consultation Center. Select your curriculum role above and ask your query regarding algorithms, mathematics, physics derivations, or semester examination strategies.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = inputPrompt.trim();
    if (!trimmed || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg = {
      id: userMessageId,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);
    setErrorNotice(null);

    try {
      // Build conversation history for multi-turn thread
      const historyPayload = newMessages
        .slice(1, -1)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          model: selectedModel,
          role: selectedRole,
          useGoogleSearch,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || selectedModel,
        sources: data.sources || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setErrorNotice(err?.message || 'Failed to receive response from Gemini backend service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        role: 'model',
        text: 'Thread history reset. Ready for a new topic or problem set.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
      },
    ]);
    setErrorNotice(null);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Gemini Academic Consultation Chat
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Multi-turn technical mentor powered by Google Gemini with live Google Search grounding and role-based instruction.
          </p>
        </div>

        <button
          onClick={handleClearHistory}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear Conversation
        </button>
      </div>

      {/* Control Console */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Model Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Gemini Model Architecture:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-700"
            >
              <option value="gemini-3.5-flash">
                gemini-3.5-flash (Standard &amp; Balanced)
              </option>
              <option value="gemini-3.1-pro-preview">
                gemini-3.1-pro-preview (Complex Tasks &amp; Math)
              </option>
              <option value="gemini-3.1-flash-lite">
                gemini-3.1-flash-lite (Fast Latency)
              </option>
            </select>
          </div>

          {/* Role / System Instruction Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Curriculum Role / System Persona:
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-700"
            >
              <option value="academic_tutor">Academic Tutor (Algorithms &amp; Foundations)</option>
              <option value="pyq_analyst">Exam &amp; PYQ Syllabus Analyst</option>
              <option value="lab_advisor">Lab Code &amp; Debugging Assistant</option>
            </select>
          </div>

          {/* Google Search Grounding Toggle */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={useGoogleSearch}
                onChange={(e) => setUseGoogleSearch(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
                <Search className="w-3.5 h-3.5 text-blue-700" />
                <span>Google Search Grounding</span>
              </div>
            </label>
          </div>
        </div>

        {/* Selected parameters notice */}
        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <span>Active Role: <strong className="text-slate-800">{selectedRole.replace('_', ' ').toUpperCase()}</strong></span>
          <span>•</span>
          <span>Engine: <strong className="font-mono text-blue-900">{selectedModel}</strong></span>
          <span>•</span>
          <span>Search Retrieval: <strong className={useGoogleSearch ? 'text-emerald-700 font-semibold' : 'text-slate-600'}>{useGoogleSearch ? 'Enabled (Google Search Tool)' : 'Disabled'}</strong></span>
        </div>
      </div>

      {/* Scrollable Conversation Thread */}
      <div className="bg-white border border-slate-200 rounded-lg flex flex-col h-[460px] sm:h-[540px]">
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-blue-900 text-white'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div
                  className={`p-3.5 rounded text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-900 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-800'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 mb-1.5 text-[10px] ${
                      isUser ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    <span className="font-semibold">
                      {isUser ? 'You' : 'AcadLytic Mentor'}
                    </span>
                    {!isUser && msg.modelUsed && (
                      <span className="font-mono bg-slate-200 text-slate-700 px-1 py-0.2 rounded text-[9px]">
                        {msg.modelUsed}
                      </span>
                    )}
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap font-sans text-xs">
                    {msg.text}
                  </div>

                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Search className="w-3 h-3 text-blue-700" />
                        <span>Search Grounding Sources:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 hover:border-blue-600 rounded text-[11px] text-blue-700 hover:text-blue-900 transition-colors font-medium"
                          >
                            <span className="truncate max-w-[200px]">{source.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 mr-auto max-w-md">
              <div className="w-7 h-7 rounded bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-700 animate-ping" />
                <span>Consulting {selectedModel} with academic system instructions...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Notification */}
        {errorNotice && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Prompt Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2 rounded-b-lg"
        >
          <input
            type="text"
            required
            disabled={isLoading}
            placeholder={
              selectedRole === 'pyq_analyst'
                ? 'Ask for recurring PYQ exam weightage or high-yield unit topics...'
                : selectedRole === 'lab_advisor'
                ? 'Paste code issue, segmentation fault or math lab inquiry...'
                : 'Ask an academic curriculum question (e.g. Master theorem, Maxwell laws, AVL tree)...'
            }
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
          />

          <button
            type="submit"
            disabled={isLoading || !inputPrompt.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 rounded flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
