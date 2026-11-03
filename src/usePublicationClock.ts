import { useEffect, useState } from 'react';
// This clock labels real-world publications only; it never mutates operational game time.
export function usePublicationClock(from?: string, to?: string): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      const current = Date.now(); setNow(current);
      const boundary = [Date.parse(from ?? ''), Date.parse(to ?? '')].filter(time => time > current).sort((a, b) => a - b)[0];
      clearTimeout(timer);
      if (boundary) timer = setTimeout(update, Math.min(2147483647, boundary - current + 1));
    }
    update(); document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [from, to]);
  return now;
}
