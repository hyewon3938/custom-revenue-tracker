"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/insights", label: "인사이트" },
  { href: "/monthly",  label: "월별 대시보드" },
] as const;

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand-50 text-brand-600"
                : "text-gray-500 hover:text-gray-900 hover:bg-warm-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
