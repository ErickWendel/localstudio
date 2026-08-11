interface MinioObjectUploadOptions {
  blob: Blob;
  createUrl: (query?: Record<string, string>) => URL;
  key: string;
  onUploadedBytes?: (uploadedBytes: number) => void;
  request: (
    url: URL,
    method: string,
    body?: Blob,
    contentType?: string,
  ) => Promise<Response>;
  sleep: (delayMs: number) => Promise<void>;
}

const MINIO_UPLOAD_POLICY = {
  attempts: 3,
  initialDelayMs: 250,
  multipartPartSize: 5 * 1024 * 1024,
  retryableStatuses: new Set([408, 429, 500, 502, 503, 504]),
} as const;

function parseUploadId(xml: string): string | undefined {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return document.querySelector('UploadId')?.textContent?.trim() || undefined;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function createCompleteMultipartBody(parts: Array<{ etag: string; partNumber: number }>): Blob {
  const partXml = parts
    .map(
      ({ etag, partNumber }) =>
        `<Part><PartNumber>${partNumber}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`,
    )
    .join('');
  return new Blob([`<CompleteMultipartUpload>${partXml}</CompleteMultipartUpload>`], {
    type: 'application/xml',
  });
}

async function requestWithRetry(
  options: MinioObjectUploadOptions,
  request: { body?: Blob; contentType?: string; method: string; url: URL },
  operation: string,
): Promise<Response> {
  for (let attempt = 1; attempt <= MINIO_UPLOAD_POLICY.attempts; attempt += 1) {
    let response: Response;
    try {
      response = await options.request(
        request.url,
        request.method,
        request.body,
        request.contentType,
      );
    } catch (error: unknown) {
      if (attempt === MINIO_UPLOAD_POLICY.attempts) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not ${operation} after ${MINIO_UPLOAD_POLICY.attempts} attempts: ${detail}`,
          { cause: error },
        );
      }
      await options.sleep(MINIO_UPLOAD_POLICY.initialDelayMs * 2 ** (attempt - 1));
      continue;
    }

    if (response.ok) return response;
    if (
      attempt === MINIO_UPLOAD_POLICY.attempts ||
      !MINIO_UPLOAD_POLICY.retryableStatuses.has(response.status)
    ) {
      throw new Error(`Could not ${operation} to MinIO (${response.status}).`);
    }
    await options.sleep(MINIO_UPLOAD_POLICY.initialDelayMs * 2 ** (attempt - 1));
  }

  throw new Error(`Could not ${operation}.`);
}

async function uploadSingleObject(options: MinioObjectUploadOptions): Promise<void> {
  await requestWithRetry(
    options,
    {
      body: options.blob,
      contentType: options.blob.type,
      method: 'PUT',
      url: options.createUrl(),
    },
    `upload ${options.key}`,
  );
  options.onUploadedBytes?.(options.blob.size);
}

async function abortMultipartUpload(
  options: MinioObjectUploadOptions,
  uploadId: string,
): Promise<void> {
  try {
    await options.request(options.createUrl({ uploadId }), 'DELETE');
  } catch {
    // Preserve the original multipart failure.
  }
}

async function uploadMultipartObject(options: MinioObjectUploadOptions): Promise<void> {
  const initiateResponse = await requestWithRetry(
    options,
    { method: 'POST', url: options.createUrl({ uploads: '' }) },
    `initiate multipart upload for ${options.key}`,
  );
  const uploadId = parseUploadId(await initiateResponse.text());
  if (!uploadId) {
    throw new Error(`Could not initiate multipart upload for ${options.key}: missing upload ID.`);
  }

  try {
    const completedParts: Array<{ etag: string; partNumber: number }> = [];
    let uploadedBytes = 0;
    for (
      let offset = 0, partNumber = 1;
      offset < options.blob.size;
      offset += MINIO_UPLOAD_POLICY.multipartPartSize, partNumber += 1
    ) {
      const part = options.blob.slice(
        offset,
        Math.min(options.blob.size, offset + MINIO_UPLOAD_POLICY.multipartPartSize),
        options.blob.type,
      );
      const partResponse = await requestWithRetry(
        options,
        {
          body: part,
          contentType: options.blob.type,
          method: 'PUT',
          url: options.createUrl({ partNumber: String(partNumber), uploadId }),
        },
        `upload ${options.key} part ${partNumber}`,
      );
      const etag = partResponse.headers.get('etag')?.trim();
      if (!etag) {
        throw new Error(`Could not upload ${options.key} part ${partNumber}: missing ETag.`);
      }
      completedParts.push({ etag, partNumber });
      uploadedBytes += part.size;
      options.onUploadedBytes?.(uploadedBytes);
    }

    const completeBody = createCompleteMultipartBody(completedParts);
    await requestWithRetry(
      options,
      {
        body: completeBody,
        contentType: completeBody.type,
        method: 'POST',
        url: options.createUrl({ uploadId }),
      },
      `complete multipart upload for ${options.key}`,
    );
  } catch (error: unknown) {
    await abortMultipartUpload(options, uploadId);
    throw error;
  }
}

async function upload(options: MinioObjectUploadOptions): Promise<void> {
  if (options.blob.size <= MINIO_UPLOAD_POLICY.multipartPartSize) {
    await uploadSingleObject(options);
    return;
  }
  await uploadMultipartObject(options);
}

export const minioObjectUploader = {
  upload,
};
