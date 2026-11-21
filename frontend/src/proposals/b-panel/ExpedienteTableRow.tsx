import { ChevronRight, FileArchive, Files, Folder, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useAnimaciones } from '../../shared/motion';
import type { Expediente } from '../../shared/types/expediente';
import { formatBytes } from '../../shared/utils/formatBytes';

interface Props {
  expediente: Expediente;
  indice: number;
  onQuitar: (id: string) => void;
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

export function ExpedienteTableRow({ expediente, indice, onQuitar }: Props) {
  const { reducido } = useAnimaciones();
  const [abierto, setAbierto] = useState(false);
  const esZip = expediente.origen === 'zip';
  const pdfs = expediente.archivos.filter((archivo) => archivo.nombre.toLowerCase().endsWith('.pdf'));
  const Icono = ICONO_ORIGEN[expediente.origen];

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
        <td className="px-4 py-3 text-muted">{esZip ? '—' : expediente.archivos.length}</td>
        <td className="whitespace-nowrap px-4 py-3 text-muted">{formatBytes(expediente.tamanoTotal)}</td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            {!esZip && (
              <button
                type="button"
                onClick={() => setAbierto((valor) => !valor)}
                aria-expanded={abierto}
                aria-label={
                  abierto ? `Colapsar archivos de ${expediente.nombre}` : `Expandir archivos de ${expediente.nombre}`
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-ink"
              >
                <motion.span
                  className="flex"
                  animate={{ rotate: abierto ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </motion.span>
              </button>
            )}
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
        {abierto && !esZip && (
          <motion.tr
            initial={reducido ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <td colSpan={5} className="border-t border-border bg-bg px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {pdfs.length === 0 ? (
                  <span className="text-xs text-muted">No se encontraron PDF en este expediente.</span>
                ) : (
                  pdfs.map((archivo) => (
                    <span
                      key={archivo.ruta}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
                    >
                      {archivo.nombre}
                    </span>
                  ))
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
