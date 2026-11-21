import { AlertCircle, ChevronRight, FileArchive, Files, Folder, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ChipTipo, FilaDocumento, Resumen } from '../../shared/components/ClasificacionExpediente';
import { useAnimaciones } from '../../shared/motion';
import {
  comoArchivoVisible,
  ETIQUETA_TIPO,
  TIPOS_DOCUMENTALES,
  type DocumentoParaVer,
  type Expediente,
  type TipoDocumental,
} from '../../shared/types/expediente';
import { formatBytes } from '../../shared/utils/formatBytes';
import { plural } from '../../shared/utils/plural';
import { esDocumento } from '../../shared/utils/tiposArchivo';

interface Props {
  expediente: Expediente;
  indice: number;
  onQuitar: (id: string) => void;
  onReclasificar: (id: string, documentoId: string, tipo: TipoDocumental | null) => void;
  onVer?: (documento: DocumentoParaVer) => void;
}

const ETIQUETA_ORIGEN: Record<Expediente['origen'], string> = {
  carpeta: 'Carpeta',
  zip: 'Archivo .zip',
  archivos: 'Archivos sueltos',
};

const ICONO_ORIGEN: Record<Expediente['origen'], typeof Folder> = {
  carpeta: Folder,
  zip: FileArchive,
  archivos: Files,
};

function etiquetas(tipos: TipoDocumental[]): string {
  return tipos.map((tipo) => ETIQUETA_TIPO[tipo]).join(', ');
}

export function ExpedienteTableRow({ expediente, indice, onQuitar, onReclasificar, onVer }: Props) {
  const { reducido } = useAnimaciones();
  const sinClasificar = expediente.documentos.filter((doc) => doc.tipo_documental === null);
  const [verDetalle, setVerDetalle] = useState<boolean | null>(null);
  // Se abre sola si hay documentos que requieren clasificación manual.
  const abierto = verDetalle ?? sinClasificar.length > 0;
  const esZip = expediente.origen === 'zip';
  const validado = expediente.estado === 'validado';
  const Icono = ICONO_ORIGEN[expediente.origen];
  const documentosEnviados = expediente.archivos.filter((archivo) => esDocumento(archivo.nombre));

  return (
    <>
      <motion.tr
        initial={reducido ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducido ? { opacity: 0 } : { opacity: 0, height: 0 }}
        transition={{ duration: 0.2, delay: reducido ? 0 : indice * 0.04 }}
        style={{ overflow: 'hidden' }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Icono className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="truncate font-medium text-ink">{expediente.nombre}</span>
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-muted">{ETIQUETA_ORIGEN[expediente.origen]}</td>
        <td className="px-4 py-3 text-muted">
          {validado ? expediente.documentos.length : esZip ? '—' : expediente.archivos.length}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-muted">{formatBytes(expediente.tamanoTotal)}</td>
        <td className="px-4 py-3 text-sm" role="status">
          <Resumen expediente={expediente} />
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setVerDetalle(!abierto)}
              aria-expanded={abierto}
              aria-label={
                abierto ? `Colapsar detalle de ${expediente.nombre}` : `Expandir detalle de ${expediente.nombre}`
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-ink"
            >
              <motion.span className="flex" animate={{ rotate: abierto ? 90 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            </button>
            <button
              type="button"
              onClick={() => onQuitar(expediente.id)}
              aria-label={`Quitar expediente ${expediente.nombre}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-error/10 hover:text-error"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </td>
      </motion.tr>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.tr
            initial={reducido ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <td colSpan={6} className="space-y-3 border-t border-border bg-bg px-4 py-3">
              {validado ? (
                <>
                  <ul className="flex flex-wrap gap-1.5">
                    {TIPOS_DOCUMENTALES.map(({ valor, etiqueta }) => (
                      <ChipTipo key={valor} expediente={expediente} tipo={valor} etiqueta={etiqueta} />
                    ))}
                  </ul>
                  {expediente.tiposFaltantes.length > 0 && (
                    <p className="flex items-start gap-2 text-xs text-error">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Faltan documentos: {etiquetas(expediente.tiposFaltantes)}.
                    </p>
                  )}
                  {expediente.tiposDuplicados.length > 0 && (
                    <p className="flex items-start gap-2 text-xs text-ink">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                      Hay más de un documento de: {etiquetas(expediente.tiposDuplicados)}.
                    </p>
                  )}
                  {expediente.documentos.length > 0 && (
                    <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface p-1">
                      {[...expediente.documentos]
                        .sort((a, b) => Number(a.tipo_documental !== null) - Number(b.tipo_documental !== null))
                        .map((doc) => (
                          <FilaDocumento
                            key={doc.id}
                            doc={doc}
                            onCambiarTipo={(tipo) => onReclasificar(expediente.id, doc.id, tipo)}
                            onVer={
                              onVer
                                ? () =>
                                    onVer({
                                      titulo: expediente.nombre,
                                      archivos: expediente.documentos.map(comoArchivoVisible),
                                      indiceInicial: expediente.documentos.findIndex((item) => item.id === doc.id),
                                    })
                                : undefined
                            }
                          />
                        ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {documentosEnviados.length === 0 ? (
                    <span className="text-xs text-muted">
                      {esZip
                        ? 'El contenido del .zip se revisa al validarlo.'
                        : 'No se encontraron documentos en este expediente.'}
                    </span>
                  ) : (
                    documentosEnviados.map((archivo) => (
                      <span
                        key={archivo.ruta}
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
                      >
                        {archivo.nombre}
                      </span>
                    ))
                  )}
                </div>
              )}
              {expediente.rechazados.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-error">
                    {plural(expediente.rechazados.length, 'archivo rechazado', 'archivos rechazados')}
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-error/30 bg-error/5 p-2">
                    {expediente.rechazados.map((archivo, posicion) => (
                      <li key={`${archivo.ruta}-${posicion}`} className="flex items-start gap-2 px-2 py-1 text-sm">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-ink" title={archivo.ruta}>
                            {archivo.ruta}
                          </span>
                          <span className="block text-error">{archivo.motivo}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
