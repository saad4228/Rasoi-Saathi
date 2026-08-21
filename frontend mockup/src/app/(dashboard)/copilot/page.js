"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, TrendingUp, Package, Receipt } from "lucide-react";

const suggestedPrompts = [
  "Why did my profit drop this week?",
  "What happens if I raise Chicken Biryani price by ₹10?",
  "Predict tomorrow's chicken demand",
  "Which dish is losing me money?",
];

// Mock canned response — replace with real API call later
function getMockResponse(question) {
  if (question.toLowerCase().includes("biryani") || question.toLowerCase().includes("price")) {
    return {
      type: "structured",
      intro: "Based on your historical data, here's what we estimate:",
      points: [
        "Estimated 6% drop in Biryani orders (~120 fewer/month) if you raise the price by ₹10.",
        "That's about ₹6,000/month lost from fewer orders.",
        "But the remaining ~1,880 orders each earn ₹10 more — about ₹18,800/month gained.",
      ],
      netEffect: "+₹12,800/month.",
      recommendation: "Go ahead — the price increase is worth it.",
      basedOn: ["Sales", "Inventory", "Orders", "Expenses"],
    };
  }
  return {
    type: "plain",
    text: "I've looked at your recent sales, inventory, and order data — let me know if you'd like me to break down a specific number, like revenue, waste, or a pricing decision.",
    basedOn: ["Sales", "Inventory", "Orders"],
  };
}

export default function CopilotPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text) => {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = getMockResponse(text);
      setMessages((prev) => [...prev, { role: "assistant", ...response }]);
      setIsTyping(false);
    }, 900);
  };

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      {/* Radial glow background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 800px 500px at 50% 45%, rgba(230,82,43,0.18), transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-surface">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-ink text-sm">RasoiSaathi Copilot</p>
          <p className="text-xs text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Online · Red Villa Restaurant
          </p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            {/* One-liner greeting */}
            <div className="flex items-center gap-3 mb-8">
              <Sparkles className="w-7 h-7 text-orange-500" strokeWidth={1.5} />
              <h2 className="text-3xl font-serif text-ink">
                What shall we cook up today?
              </h2>
            </div>

            {/* Suggested prompt chips */}
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

        <div ref={scrollRef} />
      </div>

      {/* Input */}
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
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the Copilot anything about your restaurant..."
            className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-md bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-medium px-4 py-2.5 rounded-2xl rounded-tr-sm">
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant message
  if (message.type === "structured") {
    return (
      <div className="flex justify-start">
        <div className="max-w-lg bg-surface border border-border rounded-2xl rounded-tl-sm p-4">
          <p className="text-sm text-ink mb-2">{message.intro}</p>
          <ol className="space-y-1.5 mb-3">
            {message.points.map((point, i) => (
              <li key={i} className="text-sm text-muted flex gap-2">
                <span className="text-accent font-semibold">{i + 1}.</span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
          <div className="border-t border-border pt-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">Net effect:</span>{" "}
              <span className="text-green-500 font-bold">{message.netEffect}</span>
            </p>
            <p className="text-sm text-ink mt-1">
              <span className="font-semibold">Recommendation:</span> {message.recommendation}
            </p>
          </div>
          <BasedOnTags tags={message.basedOn} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-md bg-surface border border-border rounded-2xl rounded-tl-sm p-4">
        <p className="text-sm text-ink">{message.text}</p>
        <BasedOnTags tags={message.basedOn} />
      </div>
    </div>
  );
}

function BasedOnTags({ tags }) {
  const icons = { Sales: TrendingUp, Inventory: Package, Orders: Receipt, Expenses: Receipt };
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border">
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
      <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
      </div>
    </div>
  );
}