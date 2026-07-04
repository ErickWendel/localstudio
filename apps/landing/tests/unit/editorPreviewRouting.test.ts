import { describe, expect, it } from 'vitest';
import { rewriteEditorPreviewRoute } from '../../src/routing/rewriteEditorPreviewRoute';

describe('editor preview routing', () => {
  it('rewrites public share deep links to the editor app entry', () => {
    const request = {
      url: '/editor/s/cdc733d4-fd28-41fc-a1f0-cf7af0f62381?src=http%3A%2F%2Flocalhost%3A9000%2Fshare.json',
    };

    rewriteEditorPreviewRoute(request);

    expect(request.url).toBe('/editor/?src=http%3A%2F%2Flocalhost%3A9000%2Fshare.json');
  });

  it('rewrites public embed deep links to the editor app entry', () => {
    const request = {
      url: '/editor/embed/cdc733d4-fd28-41fc-a1f0-cf7af0f62381?src=http%3A%2F%2Flocalhost%3A9000%2Fshare.json',
    };

    rewriteEditorPreviewRoute(request);

    expect(request.url).toBe('/editor/?src=http%3A%2F%2Flocalhost%3A9000%2Fshare.json');
  });

  it('leaves regular editor and landing routes unchanged', () => {
    const editorRequest = { url: '/editor/?project=Demo' };
    const landingRequest = { url: '/pricing' };

    rewriteEditorPreviewRoute(editorRequest);
    rewriteEditorPreviewRoute(landingRequest);

    expect(editorRequest.url).toBe('/editor/?project=Demo');
    expect(landingRequest.url).toBe('/pricing');
  });

  it('rewrites no-slash app routes to their app directories', () => {
    const editorRequest = { url: '/editor?project=Demo' };
    const joystickRequest = { url: '/joystick?code=ABCD-1234' };

    rewriteEditorPreviewRoute(editorRequest);
    rewriteEditorPreviewRoute(joystickRequest);

    expect(editorRequest.url).toBe('/editor/?project=Demo');
    expect(joystickRequest.url).toBe('/joystick/?code=ABCD-1234');
  });
});
