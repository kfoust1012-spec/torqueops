import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeader, buttonClassName } from "../../../components/ui";

type FieldCommandShellProps = {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  mode: "dispatch" | "fleet";
  status?: ReactNode;
  title: string;
};

export function FieldCommandShell({
  actions,
  description,
  eyebrow,
  mode,
  status,
  title
}: FieldCommandShellProps) {
  return (
    <section className="field-command-shell">
      <PageHeader
        actions={
          <div className="field-command-shell__actions">
            {actions}
          </div>
        }
        description={description}
        eyebrow={eyebrow}
        status={status}
        title={title}
      />
    </section>
  );
}
