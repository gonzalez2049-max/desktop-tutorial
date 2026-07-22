import { useState } from 'react';
import { hasPasscode, login, setPasscode } from '../../utils/adminConfig';
import NexLogo from '../NexLogo';

interface Props {
  onEnter: () => void;
  onCancel: () => void;
}

/** Pantalla de acceso al perfil de administrador (clave local). */
export default function AdminGate({ onEnter, onCancel }: Props) {
  const existing = hasPasscode();
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (existing) {
      if (login(code)) onEnter();
      else setError('Clave incorrecta.');
      return;
    }
    // Primera vez: crear la clave.
    if (code.trim().length < 4) { setError('La clave debe tener al menos 4 caracteres.'); return; }
    if (code !== confirm) { setError('Las claves no coinciden.'); return; }
    setPasscode(code);
    login(code);
    onEnter();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <NexLogo size={54} />
          <h1 className="text-xl font-black text-slate-800">Perfil de administrador</h1>
          <p className="text-sm text-slate-500">{existing ? 'Ingresa tu clave para administrar NEX Report.' : 'Crea una clave para proteger la administración.'}</p>
        </div>

        <div className="card space-y-3 p-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500">{existing ? 'Clave' : 'Nueva clave'}</label>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && existing && submit()}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200" autoFocus />
          </div>
          {!existing && (
            <div>
              <label className="block text-xs font-semibold text-slate-500">Confirmar clave</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200" />
            </div>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
          <button className="btn-primary w-full" onClick={submit}>{existing ? 'Ingresar' : 'Crear clave y entrar'}</button>
          {!existing && <p className="text-[11px] text-slate-400">🔒 La clave se guarda solo en este navegador (candado local, sin servidor).</p>}
        </div>

        <div className="mt-4 text-center">
          <button className="text-sm font-semibold text-slate-500 hover:text-nex-700" onClick={onCancel}>← Volver</button>
        </div>
      </div>
    </div>
  );
}
