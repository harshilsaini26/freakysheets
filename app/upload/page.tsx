import type { Metadata } from "next";
import { getCatalog, getIndex, getPeers } from "@/lib/data";
import { UploadLab } from "@/components/UploadLab";
import type { PeersFile } from "@/lib/engine/types";

export const metadata: Metadata = { title: "Analyze a file" };

export default function UploadPage() {
  const peers = getPeers();
  // Only the group benchmarks are needed in the browser, not every company's rows.
  const bench: PeersFile | null = peers
    ? { groups: peers.groups, universe: peers.universe, companies: {}, category_labels: peers.category_labels }
    : null;
  const sectors = [...new Set([...getIndex().map((r) => r.sector), "Utilities", "Real Estate", "Materials", "Energy", "Industrials"])].sort();
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Analyze any financial statement</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Upload a CSV or Excel file with one column per fiscal year: the app&apos;s template, or statements copied from a 10-K or annual
        report. Everything runs in your browser; the file is never sent anywhere.
      </p>
      <UploadLab catalog={getCatalog()} peers={bench} sectors={sectors} />
    </div>
  );
}
