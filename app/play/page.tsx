import type { Metadata } from "next";
import Link from "next/link";
import { GAMES } from "@/components/games/registry";
import { BestScore } from "@/components/games/BestScore";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Arcade</h1>
      <p className="mt-1 max-w-2xl text-muted">Short games that drill the skills analysts use every day. Every game uses real 10-K numbers (or the training companies until the SEC data is built).</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {GAMES.map((g) => (
          <Link key={g.id} href={`/play/${g.id}`} className="card flex gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-4xl">{g.icon}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">{g.name}</div>
                <BestScore id={g.id} />
              </div>
              <p className="mt-1 text-sm text-muted">{g.pitch}</p>
              <p className="mt-2 text-xs text-muted">Skill: {g.skill}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
