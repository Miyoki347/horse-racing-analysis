"""
fetch_upcoming.py
今後2週間の土日の重賞レース出馬表を取得してSupabaseに保存する。
"""
import argparse
import io
import re
import sys
import time
import random
from datetime import date, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
load_dotenv()

from database.insert import supabase
from scrapers.scrape_shutuba import parse_shutuba

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://race.netkeiba.com/top/race_list.html",
}
RACE_LIST_URL = "https://race.netkeiba.com/top/race_list_sub.html?kaisai_date={date}"


def upcoming_weekends(weeks: int = 5) -> list[str]:
    today = date.today()
    end = today + timedelta(weeks=weeks)
    dates: list[str] = []
    current = today
    while current <= end:
        if current.weekday() in (5, 6):
            dates.append(current.strftime("%Y%m%d"))
        current += timedelta(days=1)
    return dates


def get_grade_race_ids(kaisai_date: str, session: requests.Session) -> list[str]:
    url = RACE_LIST_URL.format(date=kaisai_date)
    try:
        resp = session.get(url, headers=HEADERS, timeout=15)
        resp.encoding = "euc-jp"
        soup = BeautifulSoup(resp.text, "lxml")
    except requests.RequestException as e:
        print(f"  エラー {kaisai_date}: {e}")
        return []

    ids: list[str] = []
    seen: set[str] = set()
    for li in soup.select("li.RaceList_DataItem"):
        if "bg_jyoken" not in li.get("class", []):
            continue
        a = li.select_one("a[href*='race_id=']")
        if not a:
            continue
        m = re.search(r"race_id=(\d{12})", a.get("href", ""))
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            ids.append(m.group(1))
    return ids


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weeks", type=int, default=5, help="何週先まで取得するか（デフォルト5週≈1ヶ月）")
    args = parser.parse_args()

    session = requests.Session()
    dates = upcoming_weekends(args.weeks)
    print(f"対象日程 ({args.weeks}週間): {', '.join(dates)}")

    all_race_ids: list[str] = []
    for d in dates:
        ids = get_grade_race_ids(d, session)
        print(f"  {d}: 重賞 {len(ids)} レース発見")
        all_race_ids.extend(ids)
        time.sleep(random.uniform(1.0, 2.0))

    if not all_race_ids:
        print("出走予定の重賞レースが見つかりませんでした。")
        return

    print(f"\n合計 {len(all_race_ids)} レースの出馬表を取得します\n")

    supabase.table("upcoming_entries").delete().in_(
        "netkeiba_race_id", all_race_ids
    ).execute()

    ok = 0
    for race_id in all_race_ids:
        print(f"取得中: {race_id}... ", end="", flush=True)
        data = parse_shutuba(race_id)

        if not data or not data["entries"]:
            print("エントリーなし、スキップ")
            continue

        rows = [
            {
                "netkeiba_race_id": race_id,
                "race_name":        data["race_name"],
                "race_date":        data["race_date"],
                "course":           data["course"],
                "distance":         data["distance"],
                "track_type":       data["track_type"],
                "grade":            data["grade"],
                **entry,
            }
            for entry in data["entries"]
        ]
        supabase.table("upcoming_entries").upsert(
            rows, on_conflict="netkeiba_race_id,horse_number"
        ).execute()
        print(f"{data['race_name']} ({len(data['entries'])}頭)")
        ok += 1
        time.sleep(random.uniform(1.5, 3.0))

    print(f"\n完了: {ok}/{len(all_race_ids)} レース保存")


if __name__ == "__main__":
    main()
