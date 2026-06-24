export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;
  return ((...args: any[]) => {
    const now = Date.now();
    lastArgs = args;
    if (now - last >= ms) {
      last = now;
      fn(...args);
      lastArgs = null;
    } else if (!pending) {
      pending = setTimeout(() => {
        last = Date.now();
        pending = null;
        if (lastArgs) { fn(...lastArgs); lastArgs = null; }
      }, ms - (now - last));
    }
  }) as T;
}
