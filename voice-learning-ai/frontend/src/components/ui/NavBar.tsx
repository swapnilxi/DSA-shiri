"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, BookOpen, Sparkles, History, Database, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/practice",  label: "Practice",  icon: BookOpen },
  { href: "/generate",  label: "Generate",  icon: Sparkles },
  { href: "/sessions",  label: "Sessions",  icon: History },
  { href: "/database",  label: "Database",  icon: Database },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();

  // Hide nav bar on interview routes (immersive full-screen experience)
  if (pathname.startsWith("/interview")) return null;

  return (
    <nav className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-12 gap-1">
        {/* App logo / name */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 mr-6 shrink-0"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px]">
            🎙
          </div>
          <span className="text-sm font-bold text-gray-100 hidden sm:inline">
            Voice Learning AI
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-blue-900/40 text-blue-300 border border-blue-800/60"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent"
                }`}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
