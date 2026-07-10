import { useState } from 'react';
import QuestionLayout from './QuestionLayout';
import OptionCard from '../OptionCard';
import { ANALYSIS_TYPES, GOAL_PRESETS, HIGHLIGHTS, REPORT_TYPES } from '../../config/options';
import type { AnalysisType, Highlight, ParsedWorkbook, ReportConfig, ReportType } from '../../types';

interface WizardProps {
  workbook: ParsedWorkbook;
  onComplete: (config: ReportConfig) => void;
  onBack: () => void;
}

/** Detecta qué dimensiones existen para deshabilitar highlights no disponibles. */
function availableDimensions(workbook: ParsedWorkbook) {
  const roles = new Set(workbook.columns.map((c) => c.role));
  return {
    unidad: roles.has('unidad'),
    turno: roles.has('turno'),
    indicador: roles.has('indicador') || roles.has('cumplimiento'),
    fecha: roles.has('fecha'),
    riesgo: roles.has('riesgo'),
  };
}

/**
 * Asistente de 4 preguntas: tipo de informe, tipo de análisis temporal, datos a
 * destacar y meta. Primero pregunta; el análisis y la generación vienen después.
 */
export default function Wizard({ workbook, onComplete, onBack }: WizardProps) {
  const [step, setStep] = useState(0);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [goal, setGoal] = useState<number>(90);

  const dims = availableDimensions(workbook);
  const TOTAL = 4;

  const toggleHighlight = (h: Highlight) => {
    setHighlights((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  if (step === 0) {
    return (
      <QuestionLayout
        step={1}
        total={TOTAL}
        title="¿Qué tipo de informe quieres generar?"
        subtitle="Elige el ámbito de la auditoría para adaptar el análisis y las recomendaciones."
        onBack={onBack}
        onNext={() => setStep(1)}
        nextDisabled={!reportType}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_TYPES.map((r) => (
            <OptionCard
              key={r.value}
              label={r.label}
              description={r.description}
              icon={r.icon}
              selected={reportType === r.value}
              onClick={() => setReportType(r.value)}
            />
          ))}
        </div>
      </QuestionLayout>
    );
  }

  if (step === 1) {
    return (
      <QuestionLayout
        step={2}
        total={TOTAL}
        title="¿Qué tipo de análisis desea realizar?"
        subtitle="Segmenta la base por período para ver la evolución del cumplimiento, o compara dos períodos lado a lado."
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
        nextDisabled={!analysisType}
      >
        {!dims.fecha && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ No se detectó una columna de fecha en tu Excel. Puedes continuar, pero la evolución y la comparación por
            período no podrán calcularse hasta que exista una columna de fecha.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {ANALYSIS_TYPES.map((a) => (
            <OptionCard
              key={a.value}
              label={a.label}
              description={a.description}
              icon={a.icon}
              selected={analysisType === a.value}
              onClick={() => setAnalysisType(a.value)}
            />
          ))}
        </div>
      </QuestionLayout>
    );
  }

  if (step === 2) {
    return (
      <QuestionLayout
        step={3}
        total={TOTAL}
        title="¿Qué datos quieres destacar?"
        subtitle="Puedes elegir varios. Las opciones sin datos en tu Excel aparecen deshabilitadas."
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
        nextDisabled={highlights.length === 0}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => {
            const disabled = h.requires ? !dims[h.requires] : false;
            return (
              <OptionCard
                key={h.value}
                label={h.label}
                description={disabled ? 'No hay datos suficientes en tu Excel' : h.description}
                selected={highlights.includes(h.value)}
                disabled={disabled}
                onClick={() => toggleHighlight(h.value)}
              />
            );
          })}
        </div>
      </QuestionLayout>
    );
  }

  return (
    <QuestionLayout
      step={4}
      total={TOTAL}
      title="¿Cuál es la meta de cumplimiento?"
      subtitle="Se usará como referencia para el semáforo, las brechas y las recomendaciones."
      onBack={() => setStep(2)}
      onNext={() => onComplete({ reportType: reportType!, analysisType: analysisType!, highlights, goal })}
      nextLabel="Generar reporte ✨"
      nextDisabled={goal <= 0 || goal > 100}
    >
      <div className="flex flex-wrap gap-3">
        {GOAL_PRESETS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGoal(g)}
            className={[
              'rounded-2xl border px-6 py-4 text-lg font-bold transition',
              goal === g ? 'border-nex-500 bg-nex-50 text-nex-700 ring-2 ring-nex-200' : 'border-slate-200 bg-white text-slate-600 hover:border-nex-300',
            ].join(' ')}
          >
            {g}%
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-xs">
        <label className="block text-sm font-medium text-slate-600">O define una meta personalizada</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="w-28 rounded-xl border border-slate-200 px-4 py-2.5 text-lg font-semibold focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
          />
          <span className="text-lg font-semibold text-slate-500">%</span>
        </div>
      </div>
    </QuestionLayout>
  );
}
