export function normalizeTechnicianBio(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

export function normalizeTechnicianCertifications(
  value: string[] | null | undefined
): string[] {
  if (!value?.length) {
    return [];
  }

  const seen = new Set<string>();
  const certifications: string[] = [];

  for (const item of value) {
    const normalized = item.trim();

    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    certifications.push(normalized);
  }

  return certifications;
}