import type { Metadata } from "next";

export const metadata: Metadata = { title: "Socials & side quests" };

/** The phone's UI lives on the phone itself (ScreenLayer → PhoneUI); this keeps the URL and a heading. */
export default function PhonePage() {
  return (
    <h1 tabIndex={-1} className="sr-only">
      Phone: socials and side quests
    </h1>
  );
}
