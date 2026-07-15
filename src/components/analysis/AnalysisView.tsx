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
import LppCharacterization from './LppCharacterization';
import PeriodComparison from './PeriodComparison';
import TrafficLightCard from './charts/TrafficLightCard';
import SignatureBlock from './SignatureBlock';
import AuditorPanel from './AuditorPanel';
import { analysisTypeLabel, showsEvolution } from '../../config/options';
import { trafficLabel, trafficLightFor } from '../../utils/palette';
import { resolveProgramConfig } from '../../utils/programConfig';
import { isAdminMode } from '../../utils/admin';

// Recharts se carga solo al llegar a los resultados, no en la pantalla inicial.
const VisualDashboard = lazy(() => import('./charts/VisualDashboard'));
const EvolutionSection = lazy(() => import('./EvolutionSection'));

interface AnalysisViewProps {
  workbook: ParsedWorkbook;
  config: ReportConfig;
  fileName: string;
  onReset: () => void;
  /** Volver al asistente para modificar la configuración sin perder los datos. */
  onEdit?: () => void;
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
export default function AnalysisView({ workbook, config, fileName, onReset, onEdit }: AnalysisViewProps) {
  const [selectedUnit, setSelectedUnit] = useState<string>(ALL_UNITS);
  const units = useMemo(() => listUnits(workbook), [workbook]);

  // Workbook activo: todas las unidades o solo la unidad elegida.
  const activeWorkbook = useMemo(
    () => (selectedUnit === ALL_UNITS ? workbook : filterWorkbookByUnit(workbook, selectedUnit)),
    [workbook, selectedUnit],
  );

  // Al elegir una unidad se recalcula todo el análisis solo para esa unidad.
  const a = useMemo(() => analyze(activeWorkbook, config), [activeWorkbook, config]);

  // Matriz global (todas las unidades) para el desglose por turno de cada unidad.
  const matrix = useMemo(() => unitShiftMatrix(workbook, config), [workbook, config]);
  const allUnits = selectedUnit === ALL_UNITS;
  const admin = useMemo(() => isAdminMode(), []);

  const isNT234 = config.reportType === 'NT234_LPP';
  const program = useMemo(() => resolveProgramConfig(config), [config]);
  const audit = program.audits?.find((x) => x.id === config.auditId);
  const auditName = audit?.name;
  // Modo vigilancia epidemiológica: tasas por numerador/denominador (no aplica
  // automáticamente la fórmula de cumplimiento de prácticas).
  const vigilancia = audit?.mode === 'vigilancia';
  // Un programa con filtro de riesgo requiere columna de riesgo para calcular el cumplimiento.
  const nt234NeedsRisk = program.riskFilter && !a.characterization.riskColumnDetected;

  // Análisis temporal: solo comparación (comparacion) o evolución
  // (trimestral/semestral/anual). El informe mensual no muestra ninguna.
  let temporalSection: ReactNode = null;
  if (config.analysisType === 'comparacion') {
    temporalSection =
      a.temporal.hasDate && a.temporal.periods.length >= 2 ? (
        <PeriodComparison workbook={activeWorkbook} config={config} periods={a.temporal.periods} />
      ) : (
        <div className="card p-5 text-sm text-slate-500">
          ⚖️ Comparación entre períodos: se necesitan al menos dos períodos con columna de fecha. No se encontraron suficientes datos temporales.
        </div>
      );
  } else if (showsEvolution(config.analysisType)) {
    temporalSection =
      a.temporal.hasDate && a.temporal.evolution.length > 0 ? (
        <Suspense fallback={<div className="card p-8 text-center text-sm text-slate-400">Cargando evolución…</div>}>
          <EvolutionSection points={a.temporal.evolution} goal={config.goal} analysisTypeLabelText={analysisTypeLabel(config.analysisType)} />
        </Suspense>
      ) : (
        <div className="card p-5 text-sm text-slate-500">
          📈 {analysisTypeLabel(config.analysisType)}: no se detectó una columna de fecha utilizable, por lo que no es posible mostrar la evolución temporal.
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span>{program.logo}</span> {program.institutionName} · {program.unitName}
          </p>
          <h2 className="text-2xl font-bold text-slate-800">Análisis del reporte</h2>
          <p className="mt-1 text-sm text-slate-500">
            {program.programName || reportTypeLabel(config.reportType)}
            {auditName ? ` · ${auditName}` : ''} · <span className="text-slate-400">{fileName}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {config.highlights.map((h) => (
              <span key={h} className="rounded-full bg-nex-50 px-2.5 py-0.5 text-xs font-semibold text-nex-700">
                {highlightLabel(h)}
              </span>
            ))}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Meta {config.goal}%</span>
          </div>
          {audit?.formula && !vigilancia && <p className="mt-2 text-xs text-slate-400">🧮 Fórmula: {audit.formula}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {onEdit && (
            <button className="btn-ghost" onClick={onEdit}>
              ← Atrás
            </button>
          )}
          <button className="btn-ghost" onClick={onReset}>
            ↺ Nuevo reporte
          </button>
        </div>
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

      {/* 1) Caracterización clínica (KPI clínicos primero, solo NT 234 / LPP). */}
      {isNT234 && <CharacterizationSection c={a.characterization} />}
      {isNT234 && <LppCharacterization c={a.characterization} />}

      {/* NT 234 sin columna de riesgo: no se calcula el cumplimiento. */}
      {nt234NeedsRisk && (
        <div className="card border-amber-200 bg-amber-50 p-5">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-800">⚠️ Cumplimiento NT 234 no calculado</h3>
          <p className="mt-1 text-sm text-amber-800">
            No se ha seleccionado la columna de riesgo, por lo que el cumplimiento NT 234 no puede calcularse. Vuelve a{' '}
            <strong>Revisar columnas</strong> y marca la columna de riesgo (p. ej. «Riesgo», «Nivel de riesgo», «Braden»)
            para habilitar el análisis.
          </p>
          <button className="btn-ghost mt-3" onClick={onReset}>
            ↺ Volver a empezar
          </button>
        </div>
      )}

      {/* Layout ordenado y sin duplicidad para NT 234 / LPP. */}
      {!nt234NeedsRisk && isNT234 && (
        <>
          {/* 2) Semáforo de cumplimiento (global · meta · estado). */}
          <Section
            title="Semáforo de cumplimiento"
            icon="🚦"
            subtitle={`Cumplimiento global ${a.global.percent}% · Meta ${config.goal}% · ${trafficLabel(trafficLightFor(a.global.percent, config.goal))}`}
          >
            <TrafficLightCard a={a} colors={program.traffic} />
          </Section>

          {temporalSection}

          {/* 3) Cumplimiento por indicador. */}
          {a.complianceByIndicator.length > 0 && (
            <Section title="Cumplimiento por indicador" icon="📊" subtitle="Cumple / no cumple y % por indicador">
              <ComplianceTable groups={a.complianceByIndicator} firstHeader="Indicador" goal={config.goal} />
            </Section>
          )}

          {/* 4) Cumplimiento por turno. */}
          {a.complianceByShift.length > 0 && (
            <Section title="Cumplimiento por turno" icon="🕐" subtitle={allUnits ? 'Global (todas las unidades)' : `Unidad ${selectedUnit}`}>
              <ComplianceTable groups={a.complianceByShift} firstHeader="Turno" goal={config.goal} />
            </Section>
          )}

          {/* 5-6) Indicadores críticos y destacados. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Indicadores críticos" icon="🔴" subtitle={`Bajo la meta de ${config.goal}%`}>
              <IndicatorList items={a.criticalIndicators} emptyText="Ningún indicador bajo la meta. 🎉" tone="red" />
            </Section>
            <Section title="Indicadores destacados" icon="🟢" subtitle={`En o sobre la meta de ${config.goal}%`}>
              <IndicatorList items={a.highlightedIndicators} emptyText="Ningún indicador alcanza la meta todavía." tone="green" />
            </Section>
          </div>

          {/* 7) Total por turno. */}
          {a.totalByShift.length > 0 && (
            <Section title="Total por turno" icon="🕐" subtitle="Registros auditados por turno">
              <CountTable groups={a.totalByShift} firstHeader="Turno" total={a.totalRecords} />
            </Section>
          )}

          {/* 8) Resumen ejecutivo completo + botones (Copiar / PDF / Word). */}
          <ExecutiveSummary analysis={a} fileName={fileName} onEdit={onEdit} />

          {admin && <AuditorPanel a={a} />}
        </>
      )}

      {/* Modo vigilancia epidemiológica (IAAS): plantilla de tasas, sin aplicar
          la fórmula de cumplimiento de prácticas. */}
      {vigilancia && (
        <section className="card p-5">
          <header className="mb-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🧫 Vigilancia epidemiológica</h3>
            <p className="mt-0.5 text-sm text-slate-400">
              {auditName}: esta auditoría se analiza como <strong>tasas epidemiológicas</strong> (numerador / denominador),
              no como cumplimiento de prácticas.
            </p>
          </header>
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            🧩 Plantilla en configuración. El cálculo de tasas (numerador, denominador, factor y referencia) se definirá para
            esta auditoría. No se aplica la fórmula de cumplimiento.
          </p>
          {audit && audit.rates.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Tasa</th>
                    <th className="py-2 pr-3">Numerador</th>
                    <th className="py-2 pr-3">Denominador</th>
                    <th className="py-2 text-right">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rates.map((r) => (
                    <tr key={r.name} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-700">{r.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.numerator}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.denominator} · ×{r.factor} {r.unit}</td>
                      <td className="py-2 text-right text-slate-600">{r.reference ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Aún no se han configurado tasas para esta auditoría.</p>
          )}
          <p className="mt-3 text-xs text-slate-400">Registros leídos del archivo: {a.totalRecords}.</p>
        </section>
      )}

      {/* Layout genérico para el resto de programas / auditorías de prácticas. */}
      {!nt234NeedsRisk && !isNT234 && !vigilancia && (
        <>
          <KpiCards a={a} />

          {temporalSection}

          {a.complianceByIndicator.length > 0 && (
            (() => {
              const mand = a.complianceByIndicator.filter((g) => g.kind !== 'complementario');
              const comp = a.complianceByIndicator.filter((g) => g.kind === 'complementario');
              if (comp.length === 0) {
                return (
                  <Section title="Cumplimiento por indicador" icon="📊" subtitle="Cumple / no cumple y % por indicador">
                    <ComplianceTable groups={a.complianceByIndicator} firstHeader="Indicador" goal={config.goal} />
                  </Section>
                );
              }
              return (
                <Section
                  title="Cumplimiento por indicador"
                  icon="📊"
                  subtitle="Obligatorios (cumplimiento oficial) y complementarios (informativos, no alteran el oficial)"
                >
                  <div className="space-y-5">
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Obligatorios · {mand.length} · cumplimiento oficial
                      </p>
                      <ComplianceTable groups={mand} firstHeader="Indicador obligatorio" goal={config.goal} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Complementarios · {comp.length} · no cuentan para el cumplimiento oficial
                      </p>
                      <ComplianceTable groups={comp} firstHeader="Indicador complementario" goal={config.goal} />
                    </div>
                  </div>
                </Section>
              );
            })()
          )}

          {a.complianceByShift.length > 0 && (
            <Section title="Cumplimiento por turno" icon="🕐" subtitle={allUnits ? 'Global (todas las unidades)' : `Unidad ${selectedUnit}`}>
              <ComplianceTable groups={a.complianceByShift} firstHeader="Turno" goal={config.goal} />
            </Section>
          )}

          {allUnits && a.complianceByUnit.length > 0 && (
            <Section title="Cumplimiento por unidad" icon="🏥">
              <ComplianceTable groups={a.complianceByUnit} firstHeader="Unidad" goal={config.goal} />
            </Section>
          )}

          {/* Desgloses configurados por la auditoría (p. ej. estamento, tipo de higiene). */}
          {a.complianceByBreakdown.map((bd) => (
            <Section key={bd.key} title={`Cumplimiento por ${bd.label.toLowerCase()}`} icon="🧑‍⚕️" subtitle="Cumple / no cumple y % por categoría">
              <ComplianceTable groups={bd.groups} firstHeader={bd.label} goal={config.goal} />
            </Section>
          ))}

          <Suspense fallback={<div className="card p-8 text-center text-sm text-slate-400">Cargando gráficos…</div>}>
            <VisualDashboard a={a} />
          </Suspense>

          {allUnits && matrix.rows.length > 0 && (
            <Section title="Cumplimiento por turno y unidad" icon="🗂️" subtitle="% por turno dentro de cada unidad">
              <UnitShiftMatrixTable matrix={matrix} goal={config.goal} />
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

          <DescriptiveVariables variables={a.descriptiveVariables} totalRecords={a.totalRecords} />

          <ExecutiveSummary analysis={a} fileName={fileName} onEdit={onEdit} />

          {admin && <AuditorPanel a={a} />}
        </>
      )}

      {/* Firma y timbre al final del informe (no en la plantilla de vigilancia). */}
      {!nt234NeedsRisk && !vigilancia && <SignatureBlock />}
    </div>
  );
}
