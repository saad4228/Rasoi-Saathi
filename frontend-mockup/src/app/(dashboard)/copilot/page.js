"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { useOutlets } from "@/context/OutletContext";
import { apiRequest } from "@/services/api";

const suggestedPrompts = [
  "How did sales this week compare with last week?",
  "What happens if I raise Chicken Biryani price by ₹10?",
  "What should I reorder for the next week?",
  "Which dishes have the lowest margin?",
];
const HISTORY_TURNS = 10;

export default function CopilotPage() {
  const { activeOutletId, activeOutlet } = useOutlets();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text) => {
    if (!text.trim() || isTyping) return;
    const history = messages.slice(-HISTORY_TURNS).map((message) => ({ role: message.role, text: message.text }));

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsTyping(true);
    setError("");

    try {
      const response = await apiRequest("/api/copilot/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, branch_id: activeOutletId, history }),
      });
      setMessages((prev) => [...prev, { role: "assistant", text: response.answer, basedOn: [activeOutlet?.address || "Your restaurant data"] }]);
    } catch (requestError) {
      setError(requestError.message || "The Copilot could not answer right now.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-border">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(ellipse 800px 500px at 50% 45%, rgba(230,82,43,0.18), transparent 70%)",
        }}
      />

      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-surface">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-ink text-sm">RasoiSaathi Copilot</p>
          <p className="text-xs text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {activeOutlet ? `Branch questions use ${activeOutlet.address}` : "Live restaurant data"}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="ml-auto text-xs font-semibold text-muted hover:text-ink">
            New conversation
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="flex items-center gap-3 mb-8">
              <Sparkles className="w-7 h-7 text-orange-500" strokeWidth={1.5} />
              <h2 className="text-3xl font-serif text-ink">What shall we cook up today?</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-sm px-3 py-2 rounded-lg border border-border bg-surface text-muted hover:border-orange-300 hover:text-ink transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {isTyping && <TypingBubble />}

        {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

        <div ref={scrollRef} />
      </div>

      <div className="border-t border-border bg-surface px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the Copilot anything about your restaurant..."
            className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            aria-label="Send"
            className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Inline Markdown Renderer ────────────────────────────────────────────────
// No external dependencies — handles ### headings, **bold**, *italic*,
// `code`, bullet lists, numbered lists, and horizontal rules.

function renderInline(text, keyPrefix = "") {
  const parts = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined)
      parts.push(<strong key={keyPrefix + m.index} className="font-semibold text-ink">{m[2]}</strong>);
    else if (m[3] !== undefined)
      parts.push(<em key={keyPrefix + m.index} className="italic text-ink/80">{m[3]}</em>);
    else if (m[4] !== undefined)
      parts.push(
        <code key={keyPrefix + m.index} className="px-1.5 py-0.5 rounded bg-orange-50 text-accent text-xs font-mono border border-orange-100">
          {m[4]}
        </code>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function MarkdownBlock({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let listBuffer = [];
  let listType = null;

  const flushList = (key) => {
    if (!listBuffer.length) return;
    if (listType === "ol") {
      elements.push(
        <ol key={"ol-" + key} className="list-none space-y-1.5 my-2.5 pl-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-sm text-ink leading-relaxed flex gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{renderInline(item, `ol-${key}-${i}`)}</span>
            </li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={"ul-" + key} className="space-y-1.5 my-2.5">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-sm text-ink leading-relaxed flex gap-2.5">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <span>{renderInline(item, `ul-${key}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
    }
    listBuffer = [];
    listType = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList(idx);
      elements.push(<hr key={idx} className="my-4 border-border" />);
      return;
    }

    // ### Heading 3
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      flushList(idx);
      elements.push(
        <h3 key={idx} className="text-sm font-bold text-ink mt-5 mb-1.5 first:mt-0 tracking-tight">
          {renderInline(h3[1], `h3-${idx}`)}
        </h3>
      );
      return;
    }

    // ## Heading 2
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      flushList(idx);
      elements.push(
        <h2 key={idx} className="text-base font-extrabold text-ink mt-5 mb-2 first:mt-0 tracking-tight">
          {renderInline(h2[1], `h2-${idx}`)}
        </h2>
      );
      return;
    }

    // Bullet list item  (-, *, •)
    const ulItem = line.match(/^[-*•]\s+(.+)/);
    if (ulItem) {
      if (listType === "ol") flushList(idx);
      listType = "ul";
      listBuffer.push(ulItem[1]);
      return;
    }

    // Numbered list item  (1. 2. …)
    const olItem = line.match(/^\d+\.\s+(.+)/);
    if (olItem) {
      if (listType === "ul") flushList(idx);
      listType = "ol";
      listBuffer.push(olItem[1]);
      return;
    }

    // Empty line — flush list, add gap
    if (line.trim() === "") {
      flushList(idx);
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Regular paragraph
    flushList(idx);
    elements.push(
      <p key={idx} className="text-sm text-ink leading-relaxed">
        {renderInline(line, `p-${idx}`)}
      </p>
    );
  });

  flushList("end");
  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Chat Bubbles ─────────────────────────────────────────────────────────────

function ChatBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-lg bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium px-4 py-3 rounded-2xl rounded-tr-sm leading-relaxed shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant — render with markdown
  return (
    <div className="flex justify-start">
      <div className="max-w-2xl bg-surface border border-border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
        <MarkdownBlock text={message.text} />
        <BasedOnTags tags={message.basedOn} />
      </div>
    </div>
  );
}

function BasedOnTags({ tags }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-border">
      <span className="text-[10px] text-muted uppercase tracking-wide font-semibold mr-1">
        Based on:
      </span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-border"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
      </div>
    </div>
  );
}
