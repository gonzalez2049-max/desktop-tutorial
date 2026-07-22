import NexLogo from './NexLogo';

interface WelcomeProps {
  onStart: () => void;
}

const FEATURES = [
  { icon: '✅', label: 'Cumplimiento de prácticas' },
  { icon: '🧫', label: 'Vigilancia epidemiológica IAAS' },
  { icon: '📊', label: 'Dashboard consolidado' },
  { icon: '📄', label: 'Informes en Word y PDF' },
];

/**
 * Portada de bienvenida: primera pantalla antes de entrar al flujo de informes.
 * Presenta la marca (logo verde) y un acceso claro para comenzar.
 */
export default function Welcome({ onStart }: WelcomeProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center" style={{ background: 'radial-gradient(60rem 60rem at 85% -10%, rgba(15,122,79,0.18), transparent 60%), radial-gradient(50rem 50rem at 0% 100%, rgba(15,61,46,0.14), transparent 55%), linear-gradient(180deg, #eef6f0 0%, #e4efe8 100%)' }}>
      {/* Fondo suave con acentos verdes (decorativo). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-8%] h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-emerald-300/40 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[8%] h-[340px] w-[340px] rounded-full bg-nex-300/35 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[6%] h-[300px] w-[300px] rounded-full bg-emerald-200/45 blur-3xl" />
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div aria-hidden className="absolute inset-0 -z-10 rounded-full bg-emerald-300/30 blur-2xl" />
          <NexLogo size={104} />
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">NEX Report</h1>
          <p className="text-lg font-bold text-nex-700 sm:text-xl">Plataforma de Auditorías Clínicas</p>
        </div>

        <p className="max-w-xl text-balance text-base leading-relaxed text-slate-500">
          Convierte tus planillas de auditoría clínica en informes profesionales —cumplimiento,
          vigilancia epidemiológica y tableros consolidados— en minutos y sin fórmulas.
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-2.5">
          {FEATURES.map((f) => (
            <li key={f.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur">
              <span>{f.icon}</span>
              {f.label}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onStart}
          className="group mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200"
        >
          Comenzar
          <span className="transition group-hover:translate-x-0.5">→</span>
        </button>

        <p className="mt-2 text-xs text-slate-400">
          🔒 Tus datos se procesan localmente en tu navegador. No se sube nada a ningún servidor.
        </p>
      </div>
    </div>
  );
}
