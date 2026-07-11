import { type Page } from '../../../apps/editor/src/domain/documents/model';
import { type PresentationExportWarning } from '../../../apps/editor/src/services/contracts/interfaces';
import { type PptxPackagePatchPage } from '../../../apps/editor/src/services/exporting/pptxPackagePatcher';

const minimalPptxPackageBase64 =
  'UEsDBBQAAAAIAHN/6Vwvs4W/qAAAADUBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QSw7CMAxErxJli9oUFixQPwvgBlwgCmkbkZ9iU5Xb47SsKmBpj59n7LqbnWWTTmCCb/i+rHjX1rdX1MBI8dDwETGehAA1aiehDFF7UvqQnEQq0yCiVA85aHGoqqNQwaP2WGDewdv6onv5tMiuM7VXF8I5O69z2arhMkZrlESSRVbFVy5pC3/Ayd836YpPspLIZQZGE2H32yH6YWNgXL4s94kQy2PaN1BLAwQUAAAACABzf+lcxai+J0sAAABWAAAAFAAAAHBwdC9wcmVzZW50YXRpb24ueG1ssymwKihKLU7NK0ksyczPU6jIzckrtiqwVcooKSmw0tcvTs5IzU0s1ssvSM0DyqXlF+UmlgC5Ren6yPpyc/SNDAzM9HMTM/OU9O0AUEsDBBQAAAAIAHN/6VzkAO1e6QAAAN0BAAAVAAAAcHB0L3NsaWRlcy9zbGlkZTEueG1sjVDLTsMwEPyVyHdwQcAhSnJCSFxQpPIDrr1JVvJjtTaln48dNwKqHnraWXtmZ2c7aqM1zclZH1vqxZIStVJGvYBT8T4Q+Pw3BXYq5ZZnSQwRfFIJg3dWPu52L9Ip9OI8RN0yxLD6Rj9f0/Mt+jBNqOE16C+Xd6lDGOy6VFyQohhyMr23ptRInwxQEKEuxR9H1COvnI/jyA2aXjyJxisHvUCnZrh7EHLo5D/uwSK9obVDp1bccAvuAFnL72bj/5Jyc/aLVF33dGn6vJkmOKU/npWZYZGupUbIcEuV0OUTFhSsqbrtqQgy6QdQSwMEFAAAAAgAc3/pXENyEzaeAAAAcgEAACAAAABwcHQvc2xpZGVzL19yZWxzL3NsaWRlMS54bWwucmVsc62QMQ7CMAxFr1LlAHFbIQZEO7F0RVwgStw0ok6sJCC4PQEWKnVg6Ohv6f2nfzzjrLILPk2OU/Wg2adOTDnzASDpCUklGRh9+YwhksrljBZY6auyCG1d7yH+MkS/YFaD6UQcTCOqy5PxH3YYR6fxFPSN0OeVCnBUugtQRYu5E1ICoXHqmzeSvRWwrtFuqXF3BsOKxidvJPHurQGLifsXUEsDBBQAAAAIAHN/6VwdgLxVBQAAAAMAAAAUAAAAcHB0L21lZGlhL2ltYWdlMS5wbmdjZGIGAFBLAwQUAAAACABzf+lcviBcbAUAAAADAAAAFAAAAHBwdC9tZWRpYS92aWRlbzEubXA0Y2FlAwBQSwECFAAUAAAACABzf+lcL7OFv6gAAAA1AQAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUABQAAAAIAHN/6VzFqL4nSwAAAFYAAAAUAAAAAAAAAAAAAAAAANkAAABwcHQvcHJlc2VudGF0aW9uLnhtbFBLAQIUABQAAAAIAHN/6VzkAO1e6QAAAN0BAAAVAAAAAAAAAAAAAAAAAFYBAABwcHQvc2xpZGVzL3NsaWRlMS54bWxQSwECFAAUAAAACABzf+lcQ3ITNp4AAAByAQAAIAAAAAAAAAAAAAAAAAByAgAAcHB0L3NsaWRlcy9fcmVscy9zbGlkZTEueG1sLnJlbHNQSwECFAAUAAAACABzf+lcHYC8VQUAAAADAAAAFAAAAAAAAAAAAAAAAABOAwAAcHB0L21lZGlhL2ltYWdlMS5wbmdQSwECFAAUAAAACABzf+lcviBcbAUAAAADAAAAFAAAAAAAAAAAAAAAAACFAwAAcHB0L21lZGlhL3ZpZGVvMS5tcDRQSwUGAAAAAAYABgCYAQAAvAMAAAAA';

export type PptxPatcherContractInput = {
  base64: string;
  pages: Page[];
  patchPages: PptxPackagePatchPage[];
  warnings: PresentationExportWarning[];
};

export const pptxPatcherContractFixtures = {
  createInput(): PptxPatcherContractInput {
    return {
      base64: minimalPptxPackageBase64,
      pages: [
        {
          animationBuilds: [
            {
              delayMs: -50,
              direction: 'left',
              durationMs: 400,
              effect: 'keyboard-typing',
              elementId: 'text-1',
              id: 'build-text',
              kind: 'build-in',
              trigger: 'on-click',
            },
            {
              delayMs: 0,
              effect: 'reveal',
              elementId: 'missing-element',
              id: 'build-missing',
              mediaAction: 'play',
              trigger: 'after-previous',
            },
          ],
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['image-1', 'text-1', 'missing-element'],
          height: 1080,
          id: 'page-1',
          name: 'Patch me',
          transition: {
            delayMs: 250,
            direction: 'left',
            durationMs: 700,
            effect: 'push',
            trigger: 'after-delay',
          },
          visible: true,
          width: 1920,
        },
      ],
      patchPages: [
        {
          elements: [{ crop: { height: 0.7, width: 0.6, x: 0.1, y: 0.2 }, id: 'image-1' }],
          pageId: 'page-1',
        },
      ],
      warnings: [{ category: 'media', code: 'existing-warning', message: 'Existing warning.' }],
    };
  },
};
