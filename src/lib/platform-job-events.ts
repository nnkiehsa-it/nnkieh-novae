const PLATFORM_JOBS_CHANGED_EVENT = "novae:platform-jobs-changed";

export function notifyPlatformJobsChanged() {
  window.dispatchEvent(new Event(PLATFORM_JOBS_CHANGED_EVENT));
}

export function subscribePlatformJobsChanged(listener: () => void) {
  window.addEventListener(PLATFORM_JOBS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(PLATFORM_JOBS_CHANGED_EVENT, listener);
}
