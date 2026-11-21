# Suite de Pruebas para ClasificadorAgent

Este directorio contiene herramientas y datos de prueba para evaluar el agente `ClasificadorAgent` (`backend/app/agents/clasificador.py`).

## 📁 Estructura

```
tests/
├── __init__.py
├── README.md
├── test_clasificador.py      # Script para pruebas individuales o por carpeta (lote)
└── samples/                  # Archivos .txt de muestra para cada clase
    ├── alineamiento_ejemplo.txt   (Alineamiento y Número Oficial - Melchor Ocampo)
    ├── escritura_ejemplo.txt      (Escritura Pública Notarial - Tiendas 3B)
    ├── predial_ejemplo.txt        (Pago de Impuesto Predial - Tultepec)
    └── uso_de_suelo_ejemplo.txt   (Licencia de Uso de Suelo Comercial)
```

---

## 🚀 Uso Rápido

### 1. Procesar un archivo individual
```bash
python tests/test_clasificador.py text.txt
python tests/test_clasificador.py predial_ejemplo.txt
python tests/test_clasificador.py text.txt --mock
```

### 2. Procesar TODOS los `.txt` de una carpeta (Modo Lote)
Basta con pasar el nombre o ruta de la carpeta:

```bash
# Procesa todos los txt de la carpeta de muestras
python tests/test_clasificador.py samples

# Procesar cualquier carpeta personalizada
python tests/test_clasificador.py C:/ruta/a/mis_documentos/
python tests/test_clasificador.py --dir ruta/a/carpeta/

# Búsqueda recursiva en subcarpetas
python tests/test_clasificador.py ruta/a/carpeta/ --recursive

# Ver únicamente la tabla de resumen consolidado al final
python tests/test_clasificador.py samples --summary-only

# Salida en JSON estructurado de todo el lote
python tests/test_clasificador.py samples --json
```

### 3. En Docker
```bash
docker compose exec backend python tests/test_clasificador.py samples
docker compose exec backend python tests/test_clasificador.py samples --summary-only
```

---

## ⚙️ Opciones Disponibles

| Argumento / Flag | Descripción |
|---|---|
| `<objetivo>` | Archivo `.txt` individual o carpeta que contiene archivos `.txt`. |
| `-d`, `--dir <carpeta>` | Especifica la carpeta para procesamiento en lote. |
| `-r`, `--recursive` | Busca archivos `.txt` en subcarpetas recursivamente. |
| `--summary-only` | Muestra únicamente la tabla final de resumen del lote. |
| `--json` | Muestra la salida en JSON puro. |
| `--mock` | Modo simulación (no requiere Ollama ni dependencias externas). |
| `--model <nombre>` | Especifica el modelo Ollama (por defecto: `qwen2.5:3b`). |
| `--list-samples` | Lista todas las muestras disponibles en `tests/samples/`. |
