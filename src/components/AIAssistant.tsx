import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'gemini' | 'rule_engine';
}

interface Props {
  heading: string;
}

const SAMPLE_PROMPTS = [
  'Status of BUS-01',
  'Route from Tavarekere to Govt Polytechnic College',
  'Available ParentRide seats right now',
  'What is the Exam-Day Crisis status?',
  'Emergency SOS numbers',
];

export const AIAssistant: React.FC<Props> = ({ heading }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      text: 'Hello! I am the SmartTransit AI Assistant. Every timing, bus capacity, route, and ParentRide seat count I report is queried directly from the live SQLite database — I never invent schedules.',
      source: 'rule_engine',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer || data.error || 'No response available.',
          source: data.source,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'Unable to reach transit database right now.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-indigo-700">SQLITE-GROUNDED TRANSIT QA · ZERO HALLUCINATION</p>
        <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-[540px]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-xs font-medium text-slate-500">Quick Queries:</span>
          {SAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => ask(p)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-indigo-400 hover:text-indigo-700 cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-semibold text-indigo-700">
                    <Bot className="h-3.5 w-3.5" />
                    <span>
                      {m.source === 'gemini'
                        ? 'GEMINI 4 HYDROGEN · SQLITE GROUNDED'
                        : 'SQLITE RULE ENGINE · VERIFIED'}
                    </span>
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-xs font-mono text-slate-500">Querying live SQLite database...</div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-3 bg-white"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about bus timings, capacities, Dijkstra routes, ParentRide seats, or crisis metrics..."
            className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};
