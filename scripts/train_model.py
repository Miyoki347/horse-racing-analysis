"""
train_model.py
過去レースデータでLightGBMを学習し model.pkl として保存する。

使い方:
    python -u scripts/train_model.py                     # 通常学習
    python -u scripts/train_model.py --tune              # Optunaチューニング後に学習
    python -u scripts/train_model.py --tune --n-trials 100
"""
import argparse
import json
import sys
import io
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import TimeSeriesSplit

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
    # 3-2: 血統適性スコア
    "sire_win_rate",
    "bms_win_rate",
    # 3-3: 騎手コーススタッツ
    "jockey_win_rate",
    "jockey_top3_rate",
    # 3-4: Jockey Index
    "jockey_index",
    # 3-7: 期待値スコア（人気 - 着順 の直近5走平均）
    "horse_ev_score",
    # A: 低寄与特徴量の強化（交互作用・組み合わせ）
    "turf_dist_inter",   # is_turf × dist_bucket
    "turf_cond_inter",   # is_turf × track_condition
    "sire_turf_rate",    # 父系×芝ダート 2-way複勝率（3-wayより密）
    "sire_bms_rate",     # 父系×母父系 combo × dist_bucket 複勝率
    # B: 未使用データの活用
    "avg_last3f",        # 上がり3F直近5走平均（小さいほど切れ味あり）
    "best_last3f",       # 上がり3F直近5走ベスト
    "horse_weight_abs",  # 馬体重絶対値
    "grade_score",       # レースグレード (G1=3, G2=2, G3=1, 他=0)
]


DEFAULT_PARAMS: dict = {
    "n_estimators":      500,
    "learning_rate":     0.05,
    "max_depth":         6,
    "num_leaves":        31,
    "min_child_samples": 20,
    "subsample":         0.8,
    "colsample_bytree":  0.8,
    "random_state":      42,
    "verbose":           -1,
}

PARAMS_PATH   = ROOT / "best_params.json"
SHAP_PATH     = ROOT / "shap_importance.png"
HISTORY_PATH  = ROOT / "model_history.json"

# jockey_course_stats.dist_bucket が文字列の場合のマッピング (Option B)
_DIST_BUCKET_STR: dict[str, int] = {
    "short": 0, "sprint": 0,
    "mile":  1,
    "middle": 2,
    "long":  3, "extended": 3,
}


_GRADE_MAP: dict[str, float] = {"G1": 3.0, "G2": 2.0, "G3": 1.0}


def _parse_dist_bucket(raw) -> int | None:
    """文字列または整数の dist_bucket を 0-3 の整数に変換。未知値は None。"""
    try:
        return int(raw)
    except (ValueError, TypeError):
        return _DIST_BUCKET_STR.get(str(raw).lower())


def p(msg: str):
    print(msg, flush=True)


def fetch_all() -> list[dict]:
    p("race_results を取得中...")
    rows, offset = [], 0
    while True:
        r = (
            supabase.table("race_results")
            .select(
                "horse_id, jockey_id, finish_position, popularity, time_index, "
                "last_3f_time, horse_weight, "
                "rest_weeks, is_jockey_changed, "
                "weight_carried, horse_weight_change, "
                "races(date, course, track_type, distance, track_condition, grade), "
                "horses(sire_line, bms_line), "
                "jockeys(jockey_index)"
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


def fetch_jockey_course_stats() -> dict[tuple, dict]:
    """jockey_course_stats から (jockey_id, course, dist_bucket) -> stats を返す。"""
    p("jockey_course_stats を取得中...")
    try:
        rows, offset = [], 0
        while True:
            r = (
                supabase.table("jockey_course_stats")
                .select("jockey_id, course, dist_bucket, win_rate, top3_rate")
                .range(offset, offset + 999)
                .execute()
            )
            batch = r.data or []
            rows.extend(batch)
            if len(batch) < 1000:
                break
            offset += 1000
        p(f"  → {len(rows)} 件完了")
        result = {}
        skipped = 0
        for r in rows:
            db = _parse_dist_bucket(r.get("dist_bucket", 0))
            if db is None:
                skipped += 1
                continue
            result[(r["jockey_id"], r.get("course", ""), db)] = {
                "win_rate":  r.get("win_rate"),
                "top3_rate": r.get("top3_rate"),
            }
        if skipped:
            p(f"  [INFO] dist_bucket 未知値によりスキップ: {skipped} 件")
        p(f"  → 有効: {len(result)} 件")
        return result
    except Exception as e:
        p(f"  [WARN] jockey_course_stats 取得失敗（スキップ）: {e}")
        return {}


def build_df(rows: list[dict]) -> pd.DataFrame:
    records = []
    for r in rows:
        race   = r.get("races")   or {}
        horse  = r.get("horses")  or {}
        jockey = r.get("jockeys") or {}
        records.append({
            "horse_id":            r["horse_id"],
            "jockey_id":           r.get("jockey_id"),
            "finish_position":     r.get("finish_position"),
            "popularity":          r.get("popularity"),
            "time_index":          r.get("time_index"),
            "last_3f_time":        r.get("last_3f_time"),
            "horse_weight":        r.get("horse_weight"),
            "rest_weeks":          r.get("rest_weeks"),
            "is_jockey_changed":   r.get("is_jockey_changed"),
            "weight_carried":      r.get("weight_carried"),
            "horse_weight_change": r.get("horse_weight_change"),
            "date":                race.get("date", ""),
            "course":              race.get("course", ""),
            "track_type":          race.get("track_type", "芝"),
            "distance":            race.get("distance", 0),
            "track_condition":     race.get("track_condition", 0),
            "grade":               race.get("grade"),
            # 3-2: 血統系統
            "sire_line":           horse.get("sire_line"),
            "bms_line":            horse.get("bms_line"),
            # 3-4: Jockey Index
            "jockey_index":        jockey.get("jockey_index"),
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


def engineer_features(df: pd.DataFrame, jockey_stats: dict[tuple, dict]) -> pd.DataFrame:
    p("特徴量を作成中...")

    df["is_turf"]     = (df["track_type"] == "芝").astype(float)
    df["dist_bucket"] = df["distance"].apply(dist_bucket).astype(float)
    df["target"]      = (df["finish_position"] <= 3).astype(int)

    # 直近5走タイム指数（当該レース除外・前走まで）
    ti = df.groupby("horse_id")["time_index"]
    df["avg_time_index"]  = ti.transform(lambda s: s.shift(1).rolling(5, min_periods=1).mean())
    df["best_time_index"] = ti.transform(lambda s: s.shift(1).rolling(5, min_periods=1).max())

    df["is_jockey_changed"]   = df["is_jockey_changed"].map({True: 1.0, False: 0.0}).astype(float)
    df["rest_weeks"]          = pd.to_numeric(df["rest_weeks"], errors="coerce").clip(0, 52)
    df["weight_carried"]      = pd.to_numeric(df["weight_carried"], errors="coerce")
    df["horse_weight_change"] = pd.to_numeric(df["horse_weight_change"], errors="coerce").fillna(0)

    # 3-2: 血統適性スコア（系統 × 距離区分 × 馬場状態 の複勝率）
    # transform で直接付与することで型不一致の merge エラーを回避
    for line_col, new_col in [("sire_line", "sire_win_rate"), ("bms_line", "bms_win_rate")]:
        group_key = [line_col, "dist_bucket", "track_condition"]
        df[new_col] = df.groupby(group_key, dropna=False)["target"].transform("mean")

    # 3-3: 騎手コーススタッツ（jockey_course_stats テーブルから取得済み）
    def _lookup_jockey_stats(row) -> tuple[float, float]:
        key = (row["jockey_id"], row["course"], int(row["dist_bucket"]))
        s = jockey_stats.get(key)
        if s:
            return s.get("win_rate"), s.get("top3_rate")
        return None, None

    if jockey_stats:
        df[["jockey_win_rate", "jockey_top3_rate"]] = df.apply(
            _lookup_jockey_stats, axis=1, result_type="expand"
        )
    else:
        df["jockey_win_rate"]  = np.nan
        df["jockey_top3_rate"] = np.nan

    df["jockey_win_rate"]  = pd.to_numeric(df["jockey_win_rate"],  errors="coerce")
    df["jockey_top3_rate"] = pd.to_numeric(df["jockey_top3_rate"], errors="coerce")

    # 3-4: Jockey Index
    df["jockey_index"] = pd.to_numeric(df["jockey_index"], errors="coerce")

    # 3-7: 期待値スコア（人気順位 - 着順 の直近5走平均、前走まで）
    # 正値 = 人気より上の成績を残す傾向（穴馬候補）、負値 = 過剰人気傾向
    pop = pd.to_numeric(df["popularity"], errors="coerce")
    df["_pop_diff"] = pop - df["finish_position"]
    ev = df.groupby("horse_id")["_pop_diff"]
    df["horse_ev_score"] = ev.transform(
        lambda s: s.shift(1).rolling(5, min_periods=1).mean()
    )
    df = df.drop(columns=["_pop_diff"])

    # A: 低寄与特徴量の強化 -----------------------------------------------

    # is_turf の交互作用（芝×距離、芝×馬場状態）
    df["turf_dist_inter"] = df["is_turf"] * df["dist_bucket"]
    df["turf_cond_inter"] = df["is_turf"] * pd.to_numeric(df["track_condition"], errors="coerce").fillna(0)

    # 父系×芝ダート 2-way 複勝率（元の3-wayよりグループ密度が高く安定）
    df["sire_turf_rate"] = df.groupby(
        ["sire_line", "is_turf"], dropna=False
    )["target"].transform("mean")

    # 父系×母父系 combo × dist_bucket 複勝率（配合適性スコア）
    df["_sire_bms"] = (
        df["sire_line"].fillna("Unknown") + "×" + df["bms_line"].fillna("Unknown")
    )
    df["sire_bms_rate"] = df.groupby(
        ["_sire_bms", "dist_bucket"], dropna=False
    )["target"].transform("mean")
    df = df.drop(columns=["_sire_bms"])

    # B: 未使用データの活用 -----------------------------------------------

    # 上がり3F直近5走（shift1で当該レース除外）小さいほど速い
    last3f = df.groupby("horse_id")["last_3f_time"]
    df["avg_last3f"]  = last3f.transform(lambda s: s.shift(1).rolling(5, min_periods=1).mean())
    df["best_last3f"] = last3f.transform(lambda s: s.shift(1).rolling(5, min_periods=1).min())

    # 馬体重絶対値
    df["horse_weight_abs"] = pd.to_numeric(df["horse_weight"], errors="coerce")

    # レースグレードスコア（G1=3, G2=2, G3=1, その他=0）
    df["grade_score"] = df["grade"].map(_GRADE_MAP).fillna(0.0)

    return df


def save_shap_plot(model: lgb.LGBMClassifier, X_test: pd.DataFrame) -> None:
    """SHAP特徴量重要度を計算してPNG保存する。"""
    import shap
    import matplotlib
    matplotlib.use("Agg")  # GUI不要のバックエンド
    import matplotlib.pyplot as plt

    p("\nSHAP値を計算中...")
    explainer  = shap.TreeExplainer(model)
    shap_vals  = explainer.shap_values(X_test)

    # LGBMClassifier 二値分類: バージョンにより list[2] または 2D array
    if isinstance(shap_vals, list):
        shap_vals = shap_vals[1]  # 正クラス（3着以内）側

    plt.figure(figsize=(10, 7))
    shap.summary_plot(shap_vals, X_test, plot_type="bar", show=False)
    plt.title("Feature Importance (SHAP mean |value|)", fontsize=13, pad=12)
    plt.tight_layout()
    plt.savefig(SHAP_PATH, dpi=150, bbox_inches="tight")
    plt.close()
    p(f"SHAP特徴量重要度を保存: {SHAP_PATH}")


def tune_hyperparams(df: pd.DataFrame, n_trials: int = 50) -> dict:
    """Optuna で TimeSeriesSplit CV を用いてハイパーパラメータを探索する。"""
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)

    split = "2025-01-01"
    train = df[df["date"] < split].copy()
    X, y  = train[FEATURES], train["target"]
    tscv  = TimeSeriesSplit(n_splits=5)

    def objective(trial: "optuna.Trial") -> float:
        params = {
            "n_estimators":      trial.suggest_int("n_estimators", 100, 1000),
            "learning_rate":     trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "max_depth":         trial.suggest_int("max_depth", 3, 10),
            "num_leaves":        trial.suggest_int("num_leaves", 15, 127),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 100),
            "subsample":         trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree":  trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_alpha":         trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda":        trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
            "random_state": 42,
            "verbose": -1,
        }
        aucs = []
        for tr_idx, val_idx in tscv.split(X):
            X_tr, X_val = X.iloc[tr_idx], X.iloc[val_idx]
            y_tr, y_val = y.iloc[tr_idx], y.iloc[val_idx]
            if y_val.nunique() < 2:
                continue
            clf = lgb.LGBMClassifier(**params)
            clf.fit(
                X_tr, y_tr,
                eval_set=[(X_val, y_val)],
                callbacks=[lgb.early_stopping(30, verbose=False)],
            )
            prob = clf.predict_proba(X_val)[:, 1]
            aucs.append(roc_auc_score(y_val, prob))
        return float(np.mean(aucs)) if aucs else 0.0

    p(f"Optuna チューニング開始（{n_trials} trials, TimeSeriesSplit×5）...")
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    p(f"\n最良 CV-AUC: {study.best_value:.4f}")
    p("最良パラメータ:")
    for k, v in study.best_params.items():
        p(f"  {k}: {v}")
    return study.best_params


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tune",     action="store_true", help="Optunaでハイパーパラメータをチューニング")
    parser.add_argument("--n-trials", type=int, default=50, help="Optunaの試行回数（デフォルト: 50）")
    args = parser.parse_args()

    rows          = fetch_all()
    jockey_stats  = fetch_jockey_course_stats()
    df            = build_df(rows)
    df            = engineer_features(df, jockey_stats)

    # avg_time_index がある行のみ（初出走馬は除外）
    df = df[df["avg_time_index"].notna()].copy()
    p(f"\n学習データ: {len(df)} 件（複勝率: {df['target'].mean():.1%}）")

    # ハイパーパラメータの決定
    if args.tune:
        best = tune_hyperparams(df, n_trials=args.n_trials)
        params = {**DEFAULT_PARAMS, **best}
        with open(PARAMS_PATH, "w", encoding="utf-8") as f:
            json.dump(params, f, indent=2, ensure_ascii=False)
        p(f"\nパラメータ保存完了: {PARAMS_PATH}")
    elif PARAMS_PATH.exists():
        with open(PARAMS_PATH, encoding="utf-8") as f:
            params = json.load(f)
        p(f"\n保存済みパラメータを読み込み: {PARAMS_PATH}")
    else:
        params = DEFAULT_PARAMS.copy()
        p("\nデフォルトパラメータを使用（--tune でチューニング可能）")

    # 時系列分割: 2025年以前で学習、2025年以降でテスト
    split = "2025-01-01"
    train = df[df["date"] < split]
    test  = df[df["date"] >= split]
    p(f"  train: {len(train)} 件 / test: {len(test)} 件")

    X_train, y_train = train[FEATURES], train["target"]
    X_test,  y_test  = test[FEATURES],  test["target"]

    p("\nLightGBMを学習中...")
    model = lgb.LGBMClassifier(**params)
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

    # 3-6: SHAP可視化
    save_shap_plot(model, X_test)

    # api/main.py が参照するパスに保存
    api_model_path = ROOT.parent.parent / "api" / "model.pkl"
    api_model_path.parent.mkdir(exist_ok=True)
    with open(api_model_path, "wb") as f:
        pickle.dump(model, f)
    p(f"\nモデル保存完了: {api_model_path}")

    # predict_upcoming.py 用にスクリプト隣にもコピー
    local_path = ROOT / "model.pkl"
    with open(local_path, "wb") as f:
        pickle.dump(model, f)
    p(f"モデルコピー完了: {local_path}")

    # 学習履歴を model_history.json に追記 + Supabase に保存
    run_at  = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    record  = {
        "run_at":   run_at,
        "test_auc": round(auc, 6),
        "tuned":    args.tune,
        "params":   params,
        "features": FEATURES,
    }

    history: list[dict] = []
    if HISTORY_PATH.exists():
        with open(HISTORY_PATH, encoding="utf-8") as f:
            history = json.load(f)
    history.append(record)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)
    p(f"学習履歴保存完了: {HISTORY_PATH}")

    try:
        supabase.table("model_reports").insert(record).execute()
        p("Supabase model_reports に保存完了")
    except Exception as e:
        p(f"[WARN] Supabase 保存スキップ（テーブル未作成の可能性）: {e}")


if __name__ == "__main__":
    main()
