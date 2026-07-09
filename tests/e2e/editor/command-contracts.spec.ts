/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor document command contracts', () => {
  test('executes core document mutation commands in the browser runtime', async ({ page }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(async () => {
      const { basicCommands } = (await import(
        '/editor/src/domain/commands/elements/basicCommands.ts'
      )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

      function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message);
      }

      let project = {
        assets: {
          'asset-image': {
            id: 'asset-image',
            mimeType: 'image/png',
            name: 'Image',
            objectUrl: 'data:image/png;base64,AA==',
            type: 'image',
          },
          'asset-video': {
            id: 'asset-video',
            mimeType: 'video/mp4',
            name: 'Video',
            objectUrl: 'data:video/mp4;base64,AA==',
            type: 'video',
          },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        elements: {
          'text-1': {
            align: 'left',
            fill: '#111111',
            fontFamily: 'Inter',
            fontSize: 40,
            fontWeight: 400,
            height: 120,
            id: 'text-1',
            lineHeight: 1.1,
            locked: false,
            opacity: 1,
            rotation: 0,
            text: 'Original',
            type: 'text',
            visible: true,
            width: 500,
            x: 10,
            y: 20,
          },
          'shape-1': {
            fill: '#eeeeee',
            height: 120,
            id: 'shape-1',
            locked: false,
            opacity: 1,
            rotation: 0,
            shape: 'rectangle',
            stroke: '#222222',
            strokeWidth: 2,
            type: 'shape',
            visible: true,
            width: 300,
            x: 80,
            y: 160,
          },
          'image-1': {
            assetId: 'asset-image',
            height: 240,
            id: 'image-1',
            locked: false,
            opacity: 1,
            rotation: 0,
            type: 'image',
            visible: true,
            width: 320,
            x: 180,
            y: 260,
          },
          'video-1': {
            assetId: 'asset-video',
            autoplayInPreview: false,
            controls: true,
            height: 260,
            id: 'video-1',
            locked: false,
            loop: false,
            muted: true,
            opacity: 1,
            repeatMode: 'none',
            rotation: 0,
            startOnClick: true,
            trimStartSeconds: 0,
            type: 'video',
            visible: true,
            volume: 0.7,
            width: 420,
            x: 260,
            y: 300,
          },
        },
        fonts: {},
        id: 'project-1',
        name: 'Command Contract',
        pages: [
          {
            background: { color: '#ffffff', type: 'color' },
            elementIds: ['text-1', 'shape-1', 'image-1', 'video-1'],
            height: 1080,
            id: 'page-1',
            name: 'Slide 1',
            visible: true,
            width: 1920,
          },
        ],
        themeGallery: [],
        themes: {},
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const run = (command: { execute(project: typeof project): typeof project }) => {
        project = command.execute(project);
      };

      run(new basicCommands.AlignElementCommand('page-1', 'shape-1', 'page-center'));
      run(new basicCommands.SetZOrderCommand('page-1', 'shape-1', 'front'));
      run(new basicCommands.SetZOrderCommand('page-1', 'shape-1', 'backward'));
      run(new basicCommands.DuplicateElementCommand('page-1', 'text-1', 'text-copy'));
      run(new basicCommands.ReorderElementCommand('page-1', 'text-copy', 0));
      run(new basicCommands.SetElementVisibilityCommand('text-copy', false));
      run(new basicCommands.SetElementLockCommand('text-copy', true));
      run(
        new basicCommands.AddElementsCommand('page-1', [
          {
            fill: '#123456',
            height: 80,
            id: 'shape-2',
            locked: false,
            opacity: 1,
            rotation: 0,
            shape: 'ellipse',
            type: 'shape',
            visible: true,
            width: 80,
            x: 40,
            y: 40,
          },
        ]),
      );
      run(new basicCommands.UpdateElementFrameCommand('shape-2', { height: 96, width: 120, x: 44 }));
      run(new basicCommands.UpdateElementFramesCommand({ 'shape-1': { x: 100 }, 'image-1': { y: 320 } }));
      run(new basicCommands.UpdateTextContentCommand('text-1', 'Updated'));
      run(
        new basicCommands.UpdateElementStyleCommand('text-1', {
          align: 'center',
          fill: '#00779a',
          fontSize: 52,
          fontWeight: 700,
          opacity: 0.75,
        }),
      );
      run(
        new basicCommands.UpdateElementStyleCommand('shape-1', {
          endEndpoint: 'arrow',
          fill: null,
          startEndpoint: 'circle',
          stroke: '#ff00aa',
          strokeWidth: 6,
        }),
      );
      run(new basicCommands.ToggleImageFlipCommand('image-1'));
      run(
        new basicCommands.UpdateImageCropCommand('image-1', {
          crop: { height: 0.8, width: 0.7, x: 0.1, y: 0.05 },
          height: 250,
          width: 350,
        }),
      );
      run(
        new basicCommands.UpdateMediaPlaybackCommand('video-1', {
          autoplayInPreview: true,
          loop: true,
          playbackPositionSeconds: 4,
          repeatMode: 'loop',
          trimEndSeconds: 12,
          trimStartSeconds: 2,
          volume: 0.4,
        }),
      );
      run(
        new basicCommands.ReplaceImageAssetCommand('image-1', {
          id: 'asset-image-2',
          mimeType: 'image/png',
          name: 'Replacement',
          objectUrl: 'data:image/png;base64,AQ==',
          type: 'image',
        }),
      );
      run(
        new basicCommands.ReplaceVideoAssetCommand(
          'video-1',
          {
            id: 'asset-video-2',
            mimeType: 'video/mp4',
            name: 'Replacement video',
            objectUrl: 'data:video/mp4;base64,AQ==',
            type: 'video',
          },
          { durationSeconds: 18 },
        ),
      );
      run(new basicCommands.UpdatePageBackgroundCommand('page-1', { color: '#101820', type: 'color' }));
      run(
        new basicCommands.SetPageTransitionCommand('page-1', {
          delayMs: -10,
          direction: 'left',
          durationMs: 500,
          effect: 'push',
          trigger: 'after-delay',
        }),
      );
      run(new basicCommands.ClearPageTransitionCommand('page-1'));
      run(
        new basicCommands.SetElementAnimationBuildsCommand(
          'page-1',
          ['text-1', 'shape-1'],
          (elementId: string) => `build-${elementId}`,
          { delayMs: -20, direction: 'up', durationMs: 300, effect: 'fade', trigger: 'click' },
        ),
      );
      run(new basicCommands.ReorderElementAnimationBuildCommand('page-1', 'shape-1', 0));
      run(new basicCommands.ClearElementAnimationBuildCommand('page-1', 'text-1'));
      run(new basicCommands.TranslateTextElementsCommand({ 'text-1': { fontSize: 46, text: 'Traduzido' } }));

      run(new basicCommands.DuplicatePageCommand('page-1', 'page-2', (id: string) => `${id}-copy`));
      run(new basicCommands.RenamePageCommand('page-2', 'Appendix'));
      run(new basicCommands.SetPageVisibilityCommand('page-2', false));
      run(new basicCommands.ReorderPageCommand('page-2', 0));
      run(new basicCommands.DeletePageCommand('page-2'));

      const theme = {
        id: 'theme-contrast',
        name: 'Contrast',
        palette: ['#000000', '#ffffff'],
        typography: { bodyFontFamily: 'Inter', headingFontFamily: 'Inter' },
      };
      run(new basicCommands.SaveThemeCommand(theme));
      run(new basicCommands.ApplyThemeCommand('theme-contrast'));
      run(new basicCommands.EditThemeCommand({ ...theme, name: 'Contrast edited' }));

      const layout = {
        elementIds: ['title-placeholder'],
        elements: {
          'title-placeholder': {
            align: 'left',
            fill: '#111111',
            fontFamily: 'Inter',
            fontSize: 64,
            fontWeight: 700,
            height: 120,
            id: 'title-placeholder',
            lineHeight: 1.1,
            locked: true,
            opacity: 1,
            placeholderRole: 'title',
            rotation: 0,
            templateSource: 'layout',
            text: 'Title',
            type: 'text',
            verticalAlign: 'top',
            visible: true,
            width: 900,
            x: 80,
            y: 80,
          },
        },
        id: 'layout-title',
        name: 'Title layout',
        placeholderVisibility: { body: true, media: true, title: true },
      };
      run(new basicCommands.SaveSlideLayoutCommand(layout));
      run(new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand('layout-title', 'title', false));
      run(new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand('layout-title', 'title', true));
      run(new basicCommands.ApplySlideLayoutCommand('page-1', 'layout-title'));
      run(new basicCommands.EditSlideLayoutCommand({ ...layout, name: 'Edited title layout' }));

      run(new basicCommands.DeleteElementCommand('page-1', 'shape-2'));
      run(new basicCommands.RemoveAssetCommand('asset-image'));

      assert(project.pages.length === 1, 'delete page should keep one page');
      assert(project.pages[0]?.layoutId === 'layout-title', 'layout should be applied');
      assert(project.elements['text-1']?.text === 'Traduzido', 'text should be translated');
      assert(project.elements['text-copy']?.locked === true, 'copy should be locked');
      assert(project.elements['image-1']?.assetId === 'asset-image-2', 'image asset should be replaced');
      assert(project.elements['video-1']?.assetId === 'asset-video-2', 'video asset should be replaced');
      assert(project.themeId === 'theme-contrast', 'theme should be applied');
      assert(!project.assets['asset-image'], 'unreferenced asset should be removed');

      return {
        elementCount: Object.keys(project.elements).length,
        pageCount: project.pages.length,
        themeId: project.themeId,
      };
    });

    expect(result).toEqual({
      elementCount: 5,
      pageCount: 1,
      themeId: 'theme-contrast',
    });
  });
});
