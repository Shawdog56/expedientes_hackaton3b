import tempfile
import unittest
from pathlib import Path

import numpy as np
import pymupdf

from extract_pdf import build_chain, extract, save_result, discover_pdfs, extract_directory, create_engine


class FakeEngine:
    def predict(self, image):
        h, w, _ = image.shape
        return [{"rec_texts": ["Factura 123", "ruido"],
                 "rec_scores": [0.98, 0.15],
                 "rec_polys": np.array([[[0, 0], [w/2, 0], [w/2, h/2], [0, h/2]],
                                        [[0, 0], [1, 0], [1, 1], [0, 1]]])}]


class ExtractionTests(unittest.TestCase):
    def test_engine_disables_broken_onednn_path(self):
        import types
        from unittest.mock import Mock, patch
        constructor = Mock()
        with patch.dict("sys.modules", {"paddleocr": types.SimpleNamespace(PaddleOCR=constructor)}):
            create_engine()
        self.assertTrue(constructor.call_args.kwargs["enable_mkldnn"])
        self.assertFalse(constructor.call_args.kwargs["enable_hpi"])

    def test_recursive_batch_continues_after_error(self):
        from langchain_core.runnables import RunnableLambda
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "documentos"
            for folder in ["Predial", "Escrituras/anidadas"]:
                (root / folder).mkdir(parents=True)
                (root / folder / "igual.PDF").touch()
            (root / "roto.pdf").touch()
            (root / "imagen.jpeg").touch()

            def run(path):
                if path.name == "roto.pdf":
                    raise ValueError("PDF dañado")
                return {"source": str(path), "pages": []}

            output = Path(tmp) / "salida"
            self.assertEqual(len(discover_pdfs(root)), 3)
            summary = extract_directory(root, output, RunnableLambda(run))
            self.assertEqual((summary["succeeded"], summary["failed"]), (3, 1))
            for folder in ["Predial", "Escrituras/anidadas"]:
                self.assertTrue((output / folder / "igual.PDF/text.txt").exists())
                self.assertTrue((output / folder / "igual.PDF/ubicaciones.txt").exists())
            with self.assertRaises(ValueError):
                extract_directory(root, root / "output", RunnableLambda(run))

    def test_scanned_pdf_chain_and_coordinates(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "scan.pdf"
            # Imagen raster en PDF: no hay texto digital que extraer.
            image = pymupdf.Pixmap(pymupdf.csRGB, (0, 0, 200, 100), False)
            image.clear_with(255)
            with pymupdf.open() as pdf:
                page = pdf.new_page(width=200, height=100)
                page.insert_image(page.rect, pixmap=image)
                page = pdf.new_page(width=100, height=200)
                page.insert_image(page.rect, pixmap=image)
                page.set_rotation(90)
                pdf.save(path)
            result = build_chain(FakeEngine(), dpi=144, min_confidence=0.5).invoke(path)
            self.assertEqual(len(result["pages"]), 2)
            self.assertEqual(result["pages"][1]["blocks"][0]["page"], 2)
            for page in result["pages"]:
                block = page["blocks"][0]
                self.assertEqual(block["polygon_normalized"][2], [0.5, 0.5])
                self.assertEqual(block["polygon_pdf_display_pt"][2], [100, 50])
                self.assertEqual(page["text"], "Factura 123")
            save_result(result, Path(tmp) / "out")
            self.assertEqual(sorted(p.name for p in (Path(tmp) / "out").iterdir()), ["result.json", "text.txt", "ubicaciones.txt"])
            self.assertIn("p2-b1", (Path(tmp) / "out/ubicaciones.txt").read_text(encoding="utf-8"))
            import json
            payload = json.loads((Path(tmp) / "out/result.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["pages"][1]["fragments"][0]["page"], 2)
            self.assertEqual(payload["pages"][1]["fragments"][0]["text"], "Factura 123")

    def test_long_pdf_reviews_only_first_two_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "long.pdf"
            with pymupdf.open() as pdf:
                for _ in range(6):
                    pdf.new_page(width=100, height=100)
                pdf.save(path)
            engine = FakeEngine()
            result = build_chain(engine, dpi=72, quality="accurate").invoke(path)
            self.assertEqual(len(result["pages"]), 6)
            self.assertEqual([p["reviewed_twice"] for p in result["pages"]], [True, True, False, False, False, False])

    def test_invalid_options(self):
        with self.assertRaises(ValueError):
            extract(Path("missing.pdf"), FakeEngine(), dpi=10)
        with self.assertRaises(ValueError):
            extract(Path("missing.pdf"), FakeEngine(), min_confidence=2)

    def test_jpeg_png_and_exif(self):
        from PIL import Image
        from ocr_quality import read_image, SUPPORTED_EXTENSIONS
        with tempfile.TemporaryDirectory() as tmp:
            for ext in (".png", ".jpg", ".jpeg"):
                path = Path(tmp) / ("scan" + ext)
                Image.new("RGB", (200, 100), "white").save(path)
                result = build_chain(FakeEngine(), min_confidence=0.5).invoke(path)
                self.assertEqual(len(result["pages"]), 1)
                self.assertIsNone(result["pages"][0]["blocks"][0]["polygon_pdf_display_pt"])
                self.assertEqual(result["pages"][0]["width_px"], 200)
            path = Path(tmp) / "rotated.jpg"
            exif = Image.Exif()
            exif[274] = 6
            Image.new("RGB", (200, 100)).save(path, exif=exif)
            self.assertEqual(read_image(path).shape[:2], (200, 100))
            path = Path(tmp) / "transparent.png"
            Image.new("RGBA", (10, 10), (0, 0, 0, 0)).save(path)
            self.assertTrue((read_image(path) == 255).all())

    def test_numeric_conflict_preserves_original_and_alternatives(self):
        from ocr_quality import read_page, arrange_blocks
        class ChangingEngine:
            calls = 0
            def predict(self, image):
                self.calls += 1
                return [{"rec_texts": ["Total 100" if self.calls == 1 else "Total 1OO"],
                         "rec_scores": [0.91 if self.calls == 1 else 0.99],
                         "rec_polys": [[[0, 0], [90, 0], [90, 20], [0, 20]]]}]
        blocks, raw = read_page(ChangingEngine(), np.full((50, 100, 3), 255, dtype=np.uint8))
        self.assertEqual(blocks[0]["text"], "Total 100")
        self.assertIn("numeric_disagreement", blocks[0]["review_reasons"])
        self.assertEqual(len(blocks[0]["candidates"]), 2)
        ordered, text = arrange_blocks([
            {"text": "123", "bbox_px": [100, 0, 150, 20]},
            {"text": "Folio", "bbox_px": [0, 1, 50, 21]}])
        self.assertEqual(text, "Folio\t123")


if __name__ == "__main__":
    unittest.main()
