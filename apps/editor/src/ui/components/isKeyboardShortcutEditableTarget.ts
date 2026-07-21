export function isKeyboardShortcutEditableTarget(target: EventTarget | null) {
  const isEditableElement = (value: Element | EventTarget | null) =>
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement ||
    (value instanceof HTMLElement && value.isContentEditable);

  return isEditableElement(target) || isEditableElement(document.activeElement);
}
