import { AlertCircle, UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useAnimaciones } from '../../shared/motion';
import type { Expediente } from '../../shared/types/expediente';
import { useExpedienteUpload } from './useExpedienteUpload';

interface Props {
  expedientesActuales: Expediente[];
  onExpedientesCargados: (expedientes: Expediente[]) => void;
}

export function PanelUploadZone({ expedientesActuales, onExpedientesCargados }: Props) {
  const { reducido } = useAnimaciones();
  const zonaRef = useRef<HTMLDivElement>(null);
  const [sobreZona, setSobreZona] = useState(false);
  const {
    arrastrando,
    error,
    inputArchivosRef,
    inputCarpetaRef,
    abrirSelectorArchivos,
    abrirSelectorCarpeta,
    handleDropzoneKeyDown,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleArchivosSeleccionados,
    handleCarpetaSeleccionada,
  } = useExpedienteUpload(expedientesActuales, onExpedientesCargados);

  const manejarMovimientoPuntero = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (reducido || !zonaRef.current) return;
    const rect = zonaRef.current.getBoundingClientRect();
    zonaRef.current.style.setProperty('--x', `${evento.clientX - rect.left}px`);
    zonaRef.current.style.setProperty('--y', `${evento.clientY - rect.top}px`);
  };

  const activa = arrastrando || sobreZona;

  return (
    <div>
      <motion.div
        ref={zonaRef}
        data-tour="zona-carga"
        role="button"
        tabIndex={0}
        aria-label="Zona para cargar el expediente. Arrastra una carpeta o archivos PDF o ZIP, o presiona para seleccionar archivos."
        onClick={abrirSelectorArchivos}
        onKeyDown={handleDropzoneKeyDown}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPointerEnter={() => setSobreZona(true)}
        onPointerLeave={() => setSobreZona(false)}
        onPointerMove={manejarMovimientoPuntero}
        animate={{ scale: !reducido && activa ? 1.01 : 1 }}
        transition={{ duration: 0.2 }}
        className={`zona-carga relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors duration-200 ${
          arrastrando ? 'border-brand bg-brand-soft' : sobreZona ? 'border-brand bg-brand-soft' : 'border-border bg-bg'
        }`}
      >
        <motion.span
          className="relative flex"
          animate={
            !reducido && arrastrando ? { y: [0, -3, 0] } : !reducido && sobreZona ? { y: -4 } : { y: 0 }
          }
          transition={
            !reducido && arrastrando
              ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        >
          <UploadCloud className={activa ? 'h-8 w-8 text-brand' : 'h-8 w-8 text-muted'} aria-hidden="true" />
        </motion.span>
        <p className="relative text-sm font-medium text-ink">Arrastra una carpeta o archivos</p>
        <p className="relative text-xs text-muted">PDF o .zip · también puedes hacer clic</p>

        <input
          ref={inputArchivosRef}
          type="file"
          accept=".pdf,.zip"
          multiple
          className="hidden"
          onChange={handleArchivosSeleccionados}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={inputCarpetaRef}
          type="file"
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={handleCarpetaSeleccionada}
          aria-hidden="true"
          tabIndex={-1}
        />
      </motion.div>

      <button
        type="button"
        onClick={abrirSelectorCarpeta}
        className="enlace-subrayado mt-2 w-full text-center text-xs font-medium text-brand"
      >
        o selecciona una carpeta
      </button>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
