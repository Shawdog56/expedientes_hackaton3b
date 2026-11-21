import { CircleCheck, TriangleAlert } from 'lucide-react';
import { COMPARACION_CRUZADA, EVIDENCIA_POR_PUNTO } from '../../../shared/mockResults';
import type { DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { REGLAS_VALIDACION, type TipoDocumentalId } from '../../../shared/validationRules';
import type { SeleccionHallazgo } from './FindingDrawer';

interface Props {
  documentos: DocumentoAnalisis[];
  onAbrirFila: (seleccion: SeleccionHallazgo) => void;
}

const COLUMNAS: TipoDocumentalId[] = ['escrituras', 'predial', 'alineamiento', 'uso_suelo'];

function truncar(texto: string, maximo = 22): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}

export function CrossValidationTab({ documentos, onAbrirFila }: Props) {
  const tiposFaltantes = documentos.filter((documento) => documento.faltante).map((documento) => documento.tipoId);
  const coinciden = COMPARACION_CRUZADA.filter((fila) => fila.coincide).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {coinciden} de {COMPARACION_CRUZADA.length} datos coinciden entre documentos
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-bg text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5">
                Dato
              </th>
              {COLUMNAS.map((tipoId) => (
                <th key={tipoId} scope="col" className="px-4 py-2.5">
                  {REGLAS_VALIDACION.find((tipo) => tipo.id === tipoId)?.nombre}
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COMPARACION_CRUZADA.map((fila) => (
              <tr key={fila.id}>
                <td className="px-4 py-2.5 font-medium text-ink">{fila.etiqueta}</td>
                {COLUMNAS.map((tipoId) => {
                  const celda = fila.celdas[tipoId];
                  const esFaltante = tiposFaltantes.includes(tipoId);
                  const evidencia = celda ? EVIDENCIA_POR_PUNTO[`${tipoId}:${celda.reglaId}`] : undefined;
                  const esDiscrepante = fila.discrepante === tipoId;

                  return (
                    <td key={tipoId} className="px-4 py-2.5">
                      {esFaltante ? (
                        <span className="text-muted">Faltante</span>
                      ) : !celda || !evidencia ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span
                          title={evidencia.valorEncontrado}
                          className={esDiscrepante ? 'font-semibold text-warn' : 'text-ink'}
                        >
                          {truncar(evidencia.valorEncontrado)}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => onAbrirFila({ origen: 'comparacion', filaId: fila.id, tiposFaltantes })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-bg ${
                      fila.coincide ? 'border-ok/40 bg-ok/10' : 'border-warn/40 bg-warn/10'
                    }`}
                  >
                    {fila.coincide ? (
                      <CircleCheck className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
                    ) : (
                      <TriangleAlert className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
                    )}
                    <span className="text-ink">{fila.coincide ? 'Coincide' : 'No coincide'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
