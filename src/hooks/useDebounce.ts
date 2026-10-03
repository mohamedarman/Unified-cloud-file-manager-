import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce values (e.g. search queries, filter inputs)
 * Prevents redundant re-renders and heavy filtering computations on every keystroke.
 */
export function useDebounce<T>(value: T, delayMs: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
