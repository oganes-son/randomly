import pandas as pd
import unicodedata
from flask import Blueprint, request, jsonify, session
import os

# Blueprintの定義
aochart_bp = Blueprint("aochart", __name__)

# --- 定数定義 (Excelファイルの列インデックス) ---
COL_SUBJECT_NAME     = 0
COL_UNIT_NAME        = 1
COL_DIFFICULTY       = 2
COL_PROBLEM_NUMBER   = 3
COL_PROBLEM_TEXT     = 4
COL_IMAGE_FLAG       = 5
COL_SIMILAR          = 6

# --- ヘルパー関数 ---
def normalize(s):
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    if not os.path.exists(path):
        print(f"エラー: データファイルが見つかりません: {path}")
        return pd.DataFrame()
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

# --- データ読み込み ---
df_chart = load_df("aochart.xlsx")
df_ex = load_df("aochart_ex.xlsx")
df_4step = load_df("4step.xlsx")

@aochart_bp.route("/get_problem", methods=["POST"])
def get_problem_aochart():
    """
    青チャートまたはEXERCISESからランダムに問題を取得し、統一されたJSON形式で返す。
    """
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    units = [str(u).strip() for u in data.get("units", [])]
    difficulties = [str(d).strip() for d in data.get("difficulties", [])]
    book = data.get("book", "all")

    df_source = None
    if book == "chart":
        df_source = df_chart
    elif book == "ex":
        df_source = df_ex
    else:
        df_source = pd.concat([df_chart, df_ex], ignore_index=True)

    df_filtered = df_source[df_source.iloc[:, COL_UNIT_NAME].isin(units)]
    if difficulties:
        df_filtered = df_filtered[df_filtered.iloc[:, COL_DIFFICULTY].isin(difficulties)]

    if df_filtered.empty:
        return jsonify({"error": "条件に合致する問題が見つかりませんでした。"}), 200

    p = df_filtered.sample(1).iloc[0]

    unit = p.iloc[COL_UNIT_NAME]
    number = p.iloc[COL_PROBLEM_NUMBER]
    difficulty = p.iloc[COL_DIFFICULTY]
    equation = p.iloc[COL_PROBLEM_TEXT]
    image_flag = int(p.iloc[COL_IMAGE_FLAG]) if p.iloc[COL_IMAGE_FLAG].isdigit() else 0
    
    # 類題件数の計算
    similar_count = 0
    # bookが'all'の場合、元の問題集を特定する必要がある
    effective_book = book
    if book == 'all':
        # df_exに同じ単元・番号の問題があればexとみなし、なければchartとみなす
        if not df_ex[(df_ex.iloc[:, COL_UNIT_NAME] == unit) & (df_ex.iloc[:, COL_PROBLEM_NUMBER] == number)].empty:
            effective_book = 'ex'
        else:
            effective_book = 'chart'

    label = normalize(f"EXERCISES {number}") if effective_book == "ex" else normalize(number)
    alt_label = normalize(f"{unit}{number}")
    for _, row in df_4step.iterrows():
        raw = row.iloc[COL_SIMILAR]
        if raw and any(tag in [normalize(s) for s in raw.split(",")] for tag in [label, alt_label]):
            similar_count += 1

    # --- ★★★ここから修正★★★ ---
    # フロントエンドで一貫して扱えるように、レスポンス用の辞書を定義
    response_data = {
        "unit_name": unit,
        "problem_number": number,
        "difficulty": difficulty,
        "equation": equation,
        "image_flag": image_flag,
        "similar_count": similar_count,
        "book": effective_book # 実際に選ばれた問題集の種類を返す
    }

    # image_flagが1の場合、画像のパスを生成してレスポンスに追加
    if image_flag == 1:
        subject = p.iloc[COL_SUBJECT_NAME]
        book_prefix = "ex" if effective_book == "ex" else "chart"
        image_path = f"static/images/{book_prefix}{subject}_{number}.png"
        response_data["image_path"] = image_path
    
    # 最終的なレスポンスをJSON形式で返す
    return jsonify(response_data)