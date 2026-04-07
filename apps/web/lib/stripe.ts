import Stripe from "stripe";

import { getServerEnv } from "./server-env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(getServerEnv().STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function isStripeUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "APP_URL"].some((name) =>
    error.message.includes(`Missing required server environment variable: ${name}`)
  );
}
