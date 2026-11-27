"use client";
import { BADGES, LEVELS, levelFor, streakOf, useProgress } from "@/lib/game/progress";
import { LESSONS, PASS_MARK } from "@/lib/learn/lessons";
import { GAMES } from "./games/registry";

export function ProgressView() {
  const { p, ready, reset } = useProgress();
  if (!ready) return null;
  const lv = levelFor(p.xp);
  const acc = p.answered ? Math.round((100 * p.correct) / p.answered) : 0;
  const passed = LESSONS.filter((l) => (p.lessons[l.id] ?? 0) >= PASS_MARK).length;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Your progress</h1>
        <p className="mt-1 text-sm text-muted">Saved in this browser only. Clearing site data resets it.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Level", `${lv.index} · ${lv.title}`],
          ["XP", String(p.xp)],
          ["Accuracy", `${acc}% of ${p.answered}`],
          ["Streak", `🔥 ${streakOf(p.days)} days`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</div>
            <div className="num mt-1 text-xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="font-bold">Career ladder</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {LEVELS.map((l, i) => (
            <div key={l.title} className={`rounded-lg px-3 py-2 text-sm ${p.xp >= l.xp ? "bg-accent-soft" : "bg-panel-2 text-muted"}`}>
              <div className="font-semibold">{i + 1}. {l.title}</div>
              <div className="text-xs">{l.xp} XP</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-bold">Badges ({p.badges.length}/{Object.keys(BADGES).length})</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(BADGES).map(([id, b]) => {
            const has = p.badges.includes(id);
            return (
              <div key={id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${has ? "bg-gold-soft" : "bg-panel-2 opacity-60"}`}>
                <span className={`text-2xl ${has ? "" : "grayscale"}`}>{b.icon}</span>
                <div>
                  <div className="text-sm font-semibold">{b.name}</div>
                  <div className="text-xs text-muted">{b.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-bold">Lessons ({passed}/{LESSONS.length} passed)</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {LESSONS.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>{l.icon} {l.title}</span>
                <span className="num text-muted">{p.lessons[l.id] !== undefined ? `${Math.round(p.lessons[l.id] * 100)}%` : "–"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="font-bold">Personal bests</h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {GAMES.map((g) => (
              <li key={g.id} className="flex justify-between">
                <span>{g.icon} {g.name}</span>
                <span className="num text-muted">{p.games[g.id] ?? "–"}</span>
              </li>
            ))}
            <li className="flex justify-between"><span>🧭 Reports opened</span><span className="num text-muted">{p.viewed.length}</span></li>
            <li className="flex justify-between"><span>🔮 Right calls</span><span className="num text-muted">{Object.values(p.calls).filter(Boolean).length}</span></li>
          </ul>
        </div>
      </div>
      <div>
        <button
          className="text-sm text-muted underline"
          onClick={() => {
            if (confirm("Reset all XP, badges and lesson scores in this browser?")) reset();
          }}
        >
          Reset my progress
        </button>
      </div>
    </div>
  );
}
