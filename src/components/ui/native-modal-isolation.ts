/** Keep retained pages and lower native modals outside keyboard and screen-reader navigation. */
export function createNativeModalIsolation() {
  let activeModal: HTMLElement | undefined;
  const hidden = new Map<HTMLElement, { inert: boolean; ariaHidden: string | null }>();
  const restore = () => {
    hidden.forEach((previous, node) => {
      node.inert = previous.inert;
      if (previous.ariaHidden === null) node.removeAttribute("aria-hidden");
      else node.setAttribute("aria-hidden", previous.ariaHidden);
    });
    hidden.clear();
  };
  return {
    restore,
    update(modal?: HTMLElement) {
      const changed = modal !== activeModal;
      activeModal = modal;
      restore();
      if (!modal) return;
      if (changed) modal.focus({ preventScroll: true });
      for (let branch: HTMLElement = modal; branch.parentElement; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (!(sibling instanceof HTMLElement) || sibling === branch ||
            sibling.matches("script,style,link,.actions-backdrop,.dialog-backdrop,.sheet-backdrop,.popup-backdrop,.popover-backdrop,.toast,.tooltip")) continue;
          hidden.set(sibling, { inert: sibling.inert, ariaHidden: sibling.getAttribute("aria-hidden") });
          sibling.inert = true;
          sibling.setAttribute("aria-hidden", "true");
        }
        if (branch.parentElement === document.body) break;
      }
    },
  };
}
