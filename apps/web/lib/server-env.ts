type ServerEnv = {
  APP_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CUSTOMER_DOCUMENT_TOKEN_SECRET: string;
  PROCUREMENT_PROVIDER_CREDENTIAL_SECRET: string | null;
  MIGRATION_SOURCE_CREDENTIAL_SECRET: string | null;
  SMS_PROVIDER_CREDENTIAL_SECRET: string | null;
  CARFAX_API_KEY: string | null;
  CARFAX_API_BASE_URL: string | null;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  COMMUNICATIONS_PROCESS_SECRET: string | null;
  IMPORTS_PROCESS_SECRET: string | null;
  CRON_SECRET: string | null;
  RESEND_WEBHOOK_SECRET: string | null;
  COMMUNICATIONS_FROM_EMAIL: string | null;
  COMMUNICATIONS_REPLY_TO_EMAIL: string | null;
  COMMUNICATIONS_FROM_PHONE: string | null;
  RESEND_API_KEY: string | null;
  TWILIO_ACCOUNT_SID: string | null;
  TWILIO_AUTH_TOKEN: string | null;
  TOMTOM_API_KEY: string | null;
};

type CommunicationDeliveryEnvKey =
  | "COMMUNICATIONS_FROM_EMAIL"
  | "COMMUNICATIONS_REPLY_TO_EMAIL"
  | "COMMUNICATIONS_FROM_PHONE"
  | "RESEND_API_KEY"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_AUTH_TOKEN";

type CommunicationDeliveryEnv = Pick<ServerEnv, CommunicationDeliveryEnvKey>;

function readRequiredEnv(name: keyof ServerEnv): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value.trim();
}

function readOptionalEnv(name: keyof ServerEnv): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function parseAbsoluteUrl(value: string, name: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function normalizeAbsoluteUrl(value: string, name: string) {
  const url = parseAbsoluteUrl(value, name);

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  return url.toString().replace(/\/$/, "");
}

export function getAppUrl(): string {
  const appUrl = readRequiredEnv("APP_URL");
  return normalizeAbsoluteUrl(appUrl, "APP_URL");
}

export function buildAppUrl(path = ""): string {
  return new URL(path.replace(/^\/+/, ""), `${getAppUrl()}/`).toString();
}

export function getSupabaseServiceRoleKey(): string {
  return readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getCustomerDocumentTokenSecret(): string {
  return readRequiredEnv("CUSTOMER_DOCUMENT_TOKEN_SECRET");
}

export function getProcurementProviderCredentialSecret(): string {
  const secret = readOptionalEnv("PROCUREMENT_PROVIDER_CREDENTIAL_SECRET");

  if (!secret) {
    throw new Error(
      "Missing required server environment variable: PROCUREMENT_PROVIDER_CREDENTIAL_SECRET"
    );
  }

  return secret;
}

export function getMigrationSourceCredentialSecret(): string {
  const secret = readOptionalEnv("MIGRATION_SOURCE_CREDENTIAL_SECRET");

  if (!secret) {
    throw new Error(
      "Missing required server environment variable: MIGRATION_SOURCE_CREDENTIAL_SECRET"
    );
  }

  return secret;
}

export function getSmsProviderCredentialSecret(): string {
  const secret = readOptionalEnv("SMS_PROVIDER_CREDENTIAL_SECRET");

  if (!secret) {
    throw new Error(
      "Missing required server environment variable: SMS_PROVIDER_CREDENTIAL_SECRET"
    );
  }

  return secret;
}

export function getCarfaxConfig(): { apiKey: string; baseUrl: string } | null {
  const apiKey = readOptionalEnv("CARFAX_API_KEY");
  const baseUrl = readOptionalEnv("CARFAX_API_BASE_URL");

  if (!apiKey || !baseUrl) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeAbsoluteUrl(baseUrl, "CARFAX_API_BASE_URL")
  };
}

export function getCommunicationsProcessSecret(): string | null {
  return readOptionalEnv("COMMUNICATIONS_PROCESS_SECRET");
}

export function getImportsProcessSecret(): string | null {
  return readOptionalEnv("IMPORTS_PROCESS_SECRET");
}

export function getCronSecret(): string | null {
  return readOptionalEnv("CRON_SECRET");
}

export function getResendWebhookSecret(): string | null {
  return readOptionalEnv("RESEND_WEBHOOK_SECRET");
}

export function getCommunicationDeliveryEnv(): CommunicationDeliveryEnv {
  return {
    COMMUNICATIONS_FROM_EMAIL: readOptionalEnv("COMMUNICATIONS_FROM_EMAIL"),
    COMMUNICATIONS_REPLY_TO_EMAIL: readOptionalEnv("COMMUNICATIONS_REPLY_TO_EMAIL"),
    COMMUNICATIONS_FROM_PHONE: readOptionalEnv("COMMUNICATIONS_FROM_PHONE"),
    RESEND_API_KEY: readOptionalEnv("RESEND_API_KEY"),
    TWILIO_ACCOUNT_SID: readOptionalEnv("TWILIO_ACCOUNT_SID"),
    TWILIO_AUTH_TOKEN: readOptionalEnv("TWILIO_AUTH_TOKEN")
  };
}

export function getTomTomApiKey(): string | null {
  const serverKey = readOptionalEnv("TOMTOM_API_KEY");

  if (serverKey) {
    return serverKey;
  }

  const publicKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  return publicKey && publicKey.trim() ? publicKey.trim() : null;
}

export function getServerEnv(): ServerEnv {
  const appUrl = getAppUrl();
  const carfaxApiBaseUrl = readOptionalEnv("CARFAX_API_BASE_URL");

  return {
    APP_URL: appUrl,
    SUPABASE_SERVICE_ROLE_KEY: getSupabaseServiceRoleKey(),
    CUSTOMER_DOCUMENT_TOKEN_SECRET: getCustomerDocumentTokenSecret(),
    PROCUREMENT_PROVIDER_CREDENTIAL_SECRET: readOptionalEnv(
      "PROCUREMENT_PROVIDER_CREDENTIAL_SECRET"
    ),
    MIGRATION_SOURCE_CREDENTIAL_SECRET: readOptionalEnv(
      "MIGRATION_SOURCE_CREDENTIAL_SECRET"
    ),
    SMS_PROVIDER_CREDENTIAL_SECRET: readOptionalEnv("SMS_PROVIDER_CREDENTIAL_SECRET"),
    CARFAX_API_KEY: readOptionalEnv("CARFAX_API_KEY"),
    CARFAX_API_BASE_URL: carfaxApiBaseUrl
      ? normalizeAbsoluteUrl(carfaxApiBaseUrl, "CARFAX_API_BASE_URL")
      : null,
    STRIPE_SECRET_KEY: readRequiredEnv("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: readRequiredEnv("STRIPE_WEBHOOK_SECRET"),
    COMMUNICATIONS_PROCESS_SECRET: getCommunicationsProcessSecret(),
    IMPORTS_PROCESS_SECRET: getImportsProcessSecret(),
    CRON_SECRET: getCronSecret(),
    RESEND_WEBHOOK_SECRET: getResendWebhookSecret(),
    TOMTOM_API_KEY: getTomTomApiKey(),
    ...getCommunicationDeliveryEnv()
  };
}
