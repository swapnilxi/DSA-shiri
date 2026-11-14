#!/usr/bin/env python3
"""Map legacy Tailwind palette classes to NextLevel design tokens."""
import sys

FILES = [
    "app/dashboard/session/[sessionId]/page.tsx",
    "app/practice/page.tsx",
    "app/practice/[questionId]/page.tsx",
    "app/generate/page.tsx",
    "app/database/page.tsx",
    "app/sessions/page.tsx",
    "app/settings/page.tsx",
    "components/interview/InterviewRoom.tsx",
    "components/interview/ScoreOverlay.tsx",
    "components/interview/TranscriptPanel.tsx",
    "components/ui/Breadcrumbs.tsx",
    "components/ui/ToastContext.tsx",
    "components/ui/NovaBadge.tsx",
    "components/dashboard/TopicRadar.tsx",
]

MAPPINGS = [
    # Surfaces
    ("bg-gray-950", "bg-surface-0"), ("bg-slate-950", "bg-surface-0"),
    ("bg-gray-900", "bg-surface-1"), ("bg-slate-900", "bg-surface-1"),
    ("bg-gray-850", "bg-surface-2"), ("bg-slate-850", "bg-surface-2"),
    ("bg-gray-800", "bg-surface-2"), ("bg-slate-800", "bg-surface-2"),
    ("bg-gray-750", "bg-surface-3"), ("bg-slate-750", "bg-surface-3"),
    ("bg-gray-700", "bg-surface-3"), ("bg-slate-700", "bg-surface-3"),
    ("bg-gray-600", "bg-surface-3"), ("bg-slate-600", "bg-surface-3"),
    ("bg-gray-500", "bg-surface-3"), ("bg-slate-500", "bg-surface-3"),
    # Borders
    ("border-gray-800", "border-border-subtle"), ("border-slate-800", "border-border-subtle"),
    ("border-gray-700", "border-border-default"), ("border-slate-700", "border-border-default"),
    ("border-gray-600", "border-border-strong"), ("border-slate-600", "border-border-strong"),
    ("hover:border-gray-600", "hover:border-border-strong"),
    ("hover:border-slate-600", "hover:border-border-strong"),
    # Text neutrals
    ("text-gray-700", "text-text-muted"), ("text-slate-700", "text-text-muted"),
    ("text-gray-600", "text-text-muted"), ("text-slate-600", "text-text-muted"),
    ("text-gray-500", "text-text-muted"), ("text-slate-500", "text-text-muted"),
    ("text-gray-400", "text-text-secondary"), ("text-slate-400", "text-text-secondary"),
    ("text-gray-300", "text-text-primary"), ("text-slate-300", "text-text-primary"),
    ("text-gray-200", "text-text-primary"), ("text-slate-200", "text-text-primary"),
    ("text-gray-100", "text-text-primary"), ("text-slate-100", "text-text-primary"),
    ("hover:text-gray-200", "hover:text-text-primary"),
    ("hover:text-gray-300", "hover:text-text-primary"),
    ("hover:text-gray-400", "hover:text-text-secondary"),
    ("hover:text-gray-500", "hover:text-text-secondary"),
    ("hover:bg-gray-700", "hover:bg-surface-3"),
    ("hover:bg-gray-800", "hover:bg-surface-2"),
    ("hover:bg-gray-900", "hover:bg-surface-1"),
    ("hover:bg-slate-800", "hover:bg-surface-2"),
    ("placeholder-gray-600", "placeholder:text-text-muted"),
    ("placeholder-gray-500", "placeholder:text-text-muted"),
]

MAPPINGS += [
    # Accent blue / indigo → electric blue token
    ("text-blue-500", "text-accent"), ("text-blue-400", "text-accent"), ("text-blue-300", "text-accent"),
    ("text-blue-200", "text-accent-bright"), ("text-blue-100", "text-accent-bright"),
    ("text-indigo-400", "text-accent"), ("text-indigo-300", "text-accent"), ("text-indigo-200", "text-accent-bright"),
    ("hover:text-blue-200", "hover:text-accent-bright"),
    ("hover:text-blue-300", "hover:text-accent-bright"),
    ("hover:text-blue-400", "hover:text-accent-bright"),
    ("hover:text-blue-500", "hover:text-accent-bright"),
    ("hover:text-indigo-300", "hover:text-accent-bright"),
    ("bg-blue-950", "bg-accent"), ("bg-blue-900", "bg-accent"), ("bg-blue-800", "bg-accent"),
    ("bg-blue-700", "bg-accent"), ("bg-blue-600", "bg-accent"), ("bg-blue-500", "bg-accent"), ("bg-blue-400", "bg-accent"),
    ("bg-indigo-950", "bg-accent"), ("bg-indigo-900", "bg-accent"), ("bg-indigo-800", "bg-accent"),
    ("bg-indigo-700", "bg-accent"), ("bg-indigo-600", "bg-accent"), ("bg-indigo-500", "bg-accent"), ("bg-indigo-400", "bg-accent"),
    ("hover:bg-blue-900", "hover:bg-accent/10"), ("hover:bg-blue-700", "hover:bg-accent-bright"),
    ("hover:bg-blue-600", "hover:bg-accent-bright"), ("hover:bg-blue-500", "hover:bg-accent-bright"),
    ("hover:bg-indigo-700", "hover:bg-accent-bright"), ("hover:bg-indigo-600", "hover:bg-accent-bright"),
    ("hover:bg-indigo-500", "hover:bg-accent-bright"),
    ("border-blue-900", "border-accent/25"), ("border-blue-800", "border-accent/25"), ("border-blue-700", "border-accent/35"),
    ("border-blue-600", "border-accent/40"), ("border-blue-500", "border-accent/50"), ("border-blue-400", "border-accent/50"),
    ("border-indigo-900", "border-accent/25"), ("border-indigo-800", "border-accent/25"), ("border-indigo-700", "border-accent/35"),
    ("border-indigo-600", "border-accent/40"), ("border-indigo-500", "border-accent/50"), ("border-indigo-400", "border-accent/50"),
    ("hover:border-blue-700", "hover:border-accent/45"),
    ("hover:border-blue-600", "hover:border-accent/45"),
    ("hover:border-indigo-700", "hover:border-accent/45"),
    ("hover:border-indigo-500", "hover:border-accent/45"),
    ("ring-indigo-500", "ring-accent"),
    ("hover:shadow-indigo-950", "hover:shadow-accent"),
    ("hover:shadow-blue-950", "hover:shadow-accent"),
    ("from-indigo-950", "from-accent/30"), ("to-indigo-950", "to-accent/30"), ("from-blue-950", "from-accent/20"), ("to-blue-950", "to-accent/20"),
    ("from-indigo-900", "from-accent/30"), ("to-indigo-900", "to-accent/30"), ("from-blue-900", "from-accent/20"), ("to-blue-900", "to-accent/20"),
    ("from-indigo-600", "from-accent"), ("via-indigo-500", "via-accent"), ("to-violet-600", "to-accent-bright"),
    ("via-indigo-950", "via-accent/20"), ("from-violet-950", "from-accent/20"), ("via-blue-950", "via-accent/20"), ("to-violet-950", "to-accent/20"),
    ("focus:border-blue-600", "focus:border-accent/60"),
    ("focus:border-blue-500", "focus:border-accent/60"),
    ("focus:border-indigo-600", "focus:border-accent/60"),
    ("focus:border-purple-600", "focus:border-accent/60"),
    # Purple / violet → gold (chips) or accent (buttons)
    ("text-purple-400", "text-gold"), ("text-purple-300", "text-gold"), ("text-purple-200", "text-gold"), ("text-purple-100", "text-gold"),
    ("text-violet-400", "text-gold"), ("text-violet-300", "text-gold"),
    ("bg-purple-950", "bg-gold/10"), ("bg-purple-900", "bg-gold/10"), ("bg-purple-800", "bg-gold/20"),
    ("bg-purple-700", "bg-accent"), ("bg-purple-600", "bg-accent"), ("bg-purple-500", "bg-gold"),
    ("bg-violet-950", "bg-accent/10"), ("bg-violet-900", "bg-accent/15"), ("bg-violet-400", "bg-gold"),
    ("hover:bg-purple-700", "hover:bg-accent-bright"), ("hover:bg-purple-600", "hover:bg-accent-bright"),
    ("hover:bg-purple-900", "hover:bg-gold/15"), ("hover:border-purple-700", "hover:border-accent/45"),
    ("border-purple-900", "border-gold/20"), ("border-purple-800", "border-gold/20"), ("border-purple-700", "border-gold/25"),
    ("border-purple-600", "border-accent/40"),
    ("border-violet-800", "border-accent/25"), ("border-violet-700", "border-accent/30"), ("border-violet-500", "border-accent/45"),
    ("hover:border-violet-500", "hover:border-accent/45"),
]

MAPPINGS += [
    # Emerald / green → status ok
    ("text-emerald-400", "text-status-ok"), ("text-emerald-300", "text-status-ok"),
    ("text-emerald-200", "text-status-ok"), ("text-emerald-100", "text-status-ok"),
    ("text-green-500", "text-status-ok"), ("text-green-400", "text-status-ok"),
    ("text-green-300", "text-status-ok"), ("text-green-200", "text-status-ok"),
    ("bg-emerald-950", "bg-status-ok/10"), ("bg-emerald-900", "bg-status-ok/10"), ("bg-emerald-800", "bg-status-ok/20"),
    ("bg-emerald-700", "bg-status-ok"), ("bg-emerald-600", "bg-status-ok"), ("bg-emerald-500", "bg-status-ok"), ("bg-emerald-400", "bg-status-ok"),
    ("bg-green-950", "bg-status-ok/10"), ("bg-green-900", "bg-status-ok/10"), ("bg-green-800", "bg-status-ok/20"),
    ("bg-green-700", "bg-status-ok"), ("bg-green-600", "bg-status-ok"), ("bg-green-500", "bg-status-ok"),
    ("hover:bg-emerald-600", "hover:bg-status-ok"), ("hover:bg-emerald-500", "hover:bg-status-ok"),
    ("hover:bg-emerald-900", "hover:bg-status-ok/20"),
    ("border-emerald-800", "border-status-ok/30"), ("border-emerald-700", "border-status-ok/35"),
    ("border-emerald-600", "border-status-ok/40"), ("border-emerald-400", "border-status-ok/50"),
    ("border-green-800", "border-status-ok/30"), ("border-green-700", "border-status-ok/35"), ("border-green-600", "border-status-ok/40"),
    ("from-emerald-900", "from-status-ok/20"), ("to-emerald-900", "to-status-ok/20"),
    ("from-emerald-600", "from-status-ok"), ("via-emerald-500", "via-status-ok"), ("to-teal-500", "to-accent"),
    # Yellow → status warn; amber → gold
    ("text-yellow-400", "text-status-warn"), ("text-yellow-300", "text-status-warn"), ("text-yellow-200", "text-status-warn"),
    ("bg-yellow-950", "bg-status-warn/10"), ("bg-yellow-900", "bg-status-warn/10"), ("bg-yellow-800", "bg-status-warn/20"),
    ("border-yellow-800", "border-status-warn/30"), ("border-yellow-700", "border-status-warn/35"),
    ("from-yellow-900", "from-status-warn/20"), ("to-amber-900", "to-gold/20"),
    ("text-amber-400", "text-gold"), ("text-amber-300", "text-gold"),
    ("text-amber-600", "text-gold"), ("text-amber-100", "text-gold"),
    ("bg-amber-950", "bg-gold/10"), ("bg-amber-900", "bg-gold/10"), ("bg-amber-800", "bg-gold/20"),
    ("bg-amber-600", "bg-gold"), ("bg-amber-500", "bg-gold"),
    ("hover:bg-amber-500", "hover:bg-gold"),
    ("border-amber-800", "border-gold/25"), ("border-amber-500", "border-gold/40"),
    # Red → status error
    ("text-red-600", "text-status-error"), ("text-red-500", "text-status-error"),
    ("text-red-400", "text-status-error"), ("text-red-300", "text-status-error"), ("text-red-200", "text-status-error"),
    ("hover:text-red-400", "hover:text-status-error"), ("hover:text-red-300", "hover:text-status-error"),
    ("bg-red-950", "bg-status-error/10"), ("bg-red-900", "bg-status-error/12"),
    ("bg-red-800", "bg-status-error/25"), ("bg-red-600", "bg-status-error"),
    ("hover:bg-red-900", "hover:bg-status-error/20"), ("hover:bg-red-800", "hover:bg-status-error/30"),
    ("border-red-800", "border-status-error/30"), ("border-red-700", "border-status-error/35"),
    ("border-red-600", "border-status-error/45"), ("border-red-900", "border-status-error/25"),
    ("hover:border-red-700", "hover:border-status-error/45"),
    ("from-red-900", "from-status-error/20"), ("to-red-900", "to-status-error/20"),
    # Orange / teal / rose / cyan (viz + misc) → gold / accent
    ("text-orange-600", "text-gold"), ("text-orange-200", "text-gold"),
    ("bg-orange-950", "bg-gold/10"), ("bg-orange-900", "bg-gold/10"), ("bg-orange-500", "bg-gold"),
    ("border-orange-700", "border-gold/35"),
    ("bg-teal-500", "bg-accent"), ("to-cyan-600", "to-accent"),
    ("from-cyan-900", "from-accent/20"), ("to-cyan-900", "to-accent/20"),
    ("from-rose-900", "from-status-error/20"), ("to-rose-900", "to-status-error/20"),
    # Gradient text leftovers
    ("from-white to-slate-300", "from-text-primary to-text-primary"),
]

for path in FILES:
    with open(path) as f:
        src = f.read()
    dst = src
    for old, new in MAPPINGS:
        dst = dst.replace(old, new)
    if dst != src:
        with open(path, "w") as f:
            f.write(dst)
        print("migrated", path)
    else:
        print("unchanged", path)
