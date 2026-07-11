export type FakePresenterPopup = {
  readonly messages: unknown[];
  closed: boolean;
  location: { href: string };
  close(): void;
  postMessage(message: unknown): void;
};

export function createFakePresenterPopup(): FakePresenterPopup {
  return {
    closed: false,
    location: { href: '' },
    messages: [],

    close(): void {
      this.closed = true;
    },

    postMessage(message: unknown): void {
      this.messages.push(message);
    },
  };
}
