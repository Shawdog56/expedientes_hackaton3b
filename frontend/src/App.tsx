import { motion, useReducedMotion } from 'motion/react';
import { Login } from './pages/Login';
import { PanelApp } from './proposals/b-panel/PanelApp';
import { useSesion } from './shared/useSesion';

function App() {
  const { sesionIniciada, usuario, iniciarSesion, cerrarSesion } = useSesion();
  const prefiereReducido = useReducedMotion();

  if (!sesionIniciada || !usuario) {
    return <Login onIniciarSesion={iniciarSesion} />;
  }

  return (
    <motion.div
      initial={prefiereReducido ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <PanelApp usuario={usuario} onCerrarSesion={cerrarSesion} />
    </motion.div>
  );
}

export default App;
