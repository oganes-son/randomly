from flask import Blueprint, request, jsonify, session
import pandas as pd
import unicodedata

step4_bp = Blueprint("step4", __name__)

# 列インデックス
COL_SUBJECT_NAME     = 0
COL_UNIT_NAME        = 1
COL_DIFFICULTY       = 2
COL_PROBLEM_NUMBER   = 3
COL_PROBLEM_TEXT     = 4
COL_IMAGE_FLAG       = 5
COL_SIMILAR          = 6

def normalize(s):
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

df_step = load_df("4step.xlsx")
df_chart = load_df("aochart.xlsx")
df_ex = load_df("aochart_ex.xlsx")

@step4_bp.route("/get_problem_4step", methods=["POST"])
def get_problem_4step():
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    units = [str(u).strip() for u in data.get("units", [])]
    difficulties = [str(d).strip() for d in data.get("difficulties", [])]

    df_filtered = df_step[df_step.iloc[:, COL_UNIT_NAME].isin(units)]
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
    similar_raw = p.iloc[COL_SIMILAR]

    # ✅ 実際に逆引きできる問題の数に変換
    similar_count = 0
    if similar_raw:
        for sid in similar_raw.split(","):
            sid_norm = normalize(sid)
            df_target = df_ex if sid_norm.startswith("EXERCISES") else df_chart
            base_number = ''.join(c for c in sid_norm.replace("EXERCISES", "") if c.isdigit())
            cond = (
                (df_target.iloc[:, COL_UNIT_NAME] == unit) &
                (df_target.iloc[:, COL_PROBLEM_NUMBER].str.upper() == base_number)
            )
            similar_count += df_target[cond].shape[0]

    # ★修正：レスポンス用の辞書を正しく作成
    response_data = {
        "unit_name": unit,
        "problem_number": number,
        "difficulty": difficulty,
        "equation": equation,
        "image_flag": image_flag,
        "similar_count": similar_count
    }

    # image_flagが1の場合、画像のパスを生成してレスポンスに追加
    if image_flag == 1:
        subject = p.iloc[COL_SUBJECT_NAME]
        # <-- 修正1: このファイルでは常に'4step'なので、prefixは'step'で固定
        book_prefix = "step"
        image_path = f"static/images/{book_prefix}{subject}_{number}.png"
        response_data["image_path"] = image_path

    # ★修正2：正しく構築したresponse_dataのみを返す
    return jsonify(response_data)
