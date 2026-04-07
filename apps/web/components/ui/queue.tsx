import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type QueuePageProps = HTMLAttributes<HTMLElement>;

export function QueuePage({ children, className, ...props }: QueuePageProps) {
  return (
    <section className={cx("ui-queue-page", className)} {...props}>
      {children}
    </section>
  );
}

type QueueHeroProps = {
  actions?: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  eyebrow?: ReactNode;
  metrics?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
};

export function QueueHero({
  actions,
  compact = false,
  description,
  eyebrow,
  metrics,
  status,
  title
}: QueueHeroProps) {
  return (
    <header className={cx("ui-queue-hero", compact && "ui-queue-hero--compact")}>
      <div className="ui-queue-hero__main">
        <div className="ui-queue-hero__copy">
          {eyebrow ? <p className="ui-queue-hero__eyebrow">{eyebrow}</p> : null}
          <div className="ui-queue-hero__title-row">
            <h1 className="ui-queue-hero__title">{title}</h1>
            {status}
          </div>
          {description ? <div className="ui-queue-hero__description">{description}</div> : null}
        </div>
        {actions ? <div className="ui-queue-hero__actions">{actions}</div> : null}
      </div>
      {metrics ? <div className="ui-queue-metric-strip">{metrics}</div> : null}
    </header>
  );
}

type QueueMetricProps = {
  label: ReactNode;
  meta: ReactNode;
  tone?: "default" | "accent" | "warning" | "success";
  value: ReactNode;
};

export function QueueMetric({
  label,
  meta,
  tone = "default",
  value
}: QueueMetricProps) {
  return (
    <article className={cx("ui-queue-metric", `ui-queue-metric--${tone}`)}>
      <p className="ui-queue-metric__label">{label}</p>
      <p className="ui-queue-metric__value">{value}</p>
      <p className="ui-queue-metric__meta">{meta}</p>
    </article>
  );
}

type QueueToolbarProps = HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  title: ReactNode;
};

export function QueueToolbar({
  children,
  className,
  description,
  title,
  ...props
}: QueueToolbarProps) {
  return (
    <section className={cx("ui-queue-toolbar", className)} {...props}>
      <div className="ui-queue-toolbar__header">
        <div className="ui-queue-toolbar__copy">
          <h2 className="ui-queue-toolbar__title">{title}</h2>
          {description ? <p className="ui-queue-toolbar__description">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

type QueueResultsProps = HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
};

export function QueueResults({
  children,
  className,
  description,
  eyebrow,
  meta,
  title,
  ...props
}: QueueResultsProps) {
  return (
    <section className={cx("ui-queue-results", className)} {...props}>
      <div className="ui-queue-results__header">
        <div className="ui-queue-results__copy">
          {eyebrow ? <p className="ui-queue-results__eyebrow">{eyebrow}</p> : null}
          <h2 className="ui-queue-results__title">{title}</h2>
          {description ? <p className="ui-queue-results__description">{description}</p> : null}
        </div>
        {meta ? <div className="ui-queue-results__meta">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}
