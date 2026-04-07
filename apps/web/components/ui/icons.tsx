import type { SVGProps } from "react";

import { cx } from "./utils";

export type AppIconName =
  | "alert"
  | "approval"
  | "camera"
  | "customers"
  | "customerVehicles"
  | "dashboard"
  | "dispatch"
  | "estimates"
  | "fleet"
  | "fleetVehicles"
  | "inventory"
  | "invoices"
  | "jobs"
  | "message"
  | "money"
  | "note"
  | "parts"
  | "phone"
  | "reports"
  | "settings"
  | "team"
  | "today";

type AppIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: AppIconName;
};

function IconPaths({ name }: { name: AppIconName }) {
  switch (name) {
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </>
      );
    case "dispatch":
      return (
        <>
          <path d="M4 18c2.5-5.5 6.5-8.5 14-12" />
          <path d="M14 6h4v4" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
        </>
      );
    case "jobs":
      return (
        <>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 4.5h6" />
          <path d="M8 9h8" />
          <path d="M8 13h8" />
        </>
      );
    case "estimates":
      return (
        <>
          <path d="M7 4h8l4 4v12H7z" />
          <path d="M15 4v4h4" />
          <path d="M10 12h6" />
          <path d="M10 16h4" />
        </>
      );
    case "invoices":
      return (
        <>
          <path d="M7 4h10v16l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
          <path d="M10 9h4" />
          <path d="M10 13h4" />
        </>
      );
    case "customers":
      return (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 19c1.4-3 4-4.5 6.5-4.5s5.1 1.5 6.5 4.5" />
        </>
      );
    case "phone":
      return (
        <>
          <path d="M7.5 5.5c.8-.8 2-.9 2.9-.3l1.6 1.1c.8.5 1.1 1.6.7 2.5l-.6 1.4a14.1 14.1 0 0 0 1.7 2.2 14.1 14.1 0 0 0 2.2 1.7l1.4-.6c.9-.4 2-.1 2.5.7l1.1 1.6c.6.9.5 2.1-.3 2.9l-1 1c-.9.9-2.2 1.3-3.4 1-2.8-.7-5.4-2.2-7.6-4.4s-3.7-4.8-4.4-7.6c-.3-1.2.1-2.5 1-3.4z" />
        </>
      );
    case "message":
      return (
        <>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 13.5z" />
          <path d="M8.5 9.5h7" />
          <path d="M8.5 12.5H13" />
        </>
      );
    case "camera":
      return (
        <>
          <path d="M7.5 7.5 9 5h6l1.5 2.5H19A2 2 0 0 1 21 9.5v7A2 2 0 0 1 19 18.5H5A2 2 0 0 1 3 16.5v-7a2 2 0 0 1 2-2z" />
          <circle cx="12" cy="13" r="3" />
        </>
      );
    case "note":
      return (
        <>
          <path d="M7 4.5h8l3 3v12H7z" />
          <path d="M15 4.5v3h3" />
          <path d="M10 11h5" />
          <path d="M10 14h5" />
        </>
      );
    case "customerVehicles":
    case "fleetVehicles":
      return (
        <>
          <path d="M5 14l2-5h10l2 5" />
          <path d="M4 14h16v3a1 1 0 0 1-1 1h-1" />
          <path d="M6 18h12" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </>
      );
    case "fleet":
      return (
        <>
          <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      );
    case "team":
      return (
        <>
          <circle cx="9" cy="9" r="3" />
          <circle cx="16.5" cy="10" r="2.5" />
          <path d="M4.5 19c1.3-2.8 3.6-4.2 6-4.2 1.7 0 3.3.7 4.5 2" />
          <path d="M15 16.5c1.7.2 3.2 1.1 4.2 2.5" />
        </>
      );
    case "parts":
      return (
        <>
          <path d="M14.5 4.5a3 3 0 1 1 4 4L10 17l-4 1 1-4z" />
          <path d="M13 6l5 5" />
        </>
      );
    case "inventory":
      return (
        <>
          <path d="M4 8l8-4 8 4-8 4z" />
          <path d="M4 8v8l8 4 8-4V8" />
          <path d="M12 12v8" />
        </>
      );
    case "reports":
      return (
        <>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M5.6 5.6l2.1 2.1" />
          <path d="M16.3 16.3l2.1 2.1" />
          <path d="M18.4 5.6l-2.1 2.1" />
          <path d="M7.7 16.3l-2.1 2.1" />
        </>
      );
    case "alert":
      return (
        <>
          <path d="M12 4l8 14H4z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
        </>
      );
    case "approval":
      return (
        <>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 13.5z" />
          <path d="M9 10.5l2 2 4-4" />
        </>
      );
    case "money":
      return (
        <>
          <path d="M12 4v16" />
          <path d="M15.5 7.5c-.7-.8-1.9-1.5-3.5-1.5-2.2 0-3.5 1.2-3.5 2.7 0 3.7 7 1.7 7 5.5 0 1.6-1.4 2.8-3.8 2.8-1.6 0-3-.6-4-1.7" />
        </>
      );
    case "today":
      return (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
        </>
      );
    default:
      return null;
  }
}

export function AppIcon({ className, name, ...props }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cx("ui-icon", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      <IconPaths name={name} />
    </svg>
  );
}
