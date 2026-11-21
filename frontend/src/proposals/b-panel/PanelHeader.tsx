import { useState } from 'react';
import logo from '../../assets/logo-3b.png';
import { ConfirmDialog } from './components/ConfirmDialog';

export type Vista = 'bandeja' | 'analisis' | 'resultados';

interface Props {
  vista: Vista;
  onIrInicio: () => void;
}

export function PanelHeader({ vista, onIrInicio }: Props) {
  const [confirmando, setConfirmando] = useState(false);

  const manejarClicLogo = () => {
    if (vista === 'bandeja') return;
    if (vista === 'analisis') {
      setConfirmando(true);
      return;
    }
    onIrInicio();
  };

  return (
    <header className="border-b-[3px] border-brand bg-ink">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
        <div>
          <button
            type="button"
            onClick={manejarClicLogo}
            aria-label="Ir al inicio"
            className="flex cursor-pointer items-center gap-3 rounded-md transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <img src={logo} alt="" aria-hidden="true" className="h-10 w-10 shrink-0" />
            <h1 className="text-[20px] font-semibold leading-tight text-white">Revisión de Expedientes</h1>
          </button>
          <p className="pl-[52px] text-[13px] text-[#BDBDBD]">Análisis multiagente de documentación legal</p>
        </div>
      </div>

      <ConfirmDialog
        abierto={confirmando}
        mensaje="Hay un análisis en curso. Si sales, se cancelará."
        textoCancelar="Seguir analizando"
        textoConfirmar="Salir y cancelar"
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          onIrInicio();
        }}
      />
    </header>
  );
}
