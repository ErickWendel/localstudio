import type { MinioMirrorConfig, MinioMirrorCredentials } from './minioMirrorService';

function encodeKeyPath(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function sha256Hex(blob: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array) {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

async function hmacHexWithCryptoKey(key: CryptoKey, value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function getSigningKey(
  config: MinioMirrorConfig,
  credentials: MinioMirrorCredentials,
  dateStamp: string,
) {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${credentials.secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, config.region);
  const kService = await hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

const signingKeyCache = new Map<string, Promise<CryptoKey>>();

async function getSigningCryptoKey(
  config: MinioMirrorConfig,
  credentials: MinioMirrorCredentials,
  dateStamp: string,
) {
  const cacheKey = `${credentials.secretKey}\n${config.region}\n${dateStamp}`;
  const cachedKey = signingKeyCache.get(cacheKey);
  if (cachedKey) return cachedKey;
  const keyPromise = getSigningKey(config, credentials, dateStamp).then((signingKey) =>
    crypto.subtle.importKey(
      'raw',
      toArrayBuffer(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ),
  );
  signingKeyCache.set(cacheKey, keyPromise);
  return keyPromise;
}

function createObjectUrl(config: MinioMirrorConfig, key = '', query: Record<string, string> = {}) {
  const endpoint = new URL(config.endpoint);
  const encodedKey = encodeKeyPath(key);
  const url = config.pathStyle
    ? new URL(`${endpoint.origin}/${encodeURIComponent(config.bucket)}${encodedKey ? `/${encodedKey}` : ''}`)
    : new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodedKey}`);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }
  return url;
}

function createDefaultPublicBaseUrl(config: MinioMirrorConfig) {
  const endpoint = new URL(config.endpoint.trim().replace(/\/+$/g, ''));
  const bucket = encodeURIComponent(config.bucket.trim());
  if (!bucket) return endpoint.origin;
  return config.pathStyle
    ? `${endpoint.origin}/${bucket}`
    : `${endpoint.protocol}//${bucket}.${endpoint.host}`;
}

function createPublicObjectUrl(config: MinioMirrorConfig, key: string) {
  const publicBaseUrl = (config.publicBaseUrl.trim() || createDefaultPublicBaseUrl(config)).replace(
    /\/+$/g,
    '',
  );
  return `${publicBaseUrl}/${encodeKeyPath(key)}`;
}

async function createSignedHeaders(
  config: MinioMirrorConfig,
  method: string,
  url: URL,
  credentials: MinioMirrorCredentials,
  contentType?: string,
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const signingHeaders: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
  };
  if (contentType) signingHeaders['content-type'] = contentType;

  const canonicalHeaders = Object.entries(signingHeaders)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value.trim()}\n`)
    .join('');
  const signedHeaders = Object.keys(signingHeaders).sort().join(';');
  const canonicalQuery = Array.from(url.searchParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    Array.from(new Uint8Array(canonicalRequestHash), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  ].join('\n');
  const signature = await hmacHexWithCryptoKey(
    await getSigningCryptoKey(config, credentials, dateStamp),
    stringToSign,
  );

  const requestHeaders = Object.fromEntries(
    Object.entries(signingHeaders).filter(([name]) => name !== 'host'),
  );
  return {
    ...requestHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export const minioObjectUtils = {
  encodeKeyPath,
  sha256Hex,
  createObjectUrl,
  createDefaultPublicBaseUrl,
  createPublicObjectUrl,
  createSignedHeaders,
};
