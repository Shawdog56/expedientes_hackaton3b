import { Inbox, Sparkles } from 'lucide-react';
import { EXPLICACION_EXPEDIENTE } from '../../shared/constants';
import type { DocumentoParaVer, Expediente, TipoDocumental } from '../../shared/types/expediente';
import { esExpedienteListo } from '../../shared/utils/expediente';
import { ExpedienteTableRow } from './ExpedienteTableRow';

interface Props {
  expedientes: Expediente[];
  onQuitar: (id: string) => void;
  onReclasificar: (id: string, documentoId: string, tipo: TipoDocumental | null) => void;
  onAnalizar: () => void;
  onVer: (documento: DocumentoParaVer) => void;
}

export function PanelExpedienteList({ expedientes, onQuitar, onReclasificar, onAnalizar, onVer }: Props) {
  const listos = expedientes.filter(esExpedienteListo).length;
  const validando = expedientes.some((expediente) => expediente.estado === 'validando');

  if (expedientes.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        <Inbox className="mb-3 h-8 w-8 text-muted" aria-hidden="true" />
        <p className="font-medium text-ink">La bandeja está vacía</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{EXPLICACION_EXPEDIENTE}</p>
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
        <table className="w-full min-w-[760px] text-sm">
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
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Estado
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expedientes.map((expediente) => (
              <ExpedienteTableRow
                key={expediente.id}
                expediente={expediente}
                onQuitar={onQuitar}
                onReclasificar={onReclasificar}
                onVer={onVer}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-border p-4">
        <button
          type="button"
          onClick={onAnalizar}
          disabled={listos === 0 || validando}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {validando ? 'Validando expedientes…' : `Analizar ${listos} expediente${listos === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
