import { asString } from "./http.ts";
import { maxUploadBytes, type ImageUploadSettings } from "./platform-settings.ts";

export function imageFitsUploadLimits(
  image: { bytes: number; width: number; height: number },
  settings: ImageUploadSettings,
) {
  return image.bytes > 0 && image.bytes <= maxUploadBytes(settings)
    && image.width > 0 && image.width <= settings.maxDimension
    && image.height > 0 && image.height <= settings.maxDimension;
}

export function readCloudinaryImage(metadata: Record<string, unknown>, settings: ImageUploadSettings) {
  const image = {
    bytes: Number(metadata.bytes),
    width: Number(metadata.width),
    height: Number(metadata.height),
  };
  return {
    ...image,
    valid: asString(metadata.format).toLowerCase() === "webp"
      && asString(metadata.resource_type) === "image"
      && asString(metadata.type) === "authenticated"
      && imageFitsUploadLimits(image, settings),
  };
}
