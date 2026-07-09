import type { AnalysisResult } from '../../../types';
import ChartCard from './ChartCard';
import ComplianceBarChart from './ComplianceBarChart';
import DistributionDonut from './DistributionDonut';
import TrafficLightCard from './TrafficLightCard';

/** Sección visual del reporte: semáforo, distribución y gráficos de cumplimiento. */
export default function VisualDashboard({ a }: { a: AnalysisResult }) {
  const goal = a.config.goal;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Semáforo de cumplimiento" icon="🚦">
          <TrafficLightCard a={a} />
        </ChartCard>
        <ChartCard title="Distribución de resultados" icon="🍩" subtitle="Cumple · No cumple · No aplica">
          <DistributionDonut global={a.global} />
        </ChartCard>
      </div>

      {a.complianceByIndicator.length > 0 && (
        <ChartCard title="Cumplimiento por indicador" icon="📊" subtitle={`Barras coloreadas según la meta de ${goal}%`}>
          <ComplianceBarChart groups={a.complianceByIndicator} goal={goal} orientation="horizontal" />
        </ChartCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {a.complianceByUnit.length > 0 && (
          <ChartCard title="Cumplimiento por unidad" icon="🏥">
            <ComplianceBarChart groups={a.complianceByUnit} goal={goal} orientation="horizontal" />
          </ChartCard>
        )}
        {a.complianceByShift.length > 0 && (
          <ChartCard title="Cumplimiento por turno" icon="🕐">
            <ComplianceBarChart groups={a.complianceByShift} goal={goal} orientation="vertical" />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
