import type { Metadata } from "next";
import { ModeToggle } from "@/components/ModeToggle";
import { TextView } from "@/components/text/TextView";

export const metadata: Metadata = { title: "Text version", description: "Everything in the room, on one page." };

/** The whole site as one page, with no 3D at all. */
export default function TextPage() {
  return (
    <>
      <ModeToggle current="text" />
      <TextView />
    </>
  );
}
