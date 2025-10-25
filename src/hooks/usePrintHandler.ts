import { RefObject, useState } from 'react';
import { useReactToPrint } from 'react-to-print';

export function usePrintHandler(targetRef: RefObject<HTMLElement>) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => targetRef.current,
    documentTitle: 'Legal Drafting Preview',
    onBeforePrint: () => setIsPrinting(true),
    onAfterPrint: () => setIsPrinting(false),
  });

  return {
    handlePrint,
    isPrinting,
  };
}
