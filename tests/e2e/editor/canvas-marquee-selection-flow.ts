import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { canvasBox } from './canvas-box';
import { canvasPositionedText } from './canvas-positioned-text';

export const canvasMarqueeSelectionFlow = {
  async run(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await canvasPositionedText.add(editor, page, 'Marquee first', { height: 100, width: 320, x: 520, y: 320 });
    await canvasPositionedText.add(editor, page, 'Marquee second', { height: 100, width: 320, x: 900, y: 420 });

    const frame = page.getByTestId('slide-canvas-frame');
    const box = await canvasBox.get(page);
    const scaleX = box.width / 1920;
    const scaleY = box.height / 1080;
    const startClientX = box.x + 1260 * scaleX;
    const startClientY = box.y + 560 * scaleY;
    const endClientX = box.x + 480 * scaleX;
    const endClientY = box.y + 280 * scaleY;

    await page.mouse.move(startClientX, startClientY);
    await page.mouse.down();
    await page.mouse.move(endClientX, endClientY, { steps: 8 });
    await expect(frame).toHaveAttribute('data-marquee-selection', 'active');
    const marqueeBox = await page.getByTestId('marquee-selection-box').boundingBox();
    expect(marqueeBox).not.toBeNull();
    expect(Math.abs(marqueeBox!.x - endClientX)).toBeLessThan(3);
    expect(Math.abs(marqueeBox!.y - endClientY)).toBeLessThan(3);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const selectedElements = (await frame.getAttribute('data-selected-elements')) ?? '';
        return selectedElements.split(',').filter(Boolean).length;
      })
      .toBe(2);
  },
};
