import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const errors = [];

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['generated', 'i18n'].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else if (/\.(?:css|ts|vue)$/u.test(entry.name)) files.push(entryPath);
  }
  return files;
}

const files = await listFiles(sourceRoot);
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const relativePath = path.relative(root, file);
  if (/\bpopover-panel\b/u.test(source)) {
    errors.push(`${relativePath} uses the legacy popover-panel class; use DropdownPanel or DropdownMenu`);
  }
  if (file.endsWith('.vue')) {
    const uiPrefix = `src${path.sep}components${path.sep}ui${path.sep}`;
    if (relativePath.startsWith(uiPrefix)) {
      const tier = relativePath.slice(uiPrefix.length).split(path.sep)[0];
      if (!['atoms', 'molecules', 'organisms'].includes(tier)) {
        errors.push(`${relativePath} must live in the atoms, molecules, or organisms UI tier`);
      }
      if (tier === 'atoms' && /@\/components\/ui\/(?:molecules|organisms)\//u.test(source)) {
        errors.push(`${relativePath} is an atom and cannot depend on a higher UI tier`);
      }
      if (tier === 'molecules' && /@\/components\/ui\/organisms\//u.test(source)) {
        errors.push(`${relativePath} is a molecule and cannot depend on an organism`);
      }
    }
    if (/@\/components\/ui\/[A-Z][^/'"]*\.vue/u.test(source)) {
      errors.push(`${relativePath} imports a flat UI component path; import from its atomic tier`);
    }
    const listRowPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}ListSurfaceRow.vue`;
    if (relativePath !== listRowPath && /\blist-surface-row\b/u.test(source)) {
      errors.push(`${relativePath} assembles a list row directly; compose ListSurfaceRow instead`);
    }
    const surfacePanelPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}SurfacePanel.vue`;
    if (relativePath !== surfacePanelPath && /\blist-surface(?!-)\b/u.test(source)) {
      errors.push(`${relativePath} assembles a list surface directly; compose SurfacePanel variant="list" instead`);
    }
    const appButtonPath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}AppButton.vue`;
    if (
      relativePath !== appButtonPath
      && /\bbutton-(?:primary|secondary|danger|danger-icon|icon|icon-filled|icon-pill|icon-pill-filled|toolbar|contextual)(?!-)/u.test(source)
    ) {
      errors.push(`${relativePath} assembles a base button class directly; compose AppButton instead`);
    }
    const tagBadgePath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}TagBadge.vue`;
    if (relativePath !== tagBadgePath && /class="[^"]*\btag(?:-sm)?\b/u.test(source)) {
      errors.push(`${relativePath} assembles a badge directly; compose TagBadge instead`);
    }
    const switchIndicatorPath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}SwitchIndicator.vue`;
    if (relativePath !== switchIndicatorPath && /\bswitch-indicator(?:--checked|__thumb)?\b/u.test(source)) {
      errors.push(`${relativePath} assembles a switch indicator directly; compose SwitchIndicator instead`);
    }
    const inlineAlertPath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}InlineAlert.vue`;
    if (relativePath !== inlineAlertPath && /\binline-alert(?:--(?:compact|error|info|success|warning))?\b/u.test(source)) {
      errors.push(`${relativePath} assembles an alert directly; compose InlineAlert instead`);
    }
    const inlineMessagePath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}InlineMessage.vue`;
    if (relativePath !== inlineMessagePath && /\binline-message(?:--(?:error|muted|sm|success|warning|xs))?\b/u.test(source)) {
      errors.push(`${relativePath} assembles an inline message directly; compose InlineMessage instead`);
    }
    const characterCountPath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}CharacterCount.vue`;
    if (relativePath !== characterCountPath && /\{\{\s*[^}]*\.length\s*\}\}\s*\/\s*\{\{/u.test(source)) {
      errors.push(`${relativePath} assembles a character counter directly; compose CharacterCount instead`);
    }
    const labeledListSectionPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}LabeledListSection.vue`;
    if (relativePath !== labeledListSectionPath && /\blist-section-label\b/u.test(source)) {
      errors.push(`${relativePath} assembles a labeled list section directly; compose LabeledListSection instead`);
    }
    const workflowStepHeaderPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}WorkflowStepHeader.vue`;
    if (
      relativePath !== workflowStepHeaderPath
      && /class="[^"]*h-7 w-7[^"]*rounded-full[^"]*text-xs font-bold[^"]*"/u.test(source)
    ) {
      errors.push(`${relativePath} assembles a workflow step heading directly; compose WorkflowStepHeader instead`);
    }
    const dialogShellPath = `src${path.sep}components${path.sep}ui${path.sep}organisms${path.sep}DialogShell.vue`;
    if (relativePath !== dialogShellPath && /<DialogOverlay\b/u.test(source)) {
      errors.push(`${relativePath} assembles dialog behavior directly; compose DialogShell instead`);
    }
    const dialogActionRowPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}DialogActionRow.vue`;
    if (relativePath !== dialogActionRowPath && /\bdialog-actions\b/u.test(source)) {
      errors.push(`${relativePath} assembles dialog actions directly; compose DialogActionRow instead`);
    }
    const dialogHeadingPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}DialogHeading.vue`;
    if (relativePath !== dialogHeadingPath && /class="[^"]*\bdialog-(?:eyebrow|title|description)\b/u.test(source)) {
      errors.push(`${relativePath} assembles a dialog heading directly; compose DialogHeading instead`);
    }
    const editorSurfacePath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}EditorSurface.vue`;
    if (relativePath !== editorSurfacePath && /class="[^"]*\beditor-surface(?:--elevated)?\b/u.test(source)) {
      errors.push(`${relativePath} assembles an editor surface directly; compose EditorSurface instead`);
    }
    const skeletonBlockPath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}SkeletonBlock.vue`;
    if (relativePath !== skeletonBlockPath && /class="[^"]*\bskeleton-block\b/u.test(source)) {
      errors.push(`${relativePath} assembles a skeleton block directly; compose SkeletonBlock instead`);
    }
    const imageRemoveButtonPath = `src${path.sep}components${path.sep}ui${path.sep}atoms${path.sep}ImageRemoveButton.vue`;
    if (relativePath !== imageRemoveButtonPath && /\bbutton-remove-image\b/u.test(source)) {
      errors.push(`${relativePath} assembles an image remove button directly; compose ImageRemoveButton instead`);
    }
    const editorModeBarPath = `src${path.sep}components${path.sep}ui${path.sep}molecules${path.sep}EditorModeBar.vue`;
    if (relativePath !== editorModeBarPath && /class="[^"]*\beditor-mode-bar\b/u.test(source)) {
      errors.push(`${relativePath} assembles an editor mode bar directly; compose EditorModeBar instead`);
    }
    if (/class="(?:[^"]*\s)?panel(?:-pad)?(?=[\s"])/u.test(source) || /['"]panel panel-pad['"]/u.test(source)) {
      errors.push(`${relativePath} uses a legacy panel class; compose SurfacePanel or use surface-card tokens`);
    }
    if (/\bmenu-item(?:-danger)?\b/u.test(source)) {
      errors.push(`${relativePath} uses a legacy menu item class; use dropdown-item`);
    }
    if (/\bapp-viewport-frame\b/u.test(source)) {
      errors.push(`${relativePath} applies viewport padding directly; use ViewportFrame`);
    }
    if (/\b(?:left-4[^"\n]*right-4|right-4[^"\n]*left-4)\b/u.test(source)) {
      errors.push(`${relativePath} hard-codes floating viewport gutters; use viewport-floating-inline`);
    }
    if (/shadow-\[[^\]]+\]/u.test(source)) {
      errors.push(`${relativePath} defines an arbitrary shadow; use control/card/floating elevation tokens`);
    }
    if (/\bshadow-(?:note|elevated)\b/u.test(source)) {
      errors.push(`${relativePath} uses a legacy elevation name; use shadow-control, shadow-card, or shadow-floating`);
    }
    if (
      /class="[^"]*(?:items-center justify-center|place-items-center)[^"]*rounded-2xl[^"]*shadow-(?:control|card)[^"]*"/u.test(source)
    ) {
      errors.push(`${relativePath} assembles an elevated icon container directly; compose IconTile instead`);
    }
    if (relativePath.startsWith(`src${path.sep}views${path.sep}`) && !relativePath.endsWith('LoginView.vue')) {
      if (!/<RoutePageFrame\b/u.test(source)) {
        errors.push(`${relativePath} must compose its page through RoutePageFrame`);
      }
      if (/\broute-page\b|\bpage-bottom-safe\b/u.test(source)) {
        errors.push(`${relativePath} assembles route layout classes directly; use RoutePageFrame props`);
      }
      if (/app-viewport-gutter|safe-area-inset-(?:left|right)/u.test(source)) {
        errors.push(`${relativePath} calculates viewport gutters directly; use AppShell and ViewportFrame`);
      }
    }
    if (
      /class="[^"]*rounded-\[var\(--radius-outer\)\][^"]*shadow-card[^"]*"/u.test(source)
      || /class="[^"]*shadow-card[^"]*rounded-\[var\(--radius-outer\)\][^"]*"/u.test(source)
    ) {
      errors.push(`${relativePath} assembles a card surface manually; use SurfacePanel or surface-card`);
    }
  }
}

const primitives = await readFile(path.join(sourceRoot, 'styles/primitives.css'), 'utf8');
for (const requiredPrimitive of [
  '.viewport-frame',
  '.viewport-content',
  '.viewport-floating-inline',
  '.route-page-frame',
  '.route-page-frame--fill',
  '.route-page-frame--bottom-safe',
  '.surface-control',
  '.surface-card',
  '.surface-floating',
  '.surface-inset',
  '.icon-tile',
  '.icon-tile--elevation-control',
  '.icon-tile--elevation-card',
  '.switch-indicator',
  '.switch-indicator--checked',
  '.inline-alert',
  '.inline-alert--error',
  '.inline-alert--warning',
  '.inline-message',
  '.inline-message--error',
  '.dialog-card',
  '.dialog-title',
  '.dialog-description',
  '.dialog-actions',
  '.editor-surface',
  '.editor-surface--elevated',
  '.editor-surface--muted',
  '.editor-mode-bar',
  '.list-section-label',
  '.list-surface',
  '.list-surface-row',
  '.dropdown-panel',
  '.dropdown-item',
  '.dropdown-label',
  '.control-frame',
  '.control-footer',
]) {
  if (!primitives.includes(requiredPrimitive)) {
    errors.push(`src/styles/primitives.css is missing ${requiredPrimitive}`);
  }
}
for (const elevationToken of ['--shadow-control', '--shadow-card', '--shadow-floating']) {
  if (!primitives.includes(`var(${elevationToken})`)) {
    errors.push(`src/styles/primitives.css does not use ${elevationToken}`);
  }
}

if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exit(1);
}

console.log('UI primitive check passed.');
