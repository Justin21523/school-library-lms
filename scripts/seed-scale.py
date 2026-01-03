#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scale Seed（大量假資料匯入，偏 UI 完整性驗證用）
=================================================

你在做「前端界面完整性」驗證時，最常遇到的問題不是功能壞，而是：
1) 資料太少 → 列表/搜尋/報表看起來像壞掉（其實只是沒有資料）
2) 資料太「假」→ 文字都是 ABC、欄位都空，UI 排版與 CSV/搜尋行為很難真實驗證
3) 資料不可重現 → 今天測過、明天 DB 被玩壞就回不來

因此這支腳本的定位是：
- 以「一個 org、量級大、全繁體中文」為目標，生成可重現的大數據 demo
- 用 Postgres 的 COPY（psql \\copy）高速匯入
- 預設不依賴外部模型（rules provider），但保留 text provider 介面（未來可接 Hugging Face）

執行方式（Docker 建議）
----------------------
1) 先確保 DB / API / Web 都已啟動（本 repo 已提供 npm scripts）
   - `npm run docker:up`

2) 匯入大量資料（會清空同 org_code 的舊資料再重建）
   - `docker compose --profile scale run --rm seed-scale`

環境變數（重點）
---------------
連線（psql 會用這些）：
  PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE

資料集：
  SCALE_ORG_CODE            預設 demo-lms-scale
  SCALE_ORG_NAME            預設 示範國小（大型資料集）
  SCALE_SEED                預設 42（固定即可重現）
  SCALE_PASSWORD            預設 demo1234（只給少數「可登入帳號」用）
  SCALE_TEXT_PROVIDER       rules | hf（預設 rules；hf 先保留介面）

量級（都可調；預設偏「大但仍可在本機跑」）：
  SCALE_STUDENTS            預設 5000
  SCALE_TEACHERS            預設 200
  SCALE_BIBS                預設 4000
  SCALE_MAX_COPIES_PER_BIB  預設 3
  SCALE_OPEN_LOANS          預設 1500
  SCALE_CLOSED_LOANS        預設 12000
  SCALE_READY_HOLDS         預設 300
  SCALE_QUEUED_HOLDS        預設 800
  SCALE_INVENTORY_SESSIONS  預設 2
  SCALE_SCANS_PER_SESSION   預設 300
  SCALE_AUDIT_EVENTS        預設 5000

安全性提醒（很重要）
-------------------
- 這是 demo/測試資料：會建立可登入的帳號（統一密碼），請勿指向正式環境。
- 這支腳本預設會依 org_code 刪掉整個 org（ON DELETE CASCADE），等同清空該 org 的所有資料。
"""

from __future__ import annotations

import base64
import csv
import dataclasses
import datetime as dt
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import uuid
from pathlib import Path


# ----------------------------
# 0) 小工具：讀 env + 基本驗證
# ----------------------------


def env_str(name: str, default: str) -> str:
    v = os.environ.get(name)
    return default if v is None else str(v).strip()


def env_int(name: str, default: int) -> int:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    try:
        return int(str(v).strip())
    except ValueError:
        raise SystemExit(f"[seed-scale] env {name} must be int, got: {v!r}")


def env_choice(name: str, default: str, allowed: list[str]) -> str:
    v = env_str(name, default)
    if v not in allowed:
        raise SystemExit(f"[seed-scale] env {name} must be one of {allowed}, got: {v!r}")
    return v


def must_positive(name: str, value: int) -> int:
    if value < 0:
        raise SystemExit(f"[seed-scale] {name} must be >= 0, got: {value}")
    return value


# org_code 會被用在 SQL（DELETE WHERE code=...），因此限制格式避免奇怪字元。
ORG_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")


@dataclasses.dataclass(frozen=True)
class ScaleConfig:
    # Org（唯一性邊界）
    org_code: str
    org_name: str

    # 可重現 seed
    seed: int

    # Text provider：rules（預設）| hf（保留介面，未內建依賴）
    text_provider: str

    # Demo 密碼（只給少數帳號建立 credentials：admin/librarian/1 teacher/1 student）
    password: str

    # 量級（偏 UI 完整性）
    students: int
    teachers: int
    bibs: int
    max_copies_per_bib: int
    open_loans: int
    closed_loans: int
    ready_holds: int
    queued_holds: int
    inventory_sessions: int
    scans_per_session: int
    audit_events: int

    # Script workdir（容器內寫檔；不污染 repo）
    workdir: Path


def load_config() -> ScaleConfig:
    org_code = env_str("SCALE_ORG_CODE", "demo-lms-scale")
    if not ORG_CODE_RE.match(org_code):
        raise SystemExit(
            "[seed-scale] SCALE_ORG_CODE format invalid; use only lowercase letters/digits/dash, "
            f"2..63 chars, got: {org_code!r}"
        )

    org_name = env_str("SCALE_ORG_NAME", "示範國小（大型資料集）")
    seed = env_int("SCALE_SEED", 42)
    text_provider = env_choice("SCALE_TEXT_PROVIDER", "rules", ["rules", "hf"])
    password = env_str("SCALE_PASSWORD", "demo1234")

    students = must_positive("SCALE_STUDENTS", env_int("SCALE_STUDENTS", 5000))
    teachers = must_positive("SCALE_TEACHERS", env_int("SCALE_TEACHERS", 200))
    bibs = must_positive("SCALE_BIBS", env_int("SCALE_BIBS", 4000))
    max_copies_per_bib = env_int("SCALE_MAX_COPIES_PER_BIB", 3)
    if max_copies_per_bib < 1 or max_copies_per_bib > 10:
        raise SystemExit("[seed-scale] SCALE_MAX_COPIES_PER_BIB must be 1..10")

    open_loans = must_positive("SCALE_OPEN_LOANS", env_int("SCALE_OPEN_LOANS", 1500))
    closed_loans = must_positive("SCALE_CLOSED_LOANS", env_int("SCALE_CLOSED_LOANS", 12000))
    ready_holds = must_positive("SCALE_READY_HOLDS", env_int("SCALE_READY_HOLDS", 300))
    queued_holds = must_positive("SCALE_QUEUED_HOLDS", env_int("SCALE_QUEUED_HOLDS", 800))
    inventory_sessions = must_positive(
        "SCALE_INVENTORY_SESSIONS", env_int("SCALE_INVENTORY_SESSIONS", 2)
    )
    scans_per_session = must_positive(
        "SCALE_SCANS_PER_SESSION", env_int("SCALE_SCANS_PER_SESSION", 300)
    )
    audit_events = must_positive("SCALE_AUDIT_EVENTS", env_int("SCALE_AUDIT_EVENTS", 5000))

    workdir = Path(env_str("SCALE_WORKDIR", "/tmp/seed-scale")).resolve()

    return ScaleConfig(
        org_code=org_code,
        org_name=org_name,
        seed=seed,
        text_provider=text_provider,
        password=password,
        students=students,
        teachers=teachers,
        bibs=bibs,
        max_copies_per_bib=max_copies_per_bib,
        open_loans=open_loans,
        closed_loans=closed_loans,
        ready_holds=ready_holds,
        queued_holds=queued_holds,
        inventory_sessions=inventory_sessions,
        scans_per_session=scans_per_session,
        audit_events=audit_events,
        workdir=workdir,
    )


# ----------------------------
# 1) Text provider（rules / hf）
# ----------------------------


class TextProvider:
    """
    TextProvider：把「文字生成」抽象化，方便未來插拔（rules/hf）。

    為什麼要抽象？
    - 你想要「全繁體中文」+「看起來像真的」，但不一定每次都想拉 Hugging Face 模型
    - 我們先用 rules provider（字庫 + 模板）滿足 UI/報表/搜尋驗證
    - 若你後續真的要「更自然的書名/主題詞」，再把 hf provider 接上（且仍可重現）
    """

    def person_name(self) -> str:  # noqa: D401
        """產生繁中姓名（可重複；不含真實個資）。"""

        raise NotImplementedError

    def publisher(self) -> str:
        raise NotImplementedError

    def subject_terms(self, k: int) -> list[str]:
        raise NotImplementedError

    def bib_title(self) -> str:
        raise NotImplementedError

    def classification(self) -> str:
        raise NotImplementedError

    def geographic_terms(self, k: int) -> list[str]:
        """
        產生地理名稱（MARC 651 對應）。

        設計提醒（對齊本 repo 的資料模型）：
        - bibliographic_records.geographics 是「顯示/相容用」的 text[]
        - 真正的治理/連結會逐步改以 bibliographic_geographic_terms（term_id）為準
        """

        raise NotImplementedError

    def genre_terms(self, k: int) -> list[str]:
        """
        產生類型/體裁（MARC 655 對應）。

        設計提醒：
        - bibliographic_records.genres 是顯示/相容用
        - 真正治理/連結以 bibliographic_genre_terms（term_id）為準
        """

        raise NotImplementedError

    def language_code(self) -> str:
        """產生語言代碼（MARC 041$a；目前先寬鬆，不嚴格限制 ISO 639）。"""

        raise NotImplementedError


class RulesTextProvider(TextProvider):
    """
    RulesTextProvider：不依賴外部模型的「可重現」繁中生成器。

    設計取捨：
    - 這不是語言模型，文字不會像真人寫作那樣自然
    - 但它的優點是：
      1) 不需要網路、不需要下載模型
      2) 可完全可重現（固定 seed）
      3) 文字仍能覆蓋 UI 常見情境：長標題、標點、不同主題、不同分類號
    """

    _SURNAMES = list("陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周葉蘇盧鍾徐彭呂江唐宋方鄒何高潘")
    _GIVEN_CHARS = list("家怡冠承宇宸柏彥子恩佳庭妤瑄婕睿哲昕庭妍筱涵昀祐瑋翔晴穎璇芷瑜婉婷思妤品妍")

    _PUBLISHERS = [
        "臺灣教育出版社",
        "五南圖書出版",
        "三民書局",
        "時報出版",
        "遠流出版",
        "親子天下",
        "小天下",
        "天下雜誌",
        "康軒文教",
        "翰林出版",
        "聯經出版",
        "大塊文化",
        "國語日報",
        "小魯文化",
        "幼獅文化",
        "聚珍臺灣",
        "蓋亞文化",
        "圓神出版",
        "天下文化",
    ]

    _SUBJECTS = [
        # Library / LIS（館務/編目/治理）
        "閱讀推廣",
        "校園閱讀",
        "兒童閱讀",
        "閱讀素養",
        "閱讀策略",
        "閱讀理解",
        "圖書館管理",
        "館藏發展",
        "選書與採購",
        "流通管理",
        "盤點",
        "汰舊",
        "編目與分類",
        "主題分析",
        "權威控制",
        "書目資料",
        "MARC 21",
        "RDA",
        "Dublin Core",
        # Digital literacy（資訊/媒體）
        "資訊素養",
        "媒體識讀",
        "假新聞辨識",
        "來源評估",
        "資訊倫理",
        "著作權",
        "個人資料保護",
        "資訊安全",
        "密碼管理",
        "網路釣魚",
        # Curriculum / learning（課程/學習）
        "科普教育",
        "科學探究",
        "天文",
        "物理",
        "化學",
        "生物",
        "地球科學",
        "數學思維",
        "統計入門",
        "語文表達",
        "寫作技巧",
        "英語學習",
        "歷史入門",
        "臺灣史",
        "世界史",
        "地理概念",
        "地圖閱讀",
        "公民教育",
        "法律常識",
        "藝術欣賞",
        "音樂素養",
        "視覺設計",
        # CS / data（程式/資料）
        "程式設計",
        "演算法",
        "Scratch",
        "Python",
        "AI 基礎",
        "機器學習入門",
        "資料分析",
        "資料視覺化",
        # SEL / wellbeing（身心/生活）
        "生命教育",
        "品格教育",
        "情緒管理",
        "心理成長",
        "環境教育",
        "永續發展",
        "氣候變遷",
        "資源回收",
        "健康教育",
        "飲食教育",
        "運動與健康",
        "親職教育",
        "班級經營",
        "多元文化教育",
        "性別平等教育",
        "人權教育",
    ]

    # _SUBJECT_VARIANTS：同義詞/別名（UF）
    #
    # 重要規則（避免 authority linking 變成模糊匹配）：
    # - 任何 variant_label 不可等於任何其他 term 的 preferred_label（同 kind + vocab 下）
    # - 不同 term 不可共享同一個 variant_label
    #
    # 否則：BibsService.resolveSubjectTermsForWrite 會遇到 label→多筆 term 的模糊情境而拒絕寫入。
    _SUBJECT_VARIANTS: dict[str, list[str]] = {
        "資訊素養": ["資訊能力", "資訊識讀", "Information literacy"],
        "媒體識讀": ["媒體素養", "Media literacy", "媒體判讀"],
        "假新聞辨識": ["辨識假訊息", "Fake news detection"],
        "資訊倫理": ["數位倫理", "資訊道德", "Digital ethics"],
        "資訊安全": ["網路安全", "Cybersecurity"],
        "個人資料保護": ["個資保護", "Privacy", "Data privacy"],
        "著作權": ["版權", "Copyright"],
        "盤點": ["清點", "inventory"],
        "汰舊": ["除籍", "撤架"],
        "MARC 21": ["MARC21"],
        "RDA": ["Resource Description and Access"],
        "Dublin Core": ["DCMI"],
        "臺灣史": ["台灣史"],
        "程式設計": ["Coding", "Programming"],
        "AI 基礎": ["人工智慧入門", "AI 入門"],
        "資料分析": ["數據分析", "Data analytics"],
        "資料視覺化": ["Data visualization"],
        "Scratch": ["Scratch Jr."],
    }

    # _SUBJECT_BROADER_EDGES：用於 seed thesaurus（BT/NT）
    # - 方向：narrower → broader（對齊 authority_term_relations.relation_type='broader' 的儲存方向）
    # - 目的：不是建立「語意正確」的權威分類法，而是提供：
    #   1) 可深度展開的樹（視覺化/瀏覽）
    #   2) expand（檢索擴充）有真資料可跑
    #   3) polyhierarchy（多重上位）有範例可測
    _SUBJECT_BROADER_EDGES: list[tuple[str, str]] = [
        # Digital literacy
        ("媒體識讀", "資訊素養"),
        ("資訊倫理", "資訊素養"),
        ("資訊安全", "資訊素養"),
        ("假新聞辨識", "媒體識讀"),
        ("來源評估", "媒體識讀"),
        ("著作權", "資訊倫理"),
        ("個人資料保護", "資訊倫理"),
        ("密碼管理", "資訊安全"),
        ("網路釣魚", "資訊安全"),
        # CS / data
        ("Scratch", "程式設計"),
        ("Python", "程式設計"),
        ("演算法", "程式設計"),
        ("AI 基礎", "程式設計"),
        ("資料分析", "程式設計"),
        ("資料視覺化", "資料分析"),
        ("機器學習入門", "AI 基礎"),
        # Polyhierarchy：資料分析 同時屬於程式/統計
        ("資料分析", "統計入門"),
        ("統計入門", "數學思維"),
        # Reading / LIS
        ("閱讀素養", "閱讀推廣"),
        ("閱讀策略", "閱讀素養"),
        ("閱讀理解", "閱讀素養"),
        ("校園閱讀", "閱讀推廣"),
        ("兒童閱讀", "閱讀推廣"),
        ("館藏發展", "圖書館管理"),
        ("選書與採購", "館藏發展"),
        ("流通管理", "圖書館管理"),
        ("盤點", "館藏發展"),
        ("汰舊", "館藏發展"),
        ("主題分析", "編目與分類"),
        ("權威控制", "編目與分類"),
        ("書目資料", "編目與分類"),
        ("MARC 21", "編目與分類"),
        ("RDA", "編目與分類"),
        ("Dublin Core", "編目與分類"),
        # Curriculum
        ("科學探究", "科普教育"),
        ("天文", "科普教育"),
        ("物理", "科普教育"),
        ("化學", "科普教育"),
        ("生物", "科普教育"),
        ("地球科學", "科普教育"),
        ("臺灣史", "歷史入門"),
        ("世界史", "歷史入門"),
        ("地圖閱讀", "地理概念"),
        ("法律常識", "公民教育"),
        ("音樂素養", "藝術欣賞"),
        # SEL / wellbeing
        ("品格教育", "生命教育"),
        ("情緒管理", "生命教育"),
        ("心理成長", "生命教育"),
        ("永續發展", "環境教育"),
        ("氣候變遷", "環境教育"),
        ("資源回收", "環境教育"),
        ("飲食教育", "健康教育"),
        ("運動與健康", "健康教育"),
    ]

    _SUBJECT_RELATED_EDGES: list[tuple[str, str]] = [
        ("資訊素養", "閱讀素養"),
        ("程式設計", "數學思維"),
    ]

    _GEOGRAPHICS_ALL = [
        # 以臺灣常見地名為主（繁中），並補一些「階層節點」（region）讓 thesaurus/tree 有深度。
        "臺灣",
        "北部",
        "中部",
        "南部",
        "東部",
        "離島",
        "臺北市",
        "新北市",
        "桃園市",
        "臺中市",
        "臺南市",
        "高雄市",
        "基隆市",
        "新竹市",
        "新竹縣",
        "苗栗縣",
        "彰化縣",
        "南投縣",
        "雲林縣",
        "嘉義市",
        "嘉義縣",
        "屏東縣",
        "宜蘭縣",
        "花蓮縣",
        "臺東縣",
        "澎湖縣",
        "金門縣",
        "連江縣",
        # 國外（roots，先不建更細層級）
        "中國",
        "香港",
        "新加坡",
        "馬來西亞",
        "越南",
        "泰國",
        "澳洲",
        "紐西蘭",
        "日本",
        "韓國",
        "美國",
        "加拿大",
        "英國",
        "法國",
        "德國",
    ]

    # _GEOGRAPHICS：給書目隨機指派用（避免把「北部/中部」這類階層節點寫進 bib）
    _GEOGRAPHICS = [
        "臺灣",
        "臺北市",
        "新北市",
        "桃園市",
        "臺中市",
        "臺南市",
        "高雄市",
        "基隆市",
        "新竹市",
        "新竹縣",
        "苗栗縣",
        "彰化縣",
        "南投縣",
        "雲林縣",
        "嘉義市",
        "嘉義縣",
        "屏東縣",
        "宜蘭縣",
        "花蓮縣",
        "臺東縣",
        "澎湖縣",
        "金門縣",
        "連江縣",
        "中國",
        "香港",
        "新加坡",
        "馬來西亞",
        "越南",
        "泰國",
        "澳洲",
        "紐西蘭",
        "日本",
        "韓國",
        "美國",
        "加拿大",
        "英國",
        "法國",
        "德國",
    ]

    _GEOGRAPHIC_VARIANTS: dict[str, list[str]] = {
        "臺灣": ["台灣", "Taiwan"],
        "臺北市": ["台北市", "Taipei"],
        "新北市": ["台北縣", "New Taipei"],
        "臺中市": ["台中市", "Taichung"],
        "臺南市": ["台南市", "Tainan"],
        "高雄市": ["高雄", "Kaohsiung"],
        "花蓮縣": ["花蓮", "Hualien"],
        "臺東縣": ["台東", "Taitung"],
        "日本": ["Japan"],
        "韓國": ["Korea"],
        "美國": ["USA", "United States"],
        "英國": ["UK", "United Kingdom"],
        "中國": ["中國大陸", "China"],
        "香港": ["Hong Kong"],
        "新加坡": ["Singapore"],
        "澳洲": ["Australia"],
    }

    _GEOGRAPHIC_BROADER_EDGES: list[tuple[str, str]] = [
        # depth=2：市/縣 → region → 臺灣
        ("北部", "臺灣"),
        ("中部", "臺灣"),
        ("南部", "臺灣"),
        ("東部", "臺灣"),
        ("離島", "臺灣"),
        ("臺北市", "北部"),
        ("新北市", "北部"),
        ("桃園市", "北部"),
        ("基隆市", "北部"),
        ("新竹市", "北部"),
        ("新竹縣", "北部"),
        ("宜蘭縣", "北部"),
        ("苗栗縣", "中部"),
        ("臺中市", "中部"),
        ("彰化縣", "中部"),
        ("南投縣", "中部"),
        ("雲林縣", "中部"),
        ("嘉義市", "南部"),
        ("嘉義縣", "南部"),
        ("臺南市", "南部"),
        ("高雄市", "南部"),
        ("屏東縣", "南部"),
        ("花蓮縣", "東部"),
        ("臺東縣", "東部"),
        ("澎湖縣", "離島"),
        ("金門縣", "離島"),
        ("連江縣", "離島"),
    ]

    _GEOGRAPHIC_RELATED_EDGES: list[tuple[str, str]] = [
        ("臺北市", "新北市"),
        ("金門縣", "連江縣"),
    ]

    _GENRES_ALL = [
        # 這裡不追求完全對齊 LCGFT，只要「足夠真實且可擴充」。
        "文學",
        "兒童讀物",
        "非虛構",
        "小說",
        "推理小說",
        "科幻小說",
        "奇幻小說",
        "歷史小說",
        "校園小說",
        "少年小說",
        "散文",
        "詩",
        "戲劇",
        "圖畫書",
        "繪本",
        "童話",
        "橋樑書",
        "故事集",
        "傳記",
        "科普",
        "百科",
        "工具書",
        "手冊",
        "教學參考書",
        "練習題",
        "研究報告",
        "期刊",
        "漫畫",
        "圖像小說",
    ]

    # _GENRES：給書目隨機指派用（偏 leaf / 常見體裁）
    _GENRES = [
        "圖畫書",
        "繪本",
        "童話",
        "小說",
        "推理小說",
        "科幻小說",
        "奇幻小說",
        "歷史小說",
        "校園小說",
        "少年小說",
        "散文",
        "詩",
        "傳記",
        "科普",
        "百科",
        "教學參考書",
        "練習題",
        "漫畫",
        "期刊",
        "研究報告",
        "手冊",
        "圖像小說",
        "橋樑書",
        "故事集",
        "工具書",
    ]

    _GENRE_VARIANTS: dict[str, list[str]] = {
        "推理小說": ["偵探小說", "Mystery fiction"],
        "科幻小說": ["科學幻想小說", "Science fiction"],
        "奇幻小說": ["魔幻小說", "Fantasy fiction"],
        "少年小說": ["青少年小說", "YA novel"],
        "繪本": ["Picture book"],
        "科普": ["科學普及", "Popular science"],
        "百科": ["Encyclopedia"],
        "傳記": ["Biography"],
        "漫畫": ["Comics"],
        "圖像小說": ["Graphic novel"],
    }

    _GENRE_BROADER_EDGES: list[tuple[str, str]] = [
        ("小說", "文學"),
        ("推理小說", "小說"),
        ("科幻小說", "小說"),
        ("奇幻小說", "小說"),
        ("歷史小說", "小說"),
        ("校園小說", "小說"),
        ("少年小說", "小說"),
        ("散文", "文學"),
        ("詩", "文學"),
        ("戲劇", "文學"),
        ("圖畫書", "兒童讀物"),
        ("繪本", "圖畫書"),
        ("童話", "兒童讀物"),
        ("橋樑書", "兒童讀物"),
        ("故事集", "兒童讀物"),
        ("科普", "非虛構"),
        ("百科", "非虛構"),
        ("傳記", "非虛構"),
        ("工具書", "非虛構"),
        ("手冊", "非虛構"),
        ("教學參考書", "非虛構"),
        ("練習題", "非虛構"),
        ("研究報告", "非虛構"),
        ("期刊", "非虛構"),
        ("漫畫", "文學"),
        ("圖像小說", "漫畫"),
    ]

    _GENRE_RELATED_EDGES: list[tuple[str, str]] = [
        ("科普", "百科"),
        ("漫畫", "圖畫書"),
    ]

    _LANGUAGES = [
        # 常見語言代碼（MVP 先寬鬆；用於 UI filter / MARC 041）
        "zh-TW",
        "zh",
        "en",
        "ja",
        "ko",
        "vi",
        "id",
    ]

    _TITLE_TEMPLATES = [
        "國小{subject}教學活動設計（第{edition}版）",
        "圖書館管理實務：{subject}與應用",
        "閱讀素養：從{subject}到{subject2}",
        "科普小百科：{subject}",
        "資訊安全與倫理：{subject}案例解析",
        "{subject}入門：給老師與學生的指南",
        "校園圖書館工作手冊：{subject}篇",
        "學校行政與{subject}：制度、流程與工具",
        "孩子的{subject}練習：從小學到國中",
        "{subject}專題研究：方法與實作",
        "用{subject}理解{subject2}：給初學者的 30 堂課",
        "{subject} × {subject2}：跨領域素養讀本",
        "圖書館的{subject}：案例、表單與SOP",
        "{subject}教學備課包：評量、活動與延伸閱讀",
    ]

    _CLASSIFICATIONS = [
        # 這裡不追求完整分類法，只要「看起來像真的」即可支援 UI。
        "028.5",  # 圖書館管理
        "020.7",  # 圖書資訊
        "371.3",  # 教學法
        "410",  # 數學
        "500",  # 自然科學
        "610",  # 醫學/健康
        "800",  # 文學
        "900",  # 歷史地理
        "158.2",  # 心理/成長
        "004",  # 電腦/資訊
        "005.1",  # 程式設計
        "028.7",  # 閱讀推廣/讀者服務（示意）
        "363.7",  # 環境議題（示意）
    ]

    def __init__(self, rng: random.Random):
        self.rng = rng

    def person_name(self) -> str:
        surname = self.rng.choice(self._SURNAMES)
        given = self.rng.choice(self._GIVEN_CHARS) + self.rng.choice(self._GIVEN_CHARS)
        return surname + given

    def publisher(self) -> str:
        return self.rng.choice(self._PUBLISHERS)

    def subject_terms(self, k: int) -> list[str]:
        # sample：不重複抽樣（k 太大就截斷）
        k = max(1, min(k, len(self._SUBJECTS)))
        return self.rng.sample(self._SUBJECTS, k=k)

    def bib_title(self) -> str:
        subject = self.rng.choice(self._SUBJECTS)
        subject2 = self.rng.choice(self._SUBJECTS)
        edition = self.rng.randint(1, 6)
        tpl = self.rng.choice(self._TITLE_TEMPLATES)
        return tpl.format(subject=subject, subject2=subject2, edition=edition)

    def classification(self) -> str:
        return self.rng.choice(self._CLASSIFICATIONS)

    def geographic_terms(self, k: int) -> list[str]:
        # sample：允許 k=0（代表本筆書目沒有地理名稱）
        k = max(0, min(k, len(self._GEOGRAPHICS)))
        if k == 0:
            return []
        return self.rng.sample(self._GEOGRAPHICS, k=k)

    def genre_terms(self, k: int) -> list[str]:
        k = max(0, min(k, len(self._GENRES)))
        if k == 0:
            return []
        return self.rng.sample(self._GENRES, k=k)

    def language_code(self) -> str:
        # 語言分布：以 zh-TW 為主，少量混入其他語言（讓 UI 更像真實館藏）。
        r = self.rng.random()
        if r < 0.80:
            return "zh-TW"
        if r < 0.88:
            return "zh"
        if r < 0.94:
            return "en"
        if r < 0.965:
            return "ja"
        if r < 0.98:
            return "ko"
        if r < 0.99:
            return "vi"
        return "id"


class HuggingFaceTextProvider(TextProvider):
    """
    HuggingFaceTextProvider（保留介面）

    這裡先不把 transformers/torch 直接做成 repo 的強依賴，原因：
    - 下載與安裝成本高（尤其 Playwright/瀏覽器/LLM 同時導入時）
    - 你可能在不同機器/CI 需要不同的 cache 策略

    如果你真的要啟用 HF 模型：
    1) 你可以改 docker/seed-scale.Dockerfile 加上 pip 安裝 transformers/torch
    2) 透過 env 指定 model（例如 SCALE_HF_MODEL=...）
    3) 這裡再把實作補上（建議用固定 seed + 固定 prompt 模板確保可重現）
    """

    def __init__(self, rng: random.Random):
        self.rng = rng
        raise RuntimeError(
            "HuggingFaceTextProvider 尚未內建依賴（transformers/torch）。"
            "請先用 rules provider，或指定要用的模型與安裝策略後我再幫你補上。"
        )

    def person_name(self) -> str:
        raise NotImplementedError

    def publisher(self) -> str:
        raise NotImplementedError

    def subject_terms(self, k: int) -> list[str]:
        raise NotImplementedError

    def bib_title(self) -> str:
        raise NotImplementedError

    def classification(self) -> str:
        raise NotImplementedError

    def geographic_terms(self, k: int) -> list[str]:
        raise NotImplementedError

    def genre_terms(self, k: int) -> list[str]:
        raise NotImplementedError

    def language_code(self) -> str:
        raise NotImplementedError


def make_text_provider(cfg: ScaleConfig, rng: random.Random) -> TextProvider:
    if cfg.text_provider == "rules":
        return RulesTextProvider(rng)
    return HuggingFaceTextProvider(rng)


def validate_rules_vocab() -> None:
    """
    validate_rules_vocab：對 rules provider 的「內建詞彙庫」做防呆驗證。

    為什麼要驗證？
    - authority_terms.variant_labels（UF）若與其他 preferred_label 撞名，或跨 term 重複，
      會造成「label → 多筆 term」的模糊匹配，進而讓 API 寫入/治理流程不穩（BibsService 會拒絕）。
    - thesaurus edges 若引用不存在的 term，UI 會變成「看起來沒資料」或卡在奇怪的 orphan 節點。
    - broader edges 若不小心形成 cycle，seed 直接寫 DB 不會觸發 API 的 cycle check，
      但後續 UI/expand/ancestors 會出現不可預期行為。
    """

    def assert_unique_preferred(kind: str, labels: list[str]) -> set[str]:
        seen: set[str] = set()
        for label in labels:
            s = str(label).strip()
            if not s:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: empty preferred_label found")
            if s in seen:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: duplicate preferred_label={s!r}")
            seen.add(s)
        return seen

    def assert_variant_mapping(kind: str, preferred: set[str], mapping: dict[str, list[str]]) -> None:
        used_variants: dict[str, str] = {}  # variant_label -> preferred_label（反查用）
        for pref, variants in mapping.items():
            if pref not in preferred:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: variants map key not in preferred_labels: {pref!r}")
            for v in variants:
                vv = str(v).strip()
                if not vv:
                    raise SystemExit(f"[seed-scale] rules vocab {kind}: empty variant_label under {pref!r}")
                if vv == pref:
                    raise SystemExit(f"[seed-scale] rules vocab {kind}: variant_label equals preferred_label: {pref!r}")
                if vv in preferred:
                    raise SystemExit(
                        f"[seed-scale] rules vocab {kind}: variant_label conflicts with another preferred_label: variant={vv!r}"
                    )
                owner = used_variants.get(vv)
                if owner and owner != pref:
                    raise SystemExit(
                        f"[seed-scale] rules vocab {kind}: variant_label used by multiple terms: variant={vv!r} owners={owner!r},{pref!r}"
                    )
                used_variants[vv] = pref

    def assert_edges_exist(kind: str, preferred: set[str], broader_edges: list[tuple[str, str]], related_edges: list[tuple[str, str]]) -> None:
        for child, parent in broader_edges:
            if child not in preferred:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: broader edge child not found: {child!r}")
            if parent not in preferred:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: broader edge parent not found: {parent!r}")
            if child == parent:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: broader edge self-loop: {child!r}")
        for a, b in related_edges:
            if a not in preferred:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: related edge term not found: {a!r}")
            if b not in preferred:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: related edge term not found: {b!r}")
            if a == b:
                raise SystemExit(f"[seed-scale] rules vocab {kind}: related edge self-loop: {a!r}")

    def assert_acyclic(kind: str, broader_edges: list[tuple[str, str]]) -> None:
        graph: dict[str, list[str]] = {}
        for child, parent in broader_edges:
            graph.setdefault(child, []).append(parent)

        visiting: set[str] = set()
        visited: set[str] = set()

        def dfs(node: str, path: list[str]) -> None:
            if node in visiting:
                cycle = " → ".join(path + [node])
                raise SystemExit(f"[seed-scale] rules vocab {kind}: broader edges contains cycle: {cycle}")
            if node in visited:
                return
            visiting.add(node)
            for nxt in graph.get(node, []):
                dfs(nxt, path + [node])
            visiting.remove(node)
            visited.add(node)

        for node in graph.keys():
            dfs(node, [])

    # subjects
    subject_pref = assert_unique_preferred("subject", RulesTextProvider._SUBJECTS)
    assert_variant_mapping("subject", subject_pref, RulesTextProvider._SUBJECT_VARIANTS)
    assert_edges_exist("subject", subject_pref, RulesTextProvider._SUBJECT_BROADER_EDGES, RulesTextProvider._SUBJECT_RELATED_EDGES)
    assert_acyclic("subject", RulesTextProvider._SUBJECT_BROADER_EDGES)

    # geographics（注意：authority 用 _GEOGRAPHICS_ALL；書目指派用 _GEOGRAPHICS）
    geo_pref = assert_unique_preferred("geographic", RulesTextProvider._GEOGRAPHICS_ALL)
    for label in RulesTextProvider._GEOGRAPHICS:
        if label not in geo_pref:
            raise SystemExit(f"[seed-scale] rules vocab geographic: _GEOGRAPHICS contains label not in _GEOGRAPHICS_ALL: {label!r}")
    assert_variant_mapping("geographic", geo_pref, RulesTextProvider._GEOGRAPHIC_VARIANTS)
    assert_edges_exist("geographic", geo_pref, RulesTextProvider._GEOGRAPHIC_BROADER_EDGES, RulesTextProvider._GEOGRAPHIC_RELATED_EDGES)
    assert_acyclic("geographic", RulesTextProvider._GEOGRAPHIC_BROADER_EDGES)

    # genres（注意：authority 用 _GENRES_ALL；書目指派用 _GENRES）
    genre_pref = assert_unique_preferred("genre", RulesTextProvider._GENRES_ALL)
    for label in RulesTextProvider._GENRES:
        if label not in genre_pref:
            raise SystemExit(f"[seed-scale] rules vocab genre: _GENRES contains label not in _GENRES_ALL: {label!r}")
    assert_variant_mapping("genre", genre_pref, RulesTextProvider._GENRE_VARIANTS)
    assert_edges_exist("genre", genre_pref, RulesTextProvider._GENRE_BROADER_EDGES, RulesTextProvider._GENRE_RELATED_EDGES)
    assert_acyclic("genre", RulesTextProvider._GENRE_BROADER_EDGES)


# ----------------------------
# 2) Postgres / CSV helper
# ----------------------------


def pg_null() -> str:
    # COPY 的 NULL 我們統一用 \N（並在 \\copy 指定 NULL '\\N'）
    return r"\N"


def pg_array(values: list[str] | None) -> str:
    """
    Postgres array literal（給 text[] 欄位）
    - 例如：{"張小明","李小華"}
    - 若 values=None → NULL（\\N）
    """

    if values is None:
        return pg_null()
    if len(values) == 0:
        return "{}"

    # array element：以雙引號包起來，並做最小 escape（避免逗號/空白造成解析問題）
    escaped: list[str] = []
    for v in values:
        s = str(v)
        s = s.replace("\\", "\\\\").replace('"', '\\"')
        escaped.append(f'"{s}"')
    return "{" + ",".join(escaped) + "}"


def jsonb(value: object) -> str:
    """
    產生 JSONB 欄位的字串內容（給 psql \\copy 用）。

    注意：
    - 我們用 ensure_ascii=False 保留 UTF-8（繁中不變成 \\uXXXX）
    - \\copy (FORMAT csv) 會把欄位視為 text，再由 Postgres cast 成 jsonb
    """

    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def marc_control_field(tag: str, value: str) -> dict[str, object]:
    # JSON-friendly MARC shape（對齊 apps/api/src/common/marc.ts 與 apps/api/src/bibs/bibs.schemas.ts）
    return {"tag": tag, "value": value}


def marc_data_field(
    tag: str,
    *,
    ind1: str = " ",
    ind2: str = " ",
    subfields: list[tuple[str, str]],
) -> dict[str, object]:
    # - subfields 以 (code, value) 表示 → 寫入時轉成 [{code,value}, ...]
    # - 指標若為空白，仍用 ' '（與 MARC 21 慣例一致）
    return {
        "tag": tag,
        "ind1": ind1[:1] if ind1 else " ",
        "ind2": ind2[:1] if ind2 else " ",
        "subfields": [{"code": code, "value": value} for (code, value) in subfields],
    }


def uuid5(ns: uuid.UUID, name: str) -> str:
    # uuid5 是「可重現」的：相同 name → 相同 UUID
    return str(uuid.uuid5(ns, name))


def now_utc() -> dt.datetime:
    return dt.datetime.now(tz=dt.timezone.utc)


def iso(dt_value: dt.datetime | None) -> str:
    if dt_value is None:
        return pg_null()
    # Postgres timestamptz 可吃 ISO 8601
    return dt_value.isoformat()


def compute_scrypt_v1(password: str, salt_b64_string: str) -> str:
    """
    對齊 apps/api 的 scrypt-v1（Node crypto.scrypt 的預設參數）：
    - keylen = 64
    - N=16384, r=8, p=1

    重要細節：
    - apps/api 把 salt 存成 base64 字串，但「拿去 scrypt 的 salt」是這個字串本身（UTF-8 bytes）
      → 我們在 Python 端也必須用 salt_b64_string.encode("utf-8")，不要 base64 decode。
    """

    dk = hashlib.scrypt(
        password=password.encode("utf-8"),
        salt=salt_b64_string.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    )
    return base64.b64encode(dk).decode("ascii")


def deterministic_salt_b64(seed: int) -> str:
    """
    產生一個「固定可重現」的 salt（16 bytes → base64 字串）。
    - 我們用 SHA-256(seed) 的前 16 bytes，避免依賴系統隨機來源。
    """

    digest = hashlib.sha256(f"seed-scale:{seed}".encode("utf-8")).digest()
    raw16 = digest[:16]
    return base64.b64encode(raw16).decode("ascii")


def run_psql(args: list[str], *, cwd: Path | None = None) -> None:
    """
    透過 psql 執行命令。
    - 我們依賴 PG* env（PGHOST/PGUSER/PGPASSWORD/PGDATABASE）做連線
    - 用 ON_ERROR_STOP 確保任何錯誤立即中止（避免半套資料）
    """

    cmd = ["psql", "-v", "ON_ERROR_STOP=1", *args]
    print(f"[seed-scale] $ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def write_csv(path: Path, rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerows(rows)


# ----------------------------
# 3) 生成資料（核心）
# ----------------------------


def main() -> None:
    cfg = load_config()

    # 1) workdir：每次都清空（避免舊檔案殘留造成 \\copy 讀到錯的資料）
    if cfg.workdir.exists():
        for p in cfg.workdir.glob("*"):
            try:
                p.unlink()
            except IsADirectoryError:
                # 理論上不會有資料夾；保險起見
                for sub in p.rglob("*"):
                    if sub.is_file():
                        sub.unlink()
                p.rmdir()
    cfg.workdir.mkdir(parents=True, exist_ok=True)

    # 2) RNG：整支腳本的「可重現核心」
    rng = random.Random(cfg.seed)
    text = make_text_provider(cfg, rng)
    if cfg.text_provider == "rules":
        validate_rules_vocab()

    # 3) namespace：所有 ID 都用 uuid5 生成（可重現且不依賴 DB gen_random_uuid）
    ns = uuid.UUID("7b4a3b9d-9a55-4f03-9d9e-7d9edb1c5f6b")

    org_id = uuid5(ns, f"org:{cfg.org_code}")

    # 4) 固定 demo 密碼（只給少數帳號）
    salt = deterministic_salt_b64(cfg.seed)
    password_hash = compute_scrypt_v1(cfg.password, salt)

    # ----------------------------
    # 3.1 organizations（1 筆）
    # ----------------------------
    org_rows = [[org_id, cfg.org_name, cfg.org_code]]

    # ----------------------------
    # 3.2 locations（幾個常用場景）
    # - MAIN：主要圖書館
    # - BRANCH：分館
    # - CLASSROOM：班級書箱/教室
    # - STORAGE：庫房（測試 location filter）
    # - CLOSED：停用館別（測試 OPAC 只顯示 active）
    # ----------------------------
    locations: list[dict[str, str]] = []

    def add_location(code: str, name: str, area: str | None, shelf: str | None, status: str) -> None:
        locations.append(
            {
                "id": uuid5(ns, f"{cfg.org_code}:loc:{code}"),
                "organization_id": org_id,
                "code": code,
                "name": name,
                "area": area if area else pg_null(),
                "shelf_code": shelf if shelf else pg_null(),
                "status": status,
            }
        )

    add_location("MAIN", "總館（大型資料集）", "行政大樓", "A-01", "active")
    add_location("BRANCH", "分館（大型資料集）", "教學大樓", "B-02", "active")
    add_location("CLASSROOM", "班級書箱（示範）", "各班教室", "C-xx", "active")
    add_location("STORAGE", "庫房（示範）", "後勤區", "S-00", "active")
    add_location("CLOSED", "已停用館別（示範）", "舊館", "X-00", "inactive")

    loc_main = next(l for l in locations if l["code"] == "MAIN")["id"]
    loc_branch = next(l for l in locations if l["code"] == "BRANCH")["id"]
    loc_classroom = next(l for l in locations if l["code"] == "CLASSROOM")["id"]
    loc_storage = next(l for l in locations if l["code"] == "STORAGE")["id"]

    # ----------------------------
    # 3.3 users（staff + teacher + student）
    # - 重要：StaffAuth 需要 user_credentials 才能登入
    # - 我們只給：A0001/L0001/T0001/S1130123 建 credentials（其他人僅做列表/搜尋資料）
    # ----------------------------
    users: list[dict[str, str]] = []

    def add_user(external_id: str, name: str, role: str, org_unit: str | None, status: str) -> str:
        user_id = uuid5(ns, f"{cfg.org_code}:user:{external_id}")
        users.append(
            {
                "id": user_id,
                "organization_id": org_id,
                "external_id": external_id,
                "name": name,
                "role": role,
                "org_unit": org_unit if org_unit else pg_null(),
                "status": status,
            }
        )
        return user_id

    admin_id = add_user("A0001", "系統管理員（大型資料集）", "admin", None, "active")
    librarian_id = add_user("L0001", "圖書館員（大型資料集）", "librarian", "圖書館", "active")
    teacher_login_id = add_user("T0001", "陳老師（可登入）", "teacher", "教務處", "active")
    student_login_id = add_user("S1130123", "王小明（可登入）", "student", "501", "active")

    # 測試/示範用「登入帳號」清單：
    # - 我們會避免把大量 open loans / queued holds 隨機塞到這些帳號
    # - 讓 E2E 測試能穩定建立新借閱/新預約（不會一進去就撞 max_loans/max_holds）
    login_user_ids = {teacher_login_id, student_login_id}

    # 其餘 teachers：外觀/搜尋用，名稱全繁中
    for i in range(2, cfg.teachers + 1):
        ext = f"T{i:04d}"
        name = text.person_name() + "老師"
        unit = rng.choice(["教務處", "學務處", "總務處", "輔導室", "導師", "科任"])
        add_user(ext, name, "teacher", unit, "active")

    # students：以「班級」分布（501~520）做 UI filter
    class_codes = [f"{grade}{cls:02d}" for grade in [5, 6] for cls in range(1, 11)]
    for i in range(1, cfg.students + 1):
        # 外部系統學號示意：S113 + 4 digits
        ext = f"S113{i:04d}"
        name = text.person_name()
        org_unit = rng.choice(class_codes)
        status = "inactive" if (i % 97 == 0) else "active"  # 少量停用，方便測 status filter
        # S1130123 我們已建立；避免重複
        if ext == "S1130123":
            continue
        add_user(ext, name, "student", org_unit, status)

    # ----------------------------
    # 3.4 user_credentials（只給少數帳號）
    # - 這裡用固定 salt/hash（可重現）→ 不用對每個人跑 scrypt（節省時間）
    # ----------------------------
    credentials_rows = [
        [admin_id, salt, password_hash, "scrypt-v1"],
        [librarian_id, salt, password_hash, "scrypt-v1"],
        [teacher_login_id, salt, password_hash, "scrypt-v1"],
        [student_login_id, salt, password_hash, "scrypt-v1"],
    ]

    # ----------------------------
    # 3.5 bibliographic_records（書目）
    # - creators/subjects 用 text[]（用 pg_array）
    # ----------------------------
    bibs: list[dict[str, str]] = []
    # bibliographic_subject_terms（authority linking v1）
    # - 讓你能用 term_id-driven 的方式查詢/統計（避免靠 subjects 的字串長相）
    # - position 用於保留原本 subjects 的順序（匯出/顯示會用到）
    bib_subject_terms_rows: list[dict[str, str]] = []
    # Authority / Vocabulary v0：從書目的 creators/subjects 收斂出「可重現」的權威款目清單。
    #
    # 設計取捨（scale seed）：
    # - subject：我們把 rules provider 的 _SUBJECTS 視為「內建詞彙庫」（vocabulary_code=builtin-zh）
    # - name：書目作者（隨機繁中姓名）會很多，但這正好用來壓力測試「大量權威款目」的管理頁與 autocomplete
    authority_subject_terms: set[str] = set()
    authority_name_terms: set[str] = set()
    authority_geographic_terms: set[str] = set()
    authority_genre_terms: set[str] = set()

    # bibliographic_name_terms / geographic_terms / genre_terms（term_id linking）
    bib_name_terms_rows: list[dict[str, str]] = []
    bib_geographic_terms_rows: list[dict[str, str]] = []
    bib_genre_terms_rows: list[dict[str, str]] = []

    # E2E/QA 的「哨兵書目」：提供穩定可搜尋的標題 + 穩定可驗證的狀態
    # - sentinel_available：預設維持 available（讓 checkout/place hold/checkin/fulfill 流程可預期）
    # - sentinel_unavailable：預設維持「全部不可借」（用來測 available_only 這類 filter 的正確性）
    #
    # 注意：cfg.bibs 若小於 2，sentinel_unavailable 會自然不存在（但一般 scale seed 會遠大於 2）。
    sentinel_bib_index = 1  # 1-based（對齊 bib loop）
    sentinel_bib_title = "【E2E】預約/借還流程測試書（請勿刪除）"
    sentinel_unavailable_bib_index = 2
    sentinel_unavailable_bib_title = "【E2E】全部借出（不可借）測試書（請勿刪除）"
    for i in range(1, cfg.bibs + 1):
        bib_id = uuid5(ns, f"{cfg.org_code}:bib:{i:06d}")
        # 讓第一筆 bib 成為「哨兵」：標題可用關鍵字一搜就中，且有較完整的 MARC extras 例子。
        if i == sentinel_bib_index:
            title = sentinel_bib_title
            creators = ["測試作者甲"]
            contributors = ["測試作者乙"]
            subjects = ["閱讀推廣", "資訊素養"]
            geographics = ["臺灣", "臺北市"]
            genres = ["科普", "手冊"]
            language = "zh-TW"
            publisher = "臺灣教育出版社"
            published_year = "2024"
            isbn = "9780000000001"
            classification = "028.5"

            # marc_extras：放「表單未覆蓋」但實務常見的欄位，供你測試 editor/匯出 merge。
            # - 避免 001/005：系統管理欄位（字典會擋）
            # - 避免直接塞 245$a/264$b 這種「表單會覆蓋」的子欄位，否則使用者會以為改了卻沒生效
            marc_extras = [
                marc_data_field("246", ind1="3", ind2="0", subfields=[("a", "預約與借還操作手冊")]),
                marc_data_field("500", subfields=[("a", "本書目為自動化測試用示範資料。")]),
                marc_data_field(
                    "520",
                    subfields=[
                        (
                            "a",
                            "示範 OPAC 預約、後台借還、以及 MARC extras 編輯/匯出的完整流程。",
                        )
                    ],
                ),
                marc_data_field(
                    "856",
                    ind1="4",
                    ind2="0",
                    subfields=[("u", "https://example.com/e2e-sentinel"), ("y", "相關資源")],
                ),
            ]
        elif i == sentinel_unavailable_bib_index:
            title = sentinel_unavailable_bib_title
            creators = ["測試作者丙"]
            contributors = ["測試作者丁"]
            subjects = ["閱讀推廣"]
            geographics = ["臺灣"]
            genres = ["手冊"]
            language = "zh-TW"
            publisher = "臺灣教育出版社"
            published_year = "2023"
            isbn = "9780000000002"
            classification = "028.6"

            # 這筆不需要放太多 MARC extras；重點是「狀態不可借」可被 available_only 正確排除。
            marc_extras = [marc_data_field("500", subfields=[("a", "本書目用於測試 available_only（不可借）。")])]
        else:
            title = text.bib_title()

            creators = [text.person_name()]
            if rng.random() < 0.35:
                creators.append(text.person_name())

            # contributors：讓 700$a 有資料（也讓 bibliographic_name_terms 更像真實）
            contributors: list[str] = []
            if rng.random() < 0.55:
                contributors.append(text.person_name())
            if rng.random() < 0.20:
                contributors.append(text.person_name())

            # subjects：維持至少 1 個（讓 OPAC/後台的主題檢索更有感）
            subjects = text.subject_terms(k=rng.randint(1, 3))

            # geographics/genres：允許為空（更貼近真實館藏）
            geographics = text.geographic_terms(k=(rng.randint(1, 2) if rng.random() < 0.35 else 0))
            genres = text.genre_terms(k=(rng.randint(1, 2) if rng.random() < 0.30 else 0))

            language = text.language_code()
            publisher = text.publisher()
            published_year = str(rng.randint(1995, 2025))
            isbn = f"978{rng.randint(1000000000, 9999999999)}"
            classification = text.classification()

            # marc_extras：大多數 bib 先留空（[]），少量放一些常見 note（讓 editor 有東西可看）
            marc_extras = []
            if rng.random() < 0.08:
                marc_extras = [
                    marc_data_field("500", subfields=[("a", "含插圖，適合國小閱讀。")]),
                    marc_data_field(
                        "520",
                        subfields=[("a", "以案例帶領讀者理解主題核心概念。")],
                    ),
                ]

        # 去重（保序）：避免 junction table 因重複值造成 PK/position 衝突
        def dedupe_keep_order(values: list[str]) -> list[str]:
            seen: set[str] = set()
            out: list[str] = []
            for v in values:
                s = str(v).strip()
                if not s:
                    continue
                if s in seen:
                    continue
                seen.add(s)
                out.append(s)
            return out

        creators = dedupe_keep_order(creators)
        contributors = dedupe_keep_order(contributors)
        geographics = dedupe_keep_order(geographics)
        genres = dedupe_keep_order(genres)

        for c in creators:
            authority_name_terms.add(c)
        for c in contributors:
            authority_name_terms.add(c)
        for s in subjects:
            authority_subject_terms.add(s)
        for g in geographics:
            authority_geographic_terms.add(g)
        for g in genres:
            authority_genre_terms.add(g)

        # authority linking（subjects）：
        # - term_id 與 authority_terms 的 UUID5 規則一致（可重現）
        # - 這裡的 subjects 由 RulesTextProvider.sample 產生，不重複；仍用 position 保留順序
        for pos, term in enumerate(subjects, start=1):
            term_id = uuid5(ns, f"{cfg.org_code}:authority:subject:builtin-zh:{term}")
            bib_subject_terms_rows.append(
                {
                    "organization_id": org_id,
                    "bibliographic_id": bib_id,
                    "term_id": term_id,
                    "position": str(pos),
                }
            )

        # authority linking（names）：
        # - role=creator：對應主作者/其他作者（MARC 100/700）
        # - role=contributor：對應貢獻者（MARC 700）
        for pos, name in enumerate(creators, start=1):
            term_id = uuid5(ns, f"{cfg.org_code}:authority:name:local:{name}")
            bib_name_terms_rows.append(
                {
                    "organization_id": org_id,
                    "bibliographic_id": bib_id,
                    "role": "creator",
                    "term_id": term_id,
                    "position": str(pos),
                }
            )
        for pos, name in enumerate(contributors, start=1):
            term_id = uuid5(ns, f"{cfg.org_code}:authority:name:local:{name}")
            bib_name_terms_rows.append(
                {
                    "organization_id": org_id,
                    "bibliographic_id": bib_id,
                    "role": "contributor",
                    "term_id": term_id,
                    "position": str(pos),
                }
            )

        # authority linking（geographic / genre）：
        # - vocabulary_code：我們把 rules provider 的地名/體裁字庫視為 builtin-zh（可與 subject 一致）
        for pos, label in enumerate(geographics, start=1):
            term_id = uuid5(ns, f"{cfg.org_code}:authority:geographic:builtin-zh:{label}")
            bib_geographic_terms_rows.append(
                {
                    "organization_id": org_id,
                    "bibliographic_id": bib_id,
                    "term_id": term_id,
                    "position": str(pos),
                }
            )
        for pos, label in enumerate(genres, start=1):
            term_id = uuid5(ns, f"{cfg.org_code}:authority:genre:builtin-zh:{label}")
            bib_genre_terms_rows.append(
                {
                    "organization_id": org_id,
                    "bibliographic_id": bib_id,
                    "term_id": term_id,
                    "position": str(pos),
                }
            )

        bibs.append(
            {
                "id": bib_id,
                "organization_id": org_id,
                "title": title,
                "creators": pg_array(creators),
                "contributors": pg_array(contributors),
                "publisher": publisher,
                "published_year": published_year,
                "language": language,
                "subjects": pg_array(subjects),
                "geographics": pg_array(geographics),
                "genres": pg_array(genres),
                "isbn": isbn,
                "classification": classification,
                "marc_extras": jsonb(marc_extras),
            }
        )

    # ----------------------------
    # 3.5.0 補齊 builtin vocab（避免「剛好沒抽到」導致 thesaurus 沒資料）
    # ----------------------------
    #
    # 這支腳本的目標是 UI/E2E 可用性，而不是「只匯入被用到的最小集合」：
    # - 若 authority_terms 只從 bibs 反推，某些 term 可能因隨機抽樣沒命中而不存在
    # - 結果會讓 thesaurus/tree 看起來像壞掉（其實只是資料缺席）
    #
    # 因此我們在 scale seed 階段，直接把 rules provider 的內建詞彙庫全量放進 authority_terms：
    # - subject：RulesTextProvider._SUBJECTS（builtin-zh）
    # - geographic：RulesTextProvider._GEOGRAPHICS_ALL（builtin-zh）
    # - genre：RulesTextProvider._GENRES_ALL（builtin-zh）
    authority_subject_terms.update(RulesTextProvider._SUBJECTS)
    authority_geographic_terms.update(RulesTextProvider._GEOGRAPHICS_ALL)
    authority_genre_terms.update(RulesTextProvider._GENRES_ALL)

    # ----------------------------
    # 3.5.1 authority_terms（權威控制款目 / 內建詞彙庫）
    # - 由上面累積的 set 產生（可重現）
    # - v1.5 起：內建詞彙庫會帶少量 variant_labels（UF），讓搜尋/expand/治理可測
    # ----------------------------
    authority_terms: list[dict[str, str]] = []

    for term in sorted(authority_subject_terms):
        term_id = uuid5(ns, f"{cfg.org_code}:authority:subject:builtin-zh:{term}")
        variants = RulesTextProvider._SUBJECT_VARIANTS.get(term)
        authority_terms.append(
            {
                "id": term_id,
                "organization_id": org_id,
                "kind": "subject",
                "vocabulary_code": "builtin-zh",
                "preferred_label": term,
                "variant_labels": pg_array(variants) if variants else pg_null(),
                "note": pg_null(),
                "source": "seed-scale",
                "status": "active",
            }
        )

    for term in sorted(authority_name_terms):
        term_id = uuid5(ns, f"{cfg.org_code}:authority:name:local:{term}")
        authority_terms.append(
            {
                "id": term_id,
                "organization_id": org_id,
                "kind": "name",
                "vocabulary_code": "local",
                "preferred_label": term,
                "variant_labels": pg_null(),
                "note": pg_null(),
                "source": "seed-scale",
                "status": "active",
            }
        )

    for term in sorted(authority_geographic_terms):
        term_id = uuid5(ns, f"{cfg.org_code}:authority:geographic:builtin-zh:{term}")
        variants = RulesTextProvider._GEOGRAPHIC_VARIANTS.get(term)
        authority_terms.append(
            {
                "id": term_id,
                "organization_id": org_id,
                "kind": "geographic",
                "vocabulary_code": "builtin-zh",
                "preferred_label": term,
                "variant_labels": pg_array(variants) if variants else pg_null(),
                "note": pg_null(),
                "source": "seed-scale",
                "status": "active",
            }
        )

    for term in sorted(authority_genre_terms):
        term_id = uuid5(ns, f"{cfg.org_code}:authority:genre:builtin-zh:{term}")
        variants = RulesTextProvider._GENRE_VARIANTS.get(term)
        authority_terms.append(
            {
                "id": term_id,
                "organization_id": org_id,
                "kind": "genre",
                "vocabulary_code": "builtin-zh",
                "preferred_label": term,
                "variant_labels": pg_array(variants) if variants else pg_null(),
                "note": pg_null(),
                "source": "seed-scale",
                "status": "active",
            }
        )

    # ----------------------------
    # 3.5.2 authority_term_relations（thesaurus：BT/NT/RT）
    # - 不是為了「語意正確」的分類法，而是為了讓 UI/檢索擴充功能有真資料可跑
    # - 僅建立少量 deterministic 關係（避免產生 cycle）
    # ----------------------------
    authority_relations: list[dict[str, str]] = []
    rel_keys: set[tuple[str, str, str]] = set()  # (from_term_id, relation_type, to_term_id)

    def try_add_broader(kind: str, vocab: str, narrower_label: str, broader_label: str) -> None:
        if not narrower_label or not broader_label:
            return
        if narrower_label == broader_label:
            return

        # 只有兩端都存在於本次 seed 的 authority set，才建立關係（避免小型資料集時引用不存在）。
        if kind == "subject":
            if narrower_label not in authority_subject_terms or broader_label not in authority_subject_terms:
                return
        if kind == "geographic":
            if narrower_label not in authority_geographic_terms or broader_label not in authority_geographic_terms:
                return
        if kind == "genre":
            if narrower_label not in authority_genre_terms or broader_label not in authority_genre_terms:
                return

        from_id = uuid5(ns, f"{cfg.org_code}:authority:{kind}:{vocab}:{narrower_label}")
        to_id = uuid5(ns, f"{cfg.org_code}:authority:{kind}:{vocab}:{broader_label}")
        key = (from_id, "broader", to_id)
        if key in rel_keys:
            return
        rel_keys.add(key)
        authority_relations.append(
            {
                "id": uuid5(ns, f"{cfg.org_code}:relation:{from_id}:broader:{to_id}"),
                "organization_id": org_id,
                "from_term_id": from_id,
                "relation_type": "broader",
                "to_term_id": to_id,
            }
        )

    def try_add_related(kind: str, vocab: str, a_label: str, b_label: str) -> None:
        if not a_label or not b_label:
            return
        if a_label == b_label:
            return

        # 同上：只在兩端 term 都存在時才建。
        if kind == "subject":
            if a_label not in authority_subject_terms or b_label not in authority_subject_terms:
                return
        if kind == "geographic":
            if a_label not in authority_geographic_terms or b_label not in authority_geographic_terms:
                return
        if kind == "genre":
            if a_label not in authority_genre_terms or b_label not in authority_genre_terms:
                return

        a_id = uuid5(ns, f"{cfg.org_code}:authority:{kind}:{vocab}:{a_label}")
        b_id = uuid5(ns, f"{cfg.org_code}:authority:{kind}:{vocab}:{b_label}")
        # related：存一筆即可（固定排序避免 A↔B 兩筆）
        from_id, to_id = (a_id, b_id) if a_id < b_id else (b_id, a_id)
        key = (from_id, "related", to_id)
        if key in rel_keys:
            return
        rel_keys.add(key)
        authority_relations.append(
            {
                "id": uuid5(ns, f"{cfg.org_code}:relation:{from_id}:related:{to_id}"),
                "organization_id": org_id,
                "from_term_id": from_id,
                "relation_type": "related",
                "to_term_id": to_id,
            }
        )

    # subjects：BT/RT（由 rules provider 的 deterministic edges 產生）
    for child, parent in RulesTextProvider._SUBJECT_BROADER_EDGES:
        try_add_broader("subject", "builtin-zh", child, parent)
    for a, b in RulesTextProvider._SUBJECT_RELATED_EDGES:
        try_add_related("subject", "builtin-zh", a, b)

    # geographics：depth=2（市/縣 → region → 臺灣）
    for child, parent in RulesTextProvider._GEOGRAPHIC_BROADER_EDGES:
        try_add_broader("geographic", "builtin-zh", child, parent)
    for a, b in RulesTextProvider._GEOGRAPHIC_RELATED_EDGES:
        try_add_related("geographic", "builtin-zh", a, b)

    # genres：BT/RT（leaf→category；不追求嚴格 LCGFT，但保持可讀與可擴充）
    for child, parent in RulesTextProvider._GENRE_BROADER_EDGES:
        try_add_broader("genre", "builtin-zh", child, parent)
    for a, b in RulesTextProvider._GENRE_RELATED_EDGES:
        try_add_related("genre", "builtin-zh", a, b)

    # ----------------------------
    # 3.6 item_copies（冊）
    # - 每本書目 1..max_copies_per_bib 冊（用 RNG 決定）
    # - location 分布：MAIN 60% / BRANCH 25% / CLASSROOM 10% / STORAGE 5%
    # - status 先全部 available，之後再分配 checked_out / on_hold / lost / repair / withdrawn
    # ----------------------------
    items: list[dict[str, str]] = []
    barcode_counter = 1

    # E2E 哨兵冊資訊（用於後續「避開隨機分配」與輸出提示）
    sentinel_available_item_index = None
    sentinel_available_item_barcode = None
    sentinel_unavailable_item_index = None
    sentinel_unavailable_item_barcode = None

    def pick_location_id() -> str:
        x = rng.random()
        if x < 0.60:
            return loc_main
        if x < 0.85:
            return loc_branch
        if x < 0.95:
            return loc_classroom
        return loc_storage

    for i, bib in enumerate(bibs, start=1):
        # E2E 哨兵書目：固定只有 1 冊
        # - sentinel_available：讓「checkout → place hold → checkin → fulfill」可完全可預期
        # - sentinel_unavailable：讓 available_only filter 有穩定的「應被排除」案例
        copies = (
            1
            if i in (sentinel_bib_index, sentinel_unavailable_bib_index)
            else rng.randint(1, cfg.max_copies_per_bib)
        )
        for c in range(1, copies + 1):
            item_id = uuid5(ns, f"{cfg.org_code}:item:{barcode_counter:08d}")
            barcode = f"SCL-{barcode_counter:08d}"
            barcode_counter += 1

            classification = bib["classification"]
            call_number = f"{classification} {i:04d}-{c}"
            # 哨兵冊固定放 MAIN（避免被隨機分到 CLASSROOM/STORAGE 造成取書點/工作台測試不穩）
            location_id = (
                loc_main
                if i in (sentinel_bib_index, sentinel_unavailable_bib_index)
                else pick_location_id()
            )

            acquired_at = now_utc() - dt.timedelta(days=rng.randint(0, 3650))

            # last_inventory_at：先給少量冊有值（讓 UI 能顯示「曾盤點過」）
            last_inv = None
            if rng.random() < 0.10:
                last_inv = now_utc() - dt.timedelta(days=rng.randint(1, 365))

            items.append(
                {
                    "id": item_id,
                    "organization_id": org_id,
                    "bibliographic_id": bib["id"],
                    "barcode": barcode,
                    "call_number": call_number,
                    "location_id": location_id,
                    "status": "available",
                    "acquired_at": iso(acquired_at),
                    "last_inventory_at": iso(last_inv),
                    "notes": pg_null(),
                }
            )

            # 記錄哨兵冊的位置（items list index / barcode）
            if i == sentinel_bib_index and c == 1:
                sentinel_available_item_index = len(items) - 1
                sentinel_available_item_barcode = barcode
            if i == sentinel_unavailable_bib_index and c == 1:
                sentinel_unavailable_item_index = len(items) - 1
                sentinel_unavailable_item_barcode = barcode

    # ----------------------------
    # 3.7 分配 item status（與 loans/holds 對齊）
    # - checked_out：一定會有 open loan
    # - on_hold：一定會有 ready hold + assigned_item_id
    # - lost/repair/withdrawn：用於 UI 狀態篩選
    # ----------------------------
    item_ids_all = [it["id"] for it in items]
    if cfg.open_loans > len(item_ids_all):
        raise SystemExit(
            f"[seed-scale] SCALE_OPEN_LOANS too large; items={len(item_ids_all)} open_loans={cfg.open_loans}"
        )

    # 我們用 index 取樣，比直接 sample dict 更快。
    #
    # 但要先保留「E2E 哨兵冊」不被隨機分配成 checked_out/on_hold：
    # - sentinel_available：必須維持 available（讓流程測試穩定）
    # - sentinel_unavailable：我們會手動設為 checked_out（讓 available_only 測試穩定）
    sentinel_item_indexes: set[int] = set()
    if sentinel_available_item_index is not None:
        sentinel_item_indexes.add(int(sentinel_available_item_index))
    if sentinel_unavailable_item_index is not None:
        sentinel_item_indexes.add(int(sentinel_unavailable_item_index))

    forced_checked_out_indexes: set[int] = set()
    if sentinel_unavailable_item_index is not None:
        forced_checked_out_indexes.add(int(sentinel_unavailable_item_index))
    idx_all = [i for i in range(len(items)) if i not in sentinel_item_indexes]
    rng.shuffle(idx_all)

    # 小比例異常狀態（總共約 2%）
    n_lost = max(5, len(items) // 200)  # 0.5%
    n_repair = max(5, len(items) // 200)  # 0.5%
    n_withdrawn = max(5, len(items) // 500)  # 0.2%

    lost_idx = set(idx_all[:n_lost])
    repair_idx = set(idx_all[n_lost : n_lost + n_repair])
    withdrawn_idx = set(idx_all[n_lost + n_repair : n_lost + n_repair + n_withdrawn])

    remaining = [i for i in idx_all if i not in lost_idx and i not in repair_idx and i not in withdrawn_idx]

    # open loans：除了隨機取樣外，還要保留「強制 checked_out」的哨兵冊名額
    open_loan_target = max(0, cfg.open_loans - len(forced_checked_out_indexes))
    open_loan_idx = set(remaining[:open_loan_target])
    remaining2 = [i for i in remaining if i not in open_loan_idx]

    ready_hold_idx = set(remaining2[: cfg.ready_holds])

    for i, it in enumerate(items):
        if i in lost_idx:
            it["status"] = "lost"
        elif i in repair_idx:
            it["status"] = "repair"
        elif i in withdrawn_idx:
            it["status"] = "withdrawn"
        elif i in open_loan_idx:
            it["status"] = "checked_out"
        elif i in ready_hold_idx:
            it["status"] = "on_hold"

    # 手動套用哨兵冊狀態（確保可預期）
    for i in forced_checked_out_indexes:
        items[i]["status"] = "checked_out"

    # ----------------------------
    # 3.8 circulation_policies（學生/教師）
    # - 讓 checkout/renew/holds 的規則存在（對齊 MVP-SPEC）
    # ----------------------------
    policies = [
        {
            "id": uuid5(ns, f"{cfg.org_code}:policy:student"),
            "organization_id": org_id,
            "code": "STUDENT_DEFAULT",
            "name": "學生預設政策（大型資料集）",
            "audience_role": "student",
            "loan_days": "14",
            "max_loans": "5",
            "max_renewals": "1",
            "max_holds": "3",
            "hold_pickup_days": "7",
            "overdue_block_days": "7",
            # is_active：MVP 以「每個角色一套有效政策」為治理方式（避免只靠 created_at 最新一筆）
            "is_active": "true",
        },
        {
            "id": uuid5(ns, f"{cfg.org_code}:policy:teacher"),
            "organization_id": org_id,
            "code": "TEACHER_DEFAULT",
            "name": "教師預設政策（大型資料集）",
            "audience_role": "teacher",
            "loan_days": "28",
            "max_loans": "10",
            "max_renewals": "2",
            "max_holds": "5",
            "hold_pickup_days": "10",
            "overdue_block_days": "14",
            "is_active": "true",
        },
    ]

    # ----------------------------
    # 3.9 loans（open + closed）
    # - open loans：對應 checked_out items（returned_at=NULL）
    # - closed loans：歷史資料（returned_at 非 NULL）
    # ----------------------------
    borrowers_active = [
        u for u in users if u["role"] in ("student", "teacher") and u["status"] == "active"
    ]
    if not borrowers_active:
        raise SystemExit("[seed-scale] no active borrowers; check SCALE_STUDENTS/SCALE_TEACHERS")

    # bulk 分配用 borrowers：避免把 login accounts 撐爆（讓 E2E 更穩）
    borrowers_bulk = [u for u in borrowers_active if u["id"] not in login_user_ids]
    if not borrowers_bulk:
        borrowers_bulk = borrowers_active

    items_checked_out = [it for it in items if it["status"] == "checked_out"]

    # open loans：一冊一筆（符合 loans_one_open_per_item）
    loans: list[dict[str, str]] = []
    for it in items_checked_out:
        loan_id = uuid5(ns, f"{cfg.org_code}:loan:open:{it['id']}")
        borrower = rng.choice(borrowers_bulk)
        checked_out_at = now_utc() - dt.timedelta(days=rng.randint(0, 60))
        loan_days = 28 if borrower["role"] == "teacher" else 14
        due_at = checked_out_at + dt.timedelta(days=loan_days)

        # 少量做成逾期（讓 Overdue Report 一進去就有資料）
        if rng.random() < 0.15:
            due_at = now_utc() - dt.timedelta(days=rng.randint(1, 20))

        loans.append(
            {
                "id": loan_id,
                "organization_id": org_id,
                "item_id": it["id"],
                "user_id": borrower["id"],
                "checked_out_at": iso(checked_out_at),
                "due_at": iso(due_at),
                "returned_at": pg_null(),
                "renewed_count": str(rng.randint(0, 1)),
                "status": "open",
            }
        )

    # closed loans：大量歷史（用來測 reports/top-circulation / circulation-summary）
    for i in range(1, cfg.closed_loans + 1):
        loan_id = uuid5(ns, f"{cfg.org_code}:loan:closed:{i:07d}")
        borrower = rng.choice(borrowers_bulk)
        item = rng.choice(items)

        checked_out_at = now_utc() - dt.timedelta(days=rng.randint(0, 365))
        loan_days = 28 if borrower["role"] == "teacher" else 14
        due_at = checked_out_at + dt.timedelta(days=loan_days)
        returned_at = checked_out_at + dt.timedelta(days=rng.randint(1, loan_days))

        loans.append(
            {
                "id": loan_id,
                "organization_id": org_id,
                "item_id": item["id"],
                "user_id": borrower["id"],
                "checked_out_at": iso(checked_out_at),
                "due_at": iso(due_at),
                "returned_at": iso(returned_at),
                "renewed_count": str(rng.randint(0, 2)),
                "status": "closed",
            }
        )

    # ----------------------------
    # 3.10 holds（queued + ready）
    # - queued：assigned_item_id NULL
    # - ready：assigned_item_id 指向 on_hold item
    # - 需避免 holds_one_active_per_user_bib（同 user+bib 不能同時有 queued/ready）
    # ----------------------------
    holds: list[dict[str, str]] = []
    active_hold_keys: set[tuple[str, str]] = set()  # (user_id, bib_id)

    # ready holds：以 on_hold items 為主（讓 Ready Holds Report 有資料）
    ready_items = [it for it in items if it["status"] == "on_hold"]
    for it in ready_items:
        bib_id = it["bibliographic_id"]
        user = rng.choice(borrowers_bulk)
        key = (user["id"], bib_id)
        if key in active_hold_keys:
            continue
        active_hold_keys.add(key)

        hold_id = uuid5(ns, f"{cfg.org_code}:hold:ready:{it['id']}")
        ready_at = now_utc() - dt.timedelta(days=rng.randint(0, 10))
        # 部分做成「已過期的 ready」（可測 expire-ready maintenance）
        if rng.random() < 0.25:
            ready_until = now_utc() - dt.timedelta(days=rng.randint(1, 7))
        else:
            ready_until = now_utc() + dt.timedelta(days=rng.randint(1, 7))

        holds.append(
            {
                "id": hold_id,
                "organization_id": org_id,
                "bibliographic_id": bib_id,
                "user_id": user["id"],
                "pickup_location_id": it["location_id"],
                "placed_at": iso(ready_at - dt.timedelta(days=rng.randint(0, 3))),
                "status": "ready",
                "assigned_item_id": it["id"],
                "ready_at": iso(ready_at),
                "ready_until": iso(ready_until),
                "cancelled_at": pg_null(),
                "fulfilled_at": pg_null(),
            }
        )

    # queued holds：隨機書目（不指派冊）
    # queued holds：避免把哨兵書目排隊（讓 E2E 能穩定 place hold）
    sentinel_bib_id = uuid5(ns, f"{cfg.org_code}:bib:{sentinel_bib_index:06d}")
    bib_ids = [b["id"] for b in bibs if b["id"] != sentinel_bib_id]
    for i in range(1, cfg.queued_holds + 1):
        hold_id = uuid5(ns, f"{cfg.org_code}:hold:queued:{i:07d}")
        bib_id = rng.choice(bib_ids)
        user = rng.choice(borrowers_bulk)
        key = (user["id"], bib_id)
        if key in active_hold_keys:
            continue
        active_hold_keys.add(key)

        placed_at = now_utc() - dt.timedelta(days=rng.randint(0, 30))
        pickup_location_id = rng.choice([loc_main, loc_branch, loc_classroom])

        holds.append(
            {
                "id": hold_id,
                "organization_id": org_id,
                "bibliographic_id": bib_id,
                "user_id": user["id"],
                "pickup_location_id": pickup_location_id,
                "placed_at": iso(placed_at),
                "status": "queued",
                "assigned_item_id": pg_null(),
                "ready_at": pg_null(),
                "ready_until": pg_null(),
                "cancelled_at": pg_null(),
                "fulfilled_at": pg_null(),
            }
        )

    # ----------------------------
    # 3.11 inventory_sessions / inventory_scans（至少 1 個 closed session）
    # - 盤點差異（missing/unexpected）需要：
    #   - session.location 有很多 available items
    #   - 只掃一部分 → missing
    #   - 掃到非 available 或不同 location 的 item → unexpected
    # ----------------------------
    inventory_sessions_rows: list[dict[str, str]] = []
    inventory_scans_rows: list[dict[str, str]] = []

    # 先做一個 MAIN 的 closed session（報表最常用）
    base_started = now_utc() - dt.timedelta(days=30)
    for s in range(1, max(1, cfg.inventory_sessions) + 1):
        session_id = uuid5(ns, f"{cfg.org_code}:inv_session:{s:03d}")
        location_id = loc_main if s == 1 else rng.choice([loc_main, loc_branch, loc_classroom])
        started_at = base_started + dt.timedelta(days=s)
        closed_at = started_at + dt.timedelta(hours=2) if s <= 1 else pg_null()

        inventory_sessions_rows.append(
            {
                "id": session_id,
                "organization_id": org_id,
                "location_id": location_id,
                "actor_user_id": librarian_id,
                "note": f"大型資料集盤點（session {s}）",
                "started_at": iso(started_at),
                "closed_at": closed_at if isinstance(closed_at, str) else iso(closed_at),
            }
        )

        # scans：只掃一部分（讓 missing 出現）
        items_in_loc = [it for it in items if it["location_id"] == location_id]
        if not items_in_loc:
            continue

        scan_targets: list[dict[str, str]] = []
        available_in_loc = [it for it in items_in_loc if it["status"] == "available"]
        scan_targets.extend(rng.sample(available_in_loc, k=min(len(available_in_loc), cfg.scans_per_session)))

        # 加一些 unexpected：從其他 location 或非 available 狀態抽
        unexpected_pool = [it for it in items if it["status"] != "available" or it["location_id"] != location_id]
        scan_targets.extend(rng.sample(unexpected_pool, k=min(len(unexpected_pool), max(10, cfg.scans_per_session // 10))))

        # inventory_scans 有 UNIQUE(session_id, item_id)：避免重複
        seen_item_ids: set[str] = set()
        for idx, it in enumerate(scan_targets, start=1):
            if it["id"] in seen_item_ids:
                continue
            seen_item_ids.add(it["id"])

            scan_id = uuid5(ns, f"{cfg.org_code}:inv_scan:{session_id}:{it['id']}")
            scanned_at = started_at + dt.timedelta(minutes=idx)

            inventory_scans_rows.append(
                {
                    "id": scan_id,
                    "organization_id": org_id,
                    "session_id": session_id,
                    "location_id": location_id,
                    "item_id": it["id"],
                    "actor_user_id": librarian_id,
                    "scanned_at": iso(scanned_at),
                }
            )

    # ----------------------------
    # 3.12 audit_events（大量）
    # - entity_id 是 text，方便記錄多型指向；這裡用既有 id 當字串即可
    # ----------------------------
    audit_rows: list[dict[str, str]] = []
    actions = [
        ("user.import_csv", "user"),
        ("bib.create", "bib"),
        ("item.create", "item"),
        ("loan.checkout", "loan"),
        ("loan.checkin", "loan"),
        ("hold.place", "hold"),
        ("hold.fulfill", "hold"),
        ("inventory.scan", "inventory_scan"),
        ("report.export_csv", "report"),
    ]

    actor_pool = [admin_id, librarian_id]
    for i in range(1, cfg.audit_events + 1):
        event_id = uuid5(ns, f"{cfg.org_code}:audit:{i:08d}")
        action, entity_type = rng.choice(actions)
        actor_user_id = rng.choice(actor_pool)

        # entity_id：取一些真實存在的 id（讓 UI 看起來可追溯）
        entity_id = ""
        if entity_type == "loan" and loans:
            entity_id = rng.choice(loans)["id"]
        elif entity_type == "hold" and holds:
            entity_id = rng.choice(holds)["id"]
        elif entity_type == "item" and items:
            entity_id = rng.choice(items)["id"]
        elif entity_type == "bib" and bibs:
            entity_id = rng.choice(bibs)["id"]
        elif entity_type == "user" and users:
            entity_id = rng.choice(users)["id"]
        elif entity_type == "inventory_scan" and inventory_scans_rows:
            entity_id = rng.choice(inventory_scans_rows)["id"]
        else:
            entity_id = cfg.org_code

        metadata = {
            "note": "大型資料集自動產生",
            "seed": cfg.seed,
        }

        audit_rows.append(
            {
                "id": event_id,
                "organization_id": org_id,
                "actor_user_id": actor_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "metadata": json.dumps(metadata, ensure_ascii=False),
                "created_at": iso(now_utc() - dt.timedelta(days=rng.randint(0, 60))),
            }
        )

    # ----------------------------
    # 4) 寫 CSV（workdir）
    # ----------------------------
    write_csv(cfg.workdir / "organizations.csv", org_rows)

    write_csv(
        cfg.workdir / "locations.csv",
        [
            [
                l["id"],
                l["organization_id"],
                l["code"],
                l["name"],
                l["area"],
                l["shelf_code"],
                l["status"],
            ]
            for l in locations
        ],
    )

    write_csv(
        cfg.workdir / "users.csv",
        [
            [
                u["id"],
                u["organization_id"],
                u["external_id"],
                u["name"],
                u["role"],
                u["org_unit"],
                u["status"],
            ]
            for u in users
        ],
    )

    write_csv(cfg.workdir / "user_credentials.csv", credentials_rows)

    write_csv(
        cfg.workdir / "authority_terms.csv",
        [
            [
                t["id"],
                t["organization_id"],
                t["kind"],
                t["vocabulary_code"],
                t["preferred_label"],
                t["variant_labels"],
                t["note"],
                t["source"],
                t["status"],
            ]
            for t in authority_terms
        ],
    )

    write_csv(
        cfg.workdir / "authority_term_relations.csv",
        [
            [
                r["id"],
                r["organization_id"],
                r["from_term_id"],
                r["relation_type"],
                r["to_term_id"],
            ]
            for r in authority_relations
        ],
    )

    write_csv(
        cfg.workdir / "bibs.csv",
        [
            [
                b["id"],
                b["organization_id"],
                b["title"],
                b["creators"],
                b["contributors"],
                b["publisher"],
                b["published_year"],
                b["language"],
                b["subjects"],
                b["geographics"],
                b["genres"],
                b["isbn"],
                b["classification"],
                b["marc_extras"],
            ]
            for b in bibs
        ],
    )

    write_csv(
        cfg.workdir / "bibliographic_subject_terms.csv",
        [
            [
                r["organization_id"],
                r["bibliographic_id"],
                r["term_id"],
                r["position"],
            ]
            for r in bib_subject_terms_rows
        ],
    )

    write_csv(
        cfg.workdir / "bibliographic_name_terms.csv",
        [
            [
                r["organization_id"],
                r["bibliographic_id"],
                r["role"],
                r["term_id"],
                r["position"],
            ]
            for r in bib_name_terms_rows
        ],
    )

    write_csv(
        cfg.workdir / "bibliographic_geographic_terms.csv",
        [
            [
                r["organization_id"],
                r["bibliographic_id"],
                r["term_id"],
                r["position"],
            ]
            for r in bib_geographic_terms_rows
        ],
    )

    write_csv(
        cfg.workdir / "bibliographic_genre_terms.csv",
        [
            [
                r["organization_id"],
                r["bibliographic_id"],
                r["term_id"],
                r["position"],
            ]
            for r in bib_genre_terms_rows
        ],
    )

    write_csv(
        cfg.workdir / "items.csv",
        [
            [
                it["id"],
                it["organization_id"],
                it["bibliographic_id"],
                it["barcode"],
                it["call_number"],
                it["location_id"],
                it["status"],
                it["acquired_at"],
                it["last_inventory_at"],
                it["notes"],
            ]
            for it in items
        ],
    )

    write_csv(
        cfg.workdir / "policies.csv",
        [
            [
                p["id"],
                p["organization_id"],
                p["code"],
                p["name"],
                p["audience_role"],
                p["loan_days"],
                p["max_loans"],
                p["max_renewals"],
                p["max_holds"],
                p["hold_pickup_days"],
                p["overdue_block_days"],
                p["is_active"],
            ]
            for p in policies
        ],
    )

    write_csv(
        cfg.workdir / "loans.csv",
        [
            [
                l["id"],
                l["organization_id"],
                l["item_id"],
                l["user_id"],
                l["checked_out_at"],
                l["due_at"],
                l["returned_at"],
                l["renewed_count"],
                l["status"],
            ]
            for l in loans
        ],
    )

    write_csv(
        cfg.workdir / "holds.csv",
        [
            [
                h["id"],
                h["organization_id"],
                h["bibliographic_id"],
                h["user_id"],
                h["pickup_location_id"],
                h["placed_at"],
                h["status"],
                h["assigned_item_id"],
                h["ready_at"],
                h["ready_until"],
                h["cancelled_at"],
                h["fulfilled_at"],
            ]
            for h in holds
        ],
    )

    write_csv(
        cfg.workdir / "inventory_sessions.csv",
        [
            [
                s["id"],
                s["organization_id"],
                s["location_id"],
                s["actor_user_id"],
                s["note"],
                s["started_at"],
                s["closed_at"],
            ]
            for s in inventory_sessions_rows
        ],
    )

    write_csv(
        cfg.workdir / "inventory_scans.csv",
        [
            [
                sc["id"],
                sc["organization_id"],
                sc["session_id"],
                sc["location_id"],
                sc["item_id"],
                sc["actor_user_id"],
                sc["scanned_at"],
            ]
            for sc in inventory_scans_rows
        ],
    )

    write_csv(
        cfg.workdir / "audit_events.csv",
        [
            [
                a["id"],
                a["organization_id"],
                a["actor_user_id"],
                a["action"],
                a["entity_type"],
                a["entity_id"],
                a["metadata"],
                a["created_at"],
            ]
            for a in audit_rows
        ],
    )

    # ----------------------------
    # 5) 產生 load.sql（psql \\copy）
    # ----------------------------
    load_sql = cfg.workdir / "load.sql"
    # COPY CSV 的 NULL marker 我們統一用 `\N`（而不是空字串），因為：
    # - 數字/時間欄位若用空字串，某些情境下容易被誤解成空白字串而非 NULL（尤其人眼檢查時）
    # - `\N` 是 Postgres/psql 最常見的 NULL marker（可讀性高）
    #
    # 注意：這裡的 `\N` 是要寫進 `load.sql` 的字面字元（反斜線 + N）
    # - Python 一般字串的 `"\N"` 會被當成 Unicode escape，因此要用 raw string。
    null = r"\N"

    # \\copy 讀取的是「client（seed-scale 容器）」的檔案系統路徑，所以用 workdir 絕對路徑。
    # 另外：先 DELETE org 再匯入，確保「同 org_code」可重複執行而不會撞 unique constraint。
    load_sql.write_text(
        "\n".join(
            [
                "BEGIN;",
                # RLS（Row Level Security）注意：
                # - schema.sql 對 org-scoped tables 啟用/強制 RLS（FORCE ROW LEVEL SECURITY）
                # - 因此：
                #   1) 清掉舊 org 時（DELETE organizations ... ON DELETE CASCADE）必須先把 app.org_id 設成「舊 org 的 id」
                #   2) 匯入新資料時（COPY 到 locations/users/...）必須把 app.org_id 設成「新 org 的 id」
                #
                # 這裡用 set_config(..., true) 讓設定只在「這個交易」內有效（BEGIN..COMMIT）。
                f"SELECT set_config('app.org_id', COALESCE((SELECT id::text FROM organizations WHERE code = '{cfg.org_code}'), ''), true);",
                f"DELETE FROM organizations WHERE code = '{cfg.org_code}';",
                f"SELECT set_config('app.org_id', '{org_id}', true);",
                "",
                f"\\copy organizations (id, name, code) FROM '{cfg.workdir / 'organizations.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy locations (id, organization_id, code, name, area, shelf_code, status) FROM '{cfg.workdir / 'locations.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy users (id, organization_id, external_id, name, role, org_unit, status) FROM '{cfg.workdir / 'users.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy user_credentials (user_id, password_salt, password_hash, algorithm) FROM '{cfg.workdir / 'user_credentials.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy authority_terms (id, organization_id, kind, vocabulary_code, preferred_label, variant_labels, note, source, status) FROM '{cfg.workdir / 'authority_terms.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy authority_term_relations (id, organization_id, from_term_id, relation_type, to_term_id) FROM '{cfg.workdir / 'authority_term_relations.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy bibliographic_records (id, organization_id, title, creators, contributors, publisher, published_year, language, subjects, geographics, genres, isbn, classification, marc_extras) FROM '{cfg.workdir / 'bibs.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy bibliographic_subject_terms (organization_id, bibliographic_id, term_id, position) FROM '{cfg.workdir / 'bibliographic_subject_terms.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy bibliographic_name_terms (organization_id, bibliographic_id, role, term_id, position) FROM '{cfg.workdir / 'bibliographic_name_terms.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy bibliographic_geographic_terms (organization_id, bibliographic_id, term_id, position) FROM '{cfg.workdir / 'bibliographic_geographic_terms.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy bibliographic_genre_terms (organization_id, bibliographic_id, term_id, position) FROM '{cfg.workdir / 'bibliographic_genre_terms.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy item_copies (id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, last_inventory_at, notes) FROM '{cfg.workdir / 'items.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy circulation_policies (id, organization_id, code, name, audience_role, loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days, is_active) FROM '{cfg.workdir / 'policies.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy loans (id, organization_id, item_id, user_id, checked_out_at, due_at, returned_at, renewed_count, status) FROM '{cfg.workdir / 'loans.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy holds (id, organization_id, bibliographic_id, user_id, pickup_location_id, placed_at, status, assigned_item_id, ready_at, ready_until, cancelled_at, fulfilled_at) FROM '{cfg.workdir / 'holds.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy inventory_sessions (id, organization_id, location_id, actor_user_id, note, started_at, closed_at) FROM '{cfg.workdir / 'inventory_sessions.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy inventory_scans (id, organization_id, session_id, location_id, item_id, actor_user_id, scanned_at) FROM '{cfg.workdir / 'inventory_scans.csv'}' WITH (FORMAT csv, NULL '{null}')",
                f"\\copy audit_events (id, organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at) FROM '{cfg.workdir / 'audit_events.csv'}' WITH (FORMAT csv, NULL '{null}')",
                "",
                "COMMIT;",
                "",
            ]
        ),
        encoding="utf-8",
    )

    # ----------------------------
    # 6) 套用 schema + 匯入（psql）
    # ----------------------------
    # schema.sql 是 idempotent（CREATE IF NOT EXISTS），先跑一次保險。
    # - 不直接依賴 cwd，避免你在不同 working directory 執行導致找不到檔案。
    repo_root = Path(__file__).resolve().parents[1]
    run_psql(["-f", str(repo_root / "db/schema.sql")], cwd=repo_root)

    # load.sql：真正匯入大量資料
    run_psql(["-f", str(load_sql)], cwd=cfg.workdir)

    print("")
    print("[seed-scale] ✅ 完成：大量資料已匯入。")
    print("")
    print("[seed-scale] 登入資訊（此 org）")
    print(f"  org_code: {cfg.org_code}")
    print(f"  org_name: {cfg.org_name}")
    print(f"  密碼（共用）：{cfg.password}")
    print("  Staff：admin A0001 / librarian L0001")
    print("  OPAC：teacher T0001 / student S1130123")
    print("")
    print("[seed-scale] E2E 哨兵資料（穩定可用）")
    print(f"  bib_title (available): {sentinel_bib_title}")
    print(
        f"  item_barcode (available): {sentinel_available_item_barcode or 'SCL-00000001'}（預設維持 available，且不會被隨機排隊/借出）"
    )
    if sentinel_unavailable_item_barcode:
        print(f"  bib_title (unavailable): {sentinel_unavailable_bib_title}")
        print(
            f"  item_barcode (unavailable): {sentinel_unavailable_item_barcode}（預設維持 checked_out，用於測 available_only filter）"
        )


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"[seed-scale] psql failed (exit={e.returncode})") from e
