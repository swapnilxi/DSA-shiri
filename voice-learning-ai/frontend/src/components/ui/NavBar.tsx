"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Code2,
  Sparkles,
  History,
  Database,
  Settings,
  Compass,
  Menu,
  X,
  Circle,
} from "lucide-react";

import { WisdomModal } from "./WisdomModal";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home",          icon: LayoutDashboard },
  { href: "/practice",  label: "DSA Arena",     icon: Code2 },
  { href: "/generate",  label: "Question Lab",  icon: Sparkles },
  { href: "/sessions",  label: "Sessions",      icon: History },
  { href: "/database",  label: "Question Bank", icon: Database },
  { href: "/settings",  label: "Settings",      icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();
  const [wisdomOpen, setWisdomOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide nav bar on interview routes (immersive full-screen experience)
  if (pathname.startsWith("/interview")) return null;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border-subtle bg-surface-0/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-border-subtle group-hover:ring-accent/40 transition-all">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2.5 11.5 L8 3 L13.5 11.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent"
                />
                <circle cx="8" cy="11.5" r="1.2" fill="currentColor" className="text-gold" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-text-primary tracking-tight">
                NextLevel
              </span>
              <span className="text-[10px] font-medium text-text-muted tracking-wide uppercase">
                The Engineer&apos;s Journey
              </span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive ? "text-accent bg-accent/10 ring-1 ring-accent/25" : "text-text-secondary hover:text-text-primary hover:bg-surface-2"}`}
                >
                  <item.icon
                    size={14}
                    className={isActive ? "text-accent" : "text-text-muted group-hover:text-text-secondary"}
                  />
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2.5 right-2.5 h-[1px] bg-accent/60 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Wisdom & Courage */}
            <button
              type="button"
              onClick={() => setWisdomOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-border-subtle transition-colors hover:bg-surface-3 hover:text-text-primary"
              title="Wisdom & Courage reflections"
            >
              <Compass size={12} className="text-accent" />
              Wisdom & Courage
            </button>

            {/* Nova status pill */}
            <Link
              href="/settings"
              className="hidden md:inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-text-secondary ring-1 ring-border-subtle transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              <span className="size-1.5 rounded-full bg-status-ok animate-pulse" />
              <span className="text-text-muted">Nova</span>
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary lg:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X size={18} />
              ) : (
                <Menu size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-border-subtle bg-surface-0/95 backdrop-blur-xl px-4 py-3">
            <div className="flex flex-col space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "text-accent bg-accent/10 ring-1 ring-accent/20" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"}`}
                  >
                    <item.icon
                      size={16}
                      className={isActive ? "text-accent" : "text-text-muted"}
                    />
                    {item.label}
                    {isActive && <Circle size={4} className="ml-auto fill-current text-accent" />}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Wisdom & Courage Modal */}
      <WisdomModal isOpen={wisdomOpen} onClose={() => setWisdomOpen(false)} />
    </>
  );
}
