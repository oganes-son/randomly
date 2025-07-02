import pandas as pd
import unicodedata
from flask import Blueprint, request, jsonify, session
import os

step4_bp = Blueprint("step4", __name__)

COL_SUBJECT_NAME, COL_UNIT_NAME, COL_DIFFICULTY, COL_PROBLEM_NUMBER, COL_PROBLEM_TEXT, COL_IMAGE_FLAG, COL_SIMILAR = range(7)

def normalize(s):
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    if not os.path.exists(path): return pd.DataFrame()
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

df_step = load_df("4step.xlsx")

@step4_bp.route("/get_problem_4step", methods=["POST"])
def get_problem_4step():
    if not session.get("logged_in"): return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    units, difficulties = [str(u).strip() for u in data.get("units", [])], [str(d).strip() for d in data.get("difficulties", [])]

    df_filtered = df_step[df_step.iloc[:, COL_UNIT_NAME].isin(units)]
    if difficulties:
        df_filtered = df_filtered[df_filtered.iloc[:, COL_DIFFICULTY].isin(difficulties)]

    if df_filtered.empty: return jsonify({"error": "条件に合致する問題が見つかりませんでした。"}), 200

    p = df_filtered.sample(1).iloc[0]
    unit, number, difficulty, equation = p.iloc[COL_UNIT_NAME], p.iloc[COL_PROBLEM_NUMBER], p.iloc[COL_DIFFICULTY], p.iloc[COL_PROBLEM_TEXT]
    image_flag = int(p.iloc[COL_IMAGE_FLAG]) if p.iloc[COL_IMAGE_FLAG].isdigit() else 0
    similar_raw = p.iloc[COL_SIMILAR]
    similar_count = len(similar_raw.split(",")) if similar_raw else 0

    response_data = {"unit_name": unit, "problem_number": number, "difficulty": difficulty, "equation": equation, "image_flag": image_flag, "similar_count": similar_count}

    # ★修正：SUBJECT_MAPを削除し、Excelから取得した科目名を直接使用
    if image_flag == 1:
        subject = p.iloc[COL_SUBJECT_NAME] # "I", "A"などが直接入る
        book_prefix = "step"
        response_data["image_path"] = f"static/images/{book_prefix}{subject}_{number}.png"
    
    return jsonify(response_data)