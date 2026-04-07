import { Badge } from "../../../../components/ui";

type DispatchConflictIndicatorProps = {
  count: number;
  onClick?: (() => void) | undefined;
  tone?: "danger" | "warning";
};

export function DispatchConflictIndicator({
  count,
  onClick,
  tone = "danger"
}: DispatchConflictIndicatorProps) {
  if (count <= 0) {
    return null;
  }

  if (onClick) {
    return (
      <button
        className="dispatch-calendar__conflict-indicator-button"
        onClick={onClick}
        type="button"
      >
        <Badge className="dispatch-calendar__conflict-indicator" tone={tone}>
          {count} {count === 1 ? "conflict" : "conflicts"}
        </Badge>
      </button>
    );
  }

  return (
    <Badge className="dispatch-calendar__conflict-indicator" tone={tone}>
      {count} {count === 1 ? "conflict" : "conflicts"}
    </Badge>
  );
}
