import type { Metadata } from "next";
import { LearnPath } from "@/components/LearnPath";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">The learning path</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Eleven lessons that follow the CFA Level I Financial Statement Analysis topics. Each one has a short read, a concept quiz and
        drills that use real company numbers. Score 60% to unlock the next lesson.
      </p>
      <LearnPath />
    </div>
  );
}
