"use client";

import type { MouseEvent } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

export type SubmitButtonProps = Omit<ButtonProps, "type"> & {
  confirmMessage?: string | undefined;
  pendingLabel?: string | undefined;
};

export function SubmitButton({
  children,
  confirmMessage,
  disabled,
  loading,
  onClick,
  pendingLabel,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isBusy = pending || loading;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <Button
      {...props}
      disabled={disabled || isBusy}
      loading={isBusy}
      onClick={handleClick}
      type="submit"
    >
      {isBusy && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
