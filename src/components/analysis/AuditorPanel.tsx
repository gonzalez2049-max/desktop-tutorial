import { useState } from 'react';
import type { AnalysisResult, ComplianceGroup } from '../../types';

/** Formatea un porcentaje con coma decimal (es-CL). */
function fmtPct(n: number): string {
  return `${n.toString().replace('.', ',')} %`;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'font-bold text-slate-800' : 'font-mono text-slate-700'}>{value}</span>
    </div>
  );
}

function IndicatorAudit({ g }: { g: ComplianceGroup }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-2 font-semibold text-slate-800">{g.label}</p>
      <Row label="Pacientes incluidos" value={String(g.total)} />
      <Row label="Cumple" value={String(g.cumple)} />
      <Row label="No cumple" value={String(g.noCumple)} />
      <Row label="N/A" value={String(g.noAplica)} />
      <div className="my-2 border-t border-dashed border-slate-200" />
      <Row label="Numerador (cumple)" value={String(g.cumple)} />
      <Row label="Denominador (cumple + no cumple)" value={String(g.aplicables)} />
      <Row label="Fórmula" value={g.aplicables > 0 ? `${g.cumple} / ${g.aplicables} × 100` : 'Sin casos aplicables'} />
      <div className="mt-2 rounded-lg bg-nex-50 px-3 py-1.5">
        <Row label="Resultado" value={fmtPct(g.percent)} strong />
      </div>
    </div>
  );
}

/** Modo auditor: valida la trazabilidad de los cálculos (solo administradores). */
export default function AuditorPanel({ a }: { a: AnalysisResult }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { exportAuditExcel } = await import('../../utils/exportAudit');
      exportAuditExcel(a);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border-2 border-nex-200 p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            🔍 Modo auditor
            <span className="rounded-full bg-nex-100 px-2 py-0.5 text-[11px] font-semibold text-nex-700">Solo administradores</span>
          </h3>
          <p className="mt-0.5 text-sm text-slate-400">Trazabilidad de los cálculos: numerador, denominador y fórmula por indicador.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setShow((s) => !s)}>
            {show ? 'Ocultar cálculos' : 'Mostrar cálculos'}
          </button>
          <button className="btn-ghost" onClick={download} disabled={busy}>
            {busy ? 'Generando…' : '📗 Excel de auditoría'}
          </button>
        </div>
      </header>

      {show && (
        <div className="mt-5">
          {a.complianceByIndicator.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">No hay indicadores para auditar.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {a.complianceByIndicator.map((g) => (
                <IndicatorAudit key={g.label} g={g} />
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">
            El Excel de auditoría incluye además el cálculo global, por unidad, por turno y la caracterización clínica.
          </p>
        </div>
      )}
    </section>
  );
}
