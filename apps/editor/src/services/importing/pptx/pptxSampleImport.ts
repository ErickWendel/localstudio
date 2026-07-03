import type { PptxImportInput } from './pptxImportService';

const sampleFileName = 'web-ai-beyond-chat-codecon-meetup-26052026.pptx';
const sampleFileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export async function loadPptxSampleImportInput(): Promise<PptxImportInput> {
  const response = await fetch('/__localstudio/pptx-sample/file');
  if (!response.ok) {
    throw new Error('The local PowerPoint sample is not available.');
  }

  const blob = await response.blob();
  return {
    file: new File([blob], sampleFileName, {
      type: sampleFileType,
    }),
  };
}
