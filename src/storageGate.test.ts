import { afterEach, describe, expect, it, vi } from 'vitest';
import { coordinateSave } from './storageGate';
afterEach(() => vi.unstubAllGlobals());
describe('coordination failure boundaries', () => {
  it('does not write if opening the browser database is denied', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('Storage denied', 'SecurityError'); } });
    const write = vi.fn();
    await expect(coordinateSave(write)).rejects.toThrow('Storage denied');
    expect(write).not.toHaveBeenCalled();
  });
  it('never applies a delayed write after a blocked open has already reported failure', async () => {
    const close = vi.fn();
    const transaction = vi.fn();
    const opening = { onblocked: () => {}, onsuccess: () => {}, result: { close, transaction } };
    vi.stubGlobal('indexedDB', { open: () => opening });
    const write = vi.fn(); const result = coordinateSave(write);
    opening.onblocked();
    await expect(result).rejects.toThrow('another tab');
    opening.onsuccess();
    expect(close).toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });
  it('rejects a transaction abort before the guarded write', async () => {
    const request = { onsuccess: () => {} };
    const transaction = { oncomplete: () => {}, onabort: () => {}, onerror: () => {}, objectStore: () => ({ get: () => request }) };
    const opening = { onsuccess: () => {}, result: { close: vi.fn(), transaction: () => transaction } };
    vi.stubGlobal('indexedDB', { open: () => opening });
    const write = vi.fn(); const result = coordinateSave(write);
    opening.onsuccess(); transaction.onabort();
    await expect(result).rejects.toThrow('interrupted'); expect(write).not.toHaveBeenCalled();
  });
  it('acknowledges an authoritative local write even if the coordination transaction later aborts', async () => {
    const request = { onsuccess: () => {} };
    const transaction = { oncomplete: () => {}, onabort: () => {}, onerror: () => {}, objectStore: () => ({ get: () => request }) };
    const opening = { onsuccess: () => {}, result: { close: vi.fn(), transaction: () => transaction } };
    vi.stubGlobal('indexedDB', { open: () => opening });
    const write = vi.fn(() => 'saved'); const result = coordinateSave(write);
    opening.onsuccess(); request.onsuccess(); transaction.onabort();
    await expect(result).resolves.toBe('saved'); expect(write).toHaveBeenCalledTimes(1);
  });
});
