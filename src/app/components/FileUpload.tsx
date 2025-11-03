'use client';

import React, { useState } from 'react';

interface UploadResponse {
  success: boolean;
  fileName?: string;
  fileType?: string;
  text?: string;
  size?: number;
  error?: string;
}

export default function FileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [uploadInfo, setUploadInfo] = useState<{ fileName: string; fileType: string; size: number } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setExtractedText('');
      setUploadInfo(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setExtractedText('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data: UploadResponse = await response.json();

      if (data.success && data.text) {
        setExtractedText(data.text);
        setUploadInfo({
          fileName: data.fileName || '',
          fileType: data.fileType || '',
          size: data.size || 0,
        });
      } else {
        setError(data.error || 'Failed to extract text from file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>File Upload & Text Extraction</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p style={{ marginBottom: '10px', color: '#666' }}>
          Supported file types: PDF, .txt, .js, .json
        </p>
        
        <input
          type="file"
          accept=".pdf,.txt,.js,.json"
          onChange={handleFileChange}
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginBottom: '10px',
            display: 'block',
            width: '100%',
          }}
        />
        
        {selectedFile && (
          <p style={{ marginBottom: '10px', color: '#333' }}>
            Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        )}
        
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          style={{
            padding: '10px 20px',
            backgroundColor: !selectedFile || uploading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
          }}
        >
          {uploading ? 'Uploading...' : 'Upload & Extract Text'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#fee',
            color: '#c00',
            border: '1px solid #fcc',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {uploadInfo && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#efe',
            border: '1px solid #cfc',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          <strong>File Info:</strong>
          <ul style={{ marginTop: '10px', marginBottom: '0' }}>
            <li>Name: {uploadInfo.fileName}</li>
            <li>Type: {uploadInfo.fileType}</li>
            <li>Size: {formatFileSize(uploadInfo.size)}</li>
          </ul>
        </div>
      )}

      {extractedText && (
        <div>
          <h3 style={{ marginBottom: '10px' }}>Extracted Text:</h3>
          <textarea
            value={extractedText}
            readOnly
            style={{
              width: '100%',
              height: '400px',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: '10px', color: '#666' }}>
            Character count: {extractedText.length}
          </div>
        </div>
      )}
    </div>
  );
}
