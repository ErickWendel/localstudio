import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';
import { mirrorFileContractProject } from './mirror-file-contract-project';

type MirrorVersionHistoryEntry = {
  changeCount: number;
  createdAt: string;
  fileName: string;
  id: string;
  projectName: string;
  summary: string;
};

type MirrorConfigurationFixture = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
  region: string;
  secretAccessKey: string;
};

export type MirrorFileGenerationContractInput = {
  config: MirrorConfigurationFixture;
  nowIso: string;
  project: ProjectDocument;
  versionHistory: MirrorVersionHistoryEntry[];
  versionProject: ProjectDocument;
};

export const mirrorFileGenerationContractFixtures = {
  createInput(): MirrorFileGenerationContractInput {
    return {
      config: {
        accessKeyId: 'access',
        bucket: 'bucket',
        endpoint: 'https://s3.example.test',
        publicBaseUrl: ' https://cdn.example.test/public ',
        region: 'us-east-1',
        secretAccessKey: 'secret',
      },
      nowIso: '2026-07-09T12:34:00.000Z',
      project: mirrorFileContractProject.createProject(),
      versionHistory: [
        {
          changeCount: 1,
          createdAt: '2026-07-09T12:01:00.000Z',
          fileName: 'version-1.json',
          id: 'version-1',
          projectName: 'Mirror Contract',
          summary: '1 edit',
        },
        {
          changeCount: 1,
          createdAt: '2026-07-09T12:02:00.000Z',
          fileName: 'missing-version.json',
          id: 'missing-version',
          projectName: 'Mirror Contract',
          summary: 'missing',
        },
      ],
      versionProject: mirrorFileContractProject.createVersionProject(),
    };
  },
};
