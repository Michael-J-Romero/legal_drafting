"use client";

import { useReactToPrint } from "react-to-print";

interface PrintControlsProps {
  targetRef: React.RefObject<HTMLElement>;
  documentTitle?: string;
}

const PrintControls: React.FC<PrintControlsProps> = ({ targetRef, documentTitle }) => {
  const handlePrint = useReactToPrint({
    content: () => targetRef.current,
    documentTitle: documentTitle ?? "document-preview",
    removeAfterPrint: true,
  });

  return (
    <button className="print-button" type="button" onClick={handlePrint} disabled={!targetRef.current}>
      Print / Save as PDF
    </button>
  );
};

export default PrintControls;
