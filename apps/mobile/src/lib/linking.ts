import type { CustomerAddress } from "@mobile-mechanic/types";
import { Linking } from "react-native";

function buildAddressLabel(address: CustomerAddress | null, fallbackLabel?: string): string | null {
  if (!address) {
    return fallbackLabel ?? null;
  }

  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`]
    .filter(Boolean)
    .join(", ");
}

export async function callPhoneNumber(phone: string | null) {
  if (!phone) {
    throw new Error("Customer phone number is not available.");
  }

  const sanitizedPhone = phone.replace(/[^\d+]/g, "");
  const phoneUrl = `tel:${sanitizedPhone}`;
  const canOpen = await Linking.canOpenURL(phoneUrl);

  if (!canOpen) {
    throw new Error("Calling is not supported on this device.");
  }

  await Linking.openURL(phoneUrl);
}

export async function openSmsComposer(phone: string | null, body?: string | null) {
  if (!phone) {
    throw new Error("Customer phone number is not available.");
  }

  const sanitizedPhone = phone.replace(/[^\d+]/g, "");
  const query = body?.trim() ? `?body=${encodeURIComponent(body.trim())}` : "";
  const smsUrl = `sms:${sanitizedPhone}${query}`;
  const canOpen = await Linking.canOpenURL(smsUrl);

  if (!canOpen) {
    throw new Error("Text messaging is not supported on this device.");
  }

  await Linking.openURL(smsUrl);
}

export async function openMapsForAddress(address: CustomerAddress | null, fallbackLabel?: string) {
  const query = buildAddressLabel(address, fallbackLabel);

  if (!query) {
    throw new Error("No service location is available for this job.");
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const canOpen = await Linking.canOpenURL(mapsUrl);

  if (!canOpen) {
    throw new Error("Maps could not be opened on this device.");
  }

  await Linking.openURL(mapsUrl);
}

export async function openExternalUrl(url: string, unavailableMessage = "This link could not be opened on this device.") {
  const nextUrl = url.trim();

  if (!nextUrl) {
    throw new Error("No external link is available.");
  }

  const canOpen = await Linking.canOpenURL(nextUrl);

  if (!canOpen) {
    throw new Error(unavailableMessage);
  }

  await Linking.openURL(nextUrl);
}
