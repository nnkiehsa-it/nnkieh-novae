const messages = {
  'image.decodeFailed': '無法載入圖片；{details}',
  'image.empty': '圖片檔案是空的；{details}',
  'image.invalidType': '請選擇有效的圖片檔案；{details}',
  'image.outputTooLarge': '圖片壓縮後仍超過 {kilobytes} KB，請改用較小的圖片。',
  'image.webpEncodeFailed': '圖片轉換失敗；format={type}',
  'image.webpInvalid': '瀏覽器未產生有效圖片；type={type}, size={size}',
  'image.unableToReadImageDimensions': '無法讀取圖片尺寸。',
  'image.theImageUploadIsNotCompletelyCompleted': '圖片上傳未完整完成。',
  'image.enlargeImageImageAltFallbackalt': '放大圖片：{alt}',
  'image.imagesMustBeConvertedToWebpBeforeUploading': '圖片必須先轉換後才能上傳。',
  'image.thisBrowserCannotHandleImages': '此瀏覽器無法處理圖片。',
  'image.uploadVerificationTimeout': '圖片上傳驗證已逾時，請重新選擇圖片後再試。',
  'image.unsupportedFormat': '圖片格式不受支援，請重新選擇圖片。',
  'image.theImageUploadJobIsNotSetUpCompletely': '圖片上傳準備未完整完成。',
  'image.imageSizeExceedsUploadLimit': '圖片大小超過上傳限制。',
  'image.imageProcessingFailedPleaseTryAgainLater': '圖片處理失敗，請稍後再試。',
  'image.resultImageForTitle': '{title} 的處理結果圖片',
  'image.imgCanvasTheBrowserCannotOutputTheImage': '瀏覽器無法輸出圖片。',
} as const;

export default messages;
