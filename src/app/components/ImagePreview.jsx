'use client';

import React, { useEffect, useMemo, useState } from 'react';

// Renders an image ArrayBuffer as an <img> sized to page width
export default function ImagePreview({ data, alt }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    console.log("here1",data)
    if (!data) { setUrl(null); return () => {}; }
    const blob = new Blob([data], { type: 'image/*' });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
    };
  }, [data]);

  if (!url) {
    return <div className="page-surface image-placeholder">No image</div>;
  }

  return (
    <div className="pdf-page">
      <img src={url} alt={alt || 'Image section'} style={{ width: '8.5in', height: 'auto', display: 'block' }} />
    </div>
  );
}
