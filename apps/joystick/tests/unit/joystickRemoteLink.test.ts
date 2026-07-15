import { describe, expect, it } from 'vitest';
import { joystickRemoteLink } from '../../src/app/joystick-remote-link';

describe('joystickRemoteLink', () => {
  it('extracts PeerJS ids from remote URLs', () => {
    expect(
      joystickRemoteLink.getPeerId('https://localstudio.test/joystick/?peer=control-peer-1'),
    ).toBe('control-peer-1');
  });

  it('extracts legacy session codes from remote URLs', () => {
    expect(joystickRemoteLink.getCode('https://localstudio.test/joystick/?code=abcd-1234')).toBe(
      'ABCD-1234',
    );
  });

  it('keeps pasted peer ids available for manual fallback', () => {
    expect(joystickRemoteLink.getPeerId('control-peer-1')).toBe('control-peer-1');
    expect(joystickRemoteLink.getCode('control-peer-1')).toBe('');
  });

  it('does not treat code URLs or session codes as peer ids', () => {
    expect(joystickRemoteLink.getPeerId('https://localstudio.test/joystick/?code=abcd-1234')).toBe(
      '',
    );
    expect(joystickRemoteLink.getPeerId('ABCD-1234')).toBe('');
  });
});
