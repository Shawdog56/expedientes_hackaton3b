import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import logo from '../../assets/logo-3b.png';
import { ConfirmDialog } from './components/ConfirmDialog';

export type Vista = 'bandeja' | 'analisis' | 'resultados';

interface Props {
  vista: Vista;
  onIrInicio: () => void;
  onIniciarTutorial: () => void;
}

type ConfirmacionPendiente = 'inicio' | 'tutorial' | null;

export function PanelHeader({ vista, onIrInicio, onIniciarTutorial }: Props) {
  const [confirmando, setConfirmando] = useState<ConfirmacionPendiente>(null);

  const manejarClicLogo = () => {
    if (vista === 'bandeja') return;
    if (vista === 'analisis') {
      setConfirmando('inicio');
      return;
    }
    onIrInicio();
  };

  const manejarClicTutorial = () => {
    if (vista === 'analisis') {
      setConfirmando('tutorial');
      return;
    }
    onIniciarTutorial();
  };

  const confirmar = () => {
    const accion = confirmando;
    setConfirmando(null);
    if (accion === 'inicio') {
      onIrInicio();
    } else if (accion === 'tutorial') {
      onIrInicio();
      onIniciarTutorial();
    }
  };

  return (
    <header className="border-b-[3px] border-brand bg-ink">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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

        <button
          type="button"
          onClick={manejarClicTutorial}
          style={{ borderColor: '#5A5A5A', color: '#E6E6E6' }}
          className="flex min-h-10 shrink-0 items-center gap-2 rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-white/8"
        >
          <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
          Tutorial
        </button>
      </div>

      <ConfirmDialog
        abierto={confirmando !== null}
        mensaje={
          confirmando === 'tutorial'
            ? 'Si inicias el tutorial, se cancelará el análisis.'
            : 'Hay un análisis en curso. Si sales, se cancelará.'
        }
        textoCancelar="Seguir analizando"
        textoConfirmar={confirmando === 'tutorial' ? 'Iniciar tutorial y cancelar' : 'Salir y cancelar'}
        onCancelar={() => setConfirmando(null)}
        onConfirmar={confirmar}
      />
    </header>
  );
}
