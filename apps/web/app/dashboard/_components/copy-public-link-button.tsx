"use client";

import { useState } from "react";

type CopyPublicLinkButtonProps = {
  linkId: string;
  publicUrl: string;
};

export function CopyPublicLinkButton({ linkId, publicUrl }: CopyPublicLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    void fetch("/api/internal/customer-document-links/copied", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ linkId })
    }).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button className="button secondary-button" onClick={handleCopy} type="button">
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}