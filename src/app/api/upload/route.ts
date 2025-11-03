import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';

// Use Node.js runtime for this route
export const runtime = 'nodejs';

// Configure the route to handle larger file uploads (10MB limit)
export const config = {
  api: {
    bodyParser: false,
  },
};

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractTextFromFile(buffer: Buffer, fileType: string): Promise<string> {
  try {
    // For text-based files, convert buffer to string
    if (fileType === '.txt' || fileType === '.js' || fileType === '.json') {
      return buffer.toString('utf-8');
    }
    
    throw new Error(`Unsupported file type: ${fileType}`);
  } catch (error) {
    console.error('Error extracting file text:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    // Validate file type
    const supportedTypes = ['.pdf', '.txt', '.js', '.json'];
    if (!supportedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported types: ${supportedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    let extractedText: string;

    // Extract text based on file type
    if (fileExtension === '.pdf') {
      extractedText = await extractTextFromPdf(buffer);
    } else {
      extractedText = await extractTextFromFile(buffer, fileExtension);
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType: fileExtension,
      text: extractedText,
      size: buffer.length,
    });

  } catch (error) {
    console.error('Error processing file upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}
