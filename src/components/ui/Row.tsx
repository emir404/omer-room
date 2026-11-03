import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import "@/components/kit/parts/Row.css";

/**
 * One row of a list (the stageshow kit's Row anatomy, server-safe): a lead, a title over its
 * subtitle, a meta value on the first line, and anything trailing (a chevron) at the end.
 * Lists are built from it everywhere: panels, the text view, the desktop and phone UIs.
 */
export interface RowProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  lead?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  selected?: boolean;
  /** Inset of the row's fill in px: 12 by default, 8 for a dense list. */
  pad?: number;
}

export function Row({ lead, title, subtitle, meta, selected, pad = 12, className, style, children, ...rest }: RowProps) {
  return (
    <div
      {...rest}
      className={`ss-row${className ? ` ${className}` : ""}`}
      data-selected={selected || undefined}
      data-lead={lead ? "" : undefined}
      style={{ "--ss-row-pad": `${pad}px`, ...style } as CSSProperties}
    >
      {lead ? <span className="ss-row__lead">{lead}</span> : null}
      <span className="ss-row__body">
        <span className="ss-row__head">
          <span className="ss-row__title">{title}</span>
          {meta ? <span className="ss-row__meta">{meta}</span> : null}
        </span>
        {subtitle ? <span className="ss-row__subtitle">{subtitle}</span> : null}
      </span>
      {children}
    </div>
  );
}
