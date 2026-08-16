import { RATE_LIMITS } from '../generated/rate-limits';
import { t } from '@/i18n';
import type { ImageUploadSettings } from '@/types/categories';

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
      reject(new Error(`[IMG-DECODE] ${t('image.decodeFailed', { details: fileDetails(file) })}`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, webpQuality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('image.imgCanvasTheBrowserCannotOutputTheImage'));
        return;
      }
      resolve(blob);
    }, 'image/webp', webpQuality);
  });
}

async function canvasToWebp(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, webpQuality: number) {
  const nativeBlob = await canvasToBlob(canvas, webpQuality);
  if (nativeBlob.type === 'image/webp' && await isWebpFile(nativeBlob)) {
    return nativeBlob;
  }

  webpEncoderPromise ??= import('@jsquash/webp/encode');
  const { default: encode } = await webpEncoderPromise;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const encoded = await encode(imageData, { quality: webpQuality * 100 });
  const fallbackBlob = new Blob([encoded], { type: 'image/webp' });
  if (!await isWebpFile(fallbackBlob)) {
    throw new Error(`[IMG-WEBP] ${t('image.webpEncodeFailed', { type: nativeBlob.type || 'unknown' })}`);
  }
  return fallbackBlob;
}

function outputDimensions(width: number, height: number, scale: number, maxImageDimension: number) {
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

export async function processImageForUpload(file: File, settings: ImageUploadSettings): Promise<ProcessedImage> {
  const maxImageUploadBytes = settings.maxUploadKilobytes * 1024;
  const maxImageSourceBytes = settings.maxSourceMegabytes * 1024 * 1024;
  const maxImageDimension = settings.maxDimension;
  const { webpQuality } = settings;
  const { outputScales } = RATE_LIMITS.imageCompression;
  if (file.size <= 0) {
    throw new Error(`[IMG-SOURCE-EMPTY] ${t('image.empty', { details: fileDetails(file) })}`);
  }
  if (file.size > maxImageSourceBytes) {
    throw new Error(`[IMG-SOURCE-SIZE] ${t('image.sourceTooLarge', {
      megabytes: settings.maxSourceMegabytes,
      details: fileDetails(file),
    })}`);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`[IMG-SOURCE-TYPE] ${t('image.invalidType', { details: fileDetails(file) })}`);
  }

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('image.unableToReadImageDimensions');
  }
  if (
    file.size <= maxImageUploadBytes
    && sourceWidth <= maxImageDimension
    && sourceHeight <= maxImageDimension
    && await isWebpFile(file)
  ) {
    return { file, height: sourceHeight, width: sourceWidth };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('image.thisBrowserCannotHandleImages');

  try {
    for (const scale of outputScales) {
      const size = outputDimensions(sourceWidth, sourceHeight, scale, maxImageDimension);
      canvas.width = size.width;
      canvas.height = size.height;
      context.clearRect(0, 0, size.width, size.height);
      context.drawImage(image, 0, 0, size.width, size.height);

      const blob = await canvasToWebp(canvas, context, webpQuality);
      if (!await isWebpFile(blob)) {
        throw new Error(`[IMG-WEBP] ${t('image.webpInvalid', { type: blob.type, size: blob.size })}`);
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

  throw new Error(t('image.outputTooLarge', {
    kilobytes: settings.maxUploadKilobytes,
  }));
}
