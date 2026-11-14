"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Compass, Shield, Quote, RefreshCw } from "lucide-react";

interface WisdomQuote {
  quote: string;
  source: string;
  theme: "Wisdom" | "Courage" | "Focus" | "Mastery";
  action: string;
}

const WISDOM_COLLECTION: WisdomQuote[] = [
  {
    theme: "Courage",
    quote: "You have power over your mind — not outside events. Realize this, and you will find strength.",
    source: "Marcus Aurelius, Meditations",
    action: "Face challenging algorithms without anxiety. One edge case at a time.",
  },
  {
    theme: "Wisdom",
    quote: "We do not rise to the level of our expectations; we fall to the level of our training.",
    source: "Archilochus",
    action: "Focus on articulating your thought process cleanly rather than rushing to perfection.",
  },
  {
    theme: "Mastery",
    quote: "First solve the problem. Then, write the code.",
    source: "John Johnson",
    action: "State the brute force, analyze bottlenecks, and clarify constraints before coding.",
  },
  {
    theme: "Focus",
    quote: "The impediment to action advances action. What stands in the way becomes the way.",
    source: "Marcus Aurelius",
    action: "When an interviewer pushes back with follow-ups, treat it as a partnership.",
  },
  {
    theme: "Courage",
    quote: "Do not fear failure so much as fear taking no action. Growth lives on the edge of uncertainty.",
    source: "Zen Proverb",
    action: "Embrace challenging Hard topics today. Every attempt strengthens pattern intuition.",
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function WisdomModal({ isOpen, onClose }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setIndex(Math.floor(Math.random() * WISDOM_COLLECTION.length));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const current = WISDOM_COLLECTION[index];

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % WISDOM_COLLECTION.length);
  };

  const themeColors: Record<WisdomQuote["theme"], { bg: string; text: string; ring: string; dot: string }> = {
    Wisdom:   { bg: "bg-accent/10", text: "text-accent", ring: "ring-1 ring-accent/25", dot: "bg-accent" },
    Courage:  { bg: "bg-gold/10", text: "text-gold", ring: "ring-1 ring-gold/30", dot: "bg-gold" },
    Focus:    { bg: "bg-status-warn/10", text: "text-status-warn", ring: "ring-1 ring-status-warn/30", dot: "bg-status-warn" },
    Mastery:  { bg: "bg-status-ok/10", text: "text-status-ok", ring: "ring-1 ring-status-ok/30", dot: "bg-status-ok" },
  };

  const theme = themeColors[current.theme];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Backdrop click to close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Close"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border-default bg-surface-1 shadow-lg shadow-black/40"
      >
        {/* Subtle top accent */}
        <div className="h-0.5 bg-gradient-to-r from-accent/40 via-gold/40 to-accent/0" />

        <div className="mx-6 mt-6 flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-border-subtle">
              <Compass size={15} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                Wisdom & Courage
              </h2>
              <p className="text-[11px] text-text-muted">
                Mindset anchors for high-stakes technical interviews
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              theme.bg,
              theme.text,
              theme.ring,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span
              className={["size-1.5 rounded-full", theme.dot]
                .filter(Boolean)
                .join(" ")}
            />
            {current.theme}
          </span>
          <span className="text-[11px] text-text-muted font-mono">
            Reflection {index + 1} of {WISDOM_COLLECTION.length}
          </span>
        </div>

        <blockquote className="mt-5 px-5 py-5 border border-border-subtle bg-surface-0/40 rounded-xl">
          <Quote
            size={18}
            className="text-text-muted/40 absolute top-4 right-4"
            aria-hidden="true"
          />
          <p className="pl-6 text-base font-medium leading-relaxed text-text-primary italic pr-7">
            &ldquo;{current.quote}&rdquo;
          </p>
          <p className="mt-3 text-right text-xs text-accent font-medium">
            — {current.source}
          </p>
        </blockquote>

        <div className="mx-6 mb-6 flex items-start gap-3 p-3.5 border border-gold/20 bg-gold/5 rounded-xl">
          <Sparkles size={13} className="text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gold font-semibold mb-1">
              Today&apos;s Anchor
            </p>
            <p className="text-xs leading-relaxed text-text-secondary">
              {current.action}
            </p>
          </div>
        </div>

        <div className="mx-6 mt-2 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <RefreshCw size={12} />
            Next reflection
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-2 text-xs font-semibold text-surface-0 shadow-sm shadow-accent/20 transition-all hover:bg-accent-bright"
          >
            Ready to Begin
          </button>
        </div>
      </div>
    </div>
  );
}
