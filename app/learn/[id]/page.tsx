import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllCompanies } from "@/lib/data";
import { toBank } from "@/lib/game/bank";
import { LESSONS, lessonById } from "@/lib/learn/lessons";
import { LessonRunner } from "@/components/LessonRunner";

export const dynamicParams = false;
export const generateStaticParams = () => LESSONS.map((l) => ({ id: l.id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: lessonById(id)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = lessonById(id);
  if (!lesson) notFound();
  const bank = getAllCompanies().map(toBank);
  return <LessonRunner lessonId={lesson.id} bank={bank} />;
}
