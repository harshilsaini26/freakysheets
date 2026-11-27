"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BankCompany } from "@/lib/game/bank";
import { DRILLS, drillQuestion, pick, rng, shuffle, type Question } from "@/lib/game/questions";
import { useProgress } from "@/lib/game/progress";
import { LESSONS, PASS_MARK, lessonById } from "@/lib/learn/lessons";
import { QuizCard, type QuizItem } from "./QuizCard";

function buildQuiz(lessonId: string, bank: BankCompany[]): QuizItem[] {
  const lesson = lessonById(lessonId)!;
  const r = rng();
  const items: QuizItem[] = lesson.questions.map((q) => ({ prompt: q.q, choices: q.choices, answer: q.answer, explain: q.explain }));
  // Drills: real companies first when the SEC data exists, training companies otherwise.
  const real = bank.filter((c) => !c.practice);
  const pool = real.length ? real : bank;
  const drills: Question[] = [];
  for (const id of lesson.drills) {
    const d = DRILLS.find((x) => x.id === id);
    if (!d) continue;
    for (let i = 0; i < 30; i++) {
      const q = drillQuestion(r, pick(r, pool), d) ?? drillQuestion(r, pick(r, bank), d);
      if (q) {
        drills.push(q);
        break;
      }
    }
  }
  return [...items, ...shuffle(r, drills)];
}

export function LessonRunner({ lessonId, bank }: { lessonId: string; bank: BankCompany[] }) {
  const lesson = lessonById(lessonId)!;
  const idx = LESSONS.findIndex((l) => l.id === lessonId);
  const nextLesson = LESSONS[idx + 1];
  const { p, answer, setLesson, addXp, badge } = useProgress();
  const [stage, setStage] = useState<"read" | "quiz" | "done">("read");
  const [card, setCard] = useState(0);
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [qi, setQi] = useState(0);
  const [right, setRight] = useState(0);

  useEffect(() => setQuiz(buildQuiz(lessonId, bank)), [lessonId, bank]);

  const finish = (finalRight: number) => {
    const score = quiz.length ? finalRight / quiz.length : 0;
    const firstPass = (p.lessons[lesson.id] ?? 0) < PASS_MARK && score >= PASS_MARK;
    setLesson(lesson.id, score);
    if (firstPass) {
      addXp(50, "lesson passed");
      if (lesson.badge && lesson.badge !== "graduate") badge(lesson.badge);
      const allPassed = LESSONS.every((l) => l.id === lesson.id || (p.lessons[l.id] ?? 0) >= PASS_MARK);
      if (allPassed) badge("graduate");
    }
    setStage("done");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/learn" className="text-sm text-muted hover:text-ink">← Learning path</Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl">{lesson.icon}</span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{lesson.title}</h1>
          <p className="text-sm text-muted">Lesson {idx + 1} of {LESSONS.length} · CFA topic: {lesson.reading}</p>
        </div>
      </div>

      {stage === "read" && (
        <div className="mt-6">
          <div className="mb-3 flex gap-1">
            {lesson.cards.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= card ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
          <div key={card} className="card pop p-6">
            <h2 className="text-xl font-bold">{lesson.cards[card].title}</h2>
            <p className="mt-3 leading-relaxed">{lesson.cards[card].body}</p>
            {lesson.cards[card].formula && (
              <div className="mt-4 rounded-xl bg-panel-2 px-4 py-3 font-mono text-sm">{lesson.cards[card].formula}</div>
            )}
          </div>
          <div className="mt-4 flex justify-between">
            <button className="btn btn-ghost" disabled={card === 0} onClick={() => setCard((c) => c - 1)}>← Back</button>
            {card < lesson.cards.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setCard((c) => c + 1)}>Next →</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setStage("quiz")} disabled={!quiz.length}>
                Take the quiz ({quiz.length} questions) →
              </button>
            )}
          </div>
        </div>
      )}

      {stage === "quiz" && quiz[qi] && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>Question {qi + 1} of {quiz.length}</span>
            <span>{right} correct</span>
          </div>
          <QuizCard
            key={qi}
            item={quiz[qi]}
            onDone={(ok) => {
              answer(ok, 10);
              if (ok) setRight((r) => r + 1);
            }}
            nextLabel={qi + 1 < quiz.length ? "Next question" : "See results"}
            onNext={() => (qi + 1 < quiz.length ? setQi(qi + 1) : finish(right))}
          />
        </div>
      )}

      {stage === "done" && (
        <div className="card pop mt-6 p-6 text-center">
          {(() => {
            const score = right / quiz.length;
            const pass = score >= PASS_MARK;
            return (
              <>
                <div className="text-5xl">{pass ? "🎉" : "📘"}</div>
                <h2 className="mt-2 text-2xl font-extrabold">{Math.round(score * 100)}%</h2>
                <p className="mt-1 text-muted">
                  {right} of {quiz.length} correct. {pass ? "Lesson passed." : `You need ${Math.round(PASS_MARK * 100)}% to unlock the next lesson.`}
                </p>
                {lesson.explore && (
                  <p className="mx-auto mt-4 max-w-md rounded-xl bg-panel-2 px-4 py-3 text-sm">
                    <b>Explore:</b> {lesson.explore.prompt}{" "}
                    <Link className="font-semibold text-accent" href={`/company/${lesson.explore.ticker}?tab=${lesson.explore.tab}`}>Open →</Link>
                  </p>
                )}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setQuiz(buildQuiz(lessonId, bank));
                      setQi(0);
                      setRight(0);
                      setStage("quiz");
                    }}
                  >
                    Retry with new numbers
                  </button>
                  {pass && nextLesson && <Link className="btn btn-primary" href={`/learn/${nextLesson.id}`}>Next lesson: {nextLesson.title} →</Link>}
                  {pass && !nextLesson && <Link className="btn btn-primary" href="/play">Path complete. Go play →</Link>}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
