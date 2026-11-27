"use client";
// Player progress: XP, levels, streaks and badges. Stored in this browser's
// localStorage (no accounts, no server), so it works on a static Vercel deploy.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export const LEVELS = [
  { xp: 0, title: "Intern" },
  { xp: 100, title: "Junior Analyst" },
  { xp: 250, title: "Analyst" },
  { xp: 500, title: "Senior Analyst" },
  { xp: 900, title: "Associate" },
  { xp: 1400, title: "Vice President" },
  { xp: 2100, title: "Director of Research" },
  { xp: 3000, title: "Portfolio Manager" },
  { xp: 4200, title: "Legend of the Ledger" },
];

export const BADGES: Record<string, { name: string; desc: string; icon: string }> = {
  first_step: { name: "First Entry", desc: "Answer your first question correctly", icon: "✏️" },
  three_statements: { name: "Three-Statement Thinker", desc: "Finish the income statement, balance sheet and cash flow lessons", icon: "📚" },
  dupont: { name: "DuPont Decoder", desc: "Finish the returns and DuPont lesson", icon: "🧩" },
  detective: { name: "Forensic Accountant", desc: "Score 5 or more in Red Flag Hunt", icon: "🔎" },
  speed: { name: "Speed Reader", desc: "Get 10 right in one Ratio Rush", icon: "⚡" },
  mystery: { name: "Ledger Detective", desc: "Identify 5 mystery companies in a row", icon: "🕵️" },
  higher_lower: { name: "Market Sense", desc: "Reach a streak of 8 in Higher or Lower", icon: "📈" },
  explorer: { name: "Explorer", desc: "Open 10 different company reports", icon: "🧭" },
  uploader: { name: "Own Your Analysis", desc: "Analyze a statement you uploaded", icon: "📤" },
  oracle: { name: "Oracle", desc: "Get 10 'Call it' predictions right", icon: "🔮" },
  streak3: { name: "On a Roll", desc: "Practice 3 days in a row", icon: "🔥" },
  streak7: { name: "Habit Formed", desc: "Practice 7 days in a row", icon: "🏆" },
  graduate: { name: "Path Complete", desc: "Pass every lesson on the learning path", icon: "🎓" },
};

export interface Progress {
  xp: number;
  answered: number;
  correct: number;
  days: string[]; // ISO dates with activity
  badges: string[];
  lessons: Record<string, number>; // lesson id -> best score (0..1)
  games: Record<string, number>; // game id -> best score
  viewed: string[];
  calls: Record<string, boolean>; // "TICKER:challenge" -> answered correctly
}

const EMPTY: Progress = { xp: 0, answered: 0, correct: 0, days: [], badges: [], lessons: {}, games: {}, viewed: [], calls: {} };
const KEY = "ledger-progress-v1";

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    index: i + 1,
    title: cur.title,
    next: next ?? null,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  };
}

export function streakOf(days: string[]) {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  // Count back from today (or yesterday, so a streak survives until you play today).
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  while (set.has(iso(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Toast {
  id: number;
  text: string;
  kind: "xp" | "badge" | "level";
}

interface Ctx {
  p: Progress;
  ready: boolean;
  /** Record an answer. Returns XP awarded. */
  answer: (correct: boolean, xp?: number) => number;
  addXp: (xp: number, why?: string) => void;
  badge: (id: string) => void;
  setLesson: (id: string, score: number) => void;
  setGame: (id: string, score: number) => void;
  view: (ticker: string) => void;
  call: (key: string, correct: boolean) => void;
  reset: () => void;
  toasts: Toast[];
}

const ProgressCtx = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Progress>(EMPTY);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setP({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* private mode or blocked storage: play without saving */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, [p, ready]);

  const toast = useCallback((text: string, kind: Toast["kind"]) => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  /** Apply an update, then check level-ups, streak badges and milestone badges. */
  const update = useCallback(
    (fn: (p: Progress) => Progress) => {
      setP((prev) => {
        let next = fn(prev);
        const today = iso(new Date());
        if (next.xp !== prev.xp && !next.days.includes(today)) next = { ...next, days: [...next.days, today].slice(-60) };
        const earn = (id: string, cond: boolean) => {
          if (cond && !next.badges.includes(id)) {
            next = { ...next, badges: [...next.badges, id] };
            setTimeout(() => toast(`Badge unlocked: ${BADGES[id].icon} ${BADGES[id].name}`, "badge"), 0);
          }
        };
        const s = streakOf(next.days);
        earn("streak3", s >= 3);
        earn("streak7", s >= 7);
        earn("first_step", next.correct >= 1);
        earn("explorer", next.viewed.length >= 10);
        earn("oracle", Object.values(next.calls).filter(Boolean).length >= 10);
        const a = levelFor(prev.xp);
        const b = levelFor(next.xp);
        if (b.index > a.index) setTimeout(() => toast(`Level up! You are now a ${b.title}`, "level"), 0);
        return next;
      });
    },
    [toast],
  );

  const addXp = useCallback(
    (xp: number, why?: string) => {
      if (xp <= 0) return;
      update((p) => ({ ...p, xp: p.xp + xp }));
      toast(`+${xp} XP${why ? ` · ${why}` : ""}`, "xp");
    },
    [update, toast],
  );

  const value = useMemo<Ctx>(
    () => ({
      p,
      ready,
      toasts,
      answer: (correct, xp = 10) => {
        const gained = correct ? xp : 0;
        update((p) => ({ ...p, answered: p.answered + 1, correct: p.correct + (correct ? 1 : 0), xp: p.xp + gained }));
        if (gained) toast(`+${gained} XP`, "xp");
        return gained;
      },
      addXp,
      badge: (id) =>
        update((p) => {
          if (p.badges.includes(id) || !BADGES[id]) return p;
          setTimeout(() => toast(`Badge unlocked: ${BADGES[id].icon} ${BADGES[id].name}`, "badge"), 0);
          return { ...p, badges: [...p.badges, id] };
        }),
      setLesson: (id, score) => update((p) => ({ ...p, lessons: { ...p.lessons, [id]: Math.max(score, p.lessons[id] ?? 0) } })),
      setGame: (id, score) => update((p) => ({ ...p, games: { ...p.games, [id]: Math.max(score, p.games[id] ?? 0) } })),
      view: (t) => update((p) => (p.viewed.includes(t) ? p : { ...p, viewed: [...p.viewed, t] })),
      call: (key, correct) => update((p) => (key in p.calls ? p : { ...p, calls: { ...p.calls, [key]: correct } })),
      reset: () => setP(EMPTY),
    }),
    [p, ready, toasts, update, toast, addXp],
  );

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress() {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error("useProgress outside ProgressProvider");
  return c;
}
