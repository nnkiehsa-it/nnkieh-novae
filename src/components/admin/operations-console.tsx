"use client";
import { useOperationsConsole } from '@/hooks/use-operations-console';
import { OPERATION_POLICIES, type OperationPolicyKey } from '@/generated/operations';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/page-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformNumberSetting } from './platform-number-setting';
import { ProviderDiagnostics } from './provider-diagnostics';
import { AdminPagination } from './admin-pagination';

function bytes(value: number) { return `${(value / 1048576).toFixed(2)} MiB`; }

export function OperationsConsole() {
  const state = useOperationsConsole();
  const { t } = useI18n();
  return <section className="min-w-0 space-y-5" aria-busy={state.busy}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{t('ui.operations.title')}</h2>
      <Button disabled={state.busy} onClick={() => void state.load()} variant="secondary">{t('ui.adminConsole.refresh')}</Button>
    </div>
    {state.error ? <ErrorState error={state.error} onRetry={() => void state.load()} /> : null}
    {!state.data ? <Skeleton className="h-48 w-full" /> : <>
      <ProviderDiagnostics />
      <p className="text-sm text-muted-foreground">{t('ui.operations.recordsPageHelp')}</p>
      <AdminPagination page={state.page} hasMore={state.data.hasMore} busy={state.busy} onChange={next => void state.changePage(next)} />
      <Card><CardContent className="space-y-4 pt-5">
        <h3 className="font-semibold">{t('ui.operations.storage')} · {bytes(state.data.databaseBytes)}</h3>
        <p className="text-sm text-muted-foreground">{t('ui.operations.storageHelp')}</p>
        <details><summary className="cursor-pointer py-2 text-sm font-medium">{t('ui.operations.capacityHistory')}</summary>
          {state.data.metrics.length === 0 ? <p className="text-sm text-muted-foreground">{t('ui.operations.empty')}</p> : state.data.metrics.map(row =>
            <div className="flex justify-between gap-3 border-b py-2 text-sm tabular-nums" key={row.bucket}><span>{row.bucket.slice(0,10)}</span><span>{bytes(row.databaseBytes)}</span></div>)}
        </details>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{['table','rows','deadRows','tableBytes','indexBytes'].map(key => <th className="p-2" key={key}>{t(`ui.operations.${key}`)}</th>)}</tr></thead>
          <tbody>{state.data.capacity.map(row => <tr className="border-t" key={row.name}>
            <td className="p-2 font-mono">{row.name}</td><td className="p-2">{row.rows}</td><td className="p-2">{row.deadRows}</td>
            <td className="p-2 whitespace-nowrap">{bytes(row.tableBytes)}</td><td className="p-2 whitespace-nowrap">{bytes(row.indexBytes)}</td>
          </tr>)}</tbody>
        </table></div>
      </CardContent></Card>
      <Card><CardContent className="space-y-4 pt-5">
        <h3 className="font-semibold">{t('ui.operations.deliveries')}</h3>
        {state.data.deliveries.length === 0 ? <p className="text-sm text-muted-foreground">{t('ui.operations.empty')}</p> : state.data.deliveries.map(row => <div className="flex justify-between gap-3 border-b py-2 text-sm" key={`${row.destination}:${row.status}`}><span>{row.destination} · {row.status}</span><span>{row.count}</span></div>)}
        <h3 className="font-semibold">{t('ui.operations.jobs')}</h3>
        {state.data.jobs.length === 0 && state.data.cleanupBacklog.length === 0 ? <p className="text-sm text-muted-foreground">{t('ui.operations.empty')}</p> : null}
        {state.data.cleanupBacklog.map(entry => <div className="space-y-2 border-b py-2 text-sm" key={entry.jobId}>
          <p>{t('ui.operations.cleanupBacklog')}</p><p className="break-all font-mono text-xs">{entry.jobId}</p>
          <Button disabled={state.busy} onClick={() => void state.retry('cleanup', entry.jobId)} variant="secondary">{t('ui.operations.retry')}</Button>
        </div>)}
        {state.data.jobs.map(job => <details className="border-b py-2 text-sm" key={job.id}>
          <summary className="cursor-pointer py-2">{job.jobType} · {job.status} · {job.affectedRows} / {job.estimatedRows}</summary>
          <p className="break-all font-mono text-xs">{job.id}</p>
          <p>{t('ui.operations.attempts')}: {job.attemptCount}</p>
          {job.status === 'failed' ? <Button disabled={state.busy} onClick={() => void state.retry('job', job.id)} variant="secondary">{t('ui.operations.retry')}</Button> : null}
          {job.errorDetail ? <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(job.errorDetail, null, 2)}</pre> : null}
        </details>)}
      </CardContent></Card>
      <Card><CardContent className="space-y-4 pt-5">
        <h3 className="font-semibold">{t('ui.operations.errors')}</h3>
        {state.data.errors.length === 0 && state.data.failedDeliveries.length === 0 ? <p className="text-sm text-muted-foreground">{t('ui.operations.empty')}</p> : null}
        {state.data.errors.map(entry => <div className="border-b py-2 text-sm" key={`${entry.action}:${entry.code}:${entry.lastAt}`}>
          <p>{entry.action} · {entry.code} · {entry.count}</p><p className="break-all text-xs text-muted-foreground">{entry.failureId || entry.operationId} · {new Date(entry.lastAt).toLocaleString()}</p>
        </div>)}
        {state.data.failedDeliveries.map(entry => <details className="border-b py-2 text-sm" key={entry.id}>
          <summary className="cursor-pointer py-2">{entry.destination} · {entry.eventType}</summary>
          <p className="break-all text-xs">{entry.operationId}</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.errorDetail, null, 2)}</pre>
          <Button disabled={state.busy} onClick={() => void state.retry('delivery', entry.id)} variant="secondary">{t('ui.operations.retry')}</Button>
        </details>)}
      </CardContent></Card>
      <Card><CardContent className="space-y-5 pt-5">
        <h3 className="font-semibold">{t('ui.operations.policies')} · v{state.data.settings.revision}</h3>
        <p className="text-sm text-muted-foreground">{t('ui.operations.policyHelp')}</p>
        {[...new Set(Object.values(OPERATION_POLICIES).map(spec => spec.group))].map(group => <details className="border-b pb-3" key={group}>
          <summary className="cursor-pointer py-3 font-medium">{t(`ui.operations.group.${group}`)}</summary>
          <div className="grid gap-4 sm:grid-cols-2">{Object.entries(OPERATION_POLICIES).filter(([, spec]) => spec.group === group).map(([key, spec]) => <PlatformNumberSetting key={key} label={t(`ui.operations.policy.${key}`)} min={spec.min} max={spec.max} value={state.draft?.[key as OperationPolicyKey]} onChange={value => state.update(key as OperationPolicyKey, value)} />)}</div>
        </details>)}
        <Input aria-label={t('ui.operations.reason')} placeholder={t('ui.operations.reason')} value={state.reason} maxLength={500} onChange={event => state.setReason(event.target.value)} />
        <div className="space-y-1 text-sm" aria-live="polite">
          {Object.keys(OPERATION_POLICIES).map(key => key as OperationPolicyKey).filter(key => state.draft?.[key] !== state.data?.settings.values[key]).map(key =>
            <p key={key}>{t(`ui.operations.policy.${key}`)}: {state.data?.settings.values[key]} → {state.draft?.[key]}</p>)}
        </div>
        <Button disabled={state.busy || !state.reason.trim()} onClick={() => void state.save()}>{t('ui.admin.saveAll')}</Button>
      </CardContent></Card>
      <Card><CardContent className="space-y-3 pt-5">
        <h3 className="font-semibold">{t('ui.operations.history')}</h3>
        {state.data.history.length === 0 ? <p className="text-sm text-muted-foreground">{t('ui.operations.empty')}</p> : null}
        {state.data.history.map(entry => <details className="border-b py-2 text-sm" key={entry.id}><summary className="cursor-pointer py-2">v{entry.revision} · {entry.reason}</summary><p className="break-all text-xs text-muted-foreground">{entry.actorUid} · {new Date(entry.createdAt).toLocaleString()}</p>
          {Object.keys(entry.afterValue).map(key => key as OperationPolicyKey).filter(key => entry.beforeValue[key] !== entry.afterValue[key]).map(key => <p key={key}>{t(`ui.operations.policy.${key}`)}: {entry.beforeValue[key]} → {entry.afterValue[key]}</p>)}
        </details>)}
      </CardContent></Card>
    </>}
  </section>;
}
