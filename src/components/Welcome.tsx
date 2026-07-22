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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center" style={{ background: 'radial-gradient(55rem 55rem at 85% -10%, rgba(217,70,239,0.20), transparent 60%), radial-gradient(50rem 50rem at 100% 60%, rgba(34,211,238,0.16), transparent 55%), radial-gradient(52rem 52rem at 0% 100%, rgba(99,62,224,0.20), transparent 55%), linear-gradient(180deg, #f2f2fd 0%, #eaecfb 100%)' }}>
      {/* Fondo "Aurora" con acentos índigo, fucsia y cian (decorativo). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-8%] h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[6%] h-[360px] w-[360px] rounded-full bg-nex-400/30 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[4%] h-[320px] w-[320px] rounded-full bg-aqua-300/35 blur-3xl" />
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
          className="hero-gradient group mt-3 inline-flex items-center gap-2 rounded-2xl px-9 py-3.5 text-base font-bold text-white shadow-lg shadow-nex-700/25 transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-aqua-300/40"
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
