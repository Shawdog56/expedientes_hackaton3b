# Muestras de prueba (.txt) para ClasificadorAgent

Esta carpeta contiene documentos de texto (.txt) representativos de las 4 clases admitidas:

1. `alineamiento_ejemplo.txt`: Constancia de Alineamiento y Número Oficial (Melchor Ocampo).
2. `predial_ejemplo.txt`: Recibo / Liquidación pagada de Impuesto Predial (Tultepec).
3. `escritura_ejemplo.txt`: Instrumento Notarial de Compraventa (Toluca / Melchor Ocampo).
4. `uso_de_suelo_ejemplo.txt`: Licencia de Uso de Suelo Comercial (Tultepec).

Puedes usarlos directamente ejecutando:
```bash
python tests/test_clasificador.py alineamiento_ejemplo.txt
python tests/test_clasificador.py predial_ejemplo.txt
python tests/test_clasificador.py escritura_ejemplo.txt
python tests/test_clasificador.py uso_de_suelo_ejemplo.txt
```
