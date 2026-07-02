import { watch, type ComputedRef } from 'vue';

export function useDocumentTitle(title: ComputedRef<string>, defaultTitle: string) {
  function updateDocumentTitle() {
    document.title = `${title.value} | ${defaultTitle}`;
  }

  watch(title, updateDocumentTitle, { immediate: true });

  function restoreDocumentTitle() {
    document.title = defaultTitle;
  }

  return {
    restoreDocumentTitle,
  };
}
