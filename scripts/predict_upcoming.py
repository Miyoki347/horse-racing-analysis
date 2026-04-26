"""
predict_upcoming.py
出走予定馬のml_scoreを予測してSupabaseに保存する。

使い方:
    python -u scripts/predict_upcoming.py
"""
import sys
import io
import pickle
from pathlib import Path
from datetime import datetime
from collections import defaultdict

import numpy as np
import pandas as pd

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


def dist_bucket(d: int) -> int:
    if d <= 1400: return 0
    if d <= 1800: return 1
    if d <= 2200: return 2
    return 3


def is_same_jockey(a: str | None, b: str | None) -> bool | None:
    if not a or not b:
        return None
    return a.startswith(b) or b.startswith(a)


def main():
    model_path = ROOT / "model.pkl"
    if not model_path.exists():
        p("[ERROR] model.pkl が見つかりません。先に train_model.py を実行してください。")
        sys.exit(1)

    with open(model_path, "rb") as f:
        model = pickle.load(f)
    p("モデル読み込み完了")

    # 出走予定を取得
    p("upcoming_entries を取得中...")
    res     = supabase.table("upcoming_entries").select("*").execute()
    entries = res.data or []
    p(f"  {len(entries)} 件")

    if not entries:
        p("出走予定データがありません。")
        return

    # 馬名 → horse_id
    horse_names = list({e["horse_name"] for e in entries})
    res = supabase.table("horses").select("id, name").in_("name", horse_names).execute()
    name_to_id = {h["name"]: h["id"] for h in (res.data or [])}
    horse_ids  = list(name_to_id.values())

    # 過去成績を一括取得
    p("過去成績を取得中...")
    hist_map: dict[str, list] = defaultdict(list)
    if horse_ids:
        res = (
            supabase.table("race_results")
            .select("horse_id, time_index, jockeys(name), races(date)")
            .in_("horse_id", horse_ids)
            .execute()
        )
        for r in (res.data or []):
            date_str = (r.get("races") or {}).get("date", "")
            ti       = r.get("time_index")
            jk_name  = (r.get("jockeys") or {}).get("name")
            if date_str:
                hist_map[r["horse_id"]].append((date_str, ti, jk_name))

    for hid in hist_map:
        hist_map[hid].sort(key=lambda x: x[0])

    # 特徴量計算 → 予測
    p("スコアを予測中...")
    updates = []

    for entry in entries:
        horse_id = name_to_id.get(entry["horse_name"])
        history  = hist_map.get(horse_id, []) if horse_id else []

        race_date = entry.get("race_date", "")
        past      = [(d, ti, jk) for d, ti, jk in history if d < race_date]

        ti_vals = [ti for _, ti, _ in past if ti is not None][-5:]
        avg_ti  = float(np.mean(ti_vals)) if ti_vals else np.nan
        best_ti = float(np.max(ti_vals))  if ti_vals else np.nan

        if past and race_date:
            delta      = (datetime.strptime(race_date, "%Y-%m-%d") - datetime.strptime(past[-1][0], "%Y-%m-%d")).days
            rest_weeks = float(delta // 7)
        else:
            rest_weeks = np.nan

        same              = is_same_jockey(past[-1][2] if past else None, entry.get("jockey_name"))
        is_jockey_changed = 0.0 if same is True else (1.0 if same is False else np.nan)

        feat = {
            "avg_time_index":      avg_ti,
            "best_time_index":     best_ti,
            "rest_weeks":          rest_weeks,
            "is_jockey_changed":   is_jockey_changed,
            "weight_carried":      float(entry["weight_carried"]) if entry.get("weight_carried") else np.nan,
            "horse_weight_change": float(entry["horse_weight_change"]) if entry.get("horse_weight_change") else 0.0,
            "track_condition":     0.0,
            "is_turf":             1.0 if entry.get("track_type") == "芝" else 0.0,
            "dist_bucket":         float(dist_bucket(entry.get("distance") or 0)),
        }

        X     = pd.DataFrame([feat])[FEATURES]
        score = float(model.predict_proba(X)[0, 1])
        updates.append({"id": entry["id"], "ml_score": round(score, 4)})

    p(f"DB更新中... {len(updates)} 件")
    for upd in updates:
        supabase.table("upcoming_entries")\
            .update({"ml_score": upd["ml_score"]})\
            .eq("id", upd["id"])\
            .execute()

    p(f"完了: {len(updates)} 件更新")


if __name__ == "__main__":
    main()
