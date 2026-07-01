import { ArrowRight, Database, FolderOpen, Link2 } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { s3MirrorPayloadItems } from '../content/s3MirrorPayloadItems';

export function S3MirrorSection({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <section id="s3-mirror" className="s3-mirror-section" aria-labelledby="s3-mirror-title">
      <Reveal as="div" className="s3-mirror-copy" reveal="s3-mirror-copy">
        <p className="eyebrow">S3-compatible mirror</p>
        <h2 id="s3-mirror-title">Local projects can still publish public links.</h2>
        <p>
          S3-compatible storage keeps viewer assets reachable while the editable project still starts on your machine.
          MinIO works as the local/self-hosted example, but the same mirror shape fits any S3-compatible bucket.
        </p>
        <ul className="s3-mirror-proof" aria-label="Mirrored project payloads">
          <li>Project JSON</li>
          <li>Referenced assets</li>
          <li>Version history</li>
          <li>Local config</li>
          <li>Public share payloads</li>
        </ul>
        <p className="s3-mirror-trust">
          Keys stay in this browser profile. Bring MinIO, AWS S3, R2, or any compatible endpoint.
        </p>
      </Reveal>

      <Reveal
        as="div"
        className="s3-mirror-visual"
        aria-label="Local-to-public S3 mirror flow"
        data-motion={prefersReducedMotion ? 'static' : 'active'}
        delay={120}
        reveal="s3-mirror-visual"
      >
        <div className="mirror-node mirror-node-local">
          <FolderOpen size={24} aria-hidden="true" />
          <span>Local folder</span>
          <strong>deck.localstudio</strong>
        </div>

        <div className="mirror-lane" aria-hidden="true">
          {s3MirrorPayloadItems.map((item, index) => (
            <span className="mirror-packet" data-packet={index + 1} key={item.label}>
              {item.label}
            </span>
          ))}
        </div>

        <div className="mirror-node mirror-node-bucket">
          <Database size={24} aria-hidden="true" />
          <span>S3 bucket</span>
          <strong>mirrors/project-id</strong>
        </div>

        <div className="mirror-node mirror-node-public">
          <Link2 size={24} aria-hidden="true" />
          <span>Public viewer</span>
          <strong>share link</strong>
        </div>

        <div className="mirror-screenshot-frame" aria-hidden="true">
          <div className="mirror-window-bar">
            <span />
            <span />
            <span />
            <strong>MinIO / S3 mirror</strong>
          </div>
          <div className="mirror-window-list">
            {s3MirrorPayloadItems.map((item) => (
              <span key={item.label}>
                <ArrowRight size={13} aria-hidden="true" />
                <strong>Synced</strong>
                {item.description}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
