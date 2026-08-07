<template>
  <DialogShell
    :open="open"
    :closeable="false"
    labelled-by="app-update-title"
    persistent
    surface-class="dialog-card"
  >
    <div class="flex items-start gap-4">
      <IconTile tone="info" aria-hidden="true">
        <AppIcon name="refresh" :size="6" :stroke-width="1.8" />
      </IconTile>
      <DialogHeading
        class="flex-1"
        :title="t('app.update.title')"
        title-id="app-update-title"
        :description="t('app.update.description')"
      />
    </div>
    <DialogActionRow>
      <AppButton
        variant="primary"
        :disabled="busy"
        data-autofocus
        @click="emit('reload')"
      >
        <BusyButtonContent
          :busy="Boolean(busy)"
          label="app.update.update"
          busy-label="app.update.updating"
        />
      </AppButton>
    </DialogActionRow>
  </DialogShell>
</template>

<script setup lang="ts">
import DialogShell from "@/components/ui/organisms/DialogShell.vue";
import DialogActionRow from "@/components/ui/molecules/DialogActionRow.vue";
import DialogHeading from "@/components/ui/molecules/DialogHeading.vue";
import BusyButtonContent from "@/components/ui/atoms/BusyButtonContent.vue";
import AppButton from "@/components/ui/atoms/AppButton.vue";
import IconTile from "@/components/ui/atoms/IconTile.vue";
import AppIcon from "@/components/ui/atoms/AppIcon.vue";
import { useI18n } from "@/i18n";

const props = defineProps<{
  busy?: boolean;
  open: boolean;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  reload: [];
}>();
</script>
