import type { Metadata } from "next";
import { ChapterPanel, Gallery, Lede, Metrics, Prose, Text } from "@/components/panels/ui";
import { getWindowPage } from "@/lib/content/load";

export const metadata: Metadata = { title: "Kozan" };

export default function WindowPage() {
  const { data, html } = getWindowPage();
  return (
    <ChapterPanel eyebrow={data.place} title={data.title} testId="chapter-window">
      <Lede>{data.intro}</Lede>
      <Metrics items={data.metrics} />
      {data.facts.length ? (
        <dl className="stat-list facts">
          {data.facts.map((fact) => (
            <div className="stat-row" key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                <Text>{fact.value}</Text>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Prose html={html} />
      <Gallery images={data.photos} empty="Childhood photos go here." />
    </ChapterPanel>
  );
}
