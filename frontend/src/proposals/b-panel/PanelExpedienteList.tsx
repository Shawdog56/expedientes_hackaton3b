import { Inbox, Sparkles } from 'lucide-react';
import type { Expediente } from '../../shared/types/expediente';
import { REGLAS_VALIDACION } from '../../shared/validationRules';
import { ExpedienteTableRow } from './ExpedienteTableRow';

interface Props {
  expedientes: Expediente[];
  onQuitar: (id: string) => void;
  onAnalizar: () => void;
}

export function PanelExpedienteList({ expedientes, onQuitar, onAnalizar }: Props) {
  if (expedientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <p className="text-[18px] font-semibold text-ink">La bandeja está vacía</p>
            <p className="text-sm text-muted">Un expediente completo incluye estos 4 documentos:</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REGLAS_VALIDACION.map((tipo) => (
            <div key={tipo.id} className="flex items-start gap-3 rounded-[12px] border border-border bg-surface p-4">
              <tipo.Icono className="h-[30px] w-[30px] shrink-0 text-brand" aria-hidden="true" />
              <div>
                <p className="text-[15px] font-semibold text-ink">{tipo.nombre}</p>
                <p className="text-[13px] text-muted">{tipo.descripcionCorta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Expedientes cargados</h2>
        <span className="text-xs font-medium text-muted">
          {expedientes.length} expediente{expedientes.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-bg text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Expediente
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Origen
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Archivos
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Tamaño
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expedientes.map((expediente) => (
              <ExpedienteTableRow key={expediente.id} expediente={expediente} onQuitar={onQuitar} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-border p-4">
        <button
          type="button"
          onClick={onAnalizar}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Analizar {expedientes.length} expediente{expedientes.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}
