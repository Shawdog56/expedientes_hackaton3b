import { FolderOpen } from 'lucide-react';
import { EXPLICACION_EXPEDIENTE } from '../../shared/constants';
import type { Expediente } from '../../shared/types/expediente';
import { ExpedienteCard } from './ExpedienteCard';

interface Props {
  expedientes: Expediente[];
  onQuitar: (id: string) => void;
}

export function ExpedienteList({ expedientes, onQuitar }: Props) {
  if (expedientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
        <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted" aria-hidden="true" />
        <p className="font-medium text-ink">Aún no has cargado ningún expediente</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{EXPLICACION_EXPEDIENTE}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {expedientes.map((expediente) => (
        <ExpedienteCard key={expediente.id} expediente={expediente} onQuitar={onQuitar} />
      ))}
    </div>
  );
}
