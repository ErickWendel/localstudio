import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenterRemotePanel } from '../../../../src/ui/presenter/PresenterRemotePanel';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,remote-qr'),
  },
}));

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

describe('PresenterRemotePanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    if (execCommandDescriptor) {
      Object.defineProperty(document, 'execCommand', execCommandDescriptor);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('falls back to selection copy when clipboard writeText is unavailable', async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard blocked')),
      },
    });

    render(
      <PresenterRemotePanel
        session={{
          code: 'peer-1',
          connectedControllerCount: 0,
          expiresAt: '2026-07-05T04:00:00.000Z',
          presenterDeviceId: 'device-1',
          presenterLabel: 'Presenter',
          qrUrl: 'http://192.168.0.141:4288/joystick/?peer=peer-1',
          sessionId: 'session-1',
          transport: 'peerjs',
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy remote link' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
