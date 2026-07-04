import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { PresenterRemoteSessionMetadata } from '../../services/presenter/presenterSessionTypes';

interface PresenterRemotePanelProps {
  session: PresenterRemoteSessionMetadata;
}

function formatExpiry(expiresAt: string) {
  const remainingMs = Math.max(0, Date.parse(expiresAt) - Date.now());
  const remainingHours = Math.ceil(remainingMs / 3_600_000);
  return `${remainingHours}h remaining`;
}

export function PresenterRemotePanel({ session }: PresenterRemotePanelProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState<'copied' | 'idle'>('idle');

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(session.qrUrl, {
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      margin: 2,
      width: 232,
    }).then((url) => {
      if (!cancelled) setQrCodeUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [session.qrUrl]);

  async function copyRemoteLink() {
    await navigator.clipboard?.writeText(session.qrUrl);
    setCopyStatus('copied');
  }

  return (
    <section
      className="presenter-remote-panel"
      aria-label="Remote control this presentation"
    >
      <header className="presenter-remote-header">
        <span className="presenter-remote-connected">
          Connected ({session.connectedControllerCount})
        </span>
        <span className="presenter-remote-expiry">{formatExpiry(session.expiresAt)}</span>
      </header>
      <div className="presenter-remote-body">
        <div>
          <h2>Remote control this presentation</h2>
          <p>Scan the code or open the link from another device.</p>
        </div>
        {qrCodeUrl ? (
          <img
            className="presenter-remote-qr"
            src={qrCodeUrl}
            alt="Remote control QR code"
          />
        ) : (
          <div className="presenter-remote-qr presenter-remote-qr-loading" aria-hidden="true" />
        )}
        <button type="button" className="presenter-remote-copy" onClick={() => void copyRemoteLink()}>
          <span className="material-symbols-outlined" aria-hidden="true">
            link
          </span>
          {copyStatus === 'copied' ? 'Copied' : 'Copy remote link'}
        </button>
      </div>
    </section>
  );
}
