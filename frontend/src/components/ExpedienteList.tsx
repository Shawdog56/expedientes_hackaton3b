import { FolderOpen } from 'lucide-react';
import type { Expediente, TipoDocumental } from '../types/expediente';
import { ExpedienteCard } from './ExpedienteCard';

interface Props {
  expedientes: Expediente[];
  onQuitar: (id: string) => void;
  onReclasificar: (id: string, documentoId: string, tipo: TipoDocumental | null) => void;
}

export function ExpedienteList({ expedientes, onQuitar, onReclasificar }: Props) {
  if (expedientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
        <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted" aria-hidden="true" />
        <p className="font-medium text-ink">Aún no has cargado ningún expediente</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Un expediente completo debe incluir estos 4 tipos documentales: Escrituras, Predial,
          Alineamiento y Número Oficial, y Uso de Suelo.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {expedientes.map((expediente) => (
        <ExpedienteCard
          key={expediente.id}
          expediente={expediente}
          onQuitar={onQuitar}
          onReclasificar={onReclasificar}
        />
      ))}
    </div>
  );
}
