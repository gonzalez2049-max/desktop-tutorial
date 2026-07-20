import { useMemo, useState } from 'react';
import Stepper from './components/Stepper';
import Home from './components/Home';
import AuditPicker from './components/AuditPicker';
import ProgramSettings from './components/ProgramSettings';
import FileUpload from './components/FileUpload';
import ColumnReview from './components/ColumnReview';
import DataPreview from './components/DataPreview';
import Wizard from './components/wizard/Wizard';
import AnalysisView from './components/analysis/AnalysisView';
import DashboardUpload from './components/dashboard/DashboardUpload';
import ConsolidatedDashboard from './components/dashboard/ConsolidatedDashboard';
import NexLogo from './components/NexLogo';
import Welcome from './components/Welcome';
import { getProgramConfig } from './utils/programConfig';
import type { RawModule } from './utils/consolidatedDashboard';
import type { DetectedColumn, ParsedWorkbook, ReportConfig, ReportType } from './types';

type Stage = 'welcome' | 'home' | 'audit' | 'settings' | 'upload' | 'review' | 'wizard' | 'generating' | 'result' | 'dashboard-upload' | 'dashboard';

const STEPS = [
  { key: 'home', label: 'Programa' },
  { key: 'upload', label: 'Subir Excel' },
  { key: 'review', label: 'Leer datos' },
  { key: 'wizard', label: 'Configurar' },
  { key: 'result', label: 'Reporte' },
];

const STAGE_INDEX: Record<Stage, number> = { welcome: 0, home: 0, audit: 0, settings: 0, upload: 1, review: 2, wizard: 3, generating: 3, result: 4, 'dashboard-upload': 1, dashboard: 4 };

export default function App() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [auditId, setAuditId] = useState<string | undefined>(undefined);
  const [configProgram, setConfigProgram] = useState<ReportType | null>(null);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [dashboardRaw, setDashboardRaw] = useState<RawModule[] | null>(null);

  const reset = () => {
    setStage('home');
    setReportType(null);
    setAuditId(undefined);
    setWorkbook(null);
    setConfig(null);
    setDashboardRaw(null);
  };

  const handleSelectProgram = (rt: ReportType) => {
    setReportType(rt);
    setAuditId(undefined);
    // Programas con sub-auditorías (p. ej. IAAS) piden primero la auditoría.
    if (getProgramConfig(rt).audits?.length) setStage('audit');
    else setStage('upload');
  };

  const handleSelectAudit = (id: string) => {
    setAuditId(id);
    setStage('upload');
  };

  const handleConfigureProgram = (rt: ReportType) => {
    setConfigProgram(rt);
    setStage('settings');
  };

  const handleParsed = (wb: ParsedWorkbook) => {
    setWorkbook(wb);
    setStage('review');
  };

  const handleColumns = (columns: DetectedColumn[]) => {
    if (workbook) setWorkbook({ ...workbook, columns });
  };

  const handleWizardComplete = (cfg: ReportConfig) => {
    if (!workbook) return;
    // "Primero pregunta, luego analiza, luego genera": pequeña transición.
    setConfig({ ...cfg, auditId });
    setStage('generating');
    setTimeout(() => setStage('result'), 500);
  };

  // Volver a editar desde el reporte sin perder Excel, columnas ni configuración.
  const handleEditFromResult = () => setStage('wizard');

  const currentStep = useMemo(() => STAGE_INDEX[stage], [stage]);

  // Portada de bienvenida: pantalla completa, sin encabezado ni pasos.
  if (stage === 'welcome') return <Welcome onStart={() => setStage('home')} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <NexLogo size={38} />
            <div>
              <p className="text-lg font-extrabold leading-none text-slate-800">NEX Report</p>
              <p className="text-xs text-slate-400">Plataforma de Auditorías Clínicas</p>
            </div>
          </div>
          <Stepper steps={STEPS} current={currentStep} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {stage === 'home' && <Home onSelect={handleSelectProgram} onConfigure={handleConfigureProgram} />}

        {stage === 'audit' && reportType && (
          <AuditPicker
            programName={getProgramConfig(reportType).programName}
            programLogo={getProgramConfig(reportType).logo}
            audits={getProgramConfig(reportType).audits ?? []}
            onSelect={handleSelectAudit}
            onBack={reset}
            onDashboard={reportType === 'IAAS' ? () => setStage('dashboard-upload') : undefined}
          />
        )}

        {stage === 'dashboard-upload' && (
          <DashboardUpload
            onReady={(raw) => { setDashboardRaw(raw); setStage('dashboard'); }}
            onBack={() => setStage('audit')}
            initial={dashboardRaw ?? undefined}
          />
        )}

        {stage === 'dashboard' && dashboardRaw && (
          <ConsolidatedDashboard
            raw={dashboardRaw}
            onReset={reset}
            onEditUploads={() => setStage('dashboard-upload')}
          />
        )}

        {stage === 'settings' && configProgram && (
          <ProgramSettings reportType={configProgram} onBack={() => setStage('home')} />
        )}

        {stage === 'upload' && reportType && <FileUpload onParsed={handleParsed} onBack={reset} reportType={reportType} auditId={auditId} />}

        {stage === 'review' && workbook && (
          <ColumnReview
            columns={workbook.columns}
            onChange={handleColumns}
            onConfirm={() => setStage('wizard')}
            onBack={() => setStage('upload')}
            reportType={reportType ?? undefined}
            auditId={auditId}
            preview={<DataPreview workbook={workbook} />}
          />
        )}

        {stage === 'wizard' && workbook && reportType && (
          <Wizard
            reportType={reportType}
            auditId={auditId}
            workbook={workbook}
            onComplete={handleWizardComplete}
            onBack={() => setStage('review')}
            initialConfig={config ?? undefined}
          />
        )}

        {stage === 'generating' && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-nex-200 border-t-nex-600" />
            <p className="text-lg font-semibold text-slate-700">Generando tu reporte…</p>
            <p className="text-sm text-slate-400">Leyendo el Excel y aplicando tu configuración.</p>
          </div>
        )}

        {stage === 'result' && config && workbook && (
          <AnalysisView workbook={workbook} config={config} fileName={workbook.fileName} onReset={reset} onEdit={handleEditFromResult} />
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        NEX Report · Tus datos se procesan localmente en tu navegador.
      </footer>
    </div>
  );
}
