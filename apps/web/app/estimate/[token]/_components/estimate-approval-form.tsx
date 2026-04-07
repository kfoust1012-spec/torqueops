"use client";

import { useId, useRef, useState } from "react";

import { CustomerDocumentSubmitButton } from "../../../../components/customer-document-submit-button";

type EstimateApprovalFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  statement: string;
};

export function EstimateApprovalForm({ action, statement }: EstimateApprovalFormProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenInputId = useId();
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? canvas.width / rect.width : 1;
    const scaleY = rect.height ? canvas.height / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = getPoint(event);

    if (!canvas || !point) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
    setError(null);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;
    const point = getPoint(event);

    if (!canvas || !point) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const canvas = canvasRef.current;

    if (!canvas || !hasSignature) {
      event.preventDefault();
      setError("Please provide a signature before approving the estimate.");
      return;
    }

    const hiddenInput = event.currentTarget.querySelector<HTMLInputElement>(`#${hiddenInputId}`);

    if (!hiddenInput) {
      event.preventDefault();
      setError("Signature input could not be prepared.");
      return;
    }

    hiddenInput.value = canvas.toDataURL("image/png");
  }

  return (
    <form action={action} className="stack" onSubmit={handleSubmit}>
      <div className="detail-item">
        <p className="detail-label">Approval statement</p>
        <p className="detail-value">{statement}</p>
      </div>

      <input name="statement" type="hidden" value={statement} />
      <input id={hiddenInputId} name="signatureDataUrl" type="hidden" />

      <label className="label">
        Full name
        <input className="input" maxLength={120} name="signedByName" required type="text" />
      </label>

      <div className="signature-pad-shell">
        <div className="signature-pad-header">
          <p className="detail-label" style={{ margin: 0 }}>
            Signature
          </p>
          <button className="button secondary-button signature-clear-button" onClick={clearSignature} type="button">
            Clear
          </button>
        </div>

        <canvas
          className="signature-canvas"
          height={180}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          width={640}
          ref={canvasRef}
        />
      </div>

      {error ? <p className="error">{error}</p> : null}

      <CustomerDocumentSubmitButton pendingLabel="Submitting approval...">
        Approve estimate
      </CustomerDocumentSubmitButton>
    </form>
  );
}
