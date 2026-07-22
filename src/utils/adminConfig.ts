// Perfil de administrador (sin servidor). Controla el acceso con una CLAVE LOCAL
// (candado de conveniencia en el navegador, no seguridad fuerte), permite editar
// los módulos (nombre, descripción, emoji, visibilidad) y generar enlaces de
// acceso con alcance a uno o varios módulos para compartir a otros.

import { REPORT_TYPES, type ModuleStatus } from '../config/options';
import type { ReportType } from '../types';

const PASS_KEY = 'nex-admin-pass'; // hash de la clave
const SESSION_KEY = 'nex-admin-session'; // sesión activa (sessionStorage)
const MOD_KEY = 'nex-module-overrides'; // overrides de módulos

function hasLS(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch { return false; }
}
function hasSS(): boolean {
  try { return typeof sessionStorage !== 'undefined' && sessionStorage !== null; } catch { return false; }
}

/** Hash simple (djb2). No es criptográfico: solo ofusca la clave local. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ── Clave / sesión ─────────────────────────────────────────────────────────

/** ¿Ya hay una clave de administrador definida? */
export function hasPasscode(): boolean {
  return hasLS() && !!localStorage.getItem(PASS_KEY);
}

/** Define (o cambia) la clave de administrador. */
export function setPasscode(code: string): void {
  if (!hasLS() || !code.trim()) return;
  localStorage.setItem(PASS_KEY, hash(code.trim()));
}

/** Verifica una clave contra la almacenada. */
export function verifyPasscode(code: string): boolean {
  if (!hasLS()) return false;
  return localStorage.getItem(PASS_KEY) === hash(code.trim());
}

/** Inicia sesión de administrador si la clave es correcta. */
export function login(code: string): boolean {
  if (!verifyPasscode(code)) return false;
  if (hasSS()) sessionStorage.setItem(SESSION_KEY, '1');
  return true;
}

/** Cierra la sesión de administrador. */
export function logout(): void {
  if (hasSS()) sessionStorage.removeItem(SESSION_KEY);
}

/** ¿Hay una sesión de administrador activa? (o el enlace legacy ?admin=1). */
export function isAdmin(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('admin') === '1' || url.searchParams.get('auditor') === '1') {
      if (hasSS()) sessionStorage.setItem(SESSION_KEY, '1');
      return true;
    }
  } catch { /* ignore */ }
  return hasSS() && sessionStorage.getItem(SESSION_KEY) === '1';
}

// ── Overrides de módulos ─────────────────────────────────────────────────────

export interface ModuleOverride {
  label?: string;
  description?: string;
  icon?: string; // emoji o data URI de imagen
  hidden?: boolean;
}
export type ModuleOverrides = Partial<Record<ReportType, ModuleOverride>>;

export function getModuleOverrides(): ModuleOverrides {
  if (!hasLS()) return {};
  try { const raw = localStorage.getItem(MOD_KEY); return raw ? (JSON.parse(raw) as ModuleOverrides) : {}; } catch { return {}; }
}

export function saveModuleOverride(rt: ReportType, patch: ModuleOverride): void {
  if (!hasLS()) return;
  const all = getModuleOverrides();
  all[rt] = { ...all[rt], ...patch };
  localStorage.setItem(MOD_KEY, JSON.stringify(all));
}

export function resetModuleOverrides(): void {
  if (hasLS()) localStorage.removeItem(MOD_KEY);
}

export interface ResolvedModule {
  value: ReportType;
  label: string;
  description: string;
  icon: string;
  status: ModuleStatus;
  hidden: boolean;
}

/** Lista de módulos con los overrides del administrador aplicados. */
export function resolveModules(): ResolvedModule[] {
  const ov = getModuleOverrides();
  return REPORT_TYPES.map((m) => {
    const o = ov[m.value] ?? {};
    return {
      value: m.value,
      label: o.label ?? m.label,
      description: o.description ?? m.description,
      icon: o.icon ?? m.icon,
      status: m.status,
      hidden: o.hidden ?? false,
    };
  });
}

// ── Acceso con alcance (compartir) ───────────────────────────────────────────

/** Módulos permitidos por el enlace actual (?only=A,B). null = sin restricción. */
export function scopedModules(): ReportType[] | null {
  try {
    const only = new URL(window.location.href).searchParams.get('only');
    if (!only) return null;
    const set = new Set(REPORT_TYPES.map((m) => m.value as string));
    const list = only.split(',').map((s) => s.trim()).filter((s) => set.has(s)) as ReportType[];
    return list.length ? list : null;
  } catch { return null; }
}

/**
 * Módulos visibles en la portada:
 *  - Con alcance (?only): solo esos módulos.
 *  - Sin alcance: todos, salvo los ocultados por el administrador (que sí ve el admin).
 */
export function visibleModules(admin: boolean): ResolvedModule[] {
  const all = resolveModules();
  const scope = scopedModules();
  if (scope) return all.filter((m) => scope.includes(m.value));
  return admin ? all : all.filter((m) => !m.hidden);
}

/** Construye un enlace para compartir con acceso solo a los módulos elegidos. */
export function buildShareLink(modules: ReportType[]): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  if (modules.length === 0) return base;
  return `${base}?only=${modules.join(',')}`;
}
