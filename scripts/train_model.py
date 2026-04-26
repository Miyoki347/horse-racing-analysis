"""
train_model.py
過去レースデータでLightGBMを学習し model.pkl として保存する。

使い方:
    python -u scripts/train_model.py
"""
import sys
import io
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import roc_auc_score

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv()

from database.insert import supabase

FEATURES = [
    "avg_time_index",
    "best_time_index",
    "rest_weeks",
    "is_jockey_changed",
    "weight_carried",
    "horse_weight_change",
    "track_condition",
    "is_turf",
    "dist_bucket",
]


def p(msg: str):
    print(msg, flush=True)


def fetch_all() -> list[dict]:
    p("race_results を取得中...")
    rows, offset = [], 0
    while True:
        r = (
            supabase.table("race_results")
            .select(
                "horse_id, finish_position, time_index, "
                "rest_weeks, is_jockey_changed, "
                "weight_carried, horse_weight_change, "
                "races(date, track_type, distance, track_condition)"
            )
            .range(offset, offset + 999)
            .execute()
        )
        batch = r.data or []
        rows.extend(batch)
        p(f"  {len(rows)} 件取得中...")
        if len(batch) < 1000:
            break
        offset += 1000
    p(f"  → {len(rows)} 件完了")
    return rows


def build_df(rows: list[dict]) -> pd.DataFrame:
    records = []
    for r in rows:
        race = r.get("races") or {}
        records.append({
            "horse_id":            r["horse_id"],
            "finish_position":     r.get("finish_position"),
            "time_index":          r.get("time_index"),
            "rest_weeks":          r.get("rest_weeks"),
            "is_jockey_changed":   r.get("is_jockey_changed"),
            "weight_carried":      r.get("weight_carried"),
            "horse_weight_change": r.get("horse_weight_change"),
            "date":                race.get("date", ""),
            "track_type":          race.get("track_type", "芝"),
            "distance":            race.get("distance", 0),
            "track_condition":     race.get("track_condition", 0),
        })
    df = pd.DataFrame(records)
    df = df[df["finish_position"].notna()].copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["horse_id", "date"]).reset_index(drop=True)
    return df


def dist_bucket(d: int) -> int:
    if d <= 1400: return 0
    if d <= 1800: return 1
    if d <= 2200: return 2
    return 3


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    p("特徴量を作成中...")

    df["is_turf"]    = (df["track_type"] == "芝").astype(float)
    df["dist_bucket"] = df["distance"].apply(dist_bucket).astype(float)

    # 直近5走タイム指数（当該レース除外・前走まで）
    ti = df.groupby("horse_id")["time_index"]
    df["avg_time_index"]  = ti.transform(lambda s: s.shift(1).rolling(5, min_periods=1).mean())
    df["best_time_index"] = ti.transform(lambda s: s.shift(1).rolling(5, min_periods=1).max())

    df["is_jockey_changed"] = df["is_jockey_changed"].map({True: 1.0, False: 0.0}).astype(float)
    df["rest_weeks"]        = pd.to_numeric(df["rest_weeks"], errors="coerce").clip(0, 52)
    df["weight_carried"]    = pd.to_numeric(df["weight_carried"], errors="coerce")
    df["horse_weight_change"] = pd.to_numeric(df["horse_weight_change"], errors="coerce").fillna(0)

    df["target"] = (df["finish_position"] <= 3).astype(int)
    return df


def main():
    rows = fetch_all()
    df   = build_df(rows)
    df   = engineer_features(df)

    # avg_time_index がある行のみ（初出走馬は除外）
    df = df[df["avg_time_index"].notna()].copy()
    p(f"\n学習データ: {len(df)} 件（複勝率: {df['target'].mean():.1%}）")

    # 時系列分割: 2025年以前で学習、2025年以降でテスト
    split = "2025-01-01"
    train = df[df["date"] < split]
    test  = df[df["date"] >= split]
    p(f"  train: {len(train)} 件 / test: {len(test)} 件")

    X_train, y_train = train[FEATURES], train["target"]
    X_test,  y_test  = test[FEATURES],  test["target"]

    p("\nLightGBMを学習中...")
    model = lgb.LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=31,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbose=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(50)],
    )

    prob = model.predict_proba(X_test)[:, 1]
    auc  = roc_auc_score(y_test, prob)
    p(f"\nテストAUC: {auc:.4f}")

    p("\n特徴量重要度:")
    for feat, imp in sorted(zip(FEATURES, model.feature_importances_), key=lambda x: -x[1]):
        p(f"  {feat:25s}: {imp}")

    model_path = ROOT / "model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    p(f"\nモデル保存完了: {model_path}")


if __name__ == "__main__":
    main()
