import 'react';

// `webkitdirectory` y `webkitRelativePath` no forman parte de los tipos
// estándar del DOM, pero son soportados por los navegadores basados en
// Chromium/WebKit y son necesarios para el selector de carpetas.
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

declare global {
  interface File {
    readonly webkitRelativePath: string;
  }
}
