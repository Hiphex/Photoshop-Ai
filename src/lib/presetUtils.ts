import { create } from 'xmlbuilder2';
import { promises as fs } from 'fs';
// Placeholder for Google Generative AI SDK - install with: npm install @google/generative-ai
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Type for a single point on the tone curve [x, y]
export type ToneCurvePoint = [number, number];

// More comprehensive Lightroom settings interface
export interface LightroomSettings {
  // Basic Panel
  exposure?: number;      // crs:Exposure2012
  contrast?: number;      // crs:Contrast2012
  highlights?: number;    // crs:Highlights2012
  shadows?: number;       // crs:Shadows2012
  whites?: number;        // crs:Whites2012
  blacks?: number;        // crs:Blacks2012
  texture?: number;       // crs:Texture
  clarity?: number;       // crs:Clarity2012
  dehaze?: number;        // crs:Dehaze
  vibrance?: number;      // crs:Vibrance
  saturation?: number;    // crs:Saturation

  // White Balance
  temperature?: number;   // crs:Temperature
  tint?: number;          // crs:Tint

  // Tone Curve
  toneCurvePV?: string;     // crs:ToneCurvePV2012 (e.g., "2012") - version for the curve
  toneCurve?: ToneCurvePoint[];       // Luminance/RGB curve
  toneCurveRed?: ToneCurvePoint[];
  toneCurveGreen?: ToneCurvePoint[];
  toneCurveBlue?: ToneCurvePoint[];

  // HSL - Hue, Saturation, Luminance (0-100 for Sat/Lum, -180 to +180 for Hue shifts, but stored as 0-100 by LR for some)
  // For simplicity, we'll use -100 to +100 for adjustments from a baseline
  hslHueRed?: number;         // crs:HueAdjustmentRed
  hslHueOrange?: number;      // crs:HueAdjustmentOrange
  hslHueYellow?: number;      // crs:HueAdjustmentYellow
  hslHueGreen?: number;       // crs:HueAdjustmentGreen
  hslHueAqua?: number;        // crs:HueAdjustmentAqua
  hslHueBlue?: number;        // crs:HueAdjustmentBlue
  hslHuePurple?: number;      // crs:HueAdjustmentPurple
  hslHueMagenta?: number;     // crs:HueAdjustmentMagenta
  
  hslSaturationRed?: number;    // crs:SaturationAdjustmentRed
  hslSaturationOrange?: number; // crs:SaturationAdjustmentOrange
  hslSaturationYellow?: number; // crs:SaturationAdjustmentYellow
  hslSaturationGreen?: number;  // crs:SaturationAdjustmentGreen
  hslSaturationAqua?: number;   // crs:SaturationAdjustmentAqua
  hslSaturationBlue?: number;   // crs:SaturationAdjustmentBlue
  hslSaturationPurple?: number; // crs:SaturationAdjustmentPurple
  hslSaturationMagenta?: number; // crs:SaturationAdjustmentMagenta

  hslLuminanceRed?: number;     // crs:LuminanceAdjustmentRed
  hslLuminanceOrange?: number;   // crs:LuminanceAdjustmentOrange
  hslLuminanceYellow?: number;   // crs:LuminanceAdjustmentYellow
  hslLuminanceGreen?: number;    // crs:LuminanceAdjustmentGreen
  hslLuminanceAqua?: number;     // crs:LuminanceAdjustmentAqua
  hslLuminanceBlue?: number;     // crs:LuminanceAdjustmentBlue
  hslLuminancePurple?: number;   // crs:LuminanceAdjustmentPurple
  hslLuminanceMagenta?: number;  // crs:LuminanceAdjustmentMagenta

  // Detail - Sharpening
  sharpeningAmount?: number; // crs:Sharpness (0-150)
  sharpeningRadius?: number; // crs:SharpenRadius (0.5-3.0)
  sharpeningDetail?: number; // crs:SharpenDetail (0-100)
  sharpeningMasking?: number;// crs:SharpenEdgeMasking (0-100)

  // Effects - Grain
  grainAmount?: number;     // crs:GrainAmount (0-100)
  grainSize?: number;       // crs:GrainSize (0-100)
  grainFrequency?: number;  // crs:GrainFrequency (0-100) // LR calls it Roughness

  // Color Grading (replaces older Split Toning for newer process versions)
  colorGradeShadowHue?: number;         // 0-359
  colorGradeShadowSat?: number;         // 0-100
  colorGradeShadowLum?: number;         // -100 to +100 (Luminance)
  colorGradeMidtoneHue?: number;        // 0-359
  colorGradeMidtoneSat?: number;        // 0-100
  colorGradeMidtoneLum?: number;        // -100 to +100
  colorGradeHighlightHue?: number;      // 0-359
  colorGradeHighlightSat?: number;      // 0-100
  colorGradeHighlightLum?: number;      // -100 to +100
  colorGradeGlobalHue?: number;         // 0-359
  colorGradeGlobalSat?: number;         // 0-100
  colorGradeGlobalLum?: number;         // -100 to +100
  colorGradeBlending?: number;          // 0-100
  colorGradeBalance?: number;           // -100 to +100
  
  // Split Toning (for older process versions or if Color Grading is not used)
  splitToningHighlightHue?: number;     
  splitToningHighlightSaturation?: number; 
  splitToningShadowHue?: number;        
  splitToningShadowSaturation?: number; 
  splitToningBalance?: number;          

  // Camera Profile
  cameraProfile?: string;   // crs:CameraProfile (e.g., "Adobe Standard")
  processVersion?: string;  // crs:ProcessVersion (e.g., "11.0")

  [key: string]: unknown; // P2 Fix: Tightened index signature
}

const HSL_COLORS = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];

// TODO: Define a type for the AI provider (e.g., 'google', 'openai') if needed for future switching logic
// type AiProvider = 'google' | 'openai';

// Helper function to clamp a number between a min and max value
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Helper function to convert file path to a GoogleGenerativeAI.Part object
async function fileToGenerativePart(filePath: string, mimeType: string) {
  const fileData = await fs.readFile(filePath);
  return {
    inlineData: {
      data: fileData.toString('base64'),
      mimeType
    },
  };
}

/**
 * Generates Lightroom preset settings using an AI model.
 * This function will be updated to call the chosen AI API (e.g., Google Gemini or OpenAI).
 */
export async function generatePresetSettingsFromAI(
  primaryImagePath: string,
  inspirationImagePaths: string[],
  textPrompt: string | null,
  selectedAiModel: string // Added new parameter for selected AI model
): Promise<LightroomSettings> {
  console.log('-- generatePresetSettingsFromAI called (REAL AI INTEGRATION PENDING) --');
  console.log('Primary Image Path:', primaryImagePath);
  console.log('Inspiration Image Paths:', inspirationImagePaths);
  console.log('Text Prompt:', textPrompt);
  console.log('Selected AI Model:', selectedAiModel);

  // --- Google Generative AI (Gemini) Integration --- 
  // IMPORTANT: Store your API key securely using environment variables (e.g., process.env.GOOGLE_API_KEY)
  // Do NOT hardcode API keys in your application.
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; 

  if (!GOOGLE_API_KEY) {
    throw new Error('Google API Key is missing. Set GOOGLE_API_KEY environment variable.');
  }

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({
    model: selectedAiModel, // Use the passed-in model identifier
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ]
  });

  try {
    // 1. Prepare inputs for the AI:
    const imageParts = [await fileToGenerativePart(primaryImagePath, 'image/jpeg')]; // Assuming primary is JPEG for now
    for (const p of inspirationImagePaths) {
      // TODO: Determine MIME type dynamically or ensure uploads are of expected types
      imageParts.push(await fileToGenerativePart(p, 'image/jpeg')); 
    }

    // 2. Construct the prompt for the AI:
    //    - This is a critical step. The prompt should clearly instruct the AI on what to do.
    //    - It should specify that the output needs to be convertible to Lightroom settings.
    //    - It should explain how to interpret the primary image and inspiration images/styles.
    const lightroomSettingsInterfaceString = `
      interface LightroomSettings {
        exposure?: number; contrast?: number; highlights?: number; shadows?: number; whites?: number; blacks?: number;
        texture?: number; clarity?: number; dehaze?: number; vibrance?: number; saturation?: number;
        temperature?: number; tint?: number;
        toneCurvePV?: string; toneCurve?: Array<[number, number]>; toneCurveRed?: Array<[number, number]>; toneCurveGreen?: Array<[number, number]>; toneCurveBlue?: Array<[number, number]>;
        hslHueRed?: number; hslHueOrange?: number; hslHueYellow?: number; hslHueGreen?: number; hslHueAqua?: number; hslHueBlue?: number; hslHuePurple?: number; hslHueMagenta?: number;
        hslSaturationRed?: number; hslSaturationOrange?: number; hslSaturationYellow?: number; hslSaturationGreen?: number; hslSaturationAqua?: number; hslSaturationBlue?: number; hslSaturationPurple?: number; hslSaturationMagenta?: number;
        hslLuminanceRed?: number; hslLuminanceOrange?: number; hslLuminanceYellow?: number; hslLuminanceGreen?: number; hslLuminanceAqua?: number; hslLuminanceBlue?: number; hslLuminancePurple?: number; hslLuminanceMagenta?: number;
        sharpeningAmount?: number; sharpeningRadius?: number; sharpeningDetail?: number; sharpeningMasking?: number;
        grainAmount?: number; grainSize?: number; grainFrequency?: number;
        colorGradeShadowHue?: number; colorGradeShadowSat?: number; colorGradeShadowLum?: number; 
        colorGradeMidtoneHue?: number; colorGradeMidtoneSat?: number; colorGradeMidtoneLum?: number; 
        colorGradeHighlightHue?: number; colorGradeHighlightSat?: number; colorGradeHighlightLum?: number; 
        colorGradeGlobalHue?: number; colorGradeGlobalSat?: number; colorGradeGlobalLum?: number; 
        colorGradeBlending?: number; colorGradeBalance?: number;
        cameraProfile?: string; processVersion?: string;
      }
    `;
    
    const prompt = [
        `You are an expert photo editing assistant. Your task is to generate Adobe Lightroom preset settings based on a primary image, optional inspiration images, and a text prompt.`,
        `The primary image is the main subject for editing. Inspiration images provide stylistic guidance. The text prompt offers further creative direction (e.g., "warm vintage look", "moody black and white", "vibrant and sharp for landscapes").`,
        `Analyze all provided inputs carefully.`, 
        `Output your suggested Lightroom settings as a single, minified JSON object string that strictly conforms to the following TypeScript interface:`,
        lightroomSettingsInterfaceString,
        `Ensure all numeric values are indeed numbers, not strings. For tone curves (toneCurve, toneCurveRed, etc.), provide an array of [x, y] coordinate pairs, e.g., [[0,0], [128,128], [255,255]].`,
        `If a setting is not applicable or you don't have a suggestion for it, omit it from the JSON object. Do not include null or undefined values for optional fields.`,
        `Process Version should generally be a modern version like "13.3" if color grading or other modern features are used.`, 
        `Text prompt from user: "${textPrompt || 'No text prompt provided. Focus on the primary image and any inspiration images.'}"`,
        `Return ONLY the JSON string of the settings. Do not include any other text, explanations, or markdown formatting around the JSON output.`
    ].join('\n');

    // 3. Make the API call to Google AI:
    console.log('Sending request to Google Gemini AI...');
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = result.response;
    const aiResponseText = response.text();

    console.log('Raw AI Response Text:', aiResponseText);

    // Strip markdown code fences if present
    let jsonString = aiResponseText.trim();
    const codeFenceMatch = jsonString.match(/^```(?:[^\n]+)?\n([\s\S]*?)```$/);
    if (codeFenceMatch) {
      jsonString = codeFenceMatch[1];
    }

    // 4. Parse and normalize AI's response:
    try {
      const rawParsedSettings = JSON.parse(jsonString);
      const validatedSettings = validateAndNormalizeAISettings(rawParsedSettings);
      
      console.log('Validated & Normalized AI Settings:', validatedSettings);
      return validatedSettings;
    } catch (parseError: unknown) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`AI Response Parse Error: ${message}`);
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error during AI preset generation: ${message}`);
  }

  // --- Placeholder for OpenAI Integration --- 
  // if (provider === 'openai') {
  //   console.log('OpenAI integration would go here.');
  //   // 1. Initialize OpenAI client (using process.env.OPENAI_API_KEY)
  //   // 2. Prepare inputs (similar to Google, but may have different format requirements)
  //   // 3. Construct prompt for OpenAI model (e.g., GPT-4 Vision)
  //   // 4. Make API call to OpenAI
  //   // 5. Parse and normalize response
  // }

  // Fallback to simulated data until real AI integration is complete
  // This part should ideally not be reached if the try/catch above is comprehensive
  // const mainSCurve: ToneCurvePoint[] = [[0, 0],[64, 50],[128, 128],[192, 200],[255, 255]];
  // const redChannelCurve: ToneCurvePoint[] = [[0, 0],[192, 200],[255, 255]];

  // const simulatedAiOutput: LightroomSettings = {
  //   processVersion: "13.3",
  //   // ... (rest of simulated output)
  // };

  // console.log('Simulated AI Output with full HSL & Color Grading:', simulatedAiOutput);
  // return simulatedAiOutput;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateSimulatedSettings(reason?: string): LightroomSettings {
  console.warn(`Generating simulated Lightroom settings. Reason: ${reason || 'Fallback'}`);
  const mainSCurve: ToneCurvePoint[] = [[0, 0],[64, 50],[128, 128],[192, 200],[255, 255]];
  const redChannelCurve: ToneCurvePoint[] = [[0, 0],[192, 200],[255, 255]];

  const simulatedAiOutput: LightroomSettings = {
    processVersion: "6.7",
    cameraProfile: "Adobe Standard",
    exposure: +(Math.random() * 1 - 0.5).toFixed(2),
    contrast: Math.floor(Math.random() * 31) - 15,
    highlights: Math.floor(Math.random() * 61) - 30,
    shadows: Math.floor(Math.random() * 61) - 30,
    whites: Math.floor(Math.random() * 41) - 20,
    blacks: Math.floor(Math.random() * 41) - 20,
    texture: Math.floor(Math.random() * 31) - 15,
    clarity: Math.floor(Math.random() * 31) - 15,
    dehaze: Math.floor(Math.random() * 21) - 10,
    vibrance: Math.floor(Math.random() * 41) - 20,
    saturation: Math.floor(Math.random() * 41) - 20,
    temperature: Math.floor(Math.random() * 2000) + 4500, 
    tint: Math.floor(Math.random() * 21) - 10,
    toneCurvePV: "2012", 
    toneCurve: mainSCurve,
    toneCurveRed: redChannelCurve, 
    toneCurveGreen: [[0, 0], [255, 255]],
    toneCurveBlue: [[0, 0], [255, 255]],
    sharpeningAmount: Math.floor(Math.random() * 80) + 20, 
    sharpeningRadius: +(Math.random() * 1 + 0.8).toFixed(1), 
    sharpeningDetail: Math.floor(Math.random() * 50) + 25, 
    sharpeningMasking: Math.floor(Math.random() * 70),
    grainAmount: Math.floor(Math.random() * 30), 
    
    // Color Grading values
    colorGradeShadowHue: Math.floor(Math.random() * 360),
    colorGradeShadowSat: Math.floor(Math.random() * 70),
    colorGradeMidtoneHue: Math.floor(Math.random() * 360),
    colorGradeMidtoneSat: Math.floor(Math.random() * 70),
    colorGradeHighlightHue: Math.floor(Math.random() * 360),
    colorGradeHighlightSat: Math.floor(Math.random() * 70),
    colorGradeBlending: Math.floor(Math.random() * 101),
    colorGradeBalance: Math.floor(Math.random() * 101) - 50,
  };

  // Populate all HSL values
  for (const color of HSL_COLORS) {
    simulatedAiOutput[`hslHue${color}` as keyof LightroomSettings] = Math.floor(Math.random() * 21) - 10;         // -10 to +10
    simulatedAiOutput[`hslSaturation${color}` as keyof LightroomSettings] = Math.floor(Math.random() * 41) - 20; // -20 to +20
    simulatedAiOutput[`hslLuminance${color}` as keyof LightroomSettings] = Math.floor(Math.random() * 21);  // 0 to +20
  }

  console.log('Simulated AI Output with full HSL & Color Grading:', simulatedAiOutput);
  return simulatedAiOutput;
}

/**
 * Converts a LightroomSettings object into a fully‑formed XMP string that Lightroom can
 * import as a preset.  We rely on the `xmlbuilder2` package so the output is well‑formed
 * and escapes are handled automatically.
 *
 * @param settings    – Lightroom-style slider values produced by the AI.
 * @param presetName  – Name displayed inside Lightroom (defaults to "AI Generated Preset").
 * @returns             A UTF‑8 XMP side‑car file as a string.
 */
export function convertSettingsToXMP(
  settings: LightroomSettings,
  presetName: string = 'AI Generated Preset'
): string {
  const tagMap: Record<string, string> = {
    exposure: 'Exposure2012',
    contrast: 'Contrast2012',
    highlights: 'Highlights2012',
    shadows: 'Shadows2012',
    whites: 'Whites2012',
    blacks: 'Blacks2012',
    texture: 'Texture',
    clarity: 'Clarity2012',
    dehaze: 'Dehaze',
    vibrance: 'Vibrance',
    saturation: 'Saturation',
    temperature: 'Temperature',
    tint: 'Tint',
    toneCurvePV: 'ToneCurvePV', // Corrected: Holds the version string (e.g., "2012")
    toneCurve: 'ToneCurvePV2012', // Main composite (Luminance/RGB) curve points for PV2012
    toneCurveRed: 'ToneCurvePV2012Red', // Red channel curve points for PV2012
    toneCurveGreen: 'ToneCurvePV2012Green', // Green channel curve points for PV2012
    toneCurveBlue: 'ToneCurvePV2012Blue', // Blue channel curve points for PV2012
    sharpeningAmount: 'Sharpness',
    sharpeningRadius: 'SharpenRadius',
    sharpeningDetail: 'SharpenDetail',
    sharpeningMasking: 'SharpenEdgeMasking',
    grainAmount: 'GrainAmount',
    grainSize: 'GrainSize',
    grainFrequency: 'GrainFrequency',
    // Color Grading tags
    colorGradeShadowHue: 'ColorGradeShadowHue',
    colorGradeShadowSat: 'ColorGradeShadowSat',
    colorGradeShadowLum: 'ColorGradeShadowLum',
    colorGradeMidtoneHue: 'ColorGradeMidtoneHue',
    colorGradeMidtoneSat: 'ColorGradeMidtoneSat',
    colorGradeMidtoneLum: 'ColorGradeMidtoneLum',
    colorGradeHighlightHue: 'ColorGradeHighlightHue',
    colorGradeHighlightSat: 'ColorGradeHighlightSat',
    colorGradeHighlightLum: 'ColorGradeHighlightLum',
    colorGradeGlobalHue: 'ColorGradeGlobalHue',
    colorGradeGlobalSat: 'ColorGradeGlobalSat',
    colorGradeGlobalLum: 'ColorGradeGlobalLum',
    colorGradeBlending: 'ColorGradeBlending',
    colorGradeBalance: 'ColorGradeBalance',
    // Split Toning tags (for older PVs or specific needs)
    splitToningHighlightHue: 'SplitToningHighlightHue',
    splitToningHighlightSaturation: 'SplitToningHighlightSaturation',
    splitToningShadowHue: 'SplitToningShadowHue',
    splitToningShadowSaturation: 'SplitToningShadowSaturation',
    splitToningBalance: 'SplitToningBalance',
    cameraProfile: 'CameraProfile',
  };

  // Dynamically add HSL tags to the map
  for (const color of HSL_COLORS) {
    tagMap[`hslHue${color}`] = `HueAdjustment${color}`;
    tagMap[`hslSaturation${color}`] = `SaturationAdjustment${color}`;
    tagMap[`hslLuminance${color}`] = `LuminanceAdjustment${color}`;
  }

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('x:xmpmeta', {
      'xmlns:x': 'adobe:ns:meta/',
      'x:xmptk': 'Adobe XMP Core SDK 1.0' // Generic XMP Tookit ID
    })
    .ele('rdf:RDF', { 'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' })
      .ele('rdf:Description', {
        'rdf:about': '',
        'xmlns:crs': 'http://ns.adobe.com/camera-raw-settings/1.0/',
        // Add other namespaces if needed, e.g., for specific lens corrections or metadata
      });

  // Add settings from the map
  const seenXmpTags = new Set<string>(); // Keep track of XMP tags already written

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined || !tagMap[key]) continue;

    const tagName = tagMap[key];
    if (seenXmpTags.has(tagName)) continue; // Skip if this XMP tag has already been processed

    if (key.startsWith('toneCurve') && key !== 'toneCurvePV' && Array.isArray(value)) {
      const curveElement = root.ele('crs:' + tagName);
      const pointsArray = value as ToneCurvePoint[];
      if (pointsArray.length > 0) {
        const rdfSeq = curveElement.ele('rdf:Seq');
        for (const point of pointsArray) {
          rdfSeq.ele('rdf:li').txt(`${point[0]}, ${point[1]}`).up();
        }
        rdfSeq.up();
      }
      curveElement.up();
    } else {
      root.ele('crs:' + tagName).txt(String(value)).up();
    }
    seenXmpTags.add(tagName); // Mark this XMP tag as processed
  }

  // Essential preset metadata
  root.ele('crs:PresetType').txt('Normal').up();
  root.ele('crs:PresetName').txt(presetName).up();
  // Use a canonical ProcessVersion for compatibility with Lightroom Classic
  root.ele('crs:ProcessVersion').txt(settings.processVersion || '6.7').up();
  
  // Indicate that the preset has tone adjustments (if any tone curve settings are present)
  if (settings.toneCurvePV || settings.toneCurve || settings.toneCurveRed || settings.toneCurveGreen || settings.toneCurveBlue) {
    root.ele('crs:HasToneCurve').txt('True').up();
  }
  // Indicate that HSL adjustments are present (if any HSL settings are present)
  const hasHSL = Object.keys(settings).some(key => key.startsWith('hsl'));
  if (hasHSL) {
    root.ele('crs:HasSettings').txt('True').up(); // General flag, also indicates other settings
  }

  return root.doc().end({ prettyPrint: true, indent: '  ' });
}

/**
 * Persist an XMP preset to `outputPath`.
 */
export async function savePresetToFile(
  settings: LightroomSettings,
  outputPath: string,
  presetName?: string
): Promise<void> {
  const xmp = convertSettingsToXMP(settings, presetName);
  await fs.writeFile(outputPath, xmp, 'utf8');
}

/**
 * Formats LightroomSettings into a user-friendly string for manual input.
 */
export function formatSettingsForDisplay(settings: LightroomSettings): string {
  let displayString = 'Suggested Lightroom Settings:\n';
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;

    let formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
    
    if (key.startsWith('hsl')) {
      const mainPart = key.substring(3); // E.g., HueRed, SaturationOrange
      let type = '';
      let color = '';
      if (mainPart.startsWith('Hue')) { type = 'Hue'; color = mainPart.substring(3); }
      else if (mainPart.startsWith('Saturation')) { type = 'Saturation'; color = mainPart.substring(10); }
      else if (mainPart.startsWith('Luminance')) { type = 'Luminance'; color = mainPart.substring(9); }
      formattedKey = `HSL ${type} ${color.charAt(0).toUpperCase() + color.slice(1)}`;
    } else if (key.startsWith('toneCurve') && key !== 'toneCurvePV') {
      const curveType = key.substring(9); // Red, Green, Blue, or empty for main
      formattedKey = `Tone Curve ${curveType.charAt(0).toUpperCase() + curveType.slice(1)}`;
      const points = value as ToneCurvePoint[];
      displayString += `- ${formattedKey}: ${points.map(p => `(${p[0]},${p[1]})`).join(', ')}\n`;
      continue; // Skip default display for this key
    } else if (key.startsWith('colorGrade')) {
        const part = key.substring(10); // ShadowHue, MidtoneSat, GlobalLum, Blending, Balance
        let section = '';
        let property = '';

        if (part.startsWith('Shadow')) { section = 'Shadows'; property = part.substring(6); }
        else if (part.startsWith('Midtone')) { section = 'Midtones'; property = part.substring(7); }
        else if (part.startsWith('Highlight')) { section = 'Highlights'; property = part.substring(9); }
        else if (part.startsWith('Global')) { section = 'Global'; property = part.substring(6); }
        else if (part === 'Blending') { section = 'Color Grading'; property = 'Blending';}
        else if (part === 'Balance') { section = 'Color Grading'; property = 'Balance';}

        if (property) { property = property.charAt(0).toUpperCase() + property.slice(1);}
        
        formattedKey = section ? `Color Grading ${section} ${property}` : `Color Grading ${part.charAt(0).toUpperCase() + part.slice(1)}`;
    } else {
      formattedKey = formattedKey.replace(/([A-Z])/g, ' $1'); 
    }
    displayString += `- ${formattedKey}: ${value}\n`;
  }
  return displayString;
}

/* ------------------------------ CLI Support ------------------------------ */
if (require.main === module) {
  (async () => {
    const [, , settingsPath, outputPath = 'preset.xmp', presetName = 'AI Generated Preset'] = process.argv;

    if (!settingsPath) {
      console.error('Usage: ts-node presetUtils.ts <settings.json> [output.xmp] [presetName]');
      process.exit(1);
    }

    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      const settings: LightroomSettings = JSON.parse(raw);
      await savePresetToFile(settings, outputPath, presetName);
      console.log(`✅  Saved XMP preset to ${outputPath}`);
    } catch (err) {
      console.error('❌  Failed to generate preset:', err);
      process.exit(1);
    }
  })();
}
/* ------------------------------------------------------------------------ */

// --- AI Output Validation and Normalization ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateAndNormalizeAISettings(rawSettings: any): LightroomSettings {
  const normalized: Partial<LightroomSettings> = {};

  if (typeof rawSettings !== 'object' || rawSettings === null) {
    console.warn('AI setting: Raw settings is not an object. Returning empty settings.');
    return { processVersion: "13.3" }; // Minimal valid settings
  }

  // Helper to safely get and validate a number
  const getNumber = (key: keyof LightroomSettings, min?: number, max?: number, defaultValue?: number, allowFloats: boolean = true): number | undefined => {
    if (!(key in rawSettings) && defaultValue === undefined) return undefined;
    let val = rawSettings[key];
    if (val === undefined && defaultValue !== undefined) val = defaultValue;

    if (typeof val !== 'number' || isNaN(val)) {
      console.warn(`AI setting: Invalid type for ${String(key)}. Expected number, got ${typeof val} (${val}). Skipping or using default.`);
      return defaultValue !== undefined ? ( (min !== undefined && max !== undefined) ? clamp(defaultValue, min, max) : defaultValue) : undefined;
    }
    if (!allowFloats && !Number.isInteger(val)) {
        console.warn(`AI setting: Invalid type for ${String(key)}. Expected integer, got float (${val}). Skipping or using default.`);
        return defaultValue !== undefined ? ( (min !== undefined && max !== undefined) ? clamp(defaultValue, min, max) : defaultValue) : undefined;
    }
    return (min !== undefined && max !== undefined) ? clamp(val, min, max) : val;
  };

  // Helper to safely get a string
  const getString = (key: keyof LightroomSettings, defaultValue?: string): string | undefined => {
    if (!(key in rawSettings) && defaultValue === undefined) return undefined;
    let val = rawSettings[key];
    if (val === undefined && defaultValue !== undefined) val = defaultValue;
    
    if (typeof val !== 'string') {
      console.warn(`AI setting: Invalid type for ${String(key)}. Expected string, got ${typeof val}. Skipping or using default.`);
      return defaultValue;
    }
    return val;
  };

  // Helper for tone curve points
  const getToneCurve = (key: keyof LightroomSettings): ToneCurvePoint[] | undefined => {
      if (!(key in rawSettings)) return undefined;
      const curveData = rawSettings[key];
      if (!Array.isArray(curveData)) {
          console.warn(`AI setting: Invalid type for ${String(key)}. Expected array, got ${typeof curveData}. Skipping.`);
          return undefined;
      }
      const validPoints: ToneCurvePoint[] = [];
      for (const point of curveData) {
          if (Array.isArray(point) && point.length === 2 &&
              typeof point[0] === 'number' && typeof point[1] === 'number' &&
              !isNaN(point[0]) && !isNaN(point[1])) {
              validPoints.push([clamp(point[0], 0, 255), clamp(point[1], 0, 255)] as ToneCurvePoint);
          } else {
              console.warn(`AI setting: Invalid point in ${String(key)}: ${JSON.stringify(point)}. Skipping point.`);
          }
      }
      return validPoints.length > 0 ? validPoints : undefined;
  };

  // --- Basic Panel ---
  normalized.exposure = getNumber('exposure', -5, 5, 0);
  normalized.contrast = getNumber('contrast', -100, 100, 0);
  normalized.highlights = getNumber('highlights', -100, 100, 0);
  normalized.shadows = getNumber('shadows', -100, 100, 0);
  normalized.whites = getNumber('whites', -100, 100, 0);
  normalized.blacks = getNumber('blacks', -100, 100, 0);
  normalized.texture = getNumber('texture', -100, 100, 0);
  normalized.clarity = getNumber('clarity', -100, 100, 0);
  normalized.dehaze = getNumber('dehaze', -100, 100, 0);
  normalized.vibrance = getNumber('vibrance', -100, 100, 0);
  normalized.saturation = getNumber('saturation', -100, 100, 0);

  // --- White Balance ---
  normalized.temperature = getNumber('temperature', 2000, 50000, 6500, false); // Usually integers
  normalized.tint = getNumber('tint', -150, 150, 0, false); // Usually integers

  // --- Tone Curve ---
  normalized.toneCurvePV = getString('toneCurvePV', "2012");
  normalized.toneCurve = getToneCurve('toneCurve');
  normalized.toneCurveRed = getToneCurve('toneCurveRed');
  normalized.toneCurveGreen = getToneCurve('toneCurveGreen');
  normalized.toneCurveBlue = getToneCurve('toneCurveBlue');

  // --- HSL ---
  HSL_COLORS.forEach(color => {
    normalized[`hslHue${color}` as keyof LightroomSettings] = getNumber(`hslHue${color}` as keyof LightroomSettings, -100, 100, 0, false);
    normalized[`hslSaturation${color}` as keyof LightroomSettings] = getNumber(`hslSaturation${color}` as keyof LightroomSettings, -100, 100, 0, false);
    normalized[`hslLuminance${color}` as keyof LightroomSettings] = getNumber(`hslLuminance${color}` as keyof LightroomSettings, -100, 100, 0, false);
  });

  // --- Detail - Sharpening ---
  normalized.sharpeningAmount = getNumber('sharpeningAmount', 0, 150, 0, false);
  normalized.sharpeningRadius = getNumber('sharpeningRadius', 0.5, 3.0, 1.0);
  normalized.sharpeningDetail = getNumber('sharpeningDetail', 0, 100, 25, false);
  normalized.sharpeningMasking = getNumber('sharpeningMasking', 0, 100, 0, false);

  // --- Effects - Grain ---
  normalized.grainAmount = getNumber('grainAmount', 0, 100, 0, false);
  normalized.grainSize = getNumber('grainSize', 0, 100, 25, false); // Grain size has a typical floor in LR UI but 0 is valid
  normalized.grainFrequency = getNumber('grainFrequency', 0, 100, 50, false); // Roughness

  // --- Color Grading ---
  normalized.colorGradeShadowHue = getNumber('colorGradeShadowHue', 0, 359, 0, false);
  normalized.colorGradeShadowSat = getNumber('colorGradeShadowSat', 0, 100, 0, false);
  normalized.colorGradeShadowLum = getNumber('colorGradeShadowLum', -100, 100, 0);
  normalized.colorGradeMidtoneHue = getNumber('colorGradeMidtoneHue', 0, 359, 0, false);
  normalized.colorGradeMidtoneSat = getNumber('colorGradeMidtoneSat', 0, 100, 0, false);
  normalized.colorGradeMidtoneLum = getNumber('colorGradeMidtoneLum', -100, 100, 0);
  normalized.colorGradeHighlightHue = getNumber('colorGradeHighlightHue', 0, 359, 0, false);
  normalized.colorGradeHighlightSat = getNumber('colorGradeHighlightSat', 0, 100, 0, false);
  normalized.colorGradeHighlightLum = getNumber('colorGradeHighlightLum', -100, 100, 0);
  normalized.colorGradeGlobalHue = getNumber('colorGradeGlobalHue', 0, 359, 0, false);
  normalized.colorGradeGlobalSat = getNumber('colorGradeGlobalSat', 0, 100, 0, false);
  normalized.colorGradeGlobalLum = getNumber('colorGradeGlobalLum', -100, 100, 0);
  normalized.colorGradeBlending = getNumber('colorGradeBlending', 0, 100, 50, false);
  normalized.colorGradeBalance = getNumber('colorGradeBalance', -100, 100, 0);
  
  // --- Split Toning ---
  normalized.splitToningHighlightHue = getNumber('splitToningHighlightHue', 0, 359, undefined, false);
  normalized.splitToningHighlightSaturation = getNumber('splitToningHighlightSaturation', 0, 100, undefined, false);
  normalized.splitToningShadowHue = getNumber('splitToningShadowHue', 0, 359, undefined, false);
  normalized.splitToningShadowSaturation = getNumber('splitToningShadowSaturation', 0, 100, undefined, false);
  normalized.splitToningBalance = getNumber('splitToningBalance', -100, 100, undefined);


  // --- Camera Profile & Process Version ---
  normalized.cameraProfile = getString('cameraProfile', "Adobe Standard");
  normalized.processVersion = getString('processVersion', "13.3"); // Ensure this is a modern PV
  if (!["6.7", "11.0", "12.0", "13.0", "13.1", "13.2", "13.3", "14.0", "15.0", "16.0"].includes(normalized.processVersion as string)) { // Example valid PVs
      console.warn(`AI setting: Invalid ProcessVersion "${normalized.processVersion}". Defaulting to 13.3.`);
      normalized.processVersion = "13.3";
  }
  
  // Clean up undefined properties from normalized object before returning
  Object.keys(normalized).forEach(keyStr => {
    const key = keyStr as keyof LightroomSettings;
    if (normalized[key] === undefined) {
      delete normalized[key];
    }
  });

  return normalized as LightroomSettings;
}