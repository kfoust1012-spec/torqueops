import type {
  AssignableTechnicianOption,
  DispatchCalendarQuery,
  DispatchResourcePreference,
  DispatchSavedViewMember
} from "@mobile-mechanic/types";

function sortByDisplayName(left: AssignableTechnicianOption, right: AssignableTechnicianOption) {
  return left.displayName.localeCompare(right.displayName);
}

export function resolveDispatchResourcesForScope(input: {
  query: DispatchCalendarQuery;
  savedViewMembers?: DispatchSavedViewMember[] | null | undefined;
  technicians: AssignableTechnicianOption[];
  preferences?: DispatchResourcePreference[] | null | undefined;
}) {
  const techniciansById = new Map(input.technicians.map((technician) => [technician.userId, technician]));
  const preferencesByUserId = new Map(
    (input.preferences ?? []).map((preference) => [preference.technicianUserId, preference])
  );
  const visibleDefaults = input.technicians.filter((technician) => {
    const preference = preferencesByUserId.get(technician.userId);
    return preference?.isVisibleByDefault ?? true;
  });
  const allTechnicians = [...input.technicians];

  let selected = input.query.scope === "all_workers" ? allTechnicians : visibleDefaults;

  if (input.query.scope === "single_tech" && input.query.resourceUserIds?.[0]) {
    const technician = techniciansById.get(input.query.resourceUserIds[0]);
    selected = technician ? [technician] : [];
  } else if (input.query.scope === "single_tech") {
    const fallbackTechnicianId = input.savedViewMembers?.[0]?.technicianUserId;
    const technician = fallbackTechnicianId ? techniciansById.get(fallbackTechnicianId) : null;
    selected = technician ? [technician] : [];
  } else if (input.query.scope === "subset") {
    const selectedIds =
      input.query.resourceUserIds?.length
        ? input.query.resourceUserIds
        : (input.savedViewMembers ?? []).map((member) => member.technicianUserId);
    selected = selectedIds
      .map((userId) => techniciansById.get(userId))
      .filter((technician): technician is AssignableTechnicianOption => Boolean(technician));
  }

  return [...selected].sort((left, right) => {
    const leftOrder = preferencesByUserId.get(left.userId)?.laneOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      preferencesByUserId.get(right.userId)?.laneOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return sortByDisplayName(left, right);
  });
}
