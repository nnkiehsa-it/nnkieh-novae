import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

export function AdminPagination({ page, hasMore, busy, onChange }: {
  page: number; hasMore: boolean; busy: boolean; onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  return <nav className="flex items-center justify-between gap-3" aria-label={t('ui.operations.pagination')}>
    <Button variant="secondary" disabled={busy || page === 0} onClick={() => onChange(page - 1)}>{t('ui.operations.previousPage')}</Button>
    <span className="text-sm tabular-nums" aria-live="polite">{page + 1}</span>
    <Button variant="secondary" disabled={busy || !hasMore} onClick={() => onChange(page + 1)}>{t('ui.operations.nextPage')}</Button>
  </nav>;
}
