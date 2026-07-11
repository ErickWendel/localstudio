export type FakePeerListener = (...args: unknown[]) => void;

export class FakePeerEventTarget {
  private readonly listeners = new Map<string, FakePeerListener[]>();

  emit(eventName: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(eventName) ?? []) listener(...args);
  }

  on(eventName: string, listener: FakePeerListener): void {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }
}
