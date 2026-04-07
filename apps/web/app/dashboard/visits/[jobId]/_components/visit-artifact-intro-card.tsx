import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle
} from "../../../../../components/ui";

type VisitArtifactIntroCardProps = {
  actions?: ReactNode;
  actionsClassName?: string;
  className?: string;
  description: ReactNode;
  eyebrow: string;
  headerMeta?: ReactNode;
  headerMetaClassName?: string;
  title: ReactNode;
};

function joinClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function VisitArtifactIntroCard({
  actions,
  actionsClassName,
  className,
  description,
  eyebrow,
  headerMeta,
  headerMetaClassName,
  title
}: VisitArtifactIntroCardProps) {
  return (
    <Card className={className} tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>{eyebrow}</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeaderContent>
        {headerMeta ? <div className={headerMetaClassName}>{headerMeta}</div> : null}
      </CardHeader>

      {actions ? (
        <CardContent>
          <div className={joinClassNames("ui-page-actions", actionsClassName)}>{actions}</div>
        </CardContent>
      ) : null}
    </Card>
  );
}