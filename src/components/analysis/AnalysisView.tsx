import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { ComplianceGroup, ParsedWorkbook, ReportConfig } from '../../types';
import { highlightLabel, reportTypeLabel } from '../../config/options';
import { analyze, filterWorkbookByUnit, listUnits, unitShiftMatrix } from '../../utils/analysis';
import KpiCards from './KpiCards';
import ExecutiveSummary from './ExecutiveSummary';
import ComplianceTable from './ComplianceTable';
import CountTable from './CountTable';
import DescriptiveVariables from './DescriptiveVariables';
import UnitShiftMatrixTable from './UnitShiftMatrixTable';
import CharacterizationSection from './CharacterizationSection';
import AuditorPanel from './AuditorPanel';
import { isAdminMode } from '../../utils/admin';

// Recharts se carga solo al llegar a los resultados, no en la pantalla inicial.
const VisualDashboard = lazy(() => import('./charts/VisualDashboard'));

interface AnalysisViewProps {
  workbook: ParsedWorkbook;
  config: ReportConfig;
  fileName: string;
  onReset: () => void;
}

const ALL_UNITS = '__ALL__';

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

/** Vista de resultados del motor de análisis. */
export default function AnalysisView({ workbook, config, fileName, onReset }: AnalysisViewProps) {
  const [selectedUnit, setSelectedUnit] = useState<string>(ALL_UNITS);
  const units = useMemo(() => listUnits(workbook), [workbook]);

  // Al elegir una unidad se recalcula todo el análisis solo para esa unidad.
  const a = useMemo(
    () => (selectedUnit === ALL_UNITS ? analyze(workbook, config) : analyze(filterWorkbookByUnit(workbook, selectedUnit), config)),
    [workbook, config, selectedUnit],
  );

  // Matriz global (todas las unidades) para el desglose por turno de cada unidad.
  const matrix = useMemo(() => unitShiftMatrix(workbook, config), [workbook, config]);
  const allUnits = selectedUnit === ALL_UNITS;
  const admin = useMemo(() => isAdminMode(), []);

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

      {/* Selector de unidad: filtra todo el dashboard. */}
      {units.length > 0 && (
        <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="unit-filter" className="text-sm font-semibold text-slate-700">
            🏥 Unidad a visualizar
          </label>
          <div className="flex items-center gap-2">
            <select
              id="unit-filter"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
            >
              <option value={ALL_UNITS}>Todas las unidades ({units.length})</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {!allUnits && (
              <button className="btn-ghost !py-2" onClick={() => setSelectedUnit(ALL_UNITS)}>
                Ver todas
              </button>
            )}
          </div>
        </div>
      )}

      {!allUnits && (
        <div className="rounded-xl border border-nex-100 bg-nex-50 px-4 py-2 text-sm text-nex-800">
          Mostrando solo la unidad <strong>{selectedUnit}</strong> · {a.totalRecords} registro(s).
        </div>
      )}

      {config.reportType === 'NT234_LPP' && <CharacterizationSection c={a.characterization} />}

      <KpiCards a={a} />

      <Suspense fallback={<div className="card p-8 text-center text-sm text-slate-400">Cargando gráficos…</div>}>
        <VisualDashboard a={a} />
      </Suspense>

      <DescriptiveVariables variables={a.descriptiveVariables} totalRecords={a.totalRecords} />

      <ExecutiveSummary analysis={a} fileName={fileName} />

      {a.complianceByIndicator.length > 0 && (
        <Section title="Cumplimiento por indicador" icon="📊" subtitle="Cumple / no cumple y % por indicador">
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

      {/* Cumplimiento por turno: global (respeta el filtro de unidad). */}
      {a.complianceByShift.length > 0 && (
        <Section
          title="Cumplimiento por turno"
          icon="🕐"
          subtitle={allUnits ? 'Global (todas las unidades)' : `Unidad ${selectedUnit}`}
        >
          <ComplianceTable groups={a.complianceByShift} firstHeader="Turno" goal={config.goal} />
        </Section>
      )}

      {/* Desglose por turno de cada unidad (solo en la vista global). */}
      {allUnits && matrix.rows.length > 0 && (
        <Section title="Cumplimiento por turno y unidad" icon="🗂️" subtitle="% por turno dentro de cada unidad">
          <UnitShiftMatrixTable matrix={matrix} goal={config.goal} />
        </Section>
      )}

      {allUnits && a.complianceByUnit.length > 0 && (
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

      {admin && <AuditorPanel a={a} />}
    </div>
  );
}
