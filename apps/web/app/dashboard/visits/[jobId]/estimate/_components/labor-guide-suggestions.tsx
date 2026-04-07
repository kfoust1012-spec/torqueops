"use client";

import type { LaborGuideSuggestionResult } from "@mobile-mechanic/types";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Badge, Button, Card, CardContent, CardHeader, CardHeaderContent, CardEyebrow, CardTitle, EmptyState } from "../../../../../../components/ui";

type LaborGuideSuggestionsProps = {
  jobId: string;
  estimateId?: string | null;
  previewOnly?: boolean;
  addSuggestionAction?: (formData: FormData) => Promise<void>;
};

type FeedbackState = {
  tone: "error" | "warning";
  message: string;
};

const LABOR_GUIDE_REQUEST_TIMEOUT_MS = 5000;

function formatSuggestedHours(hours: number): string {
  const formatted = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1).replace(/\.0$/, "");
  return `${formatted} ${hours === 1 ? "hour" : "hours"}`;
}

function AddSuggestionSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} tone="secondary" type="submit">
      {pending ? "Adding labor item..." : "Add as editable labor item"}
    </Button>
  );
}

export function LaborGuideSuggestions({
  jobId,
  estimateId = null,
  previewOnly = false,
  addSuggestionAction
}: LaborGuideSuggestionsProps) {
  const [result, setResult] = useState<LaborGuideSuggestionResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadSuggestions() {
    setIsLoading(true);
    setFeedback(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LABOR_GUIDE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/labor-guide/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jobId,
          estimateId
        }),
        cache: "no-store",
        signal: controller.signal
      });
      const payload = (await response.json()) as LaborGuideSuggestionResult | { message?: string };

      if (!response.ok) {
        setResult(null);
        setFeedback({
          tone: "error",
          message:
            "message" in payload && payload.message
              ? payload.message
              : "Labor suggestions could not be loaded right now. Manual estimate line items are still available."
        });
        return;
      }

      setResult(payload as LaborGuideSuggestionResult);
    } catch {
      setResult(null);
      setFeedback({
        tone: "warning",
        message:
          "Labor suggestions could not be loaded right now. You can continue with manual estimate line items and try suggestions again later."
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Labor guide</CardEyebrow>
          <CardTitle>Suggested labor operations</CardTitle>
          <p className="ui-section-copy">
            Match the current visit details against a curated labor guide. Suggestions never replace manual editing.
          </p>
        </CardHeaderContent>
      </CardHeader>

      <CardContent>
        <div className="ui-action-grid">
          <div className="ui-button-grid">
            <Button disabled={isLoading} onClick={() => void loadSuggestions()} tone="secondary" type="button">
              {isLoading ? "Loading suggestions..." : "Find labor suggestions"}
            </Button>
          </div>

          {feedback ? (
            <div
              aria-live="polite"
              className={`ui-callout ${feedback.tone === "error" ? "ui-callout--danger" : "ui-callout--warning"}`}
            >
              <p className="ui-section-copy">{feedback.message}</p>
            </div>
          ) : null}

          {result?.warnings.length ? (
            <div className="ui-action-grid">
              {result.warnings.map((warning) => (
                <p key={warning} className="ui-section-copy">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          {result?.status === "no_match" ? (
            <EmptyState
              description={
                previewOnly
                ? "No labor suggestions matched this visit yet. Create the estimate and continue with manual line items if needed."
                : "No labor suggestions matched this visit yet. Manual labor, parts, and fee items remain available below."
              }
              eyebrow="No match"
              title="No labor suggestions found"
            />
          ) : null}

          {result?.operations.length ? (
            <div className="ui-card-list">
              {result.operations.map((operation) => (
                <Card key={operation.code} padding="compact" tone="subtle">
                  <div className="ui-toolbar">
                    <div className="ui-action-grid">
                      <p className="ui-summary-label">{operation.confidence} confidence</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1.125rem", lineHeight: 1.2 }}>
                        {operation.name}
                      </h3>
                      <p className="ui-inline-copy">
                        Suggested time: {formatSuggestedHours(operation.suggestedHours)}
                      </p>
                    </div>

                    <Badge tone="brand">{operation.suggestedHours} hr</Badge>
                  </div>

                  <p className="ui-detail-value">
                    {operation.description}
                  </p>

                  <p className="ui-inline-copy">
                    Matched: {operation.matchedSignals.join(", ")}
                  </p>

                  <p className="ui-inline-copy">
                    {operation.rationale}
                  </p>

                  {previewOnly || !addSuggestionAction ? (
                    <p className="ui-section-copy">
                      Create the estimate first, then add any suggestion as an editable labor line item.
                    </p>
                  ) : (
                    <div className="ui-action-grid">
                      <p className="ui-section-copy">
                        Adds an editable labor line item with {formatSuggestedHours(operation.lineItemDefaults.quantity)} and a unit
                        price of 0 until you set the final labor rate.
                      </p>

                      <form action={addSuggestionAction}>
                        <input name="itemType" type="hidden" value={operation.lineItemDefaults.itemType} />
                        <input name="name" type="hidden" value={operation.lineItemDefaults.name} />
                        <input name="quantity" type="hidden" value={String(operation.lineItemDefaults.quantity)} />
                        <input
                          name="unitPriceCents"
                          type="hidden"
                          value={String(operation.lineItemDefaults.unitPriceCents)}
                        />
                        <input
                          name="description"
                          type="hidden"
                          value={operation.lineItemDefaults.description ?? ""}
                        />
                        {operation.lineItemDefaults.taxable ? <input name="taxable" type="hidden" value="on" /> : null}
                        <AddSuggestionSubmitButton />
                      </form>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
