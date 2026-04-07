type BuildEstimateSignatureStoragePathInput = {
  companyId: string;
  estimateId: string;
  jobId: string;
  signatureId: string;
};

export const ESTIMATE_SIGNATURES_BUCKET = "estimate-signatures";

export function buildEstimateSignatureStoragePath(
  input: BuildEstimateSignatureStoragePathInput
): string {
  return [
    "companies",
    input.companyId,
    "jobs",
    input.jobId,
    "estimates",
    input.estimateId,
    "signatures",
    `${input.signatureId}.png`
  ].join("/");
}
