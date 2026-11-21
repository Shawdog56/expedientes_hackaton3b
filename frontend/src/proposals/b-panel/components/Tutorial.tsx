import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EXPEDIENTES_DEMO } from '../../../shared/datosDemo';
import { CURVA_SALIDA, useAnimaciones } from '../../../shared/motion';
import { PASOS_TUTORIAL, type AccionTutorial } from '../../../shared/tutorialPasos';
import type { ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';

const Z_BASE = 2147483000;
const PADDING_SPOTLIGHT = 6;
const INTENTOS_BUSQUEDA_OBJETIVO = 30;
const MARGEN_VENTANA = 16;
const PROPORCION_OBJETIVO_ALTO = 0.6;
const DESPLAZAMIENTO_OBJETIVO_ALTO = 96;
const ANCHO_MOVIL = 640;

export interface TutorialContexto {
  analisisDemo: ExpedienteAnalisis[];
  terminadoDemo: boolean;
  iniciarDemo: (expedientes: typeof EXPEDIENTES_DEMO, velocidad?: number) => void;
}

interface Props {
  activo: boolean;
  contexto: TutorialContexto;
  onTerminar: () => void;
}

interface RectoSimple {
  top: number;
  left: number;
  width: number;
  height: number;
}

function ejecutarAccion(accion: AccionTutorial | undefined, contexto: TutorialContexto) {
  if (!accion) return;
  if (accion.tipo === 'iniciar-analisis-demo') {
    contexto.iniciarDemo(EXPEDIENTES_DEMO, 4);
    return;
  }
  if (accion.tipo === 'seleccionar-expediente') {
    const botones = document.querySelectorAll<HTMLButtonElement>('[data-tour="selector-expedientes"] button');
    botones[accion.indice]?.click();
    return;
  }
  if (accion.tipo === 'abrir-hallazgo-ejemplo') {
    document.querySelector<HTMLButtonElement>('[data-tour="punto-hallazgo"]')?.click();
    return;
  }
  if (accion.tipo === 'cerrar-hallazgo') {
    document.querySelector<HTMLButtonElement>('[data-tour="cerrar-hallazgo"]')?.click();
    return;
  }
  if (accion.tipo === 'abrir-pestana') {
    document.querySelector<HTMLButtonElement>(`[data-tour="tab-${accion.pestana}"]`)?.click();
  }
}

function aPlano(r: DOMRect): RectoSimple {
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Recorte del foco: la intersección del objetivo (+ padding) con la ventana visible, para que el borde nunca quede como una línea suelta cuando el objetivo es más alto que la pantalla. */
function interseccionConVentana(r: RectoSimple): RectoSimple | null {
  const izquierda = Math.max(0, r.left - PADDING_SPOTLIGHT);
  const arriba = Math.max(0, r.top - PADDING_SPOTLIGHT);
  const derecha = Math.min(window.innerWidth, r.left + r.width + PADDING_SPOTLIGHT);
  const abajo = Math.min(window.innerHeight, r.top + r.height + PADDING_SPOTLIGHT);
  const width = derecha - izquierda;
  const height = abajo - arriba;
  if (width <= 0 || height <= 0) return null;
  return { top: arriba, left: izquierda, width, height };
}

/** Tour guiado sobre datos de prueba: oscurece la app, resalta un elemento a la vez y la guía con una tarjeta. */
export function Tutorial({ activo, contexto, onTerminar }: Props) {
  const { reducido } = useAnimaciones();
  const [indice, setIndice] = useState(0);
  const [elementoObjetivo, setElementoObjetivo] = useState<HTMLElement | null>(null);
  const [rectCrudo, setRectCrudo] = useState<RectoSimple | null>(null);
  const [anchoVentana, setAnchoVentana] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const siguienteRef = useRef<HTMLButtonElement>(null);

  const contextoRef = useRef(contexto);
  useEffect(() => {
    contextoRef.current = contexto;
  });

  const paso = PASOS_TUTORIAL[indice];
  const totalPasos = PASOS_TUTORIAL.length;
  const esUltimo = indice === totalPasos - 1;
  // El selector de expedientes solo se vuelve interactivo (y la selección
  // manual solo surte efecto) cuando el lote completo termina; por eso la
  // espera del paso 6 se resuelve con el lote completo, no solo el primero.
  const puedeAvanzar = !paso.esperarPrimerExpedienteListo || contexto.terminadoDemo;

  const rectVisible = rectCrudo ? interseccionConVentana(rectCrudo) : null;
  const objetivoMuyAlto = rectCrudo ? rectCrudo.height > window.innerHeight * PROPORCION_OBJETIVO_ALTO : false;
  const esMovil = anchoVentana < ANCHO_MOVIL;
  // Con un objetivo más alto que la ventana no hay hueco libre arriba ni
  // abajo para anclar la tarjeta: se fija aparte, sin seguir al objetivo.
  const tarjetaFijaAparte = paso.objetivo !== null && objetivoMuyAlto;

  const { refs, floatingStyles } = useFloating({
    open: activo,
    placement: paso.posicion,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(12),
      flip({ fallbackPlacements: ['top', 'right', 'left'] }),
      shift({ padding: MARGEN_VENTANA }),
      size({
        padding: MARGEN_VENTANA,
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.max(240, availableWidth)}px`,
            maxHeight: `${Math.max(160, availableHeight)}px`,
          });
        },
      }),
    ],
    elements: { reference: elementoObjetivo ?? undefined },
  });

  // Guarda la posición de scroll al montar y la restaura al desmontar (al
  // terminar, al omitir, o si el componente se destruye a mitad del
  // recorrido): algunos pasos desplazan la página para revisar objetivos más
  // altos que la ventana, y sin esto la restauración del estado real podría
  // quedar fuera de vista aunque esté correctamente montada.
  useEffect(() => {
    const scrollPrevio = window.scrollY;
    return () => {
      window.scrollTo({ top: scrollPrevio, behavior: 'auto' });
    };
  }, []);

  // Al entrar a un paso: ejecuta su acción y localiza (con reintentos, porque
  // la vista puede tardar unos ms en montarse) el elemento a resaltar. Los
  // pasos sin objetivo (modales centrados) no necesitan buscar nada: el
  // render ya los distingue por `paso.objetivo`.
  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    const pasoActual = PASOS_TUTORIAL[indice];
    ejecutarAccion(pasoActual.accionAlEntrar, contextoRef.current);

    if (!pasoActual.objetivo) return;

    const actualizarRect = (el: HTMLElement) => setRectCrudo(aPlano(el.getBoundingClientRect()));

    const intentar = (restantes: number) => {
      if (cancelado) return;
      const el = document.querySelector<HTMLElement>(pasoActual.objetivo as string);
      if (el) {
        setElementoObjetivo(el);
        const crudo = aPlano(el.getBoundingClientRect());
        setRectCrudo(crudo);

        if (crudo.height > window.innerHeight * PROPORCION_OBJETIVO_ALTO) {
          // El objetivo no cabe entero: deja su inicio cerca del borde
          // superior en vez de centrarlo (que lo cortaría igual). Si ya está
          // ahí arriba (p. ej. un panel con `position: fixed` que cubre el
          // alto completo, como el de hallazgos) no hace falta desplazar la
          // página: no se movería con el scroll de todos modos.
          if (crudo.top > DESPLAZAMIENTO_OBJETIVO_ALTO) {
            const tope = crudo.top + window.scrollY - DESPLAZAMIENTO_OBJETIVO_ALTO;
            window.scrollTo({ top: Math.max(0, tope), behavior: reducido ? 'auto' : 'smooth' });
          }
        } else {
          el.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
        }
        window.setTimeout(() => !cancelado && actualizarRect(el), 350);
        return;
      }
      if (restantes <= 0) {
        setElementoObjetivo(null);
        setRectCrudo(null);
        return;
      }
      window.setTimeout(() => intentar(restantes - 1), 50);
    };
    intentar(INTENTOS_BUSQUEDA_OBJETIVO);

    return () => {
      cancelado = true;
    };
  }, [activo, indice, reducido]);

  // Mantiene el recorte alineado con scroll/resize, sin parpadeos (una sola
  // lectura por frame) ni listeners pasivos bloqueados.
  useEffect(() => {
    if (!elementoObjetivo) return;
    let marco: number | null = null;
    const actualizar = () => {
      marco = null;
      setRectCrudo(aPlano(elementoObjetivo.getBoundingClientRect()));
      setAnchoVentana(window.innerWidth);
    };
    const programar = () => {
      if (marco !== null) return;
      marco = requestAnimationFrame(actualizar);
    };
    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
    return () => {
      window.removeEventListener('scroll', programar);
      window.removeEventListener('resize', programar);
      if (marco !== null) cancelAnimationFrame(marco);
    };
  }, [elementoObjetivo]);

  // El ancho de ventana (para el punto de corte móvil) también se sigue en
  // los pasos sin objetivo o sin recorte todavía.
  useEffect(() => {
    if (!activo) return;
    const actualizar = () => setAnchoVentana(window.innerWidth);
    window.addEventListener('resize', actualizar);
    return () => window.removeEventListener('resize', actualizar);
  }, [activo]);

  const irAPaso = useCallback(
    (nuevoIndice: number) => {
      ejecutarAccion(PASOS_TUTORIAL[indice].accionAlSalir, contextoRef.current);
      setIndice(nuevoIndice);
    },
    [indice],
  );

  const siguiente = useCallback(() => {
    if (!puedeAvanzar) return;
    if (esUltimo) {
      ejecutarAccion(PASOS_TUTORIAL[indice].accionAlSalir, contextoRef.current);
      onTerminar();
      return;
    }
    irAPaso(indice + 1);
  }, [puedeAvanzar, esUltimo, indice, irAPaso, onTerminar]);

  const anterior = useCallback(() => {
    if (indice === 0) return;
    irAPaso(indice - 1);
  }, [indice, irAPaso]);

  const omitir = useCallback(() => {
    ejecutarAccion(PASOS_TUTORIAL[indice].accionAlSalir, contextoRef.current);
    onTerminar();
  }, [indice, onTerminar]);

  // Refs "siempre frescas" para el listener de teclado global, sin tener que
  // reinstalarlo (y sin cerrar sobre un `indice` obsoleto) en cada cambio.
  const siguienteFnRef = useRef(siguiente);
  const anteriorFnRef = useRef(anterior);
  const omitirFnRef = useRef(omitir);
  useEffect(() => {
    siguienteFnRef.current = siguiente;
    anteriorFnRef.current = anterior;
    omitirFnRef.current = omitir;
  });

  useEffect(() => {
    if (!activo) return;

    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        omitirFnRef.current();
        return;
      }
      if (evento.key === 'ArrowRight' || evento.key === 'Enter') {
        evento.preventDefault();
        siguienteFnRef.current();
        return;
      }
      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        anteriorFnRef.current();
        return;
      }
      if (evento.key === 'Tab' && tarjetaRef.current) {
        const focosables = tarjetaRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focosables.length === 0) return;
        const primero = focosables[0];
        const ultimo = focosables[focosables.length - 1];
        if (evento.shiftKey && document.activeElement === primero) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primero.focus();
        }
      }
    };

    document.addEventListener('keydown', manejarTeclado);
    return () => document.removeEventListener('keydown', manejarTeclado);
  }, [activo]);

  // Enfoca "Siguiente" (o la tarjeta, si está deshabilitado) al entrar a cada paso.
  useEffect(() => {
    if (!activo) return;
    if (puedeAvanzar) siguienteRef.current?.focus();
    else tarjetaRef.current?.focus();
  }, [activo, indice, puedeAvanzar]);

  // Bloquea el scroll manual (rueda/táctil) de la app real mientras dura el tutorial.
  // Se adjunta como listener nativo no pasivo: los props onWheel/onTouchMove de
  // React son pasivos por defecto y no permiten preventDefault() de forma confiable.
  useEffect(() => {
    if (!activo) return;
    const bloquear = (evento: WheelEvent | TouchEvent) => evento.preventDefault();
    document.addEventListener('wheel', bloquear, { passive: false });
    document.addEventListener('touchmove', bloquear, { passive: false });
    return () => {
      document.removeEventListener('wheel', bloquear);
      document.removeEventListener('touchmove', bloquear);
    };
  }, [activo]);

  if (!activo) return null;

  const contenidoTarjeta = (
    <>
      <p aria-live="polite" className="sr-only">
        Paso {indice + 1} de {totalPasos}: {paso.titulo}
      </p>
      <h2 id="tutorial-titulo" className="text-[16px] font-bold text-ink">
        {paso.titulo}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{paso.texto}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1" aria-hidden="true">
          {PASOS_TUTORIAL.map((item, i) => (
            <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${i === indice ? 'bg-brand' : 'bg-border'}`} />
          ))}
        </div>
        <span className="text-xs font-medium text-muted">
          {indice + 1} de {totalPasos}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={omitir}
          className="text-xs font-medium text-muted underline underline-offset-2 hover:text-ink"
        >
          Omitir
        </button>
        <div className="flex items-center gap-2">
          {indice > 0 && (
            <button
              type="button"
              onClick={anterior}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg"
            >
              Anterior
            </button>
          )}
          <button
            ref={siguienteRef}
            type="button"
            onClick={siguiente}
            disabled={!puedeAvanzar}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {esUltimo ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  );

  function crearTarjetaAnimada(claseForma: string, estiloExtra?: { maxHeight?: string }) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={paso.id}
          ref={tarjetaRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-titulo"
          style={{ maxHeight: 'calc(100vh - 32px)', ...estiloExtra }}
          initial={reducido ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducido ? { opacity: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className={`overflow-y-auto bg-white p-5 shadow-2xl outline-none ${claseForma}`}
        >
          {contenidoTarjeta}
        </motion.div>
      </AnimatePresence>
    );
  }

  const tarjetaAnimada = crearTarjetaAnimada('w-[340px] max-w-[calc(100vw-32px)] rounded-[14px]');

  return (
    <>
      {/* Bloquea toda interacción con la app real; solo el tutorial responde. */}
      <div
        className="fixed inset-0"
        style={{ zIndex: Z_BASE }}
        onClick={(evento) => evento.preventDefault()}
        onMouseDown={(evento) => evento.preventDefault()}
        aria-hidden="true"
      />

      {!paso.objetivo && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: Z_BASE + 1, background: 'rgba(0,0,0,0.55)' }}
        >
          {tarjetaAnimada}
        </div>
      )}

      {paso.objetivo && rectVisible && (
        <>
          <motion.div
            className="pointer-events-none fixed rounded-lg"
            style={{ zIndex: Z_BASE + 1, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
            animate={{ ...rectVisible }}
            transition={{ duration: 0.3, ease: [...CURVA_SALIDA] }}
          />
          <motion.div
            className="pointer-events-none fixed rounded-lg border-2"
            style={{ zIndex: Z_BASE + 2, borderColor: 'var(--color-brand)' }}
            animate={{
              ...rectVisible,
              opacity: reducido ? 1 : [0.55, 1, 0.55],
            }}
            transition={
              reducido
                ? { duration: 0.3 }
                : {
                    top: { duration: 0.3, ease: [...CURVA_SALIDA] },
                    left: { duration: 0.3, ease: [...CURVA_SALIDA] },
                    width: { duration: 0.3, ease: [...CURVA_SALIDA] },
                    height: { duration: 0.3, ease: [...CURVA_SALIDA] },
                    opacity: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          />

          {tarjetaFijaAparte ? (
            <div
              className="fixed"
              style={
                esMovil
                  ? { zIndex: Z_BASE + 3, left: 0, right: 0, bottom: 0 }
                  : { zIndex: Z_BASE + 3, right: 24, bottom: 24 }
              }
            >
              {esMovil
                ? crearTarjetaAnimada('w-full rounded-t-[14px]', { maxHeight: '70vh' })
                : crearTarjetaAnimada('w-[340px] max-w-[calc(100vw-48px)] rounded-[14px]')}
            </div>
          ) : (
            <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: Z_BASE + 3 }}>
              {tarjetaAnimada}
            </div>
          )}
        </>
      )}
    </>
  );
}
