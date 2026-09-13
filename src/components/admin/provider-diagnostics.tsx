"use client";
import { useProviderDiagnostics } from '@/hooks/use-provider-diagnostics';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ProviderDiagnostics() {
  const state = useProviderDiagnostics();
  const { t } = useI18n();
  return <Card><CardContent className="space-y-4 pt-5">
    <h3 className="font-semibold">{t('ui.operations.providers')}</h3>
    <p className="text-sm text-muted-foreground">{t('ui.operations.providerHelp')}</p>
    {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {['cloudinary','cloudflare','logs'].map(provider => <div className="space-y-2 border-b pb-3" key={provider}>
      <div className="flex items-center justify-between gap-3"><h4 className="font-medium">{t(`ui.operations.provider.${provider}`)}</h4>
        <Button disabled={Boolean(state.pending)} onClick={() => void state.load(provider)} variant="secondary">{t(state.pending === provider ? 'ui.common.loadingMore' : 'ui.adminConsole.refresh')}</Button></div>
      {provider === 'logs' ? <><p className="text-sm text-muted-foreground">{t('ui.operations.logsHelp')}</p><Input value={state.query} maxLength={200} aria-label={t('ui.operations.logSearch')} placeholder={t('ui.operations.logSearch')} onChange={event => state.setQuery(event.target.value)} /></> : null}
      {state.results[provider] ? <><p className="text-sm">{t(`ui.operations.providerStatus.${state.results[provider].status === 'not-configured' ? 'notConfigured' : state.results[provider].status}`)}</p>
        {state.results[provider].data ? <details><summary className="cursor-pointer py-2 text-sm">{t('ui.operations.providerDetails')}</summary><pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(state.results[provider].data, null, 2)}</pre></details> : null}
        {state.results[provider].error ? <p className="text-sm text-destructive">{state.results[provider].error}</p> : null}</> : null}
      {state.results[provider]?.nextCursor ? <Button variant="secondary" disabled={Boolean(state.pending)} onClick={() => void state.load(provider,true)}>{t('ui.operations.nextPage')}</Button> : null}
    </div>)}
  </CardContent></Card>;
}
