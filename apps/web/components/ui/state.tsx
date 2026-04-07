import type { ReactNode } from "react";

import { cx } from "./utils";

export type StateTone = "default" | "info" | "success" | "warning" | "danger";

type BaseStateProps = {
  actions?: ReactNode;
  className?: string | undefined;
  description: ReactNode;
  eyebrow?: ReactNode;
  tone?: StateTone | undefined;
  title: ReactNode;
  visual?: ReactNode;
};

type StateFrameProps = BaseStateProps & {
  role?: string | undefined;
  stateClassName?: string | undefined;
};

function StateFrame({
  actions,
  className,
  description,
  eyebrow,
  role,
  stateClassName,
  title,
  tone = "default",
  visual
}: StateFrameProps) {
  return (
    <section
      className={cx("ui-state", stateClassName, tone !== "default" && `ui-state--${tone}`, className)}
      data-tone={tone}
      role={role}
    >
      {visual ? <div className="ui-state__visual">{visual}</div> : null}
      <div className="ui-state__copy">
        {eyebrow ? <p className="ui-state__eyebrow">{eyebrow}</p> : null}
        <h2 className="ui-state__title">{title}</h2>
        <p className="ui-state__description">{description}</p>
      </div>
      {actions ? <div className="ui-state__actions">{actions}</div> : null}
    </section>
  );
}

export function EmptyState(props: BaseStateProps) {
  return <StateFrame {...props} />;
}

export function ErrorState({ tone = "danger", ...props }: BaseStateProps) {
  return <StateFrame {...props} role="alert" stateClassName="ui-state--error" tone={tone} />;
}

type LoadingStateProps = {
  actions?: ReactNode;
  className?: string | undefined;
  description?: ReactNode;
  eyebrow?: ReactNode;
  tone?: StateTone | undefined;
  title?: ReactNode;
  visual?: ReactNode;
};

export function LoadingState({
  actions,
  className,
  description = "Please wait while the latest desk data loads.",
  eyebrow = "Loading",
  tone = "info",
  title = "Loading",
  visual
}: LoadingStateProps) {
  return (
    <StateFrame
      actions={actions}
      className={className}
      description={description}
      eyebrow={eyebrow}
      role="status"
      stateClassName="ui-state--loading"
      title={title}
      tone={tone}
      visual={visual ?? <span aria-hidden className="ui-state__spinner" />}
    />
  );
}
