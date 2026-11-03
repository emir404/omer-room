import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OmerOS } from "@/components/screens/OmerOS";
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

export default async function ComputerAppPage({ params }: Props) {
  const { app } = await params;
  const apps = getComputerApps();
  const active = apps.find((a) => a.slug === app);
  if (!active) notFound();
  return <OmerOS apps={apps} active={active} />;
}
