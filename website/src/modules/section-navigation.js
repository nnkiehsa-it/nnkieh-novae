export function initializeSectionNavigation() {
  const root = document.querySelector('[data-section-nav]');
  const toggle = root?.querySelector('[data-section-nav-toggle]');
  const previous = root?.querySelector('[data-section-nav-prev]');
  const next = root?.querySelector('[data-section-nav-next]');
  const indexLabel = root?.querySelector('[data-section-nav-index]');
  const currentLabel = root?.querySelector('[data-section-nav-current]');
  if (!root || !(toggle instanceof HTMLButtonElement)) return;

  const links = [...root.querySelectorAll('a[href^="#"]')];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter((section) => section instanceof HTMLElement);
  let activeIndex = 0;

  const close = () => {
    root.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  const setActive = (index) => {
    activeIndex = Math.max(0, Math.min(index, links.length - 1));
    links.forEach((link, linkIndex) => link.classList.toggle('is-active', linkIndex === activeIndex));
    if (indexLabel) indexLabel.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(links.length).padStart(2, '0')}`;
    if (currentLabel) currentLabel.textContent = links[activeIndex]?.querySelector('span')?.textContent || '';
    if (previous instanceof HTMLButtonElement) previous.disabled = activeIndex === 0;
    if (next instanceof HTMLButtonElement) next.disabled = activeIndex === links.length - 1;
  };

  const goTo = (index) => {
    const link = links[index];
    if (!link) return;
    link.click();
    close();
  };

  toggle.addEventListener('click', () => {
    const open = root.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  previous?.addEventListener('click', () => goTo(activeIndex - 1));
  next?.addEventListener('click', () => goTo(activeIndex + 1));

  links.forEach((link) => {
    link.addEventListener('click', () => {
      close();
      link.blur();
    });
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  document.addEventListener('novae:language', () => setActive(activeIndex));

  setActive(0);

  if (typeof IntersectionObserver === 'undefined') return;
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setActive(links.findIndex((link) => link.getAttribute('href') === `#${visible.target.id}`));
    },
    { rootMargin: '-25% 0px -55%', threshold: [0, 0.15, 0.35] }
  );
  sections.forEach((section) => observer.observe(section));
}
