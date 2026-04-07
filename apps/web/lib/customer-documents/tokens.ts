import { createHash, createHmac, timingSafeEqual } from "crypto";
import { isIP } from "node:net";

import { buildAppUrl, getCustomerDocumentTokenSecret } from "../server-env";

type ParsedCustomerDocumentToken = {
  linkId: string;
  signature: string;
};

function getTokenSignature(linkId: string) {
  return createHmac("sha256", getCustomerDocumentTokenSecret()).update(linkId).digest("base64url");
}

export function buildCustomerDocumentToken(linkId: string) {
  return `${linkId}.${getTokenSignature(linkId)}`;
}

export function hashCustomerDocumentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCustomerDocumentToken(token: string): ParsedCustomerDocumentToken | null {
  const trimmed = token.trim();
  const separatorIndex = trimmed.indexOf(".");

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null;
  }

  const linkId = trimmed.slice(0, separatorIndex);
  const signature = trimmed.slice(separatorIndex + 1);

  if (!linkId || !signature) {
    return null;
  }

  return { linkId, signature };
}

export function verifyCustomerDocumentToken(token: string) {
  const parsed = parseCustomerDocumentToken(token);

  if (!parsed) {
    return null;
  }

  const expectedSignature = getTokenSignature(parsed.linkId);
  const providedBuffer = Buffer.from(parsed.signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return parsed.linkId;
}

export function buildEstimateAccessUrl(token: string) {
  return buildAppUrl(`estimate/${token}`);
}

export function buildInvoiceAccessUrl(token: string) {
  return buildAppUrl(`invoice/${token}`);
}

export function buildVisitAccessUrl(token: string) {
  return buildAppUrl(`visit/${token}`);
}

export function getRequestIpAddress(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim() ?? null;
    return candidate && isIP(candidate) ? candidate : null;
  }

  const realIp = headers.get("x-real-ip")?.trim() ?? null;
  return realIp && isIP(realIp) ? realIp : null;
}
