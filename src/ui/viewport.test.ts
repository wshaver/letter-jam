import { fitVisibleViewport } from './viewport';

it('fits and follows a zoomed, panned visual viewport instead of the layout viewport', () => {
  const viewport = Object.assign(new EventTarget(), { width: 667, height: 720, offsetLeft: 80, offsetTop: 24 });
  vi.stubGlobal('visualViewport', viewport);
  const root = document.createElement('div');
  const dispose = fitVisibleViewport(root);
  try {
    expect(root.style.width).toBe('667px');
    expect(root.style.left).toBe('80px');
    expect(root.dataset.narrowHeader).toBe('true');
    viewport.width = 1000; viewport.height = 500; viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event('resize'));
    expect(root.style.height).toBe('500px');
    expect(root.dataset.narrowCards).toBe('false');
    expect(root.dataset.short).toBe('true');
    viewport.offsetLeft = 100;
    viewport.dispatchEvent(new Event('scroll'));
    expect(root.style.left).toBe('100px');
    dispose();
    viewport.offsetLeft = 120;
    viewport.dispatchEvent(new Event('scroll'));
    expect(root.style.left).toBe('100px');
  } finally { dispose(); vi.unstubAllGlobals(); }
});

it('uses the window size when the visual viewport API is unavailable', () => {
  vi.stubGlobal('visualViewport', undefined);
  const root = document.createElement('div');
  const dispose = fitVisibleViewport(root);
  try {
    expect(root.style.width).toBe(`${innerWidth}px`);
    expect(root.style.height).toBe(`${innerHeight}px`);
    expect(root.style.left).toBe('0px');
  } finally { dispose(); vi.unstubAllGlobals(); }
});
