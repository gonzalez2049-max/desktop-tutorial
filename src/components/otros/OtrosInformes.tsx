import { useMemo, useRef, useState } from 'react';
import type { ParsedWorkbook } from '../../types';
import { parseExcelFile } from '../../utils/excelParser';
import { analyzeOtros, autoMapColumns } from '../../utils/otros/analysis';
import { deleteTemplate, duplicateTemplate, listTemplates, resetTemplates, saveTemplate } from '../../utils/otros/templates';
import { emptyOtrosConfig, OTROS_REPORT_TYPES, type OtrosConfig, type OtrosResult } from '../../utils/otros/types';
import BackBar from '../BackBar';
import OtrosMapping from './OtrosMapping';
import OtrosWizard from './OtrosWizard';
import OtrosResultView from './OtrosResult';

interface Props {
  /** Salir del módulo (volver al inicio de la app). */
  onExit: () => void;
}

type Step = 'home' | 'upload' | 'mapping' | 'wizard' | 'validation' | 'result';
const typeLabel = (v: string) => OTROS_REPORT_TYPES.find((t) => t.value === v)?.label ?? v;

export default function OtrosInformes({ onExit }: Props) {
  const [step, setStep] = useState<Step>('home');
  const [hist, setHist] = useState<Step[]>([]);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [config, setConfig] = useState<OtrosConfig>(emptyOtrosConfig());
  const [result, setResult] = useState<OtrosResult | null>(null);
  const [templates, setTemplates] = useState<OtrosConfig[]>(() => listTemplates());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const go = (s: Step) => { setHist((h) => [...h, step]); setStep(s); };
  const back = () => setHist((h) => { if (h.length === 0) { onExit(); return h; } setStep(h[h.length - 1]); return h.slice(0, -1); });
  const refreshTemplates = () => setTemplates(listTemplates());

  const patch = (p: Partial<OtrosConfig>) => setConfig((c) => ({ ...c, ...p }));

  const handleFile = async (file: File) => {
    setError(null); setLoading(true);
    try {
      const wb = await parseExcelFile(file);
      setWorkbook(wb);
      // Auto-mapea; conserva ajustes de la plantilla para columnas que existan.
      const auto = autoMapColumns(wb);
      const merged: Record<string, typeof auto[string]> = {};
      for (const h of wb.headers) merged[h] = config.mapping[h] ?? auto[h];
      setConfig((c) => ({ ...c, mapping: merged }));
      go('mapping');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally { setLoading(false); }
  };

  const startNew = () => { setConfig(emptyOtrosConfig()); setWorkbook(null); setResult(null); go('upload'); };
  const useTemplate = (t: OtrosConfig) => { setConfig({ ...t }); setWorkbook(null); setResult(null); go('upload'); };

  const toValidation = () => { setResult(analyzeOtros(config, workbook!)); go('validation'); };
  const generate = () => { setResult(analyzeOtros(config, workbook!)); go('result'); };
  const persist = () => { const s = saveTemplate(config); setConfig(s); refreshTemplates(); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const mappingSummary = useMemo(() => {
    if (!workbook) return [];
    return workbook.headers.map((h) => ({ h, t: config.mapping[h] ?? 'texto' }));
  }, [workbook, config.mapping]);

  return (
    <div className="space-y-5">
      <BackBar onBack={back} onHome={onExit} canBack={hist.length > 0 || step !== 'home'} showHome />

      {/* HOME: plantillas + nuevo */}
      {step === 'home' && (
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800">🧩 Otros informes</h2>
            <p className="mt-1 text-slate-500">Módulo genérico: carga un Excel o CSV y arma cualquier análisis con el asistente.</p>
          </div>
          <button onClick={startNew} className="btn-primary mx-auto flex">+ Nuevo informe</button>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Plantillas guardadas</h3>
              {templates.length > 0 && <button className="text-xs font-semibold text-slate-400 hover:text-red-600" onClick={() => { if (confirm('¿Borrar todas las plantillas?')) { resetTemplates(); refreshTemplates(); } }}>Restablecer todas</button>}
            </div>
            {templates.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400">Aún no hay plantillas. Crea un informe y guárdalo como plantilla reutilizable.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-700">{t.name || 'Sin nombre'}</p>
                      <p className="text-xs text-slate-400">{typeLabel(t.reportType)}{t.objective ? ` · ${t.objective}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 text-xs font-semibold">
                      <button className="text-nex-700 hover:underline" onClick={() => useTemplate(t)}>Usar</button>
                      <button className="text-slate-500 hover:underline" onClick={() => { duplicateTemplate(t.id); refreshTemplates(); }}>Duplicar</button>
                      <button className="text-red-500 hover:underline" onClick={() => { deleteTemplate(t.id); refreshTemplates(); }}>Eliminar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* UPLOAD */}
      {step === 'upload' && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-800">Sube tu Excel o CSV</h2>
            <p className="mt-2 text-slate-500">Detecto los encabezados y el tipo de cada columna automáticamente.</p>
          </div>
          <div onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
            className="card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 p-12 transition hover:border-nex-400">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-nex-100 text-3xl">📄</div>
            {loading ? <p className="font-medium text-nex-700">Leyendo…</p> : <>
              <p className="font-semibold text-slate-700">Haz clic para seleccionar el archivo</p>
              <p className="text-sm text-slate-400">Formatos: .xlsx, .xls, .csv</p>
            </>}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">⚠️ {error}</div>}
        </div>
      )}

      {/* MAPPING */}
      {step === 'mapping' && workbook && (
        <section className="card p-5">
          <h2 className="text-lg font-bold text-slate-800">Revisa el mapeo de columnas</h2>
          <p className="mb-4 text-sm text-slate-400">Corrige el tipo si la detección automática falló.</p>
          <OtrosMapping workbook={workbook} mapping={config.mapping} onChange={(m) => patch({ mapping: m })} />
          <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={() => go('wizard')}>Continuar →</button></div>
        </section>
      )}

      {/* WIZARD */}
      {step === 'wizard' && workbook && (
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Configura tu informe</h2>
          <OtrosWizard workbook={workbook} config={config} onChange={patch} />
          <div className="mt-6 flex justify-end"><button className="btn-primary" onClick={toValidation}>Validar y continuar →</button></div>
        </section>
      )}

      {/* VALIDATION */}
      {step === 'validation' && workbook && result && (
        <section className="card p-5">
          <h2 className="text-lg font-bold text-slate-800">Validación antes de analizar</h2>
          <p className="mb-4 text-sm text-slate-400">Revisa columnas, tipo, fórmula y filtros. Corrige si hace falta.</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Columnas detectadas y tipo</p>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <tbody>{mappingSummary.map(({ h, t }) => (<tr key={h} className="border-b border-slate-50 last:border-0"><td className="py-1.5 px-3 text-slate-600">{h}</td><td className="py-1.5 px-3 text-right text-slate-400">{t}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-slate-700">Tipo:</span> {typeLabel(config.reportType)}</p>
              <p><span className="font-semibold text-slate-700">Fórmula:</span> <span className="text-slate-500">{result.formula}</span></p>
              <p><span className="font-semibold text-slate-700">Meta/referencia:</span> {config.goal === null ? 'sin meta' : config.goal}</p>
              <p><span className="font-semibold text-slate-700">N/A:</span> {config.naMode === 'excluir' ? 'excluir del denominador' : 'contar como No cumple'}</p>
              {(config.inclusion || config.exclusion) && <p><span className="font-semibold text-slate-700">Filtros:</span> {[config.inclusion && `incluye: ${config.inclusion}`, config.exclusion && `excluye: ${config.exclusion}`].filter(Boolean).join(' · ')}</p>}
              {config.breakdowns.length > 0 && <p><span className="font-semibold text-slate-700">Desgloses:</span> {config.breakdowns.join(', ')}</p>}
            </div>
          </div>

          {result.warnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">⚠️ Advertencias</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">✓ Sin advertencias: la configuración está lista.</p>
          )}

          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button className="btn-ghost" onClick={() => go('wizard')}>← Ajustar configuración</button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={persist}>{saved ? '✓ Guardada' : '💾 Guardar plantilla'}</button>
              <button className="btn-primary" onClick={generate}>Generar informe →</button>
            </div>
          </div>
        </section>
      )}

      {/* RESULT */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <OtrosResultView result={result} />
          <div className="flex flex-wrap justify-between gap-2">
            <button className="btn-ghost" onClick={() => go('wizard')}>← Editar configuración</button>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={persist}>{saved ? '✓ Guardada' : '💾 Guardar como plantilla'}</button>
              <button className="btn-ghost" onClick={startNew}>Nuevo informe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
