import Link from "next/link";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  buttonClassName,
  cx,
  type BadgeTone,
  type ButtonTone
} from "../../../components/ui";

export type OperationalFocusBadge = {
  label: string;
  tone: BadgeTone;
};

export type OperationalFocusItem = {
  detail?: string;
  label: string;
  tone?: BadgeTone;
  value: string;
};

export type OperationalFocusAction = {
  href: string;
  label: string;
  tone?: ButtonTone;
};

type OperationalFocusPanelProps = {
  actions?: OperationalFocusAction[];
  badges?: OperationalFocusBadge[];
  blockers?: OperationalFocusItem[];
  className?: string;
  compact?: boolean;
  description: string;
  eyebrow: string;
  followThrough?: OperationalFocusItem[];
  nextMove: {
    actionHref?: string;
    actionLabel?: string;
    detail: string;
    label: string;
    tone?: ButtonTone;
  };
  title: string;
};

function OperationalFocusColumn({
  emptyCopy,
  items,
  title
}: {
  emptyCopy: string;
  items: OperationalFocusItem[];
  title: string;
}) {
  return (
    <div className="ui-detail-item">
      <p className="ui-detail-label">{title}</p>
      {items.length ? (
        <div className="ui-action-grid">
          {items.map((item) => (
            <div key={`${title}-${item.label}-${item.value}`}>
              <div className="ui-inline-meta">
                <p className="ui-detail-value">{item.label}</p>
                {item.tone ? <Badge tone={item.tone}>{item.value}</Badge> : null}
              </div>
              {!item.tone ? <p className="ui-detail-value">{item.value}</p> : null}
              {item.detail ? <p className="ui-card__description">{item.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="ui-card__description">{emptyCopy}</p>
      )}
    </div>
  );
}

export function OperationalFocusPanel({
  actions = [],
  badges = [],
  blockers = [],
  className,
  compact = false,
  description,
  eyebrow,
  followThrough = [],
  nextMove,
  title
}: OperationalFocusPanelProps) {
  return (
    <Card
      className={cx("operational-focus-panel", compact && "operational-focus-panel--compact", className)}
      padding={compact ? "compact" : "spacious"}
      tone="raised"
    >
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>{eyebrow}</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeaderContent>
        {badges.length ? (
          <div className="ui-inline-meta">
            {badges.map((badge) => (
              <Badge key={`${badge.label}-${badge.tone}`} tone={badge.tone}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="ui-action-grid">
        <div className="ui-detail-item">
          <p className="ui-detail-label">Next move</p>
          <p className="ui-detail-value">{nextMove.label}</p>
          <p className="ui-card__description">{nextMove.detail}</p>
          {nextMove.actionHref && nextMove.actionLabel ? (
            <div className="ui-table-actions">
              <Link className={buttonClassName({ size: "sm", tone: nextMove.tone })} href={nextMove.actionHref}>
                {nextMove.actionLabel}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="ui-detail-grid">
          <OperationalFocusColumn
            emptyCopy="No active blockers are outranking the selected next move."
            items={blockers}
            title="Blockers"
          />
          <OperationalFocusColumn
            emptyCopy="No extra follow-through threads need explicit ownership right now."
            items={followThrough}
            title="Follow-through"
          />
        </div>

        {actions.length ? (
          <div className="ui-table-actions">
            {actions.map((action) => (
              <Link
                className={buttonClassName({ size: "sm", tone: action.tone ?? "secondary" })}
                href={action.href}
                key={`${action.label}-${action.href}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
