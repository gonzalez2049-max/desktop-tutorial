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
import BackBar from './components/BackBar';
import OtrosInformes from './components/otros/OtrosInformes';
import { getProgramConfig } from './utils/programConfig';
import type { RawModule } from './utils/consolidatedDashboard';
import type { DetectedColumn, ParsedWorkbook, ReportConfig, ReportType } from './types';

type Stage =
  | 'welcome'
  | 'home'
  | 'audit'
  | 'settings'
  | 'upload'
  | 'review'
  | 'wizard'
  | 'generating'
  | 'result'
  | 'dashboard-upload'
  | 'dashboard'
  | 'otros';

const STEPS = [
  { key: 'home', label: 'Programa' },
  { key: 'upload', label: 'Subir Excel' },
  { key: 'review', label: 'Leer datos' },
  { key: 'wizard', label: 'Configurar' },
  { key: 'result', label: 'Reporte' },
];

const STAGE_INDEX: Record<Stage, number> = { welcome: 0, home: 0, audit: 0, settings: 0, upload: 1, review: 2, wizard: 3, generating: 3, result: 4, 'dashboard-upload': 1, dashboard: 4, otros: 0 };

export default function App() {
  const [stage, setStage] = useState<Stage>('welcome');
  // Pila de navegación: permite «Volver atrás» a la pantalla anterior real
  // conservando todo el estado (archivos, columnas, configuración).
  const [history, setHistory] = useState<Stage[]>([]);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [auditId, setAuditId] = useState<string | undefined>(undefined);
  const [configProgram, setConfigProgram] = useState<ReportType | null>(null);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [dashboardRaw, setDashboardRaw] = useState<RawModule[] | null>(null);

  /** Navega hacia adelante recordando la pantalla actual. */
  const go = (next: Stage) => {
    setHistory((h) => [...h, stage]);
    setStage(next);
  };
  /** Vuelve a la pantalla anterior real (sin perder datos). */
  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) {
        setStage('home');
        return h;
      }
      setStage(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };
  /** Vuelve al inicio (selector de programas) conservando los datos cargados. */
  const goHome = () => {
    setHistory([]);
    setStage('home');
  };

  /** Reinicia por completo (empezar de nuevo): borra datos y navegación. */
  const reset = () => {
    setHistory([]);
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
    // Módulo genérico independiente.
    if (rt === 'Personalizado') { go('otros'); return; }
    // Programas con sub-auditorías (p. ej. IAAS) piden primero la auditoría.
    if (getProgramConfig(rt).audits?.length) go('audit');
    else go('upload');
  };

  const handleSelectAudit = (id: string) => {
    setAuditId(id);
    go('upload');
  };

  const handleConfigureProgram = (rt: ReportType) => {
    setConfigProgram(rt);
    go('settings');
  };

  const handleParsed = (wb: ParsedWorkbook) => {
    setWorkbook(wb);
    go('review');
  };

  const handleColumns = (columns: DetectedColumn[]) => {
    if (workbook) setWorkbook({ ...workbook, columns });
  };

  const handleWizardComplete = (cfg: ReportConfig) => {
    if (!workbook) return;
    setConfig({ ...cfg, auditId });
    // La pantalla anterior real del reporte es el asistente.
    setHistory((h) => [...h, 'wizard']);
    setStage('generating');
    setTimeout(() => setStage('result'), 500);
  };

  const currentStep = useMemo(() => STAGE_INDEX[stage], [stage]);

  // Portada de bienvenida: pantalla completa, sin encabezado ni pasos.
  if (stage === 'welcome') return <Welcome onStart={() => go('home')} />;

  const showStepper = stage !== 'otros' && stage !== 'dashboard' && stage !== 'dashboard-upload' && stage !== 'settings';

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button type="button" onClick={goHome} className="flex items-center gap-2.5" title="Volver al inicio">
            <NexLogo size={38} />
            <div className="text-left">
              <p className="text-lg font-extrabold leading-none text-slate-800">NEX Report</p>
              <p className="text-xs text-slate-400">Plataforma de Auditorías Clínicas</p>
            </div>
          </button>
          {showStepper && <Stepper steps={STEPS} current={currentStep} />}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {stage !== 'otros' && <BackBar onBack={goBack} onHome={goHome} canBack={history.length > 0} showHome={stage !== 'home'} />}

        {stage === 'home' && <Home onSelect={handleSelectProgram} onConfigure={handleConfigureProgram} />}

        {stage === 'audit' && reportType && (
          <AuditPicker
            programName={getProgramConfig(reportType).programName}
            programLogo={getProgramConfig(reportType).logo}
            audits={getProgramConfig(reportType).audits ?? []}
            onSelect={handleSelectAudit}
            onBack={goBack}
            onDashboard={reportType === 'IAAS' ? () => go('dashboard-upload') : undefined}
          />
        )}

        {stage === 'dashboard-upload' && (
          <DashboardUpload
            onReady={(raw) => { setDashboardRaw(raw); go('dashboard'); }}
            onBack={goBack}
            initial={dashboardRaw ?? undefined}
          />
        )}

        {stage === 'dashboard' && dashboardRaw && (
          <ConsolidatedDashboard
            raw={dashboardRaw}
            onReset={reset}
            onEditUploads={() => go('dashboard-upload')}
          />
        )}

        {stage === 'settings' && configProgram && (
          <ProgramSettings reportType={configProgram} onBack={goBack} />
        )}

        {stage === 'otros' && <OtrosInformes onExit={goHome} />}

        {stage === 'upload' && reportType && <FileUpload onParsed={handleParsed} onBack={goBack} reportType={reportType} auditId={auditId} />}

        {stage === 'review' && workbook && (
          <ColumnReview
            columns={workbook.columns}
            onChange={handleColumns}
            onConfirm={() => go('wizard')}
            onBack={goBack}
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
            onBack={goBack}
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
          <AnalysisView workbook={workbook} config={config} fileName={workbook.fileName} onReset={reset} onEdit={() => go('wizard')} />
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        NEX Report · Tus datos se procesan localmente en tu navegador.
      </footer>
    </div>
  );
}
