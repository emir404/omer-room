import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPhoneApps } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPhoneApps().map((app) => ({ app: app.slug }));
}

type Props = { params: Promise<{ app: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params;
  return { title: getPhoneApps().find((a) => a.slug === app)?.data.title ?? "Phone" };
}

/** The app opens on the phone itself (ScreenLayer → PhoneUI); this keeps the URL and a heading. */
export default async function PhoneAppPage({ params }: Props) {
  const { app } = await params;
  const active = getPhoneApps().find((a) => a.slug === app);
  if (!active) notFound();
  return (
    <h1 tabIndex={-1} className="sr-only">
      {active.data.title}
    </h1>
  );
}
