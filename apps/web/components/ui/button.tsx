import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export type ButtonTone = "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonClassNameOptions = {
  className?: string | undefined;
  fullWidth?: boolean | undefined;
  size?: ButtonSize | undefined;
  tone?: ButtonTone | undefined;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean | undefined;
  loading?: boolean | undefined;
  size?: ButtonSize | undefined;
  tone?: ButtonTone | undefined;
};

export function buttonClassName({
  className,
  fullWidth,
  size = "md",
  tone = "primary"
}: ButtonClassNameOptions = {}) {
  return cx(
    "ui-button",
    `ui-button--${tone}`,
    `ui-button--${size}`,
    fullWidth && "ui-button--full",
    className
  );
}

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  loading,
  size,
  tone,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      aria-busy={loading || undefined}
      className={buttonClassName({ className, fullWidth, size, tone })}
      data-loading={loading ? "true" : undefined}
      disabled={isDisabled}
      type={type}
      {...props}
    >
      {loading ? <span aria-hidden className="ui-button__spinner" /> : null}
      <span className="ui-button__label">{children}</span>
    </button>
  );
}

type ButtonGroupProps = {
  children: ReactNode;
  className?: string | undefined;
};

export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return <div className={cx("ui-page-actions", className)}>{children}</div>;
}
