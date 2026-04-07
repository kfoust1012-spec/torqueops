"use client";

import { signInWithPassword } from "@mobile-mechanic/api-client";
import { loginInputSchema } from "@mobile-mechanic/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AppIcon, Button, FormField, Input } from "../../components/ui";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import styles from "./page.module.css";

const supabase = getBrowserSupabaseClient();

const accessRoles = ["Owners", "Dispatchers", "Office staff"] as const;

function BrandMark() {
  return (
    <svg aria-hidden="true" className={styles.brandMark} fill="none" viewBox="0 0 64 64">
      <rect height="64" rx="18" width="64" fill="#0F172A" />
      <path
        d="M45.5 20.2a9.4 9.4 0 0 0-11.6 11.6L20.7 44.9a2.9 2.9 0 0 0 4.1 4.1l13.1-13.2a9.4 9.4 0 0 0 11.6-11.6l-5.2 5.2-4.6-.7-.8-4.7 5.3-3.8Z"
        fill="#5EA5FF"
      />
      <circle cx="22.3" cy="45.2" fill="#E2E8F0" r="2.3" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const emailId = "login-email";
  const errorId = "login-error";
  const passwordId = "login-password";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = loginInputSchema.safeParse({ email, password });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Enter a valid email and password.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await signInWithPassword(supabase, parsed.data);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main className={styles.page}>
      <section className={styles.stage}>
        <section className={styles.authPanel}>
          <div className={styles.authCard}>
            <div className={styles.cardCrest}>
              <div className={styles.brandLockup}>
                <BrandMark />
                <div className={styles.brandLockupCopy}>
                  <p className={styles.brandName}>Mobile Mechanic</p>
                  <p className={styles.brandLabel}>Office command</p>
                </div>
              </div>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.authHeader}>
                <p className={styles.authEyebrow}>Secure access</p>
                <h1 className={styles.authTitle}>Sign in to operations</h1>
                <p className={styles.authCopy}>Use your office account to continue.</p>
              </div>

              <form className={styles.form} noValidate onSubmit={handleSubmit}>
                <FormField className={styles.formField} htmlFor={emailId} label="Work email" required>
                  <Input
                    aria-describedby={errorMessage ? errorId : undefined}
                    aria-invalid={errorMessage ? true : undefined}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    autoFocus
                    className={styles.input}
                    enterKeyHint="next"
                    id={emailId}
                    inputMode="email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="owner@shop.com"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </FormField>

                <FormField className={styles.formField} htmlFor={passwordId} label="Password" required>
                  <Input
                    aria-describedby={errorMessage ? errorId : undefined}
                    aria-invalid={errorMessage ? true : undefined}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    autoCorrect="off"
                    className={styles.input}
                    enterKeyHint="go"
                    id={passwordId}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    spellCheck={false}
                    type="password"
                    value={password}
                  />
                </FormField>

                {errorMessage ? (
                  <div className={styles.errorPanel} id={errorId} role="alert">
                    <AppIcon className={styles.errorIcon} name="alert" />
                    <p className={styles.errorText}>{errorMessage}</p>
                  </div>
                ) : null}

                <Button
                  className={styles.submitButton}
                  fullWidth
                  loading={isSubmitting}
                  size="lg"
                  type="submit"
                >
                  {isSubmitting ? "Signing in..." : "Enter operations"}
                </Button>
              </form>

              <div className={styles.authFooter}>
                <div className={styles.trustRow}>
                  <div className={styles.trustHeader}>
                    <span className={styles.trustIndicator}>
                      <span className={styles.trustIndicatorDot} />
                      Authorized office access
                    </span>
                    <p className={styles.trustCopy}>
                      Access changes are managed by your company admin.
                    </p>
                  </div>

                  <p className={styles.roleLine}>{accessRoles.join(" • ")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
