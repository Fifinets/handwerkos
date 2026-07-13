type PublicUrlEnv = {
  VITE_PUBLIC_APP_URL?: string;
  VITE_APP_URL?: string;
  VITE_SITE_URL?: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export function getPublicBaseUrl(
  env: PublicUrlEnv = import.meta.env,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
) {
  const configuredUrl = env.VITE_PUBLIC_APP_URL || env.VITE_APP_URL || env.VITE_SITE_URL;
  const baseUrl = configuredUrl?.trim() || origin;

  return trimTrailingSlash(baseUrl);
}

export function buildPublicOfferUrl(token: string, env?: PublicUrlEnv, origin?: string) {
  return `${getPublicBaseUrl(env, origin)}/public/offer/${token}`;
}
