from __future__ import annotations

import io
import json
from pathlib import Path
 
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "hc02_final_model.keras"
CONFIG_PATH = BASE_DIR / "hc02_config.json"

class InferenceError(ValueError):
    pass

with CONFIG_PATH.open("r", encoding="utf-8") as fh:
    CONFIG = json.load(fh)

CLASSES = list(CONFIG["classes"])
INPUT_LENGTH = int(CONFIG["input_length"])
USABLE_THRESHOLD = float(CONFIG["usable_threshold"])
SAMPLING_RATE = int(CONFIG.get("sampling_rate", 360))

_model = None


def _get_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise RuntimeError("The trained model file is missing.")
        try:
            import tensorflow as tf
            # Load the supplied Keras package exactly as provided. No architecture
            # is reconstructed here and no training occurs.
            _model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        except Exception as exc:
            raise RuntimeError("The trained ECG model could not be loaded.") from exc
    return _model


def parse_csv(raw: bytes) -> np.ndarray:
    if not raw:
        raise InferenceError("The uploaded CSV is empty.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise InferenceError("The CSV must be UTF-8 text.") from exc

    # Accept a one-column CSV with an optional header such as "ecg".
    # Also accept a single numeric column with whitespace around values.
    rows = []
    for line_no, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        # Allow the common one-column header. Any other non-numeric token is rejected.
        if not rows and line.lower() in {"ecg", "sample", "value", "signal"}:
            continue

        # Reject multi-column rows rather than silently selecting one column.
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 1:
            raise InferenceError(f"Row {line_no} contains more than one column.")

        try:
            value = float(parts[0])
        except ValueError as exc:
            raise InferenceError(f"Row {line_no} contains a non-numeric value.") from exc

        if not np.isfinite(value):
            raise InferenceError(f"Row {line_no} contains NaN or infinity.")
        rows.append(value)

    if len(rows) != INPUT_LENGTH:
        raise InferenceError(
            f"Expected exactly {INPUT_LENGTH} numeric ECG samples; received {len(rows)}."
        )

    return np.asarray(rows, dtype=np.float32)


def _explanation(final_decision: str) -> str:
    return {
        "USABLE": "Signal quality is sufficient for downstream ECG analysis.",
        "DEGRADED": "Signal quality shows degradation. Review the recording before downstream analysis.",
        "REACQUIRE": "Severe signal corruption detected. Obtain a new ECG recording.",
    }[final_decision]


def predict_samples(samples: np.ndarray) -> dict:
    if samples.shape != (INPUT_LENGTH,):
        raise InferenceError(f"Expected {INPUT_LENGTH} samples.")

    model = _get_model()

    # IMPORTANT: no normalization or other signal transformation is performed here.
    # The supplied model receives the uploaded/prepared waveform in its expected
    # (360, 1) representation.
    x = samples.reshape(1, INPUT_LENGTH, 1)

    try:
        raw = model.predict(x, verbose=0)
        probabilities = np.asarray(raw, dtype=np.float64).reshape(-1)
    except Exception as exc:
        raise RuntimeError("Model inference failed.") from exc

    if probabilities.size != len(CLASSES):
        raise RuntimeError("The model returned an unexpected number of class probabilities.")
    if not np.all(np.isfinite(probabilities)):
        raise RuntimeError("The model returned invalid probabilities.")

    # Consume the model's softmax output as returned. Do not renormalize it.
    probs = {cls: float(probabilities[i]) for i, cls in enumerate(CLASSES)}
    prediction_index = int(np.argmax(probabilities))
    model_prediction = CLASSES[prediction_index]
    confidence = float(np.max(probabilities))

    safety_gate_applied = (
        model_prediction == "USABLE" and probs["USABLE"] < USABLE_THRESHOLD
    )
    final_decision = "DEGRADED" if safety_gate_applied else model_prediction

    explanation = (
        f"USABLE probability did not meet the {USABLE_THRESHOLD:.0%} acceptance threshold, "
        "therefore the final decision was conservatively downgraded to DEGRADED."
        if safety_gate_applied
        else _explanation(final_decision)
    )

    return {
        "input_length": INPUT_LENGTH,
        "probabilities": probs,
        "model_prediction": model_prediction,
        "final_decision": final_decision,
        "confidence": confidence,
        "usable_threshold": USABLE_THRESHOLD,
        "safety_gate_applied": safety_gate_applied,
        "explanation": explanation,
        "sampling_rate": SAMPLING_RATE,
    }


def predict_csv_bytes(raw: bytes, filename: str) -> dict:
    if not filename.lower().endswith(".csv"):
        raise InferenceError("Only .csv files are accepted.")
    samples = parse_csv(raw)
    return predict_samples(samples)
