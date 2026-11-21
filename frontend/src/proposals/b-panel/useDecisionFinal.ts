import { useState } from 'react';
import { decidirExpediente } from '../../api/expedientes';
import type { DecisionFinal } from '../../shared/types/expediente';

export interface EstadoDecision {
  decision: DecisionFinal | null;
  /** Fecha en que el servidor registró la decisión. */
  decididoEn: string | null;
  guardando: boolean;
  error: string | null;
}

const SIN_DECISION: EstadoDecision = { decision: null, decididoEn: null, guardando: false, error: null };

/** Decisión final de la persona que revisa, por expediente del lote; se guarda en el servidor. */
export function useDecisionFinal() {
  const [porExpediente, setPorExpediente] = useState<Record<string, EstadoDecision>>({});

  const actualizar = (expedienteId: string, cambios: Partial<EstadoDecision>) => {
    setPorExpediente((actuales) => ({
      ...actuales,
      [expedienteId]: { ...(actuales[expedienteId] ?? SIN_DECISION), ...cambios },
    }));
  };

  const decidir = async (expedienteId: string, idServidor: string | undefined, decision: DecisionFinal) => {
    if (!idServidor) {
      actualizar(expedienteId, { error: 'El expediente no se guardó en el servidor; no se puede registrar la decisión.' });
      return;
    }
    actualizar(expedienteId, { guardando: true, error: null });
    try {
      const resultado = await decidirExpediente(idServidor, decision);
      actualizar(expedienteId, {
        guardando: false,
        decision: resultado.decision_final,
        decididoEn: resultado.decidido_en,
      });
    } catch (error) {
      actualizar(expedienteId, {
        guardando: false,
        error: error instanceof Error ? error.message : 'No se pudo registrar la decisión',
      });
    }
  };

  return { porExpediente, decidir, sinDecision: SIN_DECISION };
}
