export const coveragePercentFormat = {
  format(percent: number | '') {
    return typeof percent === 'number' ? `${percent.toFixed(2)}%` : 'n/a';
  },
};
