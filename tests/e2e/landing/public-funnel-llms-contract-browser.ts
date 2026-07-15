export type PublicFunnelLlmsContractResult = {
  contentType: string | null;
  ok: boolean;
  text: string;
};

export async function evaluatePublicFunnelLlmsContract(): Promise<PublicFunnelLlmsContractResult> {
  const response = await fetch('/llms.txt');
  return {
    contentType: response.headers.get('content-type'),
    ok: response.ok,
    text: await response.text(),
  };
}
