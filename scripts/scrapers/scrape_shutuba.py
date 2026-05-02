"""
scrape_shutuba.py
netkeiba の shutuba.html から出走予定馬のエントリーを取得する。
"""
import re
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://race.netkeiba.com/top/race_list.html",
}


def parse_shutuba(race_id: str) -> dict | None:
    url = f"https://race.netkeiba.com/race/shutuba.html?race_id={race_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        resp.encoding = "euc-jp"
    except requests.RequestException as e:
        print(f"  リクエスト失敗 {race_id}: {e}")
        return None

    soup = BeautifulSoup(resp.text, "lxml")

    title_el = soup.select_one("title")
    title_text = title_el.get_text() if title_el else ""

    name_m = re.search(r"^(.+?)(?:\(([^)]+)\))?\s*出馬表", title_text)
    race_name = name_m.group(1).strip() if name_m else ""
    grade     = name_m.group(2) if name_m and name_m.group(2) else None

    date_m    = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", title_text)
    race_date = (
        f"{date_m.group(1)}-{int(date_m.group(2)):02d}-{int(date_m.group(3)):02d}"
        if date_m else None
    )

    course_m = re.search(r"\|\s*\d{4}年\d{1,2}月\d{1,2}日\s+(\S+?)\d+R", title_text)
    course   = course_m.group(1).strip() if course_m else None

    rd = soup.select_one(".RaceData01")
    rd_text = rd.get_text() if rd else ""
    track_m  = re.search(r"(芝|ダート)(\d+)m", rd_text)
    track_type = track_m.group(1) if track_m else None
    distance   = int(track_m.group(2)) if track_m else None

    entries: list[dict] = []
    for row in soup.select("tr.HorseList"):
        tds = row.find_all("td")
        if len(tds) < 8:
            continue

        def cell(idx: int) -> str:
            if idx >= len(tds):
                return ""
            a = tds[idx].select_one("a")
            return (a.get_text(strip=True) if a else tds[idx].get_text(strip=True))

        post_pos_s   = cell(0)
        horse_num_s  = cell(1)
        horse_name   = cell(3)
        weight_car_s = cell(5)
        jockey_name  = cell(6)
        trainer_name = cell(7)

        hw_text = cell(8)
        hw_m = re.match(r"(\d+)\(([+-]?\d+)\)", hw_text)
        horse_weight        = int(hw_m.group(1)) if hw_m else None
        horse_weight_change = int(hw_m.group(2)) if hw_m else None

        odds_s       = cell(9)
        popularity_s = cell(10)

        try:
            weight_carried = float(weight_car_s) if weight_car_s else None
        except ValueError:
            weight_carried = None

        try:
            odds = float(odds_s) if odds_s and odds_s not in ("-", "") else None
        except ValueError:
            odds = None

        try:
            popularity = int(popularity_s) if popularity_s and popularity_s not in ("-", "") else None
        except ValueError:
            popularity = None

        if not horse_name:
            continue

        entries.append({
            "post_position":       int(post_pos_s)  if post_pos_s.isdigit()  else None,
            "horse_number":        int(horse_num_s) if horse_num_s.isdigit() else None,
            "horse_name":          horse_name,
            "jockey_name":         jockey_name,
            "trainer_name":        trainer_name,
            "weight_carried":      weight_carried,
            "horse_weight":        horse_weight,
            "horse_weight_change": horse_weight_change,
            "odds":                odds,
            "popularity":          popularity,
        })

    return {
        "netkeiba_race_id": race_id,
        "race_name":        race_name,
        "race_date":        race_date,
        "course":           course,
        "distance":         distance,
        "track_type":       track_type,
        "grade":            grade,
        "entries":          entries,
    }
