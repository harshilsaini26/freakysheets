import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllCompanies } from "@/lib/data";
import { toBank } from "@/lib/game/bank";
import { GAMES } from "@/components/games/registry";
import { GameHost } from "@/components/games/GameHost";

export const dynamicParams = false;
export const generateStaticParams = () => GAMES.map((g) => ({ game: g.id }));

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return { title: GAMES.find((g) => g.id === game)?.name ?? "Game" };
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!GAMES.some((g) => g.id === game)) notFound();
  const bank = getAllCompanies().map(toBank);
  return <GameHost id={game} bank={bank} />;
}
