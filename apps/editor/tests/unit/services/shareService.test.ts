import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleProject } from '../../../src/domain/sampleProject';
import { BrowserShareService } from '../../../src/services/shareService';

describe('BrowserShareService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
  });

  it('creates an unlisted share and returns public URLs', async () => {
    const service = new BrowserShareService({ origin: 'https://localstudio.test' });

    const share = await service.createShare(createSampleProject());

    expect(share.shareId).toBe('00000000-0000-4000-8000-000000000001');
    expect(share.publicUrl).toBe('https://localstudio.test/editor/s/00000000-0000-4000-8000-000000000001');
    expect(share.embedUrl).toBe('https://localstudio.test/editor/embed/00000000-0000-4000-8000-000000000001');
    expect(share.embedHtml).toContain('<iframe');
    expect(share.embedHtml).toContain('https://localstudio.test/editor/embed/00000000-0000-4000-8000-000000000001');
    expect(share.status).toBe('published');
  });

  it('fetches the latest project for a share', async () => {
    const service = new BrowserShareService({ origin: 'https://localstudio.test' });
    const createdShare = await service.createShare(createSampleProject());

    const record = await service.getShare(createdShare.shareId);

    expect(record?.project.name).toBe('Untitled AI Deck');
    expect(record?.project.assets['asset-hero']?.objectUrl).toBeDefined();
  });

  it('updates an existing share with the latest project state', async () => {
    const service = new BrowserShareService({ origin: 'https://localstudio.test' });
    const project = createSampleProject();
    const createdShare = await service.createShare(project);

    await service.updateShare(createdShare.shareId, { ...project, name: 'Updated Deck' });
    const record = await service.getShare(createdShare.shareId);

    expect(record?.project.name).toBe('Updated Deck');
    expect(record?.updatedAt).not.toBe(record?.createdAt);
  });

  it('returns null for missing shares', async () => {
    const service = new BrowserShareService({ origin: 'https://localstudio.test' });

    await expect(service.getShare('missing-share')).resolves.toBeNull();
  });

  it('rejects updates for missing shares', async () => {
    const service = new BrowserShareService({ origin: 'https://localstudio.test' });

    await expect(service.updateShare('missing-share', createSampleProject())).rejects.toThrow(
      'Share missing-share was not found.',
    );
  });
});
