"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { DashboardWalkthroughStep } from "../../../../lib/dashboard/walkthrough";
import { Badge, buttonClassName, cx } from "../../../../components/ui";

const storageKey = "torqueops:dashboard-walkthrough-step";

type DashboardWalkthroughProps = {
  steps: readonly DashboardWalkthroughStep[];
};

function clampStepIndex(index: number, stepCount: number) {
  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(index), 0), Math.max(stepCount - 1, 0));
}

export function DashboardWalkthrough({ steps }: DashboardWalkthroughProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex] ?? steps[0];
  const progressPercent = useMemo(
    () => Math.round(((activeIndex + 1) / Math.max(steps.length, 1)) * 100),
    [activeIndex, steps.length]
  );

  useEffect(() => {
    const storedIndex = Number.parseInt(window.localStorage.getItem(storageKey) ?? "0", 10);
    setActiveIndex(clampStepIndex(storedIndex, steps.length));
  }, [steps.length]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(activeIndex));
  }, [activeIndex]);

  if (!activeStep) {
    return null;
  }

  const canGoBack = activeIndex > 0;
  const canGoForward = activeIndex < steps.length - 1;

  return (
    <div className="dashboard-walkthrough" data-testid="dashboard-walkthrough">
      <section className="dashboard-walkthrough__stage" aria-labelledby="dashboard-walkthrough-title">
        <div className="dashboard-walkthrough__progress">
          <div className="dashboard-walkthrough__progress-label">
            <span>
              Step {activeIndex + 1} of {steps.length}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="dashboard-walkthrough__progress-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="dashboard-walkthrough__body">
          <Badge tone={activeIndex === steps.length - 1 ? "success" : "brand"}>{activeStep.label}</Badge>
          <h2 id="dashboard-walkthrough-title">{activeStep.title}</h2>
          <p>{activeStep.body}</p>
        </div>

        <div className="dashboard-walkthrough__actions">
          <button
            className={buttonClassName({ tone: "ghost" })}
            disabled={!canGoBack}
            onClick={() => setActiveIndex((current) => clampStepIndex(current - 1, steps.length))}
            type="button"
          >
            Back
          </button>
          <Link className={buttonClassName({ tone: "secondary" })} href={activeStep.href}>
            Open section
          </Link>
          <button
            className={buttonClassName({ tone: canGoForward ? "primary" : "secondary" })}
            onClick={() => setActiveIndex((current) => clampStepIndex(current + 1, steps.length))}
            type="button"
          >
            {canGoForward ? "Next" : "Done"}
          </button>
        </div>
      </section>

      <ol className="dashboard-walkthrough__steps" aria-label="Walkthrough steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              aria-current={index === activeIndex ? "step" : undefined}
              className={cx(
                "dashboard-walkthrough__step",
                index === activeIndex && "dashboard-walkthrough__step--active",
                index < activeIndex && "dashboard-walkthrough__step--complete"
              )}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{step.title}</strong>
              <small>{step.label}</small>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
