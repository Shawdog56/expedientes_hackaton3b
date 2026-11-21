import type { Placement } from '@floating-ui/react';

export type PosicionTutorial = Placement;

export type AccionTutorial =
  | { tipo: 'iniciar-analisis-demo' }
  | { tipo: 'seleccionar-expediente'; indice: number }
  | { tipo: 'abrir-hallazgo-ejemplo' }
  | { tipo: 'cerrar-hallazgo' }
  | { tipo: 'abrir-pestana'; pestana: 'legal' | 'competencia' };

export interface PasoTutorial {
  id: string;
  /** Selector `[data-tour="..."]`, o `null` si el paso es un modal centrado. */
  objetivo: string | null;
  titulo: string;
  texto: string;
  posicion: PosicionTutorial;
  accionAlEntrar?: AccionTutorial;
  accionAlSalir?: AccionTutorial;
  /**
   * Si es true, "Siguiente" se deshabilita hasta que termine el lote de
   * prueba completo (el selector de expedientes solo se vuelve interactivo,
   * y permite fijar el expediente 0, cuando el lote entero termina).
   */
  esperarPrimerExpedienteListo?: boolean;
}

export const PASOS_TUTORIAL: PasoTutorial[] = [
  {
    id: 'bienvenida',
    objetivo: null,
    titulo: 'Bienvenido a Revisión de Expedientes',
    texto:
      'Revisión de Expedientes analiza la documentación legal de un inmueble con varios agentes y te da una recomendación inicial con evidencia.',
    posicion: 'bottom',
  },
  {
    id: 'zona-carga',
    objetivo: '[data-tour="zona-carga"]',
    titulo: 'Carga un expediente',
    texto: 'Carga un expediente: una carpeta, un .zip o varios PDF sueltos.',
    posicion: 'right',
  },
  {
    id: 'bandeja',
    objetivo: '[data-tour="bandeja-expedientes"]',
    titulo: 'Bandeja de expedientes',
    texto: 'Cada expediente aparece aquí. Despliégalo para ver sus archivos o quítalo si te equivocaste.',
    posicion: 'top',
  },
  {
    id: 'boton-analizar',
    objetivo: '[data-tour="boton-analizar"]',
    titulo: 'Analiza el lote',
    texto: 'Cuando estés listo, analiza todos los expedientes de una vez.',
    posicion: 'top',
  },
  {
    id: 'barra-etapas',
    objetivo: '[data-tour="barra-etapas"]',
    titulo: 'Los agentes en acción',
    texto:
      'Los agentes trabajan en orden: clasifican, extraen datos, validan reglas, comparan documentos y emiten el dictamen.',
    posicion: 'bottom',
    accionAlEntrar: { tipo: 'iniciar-analisis-demo' },
  },
  {
    id: 'tarjetas-documentos',
    objetivo: '[data-tour="tarjetas-documentos"]',
    titulo: 'Un documento a la vez',
    texto: 'Cada documento se revisa contra su guía. El anillo muestra el avance y el resultado.',
    posicion: 'bottom',
    esperarPrimerExpedienteListo: true,
  },
  {
    id: 'recomendacion-inicial',
    objetivo: '[data-tour="recomendacion-inicial"]',
    titulo: 'Recomendación inicial',
    texto: 'La recomendación (Cumple, Requiere revisión o No cumple), la razón, los documentos recibidos y la confianza del análisis.',
    posicion: 'bottom',
    accionAlEntrar: { tipo: 'seleccionar-expediente', indice: 0 },
  },
  {
    id: 'punto-hallazgo',
    objetivo: '[data-tour="punto-hallazgo"]',
    titulo: 'Puntos con hallazgo',
    texto: 'Los puntos marcados en ámbar necesitan atención. Pulsa uno para ver la evidencia.',
    posicion: 'right',
  },
  {
    id: 'panel-hallazgo',
    objetivo: '[data-tour="panel-hallazgo"]',
    titulo: 'Evidencia del hallazgo',
    texto: 'Aquí ves el valor que encontró cada documento, la página y el fragmento original.',
    posicion: 'left',
    accionAlEntrar: { tipo: 'abrir-hallazgo-ejemplo' },
    accionAlSalir: { tipo: 'cerrar-hallazgo' },
  },
  {
    id: 'selector-expedientes',
    objetivo: '[data-tour="selector-expedientes"]',
    titulo: 'Varios expedientes, un lote',
    texto: 'Si falta un documento, el sistema lo marca y pide revisión: nunca descarta el expediente por eso.',
    posicion: 'bottom',
    accionAlEntrar: { tipo: 'seleccionar-expediente', indice: 1 },
  },
  {
    id: 'tab-competencia',
    objetivo: '[data-tour="tab-competencia"]',
    titulo: 'Zona y competencia',
    texto: 'Contexto comercial: tiendas de autoservicio cerca del inmueble. No influye en el dictamen.',
    posicion: 'bottom',
    accionAlEntrar: { tipo: 'abrir-pestana', pestana: 'competencia' },
  },
  {
    id: 'cierre',
    objetivo: '[data-tour="boton-analizar-otro-lote"]',
    titulo: 'Listo para empezar',
    texto: 'Empieza un nuevo lote con este botón, o vuelve al inicio con el logo. Puedes repetir el tutorial cuando quieras.',
    posicion: 'bottom-start',
  },
];
