export function escapeGitHubAnnotationValue(value) {
  return String(value ?? "")
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

export function escapeGitHubAnnotationMessage(value) {
  return String(value ?? "")
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

export function emitGitHubAnnotations(annotations, writer = process.stdout.write.bind(process.stdout)) {
  for (const annotation of annotations) {
    writer(
      `::${annotation.level} title=${escapeGitHubAnnotationValue(annotation.title)}::${escapeGitHubAnnotationMessage(annotation.message)}\n`
    );
  }
}
