import { ChevronRight, Eye, FileX } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useAnimaciones } from '../../../shared/motion';
import type { DocumentoAnalisis, EstadoRegla } from '../../../shared/useSimulatedAnalysis';
import { REGLAS_VALIDACION } from '../../../shared/validationRules';
import { EstadoIcono } from './EstadoIcono';
import type { SeleccionHallazgo } from './FindingDrawer';
import { ProgressRing, type EstadoAnillo } from './ProgressRing';

interface Props {
  documento: DocumentoAnalisis;
  enValidacion: boolean;
  interactivo: boolean;
  onAbrirPunto: (seleccion: SeleccionHallazgo) => void;
  onVerArchivos?: () => void;
}

const FLASH_HALLAZGO = { backgroundColor: ['rgba(217,119,6,0)', 'rgba(217,119,6,0.3)', 'rgba(217,119,6,0)'] };

const VARIANTES_CONTENIDO_FILA: Variants = {
  reposo: { x: 0 },
  hover: { x: 2 },
};

const VARIANTES_CHEVRON_FILA: Variants = {
  reposo: { x: 0 },
  hover: { x: 4 },
};

interface FilaReglaProps {
  regla: EstadoRegla;
  interactivo: boolean;
  dataTour?: string;
  onAbrir: () => void;
}

/** Fila de un punto de validación: se encarga de su propio flash ámbar, único, cuando pasa a tener un hallazgo. */
function FilaRegla({ regla, interactivo, dataTour, onAbrir }: FilaReglaProps) {
  const { reducido } = useAnimaciones();
  const anteriorRef = useRef(regla.estado);
  const [flasheando, setFlasheando] = useState(false);

  useEffect(() => {
    const esHallazgoAhora = regla.estado === 'revisar' || regla.estado === 'no_cumple';
    const eraHallazgoAntes = anteriorRef.current === 'revisar' || anteriorRef.current === 'no_cumple';
    anteriorRef.current = regla.estado;
    if (esHallazgoAhora && !eraHallazgoAntes && !reducido) {
      setFlasheando(true);
      const id = setTimeout(() => setFlasheando(false), 700);
      return () => clearTimeout(id);
    }
  }, [regla.estado, reducido]);

  const fondoHallazgo = regla.estado === 'revisar' ? 'bg-warn/10' : regla.estado === 'no_cumple' ? 'bg-error/10' : '';

  if (!interactivo) {
    return (
      <motion.li
        className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${fondoHallazgo}`}
        animate={flasheando ? FLASH_HALLAZGO : undefined}
        transition={{ duration: 0.7 }}
      >
        <EstadoIcono estado={regla.estado} className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="text-ink">{regla.etiqueta}</span>
      </motion.li>
    );
  }

  const colorHover =
    regla.estado === 'revisar'
      ? 'rgba(232,163,23,0.2)'
      : regla.estado === 'no_cumple'
        ? 'rgba(198,40,40,0.18)'
        : '#F5F5F5';

  const variantesFila: Variants = {
    reposo: { backgroundColor: 'rgba(0,0,0,0)' },
    hover: { backgroundColor: colorHover },
  };

  return (
    <li>
      <motion.button
        type="button"
        data-tour={dataTour}
        onClick={onAbrir}
        initial="reposo"
        whileHover="hover"
        whileFocus="hover"
        whileTap={reducido ? undefined : { scale: 0.99 }}
        variants={variantesFila}
        animate={flasheando ? FLASH_HALLAZGO : undefined}
        transition={{ duration: 0.15 }}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand ${fondoHallazgo}`}
      >
        <motion.span
          className="flex flex-1 items-start gap-2"
          variants={reducido ? undefined : VARIANTES_CONTENIDO_FILA}
        >
          <EstadoIcono estado={regla.estado} className="mt-0.5 h-4 w-4 shrink-0 self-start" />
          <span className="flex-1 text-ink">{regla.etiqueta}</span>
        </motion.span>
        <motion.span variants={reducido ? undefined : VARIANTES_CHEVRON_FILA}>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </motion.span>
      </motion.button>
    </li>
  );
}

export function DocumentCard({ documento, enValidacion, interactivo, onAbrirPunto, onVerArchivos }: Props) {
  const Icono = REGLAS_VALIDACION.find((tipo) => tipo.id === documento.tipoId)?.Icono;

  if (documento.faltante) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-[#FAFAFA] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {Icono && <Icono className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />}
            <div className="min-w-0">
              <p className="font-medium text-ink">{documento.nombre}</p>
              <p className="text-xs text-muted">No se encontró en el expediente</p>
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg">
            <FileX className="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
        </div>
        <ul className="space-y-1">
          {documento.reglas.map((regla) => (
            <li key={regla.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-muted">
              <EstadoIcono estado="pendiente" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{regla.etiqueta}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const total = documento.reglas.length;
  const resueltos = documento.reglas.filter(
    (regla) => regla.estado !== 'pendiente' && regla.estado !== 'validando',
  ).length;
  const porRevisar = documento.reglas.filter((regla) => regla.estado === 'revisar').length;
  const hayNoCumple = documento.reglas.some((regla) => regla.estado === 'no_cumple');
  const todoPendiente = documento.reglas.every((regla) => regla.estado === 'pendiente');

  let estadoAnillo: EstadoAnillo;
  let etiquetaAnillo: string;
  if (todoPendiente) {
    estadoAnillo = 'en_espera';
    etiquetaAnillo = 'En espera de validación';
  } else if (resueltos < total) {
    estadoAnillo = 'validando';
    etiquetaAnillo = `Validando, ${resueltos} de ${total}`;
  } else if (hayNoCumple) {
    estadoAnillo = 'no_cumple';
    etiquetaAnillo = `Completo, no cumple (${total} de ${total})`;
  } else if (porRevisar > 0) {
    estadoAnillo = 'revisar';
    etiquetaAnillo = `Completo, ${porRevisar} de ${total} requieren revisión`;
  } else {
    estadoAnillo = 'completo';
    etiquetaAnillo = `Completo, ${total} de ${total} verificados`;
  }

  const bordeClase = enValidacion
    ? 'border-2 border-brand'
    : porRevisar > 0
      ? 'border border-warn/50'
      : 'border border-border';

  return (
    <div className={`flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm ${bordeClase}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {Icono && <Icono className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />}
          <div className="min-w-0">
            <p className="font-medium text-ink">{documento.nombre}</p>
            <p className="truncate text-xs text-muted" title={documento.archivo ?? undefined}>
              {documento.archivo}
            </p>
            {onVerArchivos && documento.archivos.length > 0 && (
              <button
                type="button"
                onClick={onVerArchivos}
                className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:bg-bg"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />
                {documento.archivos.length === 1 ? 'Ver archivo' : `Ver archivos (${documento.archivos.length})`}
              </button>
            )}
          </div>
        </div>
        <ProgressRing estado={estadoAnillo} resueltos={resueltos} total={total} etiqueta={etiquetaAnillo} />
      </div>
      <ul className="space-y-1">
        {documento.reglas.map((regla) => (
          <FilaRegla
            key={regla.id}
            regla={regla}
            interactivo={interactivo}
            dataTour={documento.tipoId === 'predial' && regla.id === 'superficie_registrada' ? 'punto-hallazgo' : undefined}
            onAbrir={() =>
              onAbrirPunto({
                tipoId: documento.tipoId,
                reglaId: regla.id,
                reglaEtiqueta: regla.etiqueta,
                estado: regla.estado,
                documentoNombre: documento.nombre,
                documentoArchivo: documento.archivo ?? documento.nombre,
                detalle: regla.detalle,
              })
            }
          />
        ))}
      </ul>
    </div>
  );
}
