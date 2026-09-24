interface MinioErrorBody {
  code?: string;
  message?: string;
}

const STORAGE_FULL_CODES = new Set([
  'InsufficientStorage',
  'XMinioStorageBackendFull',
  'XMinioStorageFull',
]);

const QUOTA_CODES = new Set(['QuotaExceeded', 'XMinioAdminBucketQuotaExceeded']);

function readXmlTag(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(xml);
  const value = match?.[1]?.trim();
  return value || undefined;
}

async function readMinioErrorBody(response: Response): Promise<MinioErrorBody> {
  let text: string;
  try {
    text = (await response.text()).trim();
  } catch {
    return {};
  }
  if (!text) return {};
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as {
        Code?: unknown;
        Message?: unknown;
        code?: unknown;
        message?: unknown;
      };
      const code = parsed.Code ?? parsed.code;
      const message = parsed.Message ?? parsed.message;
      return {
        ...(typeof code === 'string' ? { code: code.trim() } : {}),
        ...(typeof message === 'string' ? { message: message.trim() } : {}),
      };
    } catch {
      return {};
    }
  }
  const code = readXmlTag(text, 'Code');
  const message = readXmlTag(text, 'Message');
  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
  };
}

function storageDiskFullMessage(status: number, code: string | undefined): string {
  const reportedCode = code && STORAGE_FULL_CODES.has(code) ? code : 'XMinioStorageFull';
  return `Mirroring paused because the storage disk needs more free space (HTTP ${status}, ${reportedCode}). Your file is fine, and this is not a bucket quota. Free some space on that disk, then try again.`;
}

function bucketQuotaMessage(): string {
  return 'Mirroring paused because this bucket has reached its storage quota. Your file is fine, and the disk itself is not full. Raise the quota or remove unused mirrored files, then try again.';
}

function explainKnownMinioFailure(status: number, body: MinioErrorBody): string | undefined {
  const code = body.code;
  if (status === 507 || (code !== undefined && STORAGE_FULL_CODES.has(code))) {
    return storageDiskFullMessage(status, code);
  }
  if (code !== undefined && QUOTA_CODES.has(code)) return bucketQuotaMessage();
  if (code === 'NoSuchBucket') {
    return 'Mirroring paused because that storage bucket was not found. Your file is fine. Check the bucket name, then try again.';
  }
  if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
    return 'Mirroring paused because the storage login was not accepted. Your file is fine. Check the access key, secret, and region, then try again.';
  }
  if (code === 'EntityTooLarge') {
    return 'Mirroring paused because one file is larger than the storage limit. Your file is fine. Make it smaller or raise the limit, then try again.';
  }
  if (code === 'RequestTimeTooSkewed') {
    return 'Mirroring paused because the computer clock does not match the storage server. Your file is fine. Check the clock, then try again.';
  }
  if (code === 'SlowDown') {
    return 'Mirroring paused because storage asked us to wait a moment. Your file is fine. Try again shortly.';
  }
  return undefined;
}

export async function describeMinioHttpFailure(response: Response, fallback: string): Promise<string> {
  const body = await readMinioErrorBody(response);
  return explainKnownMinioFailure(response.status, body) ?? fallback;
}
