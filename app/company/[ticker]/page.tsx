import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllCompanies, getCatalog, getCompany, getPeers } from "@/lib/data";
import { peerViewFor } from "@/lib/peers";
import { CompanyReport } from "@/components/report/CompanyReport";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllCompanies().map((c) => ({ ticker: c.ticker }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const rec = getCompany(ticker);
  return { title: rec ? `${rec.name} (${rec.ticker})` : ticker };
}

export default async function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const rec = getCompany(ticker);
  if (!rec) notFound();
  const catalog = getCatalog();
  const better = Object.fromEntries(catalog.map((c) => [c.id, c.better]));
  const cats = Object.fromEntries(catalog.map((c) => [c.id, c.category]));
  const peer = peerViewFor(rec, getPeers(), better, cats);
  return <CompanyReport rec={rec} catalog={catalog} peer={peer} />;
}
