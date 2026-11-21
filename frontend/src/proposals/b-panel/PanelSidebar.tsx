import type { Expediente } from '../../shared/types/expediente';
import { PanelUploadZone } from './PanelUploadZone';

interface Props {
  expedientesActuales: Expediente[];
  onExpedientesCargados: (expedientes: Expediente[]) => void;
}

export function PanelSidebar({ expedientesActuales, onExpedientesCargados }: Props) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-ink">Cargar expediente</h2>
        <PanelUploadZone expedientesActuales={expedientesActuales} onExpedientesCargados={onExpedientesCargados} />
      </section>
    </aside>
  );
}
