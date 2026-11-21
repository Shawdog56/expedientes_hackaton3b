"""Lectura de imágenes y comparación auditable de dos pasadas OCR."""
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

SUPPORTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


def read_image(path: Path):
    with Image.open(path) as source:
        # EXIF de cámara antes de medir coordenadas; transparencia sobre fondo blanco.
        image = ImageOps.exif_transpose(source).convert("RGBA")
        background = Image.new("RGBA", image.size, "white")
        background.alpha_composite(image)
        return np.asarray(background.convert("RGB")).copy()


def recognize(engine, rgb, pass_name):
    blocks = []
    for result in engine.predict(np.ascontiguousarray(rgb[:, :, ::-1])):
        if "error" in result:
            raise RuntimeError(str(result["error"]))
        texts, scores, polygons = result["rec_texts"], result["rec_scores"], result["rec_polys"]
        if not len(texts) == len(scores) == len(polygons):
            raise RuntimeError("El motor devolvió textos y coordenadas desalineados.")
        for text, score, polygon in zip(texts, scores, polygons):
            if not str(text).strip():
                continue
            poly = np.asarray(polygon, dtype=float)
            if poly.shape != (4, 2) or not np.isfinite(poly).all() or not np.isfinite(score):
                raise RuntimeError("Resultado OCR inválido.")
            blocks.append({"text": str(text), "confidence": float(score),
                           "polygon_px": poly.tolist(),
                           "bbox_px": [float(poly[:, 0].min()), float(poly[:, 1].min()),
                                       float(poly[:, 0].max()), float(poly[:, 1].max())],
                           "pass": pass_name})
    return blocks


def overlap(a, b):
    x1, y1, x2, y2 = a
    u1, v1, u2, v2 = b
    intersection = max(0, min(x2, u2)-max(x1, u1)) * max(0, min(y2, v2)-max(y1, v1))
    union = max(0, x2-x1)*max(0, y2-y1) + max(0, u2-u1)*max(0, v2-v1) - intersection
    return intersection / union if union else 0


def read_page(engine, rgb, quality="accurate"):
    original = recognize(engine, rgb, "original")
    enhanced = []
    if quality == "accurate":
        # Geometría intacta: contraste local para sombras sin deformar los polígonos.
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        lab[:, :, 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lab[:, :, 0])
        enhanced = recognize(engine, cv2.cvtColor(lab, cv2.COLOR_LAB2RGB), "contrast")
    merged = []
    used = set()
    for block in original:
        matches = [(overlap(block["bbox_px"], b["bbox_px"]), i) for i, b in enumerate(enhanced) if i not in used]
        score, index = max(matches, default=(0, -1))
        candidates = [block]
        reasons = []
        chosen = block
        if score >= 0.55:
            other = enhanced[index]
            used.add(index)
            candidates.append(other)
            if block["text"] != other["text"]:
                reasons.append("readings_disagree")
                # No reemplazar identificadores ni importes ante discrepancia numérica.
                numeric_conflict = re.findall(r"\d+", block["text"]) != re.findall(r"\d+", other["text"])
                if numeric_conflict:
                    reasons.append("numeric_disagreement")
                elif other["confidence"] > block["confidence"] + 0.03:
                    chosen = other
        merged.append({**chosen, "raw_text": block["text"], "candidates": candidates,
                       "review_reasons": reasons})
    for i, block in enumerate(enhanced):
        if i in used:
            continue
        # Si cambió la segmentación no duplicar líneas superpuestas en el texto final.
        if any(overlap(block["bbox_px"], b["bbox_px"]) > 0.15 for b in original):
            continue
        merged.append({**block, "raw_text": block["text"], "candidates": [block],
                       "review_reasons": ["only_detected_in_contrast_pass"]})
    for block in merged:
        if block["confidence"] < 0.9:
            block["review_reasons"].append("low_confidence")
        if re.search(r"(?<!\w)(?=[0-9OoIl|.,/-]*\d)(?=[0-9OoIl|.,/-]*[OoIl|])[0-9OoIl|.,/-]+(?!\w)", block["text"]):
            block["review_reasons"].append("possible_digit_letter_confusion")
        block["needs_review"] = bool(block["review_reasons"])
    return merged, {"original": original, "contrast": enhanced}


def arrange_blocks(blocks):
    """Agrupar por fila geométrica; tabulador entre campos, sin unir sus textos."""
    rows = []
    for block in sorted(blocks, key=lambda b: (b["bbox_px"][1], b["bbox_px"][0])):
        x1, y1, x2, y2 = block["bbox_px"]
        center, height = (y1+y2)/2, max(1, y2-y1)
        row = next((r for r in reversed(rows) if abs(r["center"]-center) <= 0.4*min(r["height"], height)), None)
        if row is None:
            row = {"center": center, "height": height, "blocks": []}
            rows.append(row)
        row["blocks"].append(block)
    ordered, lines = [], []
    for row in sorted(rows, key=lambda r: r["center"]):
        items = sorted(row["blocks"], key=lambda b: b["bbox_px"][0])
        ordered.extend(items)
        lines.append("\t".join(b["text"] for b in items))
    return ordered, "\n".join(lines)
