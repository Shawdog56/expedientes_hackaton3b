import logo from '../../assets/logo.jpg';
import { PildoraEstado, type EstadoAgentes } from './PildoraEstado';

interface Props {
  estado: EstadoAgentes;
  expedienteActual: number;
  totalExpedientes: number;
}

export function PanelHeader({ estado, expedienteActual, totalExpedientes }: Props) {
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
        <PildoraEstado estado={estado} expedienteActual={expedienteActual} totalExpedientes={totalExpedientes} />
      </div>
    </header>
  );
}
