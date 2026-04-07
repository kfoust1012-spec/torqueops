import type { HTMLAttributes } from "react";

import {
  formatDesignLabel,
  formatDesignStatusLabel,
  resolveDesignPriorityTone,
  resolveDesignReminderStageTone,
  resolveDesignSeverityTone,
  resolveDesignStatusTone,
  type DesignStatusTone
} from "@mobile-mechanic/core";

import { cx } from "./utils";

export type BadgeTone = DesignStatusTone | "brand";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone | undefined;
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

type StatusBadgeProps = Omit<BadgeProps, "children" | "tone"> & {
  fallbackTone?: DesignStatusTone | undefined;
  status: string;
};

export function StatusBadge({
  className,
  fallbackTone = "neutral",
  status,
  ...props
}: StatusBadgeProps) {
  const tone = resolveDesignStatusTone(status) ?? fallbackTone;

  return (
    <Badge className={className} tone={tone} {...props}>
      {formatDesignStatusLabel(status)}
    </Badge>
  );
}

type SemanticBadgeProps = Omit<BadgeProps, "children" | "tone"> & {
  fallbackTone?: DesignStatusTone | undefined;
  label?: string | undefined;
  value: string;
};

export function SeverityBadge({
  className,
  fallbackTone = "neutral",
  label,
  value,
  ...props
}: SemanticBadgeProps) {
  return (
    <Badge className={className} tone={resolveDesignSeverityTone(value) ?? fallbackTone} {...props}>
      {label ?? formatDesignLabel(value)}
    </Badge>
  );
}

export function PriorityBadge({
  className,
  fallbackTone = "neutral",
  label,
  value,
  ...props
}: SemanticBadgeProps) {
  return (
    <Badge className={className} tone={resolveDesignPriorityTone(value) ?? fallbackTone} {...props}>
      {label ?? formatDesignLabel(value)}
    </Badge>
  );
}

export function ReminderStageBadge({
  className,
  fallbackTone = "neutral",
  label,
  value,
  ...props
}: SemanticBadgeProps) {
  return (
    <Badge
      className={className}
      tone={resolveDesignReminderStageTone(value) ?? fallbackTone}
      {...props}
    >
      {label ?? formatDesignLabel(value)}
    </Badge>
  );
}
