"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, BookOpen, Sparkles, History, Database, Settings, Zap,
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
    <nav className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/80 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-13 py-2 gap-2">
        
        {/* Left: App logo / brand */}
        <div className="flex items-center gap-6 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-[12px] shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              🎙️
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-none">
                Voice Learning AI
              </span>
              <span className="text-[10px] text-blue-400 font-medium tracking-wide">FAANG Prep</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-500/10 font-semibold"
                      : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 border border-transparent"
                  }`}
                >
                  <item.icon size={14} className={isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-300"} />
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-blue-400 rounded-full shadow-[0_0_8px_#60a5fa]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Active Mode Pill */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-800/50 text-[11px] font-medium text-indigo-300 hover:border-indigo-600/60 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Zap size={11} className="text-amber-400" />
            <span>AI Coach Ready</span>
          </Link>
        </div>

      </div>
    </nav>
  );
}

