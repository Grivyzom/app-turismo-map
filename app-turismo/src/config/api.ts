const getFallbackUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8081`;
  }
  return 'http://localhost:8081';
};

export const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  getFallbackUrl();
