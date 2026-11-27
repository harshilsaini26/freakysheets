import Link from "next/link";
import { getAllCompanies, hasSecData } from "@/lib/data";
import { toBank } from "@/lib/game/bank";
import { APP_NAME, TAGLINE } from "@/lib/brand";
import { HomeDashboard } from "@/components/HomeDashboard";

export default function Home() {
  const bank = getAllCompanies().map(toBank);
  const sec = hasSecData();
  return (
    <div className="grid gap-10">
      <section className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <span className="chip bg-accent-soft text-accent">CFA Level I · Financial Statement Analysis</span>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{APP_NAME}</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">{TAGLINE}</p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Income statements, balance sheets and cash flows for the 50 largest S&amp;P 500 companies over the last five fiscal years,
            70+ ratios, DuPont, Altman, Beneish and Piotroski, and an upload tool for any statement you have.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/learn" className="btn btn-primary">Start the learning path</Link>
            <Link href="/play" className="btn btn-ghost">Play a game</Link>
            <Link href="/upload" className="btn btn-ghost">Analyze my file</Link>
          </div>
          {!sec && (
            <p className="mt-4 max-w-xl rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold">
              The S&amp;P 500 dataset has not been built on this deployment yet, so the app is using the five fictional training
              companies. See the README to run the SEC refresh.
            </p>
          )}
        </div>
        <HomeDashboard bank={bank} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { href: "/learn", icon: "📚", title: "Learn", body: "11 short lessons from the income statement to forecasting, each with a quiz and real-number drills." },
          { href: "/play", icon: "🎮", title: "Play", body: "Ratio Rush, Mystery Ledger, Red Flag Hunt and Higher or Lower. Earn XP, streaks and badges." },
          { href: "/companies", icon: "🏢", title: "Explore", body: "Full five-year reports with common-size statements, peer percentiles and quality scores." },
          { href: "/upload", icon: "📤", title: "Analyze a file", body: "Drop in a CSV or Excel statement. It is analyzed in your browser and never uploaded." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-2 font-bold">{c.title}</div>
            <p className="mt-1 text-sm text-muted">{c.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
