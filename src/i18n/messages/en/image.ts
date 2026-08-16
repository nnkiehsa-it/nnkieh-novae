const messages = {
  'image.decodeFailed': 'Unable to load image; {details}',
  'image.empty': 'The image file is empty; {details}',
  'image.invalidType': 'Please select a valid image file; {details}',
  'image.outputTooLarge': 'The image still exceeds {kilobytes} KB after compression. Please use a smaller image.',
  'image.webpEncodeFailed': 'Unable to convert the image; format={type}',
  'image.webpInvalid': 'The browser did not produce a valid image; type={type}, size={size}',
  'image.unableToReadImageDimensions': 'Unable to read image dimensions.',
  'image.theImageUploadIsNotCompletelyCompleted': 'The image upload did not finish completely.',
  'image.enlargeImageImageAltFallbackalt': 'Enlarge image: {alt}',
  'image.imagesMustBeConvertedToWebpBeforeUploading': 'Images must be converted before uploading.',
  'image.thisBrowserCannotHandleImages': 'This browser cannot process images.',
  'image.uploadVerificationTimeout': 'Image upload verification timed out. Select another image and try again.',
  'image.unsupportedFormat': 'This image format is not supported. Please choose another image.',
  'image.theImageUploadJobIsNotSetUpCompletely': 'The image upload could not be prepared completely.',
  'image.imageSizeExceedsUploadLimit': 'The image exceeds the upload size limit.',
  'image.imageProcessingFailedPleaseTryAgainLater': 'Image processing failed. Please try again later.',
  'image.resultImageForTitle': 'Result image for {title}',
  'image.imgCanvasTheBrowserCannotOutputTheImage': 'The browser cannot export the image.',
} as const;

export default messages;
