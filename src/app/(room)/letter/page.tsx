import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { ChapterPanel, Lede, Metrics, Prose, Section, Text } from "@/components/panels/ui";
import { getLetterPage } from "@/lib/content/load";

export const metadata: Metadata = { title: "The OpenAI letter" };

/**
 * The letter is shown exactly as the image is: the original file, at its own proportions, never
 * resized or recompressed by the site (no next/image). "Open full size" serves the file itself.
 */
export default function LetterPage() {
  const page = getLetterPage();
  const { data, html, letterSize } = page;
  return (
    <ChapterPanel eyebrow="You might know me from this" title={data.title} testId="chapter-letter">
      <Lede>{data.intro}</Lede>
      {data.letter && letterSize ? (
        <figure className="letter-figure">
          <a href={data.letter.src} target="_blank" rel="noopener noreferrer" className="letter-image">
            {/* eslint-disable-next-line @next/next/no-img-element -- 1:1 with the original file */}
            <img src={data.letter.src} alt={data.letter.alt} width={letterSize.width} height={letterSize.height} />
          </a>
          <figcaption>
            {data.letter.caption ? <Text>{data.letter.caption}</Text> : null}
            <a href={data.letter.src} target="_blank" rel="noopener noreferrer" className="pill">
              Open full size
              <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
            </a>
          </figcaption>
        </figure>
      ) : (
        <p className="gallery-empty">The letter goes here, exactly as it is: add the image in content/letter.md.</p>
      )}
      <Metrics items={data.metrics} />
      <Prose html={html} />
      {data.reactions.length ? (
        <Section title="How the internet took it" id="reactions">
          <ul className="reactions">
            {data.reactions.map((r) => (
              <li key={r.caption}>
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- screenshots, shown as they are
                  <img src={r.image.src} alt={r.image.alt} loading="lazy" />
                ) : null}
                <p>
                  {r.url && /^https?:/.test(r.url) ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.caption}
                    </a>
                  ) : (
                    <Text>{r.caption}</Text>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </ChapterPanel>
  );
}
