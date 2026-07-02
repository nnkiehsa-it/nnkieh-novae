import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';

interface DropdownPositionOptions {
  fallbackHeight?: number;
  width: number;
  gap?: number;
  viewportPadding?: number;
}

type DropdownPlacement = 'bottom' | 'top';

export function useDropdownPosition(
  triggerRef: Ref<HTMLElement | null>,
  isOpenRef: Ref<boolean>,
  options: DropdownPositionOptions,
  dropdownRef?: Ref<HTMLElement | null>,
) {
  const dropdownStyle = ref<Record<string, string>>({});
  const dropdownPlacement = ref<DropdownPlacement>('bottom');
  const fallbackHeight = options.fallbackHeight ?? 180;
  const gap = options.gap ?? 8;
  const viewportPadding = options.viewportPadding ?? 12;
  const width = options.width;

  function updateDropdownPosition() {
    const trigger = triggerRef.value;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const dropdownHeight = dropdownRef?.value?.offsetHeight || fallbackHeight;
    const viewportHeight = window.innerHeight;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const shouldOpenAbove = spaceBelow < dropdownHeight + gap && spaceAbove > spaceBelow;
    const top = shouldOpenAbove
      ? Math.max(viewportPadding, rect.top - dropdownHeight - gap)
      : Math.min(rect.bottom + gap, viewportHeight - dropdownHeight - viewportPadding);
    const placement: DropdownPlacement = shouldOpenAbove ? 'top' : 'bottom';

    dropdownPlacement.value = placement;
    dropdownStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      transformOrigin: placement === 'top' ? 'right bottom' : 'right top',
    };
  }

  function addPositionListeners() {
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
  }

  function removePositionListeners() {
    window.removeEventListener('resize', updateDropdownPosition);
    window.removeEventListener('scroll', updateDropdownPosition, true);
  }

  watch(isOpenRef, async (open) => {
    if (!open) {
      removePositionListeners();
      return;
    }
    await nextTick();
    updateDropdownPosition();
    addPositionListeners();
  });

  onBeforeUnmount(removePositionListeners);

  return {
    dropdownPlacement,
    dropdownStyle,
    updateDropdownPosition,
  };
}
