import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type PageProps = HTMLAttributes<HTMLElement> & {
  layout?: "default" | "command";
};

export function Page({ children, className, layout = "default", ...props }: PageProps) {
  return (
    <section className={cx("ui-page", layout === "command" && "ui-page--command", className)} {...props}>
      {children}
    </section>
  );
}

type PageHeaderProps = {
  actions?: ReactNode;
  compact?: boolean;
  details?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  compact = false,
  description,
  details,
  eyebrow,
  status,
  title
}: PageHeaderProps) {
  return (
    <header className={cx("ui-page-header", compact && "ui-page-header--compact")}>
      <div className="ui-page-header__content">
        {eyebrow ? <p className="ui-page-header__eyebrow">{eyebrow}</p> : null}
        <div className="ui-page-header__main">
          <div className="ui-page-header__body">
            <h1 className="ui-page-title">{title}</h1>
            {description ? <p className="ui-page-description">{description}</p> : null}
            {details ? <div className="ui-page-header__details">{details}</div> : null}
          </div>
        </div>
      </div>
      {actions || status ? (
        <div className="ui-page-header__rail">
          {status ? <div className="ui-page-header__status">{status}</div> : null}
          {actions ? <div className="ui-page-actions ui-page-header__actions">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}

type PageGridProps = {
  children: ReactNode;
  className?: string | undefined;
  hasSidebar?: boolean | undefined;
};

export function PageGrid({ children, className, hasSidebar }: PageGridProps) {
  return (
    <div className={cx("ui-page-grid", hasSidebar && "ui-page-grid--sidebar", className)}>
      {children}
    </div>
  );
}
