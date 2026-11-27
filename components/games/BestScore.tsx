"use client";
import { useProgress } from "@/lib/game/progress";

export function BestScore({ id }: { id: string }) {
  const { p, ready } = useProgress();
  const best = p.games[id];
  if (!ready || best === undefined) return null;
  return <span className="chip bg-gold-soft text-gold">Best {best}</span>;
}
