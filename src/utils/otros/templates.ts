// Plantillas reutilizables del módulo «Otros informes» (persistidas en el
// navegador). Permite guardar, editar, duplicar, eliminar y restablecer.

import type { OtrosConfig } from './types';

const KEY = 'nex-otros-templates';

function hasStorage(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch { return false; }
}

function readAll(): OtrosConfig[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as OtrosConfig[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: OtrosConfig[]): void {
  if (!hasStorage()) return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore quota */ }
}

const genId = () => `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Lista de plantillas guardadas (más recientes primero). */
export function listTemplates(): OtrosConfig[] {
  return readAll().slice().reverse();
}

/** Guarda (crea o actualiza) una plantilla y devuelve su configuración con id. */
export function saveTemplate(cfg: OtrosConfig): OtrosConfig {
  const list = readAll();
  const withId: OtrosConfig = { ...cfg, id: cfg.id || genId() };
  const idx = list.findIndex((t) => t.id === withId.id);
  if (idx >= 0) list[idx] = withId; else list.push(withId);
  writeAll(list);
  return withId;
}

/** Duplica una plantilla (nuevo id y nombre «(copia)»). */
export function duplicateTemplate(id: string): OtrosConfig | null {
  const list = readAll();
  const src = list.find((t) => t.id === id);
  if (!src) return null;
  const copy: OtrosConfig = { ...src, id: genId(), name: `${src.name} (copia)` };
  list.push(copy);
  writeAll(list);
  return copy;
}

/** Elimina una plantilla. */
export function deleteTemplate(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id));
}

/** Restablece (borra) todas las plantillas. */
export function resetTemplates(): void {
  if (!hasStorage()) return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
