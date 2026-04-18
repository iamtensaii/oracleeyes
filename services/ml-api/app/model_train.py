"""
Train sklearn classifier; persist with joblib.
"""

from __future__ import annotations

import json
import uuid
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from app.features import build_features_and_labels
from app.schemas import OhlcBarIn


def artifact_dir(base: Path) -> Path:
    d = base / ".artifacts" / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def train_model(
    bars: list[OhlcBarIn],
    base_path: Path,
    test_fraction: float,
    horizon: int,
) -> tuple[str, float, float, int, int, int, float, float, float]:
    X, y = build_features_and_labels(bars, horizon=horizon)
    if len(X) < 50:
        raise ValueError("Need at least 50 rows after feature construction")

    X_train, X_test, y_train, y_test = train_test_split(
        X.to_numpy(),
        y,
        test_size=test_fraction,
        shuffle=False,
    )

    y_train_arr = np.asarray(y_train)
    y_test_arr = np.asarray(y_test)
    majority_label = int(Counter(y_train_arr.tolist()).most_common(1)[0][0])
    baseline_majority_test_accuracy = float(np.mean(y_test_arr == majority_label))
    baseline_always_flat_test_accuracy = float(np.mean(y_test_arr == 0))
    uniq_labels = np.unique(np.concatenate([y_train_arr, y_test_arr]))
    baseline_random_expected_accuracy = (
        float(1.0 / len(uniq_labels)) if len(uniq_labels) > 0 else 0.0
    )

    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        random_state=42,
        class_weight="balanced_subsample",
    )
    clf.fit(X_train, y_train)

    pred_tr = clf.predict(X_train)
    pred_te = clf.predict(X_test)
    acc_tr = float(accuracy_score(y_train, pred_tr))
    acc_te = float(accuracy_score(y_test, pred_te))

    model_id = str(uuid.uuid4())
    out = artifact_dir(base_path) / model_id
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, out / "model.joblib")
    meta = {
        "model_id": model_id,
        "horizon": horizon,
        "n_features": X.shape[1],
        "feature_names": list(X.columns),
    }
    (out / "metadata.json").write_text(json.dumps(meta), encoding="utf-8")

    return (
        model_id,
        acc_tr,
        acc_te,
        len(y_train),
        len(y_test),
        majority_label,
        baseline_majority_test_accuracy,
        baseline_always_flat_test_accuracy,
        baseline_random_expected_accuracy,
    )


def load_model(base_path: Path, model_id: str) -> RandomForestClassifier:
    p = artifact_dir(base_path) / model_id / "model.joblib"
    if not p.exists():
        raise FileNotFoundError(f"Model not found: {model_id}")
    return joblib.load(p)


def predict_latest(
    clf: RandomForestClassifier,
    bars: list[OhlcBarIn],
    horizon: int,
) -> tuple[int, list[float]]:
    X, _ = build_features_and_labels(bars, horizon=horizon)
    if len(X) == 0:
        raise ValueError("No features for prediction")
    row = X.iloc[[-1]].to_numpy()
    pred = int(clf.predict(row)[0])
    proba = clf.predict_proba(row)[0].tolist()
    return pred, proba
