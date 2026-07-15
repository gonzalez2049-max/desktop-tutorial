import { useMemo, useState } from 'react';
import {
  DEFAULT_REPORT_TEMPLATE,
  type AuditMode,
  type AuditReportTemplate,
  type AutoRecommendation,
  type AuditVariant,
  type RecommendationTrigger,
  type SurveillanceRate,
} from '../config/programs';

interface AuditBuilderProps {
  /** Auditoría inicial (plantilla vacía para «nueva» o auditoría existente). */
  initial: AuditVariant;
  /** ¿Se está creando una auditoría nueva? (afecta a la generación del id). */
  isNew: boolean;
  /** Ids ya usados en el programa (para garantizar unicidad al crear). */
  existingIds: string[];
  onSave: (audit: AuditVariant) => void;
  onCancel: () => void;
}

/** Lista <-> texto (una línea por elemento). */
const toLines = (arr: string[]) => arr.join('\n');
const fromLines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '');

/** Slug estable a partir del nombre (sin acentos, minúsculas, guiones bajos). */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Id único dentro del programa. */
function uniqueId(base: string, taken: string[]): string {
  const seed = base || `auditoria_${Date.now()}`;
  let id = seed;
  let n = 2;
  while (taken.includes(id)) id = `${seed}_${n++}`;
  return id;
}

const TRIGGERS: { value: RecommendationTrigger; label: string }[] = [
  { value: 'always', label: 'Siempre' },
  { value: 'below_goal', label: 'Cuando el cumplimiento está bajo la meta' },
  { value: 'at_or_above_goal', label: 'Cuando el cumplimiento alcanza o supera la meta' },
];

const label = 'block text-sm font-semibold text-slate-700';
const input =
  'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200';

/**
 * Asistente de Configuración de Auditorías: permite definir una auditoría
 * completa sin tocar código (nombre, tipo de análisis, meta, indicadores,
 * variables, numerador/denominador, fórmula, filtros, KPIs, gráficos, tablas,
 * resumen ejecutivo, recomendaciones automáticas y plantilla Word/PDF). Cada
 * auditoría queda independiente y se ejecuta sobre el mismo motor de NEX Report.
 */
export default function AuditBuilder({ initial, isNew, existingIds, onSave, onCancel }: AuditBuilderProps) {
  const [form, setForm] = useState<AuditVariant>(() => ({
    ...initial,
    formula: initial.formula ?? '',
    tables: initial.tables ?? [],
    autoRecommendations: initial.autoRecommendations ?? [],
    template: initial.template ? { ...initial.template } : { ...DEFAULT_REPORT_TEMPLATE },
  }));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AuditVariant>(key: K, value: AuditVariant[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const template: AuditReportTemplate = form.template ?? DEFAULT_REPORT_TEMPLATE;
  const setTemplate = <K extends keyof AuditReportTemplate>(key: K, value: AuditReportTemplate[K]) =>
    set('template', { ...template, [key]: value });

  // Indicadores separados por tipo (se recombinan en un solo array al guardar).
  const obligatorios = useMemo(() => form.indicators.filter((i) => i.kind === 'obligatorio').map((i) => i.name), [form.indicators]);
  const complementarios = useMemo(() => form.indicators.filter((i) => i.kind === 'complementario').map((i) => i.name), [form.indicators]);
  const setIndicators = (obl: string[], comp: string[]) =>
    set('indicators', [
      ...obl.map((name) => ({ name, kind: 'obligatorio' as const })),
      ...comp.map((name) => ({ name, kind: 'complementario' as const })),
    ]);

  const rates = form.rates;
  const setRate = (i: number, patch: Partial<SurveillanceRate>) =>
    set('rates', rates.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRate = () => set('rates', [...rates, { name: '', numerator: '', denominator: '', factor: 1000, unit: '', reference: undefined }]);
  const removeRate = (i: number) => set('rates', rates.filter((_, idx) => idx !== i));

  const recs = form.autoRecommendations ?? [];
  const setRec = (i: number, patch: Partial<AutoRecommendation>) =>
    set('autoRecommendations', recs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRec = () => set('autoRecommendations', [...recs, { when: 'below_goal', text: '' }]);
  const removeRec = (i: number) => set('autoRecommendations', recs.filter((_, idx) => idx !== i));

  const isVigilancia = form.mode === 'vigilancia';

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) {
      setError('La auditoría necesita un nombre.');
      return;
    }
    // Id: se conserva al editar; al crear se deriva del nombre y se hace único.
    const id = isNew ? uniqueId(slugify(name), existingIds) : form.id;
    onSave({ ...form, id, name, description: form.description?.trim() || undefined });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🧩 Asistente de Configuración de Auditorías</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isNew ? 'Nueva auditoría' : `Editando: ${initial.name}`} · defina la auditoría sin tocar código. Se ejecutará sobre el
            mismo motor de NEX Report.
          </p>
        </div>
        <button className="btn-ghost shrink-0" onClick={onCancel}>
          ← Cancelar
        </button>
      </div>

      {/* 1 · Identidad y tipo de análisis */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">1 · Identidad y tipo de análisis</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre de la auditoría</label>
            <input className={input} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej.: Higiene de Manos" />
          </div>
          <div>
            <label className={label}>Meta institucional (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              className={input}
              value={form.goal ?? ''}
              onChange={(e) => set('goal', e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder="Ej.: 90"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Descripción (opcional)</label>
            <input className={input} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={label}>Tipo de análisis</label>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: 'practicas', title: 'Auditoría de cumplimiento', desc: 'Cumplimiento = Cumple / (Cumple + No cumple) × 100 (excluye N/A).' },
                { value: 'vigilancia', title: 'Vigilancia epidemiológica', desc: 'Tasas por numerador / denominador. No aplica la fórmula de cumplimiento.' },
              ] as { value: AuditMode; title: string; desc: string }[]
            ).map((opt) => {
              const active = form.mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('mode', opt.value)}
                  className={[
                    'rounded-2xl border p-4 text-left transition',
                    active ? 'border-nex-500 bg-nex-50 ring-2 ring-nex-200' : 'border-slate-200 bg-white hover:border-nex-300',
                  ].join(' ')}
                >
                  <p className="font-bold text-slate-800">{opt.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2 · Indicadores y variables */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">2 · Indicadores y variables</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Indicadores oficiales / obligatorios (uno por línea)</label>
            <textarea
              rows={6}
              className={`${input} font-mono text-xs`}
              value={toLines(obligatorios)}
              onChange={(e) => setIndicators(fromLines(e.target.value), complementarios)}
            />
          </div>
          <div>
            <label className={label}>Indicadores complementarios (uno por línea)</label>
            <textarea
              rows={6}
              className={`${input} font-mono text-xs`}
              value={toLines(complementarios)}
              onChange={(e) => setIndicators(obligatorios, fromLines(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Variables descriptivas (una por línea)</label>
            <textarea
              rows={4}
              className={`${input} font-mono text-xs`}
              value={toLines(form.descriptiveVariables)}
              onChange={(e) => set('descriptiveVariables', fromLines(e.target.value))}
            />
            <p className="mt-1 text-xs text-slate-400">No forman parte del cumplimiento (p. ej. servicio, dispositivo, días de estancia).</p>
          </div>
        </div>
      </section>

      {/* 3 · Cálculo (numerador/denominador y fórmula) */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">3 · Cálculo</h3>
        <div>
          <label className={label}>Fórmula de cálculo</label>
          <textarea
            rows={2}
            className={input}
            value={form.formula ?? ''}
            onChange={(e) => set('formula', e.target.value)}
            placeholder={
              isVigilancia
                ? 'Ej.: (N.º de eventos / días de exposición del dispositivo) × 1000'
                : 'Ej.: Cumple / (Cumple + No cumple) × 100 — excluye N/A'
            }
          />
          <p className="mt-1 text-xs text-slate-400">
            {isVigilancia
              ? 'En vigilancia, defina también las tasas (numerador y denominador) más abajo.'
              : 'En cumplimiento, la fórmula por defecto es Cumple / (Cumple + No cumple) × 100.'}
          </p>
        </div>

        {isVigilancia && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={label}>Tasas (numerador / denominador)</label>
              <button type="button" onClick={addRate} className="text-sm font-semibold text-nex-700 hover:underline">
                + Añadir tasa
              </button>
            </div>
            {rates.length === 0 && <p className="text-sm text-slate-400">Aún no hay tasas. Añada al menos una para la vigilancia.</p>}
            {rates.map((r, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={label}>Nombre de la tasa</label>
                    <input className={input} value={r.name} onChange={(e) => setRate(i, { name: e.target.value })} placeholder="Ej.: Tasa de NAVM" />
                  </div>
                  <div>
                    <label className={label}>Numerador</label>
                    <input className={input} value={r.numerator} onChange={(e) => setRate(i, { numerator: e.target.value })} placeholder="Ej.: N.º de NAVM" />
                  </div>
                  <div>
                    <label className={label}>Denominador</label>
                    <input
                      className={input}
                      value={r.denominator}
                      onChange={(e) => setRate(i, { denominator: e.target.value })}
                      placeholder="Ej.: Días de ventilación mecánica"
                    />
                  </div>
                  <div>
                    <label className={label}>Factor</label>
                    <input type="number" className={input} value={r.factor} onChange={(e) => setRate(i, { factor: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={label}>Unidad</label>
                    <input className={input} value={r.unit} onChange={(e) => setRate(i, { unit: e.target.value })} placeholder="por 1000 días de VM" />
                  </div>
                  <div>
                    <label className={label}>Referencia / meta (opcional)</label>
                    <input
                      type="number"
                      className={input}
                      value={r.reference ?? ''}
                      onChange={(e) => setRate(i, { reference: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <button type="button" onClick={() => removeRate(i)} className="text-xs font-semibold text-red-600 hover:underline">
                    Eliminar tasa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 · Criterios de inclusión y exclusión */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">4 · Criterios de inclusión y exclusión</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Criterios de inclusión (uno por línea)</label>
            <textarea rows={4} className={`${input} font-mono text-xs`} value={toLines(form.inclusion)} onChange={(e) => set('inclusion', fromLines(e.target.value))} />
          </div>
          <div>
            <label className={label}>Criterios de exclusión (uno por línea)</label>
            <textarea rows={4} className={`${input} font-mono text-xs`} value={toLines(form.exclusion)} onChange={(e) => set('exclusion', fromLines(e.target.value))} />
          </div>
        </div>
      </section>

      {/* 5 · KPIs, gráficos y tablas */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">5 · KPIs, gráficos y tablas</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>KPIs (uno por línea)</label>
            <textarea rows={5} className={`${input} font-mono text-xs`} value={toLines(form.kpis)} onChange={(e) => set('kpis', fromLines(e.target.value))} />
          </div>
          <div>
            <label className={label}>Gráficos (uno por línea)</label>
            <textarea rows={5} className={`${input} font-mono text-xs`} value={toLines(form.charts)} onChange={(e) => set('charts', fromLines(e.target.value))} />
          </div>
          <div>
            <label className={label}>Tablas (una por línea)</label>
            <textarea rows={5} className={`${input} font-mono text-xs`} value={toLines(form.tables ?? [])} onChange={(e) => set('tables', fromLines(e.target.value))} />
          </div>
        </div>
      </section>

      {/* 6 · Resumen ejecutivo y recomendaciones automáticas */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">6 · Resumen ejecutivo y recomendaciones</h3>
        <div>
          <label className={label}>Resumen ejecutivo (texto base)</label>
          <textarea rows={3} className={input} value={form.executiveText} onChange={(e) => set('executiveText', e.target.value)} />
          <p className="mt-1 text-xs text-slate-400">Preámbulo propio de esta auditoría que encabeza el resumen del informe.</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={label}>Recomendaciones automáticas</label>
            <button type="button" onClick={addRec} className="text-sm font-semibold text-nex-700 hover:underline">
              + Añadir recomendación
            </button>
          </div>
          {recs.length === 0 && <p className="text-sm text-slate-400">Sin recomendaciones automáticas. Se muestran según el resultado frente a la meta.</p>}
          {recs.map((r, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_2fr]">
                <div>
                  <label className={label}>Condición</label>
                  <select className={input} value={r.when} onChange={(e) => setRec(i, { when: e.target.value as RecommendationTrigger })}>
                    {TRIGGERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Texto de la recomendación</label>
                  <input className={input} value={r.text} onChange={(e) => setRec(i, { text: e.target.value })} />
                </div>
              </div>
              <div className="mt-2 text-right">
                <button type="button" onClick={() => removeRec(i)} className="text-xs font-semibold text-red-600 hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7 · Plantilla Word y PDF */}
      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">7 · Plantilla Word y PDF</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Título del informe (PDF)</label>
            <input className={input} value={template.pdfTitle} onChange={(e) => setTemplate('pdfTitle', e.target.value)} placeholder="Por defecto: nombre de la auditoría" />
          </div>
          <div>
            <label className={label}>Título del informe (Word)</label>
            <input className={input} value={template.wordTitle} onChange={(e) => setTemplate('wordTitle', e.target.value)} placeholder="Por defecto: nombre de la auditoría" />
          </div>
          <div>
            <label className={label}>Nota de encabezado</label>
            <input className={input} value={template.headerNote} onChange={(e) => setTemplate('headerNote', e.target.value)} />
          </div>
          <div>
            <label className={label}>Nota de pie de página</label>
            <input className={input} value={template.footerNote} onChange={(e) => setTemplate('footerNote', e.target.value)} />
          </div>
        </div>
        <div>
          <p className={label}>Secciones a incluir en los exportables</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['includeExecutiveSummary', 'Resumen ejecutivo'],
                ['includeKpis', 'KPIs'],
                ['includeCharts', 'Gráficos'],
                ['includeTables', 'Tablas'],
                ['includeRecommendations', 'Recomendaciones'],
                ['includeSignature', 'Firma y timbre'],
              ] as [keyof AuditReportTemplate, string][]
            ).map(([key, text]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-nex-600"
                  checked={Boolean(template[key])}
                  onChange={(e) => setTemplate(key, e.target.checked as AuditReportTemplate[typeof key])}
                />
                {text}
              </label>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">⚠️ {error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={handleSave}>
          💾 Guardar auditoría
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
