import { useCallback, useState } from 'react';

export interface Usuario {
  email: string;
}

const CLAVE_SESION = '3b-sesion';
const DURACION_SIMULADA_MS = 800;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SesionGuardada {
  email: string;
}

function leerSesionGuardada(): SesionGuardada | null {
  try {
    const local = window.localStorage.getItem(CLAVE_SESION);
    if (local) return JSON.parse(local) as SesionGuardada;
  } catch {
    // almacenamiento no disponible; seguimos sin sesión recordada
  }
  try {
    const sesion = window.sessionStorage.getItem(CLAVE_SESION);
    if (sesion) return JSON.parse(sesion) as SesionGuardada;
  } catch {
    // ídem
  }
  return null;
}

function guardarSesion(email: string, recordar: boolean) {
  // Nunca se guarda la contraseña, solo el correo.
  const payload = JSON.stringify({ email });
  try {
    if (recordar) {
      window.localStorage.setItem(CLAVE_SESION, payload);
      window.sessionStorage.removeItem(CLAVE_SESION);
    } else {
      window.sessionStorage.setItem(CLAVE_SESION, payload);
      window.localStorage.removeItem(CLAVE_SESION);
    }
  } catch {
    // Si el almacenamiento falla, la sesión sigue viva solo en memoria.
  }
}

function borrarSesionGuardada() {
  try {
    window.localStorage.removeItem(CLAVE_SESION);
  } catch {
    // ignorar
  }
  try {
    window.sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    // ignorar
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Sesión simulada: sin backend, valida formato de correo/contraseña y
 * persiste solo el correo (nunca la contraseña) en local o sessionStorage.
 */
export function useSesion() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const guardada = leerSesionGuardada();
    return guardada ? { email: guardada.email } : null;
  });

  const iniciarSesion = useCallback(
    async (email: string, password: string, recordar: boolean): Promise<string | null> => {
      await esperar(DURACION_SIMULADA_MS);

      const correo = email.trim();
      if (!REGEX_CORREO.test(correo)) {
        return 'Escribe un correo válido.';
      }
      if (password.length < 6) {
        return 'La contraseña debe tener al menos 6 caracteres.';
      }

      guardarSesion(correo, recordar);
      setUsuario({ email: correo });
      return null;
    },
    [],
  );

  const cerrarSesion = useCallback(() => {
    borrarSesionGuardada();
    setUsuario(null);
  }, []);

  return {
    sesionIniciada: usuario !== null,
    usuario,
    iniciarSesion,
    cerrarSesion,
  };
}
