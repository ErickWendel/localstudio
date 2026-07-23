import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluatePptxPatcherContract } from './pptx-patcher-contract-browser';
import { pptxPatcherContractFixtures } from './pptx-patcher-contract-fixtures';

const getServer = withIsolatedDevServer(test);

test.describe('editor PowerPoint package patcher contracts', () => {
  test('patches crop, transitions, animation timing, and package warnings in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(
      evaluatePptxPatcherContract,
      pptxPatcherContractFixtures.createInput(),
    );

    expect(result.bufferBytes).toBeGreaterThan(0);
    expect(result.slideXml).toContain('<a:srcRect l="10000" t="20000" r="30000" b="10000"/>');
    expect(result.slideXml).toContain('<p:push dir="l"/>');
    expect(result.slideXml).toContain('presetSubtype="fade"');
    expect(result.slideXml).toContain('cmd="play"');
    expect(result.warningCodes).toEqual(
      expect.arrayContaining([
        'existing-warning',
        'pptx-animation-effect-downgraded',
        'pptx-animation-target-missing',
      ]),
    );
  });

  test('reports invalid package structure and downgraded transitions in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(
      evaluatePptxPatcherContract,
      pptxPatcherContractFixtures.createValidationInput(),
    );

    expect(result.bufferBytes).toBeGreaterThan(0);
    expect(result.slideXml).not.toContain('<p:transition');
    expect(result.warningCodes).toEqual(
      expect.arrayContaining([
        'pptx-animation-shape-targets-unvalidated',
        'pptx-media-content-type-missing',
        'pptx-required-package-file-missing',
        'pptx-animation-target-missing',
        'pptx-slide-file-missing',
        'pptx-transition-effect-downgraded',
      ]),
    );
  });

  test('patches alternate transition, crop, and relationship branches in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(
      evaluatePptxPatcherContract,
      pptxPatcherContractFixtures.createBranchInput(),
    );

    expect(result.bufferBytes).toBeGreaterThan(0);
    expect(result.slideXml).toContain('<p:wipe dir="r"/>');
    expect(result.slideXml).toContain('<a:srcRect l="25000" t="10000" r="25000" b="50000"/>');
    expect(result.slideXml).toContain('presetSubtype="push"');
    expect(result.slideXml).toContain('presetSubtype="wipe"');
    expect(result.slideXml).toContain('presetSubtype="fade"');
    expect(result.warningCodes).toEqual(
      expect.arrayContaining([
        'pptx-required-package-file-missing',
        'pptx-relationship-target-missing',
        'pptx-media-content-type-missing',
      ]),
    );
  });
});
