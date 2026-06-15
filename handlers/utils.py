import os
import pandas as pd
import random

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_problem_from_aochart(book, units, difficulties):
    # Excelの選択
    if book == "chart":
        df = pd.read_excel(os.path.join(_ROOT, "aochart.xlsx"))
    elif book == "ex":
        df = pd.read_excel(os.path.join(_ROOT, "aochart_ex.xlsx"))
    else:
        df1 = pd.read_excel(os.path.join(_ROOT, "aochart.xlsx"))
        df2 = pd.read_excel(os.path.join(_ROOT, "aochart_ex.xlsx"))
        df = pd.concat([df1, df2], ignore_index=True)

    filtered = df[df["単元"].isin(units)]
    if difficulties:
        filtered = filtered[filtered["難易度"].isin(difficulties)]

    if filtered.empty:
        raise ValueError("該当する問題が見つかりません")

    selected = filtered.sample(1).iloc[0]
    return {
        "unit_name": selected["単元"],
        "problem_number": selected["番号"],
        "difficulty": selected["難易度"],
        "equation": selected["内容"]
    }

def load_problem_from_4step(units, difficulties):
    df = pd.read_excel(os.path.join(_ROOT, "4step.xlsx"))
    filtered = df[df["単元"].isin(units)]
    if difficulties:
        filtered = filtered[filtered["難易度"].isin(difficulties)]

    if filtered.empty:
        raise ValueError("該当する問題が見つかりません")

    selected = filtered.sample(1).iloc[0]
    return {
        "unit_name": selected["単元"],
        "problem_number": selected["番号"],
        "difficulty": selected["難易度"],
        "equation": selected["内容"]
    }

def load_selected_problem(book, unit, number):
    file_map = {
        "chart": "aochart.xlsx",
        "ex": "aochart_ex.xlsx"
    }
    file_path = os.path.join(_ROOT, file_map.get(book, "aochart.xlsx"))
    df = pd.read_excel(file_path)

    row = df[(df["単元"] == unit) & (df["番号"].astype(str) == str(number))]
    if row.empty:
        raise ValueError("指定された問題が見つかりません")

    selected = row.iloc[0]
    return {
        "unit_name": selected["単元"],
        "problem_number": selected["番号"],
        "difficulty": selected["難易度"],
        "equation": selected["内容"]
    }
