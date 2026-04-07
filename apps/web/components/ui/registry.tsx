import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type RegistryPageProps = HTMLAttributes<HTMLElement>;

export function RegistryPage({ children, className, ...props }: RegistryPageProps) {
  return (
    <section className={cx("ui-registry-page", className)} {...props}>
      {children}
    </section>
  );
}

type RegistryHeroProps = {
  actions?: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  eyebrow?: ReactNode;
  metrics?: ReactNode;
  title: ReactNode;
};

export function RegistryHero({
  actions,
  compact = false,
  description,
  eyebrow,
  metrics,
  title
}: RegistryHeroProps) {
  return (
    <header className={cx("ui-registry-hero", compact && "ui-registry-hero--compact")}>
      <div className="ui-registry-hero__main">
        <div className="ui-registry-hero__copy">
          {eyebrow ? <p className="ui-registry-hero__eyebrow">{eyebrow}</p> : null}
          <h1 className="ui-registry-hero__title">{title}</h1>
          {description ? <div className="ui-registry-hero__description">{description}</div> : null}
        </div>
        {actions ? <div className="ui-registry-hero__actions">{actions}</div> : null}
      </div>
      {metrics ? <div className="ui-registry-metric-strip">{metrics}</div> : null}
    </header>
  );
}

type RegistryMetricProps = {
  label: ReactNode;
  meta: ReactNode;
  tone?: "default" | "accent" | "highlight";
  value: ReactNode;
};

export function RegistryMetric({
  label,
  meta,
  tone = "default",
  value
}: RegistryMetricProps) {
  return (
    <article className={cx("ui-registry-metric", `ui-registry-metric--${tone}`)}>
      <p className="ui-registry-metric__label">{label}</p>
      <p className="ui-registry-metric__value">{value}</p>
      <p className="ui-registry-metric__meta">{meta}</p>
    </article>
  );
}

type RegistryToolbarProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function RegistryToolbar({
  actions,
  children,
  className,
  description,
  eyebrow,
  title,
  ...props
}: RegistryToolbarProps) {
  const showHeader = Boolean(actions || eyebrow || title || description);

  return (
    <section className={cx("ui-registry-toolbar", className)} {...props}>
      {showHeader ? (
        <div className="ui-registry-toolbar__header">
          <div className="ui-registry-toolbar__copy">
            {eyebrow ? <p className="ui-registry-results__eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="ui-registry-toolbar__title">{title}</h2> : null}
            {description ? <p className="ui-registry-toolbar__description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-registry-toolbar__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type RegistryResultsProps = HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function RegistryResults({
  children,
  className,
  description,
  eyebrow,
  title,
  ...props
}: RegistryResultsProps) {
  return (
    <section className={cx("ui-registry-results", className)} {...props}>
      <div className="ui-registry-results__header">
        <div className="ui-registry-results__copy">
          {eyebrow ? <p className="ui-registry-results__eyebrow">{eyebrow}</p> : null}
          <h2 className="ui-registry-results__title">{title}</h2>
          {description ? <p className="ui-registry-results__description">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
