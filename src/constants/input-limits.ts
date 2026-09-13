import { getOperationPolicy } from '@/lib/operation-policies';
export const INPUT_LIMITS = {
  get title() { return getOperationPolicy('titleLength'); },
  get content() { return getOperationPolicy('contentLength'); },
  get comment() { return getOperationPolicy('commentLength'); },
  get facilityLocation() { return getOperationPolicy('locationLength'); },
  get resultContent() { return getOperationPolicy('resultLength'); },
} as const;
