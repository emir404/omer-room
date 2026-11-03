import { getSite } from "@/lib/content/load";

/** The overview: just the room. (Its heading is for screen readers; the switch is the only UI.) */
export default function RoomOverview() {
  const site = getSite();
  return (
    <h1 tabIndex={-1} className="sr-only" data-testid="intro">
      {site.name}: {site.tagline}
    </h1>
  );
}
