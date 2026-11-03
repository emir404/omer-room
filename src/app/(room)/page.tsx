import { Text } from "@/components/panels/ui";
import { getSite } from "@/lib/content/load";

export default function RoomOverview() {
  const site = getSite();
  return (
    <div className="intro" data-testid="intro">
      <h1 tabIndex={-1}>{site.name}</h1>
      <p className="intro-tagline">
        <Text>{site.tagline}</Text>
      </p>
      <p className="intro-hint">
        <span className="when-room">Look around. Everything in the room opens a chapter.</span>
        <span className="when-doc">Pick a chapter.</span>
      </p>
    </div>
  );
}
