"""Dominio neutro: enums y constantes compartidas.

Regla de oro: este paquete no importa nada de `app`. Todas las demás capas
(agentes, base de datos, servicios, esquemas, API) pueden depender de él y
ninguna depende de las demás por este motivo.
"""
