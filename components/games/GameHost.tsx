"use client";
import Link from "next/link";
import type { BankCompany } from "@/lib/game/bank";
import { GAMES } from "./registry";
import { RatioRush } from "./RatioRush";
import { MysteryLedger } from "./MysteryLedger";
import { RedFlagHunt } from "./RedFlagHunt";
import { HigherLower } from "./HigherLower";

export function GameHost({ id, bank }: { id: string; bank: BankCompany[] }) {
  const g = GAMES.find((x) => x.id === id)!;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/play" className="text-sm text-muted hover:text-ink">← Arcade</Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl">{g.icon}</span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{g.name}</h1>
          <p className="text-sm text-muted">{g.pitch}</p>
        </div>
      </div>
      <div className="mt-6">
        {id === "ratio-rush" && <RatioRush bank={bank} />}
        {id === "mystery-ledger" && <MysteryLedger bank={bank} />}
        {id === "red-flag-hunt" && <RedFlagHunt bank={bank} />}
        {id === "higher-lower" && <HigherLower bank={bank} />}
      </div>
    </div>
  );
}
