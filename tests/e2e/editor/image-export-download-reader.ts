import { buffer } from 'node:stream/consumers';
import { type Download } from '@playwright/test';
import { unzipSync } from 'fflate';

import { expect } from '../support/journey-test';

export const imageExportDownloadReader = {
  async readBytes(download: Download) {
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    return buffer(stream);
  },

  async readZip(download: Download) {
    const contents = await this.readBytes(download);
    return unzipSync(new Uint8Array(contents));
  },
};
