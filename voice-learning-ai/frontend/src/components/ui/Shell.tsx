"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ── PageHeader ─────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between ${className ?? ""}`}
    >
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="sm:ml-4">{action}</div>}
      {children}
    </div>
  );
}

// ── PageShell ─────────────────────────────────────────────────────────────────

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={`mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 ${className ?? ""}`}>
      {children}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  hover = false,
  onClick,
}: CardProps) {
  return (
    <div
      className={[
        "panel",
        hover && "panel-interactive cursor-pointer",
        onClick ? "cursor-pointer" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | "neutral"
  | "accent"
  | "gold"
  | "ok"
  | "warn"
  | "error"
  | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variantMap: Record<
  BadgeVariant,
  { bg: string; text: string; ring?: string }
> = {
  neutral: { bg: "bg-surface-2", text: "text-text-secondary" },
  accent: { bg: "bg-accent/10", text: "text-accent", ring: "ring-1 ring-accent/25" },
  gold: { bg: "bg-gold/10", text: "text-gold", ring: "ring-1 ring-gold/30" },
  ok: { bg: "bg-status-ok/10", text: "text-status-ok", ring: "ring-1 ring-status-ok/30" },
  warn: { bg: "bg-status-warn/10", text: "text-status-warn", ring: "ring-1 ring-status-warn/30" },
  error: { bg: "bg-status-error/10", text: "text-status-error", ring: "ring-1 ring-status-error/30" },
  muted: { bg: "bg-surface-2/60", text: "text-text-muted" },
};

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  dot = false,
  className,
}: BadgeProps) {
  const v = variantMap[variant];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        v.bg,
        v.text,
        v.ring ?? "",
        dot && "gap-1.5",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot && (
        <span
          className={[
            "size-1.5 rounded-full",
            variant === "ok"
              ? "bg-status-ok"
              : variant === "warn"
                ? "bg-status-warn"
                : variant === "error"
                  ? "bg-status-error"
                  : variant === "accent"
                    ? "bg-accent"
                    : variant === "gold"
                      ? "bg-gold"
                      : "bg-text-muted",
          ]
            .join(" ")}
        />
      )}
      {children}
    </span>
  );
}

// ── ScorePill ─────────────────────────────────────────────────────────────────

interface ScorePillProps {
  score: number | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function ScorePill({
  score,
  size = "sm",
  showLabel = false,
  className,
}: ScorePillProps) {
  if (score == null) {
    return (
      <span
        className={[
          "inline-flex items-center rounded-md font-medium",
          size === "sm"
            ? "px-1.5 py-0.5 text-[11px]"
            : "px-2 py-0.5 text-xs",
          "text-text-muted bg-surface-2/60",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        —
      </span>
    );
  }

  const pct = Math.min(100, Math.max(0, score));
  const tier =
    pct >= 80
      ? {
          color: "text-status-ok",
          bg: "bg-status-ok/10",
          ring: "ring-1 ring-status-ok/30",
          label: "Strong",
        }
      : pct >= 60
        ? {
            color: "text-status-warn",
            bg: "bg-status-warn/10",
            ring: "ring-1 ring-status-warn/30",
            label: "Needs work",
          }
        : {
            color: "text-status-error",
            bg: "bg-status-error/10",
            ring: "ring-1 ring-status-error/30",
            label: "Not ready",
          };

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md font-semibold",
        size === "sm"
          ? "px-2 py-0.5 text-xs"
          : "px-2.5 py-1 text-sm",
        tier.bg,
        tier.color,
        tier.ring,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {pct.toFixed(0)}
      <span className="text-text-muted font-normal">/100</span>
      {showLabel ? (
        <span className="text-text-muted font-normal">· {tier.label}</span>
      ) : null}
    </span>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: "none" | "search" | "file" | "mic" | "book" | "database" | "settings";
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const emptyIcons: Record<string, React.ReactNode> = {
  search: (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="text-text-muted/60 mx-auto mb-4"
    >
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" />
      <line x1="26" y1="26" x2="34" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  file: (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="text-text-muted/60 mx-auto mb-4"
    >
      <path d="M14 6h12l4 4v20a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 10h12M14 16h12M14 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  mic: (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="text-text-muted/60 mx-auto mb-4"
    >
      <rect x="14" y="4" width="12" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M10 14v6a6 6 0 0 0 20 0v-6M14 34a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  book: (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="text-text-muted/60 mx-auto mb-4"
    >
      <path d="M6 8h28v24a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 14h28M12 14v24M20 14v24M28 14v24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  database: (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="text-text-muted/60 mx-auto mb-4"
    >
      <ellipse cx="20" cy="10" rx="12" ry="4" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10v4c0 2.2 3.6 4 12 4s12-1.8 12-4v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 20v4c0 2.2 3.6 4 12 4s12-1.8 12-4v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 30v-4c0-2.2 3.6-4 12-4s12 1.8 12 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="text-text-muted/60 mx-auto mb-4"
    >
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" />
      <path d="M20 10v4M20 26v4M10 20h4M26 20h4M13.5 13.5l2.8 2.8M23.7 23.7l2.8 2.8M13.5 26.5l2.8-2.8M23.7 16.3l2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
};

export function EmptyState({
  icon = "none",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon !== "none" && emptyIcons[icon] ? emptyIcons[icon] : null}
      <div className="text-center">
        <p className="text-base font-medium text-text-primary">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-sm">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: SectionProps) {
  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      {(title || action) && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-text-muted mt-0.5">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="rounded-xl border border-border-subtle bg-surface-1/40 p-5">
        {children}
      </div>
    </div>
  );
}

// ── ProgressBadge ─────────────────────────────────────────────────────────────

interface ProgressBadgeProps {
  value: number;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBadge({
  value,
  label,
  size = "sm",
  className,
}: ProgressBadgeProps) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80
      ? "bg-status-ok"
      : pct >= 60
        ? "bg-status-warn"
        : "bg-status-error";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm"
          ? "px-1.5 py-0.5 text-[11px]"
          : "px-2 py-0.5 text-xs",
        `${color}/10`,
        color === "bg-status-ok" ? "text-status-ok ring-1 ring-status-ok/25" :
        color === "bg-status-warn" ? "text-status-warn ring-1 ring-status-warn/25" :
        "text-status-error ring-1 ring-status-error/25",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && <span>{label}</span>}
      <span className="text-text-muted font-normal">{pct.toFixed(0)}</span>
    </span>
  );
}

// ── SidebarLink ───────────────────────────────────────────────────────────────

interface SidebarLinkProps {
  href: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string | number;
  className?: string;
}

export function SidebarLink({
  href,
  label,
  description,
  icon,
  active = false,
  badge,
  className,
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "text-accent bg-accent/10 ring-1 ring-accent/20"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="flex items-center gap-2.5">
        {icon && (
          <span
            className={[
              "size-4 shrink-0",
              active ? "text-accent" : "text-text-muted",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {icon}
          </span>
        )}
        <span className="font-medium">{label}</span>
        {badge !== undefined && (
          <span
            className={[
              "ml-auto rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted",
              active && "text-accent bg-accent/10",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {badge}
          </span>
        )}
      </span>
      {description && (
        <span className="text-xs text-text-muted pl-6.5">{description}</span>
      )}
    </Link>
  );
}
