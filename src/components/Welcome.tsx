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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Fondo "Aurora Nocturna": casi negro con auroras índigo, fucsia y cian. */}
      <div aria-hidden className="aurora-night" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-6%] h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[4%] h-[380px] w-[380px] rounded-full bg-nex-500/30 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[2%] h-[340px] w-[340px] rounded-full bg-aqua-400/25 blur-3xl" />
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div aria-hidden className="absolute inset-0 -z-10 scale-[1.6] rounded-full bg-fuchsia-500/20 blur-3xl" />
          <NexLogo size={112} />
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">NEX Report</h1>
          <p className="text-lg font-bold text-aqua-300 sm:text-xl">Plataforma de Auditorías Clínicas</p>
        </div>

        <p className="max-w-xl text-balance text-base leading-relaxed text-slate-300">
          Convierte tus planillas de auditoría clínica en informes profesionales —cumplimiento,
          vigilancia epidemiológica y tableros consolidados— en minutos y sin fórmulas.
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-2.5">
          {FEATURES.map((f) => (
            <li key={f.label} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-slate-100 shadow-sm backdrop-blur">
              <span>{f.icon}</span>
              {f.label}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onStart}
          className="hero-gradient group mt-3 inline-flex items-center gap-2 rounded-2xl px-9 py-3.5 text-base font-bold text-white shadow-xl shadow-fuchsia-500/25 transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-aqua-300/40"
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
