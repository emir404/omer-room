import type { Metadata } from "next";
import { ChapterPanel, Gallery, Lede, Metrics, Prose, Text } from "@/components/panels/ui";
import { getWindowPage } from "@/lib/content/load";

export const metadata: Metadata = { title: "Kozan" };

export default function WindowPage() {
  const { data, html } = getWindowPage();
  return (
    <ChapterPanel eyebrow={data.place} title={data.title} testId="chapter-window">
      <Lede>{data.intro}</Lede>
      {data.facts.length ? (
        <dl className="facts">
          {data.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                <Text>{fact.value}</Text>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Prose html={html} />
      <Metrics items={data.metrics} />
      <Gallery images={data.photos} empty="Childhood photos coming soon" />
    </ChapterPanel>
  );
}
