import type { CSSProperties } from "react";
import type { DispatchCalendarAvailabilityEvent } from "@mobile-mechanic/types";
import { formatDesignLabel, formatDispatchDateTime } from "@mobile-mechanic/core";

import { Button, cx } from "../../../../components/ui";

type DispatchAvailabilityEventProps = {
  event: DispatchCalendarAvailabilityEvent;
  isSelected?: boolean;
  onClick: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  removing?: boolean;
  style: CSSProperties;
  timezone: string;
};

export function DispatchAvailabilityEvent({
  event,
  isSelected,
  onClick,
  onRemove,
  removing,
  style,
  timezone
}: DispatchAvailabilityEventProps) {
  return (
    <div
      className={cx(
        "dispatch-calendar__event",
        "dispatch-calendar__event--availability",
        isSelected && "dispatch-calendar__event--selected"
      )}
      id={`dispatch-availability-${event.id}`}
      style={style}
    >
      <button className="dispatch-calendar__event-body" onClick={() => onClick(event.id)} type="button">
        <div className="dispatch-calendar__event-topline">
          <span className="dispatch-calendar__event-time-pill">
            {formatDispatchDateTime(event.eventStartAt, timezone, {
              hour: "numeric",
              minute: "2-digit"
            })}
            {" - "}
            {formatDispatchDateTime(event.eventEndAt, timezone, {
              hour: "numeric",
              minute: "2-digit"
            })}
          </span>
          <span className="dispatch-calendar__event-state-chip dispatch-calendar__event-state-chip--warning">
            {formatDesignLabel(event.blockType)}
          </span>
        </div>
        <div className="dispatch-calendar__event-heading">
          <strong>{event.title}</strong>
          {event.notes ? <p>{event.notes}</p> : null}
        </div>
      </button>
      <div className="dispatch-calendar__event-actions dispatch-calendar__event-actions--availability">
        <Button
          loading={removing}
          onClick={(eventObject) => {
            eventObject.stopPropagation();
            onRemove(event.id);
          }}
          size="sm"
          tone="tertiary"
          type="button"
        >
          Remove block
        </Button>
      </div>
    </div>
  );
}
