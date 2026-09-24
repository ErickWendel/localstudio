import { describeMinioHttpFailure } from '../../../src/services/mirror/minioHttpFailure';

const storageFullXml = `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>XMinioStorageFull</Code>
  <Message>Storage backend has reached its minimum free drive threshold. Please delete a few objects to proceed.</Message>
</Error>`;

describe('describeMinioHttpFailure', () => {
  it('explains MinIO HTTP 507 as a full storage disk, not a quota or bad file', async () => {
    const message = await describeMinioHttpFailure(
      new Response(storageFullXml, { status: 507 }),
      'Could not upload mirrors/deck/project.json to MinIO (507).',
    );

    expect(message).toContain('Mirroring paused because the storage disk needs more free space');
    expect(message).toContain('HTTP 507, XMinioStorageFull');
    expect(message).toContain('not a bucket quota');
    expect(message).toContain('Your file is fine');
    expect(message).not.toContain('Could not upload');
  });

  it('explains a bare HTTP 507 response the same way', async () => {
    const message = await describeMinioHttpFailure(
      new Response('', { status: 507 }),
      'Could not upload mirrors/deck/project.json to MinIO (507).',
    );

    expect(message).toContain('HTTP 507, XMinioStorageFull');
    expect(message).toContain('not a bucket quota');
  });

  it('keeps bucket quota distinct from a full disk', async () => {
    const message = await describeMinioHttpFailure(
      new Response(JSON.stringify({ Code: 'QuotaExceeded', Message: 'Bucket quota exceeded.' }), {
        status: 403,
      }),
      'Could not upload mirrors/deck/project.json to MinIO (403).',
    );

    expect(message).toContain('storage quota');
    expect(message).toContain('disk itself is not full');
    expect(message).not.toContain('needs more free space');
  });

  it('explains other storage refusals without calling them a full disk', async () => {
    const cases = [
      ['NoSuchBucket', 'bucket was not found'],
      ['InvalidAccessKeyId', 'storage login was not accepted'],
      ['SignatureDoesNotMatch', 'storage login was not accepted'],
      ['EntityTooLarge', 'larger than the storage limit'],
      ['RequestTimeTooSkewed', 'computer clock'],
      ['SlowDown', 'wait a moment'],
    ] as const;

    for (const [code, expected] of cases) {
      const message = await describeMinioHttpFailure(
        new Response(`<Error><Code>${code}</Code><Message>ignored</Message></Error>`, {
          status: 400,
        }),
        `Could not upload mirrors/deck/project.json to MinIO (400).`,
      );
      expect(message).toContain(expected);
      expect(message).toContain('Your file is fine');
    }
  });

  it('leaves unknown HTTP failures unchanged so callers keep their fallback', async () => {
    const fallback = 'Could not upload mirrors/share.json to MinIO (500).';

    await expect(describeMinioHttpFailure(new Response('', { status: 500 }), fallback)).resolves.toBe(
      fallback,
    );
  });
});
