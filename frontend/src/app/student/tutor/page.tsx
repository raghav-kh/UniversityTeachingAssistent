"use client";

import { useEffect, useRef, useState } from "react";
import { queryRAG, getCourses } from "@/lib/api";
import { Send, Bot, User, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { filename: string; similarity: number; content: string }[];
  loading?: boolean;
}

export default function TutorPage() {
  const [courses, setCourses]   = useState<{ id: number; name: string }[]>([]);
  const [courseId, setCourseId] = useState(1);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI tutor. I can only answer questions based on your uploaded course materials — so my answers are always grounded in what your professor taught. What would you like to know?",
    }
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCourses()
      .then(data => {
        setCourses(data);
        if (data.length > 0) setCourseId(data[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── sendMessage ──────────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");

    setMessages(m => [...m, { role: "user", content: question }]);
    setMessages(m => [...m, { role: "assistant", content: "", loading: true }]);
    setLoading(true);

    try {
      const res = await queryRAG({
        question,
        course_id: courseId,
        top_k: 5,
        provider: "ollama",
        fast_mode: false,
      });

      setMessages(m => [
        ...m.slice(0, -1),
        { role: "assistant", content: res.answer, sources: res.sources }
      ]);

    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? "";

      if (detail.includes("No relevant content")) {
        setMessages(m => [
          ...m.slice(0, -1),
          {
            role: "assistant",
            content: "I couldn't find anything about that in the uploaded materials. Try uploading more PDFs in the RAG Engine page.",
          }
        ]);
        setLoading(false);
        return;
      }

      // Ollama timed out — fallback to fast mode
      try {
        setMessages(m => [
          ...m.slice(0, -1),
          { role: "assistant", content: "", loading: true }
        ]);

        const fallback = await queryRAG({
          question,
          course_id: courseId,
          top_k: 3,
          provider: "ollama",
          fast_mode: true,
        });

        setMessages(m => [
          ...m.slice(0, -1),
          {
            role: "assistant",
            content: "⚡ Fast mode (AI summarization unavailable on this device) — showing raw course content:\n\n" + fallback.answer,
            sources: fallback.sources,
          }
        ]);

      } catch {
        setMessages(m => [
          ...m.slice(0, -1),
          { role: "assistant", content: "Sorry, could not reach the course materials. Make sure the backend is running." }
        ]);
      }

    } finally {
      setLoading(false);
    }
  }  // ← sendMessage ends here

  // ── handleKeyDown — OUTSIDE sendMessage ─────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── JSX ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen p-8 pb-4 max-w-3xl">

      {/* Header */}
      <div className="mb-4 flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Tutor</h1>
          <p className="text-zinc-400 text-sm mt-1">
            RAG-grounded answers — only from uploaded course materials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Course:</span>
          <select
            value={courseId}
            onChange={e => setCourseId(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* RAG notice */}
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-400/10 border border-violet-400/20 rounded-lg text-xs text-violet-400 mb-4 flex-shrink-0">
        <BookOpen size={12} />
        Answers strictly grounded in uploaded PDFs — hallucination disabled
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === "assistant"
                ? "bg-violet-500/20 border border-violet-500/30"
                : "bg-emerald-500/20 border border-emerald-500/30"
            }`}>
              {msg.role === "assistant"
                ? <Bot size={14} className="text-violet-400" />
                : <User size={14} className="text-emerald-400" />
              }
            </div>

            <div className={`max-w-[80%] space-y-2 ${
              msg.role === "user" ? "items-end flex flex-col" : ""
            }`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-100 rounded-tr-sm"
              }`}>
                {msg.loading ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <RefreshCw size={12} className="animate-spin" />
                    Searching course materials...
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="space-y-1 w-full">
                  <div className="text-[10px] text-zinc-600 px-1">Sources used:</div>
                  {msg.sources.slice(0, 3).map((s, si) => (
                    <div
                      key={si}
                      className="flex items-start gap-2 bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2"
                    >
                      <BookOpen size={9} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-zinc-400 font-medium truncate">
                          {s.filename}
                        </div>
                        <div className="text-[11px] text-zinc-600 mt-0.5 line-clamp-2">
                          {s.content}
                        </div>
                        <div className="text-[10px] text-zinc-700 mt-0.5">
                          {Math.round(s.similarity * 100)}% match
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="mt-4 flex gap-3 flex-shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything from your course materials..."
          className="flex-1 bg-zinc-900 border-zinc-700 text-sm h-11"
          disabled={loading}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-violet-500 hover:bg-violet-600 text-white h-11 px-4"
        >
          <Send size={15} />
        </Button>
      </div>

      <p className="text-center text-[11px] text-zinc-700 mt-2 flex-shrink-0">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}