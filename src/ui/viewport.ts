// Mobile zoom, browser chrome and the keyboard can leave the visible viewport
// smaller than the layout viewport used by CSS media queries and fixed boxes.
export function fitVisibleViewport(root: HTMLElement): () => void {
  const viewport = window.visualViewport;
  const update = () => {
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    root.style.left = `${viewport?.offsetLeft ?? 0}px`;
    root.style.top = `${viewport?.offsetTop ?? 0}px`;
    // Three columns in tablet landscape leave room for tall font ascenders
    // without shrinking the letters, even when the browser is zoomed.
    root.dataset.narrowCards = String(width < 900 && !(width >= 650 && width > height));
    root.dataset.narrowHeader = String(width <= 820);
    root.dataset.short = String(height <= 600);
  };
  update();
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('pageshow', update);
  return () => {
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    window.removeEventListener('pageshow', update);
  };
}
