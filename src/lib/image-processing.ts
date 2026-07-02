import { RATE_LIMITS } from '../generated/rate-limits';

const {
  maxUploadBytes: maxImageUploadBytes,
  maxSourceBytes: maxImageSourceBytes,
  maxDimension: maxImageDimension,
  maxPixels: maxImagePixels,
  webpQuality,
  outputScales,
} = RATE_LIMITS.imageCompression;
let webpEncoderPromise: Promise<typeof import('@jsquash/webp/encode')> | null = null;

interface ProcessedImage {
  file: File;
  height: number;
  width: number;
}

function fileDetails(file: Blob) {
  return `type=${file.type || 'unknown'}, size=${file.size}, ua=${navigator.userAgent}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function isWebpFile(file: Blob) {
  if (file.size < 12) return false;
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return String.fromCharCode(...header.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`[IMG-DECODE] 無法載入圖片；${fileDetails(file)}`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('[IMG-CANVAS] 瀏覽器無法輸出圖片。'));
        return;
      }
      resolve(blob);
    }, 'image/webp', webpQuality);
  });
}

async function canvasToWebp(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const nativeBlob = await canvasToBlob(canvas);
  if (nativeBlob.type === 'image/webp' && await isWebpFile(nativeBlob)) {
    return nativeBlob;
  }

  webpEncoderPromise ??= import('@jsquash/webp/encode');
  const { default: encode } = await webpEncoderPromise;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const encoded = await encode(imageData, { quality: webpQuality * 100 });
  const fallbackBlob = new Blob([encoded], { type: 'image/webp' });
  if (!await isWebpFile(fallbackBlob)) {
    throw new Error(`[IMG-WEBP] WebP 編碼失敗；nativeType=${nativeBlob.type || 'unknown'}`);
  }
  return fallbackBlob;
}

function outputDimensions(width: number, height: number, scale: number) {
  const dimensionScale = Math.min(1, maxImageDimension / Math.max(width, height)) * scale;
  return {
    height: Math.max(1, Math.round(height * dimensionScale)),
    width: Math.max(1, Math.round(width * dimensionScale)),
  };
}

function webpFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/u, '') || 'image';
  return `${baseName}.webp`;
}

export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  if (file.size <= 0) {
    throw new Error(`[IMG-SOURCE-EMPTY] 圖片檔案是空的；${fileDetails(file)}`);
  }
  if (file.size > maxImageSourceBytes) {
    throw new Error(`[IMG-SOURCE-SIZE] 原始圖片不能超過 ${RATE_LIMITS.imageCompression.maxSourceMegabytes} MB；${fileDetails(file)}`);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`[IMG-SOURCE-TYPE] 請選擇有效的圖片檔案；${fileDetails(file)}`);
  }

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('無法讀取圖片尺寸。');
  }
  if (sourceWidth * sourceHeight > maxImagePixels) {
    throw new Error(`[IMG-SOURCE-PIXELS] 圖片解析度過高；dimensions=${sourceWidth}x${sourceHeight}`);
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('此瀏覽器無法處理圖片。');

  try {
    for (const scale of outputScales) {
      const size = outputDimensions(sourceWidth, sourceHeight, scale);
      canvas.width = size.width;
      canvas.height = size.height;
      context.clearRect(0, 0, size.width, size.height);
      context.drawImage(image, 0, 0, size.width, size.height);

      const blob = await canvasToWebp(canvas, context);
      if (!await isWebpFile(blob)) {
        throw new Error(`[IMG-WEBP] 瀏覽器未產生有效的 WebP；type=${blob.type}, size=${blob.size}`);
      }
      if (blob.size <= maxImageUploadBytes) {
        return {
          file: new File([blob], webpFileName(file.name), {
            lastModified: Date.now(),
            type: 'image/webp',
          }),
          ...size,
        };
      }
    }
  } catch (error) {
    if (errorMessage(error).startsWith('[IMG-')) throw error;
    throw new Error(`[IMG-ENCODE] ${errorMessage(error)}；source=${sourceWidth}x${sourceHeight}`, { cause: error });
  }

  throw new Error(`圖片壓縮後仍超過 ${RATE_LIMITS.imageCompression.maxUploadKilobytes} KB，請改用較小的圖片。`);
}
