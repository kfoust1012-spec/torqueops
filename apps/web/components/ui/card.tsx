import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export type CardTone = "default" | "raised" | "subtle";
export type CardPadding = "compact" | "base" | "spacious";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: CardPadding | undefined;
  tone?: CardTone | undefined;
};

export function Card({
  children,
  className,
  padding = "base",
  tone = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        "ui-card",
        tone === "raised" && "ui-card--raised",
        tone === "subtle" && "ui-card--subtle",
        padding === "compact" && "ui-card--compact",
        padding === "spacious" && "ui-card--spacious",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cx("ui-card__header", className)} {...props}>
      {children}
    </div>
  );
}

type CardHeaderContentProps = HTMLAttributes<HTMLDivElement>;

export function CardHeaderContent({ children, className, ...props }: CardHeaderContentProps) {
  return (
    <div className={cx("ui-card__header-content", className)} {...props}>
      {children}
    </div>
  );
}

type CardEyebrowProps = HTMLAttributes<HTMLParagraphElement>;

export function CardEyebrow({ children, className, ...props }: CardEyebrowProps) {
  return (
    <p className={cx("ui-card__eyebrow", className)} {...props}>
      {children}
    </p>
  );
}

type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function CardTitle({ children, className, ...props }: CardTitleProps) {
  return (
    <h2 className={cx("ui-card__title", className)} {...props}>
      {children}
    </h2>
  );
}

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function CardDescription({ children, className, ...props }: CardDescriptionProps) {
  return (
    <p className={cx("ui-card__description", className)} {...props}>
      {children}
    </p>
  );
}

type CardContentProps = HTMLAttributes<HTMLDivElement>;

export function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div className={cx("ui-card__content", className)} {...props}>
      {children}
    </div>
  );
}

type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <div className={cx("ui-card__footer", className)} {...props}>
      {children}
    </div>
  );
}

type MetricGridProps = {
  children: ReactNode;
  className?: string | undefined;
};

export function MetricGrid({ children, className }: MetricGridProps) {
  return <div className={cx("ui-page-grid", className)}>{children}</div>;
}
