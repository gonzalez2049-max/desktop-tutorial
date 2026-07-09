import { useState } from 'react';
import QuestionLayout from './QuestionLayout';
import OptionCard from '../OptionCard';
import { GOAL_PRESETS, HIGHLIGHTS, REPORT_TYPES } from '../../config/options';
import type { Highlight, ParsedWorkbook, ReportConfig, ReportType } from '../../types';

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
 * Asistente de 3 preguntas: tipo de informe, datos a destacar y meta.
 * Primero pregunta; el análisis y la generación vienen después.
 */
export default function Wizard({ workbook, onComplete, onBack }: WizardProps) {
  const [step, setStep] = useState(0);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [goal, setGoal] = useState<number>(90);

  const dims = availableDimensions(workbook);

  const toggleHighlight = (h: Highlight) => {
    setHighlights((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  if (step === 0) {
    return (
      <QuestionLayout
        step={1}
        total={3}
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
        total={3}
        title="¿Qué datos quieres destacar?"
        subtitle="Puedes elegir varios. Las opciones sin datos en tu Excel aparecen deshabilitadas."
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
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
      step={3}
      total={3}
      title="¿Cuál es la meta de cumplimiento?"
      subtitle="Se usará como referencia para el semáforo, las brechas y las recomendaciones."
      onBack={() => setStep(1)}
      onNext={() => onComplete({ reportType: reportType!, highlights, goal })}
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
