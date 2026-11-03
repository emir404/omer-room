import type { Metadata } from "next";
import Image from "next/image";
import { ChapterPanel, Lede, Metrics, Prose, Text } from "@/components/panels/ui";
import { getLetterPage } from "@/lib/content/load";

export const metadata: Metadata = { title: "The OpenAI letter" };

export default function LetterPage() {
  const { data, html } = getLetterPage();
  return (
    <ChapterPanel eyebrow="You might know me from this" title={data.title} testId="chapter-letter">
      <Lede>{data.intro}</Lede>
      <Metrics items={data.metrics} />
      {data.letter ? (
        <figure className="letter-figure">
          <div className="letter-frame">
            <Image src={data.letter.src} alt={data.letter.alt} fill sizes="(max-width: 768px) 90vw, 420px" />
          </div>
          {data.letter.caption ? <figcaption>{data.letter.caption}</figcaption> : null}
        </figure>
      ) : (
        <div className="gallery-empty">
          <span aria-hidden="true">✉</span> The letter goes here
        </div>
      )}
      <Prose html={html} />
      {data.reactions.length ? (
        <section className="section" aria-labelledby="reactions">
          <h2 id="reactions">How the internet took it</h2>
          <ul className="reactions">
            {data.reactions.map((r) => (
              <li key={r.caption}>
                {r.image ? (
                  <div className="gallery-frame">
                    <Image src={r.image.src} alt={r.image.alt} fill sizes="(max-width: 768px) 90vw, 420px" />
                  </div>
                ) : null}
                <p>
                  {r.url && /^https?:/.test(r.url) ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.caption} ↗
                    </a>
                  ) : (
                    <Text>{r.caption}</Text>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ChapterPanel>
  );
}
