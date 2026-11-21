import { TriangleAlert } from 'lucide-react';
import { EVIDENCIA_POR_PUNTO, FICHA_INMUEBLE, HALLAZGOS_CRUZADOS } from '../../../shared/mockResults';
import type { DocumentoAnalisis } from '../../../shared/useSimulatedAnalysis';
import { REGLAS_VALIDACION } from '../../../shared/validationRules';
import type { SeleccionHallazgo } from './FindingDrawer';

interface Props {
  documentos: DocumentoAnalisis[];
  onAbrirDato: (seleccion: SeleccionHallazgo) => void;
}

export function ExtractedDataTab({ documentos, onAbrirDato }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {FICHA_INMUEBLE.map((dato) => {
        const faltante = documentos.find((documento) => documento.tipoId === dato.tipoId)?.faltante ?? false;
        const evidencia = EVIDENCIA_POR_PUNTO[`${dato.tipoId}:${dato.reglaId}`];
        const hayHallazgo = HALLAZGOS_CRUZADOS.some((h) => h.tipoId === dato.tipoId && h.reglaId === dato.reglaId);
        const tipo = REGLAS_VALIDACION.find((item) => item.id === dato.tipoId);

        return (
          <div key={dato.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs text-muted">{dato.etiqueta}</p>
            {faltante || !evidencia ? (
              <p className="mt-0.5 text-[15px] font-semibold text-muted">No disponible</p>
            ) : (
              <>
                <div className="mt-0.5 flex items-start gap-1.5">
                  <p className="text-[15px] font-semibold text-ink">{evidencia.valorEncontrado}</p>
                  {hayHallazgo && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAbrirDato({
                      origen: 'punto',
                      tipoId: dato.tipoId,
                      reglaId: dato.reglaId,
                      reglaEtiqueta: dato.etiqueta,
                      estado: hayHallazgo ? 'revisar' : 'verificado',
                      documentoNombre: tipo?.nombre ?? '',
                      documentoArchivo: tipo?.nombre ?? '',
                    })
                  }
                  className="mt-1 text-xs font-medium text-brand underline underline-offset-2 hover:no-underline"
                >
                  {tipo?.nombre} · pág. {evidencia.pagina}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
