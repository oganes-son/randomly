import pandas as pd
import unicodedata
from flask import Blueprint, request, jsonify, session
import os

aochart_bp = Blueprint("aochart", __name__)

COL_SUBJECT_NAME, COL_UNIT_NAME, COL_DIFFICULTY, COL_PROBLEM_NUMBER, COL_PROBLEM_TEXT, COL_IMAGE_FLAG, COL_SIMILAR = range(7)

def normalize(s):
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    if not os.path.exists(path): return pd.DataFrame()
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

df_chart, df_ex, df_4step = load_df("aochart.xlsx"), load_df("aochart_ex.xlsx"), load_df("4step.xlsx")

@aochart_bp.route("/get_problem", methods=["POST"])
def get_problem_aochart():
    if not session.get("logged_in"): return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    units, difficulties, book = [str(u).strip() for u in data.get("units", [])], [str(d).strip() for d in data.get("difficulties", [])], data.get("book", "all")

    df_source = pd.concat([df_chart, df_ex]) if book == "all" else (df_ex if book == "ex" else df_chart)
    df_filtered = df_source[df_source.iloc[:, COL_UNIT_NAME].isin(units)]
    if difficulties:
        df_filtered = df_filtered[df_filtered.iloc[:, COL_DIFFICULTY].isin(difficulties)]

    if df_filtered.empty: return jsonify({"error": "条件に合致する問題が見つかりませんでした。"}), 200

    p = df_filtered.sample(1).iloc[0]
    unit, number, difficulty, equation = p.iloc[COL_UNIT_NAME], p.iloc[COL_PROBLEM_NUMBER], p.iloc[COL_DIFFICULTY], p.iloc[COL_PROBLEM_TEXT]
    image_flag = int(p.iloc[COL_IMAGE_FLAG]) if p.iloc[COL_IMAGE_FLAG].isdigit() else 0
    
    effective_book = book
    if book == 'all':
        effective_book = 'ex' if not df_ex[(df_ex.iloc[:, COL_UNIT_NAME] == unit) & (df_ex.iloc[:, COL_PROBLEM_NUMBER] == number)].empty else 'chart'
            
    label, alt_label = normalize(f"EXERCISES {number}") if effective_book == "ex" else normalize(number), normalize(f"{unit}{number}")
    similar_count = sum(1 for _, row in df_4step.iterrows() if (raw := row.iloc[COL_SIMILAR]) and any(tag in [normalize(s) for s in raw.split(",")] for tag in [label, alt_label]))

    response_data = {"unit_name": unit, "problem_number": number, "difficulty": difficulty, "equation": equation, "image_flag": image_flag, "similar_count": similar_count, "book": effective_book}

    # ★修正：SUBJECT_MAPを削除し、Excelから取得した科目名を直接使用
    if image_flag == 1:
        subject = p.iloc[COL_SUBJECT_NAME] # "I", "A"などが直接入る
        book_prefix = "ex" if effective_book == "ex" else "chart"
        response_data["image_path"] = f"static/images/{book_prefix}{subject}_{number}.png"
    
    return jsonify(response_data)