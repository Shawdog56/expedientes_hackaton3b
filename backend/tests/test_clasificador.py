"""Script de prueba para ClasificadorAgent.

Permite clasificar documentos inmobiliarios en formato .txt de forma individual
o en lote (procesando todos los archivos .txt de una carpeta). Devuelve la
clasificación, nivel de confianza calibrada, resumen, evidencia textual y todos
los campos estructurados extraídos.

Uso individual:
    python tests/test_clasificador.py text.txt
    python tests/test_clasificador.py predial_ejemplo.txt
    python tests/test_clasificador.py text.txt --mock

Uso por carpeta / lote:
    python tests/test_clasificador.py samples
    python tests/test_clasificador.py tests/samples
    python tests/test_clasificador.py --dir ruta/a/carpeta
    python tests/test_clasificador.py samples --mock
    python tests/test_clasificador.py samples --summary-only
    python tests/test_clasificador.py samples --json

En Docker:
    docker compose exec backend python tests/test_clasificador.py samples
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 1. Configurar sys.path para importar app.* sin importar dónde se ejecute
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent if SCRIPT_DIR.name in ("tests", "backend") else SCRIPT_DIR

POSIBLES_BACKEND = [
    REPO_ROOT / "backend",
    SCRIPT_DIR.parent / "backend",
    SCRIPT_DIR.parent,
    SCRIPT_DIR,
    Path.cwd() / "backend",
    Path.cwd(),
]

backend_path = None
for p in POSIBLES_BACKEND:
    if (p / "app" / "agents" / "clasificador.py").is_file():
        backend_path = p
        if str(p) not in sys.path:
            sys.path.insert(0, str(p))
        break


# ---------------------------------------------------------------------------
# 2. Búsqueda inteligente de archivos y carpetas
# ---------------------------------------------------------------------------
def _directorios_base_busqueda() -> list[Path]:
    return [
        Path.cwd(),
        SCRIPT_DIR,
        SCRIPT_DIR / "samples",
        REPO_ROOT,
        REPO_ROOT / "tests",
        REPO_ROOT / "tests" / "samples",
        REPO_ROOT / "backend",
        REPO_ROOT / "backend" / "tests",
        REPO_ROOT / "backend" / "tests" / "samples",
        REPO_ROOT.parent,  # Directorio raíz del workspace (Tiendas3B)
    ]


def resolver_objetivo(nombre_o_ruta: str) -> tuple[Path, str]:
    """Determina si la entrada es un archivo .txt o una carpeta existente.

    Retorna:
        (Path_resuelto, "file" | "dir")
    """
    p = Path(nombre_o_ruta)

    # 1. Si es ruta directa existente
    if p.is_dir():
        return p.resolve(), "dir"
    if p.is_file():
        return p.resolve(), "file"

    # 2. Si es archivo sin extensión .txt
    if not p.suffix and Path(f"{nombre_o_ruta}.txt").is_file():
        return Path(f"{nombre_o_ruta}.txt").resolve(), "file"

    # 3. Buscar en directorios conocidos
    directorios = _directorios_base_busqueda()

    # Probar como carpeta en los directorios conocidos
    for d in directorios:
        candidato_dir = (d / nombre_o_ruta).resolve()
        if candidato_dir.is_dir():
            return candidato_dir, "dir"

    # Probar como archivo en los directorios conocidos
    nombres_archivo = [nombre_o_ruta]
    if not nombre_o_ruta.endswith(".txt"):
        nombres_archivo.append(f"{nombre_o_ruta}.txt")

    for d in directorios:
        for n in nombres_archivo:
            candidato_file = (d / n).resolve()
            if candidato_file.is_file():
                return candidato_file, "file"

    # Recolectar sugerencias si no se encontró
    txt_encontrados: list[str] = []
    carpetas_encontradas: list[str] = []
    for d in directorios:
        if d.is_dir():
            for item in d.iterdir():
                if item.is_file() and item.suffix.lower() == ".txt" and item.name != "requirements.txt":
                    if item.name not in txt_encontrados:
                        txt_encontrados.append(item.name)
                elif item.is_dir() and item.name in ("samples", "tests", "fixtures", "Predial", "Escritura"):
                    if item.name not in carpetas_encontradas:
                        carpetas_encontradas.append(item.name)

    msg = f"❌ No se encontró el archivo o carpeta: '{nombre_o_ruta}'"
    if carpetas_encontradas:
        msg += f"\nCarpetas disponibles: {', '.join(carpetas_encontradas)}"
    if txt_encontrados:
        msg += "\nArchivos .txt disponibles:\n  • " + "\n  • ".join(txt_encontrados[:8])
    raise FileNotFoundError(msg)


def leer_contenido_txt(ruta: Path) -> str:
    """Lee el contenido de un archivo de texto intentando utf-8 y fallbacks."""
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            contenido = ruta.read_text(encoding=encoding)
            return contenido.strip()
        except UnicodeDecodeError:
            continue
    raise ValueError(f"No fue posible decodificar el archivo '{ruta.name}' con UTF-8 ni Latin-1.")


def listar_muestras_disponibles() -> list[Path]:
    """Retorna la lista de archivos .txt de muestra encontrados en tests/samples."""
    carpetas_samples = [
        SCRIPT_DIR / "samples",
        REPO_ROOT / "tests" / "samples",
        REPO_ROOT / "backend" / "tests" / "samples",
    ]
    muestras: list[Path] = []
    vistos: set[str] = set()
    for d in carpetas_samples:
        if d.is_dir():
            for f in sorted(d.glob("*.txt")):
                if f.name not in vistos:
                    muestras.append(f)
                    vistos.add(f.name)
    return muestras


# ---------------------------------------------------------------------------
# 3. Formateo visual de resultados
# ---------------------------------------------------------------------------
def _barra_progreso(porcentaje: int, longitud: int = 10) -> str:
    llenos = int(round(longitud * (max(0, min(100, porcentaje)) / 100.0)))
    vacios = longitud - llenos
    return "█" * llenos + "░" * vacios


def imprimir_resultado_documento(resultado: dict[str, Any], ruta_archivo: Path, duracion: float) -> None:
    """Muestra el resultado devuelto por ClasificadorAgent para un documento individual."""
    clase = resultado.get("clase", "ninguna")
    confianza = resultado.get("confianza", 0)
    confianza_llm = resultado.get("confianza_llm", 0)
    resumen = resultado.get("resumen", "Sin resumen.")
    evidencia = resultado.get("evidencia", "Sin evidencia.")
    conflictos = resultado.get("conflictos", "Ninguno")
    nota = resultado.get("nota")
    campos = resultado.get("campos", {})
    conf_detalle = resultado.get("confianza_detalle", {})

    iconos_clase = {
        "predial": "💰",
        "escritura": "📜",
        "alineamiento y número oficial": "📍",
        "uso de suelo": "🏗️",
        "ninguna": "❓",
    }
    icono = iconos_clase.get(clase, "📄")

    separador = "=" * 80
    subseparador = "-" * 80

    print(f"\n{separador}")
    print(f"📄 DOCUMENTO: {ruta_archivo.name}")
    print(f"{separador}")
    print(f"📍 Ruta:               {ruta_archivo}")
    try:
        tam = len(ruta_archivo.read_text(encoding="utf-8", errors="ignore"))
        print(f"📏 Caracteres:         {tam:,}")
    except Exception:
        pass
    print(f"⏱️  Tiempo de respuesta: {duracion:.2f} s")
    print(f"{subseparador}")

    print(f"{icono}  CLASE DETECTADA:     {clase.upper()}")
    print(f"🎯 CONFIANZA REAL:      {confianza}%  [{_barra_progreso(confianza)}] ")
    print(f"🤖 Confianza LLM:       {confianza_llm}%")

    if conf_detalle:
        score_lex = conf_detalle.get("score_lexico")
        score_comp = conf_detalle.get("score_completitud")
        palabras = conf_detalle.get("palabras_clave_halladas")
        campos_det = conf_detalle.get("campos_detectados")
        print("\n📊 Calibración:")
        if score_lex is not None:
            print(f"   • Score léxico:      {score_lex}% ({palabras} palabras clave)")
        if score_comp is not None:
            print(f"   • Completitud:       {score_comp}% ({campos_det} campos)")

    print(f"\n📝 RESUMEN:")
    for linea in resumen.split("\n"):
        print(f"   {linea}")

    print(f"\n🔍 EVIDENCIA TEXTUAL:")
    for linea in evidencia.split("\n"):
        print(f"   {linea}")

    if conflictos and conflictos.strip().lower() != "ninguno":
        print(f"\n⚠️  CONFLICTOS DETECTADOS:")
        print(f"   {conflictos}")

    if nota:
        print(f"\n📌 NOTA:")
        print(f"   {nota}")

    print(f"\n{subseparador}")
    print("📑 CAMPOS EXTRAÍDOS:")
    print(f"{subseparador}")

    if not campos:
        print("   (No se extrajeron campos estructurados o clase 'ninguna')")
    else:
        max_k_len = max(len(str(k)) for k in campos.keys())
        for k, v in campos.items():
            k_format = str(k).replace("_", " ").capitalize()
            if v is None or v == "":
                valor_str = "—"
            elif isinstance(v, bool):
                valor_str = "Sí (Válido)" if v else "No (No verificado)"
            elif isinstance(v, float):
                valor_str = f"{v:,.2f}"
            else:
                valor_str = str(v)
            print(f"   • {k_format:<{max_k_len + 2}}: {valor_str}")

    print(f"{separador}")


def imprimir_tabla_resumen_lote(resultados_lote: list[dict[str, Any]], tiempo_total: float, ruta_carpeta: Path) -> None:
    """Imprime una tabla consolidada con el resumen de todos los archivos procesados en el lote."""
    ancho_archivo = max(24, max(len(r["nombre"]) for r in resultados_lote) + 2)
    ancho_clase = 32

    sep_largo = "=" * (ancho_archivo + ancho_clase + 35)
    sep_linea = "─" * (ancho_archivo + ancho_clase + 35)

    print(f"\n{sep_largo}")
    print("📊 RESUMEN CONSOLIDADO DEL LOTE")
    print(f"📁 Carpeta analizada: {ruta_carpeta.resolve()}")
    print(f"📦 Total de documentos: {len(resultados_lote)}")
    print(f"{sep_largo}")

    encabezado = f" #  {'Archivo':<{ancho_archivo}} {'Clase Detectada':<{ancho_clase}} {'Confianza':<10} {'Campos':<9} {'Tiempo':<8}"
    print(encabezado)
    print(sep_linea)

    iconos = {
        "predial": "💰",
        "escritura": "📜",
        "alineamiento y número oficial": "📍",
        "uso de suelo": "🏗️",
        "ninguna": "❓",
    }

    exitos = 0
    suma_confianza = 0

    for i, item in enumerate(resultados_lote, start=1):
        nombre = item["nombre"]
        if item.get("error"):
            print(f"{i:>2}  {nombre:<{ancho_archivo}} ❌ ERROR: {item['error']}")
            continue

        exitos += 1
        clase = item["clase"]
        conf = item["confianza"]
        suma_confianza += conf
        dur = item["duracion"]
        campos_str = item.get("campos_detectados", "—")
        icono = iconos.get(clase, "📄")

        clase_formateada = f"{icono} {clase}"
        print(f"{i:>2}  {nombre:<{ancho_archivo}} {clase_formateada:<{ancho_clase}} {conf:>3}%       {campos_str:<9} {dur:>5.2f}s")

    print(sep_linea)
    prom_conf = (suma_confianza / exitos) if exitos > 0 else 0
    prom_tiempo = (tiempo_total / len(resultados_lote)) if resultados_lote else 0

    print(f"📈 Métricas globales:")
    print(f"   • Procesados exitosamente: {exitos} de {len(resultados_lote)}")
    print(f"   • Confianza promedio:      {prom_conf:.1f}%")
    print(f"   • Tiempo total:            {tiempo_total:.2f} s  (Promedio: {prom_tiempo:.2f} s / doc)")
    print(f"{sep_largo}\n")


# ---------------------------------------------------------------------------
# 4. Modo Mock (Simulación para pruebas rápidas de lote)
# ---------------------------------------------------------------------------
def _ejecutar_mock(texto: str) -> dict[str, Any]:
    """Genera una respuesta simulada estructurada para verificar el flujo sin Ollama."""
    t_lower = texto.lower()
    if "alineamiento" in t_lower or "numero oficial" in t_lower:
        return {
            "clase": "alineamiento y número oficial",
            "confianza": 89,
            "confianza_llm": 95,
            "confianza_detalle": {
                "confianza_llm": 95,
                "score_lexico": 88,
                "palabras_clave_halladas": 7,
                "score_completitud": 81,
                "campos_detectados": "9/11",
            },
            "resumen": "Constancia de Alineamiento y Asignación de Número Oficial expedida por la Dirección de Desarrollo Urbano.",
            "evidencia": "CONSTANCIA DE ALINEAMIENTO Y NUMERO OFICIAL, NUMERO OFICIAL 174, SUPERFICIE 536.82 M2",
            "conflictos": "Ninguno",
            "nota": None,
            "campos": {
                "titular_o_propietario": "SANDOVAL ROMEROMA.ISABEL GICELA",
                "direccion_oficial": "AV. CRISPIN PEREZ, CENTRO MELCHOR OCAMPO",
                "numero_oficial_asignado": "174",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 536.82,
                "alineamiento_medidas": "Frente 10.53m, Banqueta 2.10m, Seccion 12.00m",
                "fecha_emision": "16/10/2024",
                "vigencia": "16/10/2025",
                "folio_o_expediente": "DDU/911/10/24",
                "autoridad_emisora": "Dirección de Desarrollo Urbano Melchor Ocampo",
            },
        }
    elif "predial" in t_lower or "tesoreria" in t_lower:
        return {
            "clase": "predial",
            "confianza": 92,
            "confianza_llm": 98,
            "confianza_detalle": {
                "confianza_llm": 98,
                "score_lexico": 88,
                "palabras_clave_halladas": 8,
                "score_completitud": 90,
                "campos_detectados": "10/11",
            },
            "resumen": "Comprobante oficial de pago de Impuesto Predial del ejercicio fiscal en curso.",
            "evidencia": "PAGO DE IMPUESTO PREDIAL, CLAVE CATASTRAL, RECIBO OFICIAL, PAGADO",
            "conflictos": "Ninguno",
            "nota": None,
            "campos": {
                "propietario_o_contribuyente": "INMOBILIARIA Y COMERCIAL TULTEPEC S.A. DE C.V.",
                "clave_catastral": "0950100412000000",
                "direccion": "CALLE INSURGENTES NO. 45, CENTRO, TULTEPEC",
                "ejercicio_o_periodo": "ANUAL 2025",
                "total_pagado": 11205.00,
                "folio_o_recibo": "PRE-2025-004821",
                "es_comprobante_pago": True,
                "autoridad_emisora": "Tesorería Municipal Tultepec",
            },
        }
    elif "escritura" in t_lower or "notar" in t_lower:
        return {
            "clase": "escritura",
            "confianza": 94,
            "confianza_llm": 96,
            "confianza_detalle": {
                "confianza_llm": 96,
                "score_lexico": 90,
                "palabras_clave_halladas": 9,
                "score_completitud": 92,
                "campos_detectados": "11/12",
            },
            "resumen": "Escritura pública notarial formalizando contrato de compraventa de inmueble.",
            "evidencia": "INSTRUMENTO 30,025, NOTARIO PUBLICO 12, CONTRATO DE COMPRAVENTA",
            "conflictos": "Ninguno",
            "nota": None,
            "campos": {
                "titular_o_comprador": "TIENDAS TRES B, S.A. DE C.V.",
                "vendedor": "DON ALFONSO GONZÁLEZ RAMÍREZ",
                "direccion_inmueble": "AVENIDA CRISPÍN PÉREZ S/N, MELCHOR OCAMPO",
                "clave_catastral": "0040111241000000",
                "superficie_terreno_m2": 536.82,
                "numero_escritura_o_instrumento": "30,025",
                "volumen_o_libro": "412",
                "notario_y_notaria": "Lic. Roberto Mendoza Vázquez (Notaría 12)",
                "tipo_acto": "Compraventa",
                "fecha_escritura": "14/03/2018",
            },
        }
    elif "licencia" in t_lower or "uso de suelo" in t_lower:
        return {
            "clase": "uso de suelo",
            "confianza": 91,
            "confianza_llm": 95,
            "confianza_detalle": {
                "confianza_llm": 95,
                "score_lexico": 85,
                "palabras_clave_halladas": 7,
                "score_completitud": 88,
                "campos_detectados": "9/10",
            },
            "resumen": "Licencia de Uso de Suelo comercial emitida a favor de Tiendas Tres B para venta de consumo básico.",
            "evidencia": "LICENCIA DE USO DE SUELO, USO COMERCIAL, MINISÚPER DE CONVENIENCIA",
            "conflictos": "Ninguno",
            "nota": None,
            "campos": {
                "titular_o_solicitante": "TIENDAS TRES B, S.A. DE C.V.",
                "direccion_inmueble": "AV. REFORMA NO. 102, COL. SAN JUAN, TULTEPEC",
                "clave_catastral": "0950300185000000",
                "superficie_terreno_m2": 480.00,
                "uso_autorizado": "COMERCIAL Y DE SERVICIOS",
                "giro_permitido": "Minisúper de conveniencia / abarrotes",
                "es_comercial": True,
                "vigencia": "31/12/2025",
                "fecha_emision": "12/02/2024",
                "folio_o_expediente": "04-US-2024",
                "autoridad_emisora": "Dirección de Desarrollo Urbano Tultepec",
            },
        }
    else:
        return {
            "clase": "ninguna",
            "confianza": 20,
            "confianza_llm": 20,
            "confianza_detalle": {"metodo": "directo_ninguna"},
            "resumen": "El documento no contiene términos o encabezados suficientes de las 4 clases admitidas.",
            "evidencia": "No se hallaron términos notariales, fiscales o urbanísticos concluyentes.",
            "conflictos": "Texto genérico o no catalogado.",
            "nota": "Se sugiere revisar la calidad de escaneo u OCR.",
            "campos": {},
        }


def descargar_modelo_ollama(modelo: str, ollama_url: str) -> bool:
    """Descarga el modelo automáticamente usando el CLI de ollama o la API REST."""
    print(f"\n⏳ Iniciando descarga de '{modelo}'...")
    print("   (La primera vez puede demorar unos minutos según tu conexión a internet)")

    es_local = "localhost" in ollama_url or "127.0.0.1" in ollama_url
    if es_local and shutil.which("ollama"):
        try:
            ret = subprocess.run(["ollama", "pull", modelo])
            return ret.returncode == 0
        except Exception as e:
            print(f"Aviso con CLI: {e}, intentando vía API...")

    try:
        import urllib.request
        url_pull = f"{ollama_url.rstrip('/')}/api/pull"
        data = json.dumps({"name": modelo, "stream": False}).encode("utf-8")
        req = urllib.request.Request(
            url_pull,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        print(f"Descargando vía endpoint de Ollama ({url_pull})... Por favor espera.")
        with urllib.request.urlopen(req, timeout=1200) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"❌ Error al solicitar descarga a Ollama: {e}")
        return False


# ---------------------------------------------------------------------------
# 5. Ejecución: Documento individual
# ---------------------------------------------------------------------------
def procesar_un_documento(
    ruta_archivo: Path,
    agente_instancia: Any = None,
    mock: bool = False,
    modelo: str | None = None,
    ollama_url: str | None = None,
) -> tuple[dict[str, Any], float]:
    """Procesa un archivo individual y retorna (resultado_dict, tiempo_segundos)."""
    texto = leer_contenido_txt(ruta_archivo)
    if not texto:
        raise ValueError(f"El archivo '{ruta_archivo.name}' está vacío.")

    inicio = time.perf_counter()

    if mock:
        resultado = _ejecutar_mock(texto)
    else:
        if agente_instancia is None:
            try:
                from app.core.config import settings
                from app.agents.clasificador import ClasificadorAgent
            except ModuleNotFoundError as e:
                print(f"\n❌ Falta la dependencia de Python: '{e.name}'")
                print("💡 Opciones para ejecutar:")
                print(f"   • En Docker: docker compose exec backend python tests/test_clasificador.py {ruta_archivo.name}")
                print(f"   • En local:  pip install -r backend/requirements.txt")
                print(f"   • Con --mock (sin dependencias): python tests/test_clasificador.py {ruta_archivo.name} --mock\n")
                sys.exit(1)

            if modelo:
                settings.ollama_model = modelo
            if ollama_url:
                settings.ollama_base_url = ollama_url
            elif not Path("/.dockerenv").exists() and "ollama:11434" in settings.ollama_base_url:
                settings.ollama_base_url = "http://localhost:11434"

            try:
                agente_instancia = ClasificadorAgent()
            except Exception as e:
                msg_error = str(e)
                if "not found" in msg_error.lower() or "404" in msg_error:
                    print(f"\n⚠️  El modelo '{settings.ollama_model}' no está descargado todavía.")
                    try:
                        resp = input(f"¿Deseas descargarlo automáticamente ahora? [S/n]: ").strip().lower()
                    except (KeyboardInterrupt, EOFError):
                        resp = "n"

                    if resp in ("", "s", "si", "y", "yes"):
                        ok = descargar_modelo_ollama(settings.ollama_model, settings.ollama_base_url)
                        if ok:
                            print(f"\n✅ Modelo descargado con éxito. Continuando...\n")
                            agente_instancia = ClasificadorAgent()
                        else:
                            sys.exit(1)
                    else:
                        print(f"Descárgalo cuando gustes con: ollama pull {settings.ollama_model}\n")
                        sys.exit(1)
                else:
                    raise

        try:
            resultado = asyncio.run(agente_instancia.run(texto))
        except Exception as e:
            msg_error = str(e)
            if "not found" in msg_error.lower() or "404" in msg_error:
                from app.core.config import settings
                print(f"\n⚠️  El modelo '{settings.ollama_model}' no está descargado todavía.")
                try:
                    resp = input(f"¿Deseas descargarlo automáticamente ahora? [S/n]: ").strip().lower()
                except (KeyboardInterrupt, EOFError):
                    resp = "n"

                if resp in ("", "s", "si", "y", "yes"):
                    ok = descargar_modelo_ollama(settings.ollama_model, settings.ollama_base_url)
                    if ok:
                        agente_instancia = ClasificadorAgent()
                        resultado = asyncio.run(agente_instancia.run(texto))
                    else:
                        sys.exit(1)
                else:
                    sys.exit(1)
            else:
                raise

    duracion = time.perf_counter() - inicio
    return resultado, duracion


# ---------------------------------------------------------------------------
# 6. Ejecución: Lote de carpeta
# ---------------------------------------------------------------------------
def procesar_carpeta(
    ruta_carpeta: Path,
    como_json: bool = False,
    mock: bool = False,
    modelo: str | None = None,
    ollama_url: str | None = None,
    recursivo: bool = False,
    solo_resumen: bool = False,
) -> None:
    """Itera en todos los archivos .txt de la carpeta especificada y muestra resultados."""
    patron = "**/*.txt" if recursivo else "*.txt"
    archivos = [
        f for f in sorted(ruta_carpeta.glob(patron))
        if f.is_file() and f.name != "requirements.txt"
    ]

    if not archivos:
        print(f"\n⚠️  No se encontraron archivos .txt en la carpeta: {ruta_carpeta.resolve()}")
        return

    if not como_json:
        print(f"\n📂 Carpeta seleccionada: {ruta_carpeta.resolve()}")
        print(f"📑 Se encontraron {len(archivos)} archivo(s) .txt para clasificar.\n")

    # Inicializar agente una sola vez si no es mock para ahorrar tiempo
    agente_instancia = None
    if not mock:
        try:
            from app.core.config import settings
            from app.agents.clasificador import ClasificadorAgent

            if modelo:
                settings.ollama_model = modelo
            if ollama_url:
                settings.ollama_base_url = ollama_url
            elif not Path("/.dockerenv").exists() and "ollama:11434" in settings.ollama_base_url:
                settings.ollama_base_url = "http://localhost:11434"

            agente_instancia = ClasificadorAgent()
        except Exception:
            pass  # El manejo detallado se hará en la primera llamada

    resultados_lote: list[dict[str, Any]] = []
    tiempo_total_inicio = time.perf_counter()

    for idx, f in enumerate(archivos, start=1):
        if not como_json:
            print(f"[{idx}/{len(archivos)}] ⏳ Analizando: {f.name}...")

        try:
            res, dur = procesar_un_documento(
                ruta_archivo=f,
                agente_instancia=agente_instancia,
                mock=mock,
                modelo=modelo,
                ollama_url=ollama_url,
            )

            if not como_json and not solo_resumen:
                imprimir_resultado_documento(res, f, dur)

            conf_det = res.get("confianza_detalle", {})
            resultados_lote.append({
                "nombre": f.name,
                "ruta": str(f.resolve()),
                "clase": res.get("clase", "ninguna"),
                "confianza": res.get("confianza", 0),
                "confianza_llm": res.get("confianza_llm", 0),
                "campos_detectados": conf_det.get("campos_detectados", f"{len(res.get('campos', {}))} campos"),
                "duracion": dur,
                "resultado": res,
                "error": None,
            })
        except Exception as err:
            if not como_json:
                print(f"   ❌ Error al procesar '{f.name}': {err}")
            resultados_lote.append({
                "nombre": f.name,
                "ruta": str(f.resolve()),
                "clase": "error",
                "confianza": 0,
                "confianza_llm": 0,
                "campos_detectados": "0",
                "duracion": 0.0,
                "resultado": {},
                "error": str(err),
            })

    tiempo_total = time.perf_counter() - tiempo_total_inicio

    if como_json:
        salida_json = {
            "carpeta": str(ruta_carpeta.resolve()),
            "total_archivos": len(archivos),
            "tiempo_total_segundos": round(tiempo_total, 2),
            "documentos": resultados_lote,
        }
        print(json.dumps(salida_json, ensure_ascii=False, indent=2))
    else:
        imprimir_tabla_resumen_lote(resultados_lote, tiempo_total, ruta_carpeta)


# ---------------------------------------------------------------------------
# 7. CLI Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prueba y procesamiento por lotes del ClasificadorAgent con archivos .txt"
    )
    parser.add_argument(
        "objetivo",
        nargs="?",
        help="Nombre de archivo .txt, ruta o carpeta para procesar en lote (ej. 'text.txt', 'samples')",
    )
    parser.add_argument(
        "-d", "--dir", "--carpeta",
        dest="carpeta",
        help="Ruta explícita a la carpeta de archivos .txt a procesar en lote",
    )
    parser.add_argument(
        "-f", "--file",
        help="Ruta explícita al archivo .txt individual",
    )
    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="Buscar archivos .txt de forma recursiva en subcarpetas",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="En modo carpeta, muestra únicamente la tabla de resumen final sin el detalle de cada documento",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Imprime la salida en formato JSON puro",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Ejecuta en modo simulado sin conectar a Ollama (ideal para pruebas rápidas)",
    )
    parser.add_argument(
        "--model",
        help="Modelo Ollama a utilizar (por defecto: 'qwen2.5:3b')",
    )
    parser.add_argument(
        "--ollama-url",
        help="URL base de Ollama (ej. 'http://localhost:11434')",
    )
    parser.add_argument(
        "--list-samples",
        action="store_true",
        help="Lista los archivos .txt de muestra incluidos en tests/samples",
    )

    args = parser.parse_args()

    if args.list_samples:
        muestras = listar_muestras_disponibles()
        print("\n📂 Muestras de prueba disponibles en 'tests/samples/':")
        if not muestras:
            print("   (No se encontraron archivos en tests/samples)")
        else:
            for m in muestras:
                print(f"   • {m.name}  ({m.stat().st_size:,} bytes)")
            print("\nPuedes procesar todas juntas ejecutando:")
            print(f"   python tests/test_clasificador.py samples\n")
        return

    # Si se especificó carpeta explícitamente con -d / --dir
    if args.carpeta:
        try:
            ruta, tipo = resolver_objetivo(args.carpeta)
            if tipo != "dir":
                sys.exit(f"❌ '{args.carpeta}' no es un directorio válido.")
            procesar_carpeta(
                ruta_carpeta=ruta,
                como_json=args.json,
                mock=args.mock,
                modelo=args.model,
                ollama_url=args.ollama_url,
                recursivo=args.recursive,
                solo_resumen=args.summary_only,
            )
            return
        except FileNotFoundError as err:
            sys.exit(str(err))

    # Determinar qué objetivo procesar
    objetivo_str = args.file or args.objetivo

    if not objetivo_str:
        muestras = listar_muestras_disponibles()
        print("\n" + "=" * 65)
        print("🔍 ClasificadorAgent - Procesamiento individual o por lote")
        print("=" * 65)
        print("Opciones:")
        print("  [0] Procesar TODAS las muestras de 'tests/samples/' en lote")
        if muestras:
            for i, m in enumerate(muestras, start=1):
                print(f"  [{i}] Archivo individual: {m.name}")
        print()

        try:
            entrada_usuario = input("Selecciona un número o escribe nombre/carpeta (ej. 'samples'): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nOperación cancelada.")
            return

        if not entrada_usuario:
            sys.exit("Error: No se proporcionó ninguna entrada.")

        if entrada_usuario == "0":
            objetivo_str = "samples"
        elif entrada_usuario.isdigit() and muestras:
            idx = int(entrada_usuario) - 1
            if 0 <= idx < len(muestras):
                objetivo_str = str(muestras[idx])
            else:
                sys.exit(f"Índice fuera de rango: {entrada_usuario}")
        else:
            objetivo_str = entrada_usuario

    try:
        ruta_resuelta, tipo_objetivo = resolver_objetivo(objetivo_str)
    except FileNotFoundError as err:
        sys.exit(str(err))

    if tipo_objetivo == "dir":
        procesar_carpeta(
            ruta_carpeta=ruta_resuelta,
            como_json=args.json,
            mock=args.mock,
            modelo=args.model,
            ollama_url=args.ollama_url,
            recursivo=args.recursive,
            solo_resumen=args.summary_only,
        )
    else:
        resultado, duracion = procesar_un_documento(
            ruta_archivo=ruta_resuelta,
            mock=args.mock,
            modelo=args.model,
            ollama_url=args.ollama_url,
        )
        if args.json:
            print(json.dumps(resultado, ensure_ascii=False, indent=2))
        else:
            imprimir_resultado_documento(resultado, ruta_resuelta, duracion)


if __name__ == "__main__":
    main()
