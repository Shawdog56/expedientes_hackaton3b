import { LogOut } from 'lucide-react';
import { useState } from 'react';
import logo from '../../assets/logo.jpg';
import { PildoraEstado, type EstadoAgentes } from './PildoraEstado';

interface Props {
  estado: EstadoAgentes;
  expedienteActual: number;
  totalExpedientes: number;
  usuarioEmail: string;
  analisisEnCurso: boolean;
  onCerrarSesion: () => void;
}

function obtenerIniciales(email: string): string {
  const local = email.split('@')[0] ?? '';
  const partes = local.split(/[._-]+/).filter(Boolean);
  if (partes.length >= 2) {
    return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
  }
  return (local.slice(0, 2) || '??').toUpperCase();
}

interface DialogoProps {
  onCancelar: () => void;
  onConfirmar: () => void;
}

function ConfirmarCierreSesion({ onCancelar, onConfirmar }: DialogoProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancelar} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-cierre-titulo"
        className="relative w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
      >
        <p id="confirmar-cierre-titulo" className="text-sm font-medium text-ink">
          Hay un análisis en curso. ¿Cerrar sesión de todos modos?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export function PanelHeader({
  estado,
  expedienteActual,
  totalExpedientes,
  usuarioEmail,
  analisisEnCurso,
  onCerrarSesion,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);

  const manejarClicCerrar = () => {
    if (analisisEnCurso) {
      setConfirmando(true);
    } else {
      onCerrarSesion();
    }
  };

  return (
    <header className="border-b-[3px] border-brand bg-ink">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Tiendas 3B" className="h-10 w-10 shrink-0" />
          <div>
            <h1 className="text-[20px] font-semibold leading-tight text-white">Revisión de Expedientes</h1>
            <p className="text-[13px] text-[#BDBDBD]">Análisis multiagente de documentación legal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PildoraEstado estado={estado} expedienteActual={expedienteActual} totalExpedientes={totalExpedientes} />
          <span
            title={usuarioEmail}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A] text-xs font-semibold text-white"
          >
            {obtenerIniciales(usuarioEmail)}
          </span>
          <button
            type="button"
            onClick={manejarClicCerrar}
            aria-label="Cerrar sesión"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#BDBDBD] transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {confirmando && (
        <ConfirmarCierreSesion
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() => {
            setConfirmando(false);
            onCerrarSesion();
          }}
        />
      )}
    </header>
  );
}
