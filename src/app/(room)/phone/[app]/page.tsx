import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhoneUI } from "@/components/screens/Phone";
import { getPhoneApps, getSite } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPhoneApps().map((app) => ({ app: app.slug }));
}

type Props = { params: Promise<{ app: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params;
  return { title: getPhoneApps().find((a) => a.slug === app)?.data.title ?? "Phone" };
}

export default async function PhoneAppPage({ params }: Props) {
  const { app } = await params;
  const apps = getPhoneApps();
  const active = apps.find((a) => a.slug === app);
  if (!active) notFound();
  return <PhoneUI apps={apps} socials={getSite().socials} active={active} />;
}
