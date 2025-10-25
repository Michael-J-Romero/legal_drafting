'use client';

import React from 'react';
import { useReactToPrint } from 'react-to-print';
import styles from './printControls.module.css';

export type PrintControlsProps = {
  targetRef: React.RefObject<HTMLElement>;
};

const PrintControls: React.FC<PrintControlsProps> = ({ targetRef }) => {
  const handlePrint = useReactToPrint({
    content: () => targetRef.current
  });

  return (
    <div className={styles.controls}>
      <button type="button" onClick={handlePrint}>
        Print or Save as PDF
      </button>
    </div>
  );
};

export default PrintControls;
