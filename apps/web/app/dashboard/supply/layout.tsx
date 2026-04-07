import type { ReactNode } from "react";

import { SupplyWorkspaceShell } from "./_components/supply-workspace-shell";

type SupplyLayoutProps = {
  children: ReactNode;
};

export default function SupplyLayout({ children }: SupplyLayoutProps) {
  return (
    <>
      <SupplyWorkspaceShell />
      {children}
    </>
  );
}