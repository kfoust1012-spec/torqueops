import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { getProcurementProviderCredentialSecret } from "../../server-env";

const CIPHER_ALGORITHM = "aes-256-gcm";

function getCipherKey() {
  return createHash("sha256")
    .update(getProcurementProviderCredentialSecret(), "utf8")
    .digest();
}

export function buildCredentialHint(secret: string) {
  const normalized = secret.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}••••${normalized.slice(-2)}`;
}

export function encryptProviderCredential(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGORITHM, getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptProviderCredential(ciphertext: string | null) {
  if (!ciphertext) {
    return null;
  }

  const [ivBase64, authTagBase64, encryptedBase64] = ciphertext.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Stored provider credential is invalid.");
  }

  const decipher = createDecipheriv(
    CIPHER_ALGORITHM,
    getCipherKey(),
    Buffer.from(ivBase64, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
