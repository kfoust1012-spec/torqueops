"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { buttonClassName } from "../../../../components/ui";

const supplyFlows = [
  { href: "/dashboard/visits?scope=supply_blocked", key: "blocked", label: "Unblock visits" },
  { href: "/dashboard/supply?view=requests", key: "requests", label: "Work requests" },
  { href: "/dashboard/supply/inventory?view=control", key: "inventory", label: "Stock control" },
  { href: "/dashboard/supply/integrations", key: "setup", label: "Sourcing setup" }
] as const;

export function SupplyWorkspaceShell() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const activeFlow = pathname.startsWith("/dashboard/supply/inventory")
    ? "inventory"
    : pathname.startsWith("/dashboard/supply/integrations")
      ? "setup"
        : pathname === "/dashboard/supply" && searchParams.get("view") === "requests"
          ? "requests"
          : "blocked";

  return (
    <section className="supply-shell">
      <div className="supply-shell__focus">
        <div className="supply-shell__focus-actions">
          {supplyFlows.map((flow) => (
            <Link
              className={buttonClassName({
                size: "sm",
                tone: activeFlow === flow.key ? "secondary" : "ghost"
              })}
              href={flow.href}
              key={flow.key}
            >
              {flow.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
