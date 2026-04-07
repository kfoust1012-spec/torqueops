export type DispatchThreadBoardContext = {
  dayDate: string | null;
  resourceTechnicianUserId: string | null;
  visitId: string;
} | null;

export function getDispatchThreadBoardRelation(input: {
  context: DispatchThreadBoardContext;
  dayDate?: string | null;
  resourceTechnicianUserId?: string | null;
  visitId: string;
}) {
  const context = input.context;

  if (!context?.visitId) {
    return {
      hasContext: false,
      isDimmed: false,
      isNeighbor: false,
      isSelected: false,
      matchesDay: false,
      matchesLane: false
    };
  }

  const isSelected = context.visitId === input.visitId;
  const matchesLane = Boolean(
    context.resourceTechnicianUserId &&
      input.resourceTechnicianUserId &&
      context.resourceTechnicianUserId === input.resourceTechnicianUserId
  );
  const matchesDay = Boolean(context.dayDate && input.dayDate && context.dayDate === input.dayDate);
  const isNeighbor =
    !isSelected &&
    ((matchesLane && matchesDay) ||
      (matchesLane && !context.dayDate) ||
      (!context.resourceTechnicianUserId && matchesDay));
  const canDim =
    Boolean(context.resourceTechnicianUserId || context.dayDate);
  const isDimmed = canDim && !isSelected && !isNeighbor;

  return {
    hasContext: true,
    isDimmed,
    isNeighbor,
    isSelected,
    matchesDay,
    matchesLane
  };
}

export function getDispatchThreadLaneActionRelation(input: {
  context: DispatchThreadBoardContext;
  dayDate?: string | null;
  orderedResourceTechnicianUserIds: string[];
  resourceTechnicianUserId: string;
}) {
  const context = input.context;

  if (!context?.resourceTechnicianUserId) {
    return {
      hasContext: false,
      isAdjacentLane: false,
      isCurrentLane: false
    };
  }

  if (input.dayDate && context.dayDate && input.dayDate !== context.dayDate) {
    return {
      hasContext: true,
      isAdjacentLane: false,
      isCurrentLane: false
    };
  }

  const currentLaneIndex = input.orderedResourceTechnicianUserIds.indexOf(
    context.resourceTechnicianUserId
  );
  const laneIndex = input.orderedResourceTechnicianUserIds.indexOf(
    input.resourceTechnicianUserId
  );
  const isCurrentLane = context.resourceTechnicianUserId === input.resourceTechnicianUserId;
  const isAdjacentLane =
    !isCurrentLane &&
    currentLaneIndex !== -1 &&
    laneIndex !== -1 &&
    Math.abs(currentLaneIndex - laneIndex) === 1;

  return {
    hasContext: true,
    isAdjacentLane,
    isCurrentLane
  };
}
