import {
  getDispatchCalendarSettings,
  listAssignableTechniciansByCompany,
  listDispatchResourcePreferences
} from "@mobile-mechanic/api-client";
import { Badge, Callout, Page, PageHeader, buttonClassName } from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import {
  getDefaultDispatchCalendarSettingsInput,
  saveDispatchCalendarSettings,
  saveDispatchResourcePreference
} from "../../../../lib/dispatch/service";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DispatchCalendarSettingsForm } from "../_components/dispatch-calendar-settings-form";

type DispatchSettingsPageProps = {
  searchParams?: Promise<{
    feedback?: string | string[];
  }>;
};

const dispatchSettingsFeedback = {
  "lane-saved": {
    body: "The technician lane preference was updated.",
    title: "Lane preference saved",
    tone: "success"
  },
  "lane-save-failed": {
    body: "The technician lane preference could not be saved. Check the values and try again.",
    title: "Lane preference failed",
    tone: "danger"
  },
  "settings-saved": {
    body: "Dispatch calendar settings are updated for the whole company.",
    title: "Calendar settings saved",
    tone: "success"
  },
  "settings-save-failed": {
    body: "The calendar settings could not be saved. Check the entered values and try again.",
    title: "Calendar settings failed",
    tone: "danger"
  }
} as const;

function getFeedback(
  input: string | string[] | undefined
): (typeof dispatchSettingsFeedback)[keyof typeof dispatchSettingsFeedback] | null {
  const key = typeof input === "string" ? input : Array.isArray(input) ? input[0] : "";

  return key && key in dispatchSettingsFeedback
    ? dispatchSettingsFeedback[key as keyof typeof dispatchSettingsFeedback]
    : null;
}

function buildFeedbackHref(feedback: keyof typeof dispatchSettingsFeedback) {
  return `/dashboard/dispatch/settings?feedback=${feedback}`;
}

export default async function DispatchSettingsPage({
  searchParams
}: DispatchSettingsPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedback = getFeedback(resolvedSearchParams.feedback);
  const [settingsResult, techniciansResult, resourcePreferencesResult] = await Promise.all([
    getDispatchCalendarSettings(context.supabase, context.companyId),
    listAssignableTechniciansByCompany(context.supabase, context.companyId),
    listDispatchResourcePreferences(context.supabase, context.companyId)
  ]);

  if (techniciansResult.error || !techniciansResult.data) {
    throw techniciansResult.error ?? new Error("Assignable technicians could not be loaded.");
  }

  if (resourcePreferencesResult.error) {
    throw resourcePreferencesResult.error;
  }

  const settings =
    settingsResult.data ?? getDefaultDispatchCalendarSettingsInput(context);
  const formSettings = {
    dayEndHour: settings.dayEndHour,
    dayStartHour: settings.dayStartHour,
    defaultView: settings.defaultView,
    showSaturday: settings.showSaturday ?? false,
    showSunday: settings.showSunday ?? false,
    slotMinutes: settings.slotMinutes,
    weekStartsOn: settings.weekStartsOn
  };

  async function saveSettingsAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const requestedDefaultView = String(formData.get("defaultView") ?? "").trim();
    const result = await saveDispatchCalendarSettings(actionContext, {
      dayEndHour: Number(formData.get("dayEndHour") ?? 19),
      dayStartHour: Number(formData.get("dayStartHour") ?? 7),
      defaultView:
        requestedDefaultView === "week" || requestedDefaultView === "month"
          ? requestedDefaultView
          : "day",
      showSaturday: formData.get("showSaturday") === "1",
      showSunday: formData.get("showSunday") === "1",
      slotMinutes:
        formData.get("slotMinutes") === "15"
          ? 15
          : formData.get("slotMinutes") === "60"
            ? 60
            : 30,
      weekStartsOn: formData.get("weekStartsOn") === "0" ? 0 : 1
    });

    if (result.error) {
      redirect(buildFeedbackHref("settings-save-failed"));
    }

    revalidatePath("/dashboard/dispatch");
    revalidatePath("/dashboard/dispatch/settings");
    redirect(buildFeedbackHref("settings-saved"));
  }

  async function saveResourcePreferenceAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const technicianUserId = String(formData.get("technicianUserId") ?? "").trim();

    if (!technicianUserId) {
      redirect(buildFeedbackHref("lane-save-failed"));
    }

    const result = await saveDispatchResourcePreference(actionContext, {
      isVisibleByDefault: formData.get("isVisibleByDefault") === "1",
      laneColor: String(formData.get("laneColor") ?? "").trim() || null,
      laneOrder: Number(formData.get("laneOrder") ?? 0),
      technicianUserId
    });

    if (result.error) {
      redirect(buildFeedbackHref("lane-save-failed"));
    }

    revalidatePath("/dashboard/dispatch");
    revalidatePath("/dashboard/dispatch/settings");
    redirect(buildFeedbackHref("lane-saved"));
  }

  return (
    <Page>
      <PageHeader
        actions={
          <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/dispatch">
            Back to dispatch
          </Link>
        }
        description="Tune visible hours, lane order, and default technician presentation for the dispatch desk."
        eyebrow="Dispatch"
        status={<Badge tone="brand">{techniciansResult.data.length} workers</Badge>}
        title="Dispatch calendar settings"
      />

      {feedback ? (
        <Callout tone={feedback.tone} title={feedback.title}>
          {feedback.body}
        </Callout>
      ) : null}

      <DispatchCalendarSettingsForm
        resourcePreferences={resourcePreferencesResult.data ?? []}
        saveResourcePreferenceAction={saveResourcePreferenceAction}
        saveSettingsAction={saveSettingsAction}
        settings={formSettings}
        technicians={techniciansResult.data}
      />
    </Page>
  );
}
