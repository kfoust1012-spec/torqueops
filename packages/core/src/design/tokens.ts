export type DesignStatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger";

export const designTokens = {
  color: {
    canvas: {
      base: "#f4f0e8",
      elevated: "#fbf7f0",
      sunken: "#ece4d8"
    },
    surface: {
      base: "#fffcf7",
      raised: "#ffffff",
      subtle: "#f7f1e7",
      inverse: "#142536"
    },
    text: {
      strong: "#17212b",
      base: "#3a4654",
      muted: "#6d7784",
      subtle: "#7e8793",
      inverse: "#ffffff"
    },
    border: {
      subtle: "#ded6ca",
      base: "#cfc4b5",
      strong: "#b6aa98"
    },
    brand: {
      strong: "#243b53",
      base: "#314a68",
      warm: "#9d6a2e",
      soft: "#e9eff5",
      focus: "rgba(36, 59, 83, 0.18)"
    }
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 32,
    8: 40,
    9: 48,
    10: 64,
    11: 80
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999
  },
  typography: {
    family: {
      display: "var(--font-ui-display), \"Segoe UI\", sans-serif",
      body: "var(--font-ui-body), \"Segoe UI\", sans-serif",
      mono: "var(--font-ui-mono), \"SFMono-Regular\", ui-monospace, monospace"
    },
    size: {
      label: 12,
      caption: 13,
      body: 15,
      bodyLarge: 16,
      titleSm: 18,
      titleMd: 24,
      titleLg: 34,
      display: 40
    },
    lineHeight: {
      compact: 1.08,
      body: 1.45,
      relaxed: 1.55
    }
  },
  layout: {
    maxWidth: 1720,
    commandWidth: 1920,
    measure: 720,
    sidebarWidth: 288,
    touchTargetWeb: 44,
    touchTargetMobile: 48
  },
  elevation: {
    soft: "0 18px 42px rgba(23, 33, 43, 0.08)",
    raised: "0 28px 80px rgba(23, 33, 43, 0.12)",
    overlay: "0 34px 110px rgba(20, 37, 54, 0.18)"
  },
  motion: {
    duration: {
      press: 90,
      fast: 120,
      hover: 160,
      base: 180,
      slow: 220,
      panel: 240,
      route: 280
    },
    distance: {
      liftXs: 1,
      liftSm: 3,
      nudge: 6,
      panel: 10,
      route: 12,
      drawer: 16
    },
    easing: {
      standard: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      enter: "cubic-bezier(0.16, 1, 0.3, 1)",
      exit: "cubic-bezier(0.4, 0, 1, 1)",
      snap: "cubic-bezier(0.22, 1, 0.36, 1)"
    }
  }
} as const;

export const designStatusTones: Record<
  DesignStatusTone,
  {
    background: string;
    border: string;
    text: string;
    solid: string;
    solidText: string;
  }
> = {
  neutral: {
    background: "#f0ebe4",
    border: "#d9d0c4",
    text: "#5d6773",
    solid: "#5d6773",
    solidText: "#ffffff"
  },
  info: {
    background: "#e7eef5",
    border: "#cad9e7",
    text: "#3e6c94",
    solid: "#3e6c94",
    solidText: "#ffffff"
  },
  progress: {
    background: "#e2f1ec",
    border: "#bddfd3",
    text: "#2e6b62",
    solid: "#2e6b62",
    solidText: "#ffffff"
  },
  warning: {
    background: "#fff3de",
    border: "#e9c998",
    text: "#b97928",
    solid: "#b97928",
    solidText: "#ffffff"
  },
  success: {
    background: "#e7f3ec",
    border: "#c6ddce",
    text: "#2d7a57",
    solid: "#2d7a57",
    solidText: "#ffffff"
  },
  danger: {
    background: "#f7e6e3",
    border: "#e6c2bc",
    text: "#b24b3c",
    solid: "#b24b3c",
    solidText: "#ffffff"
  }
} as const;

export const designStatusAliases = {
  new: "neutral",
  draft: "neutral",
  queued: "neutral",
  archived: "neutral",
  not_checked: "neutral",
  pending: "warning",
  action_required: "warning",
  awaiting_approval: "warning",
  unscheduled: "warning",
  attention: "warning",
  not_found: "warning",
  not_available: "warning",
  partial: "warning",
  quoted: "warning",
  core_due: "warning",
  expired: "warning",
  low_stock: "warning",
  non_stocked: "warning",
  pending_approval: "warning",
  waiting_approval: "warning",
  waiting_parts: "warning",
  manual_required: "warning",
  unmapped: "warning",
  overdue: "danger",
  failed: "danger",
  canceled: "danger",
  declined: "danger",
  provider_error: "danger",
  invalid_format: "danger",
  revoked: "danger",
  void: "danger",
  scheduled: "info",
  sent: "info",
  assigned: "info",
  dispatched: "info",
  arrived: "info",
  ready_for_payment: "info",
  issued: "info",
  en_route: "progress",
  diagnosing: "progress",
  in_progress: "progress",
  repairing: "progress",
  active: "progress",
  open: "progress",
  processing: "progress",
  partially_paid: "progress",
  ordered: "progress",
  submitted: "progress",
  link_out: "info",
  integration: "info",
  warehouse: "info",
  shop: "info",
  connected: "success",
  disconnected: "neutral",
  priced: "info",
  selected: "progress",
  completed: "success",
  paid: "success",
  approved: "success",
  delivered: "success",
  accepted: "success",
  succeeded: "success",
  success: "success",
  ready: "success",
  received: "success",
  installed: "success",
  fulfilled: "success",
  converted: "success",
  closed: "success",
  core_returned: "success",
  manual: "neutral",
  stocked: "success",
  reorder_due: "danger",
  pass: "success",
  fail: "danger"
} as const satisfies Record<string, DesignStatusTone>;

export const designSeverityAliases = {
  info: "info",
  low: "neutral",
  medium: "warning",
  warning: "warning",
  high: "danger",
  critical: "danger",
  alert: "danger"
} as const satisfies Record<string, DesignStatusTone>;

export const designPriorityAliases = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger"
} as const satisfies Record<string, DesignStatusTone>;

export const designReminderStageAliases = {
  upcoming: "info",
  due: "warning",
  overdue: "danger"
} as const satisfies Record<string, DesignStatusTone>;

export const webDesignCssVariables = {
  "--ui-font-display": designTokens.typography.family.display,
  "--ui-font-body": designTokens.typography.family.body,
  "--ui-font-mono": designTokens.typography.family.mono,
  "--ui-canvas-base": designTokens.color.canvas.base,
  "--ui-canvas-elevated": designTokens.color.canvas.elevated,
  "--ui-canvas-sunken": designTokens.color.canvas.sunken,
  "--ui-surface-page": designTokens.color.canvas.base,
  "--ui-surface-base": designTokens.color.surface.base,
  "--ui-surface-raised": designTokens.color.surface.raised,
  "--ui-surface-subtle": designTokens.color.surface.subtle,
  "--ui-surface-inverse": designTokens.color.surface.inverse,
  "--ui-text-strong": designTokens.color.text.strong,
  "--ui-text-base": designTokens.color.text.base,
  "--ui-text-muted": designTokens.color.text.muted,
  "--ui-text-subtle": designTokens.color.text.subtle,
  "--ui-text-inverse": designTokens.color.text.inverse,
  "--ui-border-subtle": designTokens.color.border.subtle,
  "--ui-border-base": designTokens.color.border.base,
  "--ui-border-strong": designTokens.color.border.strong,
  "--ui-brand-strong": designTokens.color.brand.strong,
  "--ui-brand-base": designTokens.color.brand.base,
  "--ui-brand-warm": designTokens.color.brand.warm,
  "--ui-brand-soft": designTokens.color.brand.soft,
  "--ui-focus-ring": designTokens.color.brand.focus,
  "--ui-space-0": "0",
  "--ui-space-1": `${designTokens.spacing[1]}px`,
  "--ui-space-2": `${designTokens.spacing[2]}px`,
  "--ui-space-3": `${designTokens.spacing[3]}px`,
  "--ui-space-4": `${designTokens.spacing[4]}px`,
  "--ui-space-5": `${designTokens.spacing[5]}px`,
  "--ui-space-6": `${designTokens.spacing[6]}px`,
  "--ui-space-7": `${designTokens.spacing[7]}px`,
  "--ui-space-8": `${designTokens.spacing[8]}px`,
  "--ui-space-9": `${designTokens.spacing[9]}px`,
  "--ui-space-10": `${designTokens.spacing[10]}px`,
  "--ui-space-11": `${designTokens.spacing[11]}px`,
  "--ui-radius-sm": `${designTokens.radius.sm}px`,
  "--ui-radius-md": `${designTokens.radius.md}px`,
  "--ui-radius-lg": `${designTokens.radius.lg}px`,
  "--ui-radius-xl": `${designTokens.radius.xl}px`,
  "--ui-radius-pill": `${designTokens.radius.pill}px`,
  "--ui-layout-max-width": `${designTokens.layout.maxWidth}px`,
  "--ui-layout-command-width": `${designTokens.layout.commandWidth}px`,
  "--ui-layout-sidebar-width": `${designTokens.layout.sidebarWidth}px`,
  "--ui-shadow-soft": designTokens.elevation.soft,
  "--ui-shadow-raised": designTokens.elevation.raised,
  "--ui-shadow-overlay": designTokens.elevation.overlay,
  "--ui-duration-press": `${designTokens.motion.duration.press}ms`,
  "--ui-duration-fast": `${designTokens.motion.duration.fast}ms`,
  "--ui-duration-hover": `${designTokens.motion.duration.hover}ms`,
  "--ui-duration-base": `${designTokens.motion.duration.base}ms`,
  "--ui-duration-slow": `${designTokens.motion.duration.slow}ms`,
  "--ui-duration-panel": `${designTokens.motion.duration.panel}ms`,
  "--ui-duration-route": `${designTokens.motion.duration.route}ms`,
  "--ui-motion-lift-xs": `${designTokens.motion.distance.liftXs}px`,
  "--ui-motion-lift-sm": `${designTokens.motion.distance.liftSm}px`,
  "--ui-motion-nudge": `${designTokens.motion.distance.nudge}px`,
  "--ui-motion-panel-y": `${designTokens.motion.distance.panel}px`,
  "--ui-motion-route-y": `${designTokens.motion.distance.route}px`,
  "--ui-motion-drawer-x": `${designTokens.motion.distance.drawer}px`,
  "--ui-ease-standard": designTokens.motion.easing.standard,
  "--ui-ease-enter": designTokens.motion.easing.enter,
  "--ui-ease-exit": designTokens.motion.easing.exit,
  "--ui-ease-snap": designTokens.motion.easing.snap,
  "--ui-status-neutral-bg": designStatusTones.neutral.background,
  "--ui-status-neutral-border": designStatusTones.neutral.border,
  "--ui-status-neutral-text": designStatusTones.neutral.text,
  "--ui-status-info-bg": designStatusTones.info.background,
  "--ui-status-info-border": designStatusTones.info.border,
  "--ui-status-info-text": designStatusTones.info.text,
  "--ui-status-progress-bg": designStatusTones.progress.background,
  "--ui-status-progress-border": designStatusTones.progress.border,
  "--ui-status-progress-text": designStatusTones.progress.text,
  "--ui-status-warning-bg": designStatusTones.warning.background,
  "--ui-status-warning-border": designStatusTones.warning.border,
  "--ui-status-warning-text": designStatusTones.warning.text,
  "--ui-status-success-bg": designStatusTones.success.background,
  "--ui-status-success-border": designStatusTones.success.border,
  "--ui-status-success-text": designStatusTones.success.text,
  "--ui-status-danger-bg": designStatusTones.danger.background,
  "--ui-status-danger-border": designStatusTones.danger.border,
  "--ui-status-danger-text": designStatusTones.danger.text
} as const satisfies Record<string, string>;

export function normalizeDesignStatusKey(status: string | null | undefined) {
  return status?.trim().toLowerCase().replaceAll(/[ -]+/g, "_") ?? null;
}

function resolveDesignToneFromAliases(
  value: string | null | undefined,
  aliases: Readonly<Record<string, DesignStatusTone>>
) {
  const normalized = normalizeDesignStatusKey(value);

  if (!normalized) {
    return "neutral" as DesignStatusTone;
  }

  return aliases[normalized] ?? "neutral";
}

export function resolveDesignStatusTone(status: string | null | undefined): DesignStatusTone {
  return resolveDesignToneFromAliases(
    status,
    designStatusAliases as Record<string, DesignStatusTone>
  );
}

export function resolveDesignSeverityTone(severity: string | null | undefined): DesignStatusTone {
  return resolveDesignToneFromAliases(
    severity,
    designSeverityAliases as Record<string, DesignStatusTone>
  );
}

export function resolveDesignPriorityTone(priority: string | null | undefined): DesignStatusTone {
  return resolveDesignToneFromAliases(
    priority,
    designPriorityAliases as Record<string, DesignStatusTone>
  );
}

export function resolveDesignReminderStageTone(stage: string | null | undefined): DesignStatusTone {
  return resolveDesignToneFromAliases(
    stage,
    designReminderStageAliases as Record<string, DesignStatusTone>
  );
}

export function formatDesignLabel(value: string | null | undefined) {
  const normalized = normalizeDesignStatusKey(value);

  if (!normalized) {
    return "";
  }

  return normalized
    .split("_")
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

export function formatDesignStatusLabel(status: string | null | undefined) {
  return formatDesignLabel(status);
}

export function renderWebDesignCssVariables(selector = ":root") {
  const declarations = Object.entries(webDesignCssVariables)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");

  return `${selector} { ${declarations} }`;
}
