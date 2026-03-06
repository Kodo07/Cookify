"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { resolveProAccess } from "@/lib/pro-access";

const { betaAllPro: BETA_ALL_PRO_ENABLED, hasProAccess: PRO_ENABLED } = resolveProAccess(
  process.env.NEXT_PUBLIC_PRO_ENABLED === "true"
);

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/pantry", label: "Pantry" },
  { href: "/planner", label: "Planner" },
  { href: "/shopping-list", label: "Shopping List" },
  { href: "/pricing", label: "Pricing" },
  { href: "/account", label: "Account" }
];

function linkClasses(active: boolean): string {
  return `rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
    active
      ? "border-slate-300 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
  }`;
}

export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <header className={`card border-white/90 p-5 sm:p-6 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Go to homepage"
            className="inline-flex cursor-pointer items-center"
          >
            <BrandLogo variant="full" />
          </Link>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
            {BETA_ALL_PRO_ENABLED ? "Beta: Pro unlocked" : "Beta"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            return (
              <a key={link.href} href={link.href} className={linkClasses(active)}>
                {link.label}
              </a>
            );
          })}

          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              PRO_ENABLED ? "bg-emerald-100 text-emerald-800" : "bg-slate-900 text-white"
            }`}
          >
            {BETA_ALL_PRO_ENABLED
              ? "Pro Unlocked"
              : PRO_ENABLED
                ? "Pro Enabled"
                : "Pro Available"}
          </span>
        </div>
      </div>
    </header>
  );
}
