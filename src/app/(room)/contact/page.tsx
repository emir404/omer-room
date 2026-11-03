import type { Metadata } from "next";
import { ChapterPanel, Lede, Prose, Text } from "@/components/panels/ui";
import { getContactPage, getSite } from "@/lib/content/load";

export const metadata: Metadata = { title: "Contact" };

const isTodo = (value: string) => value.startsWith("TODO");

export default function ContactPage() {
  const { data, html } = getContactPage();
  const site = getSite();
  const linkedin = site.socials.find((s) => s.icon === "linkedin");
  const methods = [
    { label: "Email", value: site.email, href: `mailto:${site.email}` },
    ...(linkedin ? [{ label: "LinkedIn", value: linkedin.url, href: linkedin.url }] : []),
    { label: "Book a call", value: site.calUrl, href: site.calUrl },
  ];

  return (
    <ChapterPanel eyebrow="Mailbox" title={data.title} testId="chapter-contact">
      <Lede>{data.intro}</Lede>
      <Prose html={html} />
      <ul className="contact-methods">
        {methods.map((m) => (
          <li key={m.label}>
            <span className="contact-label">{m.label}</span>
            {isTodo(m.value) ? (
              <Text>{m.value}</Text>
            ) : (
              <a href={m.href} {...(m.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {m.value.replace(/^https?:\/\//, "")}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="contact-meta">Based in {site.location}.</p>
    </ChapterPanel>
  );
}
