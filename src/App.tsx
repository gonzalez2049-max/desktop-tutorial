import { useMemo, useState } from 'react';
import Stepper from './components/Stepper';
import FileUpload from './components/FileUpload';
import ColumnReview from './components/ColumnReview';
import DataPreview from './components/DataPreview';
import Wizard from './components/wizard/Wizard';
import ReportSummary from './components/ReportSummary';
import { buildSummary } from './utils/summary';
import type { DetectedColumn, ParsedWorkbook, ReportConfig, ReportSummary as Summary } from './types';

type Stage = 'upload' | 'review' | 'wizard' | 'generating' | 'result';

const STEPS = [
  { key: 'upload', label: 'Subir Excel' },
  { key: 'review', label: 'Leer datos' },
  { key: 'wizard', label: 'Configurar' },
  { key: 'result', label: 'Reporte' },
];

const STAGE_INDEX: Record<Stage, number> = { upload: 0, review: 1, wizard: 2, generating: 2, result: 3 };

export default function App() {
  const [stage, setStage] = useState<Stage>('upload');
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const reset = () => {
    setStage('upload');
    setWorkbook(null);
    setSummary(null);
  };

  const handleParsed = (wb: ParsedWorkbook) => {
    setWorkbook(wb);
    setStage('review');
  };

  const handleColumns = (columns: DetectedColumn[]) => {
    if (workbook) setWorkbook({ ...workbook, columns });
  };

  const handleWizardComplete = (config: ReportConfig) => {
    if (!workbook) return;
    // "Primero pregunta, luego analiza, luego genera": pequeña transición.
    setStage('generating');
    setTimeout(() => {
      setSummary(buildSummary(workbook, config));
      setStage('result');
    }, 500);
  };

  const currentStep = useMemo(() => STAGE_INDEX[stage], [stage]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-nex-600 text-lg font-black text-white">N</div>
            <div>
              <p className="text-lg font-extrabold leading-none text-slate-800">NEX Report</p>
              <p className="text-xs text-slate-400">Informes de auditorías clínicas</p>
            </div>
          </div>
          <Stepper steps={STEPS} current={currentStep} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {stage === 'upload' && <FileUpload onParsed={handleParsed} />}

        {stage === 'review' && workbook && (
          <ColumnReview
            columns={workbook.columns}
            onChange={handleColumns}
            onConfirm={() => setStage('wizard')}
            onBack={reset}
            preview={<DataPreview workbook={workbook} />}
          />
        )}

        {stage === 'wizard' && workbook && (
          <Wizard workbook={workbook} onComplete={handleWizardComplete} onBack={() => setStage('review')} />
        )}

        {stage === 'generating' && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-nex-200 border-t-nex-600" />
            <p className="text-lg font-semibold text-slate-700">Generando tu reporte…</p>
            <p className="text-sm text-slate-400">Leyendo el Excel y aplicando tu configuración.</p>
          </div>
        )}

        {stage === 'result' && summary && workbook && (
          <ReportSummary summary={summary} fileName={workbook.fileName} onReset={reset} />
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        NEX Report · Tus datos se procesan localmente en tu navegador.
      </footer>
    </div>
  );
}
