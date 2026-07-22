import type { ReactNode } from 'react';
import HelpTip from '../HelpTip';

interface QuestionLayoutProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  /** Texto de ayuda opcional (ícono «?» junto al título). */
  help?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

/** Envoltorio común para cada pregunta del asistente (copiloto). */
export default function QuestionLayout({
  step,
  total,
  title,
  subtitle,
  help,
  children,
  onBack,
  onNext,
  nextLabel = 'Continuar →',
  nextDisabled,
}: QuestionLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <span className="text-sm font-semibold text-nex-600">Pregunta {step} de {total}</span>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-800">
          {title}
          {help && <HelpTip text={help} />}
        </h2>
        {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
      </div>

      {children}

      <div className="mt-8 flex items-center justify-between">
        <button className="btn-ghost" onClick={onBack} disabled={!onBack}>
          ← Volver
        </button>
        <button className="btn-primary" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
