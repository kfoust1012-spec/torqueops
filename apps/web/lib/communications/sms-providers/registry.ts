import type { SmsProvider } from "@mobile-mechanic/types";

import type { SmsProviderAdapter } from "./types";
import { telnyxSmsProviderAdapter } from "./telnyx/adapter";
import { twilioSmsProviderAdapter } from "./twilio/adapter";

const providerRegistry: Partial<Record<SmsProvider, SmsProviderAdapter>> = {
  telnyx: telnyxSmsProviderAdapter,
  twilio: twilioSmsProviderAdapter
};

export function getSmsProviderAdapter(provider: SmsProvider) {
  const adapter = providerRegistry[provider];

  if (!adapter) {
    throw new Error(`SMS provider ${provider} is not implemented yet.`);
  }

  return adapter;
}
