"use client";

import { useEffect, useState } from "react";
import {
  technicianPaymentResolutionDispositions,
  type TechnicianPaymentResolutionDisposition
} from "@mobile-mechanic/types";

import { Button, Input, Select } from "../../../../components/ui";
import { formatTechnicianPaymentResolutionDispositionLabel } from "../../../../lib/invoices/payment-handoff-resolution";

type DispatchHandoffResolutionControlProps = {
  defaultDisposition: TechnicianPaymentResolutionDisposition;
  disabled?: boolean | undefined;
  jobTitle: string;
  loading?: boolean | undefined;
  onResolve: (input: {
    resolutionDisposition: TechnicianPaymentResolutionDisposition;
    resolutionNote: string | null;
  }) => void;
};

export function DispatchHandoffResolutionControl({
  defaultDisposition,
  disabled,
  jobTitle,
  loading,
  onResolve
}: DispatchHandoffResolutionControlProps) {
  const [resolutionDisposition, setResolutionDisposition] =
    useState<TechnicianPaymentResolutionDisposition>(defaultDisposition);
  const [resolutionNote, setResolutionNote] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setResolutionDisposition(defaultDisposition);
  }, [defaultDisposition]);

  const requiresNote = resolutionDisposition === "other_resolved";

  return (
    <div className="dispatch-command-card__inline-controls">
      <div className="dispatch-command-card__inline-form">
        <label className="dispatch-command-card__field">
          <span>Resolve as</span>
          <Select
            aria-label={`${jobTitle} handoff resolution disposition`}
            disabled={disabled}
            onChange={(event) => {
              const nextDisposition = event.target.value as TechnicianPaymentResolutionDisposition;
              setResolutionDisposition(nextDisposition);
              if (nextDisposition !== "other_resolved") {
                setValidationMessage(null);
              }
            }}
            value={resolutionDisposition}
          >
            {technicianPaymentResolutionDispositions.map((disposition) => (
              <option key={disposition} value={disposition}>
                {formatTechnicianPaymentResolutionDispositionLabel(disposition)}
              </option>
            ))}
          </Select>
        </label>
        <label className="dispatch-command-card__field">
          <span>Office note</span>
          <Input
            aria-label={`${jobTitle} handoff resolution note`}
            disabled={disabled}
            onChange={(event) => {
              setResolutionNote(event.target.value);
              if (event.target.value.trim()) {
                setValidationMessage(null);
              }
            }}
            placeholder={
              requiresNote
                ? "Required when resolved another way"
                : "Optional billing note"
            }
            value={resolutionNote}
          />
        </label>
      </div>
      <div className="ui-button-grid">
        <Button
          disabled={disabled}
          loading={loading}
          onClick={() => {
            const trimmedNote = resolutionNote.trim();

            if (requiresNote && !trimmedNote) {
              setValidationMessage("Add a note before using Other resolved.");
              return;
            }

            setValidationMessage(null);
            onResolve({
              resolutionDisposition,
              resolutionNote: trimmedNote || null
            });
          }}
          size="sm"
          tone="primary"
          type="button"
        >
          Resolve handoff
        </Button>
      </div>
      {validationMessage ? (
        <p className="dispatch-command-card__copy">{validationMessage}</p>
      ) : null}
    </div>
  );
}
