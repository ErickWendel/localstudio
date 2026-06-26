export const brandTokens = {
  color: {
    bg: '#0c160d',
    black: '#000000',
    panel: '#101b12',
    panelLow: '#151e15',
    raised: '#323c31',
    border: '#40493f',
    green: '#37fd76',
    greenFixed: '#69ff89',
    greenHover: '#00ff22',
    cyan: '#36d7ff',
    yellow: '#f2ff5e',
    text: '#ffffff',
    muted: '#c1c9bd',
    dim: '#8a9388',
    danger: '#ff6b6b',
    onPrimary: '#002108',
  },
  font: {
    display: "'Orbitron', Helvetica, sans-serif",
    body: "'Open Sans', Helvetica, sans-serif",
  },
} as const;

export type BrandTokens = typeof brandTokens;
