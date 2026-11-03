import type { Metadata } from "next";
import { OmerOS } from "@/components/screens/OmerOS";
import { getComputerApps } from "@/lib/content/load";

export const metadata: Metadata = { title: "Work" };

export default function ComputerPage() {
  return <OmerOS apps={getComputerApps()} active={null} />;
}
