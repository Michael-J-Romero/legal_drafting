"use client";

interface PrintButtonProps {
  onPrint: (() => void) | undefined;
  disabled?: boolean;
}

export default function PrintButton({ onPrint, disabled }: PrintButtonProps) {
  return (
    <button
      type="button"
      className="print-button"
      onClick={() => onPrint?.()}
      disabled={disabled}
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
    >
      Print / Save as PDF
    </button>
  );
}
