import type { AuditVariant } from '../config/programs';
import ModuleIcon from './ModuleIcon';
import HeroPanel from './HeroPanel';

interface AuditPickerProps {
  programName: string;
  programLogo: string;
  audits: AuditVariant[];
  onSelect: (auditId: string) => void;
  onBack: () => void;
  /** Acción opcional para abrir el Dashboard Consolidado (p. ej. IAAS). */
  onDashboard?: () => void;
}

/**
 * Selección de la sub-auditoría dentro de un programa (p. ej. IAAS → Higiene de
 * Manos, NAVM, ITU/CUP, ITS/CVC). Reutiliza el mismo flujo posterior; cada
 * variante aporta luego sus indicadores sin duplicar el motor.
 */
export default function AuditPicker({ programName, programLogo, audits, onSelect, onBack, onDashboard }: AuditPickerProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <HeroPanel compact className="mb-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-white/40">
            <ModuleIcon icon={programLogo} size={30} />
          </span>
          <div className="min-w-0 text-left">
            <h1 className="text-2xl font-black tracking-tight text-white">{programName}</h1>
            <p className="mt-0.5 text-sm text-emerald-50/80">Seleccione la auditoría que desea analizar.</p>
          </div>
        </div>
      </HeroPanel>

      {onDashboard && (
        <button
          type="button"
          onClick={onDashboard}
          className="group mb-4 flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-nex-200 bg-gradient-to-br from-nex-50 to-white p-5 text-left shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-nex-300 hover:shadow-lift"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-nex-100">🧫</span>
            <div>
              <p className="font-bold text-nex-800">Dashboard Consolidado IAAS</p>
              <p className="text-sm text-nex-700/70">Vista institucional que integra todas las vigilancias y bundles ya auditados.</p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-nex-700">Abrir <span className="inline-block transition group-hover:translate-x-0.5">→</span></span>
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {audits.map((au) => (
          <button
            key={au.id}
            type="button"
            onClick={() => onSelect(au.id)}
            className="card-interactive group flex cursor-pointer flex-col gap-1 p-5 text-left"
          >
            <p className="font-bold text-slate-800">{au.name}</p>
            {au.description && <p className="text-sm leading-relaxed text-slate-500">{au.description}</p>}
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-nex-700">
              Comenzar análisis <span className="transition group-hover:translate-x-0.5">→</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-nex-700">
          ← Volver a los programas
        </button>
      </div>
    </div>
  );
}
