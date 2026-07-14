import type { AuditVariant } from '../config/programs';

interface AuditPickerProps {
  programName: string;
  programLogo: string;
  audits: AuditVariant[];
  onSelect: (auditId: string) => void;
  onBack: () => void;
}

/**
 * Selección de la sub-auditoría dentro de un programa (p. ej. IAAS → Higiene de
 * Manos, NAVM, ITU/CUP, ITS/CVC). Reutiliza el mismo flujo posterior; cada
 * variante aporta luego sus indicadores sin duplicar el motor.
 */
export default function AuditPicker({ programName, programLogo, audits, onSelect, onBack }: AuditPickerProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <p className="text-3xl">{programLogo}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{programName}</h1>
        <p className="mt-2 text-slate-500">Seleccione la auditoría que desea analizar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {audits.map((au) => (
          <button
            key={au.id}
            type="button"
            onClick={() => onSelect(au.id)}
            className="group flex cursor-pointer flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-nex-400 hover:shadow-sm"
          >
            <p className="font-bold text-slate-800">{au.name}</p>
            {au.description && <p className="text-sm text-slate-500">{au.description}</p>}
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-nex-700">
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
