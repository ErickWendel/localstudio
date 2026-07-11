export type MockAiWorkerPayload = {
  mockOptions: {
    bonsaiGenerateFailures?: number;
  };
  pngBytes: number[];
  slideElements: string[];
  slideTasks: string;
};
