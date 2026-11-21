"""OCR local de PDFs e imágenes con coordenadas y una cadena LangChain."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Protocol

import pymupdf
import numpy as np
from langchain_core.documents import Document
from langchain_core.runnables import RunnableLambda
from ocr_quality import SUPPORTED_EXTENSIONS, read_image, read_page, arrange_blocks


class Engine(Protocol):
    def predict(self, image: np.ndarray): ...


def create_engine(language: str = "es", device: str = "cpu") -> Engine:
    from paddleocr import PaddleOCR

    return PaddleOCR(
        lang=language, device=device,
        # La versión fijada 3.2.2 permite acelerar la inferencia en CPU.
        enable_mkldnn=True,
        enable_hpi=False,
        text_det_limit_side_len=2048,
        text_det_limit_type="max",
        text_rec_score_thresh=0.0,
        text_recognition_batch_size=8,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def iter_pages(path: Path, dpi: int):
    if path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
        rgb = read_image(path)
        yield rgb, None, None, 0
        return
    if path.suffix.lower() != ".pdf":
        raise ValueError("Formatos admitidos: PDF, JPEG, JPG y PNG.")
    with pymupdf.open(path) as pdf:
        if not pdf.is_pdf or pdf.needs_pass:
            raise ValueError("PDF inválido o protegido con contraseña.")
        for page in pdf:
            pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False)
            rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
            yield rgb, page.rect.width, page.rect.height, page.rotation


def extract(path: Path, engine: Engine, dpi: int = 300,
            min_confidence: float = 0.0, quality: str = "fast") -> dict:
    if not 72 <= dpi <= 600:
        raise ValueError("El DPI debe estar entre 72 y 600.")
    if not 0 <= min_confidence <= 1:
        raise ValueError("La confianza debe estar entre 0 y 1.")
    if quality not in {"fast", "accurate"}:
        raise ValueError("Calidad inválida.")
    pages = []
    if path.suffix.lower() == ".pdf":
        with pymupdf.open(path) as pdf:
            page_count = len(pdf)
    else:
        page_count = 1
    for number, (rgb, width_pt, height_pt, rotation) in enumerate(iter_pages(path, dpi), 1):
        height, width = rgb.shape[:2]
        page_quality = ("accurate" if number <= 2 else "fast") if page_count > 5 else quality
        print(f"  Página {number}/{page_count}: OCR {width} x {height}, modo {page_quality}", flush=True)
        detected, _ = read_page(engine, rgb, page_quality)
        blocks = []
        for block in detected:
            if block["confidence"] < min_confidence:
                continue
            normalized = np.asarray(block["polygon_px"]) / [width, height]
            blocks.append({**block, "polygon_normalized": normalized.tolist(),
                           "polygon_pdf_display_pt": (normalized * [width_pt, height_pt]).tolist()
                           if width_pt is not None else None})
        blocks, text = arrange_blocks(blocks)
        for index, block in enumerate(blocks, 1):
            block["id"] = f"p{number}-b{index}"
            block["page"] = number
        warnings = []
        if not blocks:
            warnings.append("no_text_detected")
        if len(blocks) < len(detected):
            warnings.append("blocks_removed_by_confidence_filter")
        pages.append({"page": number, "width_px": width, "height_px": height,
                      "width_pt": width_pt, "height_pt": height_pt, "rotation": rotation,
                      "blocks": blocks, "text": text,
                      "warnings": warnings,
                      "reviewed_twice": page_quality == "accurate"})
    return {"source": str(path.resolve()), "dpi": dpi, "engine": "paddleocr",
            "quality": quality, "coordinate_origin": "top-left",
            "image_coordinates": "EXIF-transposed image" if path.suffix.lower() != ".pdf" else "rendered PDF",
            "pages": pages}


def to_documents(result: dict) -> list[Document]:
    return [Document(page_content=block["text"], metadata={
        "source": result["source"], "page": page["page"], **block,
        "width_px": page["width_px"], "height_px": page["height_px"],
    }) for page in result["pages"] for block in page["blocks"]]


def build_chain(engine: Engine, dpi: int = 300, min_confidence: float = 0.0, quality: str = "fast"):
    def run(path):
        return extract(Path(path), engine, dpi, min_confidence, quality)

    return RunnableLambda(run)


def save_result(result: dict, directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": result["source"],
        "coordinate_origin": "top-left",
        "pages": [
            {
                "page": page["page"],
                "width_px": page["width_px"],
                "height_px": page["height_px"],
                "text": page["text"],
                "fragments": [
                    {
                        "id": block["id"],
                        "page": page["page"],
                        "text": block["text"],
                        "confidence": block["confidence"],
                        "bbox_px": block["bbox_px"],
                        "polygon_px": block["polygon_px"],
                    }
                    for block in page["blocks"]
                ],
            }
            for page in result["pages"]
        ],
    }
    (directory / "result.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (directory / "text.txt").write_text("\n\n".join(
        f"--- Página {p['page']} ---\n{p['text']}" for p in result["pages"]), encoding="utf-8")
    locations = []
    for page in result["pages"]:
        locations.append(f"--- Página {page['page']} ---")
        for block in page["blocks"]:
            x1, y1, x2, y2 = block["bbox_px"]
            locations.append(f"{block['id']} | x1={x1:.0f}, y1={y1:.0f}, x2={x2:.0f}, y2={y2:.0f} px | {block['text']}")
    (directory / "ubicaciones.txt").write_text("\n".join(locations), encoding="utf-8")
    for old_name in ("review.json", "review.csv", "fragmentos.csv", "cache.json"):
        (directory / old_name).unlink(missing_ok=True)


def discover_documents(root: Path) -> list[Path]:
    return sorted((p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS),
                  key=lambda p: str(p.relative_to(root)).casefold())


def discover_pdfs(root: Path) -> list[Path]:
    return [p for p in discover_documents(root) if p.suffix.lower() == ".pdf"]


def extract_directory(root: Path, output: Path, chain, files=None) -> dict:
    root, output = root.resolve(), output.resolve()
    if output == root or root in output.parents:
        raise ValueError("La salida debe estar fuera de la carpeta de entrada.")
    files = discover_documents(root) if files is None else files
    output.mkdir(parents=True, exist_ok=True)
    (output / "summary.json").unlink(missing_ok=True)
    summary = {"total": len(files), "succeeded": 0, "failed": 0, "files": []}
    for index, path in enumerate(files, 1):
        relative = path.relative_to(root)
        # Conservar la extensión evita colisiones entre nombres de carpetas y PDFs.
        destination = output / relative
        print(f"[{index}/{len(files)}] {relative}", flush=True)
        try:
            result = chain.invoke(path)
            save_result(result, destination)
            entry = {"file": str(relative), "status": "ok", "output": str(destination),
                     "pages": len(result["pages"]),
                     "blocks": sum(len(page["blocks"]) for page in result["pages"])}
            summary["succeeded"] += 1
        except Exception as exc:
            # Un PDF dañado no debe detener el resto del lote.
            entry = {"file": str(relative), "status": "error", "error": str(exc)}
            summary["failed"] += 1
            print(f"  ERROR: {exc}", flush=True)
        summary["files"].append(entry)
    return summary


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, nargs="?", default=Path(__file__).parent / "documentos",
                        help="PDF, JPEG, PNG o carpeta que se recorrerá incluyendo subcarpetas")
    parser.add_argument("--list", action="store_true", help="Listar documentos sin ejecutar OCR")
    parser.add_argument("--output", type=Path, default=Path("output/ocr"))
    parser.add_argument("--lang", default="es")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--min-confidence", type=float, default=0.0)
    parser.add_argument("--quality", choices=["accurate", "fast"], default="fast")
    args = parser.parse_args()
    args.pdf = args.pdf.resolve()
    if not args.pdf.exists():
        parser.error(f"No existe la entrada: {args.pdf}")
    files = discover_documents(args.pdf) if args.pdf.is_dir() else [args.pdf]
    if args.list:
        for path in files:
            print(path.relative_to(args.pdf) if args.pdf.is_dir() else path)
        print(f"Total: {len(files)} documentos")
        return
    if not files:
        parser.error("No hay PDFs, JPEG o PNG para analizar.")
    if args.pdf.is_dir() and (args.output.resolve() == args.pdf or args.pdf in args.output.resolve().parents):
        parser.error("La salida debe estar fuera de la carpeta de entrada.")
    if not 72 <= args.dpi <= 600 or not 0 <= args.min_confidence <= 1:
        parser.error("DPI: 72 a 600; confianza: 0 a 1.")
    try:
        chain = build_chain(create_engine(args.lang, args.device), args.dpi, args.min_confidence, args.quality)
        if args.pdf.is_dir():
            summary = extract_directory(args.pdf, args.output, chain, files)
            print(f"Lote terminado: {summary['succeeded']} correctos, {summary['failed']} errores. Salida: {args.output.resolve()}")
            if summary["failed"]:
                parser.exit(1)
            return
        result = chain.invoke(args.pdf)
        save_result(result, args.output)
    except (ImportError, ValueError, RuntimeError, OSError) as exc:
        parser.exit(1, f"No se pudo extraer el PDF: {exc}\n")
    print(f"Procesadas {len(result['pages'])} páginas, {sum(len(page['blocks']) for page in result['pages'])} bloques. Salida: {args.output.resolve()}")


if __name__ == "__main__":
    main()
