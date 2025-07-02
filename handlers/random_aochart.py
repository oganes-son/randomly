from flask import Blueprint, request, jsonify, session
import pandas as pd
import unicodedata

aochart_bp = Blueprint("aochart", __name__)

# 列インデックス
COL_SUBJECT_NAME     = 0
COL_UNIT_NAME        = 1
COL_DIFFICULTY       = 2
COL_PROBLEM_NUMBER   = 3
COL_PROBLEM_TEXT     = 4
COL_IMAGE_FLAG       = 5
COL_SIMILAR          = 6

# 正規化関数（全角 → 半角、大文字化、空白除去）
def normalize(s):
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

# 読み込み（全列str型、空白除去）
def load_df(path):
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

df_chart = load_df("aochart.xlsx")
df_ex = load_df("aochart_ex.xlsx")
df_4step = load_df("4step.xlsx")

@aochart_bp.route("/get_problem", methods=["POST"])
def get_problem_aochart():
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    units = [str(u).strip() for u in data.get("units", [])]
    difficulties = [str(d).strip() for d in data.get("difficulties", [])]
    book = data.get("book", "all")

    if book == "chart":
        df = df_chart
    elif book == "ex":
        df = df_ex
    else:
        df = pd.concat([df_chart, df_ex], ignore_index=True)

    df_filtered = df[df.iloc[:, COL_UNIT_NAME].isin(units)]
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

    # ✅ 正確な類題件数の算出
    label = normalize(f"EXERCISES {number}") if book == "ex" else normalize(number)
    alt_label = normalize(f"{unit}{number}")
    label_ids = [label, alt_label]

    similar_count = 0
    for _, row in df_4step.iterrows():
        raw = row.iloc[COL_SIMILAR]
        if not raw:
            continue
        entries = [normalize(s) for s in raw.split(",")]
        if any(tag in entries for tag in label_ids):
            for sid in entries:
                df_target = df_ex if sid.startswith("EXERCISES") else df_chart
                base_number = ''.join(c for c in sid.replace("EXERCISES", "") if c.isdigit())
                cond = (
                    (df_target.iloc[:, COL_UNIT_NAME] == unit) &
                    (df_target.iloc[:, COL_PROBLEM_NUMBER].str.upper() == base_number)
                )
                similar_count += df_target[cond].shape[0]
    
    # ★ここから追加★
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
        subject = p.iloc[COL_SUBJECT_NAME] # 科目名を取得 (例: "数I", "数A")
        book_prefix = "ex" if book == "ex" else "chart"
        # ファイル名を構築 (例: static/images/chartI_123.png)
        image_path = f"static/images/{book_prefix}{subject}_{number}.png"
        response_data["image_path"] = image_path

    return jsonify({
        "unit_name": unit,
        "problem_number": number,
        "difficulty": difficulty,
        "equation": equation,
        "image_flag": image_flag,
        "similar_count": similar_count,
        "response_data": response_data
    })
