"""Reparto de trabajo entre recursos que solo atienden una petición a la vez.

Se usa para las instancias del modelo de lenguaje: cada petición toma una instancia libre,
la usa y la devuelve. Si todas están ocupadas, espera en orden de llegada. Con dos instancias,
nunca hay más de dos peticiones al modelo al mismo tiempo y ninguna instancia recibe dos a la vez.
"""

import asyncio
import weakref
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from typing import Generic, TypeVar

T = TypeVar("T")


class PoolDeRecursos(Generic[T]):
    def __init__(self, recursos: Sequence[T]):
        if not recursos:
            raise ValueError("El pool necesita al menos un recurso")
        self._recursos = list(recursos)
        # Una cola por bucle de eventos: una cola de asyncio no se puede compartir entre bucles.
        self._colas: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Queue[T]] = (
            weakref.WeakKeyDictionary()
        )

    @property
    def capacidad(self) -> int:
        return len(self._recursos)

    def _cola(self) -> asyncio.Queue[T]:
        bucle = asyncio.get_running_loop()
        cola = self._colas.get(bucle)
        if cola is None:
            cola = asyncio.Queue()
            for recurso in self._recursos:
                cola.put_nowait(recurso)
            self._colas[bucle] = cola
        return cola

    def libres(self) -> int:
        """Recursos libres en el bucle actual (para pruebas y métricas)."""
        return self._cola().qsize()

    @asynccontextmanager
    async def usar(self) -> AsyncIterator[T]:
        """Toma un recurso libre (o espera uno) y lo devuelve al salir, aunque haya error."""
        cola = self._cola()
        recurso = await cola.get()
        try:
            yield recurso
        finally:
            cola.put_nowait(recurso)
