import { useMemo, useRef, useState } from 'react';
import { parseModuleFile, readConsolidatedWorkbook, parseMappedSheet, type WorkbookSheet } from '../../utils/excelParser';
import { dashboardAudits, DASHBOARD_AUDIT_IDS, type RawModule } from '../../utils/consolidatedDashboard';

interface Props {
  onReady: (raw: RawModule[]) => void;
  onBack: () => void;
  initial?: RawModule[];
}

type Mode = 'separate' | 'workbook';
const IGNORE = '__ignore__';

/**
 * Carga del Dashboard Consolidado IAAS con dos opciones:
 *  A) Un archivo por auditoría (7 ranuras).
 *  B) Un único libro Excel con una hoja por auditoría (mapeo automático + ajuste).
 */
export default function DashboardUpload({ onReady, onBack, initial }: Props) {
  const audits = useMemo(() => dashboardAudits(), []);
  const [mode, setMode] = useState<Mode>('separate');
  const [error, setError] = useState<string | null>(null);

  // Modo A: un RawModule por auditoría.
  const [modules, setModules] = useState<Record<string, RawModule>>(() => {
    const m: Record<string, RawModule> = {};
    for (const r of initial ?? []) m[r.auditId] = r;
    return m;
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Modo B: libro con hojas.
  const [wbName, setWbName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<WorkbookSheet[]>([]);
  const [assign, setAssign] = useState<Record<number, string>>({});
  const [wbLoading, setWbLoading] = useState(false);
  const wbInputRef = useRef<HTMLInputElement>(null);

  const loadModuleFile = async (auditId: string, file: File) => {
    setError(null);
    setLoadingId(auditId);
    try {
      const wb = await parseModuleFile(file, 'IAAS', auditId);
      setModules((prev) => ({ ...prev, [auditId]: { auditId, fileName: file.name, workbook: wb } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      setLoadingId(null);
    }
  };

  const removeModule = (auditId: string) => setModules((prev) => { const n = { ...prev }; delete n[auditId]; return n; });

  const loadWorkbook = async (file: File) => {
    setError(null);
    setWbLoading(true);
    try {
      const { fileName, sheets } = await readConsolidatedWorkbook(file);
      setWbName(fileName);
      setSheets(sheets);
      // Asignación inicial: la deducida (o «ignorar»). Evita duplicar auditorías.
      const used = new Set<string>();
      const a: Record<number, string> = {};
      sheets.forEach((s, i) => {
        if (s.guessedAuditId && !used.has(s.guessedAuditId)) { a[i] = s.guessedAuditId; used.add(s.guessedAuditId); }
        else a[i] = IGNORE;
      });
      setAssign(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el libro.');
    } finally {
      setWbLoading(false);
    }
  };

  const buildFromWorkbook = () => {
    setError(null);
    const raw: RawModule[] = [];
    const used = new Set<string>();
    for (let i = 0; i < sheets.length; i++) {
      const auditId = assign[i];
      if (!auditId || auditId === IGNORE) continue;
      if (used.has(auditId)) { setError(`La auditoría «${audits.find((a) => a.id === auditId)?.name}» está asignada a más de una hoja. Deja sólo una.`); return; }
      const wb = parseMappedSheet(sheets[i], wbName ?? 'libro.xlsx', 'IAAS', auditId);
      if (!wb) { setError(`La hoja «${sheets[i].sheetName}» está vacía.`); return; }
      used.add(auditId);
      raw.push({ auditId, fileName: `${wbName} · ${sheets[i].sheetName}`, workbook: wb });
    }
    if (raw.length === 0) { setError('Asigna al menos una hoja a una auditoría.'); return; }
    onReady(raw);
  };

  const separateList = Object.values(modules);
  const canContinueSeparate = separateList.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black text-slate-800">Dashboard Consolidado IAAS</h2>
        <p className="mt-2 text-slate-500">Carga los resultados de cada auditoría. Puedes subir un archivo por auditoría o un único libro con una hoja por auditoría.</p>
      </div>

      {/* Selector de modo */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        <button type="button" onClick={() => setMode('separate')} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === 'separate' ? 'bg-white text-nex-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          📁 Un archivo por auditoría
        </button>
        <button type="button" onClick={() => setMode('workbook')} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === 'workbook' ? 'bg-white text-nex-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          📗 Un libro con hojas
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">⚠️ {error}</div>}

      {mode === 'separate' ? (
        <div className="space-y-2.5">
          {audits.map((a) => {
            const loaded = modules[a.id];
            const busy = loadingId === a.id;
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{a.name} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">{a.mode === 'vigilancia' ? 'vigilancia' : 'práctica'}</span></p>
                  {loaded ? <p className="truncate text-[11.5px] text-green-600">✓ {loaded.fileName}</p> : <p className="text-[11.5px] text-slate-400">Sin archivo</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {loaded && <button type="button" onClick={() => removeModule(a.id)} className="text-xs font-semibold text-slate-400 hover:text-red-600">Quitar</button>}
                  <label className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition ${loaded ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-nex-300 bg-nex-50 text-nex-700 hover:bg-nex-100'}`}>
                    {busy ? 'Leyendo…' : loaded ? 'Reemplazar' : 'Subir'}
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadModuleFile(a.id, f); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-3">
            <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-nex-700">← Volver</button>
            <button type="button" onClick={() => onReady(separateList)} disabled={!canContinueSeparate} className="btn-primary">
              Ver dashboard ({separateList.length}/{DASHBOARD_AUDIT_IDS.length}) →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            onClick={() => wbInputRef.current?.click()}
            className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-nex-400"
            role="button"
            tabIndex={0}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-nex-100 text-2xl">📗</div>
            {wbLoading ? <p className="font-medium text-nex-700">Leyendo el libro…</p> : <>
              <p className="font-semibold text-slate-700">{wbName ? 'Reemplazar libro' : 'Sube un libro con una hoja por auditoría'}</p>
              <p className="text-sm text-slate-400">{wbName ?? 'Formatos: .xlsx, .xls'}</p>
            </>}
            <input ref={wbInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadWorkbook(f); e.target.value = ''; }} />
          </div>

          {sheets.length > 0 && (
            <div className="card p-4">
              <p className="mb-3 text-sm font-bold text-slate-700">Mapeo de hojas → auditorías <span className="font-normal text-slate-400">(ajusta si es necesario)</span></p>
              <div className="space-y-2">
                {sheets.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-slate-600">📄 {s.sheetName}</span>
                    <select value={assign[i] ?? IGNORE} onChange={(e) => setAssign((prev) => ({ ...prev, [i]: e.target.value }))} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200">
                      <option value={IGNORE}>— Ignorar —</option>
                      {audits.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-nex-700">← Volver</button>
            {sheets.length > 0 && <button type="button" onClick={buildFromWorkbook} className="btn-primary">Ver dashboard →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
