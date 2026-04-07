import * as FileSystem from "expo-file-system/legacy";
import { mobileEnv } from "../../env";
import { supabase } from "../../lib/supabase";

function getMobileWebAppUrl() {
  const baseUrl = mobileEnv.EXPO_PUBLIC_WEB_APP_URL?.trim() ?? "";

  if (!baseUrl) {
    throw new Error(
      "Configure EXPO_PUBLIC_WEB_APP_URL before mobile approvals can sync."
    );
  }

  return baseUrl.replace(/\/+$/g, "");
}

export async function approveAssignedEstimateFromMobile(
  companyId: string,
  technicianUserId: string,
  jobId: string,
  input: {
    signatureMimeType?: string;
    signatureUri: string;
    signedByName: string;
    statement: string;
  }
) {
  const baseUrl = getMobileWebAppUrl();
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token ?? null;

  if (!accessToken) {
    throw new Error("Sign in again before saving estimate approval.");
  }

  if (__DEV__) {
    console.info("[approval-mobile] sending approval", {
      companyId,
      jobId,
      signatureUri: input.signatureUri,
      technicianUserId
    });
  }

  const pngBase64 = await FileSystem.readAsStringAsync(input.signatureUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  const response = await fetch(`${baseUrl}/api/mobile/jobs/${jobId}/estimate/approve`, {
    body: JSON.stringify({
      pngBase64,
      signedByName: input.signedByName,
      statement: input.statement
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => null)) as
    | {
        approvedAt?: string | null;
        error?: string;
        estimateId?: string;
        ok?: boolean;
        status?: string;
      }
    | null;

  if (!response.ok || !body?.ok || typeof body.estimateId !== "string") {
    const error = new Error(body?.error ?? "The approval signature could not be saved.");

    if (__DEV__) {
      console.warn("[approval-mobile] approval failed", {
        message: error.message,
        status: response.status
      });
    }

    throw error;
  }

  if (__DEV__) {
    console.info("[approval-mobile] approval saved", {
      estimateId: body.estimateId,
      status: body.status ?? null
    });
  }

  return {
    acceptedAt: body.approvedAt ?? null,
    id: body.estimateId,
    status: body.status ?? null
  };
}
