import type { Metadata } from "next";

export const metadata: Metadata = { title: "Work" };

/** The work lives on the monitor (the live desktop, ScreenLayer → OmerOS); this keeps the URL and a heading. */
export default function ComputerPage() {
  return (
    <h1 tabIndex={-1} className="sr-only" data-testid="chapter-computer">
      Computer: what I do for work
    </h1>
  );
}
