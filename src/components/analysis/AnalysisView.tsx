import { lazy, Suspense, type ReactNode } from 'react';
import type { AnalysisResult, ComplianceGroup } from '../../types';
import { highlightLabel, reportTypeLabel } from '../../config/options';
import KpiCards from './KpiCards';
import ExecutiveSummary from './ExecutiveSummary';
import ComplianceTable from './ComplianceTable';
import CountTable from './CountTable';

// Recharts se carga solo al llegar a los resultados, no en la pantalla inicial.
const VisualDashboard = lazy(() => import('./charts/VisualDashboard'));

interface AnalysisViewProps {
  analysis: AnalysisResult;
  fileName: string;
  onReset: () => void;
}

function Section({ title, icon, subtitle, children }: { title: string; icon?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
          {icon && <span>{icon}</span>}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

/** Lista compacta de indicadores (críticos o destacados). */
function IndicatorList({ items, emptyText, tone }: { items: ComplianceGroup[]; emptyText: string; tone: 'red' | 'green' }) {
  if (items.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-400">{emptyText}</p>;
  }
  const color = tone === 'red' ? 'text-red-600' : 'text-green-600';
  return (
    <ul className="space-y-2">
      {items.map((g) => (
        <li key={g.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{g.label}</span>
          <span className={`text-sm font-bold ${color}`}>{g.percent}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Vista de resultados del motor de análisis: tarjetas KPI y tablas simples. */
export default function AnalysisView({ analysis: a, fileName, onReset }: AnalysisViewProps) {
  const { config } = a;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análisis del reporte</h2>
          <p className="mt-1 text-sm text-slate-500">
            {reportTypeLabel(config.reportType)} · <span className="text-slate-400">{fileName}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {config.highlights.map((h) => (
              <span key={h} className="rounded-full bg-nex-50 px-2.5 py-0.5 text-xs font-semibold text-nex-700">
                {highlightLabel(h)}
              </span>
            ))}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Meta {config.goal}%</span>
          </div>
        </div>
        <button className="btn-ghost shrink-0" onClick={onReset}>
          ↺ Nuevo reporte
        </button>
      </div>

      <KpiCards a={a} />

      <Suspense fallback={<div className="card p-8 text-center text-sm text-slate-400">Cargando gráficos…</div>}>
        <VisualDashboard a={a} />
      </Suspense>

      <ExecutiveSummary analysis={a} fileName={fileName} />

      {a.complianceByIndicator.length > 0 && (
        <Section title="Cumplimiento por indicador" icon="📊" subtitle="Cumple / no cumple / no aplica y % por indicador">
          <ComplianceTable groups={a.complianceByIndicator} firstHeader="Indicador" goal={config.goal} />
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Indicadores críticos" icon="🔴" subtitle={`Bajo la meta de ${config.goal}%`}>
          <IndicatorList items={a.criticalIndicators} emptyText="Ningún indicador bajo la meta. 🎉" tone="red" />
        </Section>
        <Section title="Indicadores destacados" icon="🟢" subtitle={`En o sobre la meta de ${config.goal}%`}>
          <IndicatorList items={a.highlightedIndicators} emptyText="Ningún indicador alcanza la meta todavía." tone="green" />
        </Section>
      </div>

      {a.complianceByShift.length > 0 && (
        <Section title="Cumplimiento por turno" icon="🕐">
          <ComplianceTable groups={a.complianceByShift} firstHeader="Turno" goal={config.goal} />
        </Section>
      )}

      {config.highlights.includes('cumplimiento_unidad') && a.complianceByUnit.length > 0 && (
        <Section title="Cumplimiento por unidad" icon="🏥">
          <ComplianceTable groups={a.complianceByUnit} firstHeader="Unidad" goal={config.goal} />
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {a.totalByUnit.length > 0 && (
          <Section title="Total por unidad" icon="🏥" subtitle="Registros auditados por unidad">
            <CountTable groups={a.totalByUnit} firstHeader="Unidad" total={a.totalRecords} />
          </Section>
        )}
        {a.totalByShift.length > 0 && (
          <Section title="Total por turno" icon="🕐" subtitle="Registros auditados por turno">
            <CountTable groups={a.totalByShift} firstHeader="Turno" total={a.totalRecords} />
          </Section>
        )}
      </div>
    </div>
  );
}
