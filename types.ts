export interface ProcessedRow {
  id: string;
  file1: File | null;
  file2: File | null;
  imgData1: ImageData | null;
  imgData2: ImageData | null;
  processedCanvas: HTMLCanvasElement | null;
  timestamp: number;
  rowLabel: string;
}

export interface ProcessingConfig {
  targetWidth: number;
  targetHeight: number;
  targetIntensity: number;
  padding: number;
  randomness: number; // 0.0 to 1.0
  clipBottom: number; // Pixels to exclude from bottom
  columnLabels: [string, string, string];
  rowLabelFontSize: number;
  columnLabelFontSize: number;
  fontFamily: string;
  showLabels: boolean;
}

// Global definition for the UTIF library loaded via CDN
declare global {
  interface Window {
    UTIF: any;
  }
}