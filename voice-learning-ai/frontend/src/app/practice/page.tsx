"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Question } from "@/lib/api";

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-green-900/30 border-green-800/50 text-green-400",
  Medium: "bg-yellow-900/30 border-yellow-800/50 text-yellow-400",
  Hard: "bg-red-900/30 border-red-800/50 text-red-400",
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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <div className="h-4 w-px bg-gray-800" />
            <p className="text-sm font-semibold text-gray-200">Practice Questions</p>
          </div>
          <p className="text-xs text-gray-600">
            {loading ? "Loading…" : `${visible.length} of ${filtered.length}${filtered.length < questions.length ? ` (filtered from ${questions.length})` : ""}`}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search questions, topics, categories…"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
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
                  ? d === "Easy"   ? "bg-green-900/60 border-green-600 text-green-300"
                  : d === "Medium" ? "bg-yellow-900/60 border-yellow-600 text-yellow-300"
                  :                  "bg-red-900/60 border-red-600 text-red-300"
                  : "bg-gray-800/60 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
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
                    ? "bg-purple-900/50 border-purple-600 text-purple-300"
                    : "bg-gray-800/60 border-gray-700 text-gray-500 hover:border-gray-600"
                }`}
              >
                <option value="">Category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
                    ? "bg-blue-900/50 border-blue-600 text-blue-300"
                    : "bg-gray-800/60 border-gray-700 text-gray-500 hover:border-gray-600"
                }`}
              >
                <option value="">Topic</option>
                {topics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          {hasFilters && (
            <button
              onClick={() => { setFilterDifficulty(""); setFilterCategory(""); setFilterTopic(""); setSearchQuery(""); }}
              className="px-3 py-1.5 rounded-full text-xs border border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-600 transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Question grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm">No questions match your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visible.map(q => (
                <button
                  key={q.id}
                  onClick={() => router.push(`/practice/${q.id}`)}
                  className="text-left p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-600 hover:bg-gray-800/60 transition-all group"
                >
                  <p className="text-sm text-gray-200 leading-relaxed line-clamp-3 group-hover:text-white transition-colors mb-3">
                    {q.question}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
                      {q.topic}
                    </span>
                    {q.category && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 border border-purple-800/50 text-purple-400">
                        {q.category}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${DIFF_COLORS[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                    {q.company && (
                      <span className="text-xs text-gray-600">@ {q.company}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-6 gap-3 text-gray-600 text-xs">
                <div className="w-4 h-4 border border-gray-700 border-t-gray-500 rounded-full animate-spin" />
                Loading more…
              </div>
            )}

            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="text-center text-xs text-gray-700 py-4">All {filtered.length} questions loaded</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
