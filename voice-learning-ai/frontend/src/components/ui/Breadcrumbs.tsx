"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
    <div className="flex items-center gap-1.5 text-xs text-gray-500 px-6 py-2 bg-gray-950 border-b border-gray-800/50">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={10} className="text-gray-700" />}
            {isLast || !item.href ? (
              <span className={isLast ? "text-gray-300 font-medium" : "text-gray-500"}>
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-blue-400 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
