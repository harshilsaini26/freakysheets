"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { levelFor, streakOf, useProgress } from "@/lib/game/progress";

const NAV = [
  { href: "/learn", label: "Learn" },
  { href: "/play", label: "Play" },
  { href: "/companies", label: "Companies" },
  { href: "/upload", label: "Analyze a file" },
];

export function XpBar({ compact = false }: { compact?: boolean }) {
  const { p, ready } = useProgress();
  const lv = levelFor(p.xp);
  const streak = streakOf(p.days);
  if (!ready) return <div className="h-8 w-40" />;
  return (
    <Link href="/progress" className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-panel-2" title="Your progress">
      <div className="flex flex-col leading-tight">
        <span className="text-xs text-muted">Lv {lv.index}{compact ? "" : ` · ${lv.title}`}</span>
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
        </div>
      </div>
      <span className="num text-sm font-bold text-gold">{p.xp} XP</span>
      {streak > 0 && <span className="text-sm" title={`${streak}-day streak`}>🔥{streak}</span>}
    </Link>
  );
}

function Toasts() {
  const { toasts } = useProgress();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pop rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${
            t.kind === "xp" ? "bg-gold-soft text-gold" : t.kind === "badge" ? "bg-accent-soft text-accent" : "bg-ink text-bg"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">L</span>
            <span>{APP_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  path?.startsWith(n.href) ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <XpBar />
          </div>
          <button className="btn btn-ghost md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>
        </div>
        {open && (
          <div className="border-t border-line px-4 py-2 md:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-2 font-medium">
                {n.label}
              </Link>
            ))}
            <XpBar compact />
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-muted">
        Data: SEC EDGAR XBRL company facts (public domain). Training companies are fictional. For learning only, not
        investment advice. <Link className="underline" href="/about">Method & sources</Link>
      </footer>
      <Toasts />
    </>
  );
}
