import { modelDownloadContractDownload } from './model-download-contract-download';
import { modelDownloadContractFailure } from './model-download-contract-failure';
import { modelDownloadContractRemoval } from './model-download-contract-removal';

export const modelDownloadContractPage = {
  runDownloadContract: (
    page: Parameters<typeof modelDownloadContractDownload.run>[0],
    baseURL: Parameters<typeof modelDownloadContractDownload.run>[1],
  ) => modelDownloadContractDownload.run(page, baseURL),
  runFailureContract: (
    page: Parameters<typeof modelDownloadContractFailure.run>[0],
    baseURL: Parameters<typeof modelDownloadContractFailure.run>[1],
  ) => modelDownloadContractFailure.run(page, baseURL),
  runRemovalContract: (
    page: Parameters<typeof modelDownloadContractRemoval.run>[0],
    baseURL: Parameters<typeof modelDownloadContractRemoval.run>[1],
  ) => modelDownloadContractRemoval.run(page, baseURL),
};
