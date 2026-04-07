"use client";

import { useState } from "react";
import Link from "next/link";

import { buttonClassName, cx } from "../../../components/ui";

type FieldRecommendationStripItem = {
  actionLabel?: string;
  badge?: string;
  copy: string;
  href: string;
  inlineActionLabel?: string;
  inlineActionTone?: "ghost" | "secondary" | "tertiary";
  key: string;
  onInlineAction?: () => void | Promise<void>;
  title: string;
  tone?: "brand" | "danger" | "neutral" | "success" | "warning";
};

type FieldRecommendationStripProps = {
  items: FieldRecommendationStripItem[];
};

export function FieldRecommendationStrip({ items }: FieldRecommendationStripProps) {
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  async function handleInlineAction(item: FieldRecommendationStripItem) {
    if (!item.onInlineAction || pendingActionKey) {
      return;
    }

    setPendingActionKey(item.key);

    try {
      await item.onInlineAction();
    } finally {
      setPendingActionKey((current) => (current === item.key ? null : current));
    }
  }

  return (
    <div className="field-recommendation-strip" aria-label="Recommended next moves">
      {items.map((item) => (
        <article
          className={cx(
            "field-recommendation-strip__item",
            item.tone && `field-recommendation-strip__item--${item.tone}`
          )}
          aria-busy={pendingActionKey === item.key}
          key={item.key}
        >
          <Link className="field-recommendation-strip__content" href={item.href}>
            {item.badge ? <span className="field-recommendation-strip__badge">{item.badge}</span> : null}
            <strong className="field-recommendation-strip__title">{item.title}</strong>
            <p className="field-recommendation-strip__copy">{item.copy}</p>
          </Link>
          <div className="field-recommendation-strip__action">
            <span className="field-recommendation-strip__action-label">Next move</span>
            <div className="field-recommendation-strip__action-buttons">
              <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={item.href}>
                {item.actionLabel ?? item.title}
              </Link>
              {item.inlineActionLabel && item.onInlineAction ? (
                <button
                  className={buttonClassName({ size: "sm", tone: item.inlineActionTone ?? "ghost" })}
                  disabled={pendingActionKey !== null}
                  onClick={() => {
                    void handleInlineAction(item);
                  }}
                  type="button"
                >
                  {pendingActionKey === item.key ? "Working..." : item.inlineActionLabel}
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}