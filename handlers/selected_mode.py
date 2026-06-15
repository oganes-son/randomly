import pandas as pd
import unicodedata
from flask import Blueprint, request, jsonify, session
import os

selected_mode_bp = Blueprint("selected", __name__)

COL_SUBJECT_NAME, COL_UNIT_NAME, COL_DIFFICULTY, COL_PROBLEM_NUMBER, COL_PROBLEM_TEXT, COL_IMAGE_FLAG, COL_SIMILAR = range(7)

def normalize(s):
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    if not os.path.exists(path): return pd.DataFrame()
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
df_chart = load_df(os.path.join(_ROOT, "aochart.xlsx"))
df_ex    = load_df(os.path.join(_ROOT, "aochart_ex.xlsx"))
df_4step = load_df(os.path.join(_ROOT, "4step.xlsx"))

@selected_mode_bp.route("/get_selected_problem", methods=["POST"])
def get_selected_problem():
    if not session.get("logged_in"): return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    book, unit, number = data.get("book"), str(data.get("unit", "")).strip(), str(data.get("number", "")).strip()

    if not unit or not number: return jsonify({"error": "単元または番号が未入力です"}), 400

    df_target = {"chart": df_chart, "ex": df_ex, "4step": df_4step}.get(book)
    if df_target is None or df_target.empty: return jsonify({"error": "指定された問題集のデータが見つかりません。"}), 404

    filtered = df_target[(df_target.iloc[:, COL_UNIT_NAME] == unit) & (df_target.iloc[:, COL_PROBLEM_NUMBER] == number)]
    if filtered.empty: return jsonify({"error": "指定された単元と番号に一致する問題が見つかりませんでした。"}), 200

    p = filtered.iloc[0]
    difficulty, problem_text = p.iloc[COL_DIFFICULTY], p.iloc[COL_PROBLEM_TEXT]
    image_flag = int(p.iloc[COL_IMAGE_FLAG]) if p.iloc[COL_IMAGE_FLAG].isdigit() else 0

    similar_count = 0
    if book == "4step":
        similar_raw = p.iloc[COL_SIMILAR]
        if similar_raw: similar_count = len(similar_raw.split(","))
    else:
        EQUIVALENT_UNITS = [{"数II微分法", "数II積分法", "数II微分法と積分法"}]
        search_units = {unit}
        for unit_group in EQUIVALENT_UNITS:
            if unit in unit_group: search_units = unit_group; break
        label, alt_label = normalize(f"EXERCISES {number}") if book == "ex" else normalize(number), normalize(f"{unit}{number}")
        for _, row in df_4step.iterrows():
            if row.iloc[COL_UNIT_NAME] in search_units and (raw_similar := row.iloc[COL_SIMILAR]):
                if any(tag in [normalize(s) for s in raw_similar.split(",")] for tag in [label, alt_label]):
                    similar_count += 1
                        
    response_data = {"unit_name": unit, "problem_number": number, "difficulty": difficulty, "equation": problem_text, "image_flag": image_flag, "similar_count": similar_count}

    # image_flagが1以上の場合、画像のパスリストを生成してレスポンスに追加
    if image_flag > 0:
        subject = p.iloc[COL_SUBJECT_NAME]
        book_prefix = "step" if book == "4step" else ("ex" if book == "ex" else "chart")
        
        image_paths = []
        if image_flag == 1:
            # 画像が1枚の場合
            path = f"static/images/{book_prefix}{subject}_{number}.png"
            image_paths.append(path)
        else:
            # 画像が複数枚の場合 (例: 3枚なら1, 2, 3とループ)
            for i in range(1, image_flag + 1):
                path = f"static/images/{book_prefix}{subject}_{number}({i}).png"
                image_paths.append(path)
        
        # ★修正: キーを複数形の `image_paths` に変更
        response_data["image_paths"] = image_paths
    
    return jsonify(response_data)