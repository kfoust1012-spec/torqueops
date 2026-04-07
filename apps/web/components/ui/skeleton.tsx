import type { CSSProperties, HTMLAttributes } from "react";

import { cx } from "./utils";

type SkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  height?: CSSProperties["height"] | undefined;
  width?: CSSProperties["width"] | undefined;
};

export function Skeleton({ className, height, style, width, ...props }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx("ui-skeleton", className)}
      style={{ height, width, ...style }}
      {...props}
    />
  );
}

type SkeletonTextProps = HTMLAttributes<HTMLDivElement> & {
  lines?: number | undefined;
  widths?: Array<CSSProperties["width"]> | undefined;
};

export function SkeletonText({
  className,
  lines = 3,
  widths,
  ...props
}: SkeletonTextProps) {
  return (
    <div className={cx("ui-skeleton-stack", className)} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          className="ui-skeleton--line"
          key={`line-${index}`}
          width={widths?.[index] ?? (index === lines - 1 ? "68%" : "100%")}
        />
      ))}
    </div>
  );
}

type SkeletonPanelProps = HTMLAttributes<HTMLDivElement> & {
  rows?: number | undefined;
};

export function SkeletonPanel({ className, rows = 3, ...props }: SkeletonPanelProps) {
  return (
    <div className={cx("ui-skeleton-panel", className)} {...props}>
      <div className="ui-skeleton-panel__header">
        <Skeleton className="ui-skeleton--chip" width="7rem" />
        <Skeleton className="ui-skeleton--title" width="58%" />
        <SkeletonText lines={2} widths={["88%", "62%"]} />
      </div>
      <div className="ui-skeleton-panel__body">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="ui-skeleton-panel__row" key={`row-${index}`}>
            <SkeletonText lines={2} widths={["72%", "44%"]} />
            <Skeleton className="ui-skeleton--button" width="5.25rem" />
          </div>
        ))}
      </div>
    </div>
  );
}
