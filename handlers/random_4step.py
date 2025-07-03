import pandas as pd
import unicodedata
from flask import Blueprint, request, jsonify, session
import os

# Blueprintの定義
step4_bp = Blueprint("step4", __name__)

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
    """文字列を正規化（全角→半角、大文字化、前後空白除去）する"""
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    """ExcelファイルをPandas DataFrameとして読み込む。全列を文字列として扱う。"""
    if not os.path.exists(path):
        print(f"エラー: データファイルが見つかりません: {path}")
        return pd.DataFrame()
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

# --- データ読み込み ---
df_step = load_df("4step.xlsx")

@step4_bp.route("/get_problem_4step", methods=["POST"])
def get_problem_4step():
    """
    4stepからランダムに問題を取得し、統一されたJSON形式で返す。
    """
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    units = [str(u).strip() for u in data.get("units", [])]
    difficulties = [str(d).strip() for d in data.get("difficulties", [])]

    # 条件に合う問題をフィルタリング
    df_filtered = df_step[df_step.iloc[:, COL_UNIT_NAME].isin(units)]
    if difficulties:
        df_filtered = df_filtered[df_filtered.iloc[:, COL_DIFFICULTY].isin(difficulties)]

    if df_filtered.empty:
        return jsonify({"error": "条件に合致する問題が見つかりませんでした。"}), 200

    # ランダムに1問抽出
    p = df_filtered.sample(1).iloc[0]

    # 問題情報を抽出
    unit = p.iloc[COL_UNIT_NAME]
    number = p.iloc[COL_PROBLEM_NUMBER]
    difficulty = p.iloc[COL_DIFFICULTY]
    equation = p.iloc[COL_PROBLEM_TEXT]
    # ★修正: image_flagを画像の枚数として解釈
    image_count = int(p.iloc[COL_IMAGE_FLAG]) if p.iloc[COL_IMAGE_FLAG].isdigit() else 0
    similar_raw = p.iloc[COL_SIMILAR]

    # 類題件数を計算
    similar_count = 0
    if similar_raw:
        similar_count = len(similar_raw.split(","))

    # --- ★ここから統一されたレスポンスを作成 ---
    # フロントエンドで一貫して扱えるように、レスポンス用の辞書を定義
    response_data = {
        "unit_name": unit,
        "problem_number": number,
        "difficulty": difficulty,
        "equation": equation,
        "image_flag": image_count,
        "similar_count": similar_count
    }

    # ★修正: image_countに応じて複数画像のパスリストを生成
    if image_count > 0:
        subject = p.iloc[COL_SUBJECT_NAME]
        # このファイルは4step専用なので、画像の接頭辞は'step'で固定
        book_prefix = "step" 
        image_paths = []
        if image_count == 1:
            # 画像が1枚の場合
            image_paths.append(f"static/images/{book_prefix}{subject}_{number}.png")
        else:
            # 画像が複数枚の場合 (例: 3枚なら1, 2, 3とループ)
            for i in range(1, image_count + 1):
                image_paths.append(f"static/images/{book_prefix}{subject}_{number}({i}).png")
        
        response_data["image_paths"] = image_paths
    
    # 最終的なレスポンスをJSON形式で返す
    return jsonify(response_data)
