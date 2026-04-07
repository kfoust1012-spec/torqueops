import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type CalloutTone = "default" | "warning" | "danger" | "success";

type CalloutProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: ReactNode;
  tone?: CalloutTone | undefined;
};

export function Callout({
  children,
  className,
  title,
  tone = "default",
  ...props
}: CalloutProps) {
  return (
    <div
      className={cx(
        "ui-callout",
        tone !== "default" && `ui-callout--${tone}`,
        className
      )}
      {...props}
    >
      {title ? <p className="ui-callout__title">{title}</p> : null}
      {typeof children === "string" ? <p className="ui-section-copy">{children}</p> : children}
    </div>
  );
}
