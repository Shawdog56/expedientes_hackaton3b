import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Spinner } from '../components/Spinner';
import { CampoTexto } from '../components/login/CampoTexto';
import { PanelMarca } from '../components/login/PanelMarca';

interface Props {
  onIniciarSesion: (email: string, password: string, recordar: boolean) => Promise<string | null>;
}

const VARIANTES_CAMPO = {
  oculto: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export function Login({ onIniciarSesion }: Props) {
  const prefiereReducido = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [campoEnfocado, setCampoEnfocado] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intentoFallido, setIntentoFallido] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const manejarEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnviando(true);
    const mensaje = await onIniciarSesion(email, password, recordar);
    setEnviando(false);
    if (mensaje) {
      setError(mensaje);
      setIntentoFallido((n) => n + 1);
    }
  };

  return (
    <div className="flex h-screen">
      <PanelMarca />

      <div className="flex w-full items-center justify-center bg-surface px-6 md:w-1/2">
        <motion.div
          initial={prefiereReducido ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: prefiereReducido ? 0 : 0.3 }}
          className="w-full max-w-[360px]"
        >
          <motion.div
            key={intentoFallido}
            animate={intentoFallido > 0 && !prefiereReducido ? { x: [0, -8, 7, -5, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-[20px] font-semibold text-ink">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted">Ingresa tus credenciales para continuar.</p>

            <form onSubmit={manejarEnviar} className="mt-6 space-y-4" noValidate>
              <motion.div
                initial={prefiereReducido ? undefined : 'oculto'}
                animate="visible"
                variants={VARIANTES_CAMPO}
                transition={{ duration: 0.3, delay: prefiereReducido ? 0 : 0.35 }}
              >
                <CampoTexto
                  id="login-email"
                  etiqueta="Correo electrónico"
                  icono={<Mail size={17} aria-hidden="true" />}
                  enfocado={campoEnfocado === 'email'}
                  onEnfocar={() => setCampoEnfocado('email')}
                  onDesenfocar={() => setCampoEnfocado(null)}
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@tiendas3b.mx"
                  value={email}
                  onChange={(evento) => {
                    setEmail(evento.target.value);
                    setError(null);
                  }}
                />
              </motion.div>

              <motion.div
                initial={prefiereReducido ? undefined : 'oculto'}
                animate="visible"
                variants={VARIANTES_CAMPO}
                transition={{ duration: 0.3, delay: prefiereReducido ? 0 : 0.42 }}
              >
                <CampoTexto
                  id="login-password"
                  etiqueta="Contraseña"
                  icono={<Lock size={17} aria-hidden="true" />}
                  enfocado={campoEnfocado === 'password'}
                  onEnfocar={() => setCampoEnfocado('password')}
                  onDesenfocar={() => setCampoEnfocado(null)}
                  type={mostrarPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(evento) => {
                    setPassword(evento.target.value);
                    setError(null);
                  }}
                  derecha={
                    <button
                      type="button"
                      onClick={() => setMostrarPassword((valor) => !valor)}
                      aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-ink"
                    >
                      <motion.span
                        key={mostrarPassword ? 'abierto' : 'cerrado'}
                        initial={prefiereReducido ? undefined : { opacity: 0.6, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className="flex"
                      >
                        {mostrarPassword ? (
                          <EyeOff size={17} aria-hidden="true" />
                        ) : (
                          <Eye size={17} aria-hidden="true" />
                        )}
                      </motion.span>
                    </button>
                  }
                />
              </motion.div>

              <motion.div
                initial={prefiereReducido ? undefined : 'oculto'}
                animate="visible"
                variants={VARIANTES_CAMPO}
                transition={{ duration: 0.3, delay: prefiereReducido ? 0 : 0.49 }}
                className="flex items-center justify-between"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={recordar}
                    onChange={(evento) => setRecordar(evento.target.checked)}
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded border transition-colors ${
                      recordar ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                    }`}
                  >
                    <svg viewBox="0 0 16 16" className="h-[11px] w-[11px]">
                      <motion.path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ pathLength: recordar ? 1 : 0, opacity: recordar ? 1 : 0 }}
                        transition={{ duration: prefiereReducido ? 0 : 0.2 }}
                      />
                    </svg>
                  </span>
                  Mantener sesión iniciada
                </label>
              </motion.div>

              {error && (
                <p role="alert" className="text-[12px] text-error">
                  {error}
                </p>
              )}

              <motion.div
                initial={prefiereReducido ? undefined : 'oculto'}
                animate="visible"
                variants={VARIANTES_CAMPO}
                transition={{ duration: 0.3, delay: prefiereReducido ? 0 : 0.56 }}
              >
                <motion.button
                  type="submit"
                  disabled={enviando}
                  whileHover={prefiereReducido || enviando ? undefined : { scale: 1.02 }}
                  whileTap={prefiereReducido || enviando ? undefined : { scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand py-3 font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {enviando ? (
                    <>
                      <Spinner className="h-5 w-5" />
                      Ingresando…
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </motion.button>
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
