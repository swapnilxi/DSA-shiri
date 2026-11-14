"use client";

import { useState } from "react";
import { Sparkles, Bot, MessageSquare, Zap, ChevronRight, X, ShieldAlert } from "lucide-react";

interface Props {
  contextName?: string;
  tip?: string;
}

export function NovaBadge({ 
  contextName = "Mission AI", 
  tip = "Nova analyzes interview responses across correctness, depth, communication, and process." 
}: Props) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setShowTip(!showTip)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-accent/20 via-accent/20 to-accent/20 border border-accent/30 text-gold text-xs font-semibold hover:border-accent/45 shadow-sm shadow-violet-950/30 transition-all group"
        title="Nova AI Engine"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-gold group-hover:scale-125 transition-transform animate-pulse" />
        <span className="tracking-wide">Nova AI</span>
        <span className="text-[10px] text-gold/80 px-1.5 py-0.2 bg-accent/15 rounded-full font-mono">
          {contextName}
        </span>
      </button>

      {showTip && (
        <div className="absolute top-full mt-2 left-0 z-30 w-72 p-3 bg-surface-1/95 border border-accent/25 rounded-xl shadow-xl shadow-black/60 backdrop-blur-md text-xs text-text-primary">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border-subtle">
            <span className="font-semibold text-gold flex items-center gap-1">
              <Bot size={13} /> Nova Copilot
            </span>
            <button 
              onClick={() => setShowTip(false)}
              className="text-text-secondary hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
          <p className="leading-relaxed text-text-primary">{tip}</p>
        </div>
      )}
    </div>
  );
}
