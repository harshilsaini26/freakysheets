import type { Metadata } from "next";
import { getGeneratedAt, getIndex } from "@/lib/data";
import { CompanyBrowser } from "@/components/CompanyBrowser";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  const index = getIndex();
  const sec = index.filter((r) => !r.practice);
  const practice = index.filter((r) => r.practice);
  const at = getGeneratedAt();
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Companies</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Five fiscal years of 10-K statements for the 50 largest S&amp;P 500 companies, pulled from SEC EDGAR, plus five fictional
        training companies built to teach specific patterns.
        {at && <> Data refreshed {at.slice(0, 10)}.</>}
      </p>
      <CompanyBrowser sec={sec} practice={practice} />
    </div>
  );
}
