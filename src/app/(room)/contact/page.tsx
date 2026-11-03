import { ArrowUpRight, Calendar, Mail } from "lucide-react";
import type { Metadata } from "next";
import { ChapterPanel, isUrl, Lede, List, Prose, Text } from "@/components/panels/ui";
import { Row } from "@/components/ui/Row";
import { getContactPage, getSite } from "@/lib/content/load";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  const { data, html } = getContactPage();
  const site = getSite();
  const hasEmail = !site.email.startsWith("TODO");
  const linkedin = site.socials.find((s) => s.icon === "linkedin");
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;

  return (
    <ChapterPanel eyebrow="Mailbox" title={data.title} testId="chapter-contact">
      <Lede>{data.intro}</Lede>
      <List label="Ways to reach me">
        <li>
          {hasEmail ? (
            <a className="row-link" href={`mailto:${site.email}`}>
              <Row lead={<Mail size={16} strokeWidth={2} aria-hidden />} title="Email" subtitle={site.email} />
            </a>
          ) : (
            <Row lead={<Mail size={16} strokeWidth={2} aria-hidden />} title="Email" subtitle={<Text>{site.email}</Text>} />
          )}
        </li>
        {linkedin ? (
          <li>
            {isUrl(linkedin.url) ? (
              <a className="row-link" href={linkedin.url} {...external}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the official mark */}
                <Row lead={<img src="/brands/linkedin.svg" alt="" width={16} height={16} />} title="LinkedIn" subtitle={linkedin.url.replace(/^https?:\/\/(www\.)?/, "")}>
                  <ArrowUpRight className="row-chevron" size={16} strokeWidth={2} aria-hidden />
                </Row>
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- the official mark
              <Row lead={<img src="/brands/linkedin.svg" alt="" width={16} height={16} />} title="LinkedIn" subtitle={<Text>{linkedin.url}</Text>} />
            )}
          </li>
        ) : null}
        <li>
          {isUrl(site.calUrl) ? (
            <a className="row-link" href={site.calUrl} {...external}>
              <Row lead={<Calendar size={16} strokeWidth={2} aria-hidden />} title="Book a call" subtitle={site.calUrl.replace(/^https?:\/\//, "")}>
                <ArrowUpRight className="row-chevron" size={16} strokeWidth={2} aria-hidden />
              </Row>
            </a>
          ) : (
            <Row lead={<Calendar size={16} strokeWidth={2} aria-hidden />} title="Book a call" subtitle={<Text>{site.calUrl}</Text>} />
          )}
        </li>
      </List>
      <Prose html={html} />
      <p className="sheet-meta">Based in {site.location}.</p>
    </ChapterPanel>
  );
}
