import { describe, expect, it } from "vitest";
import {
  emitGitHubAnnotations,
  escapeGitHubAnnotationMessage,
  escapeGitHubAnnotationValue
} from "./github-annotations.mjs";

describe("github annotations", () => {
  it("escapes annotation title values for workflow commands", () => {
    expect(escapeGitHubAnnotationValue("a:b,c%\n")).toBe("a%3Ab%2Cc%25%0A");
  });

  it("escapes annotation messages for workflow commands", () => {
    expect(escapeGitHubAnnotationMessage("line 1%\nline 2\r")).toBe("line 1%25%0Aline 2%0D");
  });

  it("emits annotation commands through the provided writer", () => {
    const writes = [];
    emitGitHubAnnotations([
      {
        level: "warning",
        message: "Preflight is slower than baseline by 2.3s (225.5%).",
        title: "Timing warning (web)"
      }
    ], (chunk) => {
      writes.push(chunk);
      return true;
    });

    expect(writes).toEqual([
      "::warning title=Timing warning (web)::Preflight is slower than baseline by 2.3s (225.5%25).\n"
    ]);
  });
});
