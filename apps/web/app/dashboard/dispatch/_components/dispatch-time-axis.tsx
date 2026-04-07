import type { DispatchCalendarSlot } from "@mobile-mechanic/types";

type DispatchTimeAxisProps = {
  slots: DispatchCalendarSlot[];
};

export function DispatchTimeAxis({ slots }: DispatchTimeAxisProps) {
  return (
    <div className="dispatch-calendar__time-axis">
      {slots.map((slot, index) => {
        const isPrimaryLabel = index === 0 || slot.shortLabel !== slots[index - 1]?.shortLabel;

        return (
          <div
            className={
              isPrimaryLabel
                ? "dispatch-calendar__time-cell"
                : "dispatch-calendar__time-cell dispatch-calendar__time-cell--minor"
            }
            key={slot.index}
          >
            {isPrimaryLabel ? (
              <span>{slot.shortLabel}</span>
            ) : (
              <span aria-hidden className="dispatch-calendar__time-tick" />
            )}
          </div>
        );
      })}
    </div>
  );
}
