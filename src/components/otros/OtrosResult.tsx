import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PALETTE } from '../../utils/palette';
import type { OtrosResult, OtrosTable } from '../../utils/otros/types';

interface Props {
  result: OtrosResult;
}

function Table({ title, table }: { title: string; table: OtrosTable }) {
  if (table.rows.length === 0) return null;
  return (
    <section className="card p-5">
      <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">{table.headers.map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr></thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">{row.map((c, j) => <td key={j} className={`py-2 pr-3 ${j === 0 ? 'font-medium text-slate-700' : 'text-slate-600'}`}>{String(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function OtrosResult({ result }: Props) {
  const [recs, setRecs] = useState<string[]>(result.recommendations);
  const [busy, setBusy] = useState<null | 'pdf' | 'word'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tone = (t?: string) => (t === 'alert' ? 'text-red-600' : t === 'ok' ? 'text-green-600' : 'text-slate-800');
  const goal = result.config.goal;
  const chartData = useMemo(() => result.temporal.map((p) => ({ label: p.label, value: p.value })), [result.temporal]);

  const doExport = async (kind: 'pdf' | 'word') => {
    setBusy(kind); setNotice(null);
    try {
      const mod = await import('../../utils/otros/export');
      if (kind === 'pdf') mod.exportOtrosPdf(result, recs);
      else await mod.exportOtrosWord(result, recs);
    } catch { setNotice(`No se pudo generar el ${kind === 'pdf' ? 'PDF' : 'Word'}.`); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-lg font-black text-slate-800">{result.config.name || 'Informe'}</h2>
        {result.config.objective && <p className="mt-0.5 text-sm text-slate-500">{result.config.objective}</p>}
        <p className="mt-1 text-xs text-slate-400">🧮 {result.formula}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {result.kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className={`text-2xl font-black ${tone(k.tone)}`}>{k.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{k.label}</p>
              {k.hint && <p className="text-[11px] text-slate-400">{k.hint}</p>}
            </div>
          ))}
        </div>
      </section>

      {result.mainTable && <Table title="Resultado principal" table={result.mainTable} />}

      {chartData.length > 1 && (
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-800">📈 Evolución temporal</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.gray} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={{ stroke: PALETTE.gray }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: PALETTE.muted }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              {goal !== null && <ReferenceLine y={goal} stroke={PALETTE.blue} strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="value" stroke={PALETTE.blue} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {result.comparison && result.comparison !== result.mainTable && <Table title="Comparación entre grupos" table={result.comparison} />}
      {result.breakdowns.map((b) => <Table key={b.label} title={`Desglose por ${b.label}`} table={b.table} />)}
      {result.descriptive.length > 0 && <Table title="Caracterización" table={{ headers: ['Variable', 'Positivos', 'Respondidos', 'Prevalencia'], rows: result.descriptive.map((d) => [d.label, d.positive, d.answered, `${d.percent}%`]) }} />}

      {(result.findings.length > 0 || result.gaps.length > 0 || result.alerts.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {result.findings.length > 0 && (
            <section className="card p-5"><h3 className="mb-2 text-sm font-bold text-slate-800">🔎 Hallazgos principales</h3><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{result.findings.map((f, i) => <li key={i}>{f}</li>)}</ul></section>
          )}
          {(result.gaps.length > 0 || result.alerts.length > 0) && (
            <section className="card p-5"><h3 className="mb-2 text-sm font-bold text-slate-800">⚠️ Brechas y alertas</h3><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{[...result.alerts, ...result.gaps].map((f, i) => <li key={i} className="text-red-600">{f}</li>)}</ul></section>
          )}
        </div>
      )}

      {/* Resumen ejecutivo + recomendaciones editables + export */}
      <section className="card overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-bold text-slate-800">📝 Resumen ejecutivo</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => doExport('pdf')} disabled={busy !== null}>{busy === 'pdf' ? 'Generando…' : '📕 Descargar PDF'}</button>
            <button className="btn-ghost" onClick={() => doExport('word')} disabled={busy !== null}>{busy === 'word' ? 'Generando…' : '📘 Descargar Word'}</button>
          </div>
        </header>
        {notice && <div className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-sm text-amber-800">⚠️ {notice}</div>}
        <div className="space-y-4 p-5">
          <div className="space-y-2 text-sm leading-relaxed text-slate-600">{result.summary.map((s, i) => <p key={i}>{s}</p>)}</div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Recomendaciones (editables)</p>
            <div className="space-y-2">
              {recs.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <textarea value={r} onChange={(e) => setRecs(recs.map((x, j) => (j === i ? e.target.value : x)))} rows={2}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200" />
                  <button className="mt-1 text-xs font-semibold text-slate-400 hover:text-red-600" onClick={() => setRecs(recs.filter((_, j) => j !== i))}>Quitar</button>
                </div>
              ))}
              <button className="text-sm font-semibold text-nex-700 hover:underline" onClick={() => setRecs([...recs, ''])}>+ Añadir recomendación</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
