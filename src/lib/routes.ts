/**
 * Rutas de la app (sin librería de router: history API + vercel rewrites).
 *
 *   /            → landing
 *   /login       → login único (local o socio)
 *   /admin       → panel del local (requiere rol local)
 *   /{slug}      → portal de socios de un local
 *
 * RESERVED_SLUGS tiene que coincidir con acuva_slug_reservado() en
 * supabase/01_locales_slug_y_vinculos.sql
 */
export const RESERVED_SLUGS = [
  'login', 'admin', 'registro', 'api', 'app', 'assets', 'static',
  'landing', 'precios', 'planes', 'ayuda', 'soporte', 'terminos',
  'privacidad', 'www', 'acuva', 'socios', 'local', 'locales',
  'dashboard', 'auth', 'logout', 'salir', 'carnet', 'panel',
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type Route =
  | { name: 'landing' }
  | { name: 'login' }
  | { name: 'admin' }
  | { name: 'local'; slug: string }
  | { name: 'not_found' };

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= 3 && slug.length <= 40;
}

export function parseRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/') return { name: 'landing' };
  if (clean === '/login') return { name: 'login' };
  if (clean === '/admin' || clean.startsWith('/admin/')) return { name: 'admin' };

  const segments = clean.slice(1).split('/');
  if (segments.length === 1) {
    const slug = decodeURIComponent(segments[0]).toLowerCase();
    if (SLUG_PATTERN.test(slug) && !isReservedSlug(slug)) {
      return { name: 'local', slug };
    }
  }

  return { name: 'not_found' };
}

export function localPath(slug: string): string {
  return `/${slug}`;
}

/** URL completa del portal del local, ej. https://acuva.com.ar/power-gym */
export function localUrl(slug: string): string {
  return `${window.location.origin}${localPath(slug)}`;
}

/** Versión corta para mostrar, ej. acuva.com.ar/power-gym */
export function localDisplayUrl(slug: string): string {
  return `${window.location.host}${localPath(slug)}`;
}

/** Normaliza un texto libre al formato de slug (misma regla que el SQL). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
