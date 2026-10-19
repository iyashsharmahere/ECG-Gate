import threading
from pathlib import Path
from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

from inference import predict_csv_bytes, InferenceError, _get_model

BASE_DIR = Path(__file__).resolve().parent
DEMO_DIR = BASE_DIR / "demo_data"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
ALLOWED_EXTENSIONS = {"csv"}

_model_ready = False

def _warmup_model():
    global _model_ready
    try:
        _get_model()
        _model_ready = True
        app.logger.info("Model preloaded and warmed up successfully.")
    except Exception as exc:
        app.logger.error("Failed to preload model: %s", exc)

# Start background preload thread immediately
threading.Thread(target=_warmup_model, daemon=True).start()


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_ready": _model_ready
    })


@app.post("/predict")
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No CSV file was provided."}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Please choose a CSV file."}), 400

    filename = secure_filename(file.filename)
    if not allowed_file(filename):
        return jsonify({"error": "Only .csv files are accepted."}), 400

    try:
        result = predict_csv_bytes(file.read(), filename)
        return jsonify(result)
    except InferenceError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        # Deliberately avoid exposing server-side tracebacks to the browser.
        app.logger.exception("Unexpected inference failure")
        return jsonify({"error": "The ECG could not be analyzed. Check the server logs for details."}), 500


@app.get("/demo/<path:filename>")
def demo(filename):
    safe = secure_filename(filename)
    return send_from_directory(DEMO_DIR, safe)


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "The uploaded file is too large."}), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
