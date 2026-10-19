# ECG-GATE — HC-02

Premium Flask presentation/inference layer for the supplied `hc02_final_model.keras`.

## Integrity

- The supplied Keras model package is preserved as provided.
- No training occurs.
- The browser never fabricates prediction values.
- `/predict` returns the model's three probabilities and applies the configured 0.90 USABLE safety gate.
- No browser-side normalization is performed.
- Development/demo CSVs are optional; missing demo files are reported rather than synthesized.

## Run

```powershell
cd ECG-GATE
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open: http://127.0.0.1:5000

If PowerShell blocks activation, use:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

## CSV format

A one-column CSV with exactly 360 finite numeric values. An optional first-line header such as `ecg` is accepted.

Example:

```csv
ecg
0.1823
0.1974
...
```

No extra preprocessing is applied by `inference.py`; values are reshaped to `(1, 360, 1)` and passed to the supplied model.

## Demo data

Place real 360-sample CSVs in `demo_data/` using:

- `clean_ecg.csv`
- `noise_20db.csv`
- `noise_10db.csv`
- `baseline_wander.csv`
- `noise_3db.csv`
- `dropout_30.csv`

The UI will gracefully report a missing file.

## Hackathon note

The supplied development metrics are presentation values and must not be described as clinical validation.
