"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AssignableTechnicianOption,
  CustomerAddress,
  CustomerListItem,
  VehicleListItem
} from "@mobile-mechanic/types";
import Link from "next/link";

import {
  Badge,
  Input,
  PriorityBadge,
  Select,
  buttonClassName,
  cx
} from "../../../../components/ui";
import {
  getVisitNextMove,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone
} from "../../../../lib/jobs/workflow";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";

type IntakeVehicle = VehicleListItem & {
  customerName: string;
};

type IntakeServiceSite = CustomerAddress & {
  customerName: string;
};

type NewJobWorkflowProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  customers: CustomerListItem[];
  defaultCustomerId: string;
  defaultVehicleId: string;
  entryMode: "estimate" | "job";
  followUpContext?: {
    sourceJobId: string;
    sourceTitle: string;
    sourceWorkflowLabel: string;
    vehicleDisplayName: string;
  } | null;
  initialCustomerConcern?: string;
  initialInternalSummary?: string;
  initialTitle?: string;
  preferredStartStep: number;
  serviceSites: IntakeServiceSite[];
  technicians: AssignableTechnicianOption[];
  vehicles: IntakeVehicle[];
};

const steps = [
  "Choose customer",
  "Choose vehicle",
  "Choose service site",
  "Capture concern",
  "Set schedule intent",
  "Assign and save"
] as const;

const estimateStepDescriptions = [
  "Lock the customer record this estimate belongs to.",
  "Choose the active vehicle tied to this estimate file.",
  "Lock the exact service location for this visit thread.",
  "Name the work and capture what the customer is experiencing.",
  "Optional for now. Scheduling can wait until the quote is built.",
  "Optional for now. Assignment can wait until pricing is complete."
] as const;

type ScheduleIntent = "later" | "specific_time" | "arrival_window";
type AssignmentIntent = "later" | "assign_now";

export function NewJobWorkflow({
  action,
  cancelHref,
  customers,
  defaultCustomerId,
  defaultVehicleId,
  entryMode,
  followUpContext,
  initialCustomerConcern = "",
  initialInternalSummary = "",
  initialTitle = "",
  preferredStartStep,
  serviceSites,
  technicians,
  vehicles
}: NewJobWorkflowProps) {
  const defaultCustomer = customers.find((customer) => customer.id === defaultCustomerId) ?? customers[0] ?? null;
  const defaultVehicle =
    vehicles.find((vehicle) => vehicle.id === defaultVehicleId) ??
    vehicles.find((vehicle) => vehicle.isActive && vehicle.customerId === defaultCustomer?.id) ??
    null;
  const filteredServiceSites = serviceSites.filter(
    (site) => site.isActive && site.customerId === (defaultCustomer?.id ?? "")
  );
  const defaultServiceSite =
    filteredServiceSites.find((site) => site.isPrimary) ?? filteredServiceSites[0] ?? null;
  const [activeStep, setActiveStep] = useState(() =>
    Math.max(0, Math.min(preferredStartStep, steps.length - 1))
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomer?.id ?? "");
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicle?.id ?? "");
  const [selectedServiceSiteId, setSelectedServiceSiteId] = useState(defaultServiceSite?.id ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [customerConcern, setCustomerConcern] = useState(initialCustomerConcern);
  const [description, setDescription] = useState("");
  const [internalSummary, setInternalSummary] = useState(initialInternalSummary);
  const [scheduleIntent, setScheduleIntent] = useState<ScheduleIntent>("later");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [arrivalWindowStartAt, setArrivalWindowStartAt] = useState("");
  const [arrivalWindowEndAt, setArrivalWindowEndAt] = useState("");
  const [assignmentIntent, setAssignmentIntent] = useState<AssignmentIntent>("later");
  const [assignedTechnicianUserId, setAssignedTechnicianUserId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [source, setSource] = useState("office");
  const progressRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredVehicles = vehicles.filter(
    (vehicle) => vehicle.isActive && vehicle.customerId === selectedCustomerId
  );
  const currentServiceSites = serviceSites.filter(
    (site) => site.isActive && site.customerId === selectedCustomerId
  );
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? defaultCustomer;
  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? filteredVehicles[0] ?? null;
  const selectedServiceSite =
    currentServiceSites.find((site) => site.id === selectedServiceSiteId) ??
    currentServiceSites.find((site) => site.isPrimary) ??
    currentServiceSites[0] ??
    null;
  const selectedTechnician =
    technicians.find((technician) => technician.userId === assignedTechnicianUserId) ?? null;
  const isEstimateFirstEntry = entryMode === "estimate";
  const activeStepLabel = steps[activeStep];
  const estimateRequiredFields = [
    {
      isReady: Boolean(selectedCustomerId),
      label: "Customer",
      value: selectedCustomer?.displayName ?? "Choose a customer"
    },
    {
      isReady: Boolean(selectedVehicleId),
      label: "Vehicle",
      value: selectedVehicle?.displayName ?? "Choose a vehicle"
    },
    {
      isReady: Boolean(selectedServiceSiteId),
      label: "Service site",
      value:
        [selectedServiceSite?.siteName, selectedServiceSite?.line1]
          .filter(Boolean)
          .join(" • ") || "Choose a service site"
    },
    {
      isReady: title.trim().length > 0,
      label: "Visit title",
      value: title || "Add a visit title"
    }
  ] as const;
  const estimateReadyCount = estimateRequiredFields.filter((field) => field.isReady).length;
  const previewJob = {
    arrivalWindowStartAt: scheduleIntent === "arrival_window" ? arrivalWindowStartAt || null : null,
    assignedTechnicianName:
      assignmentIntent === "assign_now" ? selectedTechnician?.displayName ?? null : null,
    assignedTechnicianUserId:
      assignmentIntent === "assign_now" ? assignedTechnicianUserId || null : null,
    isActive: true,
    scheduledStartAt: scheduleIntent === "specific_time" ? scheduledStartAt || null : null,
    status: "new" as const
  };
  const previewWorkflowState = getVisitWorkflowState(previewJob);
  const previewNextMove = getVisitNextMove(previewJob);

  useEffect(() => {
    if (!filteredVehicles.length) {
      setSelectedVehicleId("");
      return;
    }

    if (!filteredVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(filteredVehicles[0]?.id ?? "");
    }
  }, [filteredVehicles, selectedVehicleId]);

  useEffect(() => {
    if (!currentServiceSites.length) {
      setSelectedServiceSiteId("");
      return;
    }

    if (!currentServiceSites.some((site) => site.id === selectedServiceSiteId)) {
      const fallbackSite =
        currentServiceSites.find((site) => site.isPrimary) ?? currentServiceSites[0] ?? null;
      setSelectedServiceSiteId(fallbackSite?.id ?? "");
    }
  }, [currentServiceSites, selectedServiceSiteId]);

  useEffect(() => {
    const container = progressRef.current;
    const activeStepElement = stepRefs.current[activeStep];

    if (!container || !activeStepElement) {
      return;
    }

    const targetLeft = Math.max(
      activeStepElement.offsetLeft - (container.clientWidth - activeStepElement.clientWidth) / 2,
      0
    );

    container.scrollTo({
      behavior: "smooth",
      left: targetLeft
    });
  }, [activeStep]);

  function canOpenStep(index: number) {
    if (index <= activeStep) {
      return true;
    }

    for (let stepIndex = 0; stepIndex < index; stepIndex += 1) {
      if (!canContinue(stepIndex)) {
        return false;
      }
    }

    return true;
  }

  function canContinue(stepIndex: number) {
    switch (stepIndex) {
      case 0:
        return Boolean(selectedCustomerId);
      case 1:
        return Boolean(selectedVehicleId);
      case 2:
        return Boolean(selectedServiceSiteId);
      case 3:
        return title.trim().length > 0;
      case 4:
        if (scheduleIntent === "specific_time") {
          return Boolean(scheduledStartAt);
        }

        if (scheduleIntent === "arrival_window") {
          return Boolean(arrivalWindowStartAt);
        }

        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }

  function canCreateEstimateNow() {
      return Boolean(selectedCustomerId && selectedVehicleId && selectedServiceSiteId && title.trim().length > 0);
  }

  function getEstimateStepMeta(index: number) {
    if (index < activeStep) {
      return "Locked";
    }

    if (index === activeStep) {
      return index < 4 ? "Required now" : "Current";
    }

    if (index < 4) {
      return "Required";
    }

    return "Later";
  }

  return (
    <form action={action} className={cx("job-intake-flow", isEstimateFirstEntry && "job-intake-flow--estimate")}>
      <input name="isActive" type="hidden" value="on" />
      <input name="customerId" type="hidden" value={selectedCustomerId} />
      <input name="vehicleId" type="hidden" value={selectedVehicleId} />
      <input name="serviceSiteId" type="hidden" value={selectedServiceSiteId} />
      <input name="title" type="hidden" value={title} />
      <input name="customerConcern" type="hidden" value={customerConcern} />
      <input name="description" type="hidden" value={description} />
      <input name="internalSummary" type="hidden" value={internalSummary} />
      <input name="scheduleIntent" type="hidden" value={scheduleIntent} />
      <input name="scheduledStartAt" type="hidden" value={scheduledStartAt} />
      <input name="scheduledEndAt" type="hidden" value={scheduledEndAt} />
      <input name="arrivalWindowStartAt" type="hidden" value={arrivalWindowStartAt} />
      <input name="arrivalWindowEndAt" type="hidden" value={arrivalWindowEndAt} />
      <input name="assignmentIntent" type="hidden" value={assignmentIntent} />
      <input name="assignedTechnicianUserId" type="hidden" value={assignedTechnicianUserId} />
      <input name="priority" type="hidden" value={priority} />
      <input name="source" type="hidden" value={source} />
      <input name="followUpJobId" type="hidden" value={followUpContext?.sourceJobId ?? ""} />

      {isEstimateFirstEntry ? (
        <div className="job-intake-flow__command">
          <div className="job-intake-flow__command-copy">
            <p className="job-intake-flow__command-eyebrow">Workflow focus</p>
            <strong className="job-intake-flow__command-title">Build the estimate file before scheduling</strong>
            <p className="job-intake-flow__command-description">
              Lock the customer, vehicle, and concern first. Dispatch detail can wait until the quote is built.
            </p>
          </div>
          <div className="job-intake-flow__command-meta">
            <Badge tone="brand">{activeStepLabel}</Badge>
            <Badge tone={getVisitWorkflowTone(previewWorkflowState)}>{getVisitWorkflowLabel(previewWorkflowState)}</Badge>
          </div>
        </div>
      ) : null}

      <div className="job-intake-flow__progress" ref={progressRef}>
        {steps.map((step, index) => (
          <button
            className={cx(
              "job-intake-flow__step",
              activeStep === index && "job-intake-flow__step--active",
              index < activeStep && "job-intake-flow__step--complete"
            )}
            disabled={!canOpenStep(index)}
            key={step}
            onClick={() => setActiveStep(index)}
            ref={(element) => {
              stepRefs.current[index] = element;
            }}
            type="button"
          >
            <span className="job-intake-flow__step-index">{index + 1}</span>
            <span className="job-intake-flow__step-copy">{step}</span>
            {isEstimateFirstEntry ? (
              <span className="job-intake-flow__step-meta">{getEstimateStepMeta(index)}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="job-intake-flow__body">
        <section className="job-intake-flow__panel">
          <div className="job-intake-flow__header">
            <div className="job-intake-flow__header-copy">
              <p className="job-intake-flow__eyebrow">{isEstimateFirstEntry ? "Estimate intake" : `Step ${activeStep + 1}`}</p>
              <h2 className="job-intake-flow__title">{steps[activeStep]}</h2>
              {isEstimateFirstEntry ? (
                <p className="job-intake-flow__step-description">{estimateStepDescriptions[activeStep]}</p>
              ) : null}
            </div>
            <Badge tone={getVisitWorkflowTone(previewWorkflowState)}>
              {getVisitWorkflowLabel(previewWorkflowState)}
            </Badge>
          </div>

          {followUpContext ? (
            <div className="job-intake-flow__callout">
              <span className="job-intake-flow__callout-label">Return visit</span>
              <strong>{followUpContext.sourceTitle}</strong>
              <span>
                Continue the same {followUpContext.vehicleDisplayName} thread from{" "}
                {followUpContext.sourceWorkflowLabel.toLowerCase()}.
              </span>
            </div>
          ) : null}

          {activeStep === 0 ? (
            <div className="job-intake-flow__stage">
              <label className="job-intake-flow__field">
                <span>Customer</span>
                <Select
                  onChange={(event) => setSelectedCustomerId(event.currentTarget.value)}
                  value={selectedCustomerId}
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName}
                    </option>
                  ))}
                </Select>
              </label>

              {selectedCustomer ? (
                <div className="job-intake-flow__callout">
                  <span className="job-intake-flow__callout-label">Working customer</span>
                  <strong>{selectedCustomer.displayName}</strong>
                  <span>{filteredVehicles.length} active vehicle{filteredVehicles.length === 1 ? "" : "s"}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="job-intake-flow__stage">
              {filteredVehicles.length ? (
                <div className="job-intake-flow__choice-grid">
                  {filteredVehicles.map((vehicle) => (
                    <label
                      className={cx(
                        "job-intake-flow__choice",
                        selectedVehicle?.id === vehicle.id && "job-intake-flow__choice--active"
                      )}
                      key={vehicle.id}
                    >
                      <input
                        checked={selectedVehicle?.id === vehicle.id}
                        onChange={() => setSelectedVehicleId(vehicle.id)}
                        type="radio"
                      />
                      <strong>{vehicle.displayName}</strong>
                      <span>{vehicle.licensePlate ? `Plate ${vehicle.licensePlate}` : "No plate on file"}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="job-intake-flow__empty">
                  <p>No active vehicles are linked to this customer.</p>
                  <Link
                    className={buttonClassName({ size: "sm" })}
                    href={buildCustomerWorkspaceHref(selectedCustomerId, {
                      newVehicle: true,
                      tab: "vehicles"
                    })}
                  >
                    Add customer vehicle
                  </Link>
                </div>
              )}
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="job-intake-flow__stage">
              {currentServiceSites.length ? (
                <div className="job-intake-flow__choice-grid">
                  {currentServiceSites.map((site) => (
                    <label
                      className={cx(
                        "job-intake-flow__choice",
                        selectedServiceSite?.id === site.id && "job-intake-flow__choice--active"
                      )}
                      key={site.id}
                    >
                      <input
                        checked={selectedServiceSite?.id === site.id}
                        onChange={() => setSelectedServiceSiteId(site.id)}
                        type="radio"
                      />
                      <strong>{site.siteName || site.line1}</strong>
                      <span>
                        {[
                          [site.line1, site.line2].filter(Boolean).join(", "),
                          `${site.city}, ${site.state} ${site.postalCode}`
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="job-intake-flow__empty">
                  <p>No active service sites are linked to this customer.</p>
                  <Link
                    className={buttonClassName({ size: "sm" })}
                    href={buildCustomerWorkspaceHref(selectedCustomerId, {
                      newAddress: true,
                      tab: "addresses"
                    })}
                  >
                    Add service location
                  </Link>
                </div>
              )}
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="job-intake-flow__stage">
              <label className="job-intake-flow__field">
                <span>Visit title</span>
                <Input
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  placeholder="Brake inspection and front axle noise"
                  required
                  value={title}
                />
              </label>

              <label className="job-intake-flow__field">
                <span>Customer concern</span>
                <textarea
                  className="ui-textarea"
                  onChange={(event) => setCustomerConcern(event.currentTarget.value)}
                  placeholder="What is the customer seeing, hearing, or expecting?"
                  rows={4}
                  value={customerConcern}
                />
              </label>

              {isEstimateFirstEntry ? (
                <div className="job-intake-flow__callout">
                  <span className="job-intake-flow__callout-label">Builder handoff</span>
                  <strong>Create the visit and open the estimate now.</strong>
                  <span>Scheduling and technician assignment can wait until the quote is built.</span>
                </div>
              ) : null}

              <details className="job-intake-flow__details">
                <summary>Additional intake notes</summary>
                <div className="job-intake-flow__details-grid">
                  <label className="job-intake-flow__field">
                    <span>Internal summary</span>
                    <textarea
                      className="ui-textarea"
                      onChange={(event) => setInternalSummary(event.currentTarget.value)}
                      rows={3}
                      value={internalSummary}
                    />
                  </label>

                  <label className="job-intake-flow__field">
                    <span>Description</span>
                    <textarea
                      className="ui-textarea"
                      onChange={(event) => setDescription(event.currentTarget.value)}
                      rows={3}
                      value={description}
                    />
                  </label>
                </div>
              </details>
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="job-intake-flow__stage">
              <div className="job-intake-flow__choice-grid job-intake-flow__choice-grid--triple">
                <label
                  className={cx(
                    "job-intake-flow__choice",
                    scheduleIntent === "later" && "job-intake-flow__choice--active"
                  )}
                >
                  <input
                    checked={scheduleIntent === "later"}
                    onChange={() => setScheduleIntent("later")}
                    type="radio"
                  />
                  <strong>Later</strong>
                  <span>Keep this in intake or readiness until it is ready for a slot.</span>
                </label>

                <label
                  className={cx(
                    "job-intake-flow__choice",
                    scheduleIntent === "specific_time" && "job-intake-flow__choice--active"
                  )}
                >
                  <input
                    checked={scheduleIntent === "specific_time"}
                    onChange={() => setScheduleIntent("specific_time")}
                    type="radio"
                  />
                  <strong>Specific slot</strong>
                  <span>Set an exact working slot now.</span>
                </label>

                <label
                  className={cx(
                    "job-intake-flow__choice",
                    scheduleIntent === "arrival_window" && "job-intake-flow__choice--active"
                  )}
                >
                  <input
                    checked={scheduleIntent === "arrival_window"}
                    onChange={() => setScheduleIntent("arrival_window")}
                    type="radio"
                  />
                  <strong>Arrival window</strong>
                  <span>Capture the promised window without booking a hard slot.</span>
                </label>
              </div>

              {scheduleIntent === "specific_time" ? (
                <div className="job-intake-flow__field-row">
                  <label className="job-intake-flow__field">
                    <span>Scheduled start</span>
                    <Input
                      onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
                      type="datetime-local"
                      value={scheduledStartAt}
                    />
                  </label>
                  <label className="job-intake-flow__field">
                    <span>Scheduled end</span>
                    <Input
                      onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
                      type="datetime-local"
                      value={scheduledEndAt}
                    />
                  </label>
                </div>
              ) : null}

              {scheduleIntent === "arrival_window" ? (
                <div className="job-intake-flow__field-row">
                  <label className="job-intake-flow__field">
                    <span>Arrival window start</span>
                    <Input
                      onChange={(event) => setArrivalWindowStartAt(event.currentTarget.value)}
                      type="datetime-local"
                      value={arrivalWindowStartAt}
                    />
                  </label>
                  <label className="job-intake-flow__field">
                    <span>Arrival window end</span>
                    <Input
                      onChange={(event) => setArrivalWindowEndAt(event.currentTarget.value)}
                      type="datetime-local"
                      value={arrivalWindowEndAt}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === 5 ? (
            <div className="job-intake-flow__stage">
              <div className="job-intake-flow__choice-grid job-intake-flow__choice-grid--double">
                <label
                  className={cx(
                    "job-intake-flow__choice",
                    assignmentIntent === "later" && "job-intake-flow__choice--active"
                  )}
                >
                  <input
                    checked={assignmentIntent === "later"}
                    onChange={() => setAssignmentIntent("later")}
                    type="radio"
                  />
                  <strong>Assign later</strong>
                  <span>Leave this in the readiness queue for technician assignment.</span>
                </label>

                <label
                  className={cx(
                    "job-intake-flow__choice",
                    assignmentIntent === "assign_now" && "job-intake-flow__choice--active"
                  )}
                >
                  <input
                    checked={assignmentIntent === "assign_now"}
                    onChange={() => setAssignmentIntent("assign_now")}
                    type="radio"
                  />
                  <strong>Assign now</strong>
                  <span>Send it into a technician-owned readiness lane immediately.</span>
                </label>
              </div>

              {assignmentIntent === "assign_now" ? (
                <label className="job-intake-flow__field">
                  <span>Technician</span>
                  <Select
                    onChange={(event) => setAssignedTechnicianUserId(event.currentTarget.value)}
                    value={assignedTechnicianUserId}
                  >
                    <option value="">Choose technician</option>
                    {technicians.map((technician) => (
                      <option key={technician.userId} value={technician.userId}>
                        {technician.displayName}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}

              <div className="job-intake-flow__field-row">
                <label className="job-intake-flow__field">
                  <span>Priority</span>
                  <Select onChange={(event) => setPriority(event.currentTarget.value)} value={priority}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </label>
                <label className="job-intake-flow__field">
                  <span>Source</span>
                  <Select onChange={(event) => setSource(event.currentTarget.value)} value={source}>
                    <option value="office">Office</option>
                    <option value="phone">Phone</option>
                    <option value="web">Web</option>
                  </Select>
                </label>
              </div>

              <div className="job-intake-flow__result">
                <div className="job-intake-flow__result-header">
                  <div>
                    <span className="job-intake-flow__result-label">Next state</span>
                    <strong>{getVisitWorkflowLabel(previewWorkflowState)}</strong>
                  </div>
                  <PriorityBadge value={priority} />
                </div>
                <p className="job-intake-flow__result-copy">Next move: {previewNextMove}</p>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="job-intake-flow__summary">
          {isEstimateFirstEntry ? (
            <div className="job-intake-flow__summary-header">
              <div className="job-intake-flow__summary-header-copy">
                <p className="job-intake-flow__summary-label">Estimate file</p>
                <h3 className="job-intake-flow__summary-title">{title || "Concern pending"}</h3>
                <p className="job-intake-flow__summary-description">
                  This intake will open in the estimate builder as soon as the required details are locked.
                </p>
              </div>
              <Badge tone={getVisitWorkflowTone(previewWorkflowState)}>
                {getVisitWorkflowLabel(previewWorkflowState)}
              </Badge>
            </div>
          ) : null}
          {isEstimateFirstEntry ? (
            <>
              <div className="job-intake-flow__summary-status">
                <div className="job-intake-flow__summary-status-copy">
                  <p className="job-intake-flow__summary-label">Builder readiness</p>
                  <strong>
                    {estimateReadyCount}/4 required details locked
                  </strong>
                  <p className="job-intake-flow__summary-description">
                    {canCreateEstimateNow()
                      ? "The estimate builder can open immediately from this intake."
                      : "Lock customer, vehicle, service site, and visit title before the builder can open."}
                  </p>
                </div>
                <Badge tone={canCreateEstimateNow() ? "success" : "warning"}>
                  {canCreateEstimateNow() ? "Ready to build" : "Blocked"}
                </Badge>
              </div>

              <div className="job-intake-flow__summary-checklist">
                {estimateRequiredFields.map((field) => (
                  <div
                    className={cx(
                      "job-intake-flow__summary-checklist-item",
                      field.isReady && "job-intake-flow__summary-checklist-item--ready"
                    )}
                    key={field.label}
                  >
                    <span className="job-intake-flow__summary-checklist-indicator" />
                    <div className="job-intake-flow__summary-checklist-copy">
                      <span className="job-intake-flow__summary-label">{field.label}</span>
                      <strong>{field.value}</strong>
                    </div>
                    <span className="job-intake-flow__summary-checklist-state">
                      {field.isReady ? "Locked" : "Needed"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {!isEstimateFirstEntry ? (
            <>
              <div className="job-intake-flow__summary-block">
                <span className="job-intake-flow__summary-label">Customer</span>
                <strong>{selectedCustomer?.displayName ?? "Choose a customer"}</strong>
              </div>
              <div className="job-intake-flow__summary-block">
                <span className="job-intake-flow__summary-label">Vehicle</span>
                <strong>{selectedVehicle?.displayName ?? "Choose a vehicle"}</strong>
              </div>
              <div className="job-intake-flow__summary-block">
                <span className="job-intake-flow__summary-label">Service site</span>
                <strong>{selectedServiceSite?.siteName ?? selectedServiceSite?.line1 ?? "Choose a service site"}</strong>
              </div>
              <div className="job-intake-flow__summary-block">
                <span className="job-intake-flow__summary-label">Concern</span>
                <strong>{title || "Add a visit title"}</strong>
              </div>
            </>
          ) : null}
          <div className="job-intake-flow__summary-block">
            <span className="job-intake-flow__summary-label">Workflow landing</span>
            <Badge tone={getVisitWorkflowTone(previewWorkflowState)}>
              {getVisitWorkflowLabel(previewWorkflowState)}
            </Badge>
          </div>
          {isEstimateFirstEntry ? (
            <div className="job-intake-flow__summary-callout">
              <p className="job-intake-flow__summary-callout-label">Next move</p>
              <strong>{canCreateEstimateNow() ? "Create estimate now" : "Finish the intake fields first"}</strong>
              <p className="job-intake-flow__summary-callout-copy">
                {canCreateEstimateNow()
                  ? "The quote builder can open immediately from this intake."
                  : "Customer, vehicle, service site, and visit title are required before the builder can open."}
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="job-intake-flow__footer">
        <div className="job-intake-flow__footer-actions">
          {isEstimateFirstEntry ? (
            <p className="job-intake-flow__footer-note">
              Builder opens after customer, vehicle, service site, and visit title are locked.
            </p>
          ) : null}
          <Link className={buttonClassName({ tone: "tertiary" })} href={cancelHref}>
            Cancel
          </Link>
          {activeStep > 0 ? (
            <button
              className={buttonClassName({ tone: "secondary" })}
              onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
              type="button"
            >
              Back
            </button>
          ) : null}
          {activeStep < steps.length - 1 ? (
            <>
              {isEstimateFirstEntry && activeStep >= 2 ? (
                <button
                  className={buttonClassName()}
                  disabled={!canCreateEstimateNow()}
                  name="submitMode"
                  type="submit"
                  value="estimate"
                >
                  Create estimate now
                </button>
              ) : null}
              <button
                className={buttonClassName({
                  tone: isEstimateFirstEntry && activeStep >= 2 ? "secondary" : "primary"
                })}
                disabled={!canContinue(activeStep)}
                onClick={() => setActiveStep((current) => Math.min(current + 1, steps.length - 1))}
                type="button"
              >
                {isEstimateFirstEntry && activeStep >= 2 ? "Continue intake" : "Continue"}
              </button>
            </>
          ) : (
            <>
              {isEstimateFirstEntry ? (
                <button
                  className={buttonClassName()}
                  disabled={!canCreateEstimateNow()}
                  name="submitMode"
                  type="submit"
                  value="estimate"
                >
                  Create estimate now
                </button>
              ) : null}
              <button className={buttonClassName({ tone: "secondary" })} name="submitMode" type="submit" value="draft">
                Save draft
              </button>
              <button
                className={buttonClassName({ tone: isEstimateFirstEntry ? "tertiary" : "primary" })}
                name="submitMode"
                type="submit"
                value="ready"
              >
                Save ready
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
