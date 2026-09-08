export const API_BASE_URL = 'http://localhost:8000';

export const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${Math.floor(seconds)} S`;
  }
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m} Min ${s} S`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h} Hr ${m} Min ${s} S`;
};
