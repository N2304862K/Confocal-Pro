import { ProcessingConfig } from '../types';

const UTIF = window.UTIF;

export const decodeTiff = async (file: File): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const ifds = UTIF.decode(buffer);
        if (!ifds || ifds.length === 0) {
          reject(new Error("Invalid TIFF file"));
          return;
        }
        const firstPage = ifds[0];
        UTIF.decodeImage(buffer, firstPage);
        const rgba = UTIF.toRGBA8(firstPage);
        const imageData = new ImageData(new Uint8ClampedArray(rgba), firstPage.width, firstPage.height);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Calculate integral image for fast ROI sum calculation
const computeIntegralImage = (data: Uint8ClampedArray, width: number, height: number): Float32Array => {
  const integral = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Use standard luminance: 0.299R + 0.587G + 0.114B
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      rowSum += lum;
      if (y === 0) {
        integral[y * width + x] = rowSum;
      } else {
        integral[y * width + x] = rowSum + integral[(y - 1) * width + x];
      }
    }
  }
  return integral;
};

// Get sum of rectangle from integral image
const getRectSum = (integral: Float32Array, width: number, x: number, y: number, w: number, h: number): number => {
  const x2 = x + w - 1;
  const y2 = y + h - 1;
  
  const A = (x > 0 && y > 0) ? integral[(y - 1) * width + (x - 1)] : 0;
  const B = (y > 0) ? integral[(y - 1) * width + x2] : 0;
  const C = (x > 0) ? integral[y2 * width + (x - 1)] : 0;
  const D = integral[y2 * width + x2];
  
  return D - B - C + A;
};

export const findCoBrightestROI = (
  img1: ImageData, 
  img2: ImageData, 
  targetAspectRatio: number,
  clipBottom: number
): { x: number, y: number, w: number, h: number } => {
  const w = img1.width;
  // Reduce effective height by the clipped amount to avoid text at bottom
  const h = Math.max(1, img1.height - clipBottom);
  
  // Calculate crop dimensions based on source size and target aspect ratio
  // We want to maximize the crop area within the 512x512 image
  let cropW = w;
  let cropH = Math.floor(w / targetAspectRatio);
  
  if (cropH > h) {
    cropH = h;
    cropW = Math.floor(h * targetAspectRatio);
  }

  const integral1 = computeIntegralImage(img1.data, w, img1.height);
  const integral2 = computeIntegralImage(img2.data, w, img1.height);

  let maxBrightness = -1;
  let bestX = 0;
  let bestY = 0;

  // Stride for performance
  const stride = 4; 

  // Ensure y loop doesn't go past the effective height
  for (let y = 0; y <= h - cropH; y += stride) {
    for (let x = 0; x <= w - cropW; x += stride) {
      const sum1 = getRectSum(integral1, w, x, y, cropW, cropH);
      const sum2 = getRectSum(integral2, w, x, y, cropW, cropH);
      
      const total = sum1 + sum2;
      
      if (total > maxBrightness) {
        maxBrightness = total;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { x: bestX, y: bestY, w: cropW, h: cropH };
};

export const processRow = (
  img1: ImageData,
  img2: ImageData,
  config: ProcessingConfig,
  rowLabel: string,
  isFirstRow: boolean
): HTMLCanvasElement => {
  // 1.5.1 Get Ratio and Crop Co-brightest
  const ratio = config.targetWidth / config.targetHeight;
  const roi = findCoBrightestROI(img1, img2, ratio, config.clipBottom);

  // Helper to process a single image crop
  const processChannel = (source: ImageData, roi: {x: number, y: number, w: number, h: number}, colorFilter: 'red' | 'green' | 'blue' | 'merge') => {
    // Create temp canvas for cropping and resizing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = config.targetWidth;
    tempCanvas.height = config.targetHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    // Draw full source to temp offscreen to crop easily (standard API)
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = source.width;
    sourceCanvas.height = source.height;
    const sCtx = sourceCanvas.getContext('2d')!;
    sCtx.putImageData(source, 0, 0);

    // Draw crop to target size (Resizing logic 1.5.2)
    ctx.drawImage(sourceCanvas, roi.x, roi.y, roi.w, roi.h, 0, 0, config.targetWidth, config.targetHeight);

    // Brightness Adjustment (1.5.1: 200 +- stochastic)
    const processed = ctx.getImageData(0, 0, config.targetWidth, config.targetHeight);
    const data = processed.data;
    
    // Calculate current max intensity of this crop (simple approach)
    let max = 1;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.max(data[i], data[i+1], data[i+2]);
      if (val > max) max = val;
    }

    // Stochastic factor
    // config.randomness is a range, e.g., 0.05 means +/- 2.5% variation
    const randomShift = (Math.random() * config.randomness) - (config.randomness / 2);
    const stochastic = 1 + randomShift;
    
    const target = config.targetIntensity * stochastic;
    const scale = target / max; 

    for (let i = 0; i < data.length; i += 4) {
      // Apply scale
      let r = data[i] * scale;
      let g = data[i+1] * scale;
      let b = data[i+2] * scale;
      
      // Clamp
      r = Math.min(255, r);
      g = Math.min(255, g);
      b = Math.min(255, b);

      data[i] = r;
      data[i+1] = g;
      data[i+2] = b;
    }
    
    ctx.putImageData(processed, 0, 0);
    return tempCanvas;
  };

  const c1 = processChannel(img1, roi, 'green');
  const c2 = processChannel(img2, roi, 'red');

  // Create Merge
  const mergedCanvas = document.createElement('canvas');
  mergedCanvas.width = config.targetWidth;
  mergedCanvas.height = config.targetHeight;
  const mCtx = mergedCanvas.getContext('2d')!;
  
  // Fill merge background white before drawing (for any transparent pixels, though usually confocal is full frame)
  mCtx.fillStyle = 'black'; // Keep merge background black for contrast, but outer will be white
  mCtx.fillRect(0, 0, config.targetWidth, config.targetHeight);
  
  if (c1 && c2) {
    const d1 = c1.getContext('2d')!.getImageData(0,0, config.targetWidth, config.targetHeight).data;
    const d2 = c2.getContext('2d')!.getImageData(0,0, config.targetWidth, config.targetHeight).data;
    const mData = mCtx.createImageData(config.targetWidth, config.targetHeight);
    
    for(let i=0; i<mData.data.length; i+=4) {
        const gray1 = d1[i]; // assuming R=G=B for grayscale input
        const gray2 = d2[i];
        
        const isGray1 = (d1[i] === d1[i+1]) && (d1[i+1] === d1[i+2]);
        
        if (isGray1) {
             mData.data[i] = gray2; // R
             mData.data[i+1] = gray1; // G
             mData.data[i+2] = 0; // B
        } else {
            // Already colored, additive blend
            mData.data[i] = Math.min(255, d1[i] + d2[i]);
            mData.data[i+1] = Math.min(255, d1[i+1] + d2[i+1]);
            mData.data[i+2] = Math.min(255, d1[i+2] + d2[i+2]);
        }
        mData.data[i+3] = 255;
    }
    mCtx.putImageData(mData, 0, 0);
  }

  // 1.5.3 Layout: [Img1] [Img2] [Merged] with 10px padding between
  const finalCanvas = document.createElement('canvas');
  const finalWidth = (config.targetWidth * 3) + (config.padding * 2);
  finalCanvas.width = finalWidth;
  finalCanvas.height = config.targetHeight;
  
  const fCtx = finalCanvas.getContext('2d')!;
  
  // Set Background to White
  fCtx.fillStyle = '#ffffff';
  fCtx.fillRect(0, 0, finalWidth, config.targetHeight);
  
  if (c1) fCtx.drawImage(c1, 0, 0);
  if (c2) fCtx.drawImage(c2, config.targetWidth + config.padding, 0);
  fCtx.drawImage(mergedCanvas, (config.targetWidth + config.padding) * 2, 0);

  // Labels
  if (config.showLabels) {
    const fontFamily = config.fontFamily || 'sans-serif';

    // Row Label (Condition) - Bottom Left of Left Image
    if (rowLabel) {
      const fontSize = config.rowLabelFontSize || 24;
      fCtx.font = `bold ${fontSize}px ${fontFamily}`;
      fCtx.fillStyle = '#ffffff';
      fCtx.textBaseline = 'bottom';
      fCtx.textAlign = 'left';
      fCtx.shadowColor = 'rgba(0,0,0,0.8)';
      fCtx.shadowBlur = 4;
      // Padding from edge
      fCtx.fillText(rowLabel, 10, config.targetHeight - 10);
      fCtx.shadowBlur = 0; // reset
    }

    // Column Labels (Type) - Top Left of First Row Images
    if (isFirstRow && config.columnLabels) {
      const fontSize = config.columnLabelFontSize || 24;
      fCtx.font = `bold ${fontSize}px ${fontFamily}`;
      fCtx.fillStyle = '#ffffff';
      fCtx.textBaseline = 'top';
      fCtx.textAlign = 'left';
      fCtx.shadowColor = 'rgba(0,0,0,0.8)';
      fCtx.shadowBlur = 4;
      
      const pad = 10;
      
      // Image 1
      fCtx.fillText(config.columnLabels[0], pad, pad);
      
      // Image 2
      fCtx.fillText(config.columnLabels[1], config.targetWidth + config.padding + pad, pad);
      
      // Image 3 (Merge)
      fCtx.fillText(config.columnLabels[2], (config.targetWidth + config.padding) * 2 + pad, pad);
      
      fCtx.shadowBlur = 0;
    }
  }

  return finalCanvas;
};