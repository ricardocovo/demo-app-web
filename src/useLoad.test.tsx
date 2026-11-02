import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useLoad } from './useLoad';

it('aborts superseded loads and ignores late responses even if the transport ignores abort', async () => {
  let firstResolve: (value: string) => void = () => {};
  const first = new Promise<string>(resolve => { firstResolve = resolve; });
  const signals: AbortSignal[] = [];
  const loader = vi.fn((signal: AbortSignal) => { signals.push(signal); return signals.length === 1 ? first : Promise.resolve('latest'); });
  const { result, rerender } = renderHook(({ key }) => useLoad(loader, [key]), { initialProps: { key: 1 } });
  rerender({ key: 2 });
  await waitFor(() => expect(result.current.data).toBe('latest'));
  expect(signals[0].aborted).toBe(true);
  await act(async () => firstResolve('stale'));
  expect(result.current.data).toBe('latest');
});
