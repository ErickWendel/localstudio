import { describe, expect, it } from 'vitest';
import { getStandaloneAppRedirectUrl } from '../../src/routing/standaloneAppRedirect';

describe('standalone app redirect', () => {
  it('redirects no-slash app routes to app directories', () => {
    expect(
      getStandaloneAppRedirectUrl({
        hash: '#install',
        pathname: '/joystick',
        search: '?code=ABCD-1234',
      }),
    ).toBe('/joystick/?code=ABCD-1234#install');
    expect(
      getStandaloneAppRedirectUrl({
        hash: '',
        pathname: '/editor',
        search: '?project=Demo',
      }),
    ).toBe('/editor/?project=Demo');
  });

  it('leaves landing and already-normalized app routes unchanged', () => {
    expect(
      getStandaloneAppRedirectUrl({
        hash: '',
        pathname: '/',
        search: '',
      }),
    ).toBeUndefined();
    expect(
      getStandaloneAppRedirectUrl({
        hash: '',
        pathname: '/editor/',
        search: '',
      }),
    ).toBeUndefined();
  });
});
