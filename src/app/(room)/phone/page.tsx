import type { Metadata } from "next";
import { PhoneUI } from "@/components/screens/Phone";
import { getPhoneApps, getSite } from "@/lib/content/load";

export const metadata: Metadata = { title: "Socials & side quests" };

export default function PhonePage() {
  return <PhoneUI apps={getPhoneApps()} socials={getSite().socials} active={null} />;
}
