import { Bot, CircleCheck } from 'lucide-react';

export type EstadoAgentes = 'listo' | 'analizando' | 'completo';

interface Props {
  estado: EstadoAgentes;
  expedienteActual: number;
  totalExpedientes: number;
}

export function PildoraEstado({ estado, expedienteActual, totalExpedientes }: Props) {
  const texto =
    estado === 'analizando'
      ? `Analizando expediente ${expedienteActual} de ${totalExpedientes}`
      : estado === 'completo'
        ? 'Análisis completo'
        : '5 agentes listos';

  return (
    <div className="flex items-center gap-2 rounded-full border border-[#444] px-3 py-1.5 text-xs font-medium text-[#BDBDBD]">
      {estado === 'completo' ? (
        <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
      ) : (
        <Bot
          className={`h-4 w-4 shrink-0 ${estado === 'analizando' ? 'animate-spin motion-reduce:animate-none' : ''}`}
          aria-hidden="true"
        />
      )}
      <span>{texto}</span>
    </div>
  );
}
