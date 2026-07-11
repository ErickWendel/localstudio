export type AssetFileUtilsContractResult = {
  extensions: string[];
  readableBlobText: string;
  remoteBlobText: string;
  unreadableBlob: Blob | undefined;
};

export async function evaluateAssetFileUtilsContract(): Promise<AssetFileUtilsContractResult> {
  const { assetFileUtils } = (await import(
    '/editor/src/services/storage/assetFileUtils.ts'
  )) as typeof import('../../../apps/editor/src/services/storage/assetFileUtils');

  const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
  const remoteBlobText = await assetFileUtils
    .objectUrlToBlob('https://example.test/image.png', () =>
      Promise.resolve(new Response('remote-image')),
    )
    .then((blob) => blob.text());
  const unreadableBlob = await assetFileUtils.objectUrlToBlobIfReadable(
    'https://example.test/no-fetch.png',
    undefined,
  );
  const readableBlob = await assetFileUtils.objectUrlToBlobIfReadable(dataUrl, undefined);

  return {
    extensions: [
      assetFileUtils.getAssetFileExtension('image/jpeg'),
      assetFileUtils.getAssetFileExtension('image/gif'),
      assetFileUtils.getAssetFileExtension('image/webp'),
      assetFileUtils.getAssetFileExtension('video/mp4'),
      assetFileUtils.getAssetFileExtension('video/webm'),
      assetFileUtils.getAssetFileExtension('video/quicktime'),
      assetFileUtils.getAssetFileExtension('application/octet-stream'),
    ],
    readableBlobText: readableBlob ? await readableBlob.text() : '',
    remoteBlobText,
    unreadableBlob,
  };
}
