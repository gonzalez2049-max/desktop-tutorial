import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { PALETTE } from '../../utils/palette';
import {
  analyzeModules,
  complianceEvolution,
  complianceGaps,
  criticalAlerts,
  institutionalExecutive,
  institutionalSummary,
  periodOptions,
  practiceModules,
  rateEvolution,
  unitMatrix,
  unitOptions,
  vigilanciaModules,
  type DashModule,
  type RawModule,
} from '../../utils/consolidatedDashboard';

interface Props {
  raw: RawModule[];
  onReset: () => void;
  onEditUploads: () => void;
}

const SERIES_COLORS = ['#1E3A8A', '#EF4444', '#0f766e', '#F59E0B', '#7c3aed', '#0891b2', '#be185d'];
const ALL = '__ALL__';
const fmt = (n: number | null, dec = false) => (n === null ? 's/d' : dec ? String(n).replace('.', ',') : String(n));

/** Mini-tendencia sin ejes (evolución compacta dentro de una tarjeta). */
function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <div className="h-8" />;
  const w = 150, h = 32, pad = 3;
  const mn = Math.min(...pts), mx = Math.max(...pts);
  const X = (i: number) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
  const Y = (v: number) => h - pad - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (h - 2 * pad);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${X(pts.length - 1).toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;
  const last = [X(pts.length - 1), Y(pts[pts.length - 1])];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} style={{ fill: color, opacity: 0.1 }} />
      <path d={line} style={{ fill: 'none', stroke: color }} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={2.6} style={{ fill: color }} />
    </svg>
  );
}

function KpiTile({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone: 'crit' | 'warn' | 'good' | 'neutral' }) {
  const valColor = tone === 'crit' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-green-600' : 'text-slate-800';
  const stripe = tone === 'crit' ? 'bg-red-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'good' ? 'bg-green-500' : 'bg-nex-500';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 ${stripe}`} />
      <p className={`text-2xl font-black leading-none ${valColor}`}>{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

const pill = (tone: 'crit' | 'warn' | 'good', text: string) => {
  const cls = tone === 'crit' ? 'bg-red-100 text-red-700' : tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{text}</span>;
};

function VigilanciaCard({ m }: { m: DashModule }) {
  const s = m.analysis.surveillance!;
  const tone = s.exceedsReference ? 'crit' : s.reference !== null ? 'good' : 'warn';
  const rateColor = s.exceedsReference ? '#EF4444' : s.reference !== null ? '#16a34a' : '#0f766e';
  const label = s.exceedsReference ? '⚠ Sobre ref.' : s.reference !== null ? '✓ En ref.' : s.referenceMode === 'per_unit' ? 'Por unidad' : 's/ref';
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{m.name}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vigilancia · {s.numeratorLabel}</p>
        </div>
        {pill(tone, label)}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-black leading-none" style={{ color: rateColor }}>{fmt(s.overallRate, true)}</span>
        <span className="text-[11px] font-semibold text-slate-400">{s.unitLabel}</span>
      </div>
      <div className="flex justify-between text-[11.5px] text-slate-500">
        <span>{s.reference !== null ? <>Referencia <b className="text-slate-700">{fmt(s.reference, true)}</b></> : <>Ref. por {s.referenceLabel.toLowerCase()}</>}</span>
        <span>Casos <b className="text-slate-700">{s.totalCases}</b> · Días <b className="text-slate-700">{s.totalDeviceDays}</b></span>
      </div>
      <Sparkline values={s.byPeriod.map((p) => p.rate)} color={rateColor} />
    </div>
  );
}

function PracticeCard({ m }: { m: DashModule }) {
  const g = m.analysis.global;
  const has = g.aplicables > 0;
  const tone = !has ? 'warn' : g.meetsGoal ? 'good' : 'warn';
  const color = !has ? '#0f766e' : g.meetsGoal ? '#16a34a' : '#d97706';
  const gap = has ? Math.round((g.percent - m.goal) * 10) / 10 : null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{m.name}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Práctica · obligatorios</p>
        </div>
        {has ? pill(tone, g.meetsGoal ? '✓ Cumple' : '▼ Bajo meta') : pill('warn', 's/d')}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-black leading-none" style={{ color }}>{has ? `${fmt(g.percent, true)}%` : 's/d'}</span>
        <span className="text-[11px] font-semibold text-slate-400">meta {m.goal}%</span>
      </div>
      <div className="flex justify-between text-[11.5px] text-slate-500">
        <span>Brecha <b className="text-slate-700">{gap === null ? 's/d' : `${gap > 0 ? '+' : ''}${fmt(gap, true)} pp`}</b></span>
        <span>Aplicables <b className="text-slate-700">{g.aplicables}</b></span>
      </div>
      <Sparkline values={m.analysis.temporal.evolution.map((p) => p.percent)} color={color} />
    </div>
  );
}

/** Gráfico de líneas multi-serie (evolución mensual). */
function EvolutionChart({ title, cap, data, yFormat, domain }: { title: string; cap: string; data: ReturnType<typeof rateEvolution>; yFormat: (v: number) => string; domain: [number, number | 'auto'] }) {
  if (data.rows.length === 0 || data.series.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400">Sin datos de período (falta columna de fecha en los archivos).</p>
      </div>
    );
  }
  const refs = Array.from(new Set(data.series.map((s) => s.reference).filter((r): r is number => r !== null)));
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="mb-3 text-[11.5px] text-slate-400">{cap}</p>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data.rows} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gray} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: PALETTE.muted }} axisLine={{ stroke: PALETTE.gray }} tickLine={false} />
          <YAxis domain={domain} tickFormatter={yFormat} tick={{ fontSize: 10, fill: PALETTE.muted }} axisLine={false} tickLine={false} width={38} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${PALETTE.line}` }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {refs.map((r) => (
            <ReferenceLine key={r} y={r} stroke={PALETTE.muted} strokeDasharray="4 3" strokeOpacity={0.6} />
          ))}
          {data.series.map((s, i) => (
            <Line key={s.auditId} type="monotone" dataKey={s.auditId} name={s.name} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const stateColor = (st: string) => (st === 'crit' ? { bg: 'bg-red-50', fg: 'text-red-600' } : st === 'warn' ? { bg: 'bg-amber-50', fg: 'text-amber-600' } : st === 'good' ? { bg: 'bg-green-50', fg: 'text-green-600' } : { bg: '', fg: 'text-slate-300' });

export default function ConsolidatedDashboard({ raw, onReset, onEditUploads }: Props) {
  const [unit, setUnit] = useState<string>(ALL);
  const [period, setPeriod] = useState<string>(ALL);
  const [busy, setBusy] = useState<null | 'pdf' | 'word'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const units = useMemo(() => unitOptions(raw), [raw]);
  const periods = useMemo(() => periodOptions(raw), [raw]);
  const filters = useMemo(() => ({ unit: unit === ALL ? null : unit, period: period === ALL ? null : period }), [unit, period]);
  const mods = useMemo(() => analyzeModules(raw, filters), [raw, filters]);

  const summary = useMemo(() => institutionalSummary(mods), [mods]);
  const alerts = useMemo(() => criticalAlerts(mods), [mods]);
  const gaps = useMemo(() => complianceGaps(mods), [mods]);
  const matrix = useMemo(() => unitMatrix(mods), [mods]);
  const rateEvo = useMemo(() => rateEvolution(mods), [mods]);
  const compEvo = useMemo(() => complianceEvolution(mods), [mods]);
  const exec = useMemo(() => institutionalExecutive(mods), [mods]);

  const vig = vigilanciaModules(mods);
  const prac = practiceModules(mods);

  const handleExport = async (kind: 'pdf' | 'word') => {
    setBusy(kind);
    setNotice(null);
    try {
      const mod = await import('../../utils/consolidatedExport');
      if (kind === 'pdf') mod.exportConsolidatedPdf(mods, exec, summary);
      else await mod.exportConsolidatedWord(mods, exec, summary);
    } catch {
      setNotice(`No se pudo generar el ${kind === 'pdf' ? 'PDF' : 'documento Word'}. Inténtalo nuevamente.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado + filtros */}
      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">🧫 Dashboard Consolidado IAAS</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {summary.integrated} de {summary.total} auditorías integradas · {summary.vigilancias} vigilancias · {summary.practicas} prácticas. Lee los resultados de cada módulo; no recalcula fórmulas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="dash-period" className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Período</label>
              <select id="dash-period" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200">
                <option value={ALL}>Todos los períodos</option>
                {periods.map((p) => (<option key={p.key} value={p.key}>{p.label}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dash-unit" className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Unidad</label>
              <select id="dash-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200">
                <option value={ALL}>Todas las unidades</option>
                {units.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* KPIs institucionales */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile tone="neutral" value={`${summary.integrated}/${summary.total}`} label="Auditorías integradas" sub={`${summary.vigilancias} vigilancias · ${summary.practicas} prácticas`} />
          <KpiTile tone={summary.criticalAlerts > 0 ? 'crit' : 'good'} value={String(summary.criticalAlerts)} label="Alertas críticas" sub="tasas sobre referencia" />
          <KpiTile tone={summary.bundlesUnderGoal > 0 ? 'warn' : 'good'} value={String(summary.bundlesUnderGoal)} label="Prácticas bajo meta" sub="cumplimiento < meta" />
          <KpiTile tone={summary.practiceCompliance === null ? 'neutral' : summary.practiceCompliance >= 90 ? 'good' : 'warn'} value={summary.practiceCompliance === null ? 's/d' : `${fmt(summary.practiceCompliance, true)}%`} label="Cumplimiento de prácticas" sub="prom. ponderado (obligatorios)" />
          <KpiTile tone={summary.unitsInAlert > 0 ? 'warn' : 'good'} value={String(summary.unitsInAlert)} label="Unidades en alerta" sub="≥1 tasa/indicador crítico" />
        </div>
      </section>

      {/* Vigilancia */}
      {vig.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Vigilancia epidemiológica · tasas por 1.000 días</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vig.map((m) => (<VigilanciaCard key={m.auditId} m={m} />))}
          </div>
        </section>
      )}

      {/* Prácticas */}
      {prac.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Prácticas clínicas · cumplimiento oficial (obligatorios)</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {prac.map((m) => (<PracticeCard key={m.auditId} m={m} />))}
          </div>
        </section>
      )}

      {/* Evolución mensual */}
      <section>
        <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Evolución mensual</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <EvolutionChart title="Tasas de vigilancia" cap="Casos / días de exposición × 1.000. Línea punteada = referencia." data={rateEvo} yFormat={(v) => String(v)} domain={[0, 'auto']} />
          <EvolutionChart title="Cumplimiento de prácticas" cap="Cumplimiento oficial (obligatorios). Línea punteada = meta." data={compEvo} yFormat={(v) => `${v}%`} domain={[0, 100]} />
        </div>
      </section>

      {/* Comparación entre unidades */}
      {matrix.rows.length > 0 && (
        <section className="card p-5">
          <h3 className="text-sm font-bold text-slate-800">Comparación entre unidades</h3>
          <p className="mb-3 text-[11.5px] text-slate-400">Cada celda muestra el resultado ya calculado por el módulo. Rojo = sobre referencia; ámbar = bajo meta.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Unidad</th>
                  {matrix.columns.map((c) => (<th key={c.id} className="py-2 pr-3 text-right">{c.name}</th>))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.unit} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-700">{row.unit}</td>
                    {matrix.columns.map((c) => {
                      const cell = row.cells[c.id];
                      const col = stateColor(cell.state);
                      return (
                        <td key={c.id} className="py-2 pr-3 text-right">
                          <span className={`inline-block min-w-[42px] rounded-md px-2 py-0.5 font-bold ${col.bg} ${col.fg}`}>
                            {cell.value === null ? 's/d' : c.mode === 'practicas' ? `${fmt(cell.value, true)}%` : fmt(cell.value, true)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-green-500" /> En referencia / cumple</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Bajo meta</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Sobre referencia</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Sin datos</span>
          </div>
        </section>
      )}

      {/* Alertas + brechas */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="text-sm font-bold text-slate-800">Alertas críticas</h3>
          <p className="mb-3 text-[11.5px] text-slate-400">Ordenadas por severidad. Provienen de los estados que marca cada módulo.</p>
          {alerts.length === 0 ? (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">✓ Sin alertas: todas las tasas y prácticas están dentro de sus referencias y metas.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${a.severity === 'crit' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.severity === 'crit' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-[12.5px] font-semibold text-slate-700">{a.title}</p>
                    <p className="text-[11px] text-slate-400">{a.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-bold text-slate-800">Brechas de cumplimiento</h3>
          <p className="mb-3 text-[11.5px] text-slate-400">Distancia de cada práctica frente a su meta (obligatorios).</p>
          {gaps.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400">Sin auditorías de prácticas cargadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Práctica</th>
                    <th className="py-2 pr-3 text-right">Actual</th>
                    <th className="py-2 pr-3 text-right">Meta</th>
                    <th className="py-2 pr-3 text-right">Brecha</th>
                    <th className="py-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.auditId} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-700">{g.name}</td>
                      <td className="py-2 pr-3 text-right text-slate-600">{g.actual === null ? 's/d' : `${fmt(g.actual, true)}%`}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{g.goal}%</td>
                      <td className={`py-2 pr-3 text-right font-bold ${g.gap === null ? 'text-slate-400' : g.gap >= 0 ? 'text-green-600' : 'text-amber-600'}`}>{g.gap === null ? 's/d' : `${g.gap > 0 ? '+' : ''}${fmt(g.gap, true)} pp`}</td>
                      <td className="py-2 text-right">
                        {g.actual === null ? <span className="text-slate-400">s/d</span> : g.meets ? <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Cumple</span> : <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Bajo meta</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Resumen ejecutivo institucional */}
      <section className="card overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">📝 {exec.title}</h3>
            <p className="mt-0.5 text-xs text-slate-400">Generado el {exec.generatedAt}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => handleExport('pdf')} disabled={busy !== null}>{busy === 'pdf' ? 'Generando…' : '📕 Descargar PDF'}</button>
            <button className="btn-ghost" onClick={() => handleExport('word')} disabled={busy !== null}>{busy === 'word' ? 'Generando…' : '📘 Descargar Word'}</button>
          </div>
        </header>
        {notice && <div className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-sm text-amber-800">⚠️ {notice}</div>}
        <div className="space-y-3 p-5 text-sm leading-relaxed text-slate-600">
          <p className="italic text-slate-500">{exec.lead}</p>
          <p><strong className="text-slate-700">Vigilancia.</strong> {exec.vigilanciaText}</p>
          <p><strong className="text-slate-700">Prácticas.</strong> {exec.practicasText}</p>
          <div>
            <p className="font-semibold text-slate-700">Recomendaciones priorizadas:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {exec.recommendations.map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn-ghost" onClick={onEditUploads}>← Editar archivos</button>
        <button className="btn-ghost" onClick={onReset}>Empezar de nuevo</button>
      </div>
    </div>
  );
}
