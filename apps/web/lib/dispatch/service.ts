import {
  createDispatchSavedView,
  createTechnicianAvailabilityBlock,
  deleteDispatchSavedView,
  deleteTechnicianAvailabilityBlock,
  getDispatchCalendarSettings,
  getDispatchSavedViewById,
  listAssignableTechniciansByCompany,
  listDispatchCalendar,
  listDispatchResourcePreferences,
  listDispatchSavedViews,
  moveDispatchJob,
  quickEditDispatchJob,
  replaceDispatchSavedViewMembers,
  resizeDispatchJob,
  updateTechnicianAvailabilityBlock,
  updateDispatchSavedView,
  upsertDispatchCalendarSettings,
  upsertDispatchResourcePreference
} from "@mobile-mechanic/api-client";
import type {
  CreateDispatchSavedViewInput,
  CreateTechnicianAvailabilityBlockInput,
  DispatchCalendarConflict,
  DispatchCalendarQuery,
  MoveDispatchJobInput,
  QuickEditDispatchJobInput,
  ResizeDispatchJobInput,
  UpdateDispatchCalendarSettingsInput,
  UpdateDispatchSavedViewInput,
  UpdateTechnicianAvailabilityBlockInput
} from "@mobile-mechanic/types";
import { dispatchCalendarQuerySchema } from "@mobile-mechanic/validation";

import { requireCompanyContext } from "../company-context";
import { toServerError, unwrapServerResult } from "../server-error";

type CompanyContext = Awaited<ReturnType<typeof requireCompanyContext>>;

export function getDefaultDispatchCalendarSettingsInput(
  context: CompanyContext
): UpdateDispatchCalendarSettingsInput {
  return {
    companyId: context.companyId,
    weekStartsOn: 1,
    dayStartHour: 7,
    dayEndHour: 19,
    slotMinutes: 30,
    showSaturday: true,
    showSunday: false,
    defaultView: "day",
    updatedByUserId: context.currentUserId
  };
}

export async function getDispatchCommandCenter(
  context: CompanyContext,
  query: DispatchCalendarQuery
) {
  const parsedQuery = dispatchCalendarQuerySchema.parse(query);
  const settingsResult = await getDispatchCalendarSettings(context.supabase, context.companyId);
  const settings =
    settingsResult.data ??
    unwrapServerResult(
      await upsertDispatchCalendarSettings(
        context.supabase,
        getDefaultDispatchCalendarSettingsInput(context)
      ),
      "Dispatch calendar settings could not be created."
    );

  const [calendarResult, savedViewsResult, techniciansResult, resourcePreferencesResult] =
    await Promise.all([
      listDispatchCalendar(context.supabase, context.companyId, parsedQuery, settings),
      listDispatchSavedViews(context.supabase, context.companyId),
      listAssignableTechniciansByCompany(context.supabase, context.companyId),
      listDispatchResourcePreferences(context.supabase, context.companyId)
    ]);

  const calendar = unwrapServerResult(
    calendarResult,
    "Dispatch calendar could not be loaded."
  );

  if (savedViewsResult.error) {
    throw toServerError(savedViewsResult.error, "Dispatch saved views could not be loaded.");
  }

  const technicians = unwrapServerResult(
    techniciansResult,
    "Assignable technicians could not be loaded."
  );

  if (resourcePreferencesResult.error) {
    throw toServerError(
      resourcePreferencesResult.error,
      "Dispatch resource preferences could not be loaded."
    );
  }

  const selectedSavedView =
    parsedQuery.savedViewId && savedViewsResult.data
      ? savedViewsResult.data.find((view) => view.id === parsedQuery.savedViewId) ?? null
      : null;

  return {
    calendar: calendar.calendar,
    technicians,
    savedViews: savedViewsResult.data ?? [],
    resourcePreferences: resourcePreferencesResult.data ?? [],
    selectedSavedView,
    settings
  };
}

export async function saveDispatchCalendarSettings(
  context: CompanyContext,
  input: Omit<UpdateDispatchCalendarSettingsInput, "companyId" | "updatedByUserId">
) {
  return upsertDispatchCalendarSettings(context.supabase, {
    ...input,
    companyId: context.companyId,
    updatedByUserId: context.currentUserId
  });
}

export async function saveDispatchView(
  context: CompanyContext,
  input:
    | ({
        technicianUserIds: string[];
      } & CreateDispatchSavedViewInput)
    | ({
        savedViewId: string;
        technicianUserIds: string[];
      } & UpdateDispatchSavedViewInput)
) {
  if ("savedViewId" in input) {
    const updatedView = unwrapServerResult(
      await updateDispatchSavedView(
        context.supabase,
        context.companyId,
        input.savedViewId,
        input
      ),
      "Dispatch view could not be updated."
    );

    await replaceDispatchSavedViewMembers(context.supabase, {
      companyId: context.companyId,
      savedViewId: updatedView.id,
      technicianUserIds: input.technicianUserIds
    });

    return updatedView;
  }

  const createdView = unwrapServerResult(
    await createDispatchSavedView(context.supabase, {
      ...input,
      companyId: context.companyId,
      createdByUserId: context.currentUserId
    }),
    "Dispatch view could not be created."
  );

  await replaceDispatchSavedViewMembers(context.supabase, {
    companyId: context.companyId,
    savedViewId: createdView.id,
    technicianUserIds: input.technicianUserIds
  });

  return createdView;
}

export async function deleteSavedDispatchView(context: CompanyContext, savedViewId: string) {
  const result = await deleteDispatchSavedView(context.supabase, context.companyId, savedViewId);

  if (result.error) {
    throw toServerError(result.error, "Dispatch view could not be deleted.");
  }
}

export async function getDispatchSavedViewWorkspace(
  context: CompanyContext,
  savedViewId: string
) {
  const [savedViewResult, techniciansResult, resourcePreferencesResult] = await Promise.all([
    getDispatchSavedViewById(context.supabase, context.companyId, savedViewId),
    listAssignableTechniciansByCompany(context.supabase, context.companyId),
    listDispatchResourcePreferences(context.supabase, context.companyId)
  ]);

  const savedView = unwrapServerResult(
    savedViewResult,
    "Saved dispatch view could not be loaded."
  );

  const technicians = unwrapServerResult(
    techniciansResult,
    "Assignable technicians could not be loaded."
  );

  if (resourcePreferencesResult.error) {
    throw toServerError(
      resourcePreferencesResult.error,
      "Dispatch resource preferences could not be loaded."
    );
  }

  return {
    savedView,
    technicians,
    resourcePreferences: resourcePreferencesResult.data ?? []
  };
}

export async function saveDispatchResourcePreference(
  context: CompanyContext,
  input: {
    technicianUserId: string;
    laneOrder?: number | undefined;
    laneColor?: string | null | undefined;
    isVisibleByDefault?: boolean | undefined;
  }
) {
  return upsertDispatchResourcePreference(context.supabase, {
    ...input,
    companyId: context.companyId
  });
}

export async function moveDispatchCalendarJob(
  context: CompanyContext,
  input: MoveDispatchJobInput
) {
  return moveDispatchJob(context.supabase, context.companyId, input);
}

export async function resizeDispatchCalendarJob(
  context: CompanyContext,
  input: ResizeDispatchJobInput
) {
  return resizeDispatchJob(context.supabase, context.companyId, input);
}

export async function quickEditDispatchCalendarJob(
  context: CompanyContext,
  input: QuickEditDispatchJobInput
) {
  return quickEditDispatchJob(context.supabase, context.companyId, input);
}

export async function createDispatchAvailabilityBlock(
  context: CompanyContext,
  input: Omit<CreateTechnicianAvailabilityBlockInput, "companyId" | "createdByUserId">
) {
  return createTechnicianAvailabilityBlock(context.supabase, {
    ...input,
    companyId: context.companyId,
    createdByUserId: context.currentUserId
  });
}

export async function removeDispatchAvailabilityBlock(
  context: CompanyContext,
  blockId: string
) {
  return deleteTechnicianAvailabilityBlock(context.supabase, context.companyId, blockId);
}

export async function updateDispatchAvailabilityBlock(
  context: CompanyContext,
  blockId: string,
  input: UpdateTechnicianAvailabilityBlockInput
) {
  return updateTechnicianAvailabilityBlock(
    context.supabase,
    context.companyId,
    blockId,
    input
  );
}

export function getDispatchConflictSummary(conflicts: DispatchCalendarConflict[]) {
  return {
    total: conflicts.length,
    dangerCount: conflicts.filter((conflict) => conflict.severity === "danger").length,
    warningCount: conflicts.filter((conflict) => conflict.severity === "warning").length
  };
}
