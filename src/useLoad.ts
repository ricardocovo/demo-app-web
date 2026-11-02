import { useEffect, useRef, useState } from 'react';

export type LoadState<T> = { data?: T; error?: unknown; loading: boolean };
export function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>, dependencies: unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ loading: true });
  const currentLoader = useRef(loader);
  currentLoader.current = loader;
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    currentLoader.current(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ loading: false, data }); },
      error => { if (!controller.signal.aborted) setState({ loading: false, error }); },
    );
    return () => controller.abort();
    // Callers supply the query key; the loader itself is intentionally not an effect dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return state;
}
