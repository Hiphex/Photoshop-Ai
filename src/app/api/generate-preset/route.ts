import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid'; // For unique filenames/folders
import {
  generatePresetSettingsFromAI,
  convertSettingsToXMP,
  formatSettingsForDisplay,
} from '@/lib/presetUtils';
import type { LightroomSettings } from '@/lib/presetUtils';

// Define the base temporary directory within /tmp
const BASE_TMP_DIR = path.join('/tmp', 'ai_lightroom_presets');

// Function to ensure a unique temporary directory for each request
async function createRequestSpecificTmpDir(): Promise<string> {
  const requestId = uuidv4();
  const requestTmpDir = path.join(BASE_TMP_DIR, requestId);
  try {
    await mkdir(requestTmpDir, { recursive: true });
    return requestTmpDir;
  } catch (error: unknown) {
    console.error('Error creating request-specific temp directory:', error);
    throw new Error('Could not create temporary directory.'); // Propagate error
  }
}

// Function to clean up the request-specific temporary directory
async function cleanupRequestSpecificTmpDir(requestTmpDir: string) {
  try {
    // Remove entire temp directory recursively
    await rm(requestTmpDir, { recursive: true, force: true });
    console.log(`Cleaned up temporary directory: ${requestTmpDir}`);
  } catch (error) {
    console.error(`Error cleaning up temporary directory ${requestTmpDir}:`, error);
    // Not re-throwing, as this is a cleanup step, but logging is important
  }
}

// Max upload size from env or default to 100 MiB
const MAX_UPLOAD_BYTES = process.env.MAX_UPLOAD_BYTES
  ? parseInt(process.env.MAX_UPLOAD_BYTES, 10)
  : 100 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let requestTmpDir: string | null = null;
  try {
    requestTmpDir = await createRequestSpecificTmpDir();
    const formData = await req.formData();

    // Collect all primary photos
    const primaryPhotoFiles: File[] = [];
    const inspirationPhotoFiles: File[] = [];
    let textPrompt: string | null = null;
    let selectedAiModel: string = 'gemini-2.0-flash';
    // Iterate form entries
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && key.startsWith('primaryPhoto')) {
        primaryPhotoFiles.push(value);
      } else if (value instanceof File && key.startsWith('inspirationPhoto_')) {
        inspirationPhotoFiles.push(value);
      } else if (key === 'textPrompt') {
        textPrompt = value as string;
      } else if (key === 'selectedAiModel') {
        selectedAiModel = value as string;
      }
    }
    if (primaryPhotoFiles.length === 0) {
      return NextResponse.json({ error: 'At least one primary photo is required.' }, { status: 400 });
    }
    // Process each primary photo
    const results: Array<{ xmp: string; displaySettings: string; originalFilename: string; generatedAt: string; settings: LightroomSettings }> = [];
    for (const primaryPhotoFile of primaryPhotoFiles) {
      // Sanitize and name
      const originalName = primaryPhotoFile.name.replace(/[^a-zA-Z0-9._\-\[\]() ]/g, '').substring(0, 100);
      // Size cap
      if (primaryPhotoFile.size > MAX_UPLOAD_BYTES) {
        results.push({ xmp: '', displaySettings: '', originalFilename: originalName, generatedAt: '', settings: {} });
        continue;
      }
      // Save primary photo
      const buf = Buffer.from(await primaryPhotoFile.arrayBuffer());
      const tmpFilename = uuidv4() + '-' + primaryPhotoFile.name.replace(/\s+/g, '_');
      const primaryPath = path.join(requestTmpDir, tmpFilename);
      await writeFile(primaryPath, buf);
      // Save inspiration photos into paths array
      const inspPaths: string[] = [];
      for (const insp of inspirationPhotoFiles) {
        const ibuf = Buffer.from(await insp.arrayBuffer());
        const ifn = uuidv4() + '-' + insp.name.replace(/\s+/g, '_');
        const ipath = path.join(requestTmpDir, ifn);
        await writeFile(ipath, ibuf);
        inspPaths.push(ipath);
      }
      // Generate settings
      const aiSettings = await generatePresetSettingsFromAI(
        primaryPath,
        inspPaths,
        textPrompt,
        selectedAiModel
      );
      const xmp = convertSettingsToXMP(aiSettings, originalName);
      const display = formatSettingsForDisplay(aiSettings);
      results.push({
        xmp,
        displaySettings: display,
        originalFilename: originalName,
        generatedAt: new Date().toISOString(),
        settings: aiSettings,
      });
    }
    return NextResponse.json(
      {
        message: `✅ Successfully generated ${results.length} preset${results.length !== 1 ? 's' : ''}.`,
        results,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    let errorMessage = 'Failed to process request.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    if (requestTmpDir) {
      await cleanupRequestSpecificTmpDir(requestTmpDir);
    }
  }
} 