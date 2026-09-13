import { ChartNoAxesCombined, FileClock, FolderCog, Settings2, Shield, Users } from 'lucide-react';

export function administrationNavigation(requested: string | null,
  access: { admin: boolean; overview: boolean; members: boolean; categories: boolean }, t: (key: string) => string) {
  const options = [
    ...(access.admin ? [{ label:t('ui.operations.title'),value:'operations',icon:<Settings2 className="size-3.5" /> }] : []),
    ...(access.overview ? [{ label:t('ui.adminConsole.overviewTab'),value:'overview',icon:<ChartNoAxesCombined className="size-3.5" /> }] : []),
    ...(access.members ? [{label:t('ui.adminConsole.usersTab'),value:'users',icon:<Shield className="size-3.5" />}] : []),
    ...(access.categories ? [{label:t('ui.admin.categories'),value:'categories',icon:<FolderCog className="size-3.5" />}] : []),
    ...(access.members ? [
      {label:t('ui.admin.access'),value:'members',icon:<Users className="size-3.5" />},
      {label:t('ui.adminConsole.auditTab'),value:'audit',icon:<FileClock className="size-3.5" />},
    ] : []),
  ];
  const preferred = requested || 'overview';
  const tab = options.some(option=>option.value===preferred) ? preferred
    : access.categories ? 'categories' : access.members ? 'users' : 'overview';
  return { tab,options };
}
