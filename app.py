import os
import json
import unicodedata
import requests
import pandas as pd
from dotenv import load_dotenv
from flask import Flask, render_template, redirect, session, request, url_for, jsonify

# --- 1. 初期設定：.envファイルの読み込み ---
project_folder = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(project_folder, '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- 2. Flaskアプリケーションの初期化 ---
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "randemy-dev-secret-key")

# --- 3. Gemini APIキー ---
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# --- 4. Blueprintの登録 ---
# FlaskアプリとAPIキーが設定された後に、各モジュールをインポートします
from handlers.random_aochart import aochart_bp
from handlers.random_4step import step4_bp
from handlers.selected_mode import selected_mode_bp

app.register_blueprint(aochart_bp)
app.register_blueprint(step4_bp)
app.register_blueprint(selected_mode_bp)

# --- 5. 定数・ヘルパー関数 ---
COL_SUBJECT_NAME     = 0
COL_UNIT_NAME        = 1
COL_DIFFICULTY       = 2
COL_PROBLEM_NUMBER   = 3
COL_PROBLEM_TEXT     = 4
COL_IMAGE_FLAG       = 5
COL_SIMILAR          = 6

def normalize(s):
    """文字列を正規化（全角→半角、大文字化、前後空白除去）する"""
    return unicodedata.normalize("NFKC", str(s)).strip().upper()

def load_df(path):
    """ExcelファイルをPandas DataFrameとして読み込む。全列を文字列として扱う。"""
    if not os.path.exists(path):
        raise FileNotFoundError(f"データファイルが見つかりません: {path}")
    df = pd.read_excel(path, dtype=str)
    return df.map(lambda x: str(x).strip() if pd.notna(x) else "")

# --- 6. ルーティング ---
@app.route("/")
def index():
    """トップページ。ログイン状態に応じてリダイレクトする。"""
    return redirect(url_for("home") if session.get("logged_in") else url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    """ログイン処理を行う。"""
    if request.method == "POST" and request.form.get("password") == "sankutopeteruburuku":
        session["logged_in"] = True
        return redirect(url_for("home"))
    return render_template("login.html", error="password" in request.form)

@app.route("/home")
def home():
    """メインページを表示する。"""
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return render_template("main.html")

@app.route("/get_similar_problems", methods=["POST"])
def get_similar_problems():
    """
    すべてのモードから呼び出される、類題検索のメイン機能。
    指定された単元を同一とみなし、関連する問題を探して返す。
    """
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403
    
    data = request.get_json()
    source_mode = data.get("source_mode")
    unit = str(data.get("unit", "")).strip()
    number = str(data.get("problem_number", "")).strip()
    book = data.get("book", "chart")
    
    try:
        df_chart = load_df(os.path.join(project_folder, "aochart.xlsx"))
        df_ex = load_df(os.path.join(project_folder, "aochart_ex.xlsx"))
        df_4step = load_df(os.path.join(project_folder, "4step.xlsx"))
    except FileNotFoundError as e:
        print(f"エラー: {e}")
        return jsonify({"error": "サーバー側でデータファイルが見つかりません。"}), 500

    results = []
    
    EQUIVALENT_UNITS = [
        {"数II微分法", "数II積分法", "数II微分法と積分法"}
    ]
    
    search_units = {unit}
    for unit_group in EQUIVALENT_UNITS:
        if unit in unit_group:
            search_units = list(unit_group)
            break
    if isinstance(search_units, set):
        search_units = list(search_units)

    if source_mode == "4step" or (source_mode == "selection" and book == "4step"):
        row_query = (df_4step.iloc[:, COL_UNIT_NAME] == unit) & (df_4step.iloc[:, COL_PROBLEM_NUMBER] == number)
        row = df_4step[row_query]
        
        if not row.empty and COL_SIMILAR < df_4step.shape[1] and (similar_raw := row.iloc[0].iloc[COL_SIMILAR]):
            for sid in [normalize(s) for s in similar_raw.split(",")] :
                base_num = ''.join(c for c in sid if c.isdigit())
                df_target = df_ex if sid.startswith("EXERCISES") else df_chart
                match = df_target[(df_target.iloc[:, COL_UNIT_NAME].isin(search_units)) & (df_target.iloc[:, COL_PROBLEM_NUMBER] == base_num)]
                for _, r in match.iterrows():
                    result_item = {"unit_name": r.iloc[COL_UNIT_NAME], "problem_number": sid, "book": "ex" if df_target is df_ex else "chart", "difficulty": r.iloc[COL_DIFFICULTY], "equation": r.iloc[COL_PROBLEM_TEXT]}
                    if (image_flag := int(r.iloc[COL_IMAGE_FLAG]) if r.iloc[COL_IMAGE_FLAG].isdigit() else 0) == 1:
                        subject = r.iloc[COL_SUBJECT_NAME]
                        book_prefix = "ex" if df_target is df_ex else "chart"
                        result_item["image_path"] = f"static/images/{book_prefix}{subject}_{base_num}.png"
                    results.append(result_item)
    
    elif source_mode == "aochart" or (source_mode == "selection" and book in ["chart", "ex"]):
        label, alt_label = normalize(f"EXERCISES {number}") if book == "ex" else normalize(number), normalize(f"{unit}{number}")
        target_4step_df = df_4step[df_4step.iloc[:, COL_UNIT_NAME].isin(search_units)]
        for _, r in target_4step_df.iterrows():
            if (raw_similar_field := r.iloc[COL_SIMILAR]) and any(tag in [normalize(s) for s in raw_similar_field.split(",")] for tag in [label, alt_label]):
                problem_num_4step = r.iloc[COL_PROBLEM_NUMBER]
                result_item = {"unit_name": r.iloc[COL_UNIT_NAME], "problem_number": problem_num_4step, "book": "4step", "difficulty": r.iloc[COL_DIFFICULTY], "equation": r.iloc[COL_PROBLEM_TEXT]}
                if (image_flag := int(r.iloc[COL_IMAGE_FLAG]) if r.iloc[COL_IMAGE_FLAG].isdigit() else 0) == 1:
                    subject = r.iloc[COL_SUBJECT_NAME]
                    result_item["image_path"] = f"static/images/step{subject}_{problem_num_4step}.png"
                results.append(result_item)
    
    return jsonify({"similar_problems": results})

@app.route('/generate_similar_problem', methods=['POST'])
def generate_similar_problem():
    """AIを使って類題を生成する。"""
    if not api_key:
        return jsonify({"error": "サーバー側でAI用のAPIキーが設定されていません。"}), 500
    if not session.get("logged_in"):
        return jsonify({"error": "ログインしていません"}), 403
    
    data = request.get_json()
    original_problem = data.get('problem_text')
    history = data.get('history', [])

    if not original_problem:
        return jsonify({"error": "問題文が空です"}), 400

    if "証明せよ" in original_problem or "示せ" in original_problem:
        return jsonify({"error": "証明問題は類題を生成できません"}), 400

    history_prompt_section = ""
    if history:
        history_list_str = "\n".join([f"【過去の生成例 {i+1}】\n{p_text}" for i, p_text in enumerate(history)])
        history_prompt_section = f"""
# 追加の制約
- 以下の「過去に生成した問題リスト」を注意深く確認し、これらと数値の組み合わせが完全に一致する問題は絶対に生成しないでください。必ず異なる数値を使った、新しいバリエーションの類題を作成してください。

# 過去に生成した問題リスト
{history_list_str}
"""
    
    prompt = f"""
あなたは、日本の高校生向けの高品質な数学教材を作成する、極めて優秀で細心な専門家です。あなたの任務は、与えられたLaTeX形式の問題文を分析し、教育的価値と数学的な正確性が完全に保証された「類題」を生成することです。

# タスク概要
入力: LaTeX形式の数学の問題文
出力: 以下の仕様に厳格に従ったJSONオブジェクト

# 思考プロセス（このステップを厳密に実行してください）
1.  **問題分析**: 元の問題の分野、解法の核心、そしてなぜ答えが綺麗になるのか（鍵となる数値や設定）を特定する。
2.  **パラメータ選定**: 解法の構造を維持したまま変更可能な数値パラメータを全てリストアップする。
3.  **類題設計**: パラメータを新しい数値に置き換える。その際、後述のルールセットを全て満たすか、頭の中で厳密に検算・シミュレーションを行う。
4.  **【最重要】自己検証**: 生成した問題、答え、解説の全てに論理的・数学的な誤りがないか、独立した視点で再計算・再検証を行う。特に、解答が問題の条件をすべて満たしているか、計算ミスがないかを入念に確認する。
5.  **書式検証**: 全ての出力が後述のルールセットに完全に準拠しているか最終チェックを行う。
6.  **JSON生成**: 検証済みの内容のみを出力する。

{history_prompt_section}

# ルールセット

### 【数学的整合性】
- **最優先事項**: 生成する問題、解説、答えは、数学的に100%正確でなければなりません。
- 生成する問題は、必ず日本の高校数学の範囲内で**解が存在し、かつその解が一意または有限個に定まる**ことを保証してください。

### 【解の品質基準】
- **最終的な答え**:
    - **有理数**: 整数、または分母と分子が共に**3桁以内**の既約分数であること。
    - **無理数**: 平方根（ルート）を含む場合、根号内は**100以下の自然数**であり、かつ`√12 (=2√3)`のように**簡単な形にできる**ことが望ましい。
- **計算過程**:
    - 3次以上の方程式を解く必要がある場合、**因数定理を用いて整数または簡単な有理数の解が1つ以上見つかる**ように設計してください。
    - 積分計算においては、**高校で習う基本的な置換積分や部分積分で対応可能**な範囲に留めてください。

### 【表記・書式の統一】
- **小問番号**: 元の問題が `(1)`, `(2)` のような小問番号を含んでいる場合、生成する問題、解答、解説でもその書式を忠実に模倣してください。単なる `1.` や `2.` ではなく、必ず括弧 `()` を使用してください。
- **対数(log)の表記**: 日本の高校数学の慣習に従ってください。自然対数は `ln` とは表記せず、底を省略した `log(x)` と表記してください。底が `e` 以外の場合のみ、`log_2(x)` のように底を明記してください。
- **LaTeXの書式**:
    - 全ての数式は、MathJaxで正しくレンダリングできる、標準的なLaTeXの書式で記述してください。
    - インライン数式は `\\(...\\)` で囲んでください。
    - ディスプレイ数式（独立した行の数式）は `\\[...\\]` で囲んでください。
    - `¥` (円マーク) はバックスラッシュの代わりとして**絶対に使用しないでください**。必ず `\\` (バックスラッシュ) を使用してください。

### 【数学関数の使用制限】
- **三角関数**: `arcsin`, `arccos`, `arctan`, `sinh`, `cosh`, `tanh` などの大学範囲の関数は**絶対に使用しないでください**。角度は、日本の高校数学で標準的に扱われるもの（例: $\\frac{{\\pi}}{{6}}, \\frac{{\\pi}}{{4}}, \\frac{{\\pi}}{{3}}$ とその倍数）のみを使用してください。元の問題で$15^\\circ$系の角度（例: $\\frac{{\\pi}}{{12}}$）が使われている場合に限り、その角度の使用を許可します。
- **近似値の禁止**: `≒` や `≈` を用いた数値の丸めや近似は**一切行わないでください**。すべての問題は、厳密解が手計算で求められるように設計してください。

### 【出力フォーマット】
- あなたの出力は、以下のキーを持つJSONオブジェクトでなければなりません。
  - `"problem"`: (String) 生成した類題の問題文。LaTeX形式で記述すること。
  - `"answer"`: (String) その類題の最終的な答え。LaTeX形式で記述すること。
  - `"explanation"`: (String) その答えに至るまでの、日本の高校生が理解できる簡潔な解説。数式もLaTeX形式で記述すること。
- JSON以外の文字列（例えば、前後の説明文や、\`\`\`json のようなマークダウン記法）は**一切含めないでください**。

---
# 元の問題文:
{original_problem}
"""
    if not _GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY が設定されていません。"}), 500

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-flash-latest:generateContent?key={_GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    MAX_RETRIES = 3
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(url, json=payload, timeout=30)
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text.replace('¥', '\\'))
        except Exception as e:
            print(f"AI生成試行 {attempt + 1}/{MAX_RETRIES} 回目失敗: {e}")
            if attempt + 1 == MAX_RETRIES:
                return jsonify({"error": "AIによる類題の生成に失敗しました。しばらくしてからもう一度お試しください。"}), 500

# --- 7. サーバーの起動 ---
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)