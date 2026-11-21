"""Errores del módulo de seguridad. Ningún mensaje incluye datos sensibles."""


class ErrorSeguridad(Exception):
    """Base de los errores de seguridad."""


class ConfiguracionSeguridadError(ErrorSeguridad):
    """Falta o es inválida una clave o variable de configuración."""


class DescifradoError(ErrorSeguridad):
    """El dato cifrado está alterado, usa otro contexto o su clave no existe."""


class TokenInvalido(ErrorSeguridad):
    """El token no es válido: firma, claims, expiración, audiencia o cifrado."""
