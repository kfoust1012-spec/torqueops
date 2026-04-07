"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type CustomerDocumentSubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  children: ReactNode;
  pendingLabel?: string | undefined;
};

export function CustomerDocumentSubmitButton({
  children,
  className = "button",
  disabled,
  pendingLabel,
  ...props
}: CustomerDocumentSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className={className}
      disabled={disabled || pending}
      type="submit"
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
