import { useState } from 'react';
import type { Expediente } from '../types/expediente';

export function useExpedientes() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const agregarExpedientes = (nuevos: Expediente[]) => {
    setAviso(null);
    setExpedientes((actuales) => [...actuales, ...nuevos]);
  };

  const quitarExpediente = (id: string) => {
    setExpedientes((actuales) => actuales.filter((expediente) => expediente.id !== id));
  };

  const analizarExpedientes = () => {
    setAviso(null);
    setAnalizando(true);
    setTimeout(() => {
      setAnalizando(false);
      setAviso('Análisis disponible próximamente');
    }, 2000);
  };

  return {
    expedientes,
    analizando,
    aviso,
    agregarExpedientes,
    quitarExpediente,
    analizarExpedientes,
  };
}
