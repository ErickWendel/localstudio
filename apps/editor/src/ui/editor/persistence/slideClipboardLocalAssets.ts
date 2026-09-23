import type { Asset } from '../../../domain/documents/model';
import { assetFileUtils } from '../../../services/storage/assetFileUtils';
import type { MaterializedLocalAssetFile } from '../../../services/storage/materializeLocalAssetFile';
import type { SlideClipboardState } from '../state/editorViewModelElements';
import { slideClipboardMedia } from '../browser/slideClipboardMedia';

type MaterializeLocalAsset = (
  fileName: string,
  blob: Blob,
) => Promise<MaterializedLocalAssetFile | undefined>;

function withoutSourceFileClaim(asset: Asset): Asset {
  if (asset.storage !== 'file' || !/^(?:blob|data):/.test(asset.objectUrl ?? '')) return asset;
  const { fileName, storage, ...transferableAsset } = asset;
  void fileName;
  void storage;
  return transferableAsset;
}

function preferredFileName(assetId: string, asset: Asset) {
  return asset.fileName ?? `${assetId}.${assetFileUtils.getAssetFileExtension(asset.mimeType)}`;
}

async function readAssetBlob(asset: Asset) {
  const remembered = slideClipboardMedia.readRememberedBlob(asset.objectUrl);
  if (remembered) return remembered;
  if (!assetFileUtils.isDataUrl(asset.objectUrl)) return undefined;
  try {
    return await assetFileUtils.objectUrlToBlob(asset.objectUrl);
  } catch {
    return undefined;
  }
}

export async function materializeSlideClipboardAssets(
  payload: unknown,
  materialize: MaterializeLocalAsset | undefined,
): Promise<unknown> {
  if (!payload || typeof payload !== 'object' || !('assets' in payload)) return payload;
  const slide = payload as SlideClipboardState;
  if (!slide.assets || typeof slide.assets !== 'object') return payload;

  const assets: SlideClipboardState['assets'] = {};
  for (const [assetId, asset] of Object.entries(slide.assets)) {
    const blob = await readAssetBlob(asset);
    if (!blob || !materialize) {
      assets[assetId] = withoutSourceFileClaim(asset);
      continue;
    }
    try {
      const stored = await materialize(preferredFileName(assetId, asset), blob);
      assets[assetId] = stored
        ? { ...asset, fileName: stored.fileName, objectUrl: stored.objectUrl, storage: 'file' }
        : withoutSourceFileClaim(asset);
    } catch {
      assets[assetId] = withoutSourceFileClaim(asset);
    }
  }

  return slideClipboardMedia.resolveSlidePayload({ ...slide, assets });
}
