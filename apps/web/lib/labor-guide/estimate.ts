import type { EstimateDetail, Job, LaborGuideContext, Vehicle } from "@mobile-mechanic/types";
import { laborGuideContextSchema } from "@mobile-mechanic/validation";

export function buildLaborGuideContext(input: {
  job: Job;
  vehicle: Vehicle;
  estimateId?: string | null;
}): LaborGuideContext {
  const context: LaborGuideContext = {
    jobId: input.job.id,
    estimateId: input.estimateId ?? null,
    title: input.job.title,
    description: input.job.description,
    customerConcern: input.job.customerConcern,
    internalSummary: input.job.internalSummary,
    vehicle: {
      year: input.vehicle.year,
      make: input.vehicle.make,
      model: input.vehicle.model,
      trim: input.vehicle.trim ?? null,
      engine: input.vehicle.engine ?? null,
      vin: input.vehicle.vin ?? null
    }
  };

  laborGuideContextSchema.parse(context);

  return context;
}

export function buildLaborGuideContextFromEstimateDetail(detail: EstimateDetail): LaborGuideContext {
  return buildLaborGuideContext({
    job: detail.job,
    vehicle: detail.vehicle,
    estimateId: detail.estimate.id
  });
}