import Link from "next/link";

import { cx } from "../../../components/ui";

type FieldStatusStripItem = {
  href?: string | undefined;
  key: string;
  label: string;
  tone?: "brand" | "danger" | "neutral" | "success" | "warning";
  value: number | string;
};

type FieldStatusStripProps = {
  items: FieldStatusStripItem[];
};

export function FieldStatusStrip({ items }: FieldStatusStripProps) {
  return (
    <div className="field-status-strip" aria-label="Field command status summary">
      {items.map((item) => {
        const content = (
          <>
            <span className="field-status-strip__label">{item.label}</span>
            <strong className="field-status-strip__value">{item.value}</strong>
          </>
        );

        if (item.href) {
          return (
            <Link
              className={cx(
                "field-status-strip__item",
                item.tone && `field-status-strip__item--${item.tone}`
              )}
              href={item.href}
              key={item.key}
            >
              {content}
            </Link>
          );
        }

        return (
          <div
            className={cx(
              "field-status-strip__item",
              item.tone && `field-status-strip__item--${item.tone}`
            )}
            key={item.key}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}