"use client";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-text-muted px-6 py-2.5 bg-surface-0/70 border-b border-border-subtle/40 backdrop-blur-sm print:hidden">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isFirst = i === 0;
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <ChevronRight size={12} className="text-text-muted shrink-0" />}
            {isLast || !item.href ? (
              <span className={`flex items-center gap-1.5 ${isLast ? "text-text-primary font-semibold" : "text-text-muted"}`}>
                {isFirst && <Home size={12} className="text-text-muted" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-1.5 text-text-secondary hover:text-accent font-medium transition-colors"
              >
                {isFirst && <Home size={12} className="text-text-secondary" />}
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}

