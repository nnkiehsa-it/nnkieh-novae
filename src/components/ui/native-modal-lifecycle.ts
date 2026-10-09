type NativeModal = {
  $el: {off(events: string): unknown};
  once(event: string, callback: () => void): unknown;
  emit(event: string): unknown;
};

/** F7 9.2 leaves opening-transition listeners behind and names Popup swipe teardown popupDestroy. */
export function bindNativeModalCleanup(modal: NativeModal, popup: boolean) {
  modal.once("beforeDestroy", () => {
    modal.$el.off("animationend transitionend");
    if (popup) modal.emit("popupDestroy");
  });
}
