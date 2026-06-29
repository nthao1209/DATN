
export const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export function appPath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
