import { useCallback, useEffect, useState } from "react";

/** A countdown in whole seconds, used for "Resend code in 42s". */
export function useCooldown(): [remaining: number, start: (seconds?: number) => void] {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds = 60) => setRemaining(seconds), []);
  return [remaining, start];
}
