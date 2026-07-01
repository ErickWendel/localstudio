import type { MinioMirrorConfig } from './minioMirrorService';

export function encodeKeyPath(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

export async function sha256Hex(blob: Blob) {
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

async function hmacHex(key: ArrayBuffer | Uint8Array, value: string) {
  return Array.from(await hmacSha256(key, value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(config: MinioMirrorConfig, dateStamp: string) {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${config.secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, config.region);
  const kService = await hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

export function createObjectUrl(config: MinioMirrorConfig, key = '', query: Record<string, string> = {}) {
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

export function createPublicObjectUrl(config: MinioMirrorConfig, key: string) {
  const publicBaseUrl = config.publicBaseUrl.trim().replace(/\/+$/g, '');
  return `${publicBaseUrl}/${encodeKeyPath(key)}`;
}

export async function createSignedHeaders(
  config: MinioMirrorConfig,
  method: string,
  url: URL,
  contentType?: string,
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;

  const canonicalHeaders = Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value.trim()}\n`)
    .join('');
  const signedHeaders = Object.keys(headers).sort().join(';');
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
  const signature = await hmacHex(await getSigningKey(config, dateStamp), stringToSign);

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
