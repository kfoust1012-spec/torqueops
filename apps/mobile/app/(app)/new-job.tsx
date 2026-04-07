import type { JobPriority } from "@mobile-mechanic/types";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import {
  ActionTile,
  Badge,
  Button,
  Chip,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard,
  StickyActionDock
} from "../../src/components/ui";
import {
  createMobileOwnerJobWorkflow,
  loadMobileOwnerIntakeOptions,
  type MobileOwnerIntakeOptions
} from "../../src/features/intake/api";
import { formatErrorMessage } from "../../src/lib/error-formatting";
import { useSessionContext } from "../../src/providers/session-provider";
import { canCreateJobsFromMobile } from "../../src/lib/mobile-capabilities";
import { mobileTheme } from "../../src/theme";

type IntakeStep = 1 | 2 | 3;
type RecordMode = "existing" | "new";
type AssignmentMode = "self" | "technician" | "unassigned";
type ScheduleMode = "now" | "later";
type IntakeErrorSource = "load" | "submit" | "validation" | null;

const priorityOptions: JobPriority[] = ["normal", "urgent", "high", "low"];
const usZipCodePattern = /^\d{5}(?:-\d{4})?$/;

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatServiceSiteLabel(site: MobileOwnerIntakeOptions["serviceSites"][number]) {
  return site.siteName?.trim() || `${site.line1}, ${site.city}`;
}

function parseVehicleDisplayName(displayName: string) {
  const trimmed = displayName.trim();
  const yearMatch = trimmed.match(/^(\d{4})\s+(.+)$/);

  if (!yearMatch) {
    return {
      make: "",
      model: trimmed,
      year: ""
    };
  }

  const [, year = "", remainder = ""] = yearMatch;
  const [make = "", ...modelParts] = remainder.trim().split(/\s+/);

  return {
    make,
    model: modelParts.join(" "),
    year
  };
}

export default function NewJobScreen() {
  const router = useRouter();
  const { appContext } = useSessionContext();
  const [options, setOptions] = useState<MobileOwnerIntakeOptions | null>(null);
  const [activeStep, setActiveStep] = useState<IntakeStep>(1);
  const [customerMode, setCustomerMode] = useState<RecordMode>("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [vehicleMode, setVehicleMode] = useState<RecordMode>("existing");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePlateState, setVehiclePlateState] = useState("");
  const [serviceSiteMode, setServiceSiteMode] = useState<RecordMode>("existing");
  const [selectedServiceSiteId, setSelectedServiceSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteLine1, setSiteLine1] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [siteState, setSiteState] = useState("");
  const [sitePostalCode, setSitePostalCode] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [customerConcern, setCustomerConcern] = useState("");
  const [internalSummary, setInternalSummary] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("self");
  const [selectedTechnicianUserId, setSelectedTechnicianUserId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("now");
  const [scheduledStartAtInput, setScheduledStartAtInput] = useState(toLocalDateTimeInputValue(new Date()));
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<IntakeErrorSource>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!appContext) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setErrorSource(null);

      try {
        const result = await loadMobileOwnerIntakeOptions(appContext.companyId);

        if (!isMounted) {
          return;
        }

        setOptions(result);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(formatErrorMessage(error, "Owner intake could not load."));
        setErrorSource("load");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [appContext]);

  const canCreateJobs = appContext ? canCreateJobsFromMobile(appContext.membership.role) : false;
  const filteredCustomers = options?.customers.filter((customer) => {
    if (!customerSearch.trim()) {
      return true;
    }

    const search = customerSearch.trim().toLowerCase();
    return (
      customer.displayName.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search)
    );
  }).slice(0, 6) ?? [];
  const selectedCustomer =
    customerMode === "existing"
      ? options?.customers.find((customer) => customer.id === selectedCustomerId) ?? null
      : null;
  const customerVehicles =
    selectedCustomerId && options
      ? options.vehicles.filter((vehicle) => vehicle.customerId === selectedCustomerId)
      : [];
  const customerServiceSites =
    selectedCustomerId && options
      ? options.serviceSites.filter((site) => site.customerId === selectedCustomerId)
      : [];
  const selectedCustomerOption =
    selectedCustomerId && options
      ? options.customers.find((customer) => customer.id === selectedCustomerId) ?? null
      : null;
  const selectedVehicleOption =
    selectedVehicleId && options
      ? options.vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null
      : null;
  const selectedServiceSiteOption =
    selectedServiceSiteId && options
      ? options.serviceSites.find((site) => site.id === selectedServiceSiteId) ?? null
      : null;

  useEffect(() => {
    if (customerMode === "new") {
      if (selectedCustomerOption) {
        const [firstName = "", ...lastNameParts] = selectedCustomerOption.displayName.trim().split(/\s+/);

        if (!customerFirstName.trim()) {
          setCustomerFirstName(firstName);
        }

        if (!customerLastName.trim()) {
          setCustomerLastName(lastNameParts.join(" "));
        }

        if (!customerPhone.trim()) {
          setCustomerPhone(selectedCustomerOption.phone ?? "");
        }

        if (!customerEmail.trim()) {
          setCustomerEmail(selectedCustomerOption.email ?? "");
        }
      }

      if (selectedVehicleOption) {
        const parsedVehicle = parseVehicleDisplayName(selectedVehicleOption.displayName);

        if (!vehicleYear.trim()) {
          setVehicleYear(parsedVehicle.year ?? "");
        }

        if (!vehicleMake.trim()) {
          setVehicleMake(parsedVehicle.make);
        }

        if (!vehicleModel.trim()) {
          setVehicleModel(parsedVehicle.model);
        }

        if (!vehiclePlate.trim()) {
          setVehiclePlate(selectedVehicleOption.licensePlate ?? "");
        }

        if (!vehiclePlateState.trim()) {
          setVehiclePlateState(selectedVehicleOption.licenseState ?? "");
        }
      }

      if (selectedServiceSiteOption) {
        if (!siteName.trim()) {
          setSiteName(selectedServiceSiteOption.siteName ?? "");
        }

        if (!siteLine1.trim()) {
          setSiteLine1(selectedServiceSiteOption.line1);
        }

        if (!siteCity.trim()) {
          setSiteCity(selectedServiceSiteOption.city);
        }

        if (!siteState.trim()) {
          setSiteState(selectedServiceSiteOption.state);
        }

        if (!sitePostalCode.trim()) {
          setSitePostalCode(selectedServiceSiteOption.postalCode);
        }
      }

      setSelectedCustomerId(null);
      setVehicleMode("new");
      setSelectedVehicleId(null);
      setServiceSiteMode("new");
      setSelectedServiceSiteId(null);
      return;
    }

    if (!selectedCustomerId) {
      setVehicleMode("new");
      setSelectedVehicleId(null);
      setServiceSiteMode("new");
      setSelectedServiceSiteId(null);
      return;
    }

    if (!customerVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(null);
      setVehicleMode(customerVehicles.length ? "existing" : "new");
    }

    if (!customerServiceSites.some((site) => site.id === selectedServiceSiteId)) {
      setSelectedServiceSiteId(null);
      setServiceSiteMode(customerServiceSites.length ? "existing" : "new");
    }
  }, [
    customerEmail,
    customerFirstName,
    customerLastName,
    customerMode,
    customerPhone,
    customerServiceSites,
    customerVehicles,
    selectedCustomerOption,
    selectedCustomerId,
    selectedServiceSiteOption,
    selectedServiceSiteId,
    selectedVehicleId,
    selectedVehicleOption,
    siteCity,
    siteLine1,
    siteName,
    sitePostalCode,
    siteState,
    vehicleMake,
    vehicleModel,
    vehiclePlate,
    vehiclePlateState,
    vehicleYear
  ]);

  function validateStep(step: IntakeStep) {
    if (step === 1) {
      if (customerMode === "existing" && !selectedCustomerId) {
        return "Select an existing customer or switch to new customer.";
      }

      if (customerMode === "new" && (!customerFirstName.trim() || !customerLastName.trim())) {
        return "First and last name are required for a new customer.";
      }

      if (vehicleMode === "existing" && !selectedVehicleId) {
        return "Select a vehicle or switch to add vehicle.";
      }

      if (vehicleMode === "new" && (!vehicleMake.trim() || !vehicleModel.trim())) {
        return "Vehicle make and model are required.";
      }
    }

    if (step === 2) {
      if (serviceSiteMode === "existing" && !selectedServiceSiteId) {
        return "Select a service location or switch to new location.";
      }

      if (
        serviceSiteMode === "new" &&
        (!siteLine1.trim() || !siteCity.trim() || !siteState.trim() || !sitePostalCode.trim())
      ) {
        return "Street, city, state, and ZIP are required for the service location.";
      }

      if (serviceSiteMode === "new" && sitePostalCode.trim() && !usZipCodePattern.test(sitePostalCode.trim())) {
        return "ZIP must be a valid US ZIP or ZIP+4.";
      }

      if (jobTitle.trim().length < 3) {
        return "Give the job a short title the field team can recognize fast.";
      }
    }

    if (step === 3) {
      if (assignmentMode === "technician" && !selectedTechnicianUserId) {
        return "Choose which field user should own this stop.";
      }

      if (scheduleMode === "later" && !scheduledStartAtInput.trim()) {
        return "Pick a scheduled start time or switch to start now.";
      }
    }

    return null;
  }

  useEffect(() => {
    if (!errorMessage || errorSource !== "validation") {
      return;
    }

    const nextError = validateStep(activeStep);

    if (!nextError) {
      setErrorMessage(null);
      setErrorSource(null);
      return;
    }

    if (nextError !== errorMessage) {
      setErrorMessage(nextError);
    }
  }, [
    activeStep,
    assignmentMode,
    customerConcern,
    customerEmail,
    customerFirstName,
    customerLastName,
    customerMode,
    customerPhone,
    errorMessage,
    errorSource,
    jobTitle,
    scheduleMode,
    scheduledStartAtInput,
    selectedCustomerId,
    selectedServiceSiteId,
    selectedTechnicianUserId,
    selectedVehicleId,
    serviceSiteMode,
    siteCity,
    siteLine1,
    sitePostalCode,
    siteState,
    vehicleMake,
    vehicleMode,
    vehicleModel
  ]);

  const visibleErrorMessage = errorSource === "validation" ? validateStep(activeStep) : errorMessage;

  function handleContinue() {
    const nextError = validateStep(activeStep);

    if (nextError) {
      setErrorMessage(nextError);
      setErrorSource("validation");
      return;
    }

    setErrorMessage(null);
    setErrorSource(null);

    if (activeStep < 3) {
      setActiveStep((activeStep + 1) as IntakeStep);
    }
  }

  function handleStepTwoFastPath() {
    const nextError = validateStep(2);

    if (nextError) {
      setErrorMessage(nextError);
      setErrorSource("validation");
      return;
    }

    if (assignmentMode === "self" && scheduleMode === "now") {
      void handleCreateJob();
      return;
    }

    setErrorMessage(null);
    setErrorSource(null);
    setActiveStep(3);
  }

  async function handleCreateJob() {
    if (!appContext) {
      return;
    }

    const nextError = validateStep(3);

    if (nextError) {
      setErrorMessage(nextError);
      setErrorSource("validation");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorSource(null);
    setSuccessMessage(null);

    try {
      const result = await createMobileOwnerJobWorkflow(appContext, {
        assignmentMode,
        assignedTechnicianUserId: selectedTechnicianUserId,
        existingCustomerId: customerMode === "existing" ? selectedCustomerId : null,
        existingServiceSiteId: serviceSiteMode === "existing" ? selectedServiceSiteId : null,
        existingVehicleId: vehicleMode === "existing" ? selectedVehicleId : null,
        job: {
          customerConcern,
          internalSummary,
          priority,
          scheduledStartAt: scheduleMode === "later" ? scheduledStartAtInput : toLocalDateTimeInputValue(new Date()),
          title: jobTitle
        },
        newCustomer:
          customerMode === "new"
            ? {
                email: customerEmail,
                firstName: customerFirstName,
                lastName: customerLastName,
                phone: customerPhone
              }
            : null,
        newServiceSite:
          serviceSiteMode === "new"
            ? {
                city: siteCity,
                line1: siteLine1,
                postalCode: sitePostalCode,
                siteName,
                state: siteState
              }
            : null,
        newVehicle:
          vehicleMode === "new"
            ? {
                licensePlate: vehiclePlate,
                licenseState: vehiclePlateState,
                make: vehicleMake,
                model: vehicleModel,
                year: vehicleYear.trim() ? Number(vehicleYear) : null
              }
            : null
      });

      if (result.assignedToCurrentUser) {
        router.replace(`/jobs/${result.job.id}` as never);
        return;
      }

      setSuccessMessage(`${result.job.title} is created and ready for the assigned queue.`);
      setActiveStep(1);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error, "Job intake failed."));
      setErrorSource("submit");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!appContext) {
    return <LoadingState body="Loading mobile workspace..." title="Loading" />;
  }

  if (!canCreateJobs) {
    return (
      <Screen>
        <ErrorState
          actions={
            <Button onPress={() => router.replace("/home" as never)} tone="secondary">
              Back to Today
            </Button>
          }
          body="This mobile account can run field work, but it cannot create new jobs. Sign in with an owner or admin membership to use mobile intake."
          eyebrow="Owner intake"
          title="Job creation is not available"
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <LoadingState body="Loading customer, vehicle, and assignment options for mobile intake." title="Loading new job" />;
  }

  if (!options) {
    return (
      <Screen>
        <ErrorState
          actions={
            <Button onPress={() => router.replace("/home" as never)} tone="secondary">
              Back to Today
            </Button>
          }
          body={errorMessage ?? "Mobile intake could not load."}
          eyebrow="Owner intake"
          title="New job is unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScrollView
        contentContainerStyle={{ paddingBottom: 168 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          actions={
            <Button fullWidth={false} onPress={() => router.replace("/home" as never)} tone="secondary">
              Back to Today
            </Button>
          }
          badges={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Badge tone="info">Owner intake</Badge>
              <Badge tone="success">Fast path to stop console</Badge>
            </View>
          }
          description="Build the customer, asset, location, and first assignment in one mobile pass. When you assign it to yourself, the app should drop straight into the stop."
          eyebrow="New job"
          title="Open a stop from the field"
        />

        <SectionCard
          description="Keep the intake moving in three passes instead of one long admin form."
          eyebrow="Workflow"
          title="Create in order"
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip onPress={() => setActiveStep(1)} selected={activeStep === 1} tone="brand">
              1. Customer + vehicle
            </Chip>
            <Chip onPress={() => setActiveStep(2)} selected={activeStep === 2} tone="brand">
              2. Location + issue
            </Chip>
            <Chip onPress={() => setActiveStep(3)} selected={activeStep === 3} tone="brand">
              3. Assign + start
            </Chip>
          </View>
        </SectionCard>

        {visibleErrorMessage ? <Notice body={visibleErrorMessage} title="Fix before moving on" tone="danger" /> : null}
        {successMessage ? <Notice body={successMessage} title="Job created" tone="success" /> : null}

        {activeStep === 1 ? (
          <SectionCard
            description="Pick an existing customer when possible. If this is a fresh call, capture only the minimum needed to create the record and move on."
            eyebrow="Step 1"
            title="Customer and vehicle"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip onPress={() => setCustomerMode("existing")} selected={customerMode === "existing"} tone="info">
                Use existing customer
              </Chip>
              <Chip onPress={() => setCustomerMode("new")} selected={customerMode === "new"} tone="brand">
                New customer
              </Chip>
            </View>

            {customerMode === "existing" ? (
              <View style={{ gap: 12 }}>
                <Field hint="Search by customer name, phone, or email." label="Find customer">
                  <Input onChangeText={setCustomerSearch} placeholder="Search customer" value={customerSearch} />
                </Field>
                <View style={{ gap: 12 }}>
                  {filteredCustomers.map((customer) => (
                    <ActionTile
                      key={customer.id}
                      badge={selectedCustomerId === customer.id ? <Badge tone="success">Selected</Badge> : undefined}
                      description={[
                        customer.phone ?? "No phone",
                        customer.email ?? "No email"
                      ].join(" · ")}
                      eyebrow={customer.relationshipType === "fleet_account" ? "Fleet account" : "Retail customer"}
                      onPress={() => {
                        setSelectedCustomerId(customer.id);
                        setCustomerFirstName("");
                        setCustomerLastName("");
                        setCustomerPhone(customer.phone ?? "");
                        setCustomerEmail(customer.email ?? "");
                      }}
                      title={customer.displayName}
                      titleNumberOfLines={2}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Field label="First name">
                  <Input onChangeText={setCustomerFirstName} placeholder="Avery" value={customerFirstName} />
                </Field>
                <Field label="Last name">
                  <Input onChangeText={setCustomerLastName} placeholder="Cole" value={customerLastName} />
                </Field>
                <Field label="Phone">
                  <Input keyboardType="phone-pad" onChangeText={setCustomerPhone} placeholder="555-555-5555" value={customerPhone} />
                </Field>
                <Field label="Email">
                  <Input autoCapitalize="none" keyboardType="email-address" onChangeText={setCustomerEmail} placeholder="customer@example.com" value={customerEmail} />
                </Field>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: mobileTheme.colors.text.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase"
                }}
              >
                Vehicle
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {customerVehicles.length ? (
                  <Chip onPress={() => setVehicleMode("existing")} selected={vehicleMode === "existing"} tone="info">
                    Use existing vehicle
                  </Chip>
                ) : null}
                <Chip onPress={() => setVehicleMode("new")} selected={vehicleMode === "new"} tone="brand">
                  Add vehicle
                </Chip>
              </View>
            </View>

            {vehicleMode === "existing" && customerVehicles.length ? (
              <View style={{ gap: 12 }}>
                {customerVehicles.map((vehicle) => (
                  <ActionTile
                    key={vehicle.id}
                    badge={selectedVehicleId === vehicle.id ? <Badge tone="success">Selected</Badge> : undefined}
                    description={[
                      vehicle.vin ?? "No VIN",
                      vehicle.licensePlate ? `${vehicle.licensePlate}${vehicle.licenseState ? ` ${vehicle.licenseState}` : ""}` : "No plate"
                    ].join(" · ")}
                    eyebrow="Customer vehicle"
                    onPress={() => setSelectedVehicleId(vehicle.id)}
                    title={vehicle.displayName}
                    titleNumberOfLines={2}
                  />
                ))}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Field label="Year">
                  <Input keyboardType="number-pad" onChangeText={setVehicleYear} placeholder="2018" value={vehicleYear} />
                </Field>
                <Field label="Make">
                  <Input onChangeText={setVehicleMake} placeholder="Ford" value={vehicleMake} />
                </Field>
                <Field label="Model">
                  <Input onChangeText={setVehicleModel} placeholder="Transit Connect" value={vehicleModel} />
                </Field>
                <Field label="Plate">
                  <Input autoCapitalize="characters" onChangeText={setVehiclePlate} placeholder="ABC1234" value={vehiclePlate} />
                </Field>
                <Field label="Plate state">
                  <Input autoCapitalize="characters" onChangeText={setVehiclePlateState} placeholder="TX" value={vehiclePlateState} />
                </Field>
              </View>
            )}
          </SectionCard>
        ) : null}

        {activeStep === 2 ? (
          <SectionCard
            description="Capture where the work happens and what the stop is for. This is the minimum case file the field workflow needs."
            eyebrow="Step 2"
            title="Location and issue"
          >
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: mobileTheme.colors.text.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase"
                }}
              >
                Service location
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {customerServiceSites.length ? (
                  <Chip onPress={() => setServiceSiteMode("existing")} selected={serviceSiteMode === "existing"} tone="info">
                    Use saved location
                  </Chip>
                ) : null}
                <Chip onPress={() => setServiceSiteMode("new")} selected={serviceSiteMode === "new"} tone="brand">
                  New location
                </Chip>
              </View>
            </View>

            {serviceSiteMode === "existing" && customerServiceSites.length ? (
              <View style={{ gap: 12 }}>
                {customerServiceSites.map((site) => (
                  <ActionTile
                    key={site.id}
                    badge={selectedServiceSiteId === site.id ? <Badge tone="success">Selected</Badge> : undefined}
                    description={`${site.line1}, ${site.city}, ${site.state} ${site.postalCode}`}
                    eyebrow={site.label}
                    onPress={() => setSelectedServiceSiteId(site.id)}
                    title={formatServiceSiteLabel(site)}
                    titleNumberOfLines={2}
                  />
                ))}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Field hint="Optional label for apartments, fleets, or named sites." label="Site name">
                  <Input onChangeText={setSiteName} placeholder="Customer driveway" value={siteName} />
                </Field>
                <Field label="Street address">
                  <Input onChangeText={setSiteLine1} placeholder="123 Main St" value={siteLine1} />
                </Field>
                <Field label="City">
                  <Input onChangeText={setSiteCity} placeholder="Dallas" value={siteCity} />
                </Field>
                <Field label="State">
                  <Input autoCapitalize="characters" onChangeText={setSiteState} placeholder="TX" value={siteState} />
                </Field>
                <Field label="ZIP">
                  <Input keyboardType="number-pad" onChangeText={setSitePostalCode} placeholder="75001" value={sitePostalCode} />
                </Field>
              </View>
            )}

            <Field hint="Keep it short and scannable for the queue." label="Job title">
              <Input onChangeText={setJobTitle} placeholder="Brake vibration diagnosis" value={jobTitle} />
            </Field>
            <Field hint="What the customer says is wrong." label="Customer concern">
              <Input multiline onChangeText={setCustomerConcern} placeholder="Vehicle shakes under braking at highway speed." value={customerConcern} />
            </Field>
            <Field hint="Optional internal context for the field thread." label="Internal summary">
              <Input multiline onChangeText={setInternalSummary} placeholder="Seeded from phone intake while owner is in the field." value={internalSummary} />
            </Field>
          </SectionCard>
        ) : null}

        {activeStep === 3 ? (
          <SectionCard
            description="Choose who owns the stop and whether it starts now or later. The fastest path is assign to yourself and open the stop."
            eyebrow="Step 3"
            title="Assign and start"
          >
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: mobileTheme.colors.text.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase"
                }}
              >
                Ownership
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Chip onPress={() => setAssignmentMode("self")} selected={assignmentMode === "self"} tone="success">
                  Assign to me
                </Chip>
                <Chip onPress={() => setAssignmentMode("technician")} selected={assignmentMode === "technician"} tone="info">
                  Assign another field user
                </Chip>
                <Chip onPress={() => setAssignmentMode("unassigned")} selected={assignmentMode === "unassigned"} tone="warning">
                  Leave unassigned
                </Chip>
              </View>
            </View>

            {assignmentMode === "technician" ? (
              <View style={{ gap: 12 }}>
                {options.technicians.map((technician) => (
                  <ActionTile
                    key={technician.userId}
                    badge={selectedTechnicianUserId === technician.userId ? <Badge tone="success">Selected</Badge> : undefined}
                    description={technician.email ?? `${technician.role} field account`}
                    eyebrow={technician.role}
                    onPress={() => setSelectedTechnicianUserId(technician.userId)}
                    title={technician.displayName}
                    titleNumberOfLines={2}
                  />
                ))}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: mobileTheme.colors.text.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase"
                }}
              >
                Timing
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Chip onPress={() => setScheduleMode("now")} selected={scheduleMode === "now"} tone="success">
                  Start now
                </Chip>
                <Chip onPress={() => setScheduleMode("later")} selected={scheduleMode === "later"} tone="brand">
                  Schedule later
                </Chip>
              </View>
            </View>

            {scheduleMode === "later" ? (
              <Field hint="Use local date and time for the stop start." label="Scheduled start">
                <Input onChangeText={setScheduledStartAtInput} placeholder="2026-04-06T14:30" value={scheduledStartAtInput} />
              </Field>
            ) : (
              <Notice
                body="The new stop will be created with a start time of right now so you can open it immediately from the phone."
                title="Immediate start"
                tone="brand"
              />
            )}

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: mobileTheme.colors.text.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase"
                }}
              >
                Priority
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {priorityOptions.map((option) => (
                  <Chip
                    key={option}
                    onPress={() => setPriority(option)}
                    selected={priority === option}
                    tone={option === "urgent" ? "warning" : option === "high" ? "info" : "neutral"}
                  >
                    {option}
                  </Chip>
                ))}
              </View>
            </View>
          </SectionCard>
        ) : null}

      </ScreenScrollView>

      <StickyActionDock>
        <View style={{ gap: 10 }}>
          {activeStep > 1 ? (
            <Button onPress={() => setActiveStep((activeStep - 1) as IntakeStep)} tone="secondary">
              Back
            </Button>
          ) : null}
          {activeStep < 2 ? (
            <Button onPress={handleContinue}>Continue</Button>
          ) : activeStep === 2 ? (
            <Button loading={isSubmitting} onPress={handleStepTwoFastPath}>
              {assignmentMode === "self" && scheduleMode === "now" ? "Assign to me and open stop" : "Continue"}
            </Button>
          ) : (
            <Button loading={isSubmitting} onPress={() => void handleCreateJob()}>
              Create job
            </Button>
          )}
        </View>
      </StickyActionDock>
    </Screen>
  );
}
