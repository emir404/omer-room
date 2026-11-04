import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGlobePlaces } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return getGlobePlaces().map((p) => ({ place: p.slug }));
}

type Props = { params: Promise<{ place: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { place } = await params;
  return { title: getGlobePlaces().find((p) => p.slug === place)?.data.title ?? "Places" };
}

/** The globe turns the place to you; the caption tells it. */
export default async function PlacePage({ params }: Props) {
  const { place } = await params;
  if (!getGlobePlaces().some((p) => p.slug === place)) notFound();
  return null;
}
