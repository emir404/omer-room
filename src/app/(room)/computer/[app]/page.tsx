import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getComputerApps } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return getComputerApps().map((app) => ({ app: app.slug }));
}

type Props = { params: Promise<{ app: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params;
  return { title: getComputerApps().find((a) => a.slug === app)?.data.title ?? "Work" };
}

/** The role opens in the desktop's Work app (ScreenLayer → OmerOS); this keeps the URL and a heading. */
export default async function ComputerAppPage({ params }: Props) {
  const { app } = await params;
  const entry = getComputerApps().find((a) => a.slug === app);
  if (!entry) notFound();
  return (
    <h1 tabIndex={-1} className="sr-only" data-testid="chapter-computer-app">
      {entry.data.title}
    </h1>
  );
}
