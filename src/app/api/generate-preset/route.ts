import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { writeFile, mkdir, unlink, readdir, rm } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid'; // For unique filenames/folders
import {
  generatePresetSettingsFromAI,
  convertSettingsToXMP,
  formatSettingsForDisplay,
  LightroomSettings // Assuming this is exported if needed directly here, otherwise it's used internally
} from '@/lib/presetUtils'; // Assuming @ is configured for src

// Define the base temporary directory within /tmp
const BASE_TMP_DIR = path.join('/tmp', 'ai_lightroom_presets');

// Function to ensure a unique temporary directory for each request
async function createRequestSpecificTmpDir(): Promise<string> {
  const requestId = uuidv4();
  const requestTmpDir = path.join(BASE_TMP_DIR, requestId);
  try {
    await mkdir(requestTmpDir, { recursive: true });
    return requestTmpDir;
  } catch (error: any) {
    console.error('Error creating request-specific temp directory:', error);
    throw new Error('Could not create temporary directory.'); // Propagate error
  }
}

// Function to clean up the request-specific temporary directory
async function cleanupRequestSpecificTmpDir(requestTmpDir: string) {
  try {
    const files = await readdir(requestTmpDir);
    for (const file of files) {
      await unlink(path.join(requestTmpDir, file));
    }
    await rm(requestTmpDir, { recursive: true, force: true });
    console.log(`Cleaned up temporary directory: ${requestTmpDir}`);
  } catch (error) {
    console.error(`Error cleaning up temporary directory ${requestTmpDir}:`, error);
    // Not re-throwing, as this is a cleanup step, but logging is important
  }
}

export async function POST(req: NextRequest) {
  let requestTmpDir: string | null = null;
  try {
    requestTmpDir = await createRequestSpecificTmpDir();
    const formData = await req.formData();

    const primaryPhotoFile = formData.get('primaryPhoto') as File | null;
    const textPrompt = formData.get('textPrompt') as string | null;
    const selectedAiModel = formData.get('selectedAiModel') as string | 'gemini-2.0-flash'; // Default to Gemini 2.0 Flash
    const inspirationPhotoFiles: File[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('inspirationPhoto_') && value instanceof File) {
        inspirationPhotoFiles.push(value);
      }
    }

    if (!primaryPhotoFile) {
      return NextResponse.json({ error: 'Primary photo is required.' }, { status: 400 });
    }

    // P1 Fix: Add size cap for primary photo
    const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
    if (primaryPhotoFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `Primary photo exceeds size limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` }, { status: 413 });
    }
    // P1 Fix: Sanitize original filename for use as preset name
    const primaryPhotoOriginalName = primaryPhotoFile.name.replace(/[^a-zA-Z0-9._\-()\[\] ]/g, '').substring(0, 100);

    // --- Save Primary Photo to Temp Dir ---
    // TODO P2: For files significantly larger than ~20-50MB, consider streaming directly to disk 
    // to avoid potential memory issues with arrayBuffer() in serverless environments.
    // Current 20MB cap should make arrayBuffer() acceptable for now.
    const primaryPhotoBuffer = Buffer.from(await primaryPhotoFile.arrayBuffer());
    // Using a UUID for the temp filename itself is good, original name is just for preset metadata
    const primaryPhotoTempFilename = `${uuidv4()}-${primaryPhotoFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const primaryPhotoPath = path.join(requestTmpDir, primaryPhotoTempFilename);
    await writeFile(primaryPhotoPath, primaryPhotoBuffer);
    console.log(`Saved primary photo to temp: ${primaryPhotoPath}`);

    // --- Save Inspiration Photos to Temp Dir ---
    const inspirationPhotoPaths: string[] = [];
    if (inspirationPhotoFiles.length > 0) {
      for (const photoFile of inspirationPhotoFiles) {
        const inspirationPhotoBuffer = Buffer.from(await photoFile.arrayBuffer());
        const inspirationPhotoFilename = `${uuidv4()}-${photoFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const inspirationPhotoPath = path.join(requestTmpDir, inspirationPhotoFilename);
        await writeFile(inspirationPhotoPath, inspirationPhotoBuffer);
        inspirationPhotoPaths.push(inspirationPhotoPath);
        console.log(`Saved inspiration photo to temp: ${inspirationPhotoPath}`);
      }
    }

    console.log(`Text prompt: ${textPrompt}`);
    console.log('Calling generatePresetSettingsFromAI with model:', selectedAiModel);

    // Call the (placeholder) AI function from presetUtils
    const aiGeneratedSettings: LightroomSettings = await generatePresetSettingsFromAI(
      primaryPhotoPath, 
      inspirationPhotoPaths, 
      textPrompt,
      selectedAiModel
    );

    // Convert settings to XMP and formatted string
    // Use the sanitized primaryPhotoOriginalName for the preset name
    const xmpContent = convertSettingsToXMP(aiGeneratedSettings, primaryPhotoOriginalName);
    const displayableSettings = formatSettingsForDisplay(aiGeneratedSettings);

    return NextResponse.json(
      {
        message: 'Preset generated successfully.',
        xmp: xmpContent,
        displaySettings: displayableSettings,
        originalFilename: primaryPhotoOriginalName,
        generatedAt: new Date().toISOString(),
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