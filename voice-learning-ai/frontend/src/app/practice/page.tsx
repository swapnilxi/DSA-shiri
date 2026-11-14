"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Question } from "@/lib/api";

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-status-ok/10 border-status-ok/30 text-status-ok",
  Medium: "bg-status-warn/10 border-status-warn/30 text-status-warn",
  Hard: "bg-status-error/12 border-status-error/30 text-status-error",
};

const PAGE_SIZE = 20;

export default function PracticeListPage() {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  useEffect(() => {
    api.listQuestions({ limit: 200 })
      .then(setQuestions)
      .finally(() => setLoading(false));
  }, []);

  // Reset visible count whenever filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, filterDifficulty, filterCategory, filterTopic]);

  const categories = Array.from(new Set(questions.map(q => q.category).filter(Boolean))) as string[];
  const topics = Array.from(new Set(questions.map(q => q.topic).filter(Boolean))) as string[];

  const filtered = questions.filter(q => {
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (filterCategory && q.category !== filterCategory) return false;
    if (filterTopic && q.topic !== filterTopic) return false;
    if (searchQuery) {
      const lc = searchQuery.toLowerCase();
      return (
        q.question.toLowerCase().includes(lc) ||
        q.topic.toLowerCase().includes(lc) ||
        (q.category ?? "").toLowerCase().includes(lc)
      );
    }
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const hasFilters = filterDifficulty || filterCategory || filterTopic || searchQuery;

  // Infinite scroll: load more when sentinel enters viewport
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibleCount(c => c + PAGE_SIZE); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface-0/85 backdrop-blur-md border-b border-border-subtle px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-text-primary to-text-primary bg-clip-text text-transparent">
                DSA Arena
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/50">
                FAANG Problem Set
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Curated algorithmic challenges with multi-turn AI hints, progressive breakdowns, and vocal solution review
            </p>
          </div>
          <div className="text-xs text-text-secondary font-mono bg-surface-1/80 border border-border-subtle px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-auto">
            {loading ? "Loading challenges..." : `${visible.length} of ${filtered.length} problems shown`}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search problems by name, data structure, category, or target company..."
            className="w-full pl-10 pr-4 py-3 bg-surface-1/80 border border-border-subtle rounded-2xl text-sm text-text-primary placeholder-slate-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all shadow-inner"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty pills — always visible, compact */}
          {["Easy", "Medium", "Hard"].map(d => (
            <button
              key={d}
              onClick={() => setFilterDifficulty(filterDifficulty === d ? "" : d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterDifficulty === d
                  ? d === "Easy"   ? "bg-status-ok/10 border-status-ok/40 text-status-ok"
                  : d === "Medium" ? "bg-status-warn/10 border-status-warn/40 text-status-warn"
                  :                  "bg-status-error/12 border-status-error/45 text-status-error"
                  : "bg-surface-2/60 border-border-default text-text-muted hover:border-border-strong hover:text-text-secondary"
              }`}
            >
              {d}
            </button>
          ))}

          {/* Category dropdown */}
          {categories.length > 0 && (
            <div className="relative">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer focus:outline-none ${
                  filterCategory
                    ? "bg-gold/10 border-accent/40 text-gold"
                    : "bg-surface-2/60 border-border-default text-text-muted hover:border-border-strong"
                }`}
              >
                <option value="">Category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          {/* Topic dropdown */}
          {topics.length > 0 && (
            <div className="relative">
              <select
                value={filterTopic}
                onChange={e => setFilterTopic(e.target.value)}
                className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer focus:outline-none ${
                  filterTopic
                    ? "bg-accent/50 border-accent/40 text-accent"
                    : "bg-surface-2/60 border-border-default text-text-muted hover:border-border-strong"
                }`}
              >
                <option value="">Topic</option>
                {topics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          {hasFilters && (
            <button
              onClick={() => { setFilterDifficulty(""); setFilterCategory(""); setFilterTopic(""); setSearchQuery(""); }}
              className="px-3 py-1.5 rounded-full text-xs border border-border-default text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Question grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface-1 border border-border-subtle rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm">No questions match your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {visible.map(q => (
                <button
                  key={q.id}
                  onClick={() => router.push(`/practice/${q.id}`)}
                  className="text-left p-5 bg-surface-1/65 border border-border-subtle/80 rounded-2xl hover:border-accent/50 hover:bg-surface-2 hover:shadow-lg hover:shadow-accent/20 hover:-translate-y-0.5 transition-all group flex flex-col justify-between"
                >
                  <p className="text-sm font-medium text-text-primary leading-relaxed line-clamp-3 group-hover:text-white transition-colors mb-4">
                    {q.question}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border-subtle/60">
                    <span className="text-xs px-2.5 py-0.5 rounded-lg bg-surface-2/80 border border-border-default/60 text-text-primary font-medium">
                      {q.topic}
                    </span>
                    {q.category && (
                      <span className="text-xs px-2.5 py-0.5 rounded-lg bg-gold/10 border border-gold/20 text-gold font-medium">
                        {q.category}
                      </span>
                    )}
                    <span className={`text-xs px-2.5 py-0.5 rounded-lg border font-semibold ${DIFF_COLORS[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                    {q.company && (
                      <span className="text-xs text-text-muted font-medium ml-auto">@ {q.company}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6 gap-3 text-text-muted text-xs">
                <div className="w-4 h-4 border border-border-default border-t-text-muted rounded-full animate-spin" />
                Loading more…
              </div>
            )}

            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="text-center text-xs text-text-muted py-4">All {filtered.length} questions loaded</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
