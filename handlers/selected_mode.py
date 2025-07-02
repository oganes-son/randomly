import pandas as pd
import unicodedata
from flask import Blueprint, request, jsonify, session
import os

# Blueprintの定義
selected_mode_bp = Blueprint("selected", __name__)

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
        # サーバーログにエラーを出力し、アプリケーションが停止しないように空のDataFrameを返すこともできる
        print(f"エラー: データファイルが見つかりません: {path}")
        return pd.DataFrame() # 空のDataFrameを返す
    df = pd.read_excel(path, dtype=str)
    # NaN（Not a Number）を空文字列に変換し、前後の空白を除去
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

# --- データ読み込み ---
# アプリケーション起動時に各Excelファイルを読み込んでおく
df_chart = load_df("aochart.xlsx")
df_ex = load_df("aochart_ex.xlsx")
df_4step = load_df("4step.xlsx")


# --- メインのルーティング ---

@selected_mode_bp.route("/get_selected_problem", methods=["POST"])
def get_selected_problem():
    """
    ユーザーが選択した問題集・単元・番号に基づいて問題データを検索し、
    関連情報（類題の件数など）と共にJSON形式で返す。
    """
    # --- 1. 認証とリクエストデータの取得 ---
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403

    data = request.get_json()
    book = data.get("book")
    unit = str(data.get("unit", "")).strip()
    number = str(data.get("number", "")).strip()

    if not unit or not number:
        return jsonify({"error": "単元または番号が未入力です"}), 400

    # --- 2. 検索対象のDataFrameを選択 ---
    df_target = None
    if book == "chart":
        df_target = df_chart
    elif book == "ex":
        df_target = df_ex
    elif book == "4step":
        df_target = df_4step
    
    if df_target is None or df_target.empty:
        return jsonify({"error": "指定された問題集のデータが見つかりません。"}), 404

    # --- 3. 問題の検索 ---
    # ユーザー入力は文字列なので、DataFrameの番号列も文字列として比較する
    filtered = df_target[
        (df_target.iloc[:, COL_UNIT_NAME] == unit) &
        (df_target.iloc[:, COL_PROBLEM_NUMBER] == number)
    ]

    if filtered.empty:
        return jsonify({"error": "指定された単元と番号に一致する問題が見つかりませんでした。"}), 200

    # --- 4. 問題情報の抽出 ---
    p = filtered.iloc[0]
    difficulty = p.iloc[COL_DIFFICULTY]
    problem_text = p.iloc[COL_PROBLEM_TEXT]
    image_flag = int(p.iloc[COL_IMAGE_FLAG]) if p.iloc[COL_IMAGE_FLAG].isdigit() else 0

    # --- 5. 類題件数の計算 ---
    similar_count = 0
    if book == "4step":
        # 4stepの問題が選択された場合：
        # 関連する青チャート/EXの問題数を数える
        similar_raw = p.iloc[COL_SIMILAR]
        if similar_raw:
            # カンマで区切られた参照の数を数える
            similar_count = len(similar_raw.split(","))
    else:
        # 青チャート/EXの問題が選択された場合：
        # 関連する4stepの問題数を数える（数II微分・積分の単元同値化ロジックを含む）
        
        # 単名の同値関係を定義
        EQUIVALENT_UNITS = [
            {"数II微分法", "数II積分法", "数II微分法と積分法"}
        ]
        
        # 検索に使う単名リストを準備
        search_units = {unit}
        for unit_group in EQUIVALENT_UNITS:
            if unit in unit_group:
                search_units = unit_group
                break
        
        # 検索用のラベルを準備
        label = normalize(f"EXERCISES {number}") if book == "ex" else normalize(number)
        alt_label = normalize(f"{unit}{number}")

        for _, row in df_4step.iterrows():
            # 4step側の単元が、検索対象の単元グループに含まれているかチェック
            if row.iloc[COL_UNIT_NAME] in search_units:
                raw_similar_field = row.iloc[COL_SIMILAR]
                if raw_similar_field:
                    # 4stepの「類題」列に含まれる参照を正規化してリスト化
                    entries = [normalize(s) for s in raw_similar_field.split(",")]
                    # 参照リストに、探している問題のラベルが含まれていればカウントアップ
                    if label in entries or alt_label in entries:
                        similar_count += 1

    # ★修正：レスポンス用の辞書を正しく作成
    response_data = {
        "unit_name": unit,
        "problem_number": number,
        "difficulty": difficulty,
        "equation": problem_text, # <-- 修正1: 正しい変数名 `problem_text` を使用
        "image_flag": image_flag,
        "similar_count": similar_count
    }

    # image_flagが1の場合、画像のパスを生成してレスポンスに追加
    if image_flag == 1:
        subject = p.iloc[COL_SUBJECT_NAME]
        
        # <-- 修正2: '4step'の場合のprefixを追加
        if book == '4step':
            book_prefix = 'step'
        elif book == 'ex':
            book_prefix = 'ex'
        else:
            book_prefix = 'chart'

        image_path = f"static/images/{book_prefix}{subject}_{number}.png"
        response_data["image_path"] = image_path
    
    # ★修正3：正しく構築したresponse_dataのみを返す
    return jsonify(response_data)
