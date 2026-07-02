import { useToast } from '@/composables/useToast';

function copyWithTextarea(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('copy failed');
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  copyWithTextarea(text);
}

export function useShareUrl() {
  const { showToast } = useToast();

  async function copyShareUrl(url: string) {
    try {
      await copyText(url);
      showToast('分享連結已複製。', 'success');
      return true;
    } catch {
      showToast('無法複製分享連結，請稍後再試。', 'error');
      return false;
    }
  }

  return {
    copyShareUrl,
  };
}
