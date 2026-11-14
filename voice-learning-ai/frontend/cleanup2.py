#!/usr/bin/env python3
"""Cleanup pass #2: collapse double opacities + fix substring-replace artifacts."""
import re, glob

FILES = glob.glob("app/**/*.tsx", recursive=True) + glob.glob("components/**/*.tsx", recursive=True)

SIMPLE = [
    # spinner tracks
    ("border-t-border-500", "border-t-text-muted"),
    ("border-t-gray-500", "border-t-text-muted"),
    # hover on solid accent buttons
    ("bg-accent hover:bg-accent ", "bg-accent hover:bg-accent-bright "),
    ("bg-status-ok hover:bg-status-ok ", "bg-status-ok hover:brightness-110 "),
    # remaining stragglers
    ("text-amber-200", "text-text-secondary"),
    ("text-amber-100", "text-text-secondary"),
    ("text-orange-300", "text-gold"),
    ("text-orange-400", "text-gold"),
    ("border-orange-800/40", "border-gold/25"),
    ("border-amber-700/40", "border-gold/25"),
    ("border-amber-800/40", "border-gold/25"),
    ("text-indigo-100", "text-text-secondary"),
    ("text-yellow-500", "text-status-warn"),
    ("text-yellow-100", "text-text-primary"),
    ("text-emerald-500", "text-status-ok"),
    ("text-green-600", "text-status-ok"),
    ("bg-red-500", "bg-status-error"),
    ("bg-yellow-500", "bg-status-warn"),
    ("hover:bg-red-500", "hover:bg-status-error"),
    ("border-yellow-600", "border-status-warn/40"),
    ("border-yellow-500", "border-status-warn/40"),
    ("to-green-900/30", "to-status-ok/20"),
    ("to-purple-900/30", "to-gold/20"),
    ("from-purple-900", "from-gold/20"),
    ("shadow-[0_0_15px_rgba(239,68,68,0.5)]", "shadow-[0_0_15px_rgba(248,113,113,0.45)]"),
]

double_re = re.compile(
    r"(/(?:10|12|15|20|25|30|35|40|45|50|60))/(?:10|12|15|20|25|30|35|40|45|50|60|70|80|90)\b"
)

total = 0
for path in FILES:
    with open(path) as f:
        src = f.read()
    dst = src
    for old, new in SIMPLE:
        dst = dst.replace(old, new)
    # collapse double opacity suffixes, keeping the first (mapped) value
    dst = double_re.sub(r"\1", dst)
    if dst != src:
        with open(path, "w") as f:
            f.write(dst)
        total += 1
        print("cleaned", path)
print("files touched:", total)
