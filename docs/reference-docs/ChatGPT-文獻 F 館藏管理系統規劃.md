# 文獻 F 館藏管理系統規劃

**User:** 呂翊銘 (b0979865617@gmail.com)  
**Created:** 12/23/2025 22:49:03  
**Updated:** 12/23/2025 23:50:04  
**Exported:** 12/23/2025 23:54:14  
**Link:** [https://chatgpt.com/g/g-p-694aa49ab4888191948b654ebba514ab-zhong-xiao-xue-tu-zi-xi-tong/c/694aabdd-0ed4-8320-8a03-835396b52317](https://chatgpt.com/g/g-p-694aa49ab4888191948b654ebba514ab-zhong-xiao-xue-tu-zi-xi-tong/c/694aabdd-0ed4-8320-8a03-835396b52317)  

## Prompt:
你是我的「圖書資訊學 × 中小學圖書館系統」研究助理與資料策展員。我的目標是規劃並開發一套適合台灣中小學、在人力不足與預算有限情境下可快速導入的雲端圖書館管理系統（含編目、分類、主題分析、檢索、流通、館藏管理、使用者管理、統計報表），並在設計上兼顧圖資理論與實務流程。

請你用「大量蒐集與整理參考資料」的方式，建立一份「中英文對照、可追溯來源、可直接用於系統規格與企劃書」的資料庫。你的工作重點不是泛泛介紹，而是：
1) 提供概念與名詞的精確定義（中英文對照）
2) 指出在中小學場域中的常見做法、痛點與取捨（簡化策略）
3) 提供可落地的系統功能設計建議（資料欄位、規則、流程）
4) 優先引用權威來源（標準、官方文件、學術論文、圖書館專業機構）
5) 每個關鍵結論要附「來源線索」（可用：作者/機構、文件名、年份、章節/條目名稱、或可搜尋的關鍵字；若你具備瀏覽能力請直接附可查證的連結與引用）

【我的背景與限制】
- 我是台大圖資系大學部，有圖書資訊領域基礎。
- 目標使用者：沒有專職館員的中小學（教師兼任、行政負擔重）。
- 系統原則：少人力、低學習成本、資料結構正確、可擴充。
- 我希望輸出內容可以直接交給後續的 AI 小助理（未來要協助我做專案），因此你要「結構化」、「可復用」、「可轉成規格」。

【你要涵蓋的主題範圍（請全部處理）】
A. 編目（Cataloging）：書目記錄、欄位/分欄、著者/主題款目、控制款目、編目層級；MARC 21、ISBD、RDA（重點在理解結構與中小學簡化）
B. 分類（Classification）：DDC、索書號/類號、主題分類 vs 教學導向；分類亂用的現場問題；分類建議/視覺化架構
C. 主題分析（Subject Analysis）：主題標目、關鍵詞、自然語言 vs 控制詞彙、一致性；LCSH 概念；自訂中小學主題詞表
D. Metadata：描述/行政/結構/識別；Dublin Core；Application Profile（教育場域 metadata profile）
E. 資訊檢索（Information Retrieval）：查詢、欄位/全文、模糊搜尋、排序；Precision/Recall；小學生使用者行為；Browse vs Search
F. 館藏管理（Collection Management）：館藏發展、汰舊、流通率、生命週期；系統如何提示汰舊與未借書
G. 流通作業（Circulation）：借還、續借、預約、逾期；中小學流程簡化；自動化策略
H. 使用者管理（User Management）：角色權限、借閱隱私、學期升級/畢業、資料最小化
I. 資訊行為（Information Behavior）：兒童資訊尋求、瀏覽 vs 搜尋、UX 在圖資系統的應用
J. 資訊倫理與政策（Ethics & Policy）：借閱隱私、兒少資料保護、紀錄保存年限、最小蒐集原則

【輸出格式要求（請嚴格遵守）】
請分成 10 個章節（A-J）依序輸出，每章節都包含以下 8 個小節，並用清楚的標題：

1) 核心概念與名詞（中英文對照表）：至少 12 個術語，每個術語要有「一句話定義」與「同義詞/常見誤用」
2) 關鍵理論與必讀脈絡：列出 5-10 個必懂概念（含為何重要）
3) 標準/規範/權威資源：列出 5-10 項（機構、文件名、版本/年份、可搜尋線索或連結）
4) 中小學場域的簡化策略：哪些要做、哪些可不做、為什麼（列出具體取捨原則）
5) 對應到系統的資料欄位建議：用「欄位名/型別/是否必填/說明/例子」列出建議（至少 8 欄）
6) 對應到系統的功能設計建議：至少 8 條（用「需求→功能→為何」格式）
7) 常見坑與避雷清單：至少 8 條（含資料品質、一致性、使用者錯誤、維運）
8) 可交付給 AI 小助理的任務清單：至少 10 條（例如：幫我整理 DDC 教育版簡化、幫我找台灣中小學圖書館借閱規則案例…）

【額外要求】
- 請在每章結尾附上「本章關鍵搜尋詞（中英）」至少 15 個，讓我方便自行搜尋。
- 全文請以繁體中文為主，但術語必須保留英文。
- 不要只講概念，要能轉成「系統規格」與「提案文字」。
- 若遇到不同國家/機構的做法，請用「對照」方式呈現差異，並說明哪種較適合台灣中小學。
- 若你沒有即時瀏覽能力，請至少提供「可被搜尋驗證的完整線索」；若你有瀏覽能力，請把來源連結與引用一起放上。

現在開始，先輸出 F. 館藏管理（Collection Management）

## Response:
收到，我會幫你進行大規模資料整理與可規格化輸出。為了處理「F. 館藏管理（Collection Management）」這章節，我會開始進行系統性的文獻與標準蒐集。但為確保我幫你抓到重點，請確認以下幾點：

1.  你希望我針對的是「館藏發展政策（Collection Development Policies）」、「汰舊原則（Weeding/Deaccession）」和「館藏流通分析」這三大主軸，對嗎？是否還有特別想加入的角度？
2.  有沒有希望我特別關注台灣本地的實例？例如教育部、台灣圖書館、國教署相關政策或各縣市中小學圖書館的實際規則？
3.  你希望我偏重理論出處（如ALA 指南）、本地實務案例、還是能直接引用的規格書格式設計（如圖書館系統中的提示規則）？

確認後我就會啟動研究任務，將全部依照你指定的格式（8 小節＋關鍵字）產出。

10:48 PM22:48

## Prompt:
1. 以這些為主即可 其他的重要部分 若你覺得有需要再添增 2. 是的盡量以台灣本土為主 3.我希望以實務為主 但是理論其他那些 也不可少

10:49 PM22:49

## Response:
好，我會針對「館藏管理（Collection Management）」建立一份完整的中英對照與系統設計導向的資料庫，內容涵蓋：館藏發展、汰舊原則、流通分析，並以台灣本地中小學場域為主，補充國際權威做法。會依照你給的結構逐條彙整可實作的規格與提案文字。

整理完成會通知你，你也可以隨時繼續和我討論其他章節或功能。

10:49 PM22:49

Research completed in 9m · 11 sources · 65 searches

## Response:
中小學圖書館館藏管理：館藏發展政策、汰舊原則與流通分析
===========================

1) 核心概念與名詞（中英文對照表）
------------------

| **名詞** | **英文** | **定義/說明** |
| --- | --- | --- |
| 館藏管理 | Collection Management | 包含館藏發展、維護、評估、淘汰等，使圖書館館藏持續適切讀者需求。 |
| 館藏發展政策 | Collection Development Policy | 以書面明確說明館藏**目的**、**選擇與淘汰原則**、館藏範圍深度、選書職責等的文件techserviceslibrary.blogspot.com。提供選購與剔除館藏的依據與一致性指南。 |
| 選書政策/館藏徵集 | Selection Policy / Collection Acquisition | 規範圖書館如何選購(徵集)資料的政策，通常包含依據課程目標、讀者年齡、品質、適切性等標準。 |
| 汰舊（館藏淘汰/除藏） | Weeding / Deaccession / Deselection | **定期移除**館藏中不合時宜或無用的資料，以維持館藏品質與空間[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=links%20and%20evaluating%20these%20links,for%20accuracy%2C%20currency%2C%20and%20relevancy)。又稱除藏、剔舊，包括評估資料的狀況與是否更新替代後下架處理。 |
| **MUSTIE** 原則 | **MUSTIE** Criteria | 常用的汰舊評估標準，縮寫代表 Misleading（內容易誤導）、Ugly（外觀破損醜陋）、Superseded（有更新版本取代）、Trivial（內容瑣碎無價值）、Irrelevant（與讀者需求無關）以及 Elsewhere（其他管道已可取得）[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=collection%20area,library%2C%20and%2For%20the%20library%E2%80%99s%20dean)。符合任一者即可考慮淘汰。 |
| **CREW** 法 | **CREW Method** | 一套館藏持續評估與汰舊指引，“Continuous Review, Evaluation, and Weeding”[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=collection%20area,library%2C%20and%2For%20the%20library%E2%80%99s%20dean)。強調定期檢視，每冊書考慮最後一次借出時間、出版年代、使用頻率等，搭配MUSTIE判斷是否剔除。 |
| 館藏使用率 | Collection Use / Usage Rate | 館藏資料被借閱或使用的頻率。如以館藏中有多少百分比的藏書在一年內至少借出一次來衡量[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=The%20Circulation%20Reality)。也可指特定主題或館藏區的流通量相對其館藏量的比例（Relative Use）。 |
| 流通（借閱）統計 | Circulation Statistics | 圖書館借出書籍的計數資料。可用於分析**高頻使用**與**低頻未借**的館藏，以評估熱門主題或潛在淘汰對象[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=6,Analyze%20circulation%20patterns)。 |
| 館藏評鑑 | Collection Evaluation/Assessment | 系統性評估館藏是否符合學校課程與讀者需求的過程，包含分析館藏覆蓋範圍、資料新舊、使用情況等[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=collection%E2%80%99s%20strengths%2C%20weaknesses%2C%20and%20opportunities,as%20identifying%20gaps%20in%20the)[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=2,the%20guidelines%20for%20adding%20new)。結果用於調整採購和淘汰策略。 |
| 館藏地圖 | Collection Mapping | 盤點館藏與課程或閱讀需求的對應關係。將館藏按主題、年級、體裁等繪製成“地圖”，找出不足與過多之處，協助館藏發展決策。 |
| 教師兼任館員（閱讀推動教師） | Teacher-Librarian (Reading Promotion Teacher) | 在臺灣，中小學多由教師兼管圖書館，稱“閱讀推動教師”。此為專任教師減授課時擔任，接受圖書資訊與閱讀素養訓練，整合校內閱讀資源推動閱讀[edu.tw](https://www.edu.tw/News_Content.aspx?n=9E7AC85F1954DDA8&s=B704144B61AD047E#:~:text=%E7%82%BA%E6%8F%90%E5%8D%87%E5%AD%B8%E7%94%9F%E9%96%B1%E8%AE%80%E8%83%BD%E5%8A%9B%E8%88%87%E5%AD%B8%E7%BF%92%E8%83%BD%E5%8A%9B%EF%BC%8C%E4%B8%A6%E6%95%B4%E5%90%88%E5%AD%B8%E6%A0%A1%E7%9A%84%E9%96%B1%E8%AE%80%E8%B3%87%E6%BA%90%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E5%9C%8B%E6%95%99%E7%BD%B2%E8%87%AA98%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%EF%BC%8C%E8%BE%A6%E7%90%86%E3%80%8C%E5%A2%9E%E7%BD%AE%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E8%A8%88%E7%95%AB%E3%80%8D%EF%BC%8C%E7%94%B1%E5%B0%88%E4%BB%BB%E6%95%99%E5%B8%AB%E4%BB%A5%E6%B8%9B%E6%8E%88%E8%AA%B2%E6%99%82%E6%95%B8%E6%93%94%E4%BB%BB%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%20%E5%B7%A5%E4%BD%9C%EF%BC%8C%E4%B8%A6%E6%8F%90%E4%BE%9B%E5%85%B6%E7%9B%B8%E9%97%9C%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E5%88%A9%E7%94%A8%E8%88%87%E9%96%B1%E8%AE%80%E7%B4%A0%E9%A4%8A%E7%9B%B8%E9%97%9C%E7%9A%84%E6%95%99%E8%82%B2%E8%A8%93%E7%B7%B4%EF%BC%8C%E8%97%89%E7%94%B1%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E7%9A%84%E5%B0%88%E6%A5%AD%EF%BC%8C%E5%8D%94%E5%8A%A9%E6%95%B4%E5%90%88%E5%AD%B8%E6%A0%A1%E9%96%B1%E8%AE%80%E8%B3%87%E6%BA%90%EF%BC%8C%E8%A6%8F%E5%8A%83%E5%AD%B8%E6%A0%A1%E9%96%B1%E8%AE%80%E6%B4%BB%E5%8B%95%EF%BC%8C%E4%BB%A5%E6%8F%90%E5%8D%87%E5%9C%8B%E4%B8%AD%E5%B0%8F%E5%AD%B8%E7%94%9F%E7%9A%84%E9%96%B1%E8%AE%80%E7%B4%A0%E9%A4%8A%E3%80%82114%E5%AD%B8%E5%B9%B4%E5%BA%A6%20%E8%A3%9C%E5%8A%A9%E5%9C%8B%E4%B8%AD%E5%B0%8F%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E5%9C%8B%E5%B0%8F375%E6%A0%A1%E3%80%81%E5%9C%8B%E4%B8%AD202%E6%A0%A1%EF%BC%8C%E7%B8%BD%E8%A8%88577%E6%A0%A1%EF%BC%8C%E8%A3%9C%E5%8A%A9%E7%B8%BD%E7%B6%93%E8%B2%BB%E7%B4%84%E6%96%B0%E8%87%BA%E5%B9%A36%2C900%E8%90%AC%E5%85%83%E3%80%82)。 |
| AASL（美國學校圖書館協會） | AASL (American Association of School Librarians) | 美國圖書館協會(ALA)下轄的學校圖書館協會，制定**全國學校圖書館標準** (2018) 等，關注館藏資源對學習的支援。 |
| ALA（美國圖書館協會） | ALA (American Library Association) | 提供圖書館館藏政策指引與倡議（如**圖書館權利法案**、選擇政策工具包等）。ALA的選擇與再評估政策指南強調各類圖書館需有館藏維護與汰舊政策[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Regardless%20of%20the%20type%20of,consideration%20of%20continued%20sufficient%20coverage)[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Weeding%20or%20the%20deselection%20of,many%20weeding%20resources%20available%20online)。 |
| IFLA（國際圖書館協會聯盟） | IFLA (International Federation of Library Associations and Institutions) | 發布**IFLA/UNESCO《學校圖書館宣言》**與**《學校圖書館指南》（2015）**，強調館藏政策須基於課程與讀者需求，推廣多元、在地與國際資源並存[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=School%20library%20collections,in%20helping%20to%20build%20library)[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=collections,members%20of%20the%20school%20community)。 |
| 教育部 & 國教署 | MOE (Ministry of Education, Taiwan) & K-12 Education Administration | 教育部及其國民及學前教育署。制定\*\*《圖書館設立及營運標準》\*\*等規範學校圖書館館藏量、經費、館員資格等[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%EF%BC%88%E4%BA%8C%EF%BC%89%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E5%85%AD%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%9B%9B%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E4%BA%8C%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E5%8D%81%E4%BA%94%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82%20%E5%AD%B8%E7%94%9F%E5%8F%8A%E5%AD%B8%E6%A0%A1)[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%E5%9F%BA%E6%9C%AC%E9%A4%A8%E8%97%8F%E5%A6%82%E4%B8%8B%EF%BC%9A%20%EF%BC%88%E4%B8%80%EF%BC%89%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E4%B9%9D%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%85%AD%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E5%9B%9B%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E4%B8%89%E5%8D%81%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82)；推動閱讀計畫（如閱讀推動教師計畫[edu.tw](https://www.edu.tw/News_Content.aspx?n=9E7AC85F1954DDA8&s=B704144B61AD047E#:~:text=%E7%82%BA%E6%8F%90%E5%8D%87%E5%AD%B8%E7%94%9F%E9%96%B1%E8%AE%80%E8%83%BD%E5%8A%9B%E8%88%87%E5%AD%B8%E7%BF%92%E8%83%BD%E5%8A%9B%EF%BC%8C%E4%B8%A6%E6%95%B4%E5%90%88%E5%AD%B8%E6%A0%A1%E7%9A%84%E9%96%B1%E8%AE%80%E8%B3%87%E6%BA%90%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E5%9C%8B%E6%95%99%E7%BD%B2%E8%87%AA98%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%EF%BC%8C%E8%BE%A6%E7%90%86%E3%80%8C%E5%A2%9E%E7%BD%AE%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E8%A8%88%E7%95%AB%E3%80%8D%EF%BC%8C%E7%94%B1%E5%B0%88%E4%BB%BB%E6%95%99%E5%B8%AB%E4%BB%A5%E6%B8%9B%E6%8E%88%E8%AA%B2%E6%99%82%E6%95%B8%E6%93%94%E4%BB%BB%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%20%E5%B7%A5%E4%BD%9C%EF%BC%8C%E4%B8%A6%E6%8F%90%E4%BE%9B%E5%85%B6%E7%9B%B8%E9%97%9C%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E5%88%A9%E7%94%A8%E8%88%87%E9%96%B1%E8%AE%80%E7%B4%A0%E9%A4%8A%E7%9B%B8%E9%97%9C%E7%9A%84%E6%95%99%E8%82%B2%E8%A8%93%E7%B7%B4%EF%BC%8C%E8%97%89%E7%94%B1%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E7%9A%84%E5%B0%88%E6%A5%AD%EF%BC%8C%E5%8D%94%E5%8A%A9%E6%95%B4%E5%90%88%E5%AD%B8%E6%A0%A1%E9%96%B1%E8%AE%80%E8%B3%87%E6%BA%90%EF%BC%8C%E8%A6%8F%E5%8A%83%E5%AD%B8%E6%A0%A1%E9%96%B1%E8%AE%80%E6%B4%BB%E5%8B%95%EF%BC%8C%E4%BB%A5%E6%8F%90%E5%8D%87%E5%9C%8B%E4%B8%AD%E5%B0%8F%E5%AD%B8%E7%94%9F%E7%9A%84%E9%96%B1%E8%AE%80%E7%B4%A0%E9%A4%8A%E3%80%82114%E5%AD%B8%E5%B9%B4%E5%BA%A6%20%E8%A3%9C%E5%8A%A9%E5%9C%8B%E4%B8%AD%E5%B0%8F%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E5%9C%8B%E5%B0%8F375%E6%A0%A1%E3%80%81%E5%9C%8B%E4%B8%AD202%E6%A0%A1%EF%BC%8C%E7%B8%BD%E8%A8%88577%E6%A0%A1%EF%BC%8C%E8%A3%9C%E5%8A%A9%E7%B8%BD%E7%B6%93%E8%B2%BB%E7%B4%84%E6%96%B0%E8%87%BA%E5%B9%A36%2C900%E8%90%AC%E5%85%83%E3%80%82)）。 |

2) 關鍵理論與必讀脈絡
------------

*   **館藏發展與政策理論：**館藏發展被視為動態循環，包括**選擇**新資料與**剔除**舊資料兩面向。經典理論指出圖書館應有明確的**館藏發展政策**以貫徹圖書館使命，確保館藏內容貼近讀者需求與組織目標techserviceslibrary.blogspot.com。一份完善的政策文件有助於了解館藏性質範圍、設置選書優先順序，並提供館員在選購與淘汰時的客觀依據techserviceslibrary.blogspot.comtechserviceslibrary.blogspot.com。同時，政策也作為館員內部溝通與對外說明的工具，確保決策一致性並便於向家長師生解釋館藏取向techserviceslibrary.blogspot.comtechserviceslibrary.blogspot.com。
*   **支持課程與讀者需求：**學校圖書館館藏理應**緊密結合學校課程**。IFLA《學校圖書館指南》明確指出，館藏管理政策必須基於學校課程以及師生的特定需求與興趣，同時反映社會多元性[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=School%20library%20collections,in%20helping%20to%20build%20library)。這意味著選書時不僅考慮**教材相關性**，還要顧及學生閱讀興趣、年齡適切性，以及文化語言多樣性，支持不同背景的學生[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=their%20students%2C%20have%20an%20important,members%20of%20the%20school%20community)[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=collections,members%20of%20the%20school%20community)。館藏建設被視為**協作過程**：教師作為學科專家，了解學生需求，應參與選書決策[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=teachers%20to%20develop%20policies%20that,school%20libraries%20acquire%20resources%20that)。因此理論上館藏發展需融合**課程導向**與**讀者導向**兩種脈絡，確保既支援教學也激發閱讀風氣。
*   **知識自由與審查考量：**圖書館領域的核心價值包括**智識自由**與反對不當審查。ALA強調，館藏維護或汰舊不應淪為**移除爭議性資料的手段**[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Weeding%20or%20the%20deselection%20of,many%20weeding%20resources%20available%20online)。館藏政策通常會納入《圖書館權利法案》精神，確保**不因內容爭議而下架**，而應以資料品質和適用性為依據。關鍵理論認為\*\*“選擇即是審查”\*\*（Selection is not censorship）的平衡：依政策選書的同時，保持多元館藏以呈現各種觀點，使學生學會批判思考。必讀文獻如ALA的《選擇與再考慮政策手冊》討論了如何在選書與面對挑戰時堅持原則，這些都是制定館藏發展政策時的重要脈絡。
*   **汰舊的重要性：**館藏淘汰（Weeding）在圖書館學上被視為**館藏發展不可或缺的一環**[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Weeding%20or%20the%20deselection%20of,step)。理論上，**不斷更新**才能維持館藏活力：陳舊、錯誤或無人問津的資料會佔據寶貴空間並降低圖書利用率[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=There%E2%80%99s%20also%20an%20outdated%20mindset,have%20way%20too%20many%20books)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=usually%20way%20older%20than%20it,have%20way%20too%20many%20books)。一個常被引用的模型是“**MUSTIE**”準則[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=collection%20area,library%2C%20and%2For%20the%20library%E2%80%99s%20dean)或“**CREW**”法[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Academic%20library%20policies%20addressing%20collection,librarians%2C%20faculty%20outside%20the%20library)，指導館員如何根據內容正確性、出版年代、外觀狀況、使用率等客觀指標決定淘汰與否。必讀的《CREW手冊》指出，**定期小量汰舊**優於長時間不管導致最終必須大規模剔除[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=The%20Bigger%20Picture)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=Ideally%2C%20if%20you%E2%80%99ve%20been%20maintaining,They%E2%80%99ll%20be%20able%20to)。許多研究與實務經驗也表明，**過時龐大館藏反而降低學生借閱意願**，因為書架過於擁擠、訊息老舊難以引起興趣[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=There%E2%80%99s%20also%20an%20outdated%20mindset,have%20way%20too%20many%20books)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=usually%20way%20older%20than%20it,have%20way%20too%20many%20books)。
*   **館藏使用與數據分析：**進行館藏評估時的重要理論依據是**循證決策（Evidence-Based Practice）**。透過蒐集館藏**使用數據**來了解強項與弱項，是館藏管理的必讀脈絡之一[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=collection%E2%80%99s%20strengths%2C%20weaknesses%2C%20and%20opportunities,as%20identifying%20gaps%20in%20the)[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=2,the%20guidelines%20for%20adding%20new)。具體而言，可檢視**借閱統計**：例如某校區調查發現平均一年度僅有不到25%的館藏有被借閱記錄[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=The%20Circulation%20Reality)，表示可能大部分藏書閒置。理論上建議利用**相對使用率**（Relative use）等指標，將各主題館藏的借閱量與其藏書量相比，找出**利用率偏低**的領域[iflsweb.org](https://iflsweb.org/knowledge-base/collection-development-analysis#:~:text=Collection%20Development%3A%20Analysis%20,holdings%20in%20that%20particular%20area)。但同時理論也提醒**質與量並重**：某些館藏（如經典名著、工具書）儘管借閱率低，但有長期保存價值，不應僅因一時數據不高就淘汰[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=While%20reports%20and%20automation%20have,and%20will%20loan%20a%20copy)[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=should%20be%20executed%20with%20a,and%20will%20loan%20a%20copy)。因此必讀脈絡強調**定量分析結合館員專業判斷**，平衡使用數據與教育價值。
*   **教育效益與館藏衡平：**學校圖書館館藏管理背後的一項關鍵理念是：**良好的館藏能提升學生學習與閱讀素養**。大量研究（如美國多州的School Library Impact Studies）皆指出，擁有豐富又切合課程的館藏與學生閱讀成就正相關。同時館藏應**平衡多元**：包括不同文化、族群觀點的資料，提供學生更廣闊的視野[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=their%20students%2C%20have%20an%20important,members%20of%20the%20school%20community)[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=collections,members%20of%20the%20school%20community)。在臺灣情境，推動**閱讀素養**也是圖書館館藏政策的重要理論基礎，館藏被視為培養終身閱讀習慣的工具。因此理論與脈絡文獻皆倡導學校定期檢視館藏是否對學生有吸引力、能支持課程探究，進而**維繫圖書館與學習成果間的良性循環**。

3) 標準/規範/權威資源
-------------

*   **IFLA《學校圖書館指南》（2015）：**國際圖書館協會聯盟(IFLA)出版的權威指南，強調**館藏管理政策應以課程為本**，由專業館員與教師合作制定[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=School%20library%20collections,in%20helping%20to%20build%20library)[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=teachers%20to%20develop%20policies%20that,school%20libraries%20acquire%20resources%20that)。指南指出館藏應同時包含本地及國際資源，反映多元文化背景[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=their%20students%2C%20have%20an%20important,members%20of%20the%20school%20community)。並建議**定期評估**館藏與服務，以追求持續改進[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=School%20library%20evaluation%3A%20Evaluation%20is,of%20new%20programs%20and%20services)。該指南和**IFLA/UNESCO《學校圖書館宣言》**（1999）一起，提供學校圖書館在使命、政策、人力、館藏、服務上的國際標準框架。
*   **AASL《全國學校圖書館標準》（2018）：**美國學校圖書館協會制定，包含**學習者、學習設計、圖書館計畫**三部分標準。雖然該標準側重學生學習，當中\*\*“Curate（策展）”**等核心理念隱含館藏管理要求，例如要求館藏資源**支持跨領域學習\*\*、鼓勵學生探索與創造。AASL並發布多項**立場聲明與工具**（Position Statements & Toolkits），如建議每校應有**館藏發展政策**與**資料選擇政策**，並支持學校館員定期剔除過時資料以維持館藏活力。
*   **ALA《圖書館藏書選擇與再考慮政策工具包》（Selection & Reconsideration Policy Toolkit, 2018）:** 由美國圖書館協會提供的實用指南，適用於公共、學校、學術圖書館。該工具包強調無論館別，**館藏維護與汰舊**都是館藏管理的重要組成[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Regardless%20of%20the%20type%20of,consideration%20of%20continued%20sufficient%20coverage)。其建議政策中納入**定期館藏審查**、**清點**、**維護**等內容[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Regardless%20of%20the%20type%20of,consideration%20of%20continued%20sufficient%20coverage)[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Weeding%20or%20the%20deselection%20of,many%20weeding%20resources%20available%20online)，以及明訂汰舊評估的**客觀標準**（如出版年、借閱紀錄、實體狀況）[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Public%20Library%20Collection%20Maintenance%20and,Weeding)[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=updated%20resources%20or%20the%20circulation,are%20not%20reviewed%20for%20weeding)。ALA亦列舉常見的**汰舊方法** (如MUSTIE, CREW) 供參考[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Academic%20library%20policies%20addressing%20collection,library%2C%20and%2For%20the%20library%E2%80%99s%20dean)。此外，ALA的《圖書館權利法案》及詮釋文件提供在選書和淘汰時保障智識自由的原則依據。
*   **臺灣《圖書館設立及營運標準》（2016, 教育部）：**教育部依《圖書館法》訂定的國家標準，對**中小學圖書館**的館藏量和發展有明確要求。例如下：
    *   \*國小圖書館：\*基本館藏**至少6,000種**或每生40種以上，期刊15種、報紙3種以上[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%EF%BC%88%E4%BA%8C%EF%BC%89%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E5%85%AD%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%9B%9B%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E4%BA%8C%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E5%8D%81%E4%BA%94%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82%20%E5%AD%B8%E7%94%9F%E5%8F%8A%E5%AD%B8%E6%A0%A1)。若學校班級數超過13班，每增1班應增藏書200種[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%EF%BC%88%E4%BA%8C%EF%BC%89%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E5%85%AD%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%9B%9B%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E4%BA%8C%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E5%8D%81%E4%BA%94%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82%20%E5%AD%B8%E7%94%9F%E5%8F%8A%E5%AD%B8%E6%A0%A1)。並規定每年新增館藏數量和經費須達一定比例，確保館藏逐年成長。
    *   \*國中圖書館：\*基本館藏**至少9,000種**或每生60種以上[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%E5%9F%BA%E6%9C%AC%E9%A4%A8%E8%97%8F%E5%A6%82%E4%B8%8B%EF%BC%9A%20%EF%BC%88%E4%B8%80%EF%BC%89%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E4%B9%9D%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%85%AD%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E5%9B%9B%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E4%B8%89%E5%8D%81%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82)。班級數逾13班者，每增1班增加藏書400種[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%E5%9F%BA%E6%9C%AC%E9%A4%A8%E8%97%8F%E5%A6%82%E4%B8%8B%EF%BC%9A%20%EF%BC%88%E4%B8%80%EF%BC%89%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E4%B9%9D%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%85%AD%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E5%9B%9B%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E4%B8%89%E5%8D%81%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82)；期刊30種、報紙3種以上[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%E5%9F%BA%E6%9C%AC%E9%A4%A8%E8%97%8F%E5%A6%82%E4%B8%8B%EF%BC%9A%20%EF%BC%88%E4%B8%80%EF%BC%89%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E4%B9%9D%E5%8D%83%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%20%E6%88%96%E6%AF%8F%E5%90%8D%E5%AD%B8%E7%94%9F%E5%85%AD%E5%8D%81%E7%A8%AE%E4%BB%A5%E4%B8%8A%EF%BC%9B%E5%AD%B8%E6%A0%A1%E7%8F%AD%E7%B4%9A%E6%95%B8%E9%80%BE%E5%8D%81%E4%B8%89%E7%8F%AD%E8%80%85%EF%BC%8C%E6%AF%8F%E5%A2%9E%E4%B8%80%E7%8F%AD%E5%A2%9E%E5%8A%A0%E5%9C%96%20%E6%9B%B8%E5%9B%9B%E7%99%BE%E7%A8%AE%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%8C%E4%B8%A6%E6%9C%89%E6%9C%9F%E5%88%8A%E8%87%B3%E5%B0%91%E4%B8%89%E5%8D%81%E7%A8%AE%EF%BC%8C%E5%A0%B1%E7%B4%99%E4%B8%89%E7%A8%AE%E3%80%82)。並要求每年館藏增置量不低於總藏量的一定百分比（如3%），確保館藏持續更新。
    *   \*高中圖書館：\*基本館藏**至少15,000冊**，學生人數超過1,000人者，每增加1人需增藏書10冊[lac.org.tw](https://www.lac.org.tw/files/tu_shu_guan_she_li_ji_ying_yun_biao_zhun_1050811.pdf#:~:text=%E5%9F%BA%E6%9C%AC%E9%A4%A8%E8%97%8F%E5%A6%82%E4%B8%8B%EF%BC%9A%20%EF%BC%88%E4%B8%80%EF%BC%89%E5%9C%96%E6%9B%B8%E3%80%81%E8%A6%96%E8%81%BD%E8%B3%87%E6%96%99%E5%8F%8A%E6%95%B8%E4%BD%8D%E5%AA%92%E9%AB%94%E7%AD%89%E5%87%BA%E7%89%88%E5%93%81%E8%87%B3%E5%B0%91%E6%87%89%E6%9C%89%E4%B8%80%E8%90%AC%E4%BA%94%E5%8D%83%E5%86%8A%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%9B%20%E5%85%A8%E6%A0%A1%E5%AD%B8%E7%94%9F%E4%BA%BA%E6%95%B8%E5%9C%A8%E4%B8%80%E5%8D%83%E4%BA%BA%E4%BB%A5%E4%B8%8A%E8%80%85%EF%BC%8C%E6%AF%8F%E9%80%BE%E4%B8%80%E4%BA%BA%EF%BC%8C%E6%87%89%E5%A2%9E%E5%8A%A0%E5%8D%81%E5%86%8A%EF%BC%88%E4%BB%B6%EF%BC%89%EF%BC%9B%E4%B8%94%20%E6%99%AE%E9%80%9A%E5%9E%8B%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E6%AF%8F%E5%B9%B4%E9%A4%A8%E8%97%8F%E5%A2%9E%E5%8A%A0%E9%87%8F%E4%B8%8D%E5%BE%97%E4%BD%8E%E6%96%BC%E5%9F%BA%E6%9C%AC%E9%A4%A8%E8%97%8F%E4%B9%8B%E7%99%BE%E5%88%86%E4%B9%8B)；並規定高中每年新增館藏不得低於基本館藏量的一定比例。
    此外，教育部歷年也頒布「中小學圖書館設置及營運基準」（早期版本）等文件，內容與上述標準類似，旨在保障**每位學生享有基本數量的館藏**。相關法規確立了臺灣中小學館藏**量化門檻**，並間接影響館藏發展策略（例如學校常以達到每生擁書XX冊為目標）。
*   **各國/各州館藏指引：**國外不少教育主管機關或圖書館協會也制定學校館藏規範。例如美國德州等州發布**學校圖書館館藏標準**，列出每位學生應有幾冊書，以及各分類理想藏書量[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=Several%20states%20have%20taken%20on,among%20students%20that%20their%20library)。這類標準提供校方參考一個“**適當館藏規模**”，有助於判斷本校館藏是否過少或過多[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=Several%20states%20have%20taken%20on,among%20students%20that%20their%20library)。再如**加州教育廳《剔除指南》**[cde.ca.gov](https://www.cde.ca.gov/ci/cr/lb/documents/weedingbrochure.pdf#:~:text=,and%20a%20process%20for)，要求學區制定淘汰政策，說明汰舊的依據、程序（包括教師審核與通知流程）等，以制度化館藏淘汰。圖書館專業出版物如《圖書館館藏發展政策指南》（IFLA出版）亦提供如何撰寫政策的結構建議[ifla.org](https://www.ifla.org/files/assets/acquisition-collection-development/publications/gcdp-en.pdf#:~:text=,the%20result%20of%20the)（採用Conspectus方法架構館藏深度等）。以上資源共同構成館藏管理的權威知識庫。
*   **臺灣教育部與國教署資源：**教育部國教署近年大力推動閱讀與館藏管理專業培訓。例如**「閱讀推動教師計畫」**自98學年度起補助國中小設置專任**圖書館閱讀推動教師**，提供圖書館管理與閱讀教育訓練[edu.tw](https://www.edu.tw/News_Content.aspx?n=9E7AC85F1954DDA8&s=B704144B61AD047E#:~:text=%E7%82%BA%E6%8F%90%E5%8D%87%E5%AD%B8%E7%94%9F%E9%96%B1%E8%AE%80%E8%83%BD%E5%8A%9B%E8%88%87%E5%AD%B8%E7%BF%92%E8%83%BD%E5%8A%9B%EF%BC%8C%E4%B8%A6%E6%95%B4%E5%90%88%E5%AD%B8%E6%A0%A1%E7%9A%84%E9%96%B1%E8%AE%80%E8%B3%87%E6%BA%90%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E5%9C%8B%E6%95%99%E7%BD%B2%E8%87%AA98%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%EF%BC%8C%E8%BE%A6%E7%90%86%E3%80%8C%E5%A2%9E%E7%BD%AE%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E8%A8%88%E7%95%AB%E3%80%8D%EF%BC%8C%E7%94%B1%E5%B0%88%E4%BB%BB%E6%95%99%E5%B8%AB%E4%BB%A5%E6%B8%9B%E6%8E%88%E8%AA%B2%E6%99%82%E6%95%B8%E6%93%94%E4%BB%BB%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%20%E5%B7%A5%E4%BD%9C%EF%BC%8C%E4%B8%A6%E6%8F%90%E4%BE%9B%E5%85%B6%E7%9B%B8%E9%97%9C%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E5%88%A9%E7%94%A8%E8%88%87%E9%96%B1%E8%AE%80%E7%B4%A0%E9%A4%8A%E7%9B%B8%E9%97%9C%E7%9A%84%E6%95%99%E8%82%B2%E8%A8%93%E7%B7%B4%EF%BC%8C%E8%97%89%E7%94%B1%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E7%9A%84%E5%B0%88%E6%A5%AD%EF%BC%8C%E5%8D%94%E5%8A%A9%E6%95%B4%E5%90%88%E5%AD%B8%E6%A0%A1%E9%96%B1%E8%AE%80%E8%B3%87%E6%BA%90%EF%BC%8C%E8%A6%8F%E5%8A%83%E5%AD%B8%E6%A0%A1%E9%96%B1%E8%AE%80%E6%B4%BB%E5%8B%95%EF%BC%8C%E4%BB%A5%E6%8F%90%E5%8D%87%E5%9C%8B%E4%B8%AD%E5%B0%8F%E5%AD%B8%E7%94%9F%E7%9A%84%E9%96%B1%E8%AE%80%E7%B4%A0%E9%A4%8A%E3%80%82114%E5%AD%B8%E5%B9%B4%E5%BA%A6%20%E8%A3%9C%E5%8A%A9%E5%9C%8B%E4%B8%AD%E5%B0%8F%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%E5%9C%8B%E5%B0%8F375%E6%A0%A1%E3%80%81%E5%9C%8B%E4%B8%AD202%E6%A0%A1%EF%BC%8C%E7%B8%BD%E8%A8%88577%E6%A0%A1%EF%BC%8C%E8%A3%9C%E5%8A%A9%E7%B8%BD%E7%B6%93%E8%B2%BB%E7%B4%84%E6%96%B0%E8%87%BA%E5%B9%A36%2C900%E8%90%AC%E5%85%83%E3%80%82)。國教署並委託師範大學等單位編撰**圖書教師手冊**與電子報，涵蓋館藏發展政策制定、選書原則、館藏維護等議題[ewant.org](https://www.ewant.org/admin/tool/mooccourse/mnetcourseinfo.php?hostid=34&id=16287#:~:text=%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%94%BF%E7%AD%96)。每年舉辦的圖書教師研習中，也包含**館藏發展政策的重要性**、**汰舊實務經驗**等課程[ewant.org](https://www.ewant.org/admin/tool/mooccourse/mnetcourseinfo.php?hostid=34&id=16287#:~:text=%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%94%BF%E7%AD%96)。教育部另發布「中小學圖書館評鑑指標」，其中對館藏適切性、更新率都有指標要求。這些官方資源為臺灣中小學館藏管理提供了政策依據和實務指南。

4) 中小學場域的簡化策略
-------------

> **場景設定：**臺灣中小學多數無專職館員，由兼任的教師或行政人員管理圖書館。在專業人力與時間有限的情況下，如何**簡化**館藏管理工作，同時達到專業標準？以下策略著重於**易於落地**、**減輕負擔**，讓館藏發展政策、汰舊、流通分析在校園實務中可行。

*   **制定精簡版館藏政策：**雖然專業圖書館建議擁有詳細的館藏發展政策，但中小學可採取**精簡模板**。例如以一張A4列出館藏**目標（支持課程、提升閱讀）**、**選書原則**（配合課綱主題、適合學生年齡、優先補強不足主題）、**汰舊原則**（如5-7年未借閱且不符合課程需求者汰除）等重點條款。這樣的簡易政策文件便於教師館員遵循，也方便向校長或家長說明決策依據。教育部或圖書館學會可提供**範本**讓學校套用，減少自行摸索時間。同時，政策內容聚焦**最相關**的幾項：例如**課程連結**、**適齡閱讀**、**多元性**、**經費分配**和**淘汰**五大面向，避免冗長難行。
*   **善用推薦書單與現成資源：**教師兼任館員在選書時，可以**借力專業推薦**，無需從零開始建立館藏。具體做法包括：利用國教署每年推薦的**學生優良讀物書單**、各縣市圖書館的**熱門借閱排行榜**、以及AASL每年評選的**優秀青少年讀物**清單作為選購依據。此舉可確保館藏質量，又節省選書時間。同時，透過教育部提供的**課程書目對照**資料（如各領域主題相關的圖書建議），讓館藏直接對應各年級課程單元。對缺乏經驗的圖書教師而言，有了**權威書單**指引，等於獲得專家顧問輔助，可大幅簡化館藏發展流程。
*   **分階段館藏建設與更新：**在資源有限下，採取**循序漸進**策略管理館藏。第一階段先確保**核心館藏**到位──例如每個年級必備的經典讀物、各主要學科的基礎參考書。第二階段再豐富**選讀館藏**──如依學生興趣增加小說系列或漫畫、STEAM讀物等。館藏更新亦可循環分區進行：將全館按分類或棚架區域劃分，每年集中**檢視一部分**館藏。比如今年聚焦500-599（科學類）圖書，清查出版超過10年的舊書和破損書，下架汰舊並補充新知識書籍；明年換檢視800-899（文學類）等等。這種**滾動式維護**避免一次面對全館龐大工作量，在幾年內逐步完成館藏煥新。
*   **簡化汰舊判斷規則：**非專業館員可能對每本書該不該淘汰拿不準，因此建立**簡單明確的汰舊判斷依據**很重要。可採用幾項**硬性指標**：例如出版年份超過一定年限（如一般知識類10年、資訊科技類5年）、最近**N年未曾借出**（如兩年以上無借閱記錄）[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=6,Analyze%20circulation%20patterns)、外觀嚴重破損（書頁發黃脆化、書脊鬆散）[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=We%20did%20what%20I%20like,make%20space%20for%20new%20titles)、內容有明顯謬誤或已被新資料取代等。一旦符合這些條件，就列入汰舊清單。此外，可教給兼任館員一些**快速目測技巧**：例如\*\*“積灰塵測試”**（書頂覆灰表示久未碰觸）或抽查插圖/資訊是否過時（如引用已淘汰的科學理論）。這些直觀方法讓不具圖書專業背景的教師也能大致辨識館藏中“該退場”的書。最後，對於拿不定主意的書，可設定**複核機制\*\*：例如由教務主任或教學領域教師共同評估該書是否仍有保存價值，降低個人判斷壓力。
*   **館藏利用數據的簡易解讀：**引入**圖書館管理系統**來自動記錄借閱，可以很方便地取得館藏使用數據。但對兼職館員而言，關鍵是學會快速從中抓重點。一種簡單方法是定期（如每學期末）讓系統生成幾項報表：①**最高借閱**排行（最受學生歡迎的20本書）、②**零借閱**清單（整年度未借出的書籍列表）、③**館藏年齡**報表（按館藏分類統計平均出版年份）等。從最高借閱排行，可瞭解學生興趣所在，作為下學期館藏**增購方向**。從零借閱清單，可進一步篩選出非參考工具書且多年沒人借的，列為**淘汰候選**。館藏年齡報表則能顯示哪些主題區藏書偏舊，例如如果科學類平均出版年距今15年以上，就提醒需更新。透過這幾項**關鍵數據指標**，不用複雜統計知識也能掌握館藏狀況，做到有依據地做決策。
*   **利用師生力量共同管理：**在沒有專職館員時，善用校內人力是策略之一。可以組建**館藏發展委員會（工作小組）**，由圖書教師牽頭，邀請各領域老師各1-2人參與。定期開短會議討論課程需要哪些新書、哪些館藏可淘汰。同時，鼓勵學生參與**館藏評選**：例如舉辦“我們最想要的圖書”票選活動，收集學生希望新增的書目；或讓高年級圖書館志工協助盤點書架上塵封已久的書（由學生貼上“建議淘汰”標籤供館員參考）。這些做法一方面**減輕**單一教師獨自決策的負擔，另一方面**培養讀者認同**——學生參與選書/汰書過程後，會更珍惜圖書館資源。IFLA也強調館藏建立是**協作的努力**，教師的專業知識和學生的興趣能為館藏建設提供寶貴意見[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=teachers%20to%20develop%20policies%20that,school%20libraries%20acquire%20resources%20that)。
*   **建立友善的淘汰流程：**實務中，館藏淘汰若處理不當，可能引發師生或家長疑慮。因此策略上應使流程**透明**且具教育意義。做法包括：對將淘汰的書在館內設置“**退役圖書展示區**”，公告一段時間（例如兩週）供師生知悉並提出異議或認領[cde.ca.gov](https://www.cde.ca.gov/ci/cr/lb/documents/weedingbrochure.pdf#:~:text=,and%20a%20process%20for)。很多學生其實願意把淘汰書帶回家珍藏，或者教師想留用作教材參考，這樣可以給他們機會。未被認領而確定淘汰的，再由學校依程序**集中處理**（如捐給慈善機構或資源回收）。同時在校務會議報告中簡述汰舊工作，使學校管理階層理解淘汰是為了**更新館藏、提升閱讀品質**。如此一來，館藏汰舊從令人誤解的“丟書”變成一種**正向管理**，也降低外界阻力。簡化的原則是：**事前告知、尊重意見、妥善處置**，讓淘汰流程順暢無爭議。
*   **運用科技自動化輔助：**現代圖書館系統與工具可以大幅簡化館藏管理的瑣事。例如啟用**條碼或RFID**技術，讓借還書全自助，確保借閱數據完整記錄，方便後續分析。利用**館藏管理軟體**的自動提醒功能：每到期末自動生成\*\*“長期未借出清單”**發給圖書教師，提示該檢視這些書的去留。又如設置**新書登錄模板\*\*，輸入ISBN後自動從網路抓取書目資料，減少人工 cataloging 時間。對於館藏統計，也可用簡單的**資料視覺化**儀表板，老師一眼就看出館藏結構（比如各分類冊數、借閱次數對比）。此外，一些AI應用（下節詳述）更能主動提供**決策建議**，例如推薦汰舊清單或補藏建議。總之，透過科技將繁瑣的記錄、統計**自動化**，教師就能把有限的精力用在判斷與決策本身。

5) 對應到系統的資料欄位建議
---------------

> **說明：**以下列出在**館藏管理系統**中，為支持館藏發展、汰舊評估、流通分析所建議蒐集的資料欄位。包括欄位名稱（中英文）、資料類型、是否必填，以及用途說明和例子。

| 欄位名稱 (Field) | 類型 (Type) | 必填? | 說明 (Description) | 例子 (Example) |
| --- | --- | --- | --- | --- |
| 書名 (Title) | 文字 (Text) | 是 | 書籍主標題。【核心欄位】用於顯示與檢索館藏。 | _哈利波特－神秘的魔法石_ (Harry Potter and the Sorcerer's Stone) |
| 作者 (Author) | 文字 (Text) | 是 | 作者姓名。可多值（多人合著時）。有助於識別與查找，同時分析熱門作者。 | J.K.羅琳 (Rowling, J. K.) |
| 出版年 (Publication Year) | 年 (Year) | 否 | 書籍出版的年份。用於計算館藏平均新舊程度，輔助汰舊判斷（如超過N年未更新者標記）。 | 1998 |
| 國際標準書號 (ISBN) | 文本/數字 (Text/Number) | 是 | 國際標準書號，圖書唯一識別碼。可用於匯入書目資料、避免重複館藏。 | 9789573317241 |
| 分類號/主題 (Classification/Subject) | 代碼或文字 (Code/Text) | 否 | 該書的分類（如杜威十進位DDC類號）或主題關鍵字。用於統計各主題館藏量與分析不足領域。 | 792.94 (DDC號)；關鍵字：戲劇/舞台劇 |
| 適讀對象 (Intended Audience) | 代碼/選單 (Enum) | 否 | 建議適合的讀者年級或年齡範圍。協助檢視館藏對各年級的覆蓋是否均衡。 | 小學高年級 (Grade 5-6) |
| 語言 (Language) | 選單 (Enum) | 否 | 資料語言。多語藏書可記錄此欄便於統計語言多樣性。 | 繁體中文；英文 |
| 資料類型 (Material Type) | 選單 (Enum) | 是 | 館藏資料型態，用於區分書籍、期刊、視聽等。可做分開管理與分析。 | 圖書（Book）；DVD；電子書 |
| 登錄日期 (Acquisition Date) | 日期 (Date) | 否 | 該書加入館藏的日期。可計算館藏**館齡**（在館時間），搭配借閱次數算出年均借閱率。也用於篩選近期新增館藏。 | 2018-09-15 |
| 最近借閱日 (Last Borrowed Date) | 日期 (Date) | 否 | 此書最後一次借出的日期。【汰舊關鍵】用於找出長期未借書籍[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=6,Analyze%20circulation%20patterns)。若超過門檻（如2年）未借，可列入淘汰審查清單。 | 2021-05-30 |
| 累計借閱次數 (Total Circulations) | 數字 (Integer) | 否 | 此書自入館以來被借出的總次數。可用來評估**使用率**高低，數值低又長期未借者是淘汰候選；數值高者證明受歡迎也指示類似主題可多補充。 | 12 （次） |
| 館藏地點 (Location) | 文字/代碼 (Text/Code) | 否 | 此書所在的館藏位置，如書架編號或區域。方便盤點與區分各館藏區統計。 | 少年小說區-書架B3；庫房 |
| 狀態 (Status) | 選單 (Enum) | 是 | 資料目前狀態：可外借、館內閱覽、已借出、館藏維修中、已淘汰等。【重要】淘汰的書通常轉為“已移除”狀態而不計入現有館藏。 | 可外借 (Available)；已淘汰 (Withdrawn) |
| 書況等級 (Condition) | 選單 (Enum) | 否 | 書本物理狀況級別：新、良好、中等、破損。【汰舊參考】破損嚴重者優先淘汰或替換。 | 中等 (頁緣微黃，有借閱痕跡) |
| 汰舊原因 (Weeding Reason) | 文字 (Text) | 否 | 若狀態設為“已淘汰”，記錄淘汰原因。利於日後檢討館藏維護策略，也作為對外說明依據。 | 資料過時 (內容已被新版取代)、書況不佳 |
| 備註 (Notes) | 文字 (Text) | 否 | 其他補充資訊，例如“某某捐贈”“此書獲得某獎”“教師推薦教材”等。作為特殊情況標記，方便在汰舊時考量例外（如獎項書可能保留）。 | 學校家長會捐贈；入選好書大家讀書單 |

**欄位配置理由：**上述欄位涵蓋了**館藏管理核心要素**：基本書目資料（題名、作者、出版年等）支援館藏發展的**選購**面；使用情況資料（最近借閱日、借閱次數）與物理狀態（書況）支援**汰舊決策**；分類、適讀對象則有助**館藏分析**看是否符合課程和學生需求。狀態與汰舊原因則讓系統保留**歷史記錄**，方便追蹤淘汰流程和結果。透過這些可結構化的欄位，許多館藏管理工作（如找出長期未借書、計算平均出版年等）都能以**查詢或報表**自動完成，提高效率。

6) 對應到系統的功能設計建議
---------------

為了滿足中小學館藏管理需求，圖書館系統應提供一系列貼合實務的功能。以下以「**需求→功能→為何**」格式，列出關鍵功能設計與其背後原因：

*   \*\*需求：\*\*找出長期未被利用的館藏，以利汰舊評估 \*\*→ 功能：\*\*提供「**久未借出清單**」報表（可依最近借閱日篩選，如兩年以上未借）[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=6,Analyze%20circulation%20patterns) **→ 為何：**自動鎖定可能淘汰候選，協助教師館員定期**主動**發現閒置資源，不需人工逐冊翻查。這符合汰舊政策中設定的客觀期限，讓淘汰決策更有依據。 |
*   \*\*需求：\*\*掌握各分類館藏的新舊與使用概況 **→ 功能：**館藏**分析儀表板**，顯示每個主題分類的藏書量、平均出版年、累計借閱次數占比等 **→ 為何：**幫助館員迅速了解館藏結構與弱點。例如一看就知某分類藏書很多但借閱率低，暗示該領域可能**供過於求**，須減量汰舊或調整選書方向[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=There%E2%80%99s%20also%20an%20outdated%20mindset,have%20way%20too%20many%20books)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=usually%20way%20older%20than%20it,have%20way%20too%20many%20books)；反之熱門分類藏書偏少則提示應增購。圖形化呈現降低解讀門檻，符合教師館員快速決策需要。
*   **需求：**對照館藏與課程標準，找出缺口 **→ 功能：\*\*\*\*館藏對課綱對照**工具。館員可選擇某學科或年級課程主題，系統列出該主題相關的現有館藏及其數量，並提示缺少的重要主題 **→ 為何：**中小學館藏應密切支援教學。透過系統輔助，比對教育部課綱或老師提出的閱讀清單，快速發現有哪些課程主題**缺乏館藏**。這有助於教師館員在採購時**精準**充實相關資源，落實館藏發展政策的課程導向[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=School%20library%20collections,in%20helping%20to%20build%20library)。
*   \*\*需求：\*\*簡化新書登錄與編目流程 **→ 功能：****一鍵匯入書目**（輸入ISBN，自動抓取圖書書名、作者、分類等），並提供**預設欄位模板**（統一格式填寫） \*\*→ 為何：\*\*兼任館員通常沒有完整的編目訓練，這項功能可避免繁瑣的手動輸入和分類查找，提高準確性與速度。快速完成新書上架，讓教師把時間騰出用於閱讀指導等核心工作。同時一致的欄位格式也提升日後數據分析的可靠性。
*   **需求：**定期清點館藏避免帳面與實物不符 **→ 功能：****館藏盤點支援**：透過行動設備掃描書籍條碼進行清點，系統自動比對應在架卻未掃到的項目，列出**疑似遺失**或**紀錄有誤**清單 **→ 為何：**正如實務經驗所示，長期未清點會導致系統記錄與實際不符，使得汰舊或統計分析不準確[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=When%20I%20moved%20into%20our,a%20lack%20of%20consistent%20inventory)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=addition%20to%20weeding%2C%20many%20of,a%20lack%20of%20consistent%20inventory)。該功能幫助兼任館員**輕鬆盤點**，迅速發現丟失或未及時註銷的書籍。保持數據準確才能依賴系統做出正確決策。
*   **需求：**選書和淘汰決策的過程透明且可溯源 **→ 功能：\*\*\*\*館藏決策日志/審批**模組。對每筆新增或淘汰，可記錄決策理由、建議人（如某老師推薦購買或淘汰）、以及校長/主任電子簽核 **→ 為何：**在沒有專職館員的學校，讓決策**制度化**有助提升信任度。例如家長質疑某書為何下架時，館員可查日志說明「依據政策第X條，因內容不符現行課程且5年無借閱，經教務處同意淘汰」[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=Weeding%20or%20the%20deselection%20of,many%20weeding%20resources%20available%20online)。此功能確保每項館藏變動**有跡可循**，降低單一人員擔責的壓力，又可作為期末向校務報告的資料。
*   \*\*需求：\*\*自動提供汰舊與增購的建議方案 **→ 功能：****智能館藏顧問**（AI助手）。利用既有借閱數據和館藏結構，定期生成建議：如「以下50冊符合汰舊標準（久未借+出版超15年），建議淘汰清單」及「某主題藏書平均年齡20年，建議新增近5年出版的相關新書X冊」 **→ 為何：**教師兼任館員專業時間有限，AI輔助可以彌補經驗不足，提供**依據數據的决策參考**。這相當於一位隨行顧問提醒：「該更新科學類館藏了」或「這幾本書可能需要下架」，使館藏管理更**前瞻且主動**，而非被動等問題嚴重才處理[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=across%2063%20campuses%20was%202006%E2%80%94almost,replace%20some%20of%20those%20books)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=%E2%80%9Cjust%20in%20case,replace%20some%20of%20those%20books)。
*   **需求：**提高學生借閱興趣以活化館藏 **→ 功能：\*\*\*\*閱讀趨勢推薦**與**館藏展示**。例如系統首頁顯示「本校熱門書籍TOP10」「新進館藏」「依年級推薦書單」等模組，以及**書評互動**功能供學生分享喜愛的書 **→ 為何：**有效的館藏管理不僅在“藏”，還在於“用”。透過系統界面吸引學生關注館藏動態，借鑒商業書店的做法來**行銷館藏**。如熱門TOP10讓館藏中的明星書更受關注，新書展示告知有新東西可借。學生能發表短評或打星則增加互動，營造閱讀社群氛圍。這些功能鼓勵學生多借閱，用數據**推動館藏使用率提升**，形成良性循環。
*   \*\*需求：\*\*方便教師參與推薦與選購 **→ 功能：****教師推薦/請購平臺**。教師可登入系統提交新書推薦，填寫理由（如配合某課程單元需要），館員在後台審核彙總採購 **→ 為何：**如IFLA所述，教師是館藏建設的重要合作者[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=policy%20makes%20it%20clear%20that,school%20libraries%20acquire%20resources%20that)。提供一個簡便管道收集教師需求，可以**拓寬選書視野**，確保館藏與課程緊密連結。同時紀錄這些請求也可分析哪些領域教師需求高，作為館藏發展策略依據。系統化的平臺減少口頭溝通遺漏，讓選書過程更**集思廣益**且有記錄。

上述功能圍繞**自動化、省力化、智慧化**三原則設計，以符合中小學使用情境。一套友好的系統應替代繁瑣的人工作業，提供及時資訊，使沒有圖書專業背景的教師也能自信地管理館藏資源。

7) 常見坑與避雷清單
-----------

學校圖書館館藏管理在實務中可能遇到許多挑戰和陷阱。以下整理常見**坑點**及建議**避雷**方法，幫助圖書教師提前因應：

*   **⚠️ 資料庫紀錄不準（遺失未註銷）:** 由於人力不足，館藏常年未清點，導致系統顯示有的書其實早遺失或損毀。這會誤導館藏分析，以為某些書從無人借閱（實則已不在架）。**避雷:** 至少每年或每兩年進行一次**全面館藏盤點**[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=When%20I%20moved%20into%20our,a%20lack%20of%20consistent%20inventory)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=addition%20to%20weeding%2C%20many%20of,a%20lack%20of%20consistent%20inventory)。盤點過程中，把找不到的書標記“下落不明”，及時從系統館藏中除帳或重訂狀態，使統計基礎可靠。
*   **⚠️ 不敢汰舊導致館藏臃腫:** 很多學校捨不得丟書，“以防萬一將來用到”的心態普遍[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=across%2063%20campuses%20was%202006%E2%80%94almost,replace%20some%20of%20those%20books)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=%E2%80%9Cjust%20in%20case,replace%20some%20of%20those%20books)。結果藏書越攢越多，平均館藏年齡偏高（常見超過10-15年），書架擠滿陳舊書籍，學生找新書困難，反而降低借閱意願[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=There%E2%80%99s%20also%20an%20outdated%20mindset,have%20way%20too%20many%20books)[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=usually%20way%20older%20than%20it,have%20way%20too%20many%20books)。**避雷:** 要有**定期淘汰**觀念，每年“小剪刀不斷剪”，避免日後“大手術”。透過政策明文支持館員汰舊，以及校方承諾汰舊後會有**補充經費**，讓館員沒有後顧之憂地執行淘汰。可向師生宣導“**少而精**勝於多而舊”，扭轉“館藏量=圖書館好壞”的迷思。
*   **⚠️ 僅看借閱數據忽視教育價值:** 完全以借閱次數作為保留或淘汰依據，可能導致經典文學、權威工具書因借閱率低而被錯淘；或反之，一味迎合熱門題材忽略知識深度。**避雷:** 強調**數據+判斷**並用。對低借閱但具經典地位或校本課程需要的書，可作適當**例外保留**[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=While%20reports%20and%20automation%20have,and%20will%20loan%20a%20copy)[ala.org](https://www.ala.org/tools/challengesupport/selectionpolicytoolkit/weeding#:~:text=should%20be%20executed%20with%20a,and%20will%20loan%20a%20copy)。建立淘汰複核機制，邀相關科任老師對專業書籍做最後把關（如歷史老師認為某史料書即使少人借也應留供參考）。同時運用數據時，區分**娛樂性閱讀**與**學科支援**不同定位的館藏，評價標準有所不同。
*   **⚠️ 接受無用贈書造成負擔:** 社會熱心贈書或校內廢書轉贈，若不加篩選全盤收下，常引入大量與課程無關或品質不佳的書，侵占空間還增加整理工作。**避雷:** 制定**贈書收受原則**：例如只收八成新以上、近5年內出版、內容適合學生的書。對不符合標準的贈書禮貌拒收或轉贈他處。對已收下的一批贈書也應逐一審核該留幾本，其餘及時處理，不讓其長期佔據書架。
*   **⚠️ 書目資料欄位缺漏不一致:** 由於兼任人員缺乏編目經驗，可能發生同一作者名字有多種拼法、分類號填寫錯誤甚至遺漏、適讀年齡等未登記。這會導致系統檢索不全、統計失真（如同一作者實際有10本書卻因登錄不一被視為不同人）。**避雷:** **規範登錄格式**，必要時參考國家圖書館聯編目錄的記錄。系統可加驗證機制：如ISBN重複提示、出版年不合理（未來年份）阻止保存等。定期**數據清理**也是必要的，發現欄位缺失就補登。良好的數據品質才能發揮館藏分析和管理功能。
*   **⚠️ 未考慮師生情感因素:** 有些書即使客觀上該淘汰，卻可能有師生的情感連結（例如畢業紀念刊、校友或老師著作）。直接丟棄可能引發不悅。**避雷:** 淘汰前**公告與溝通**（如前述的退役圖書展示），讓相關人知悉。有特殊意義的書可轉為**館史保存**或贈予相關人士，而非當一般館藏淘汰處理。此外，可在校網或佈告欄公佈淘汰原則與清單，表示尊重知情權，獲取理解。
*   **⚠️ 圖書借閱未完全記錄:** 某些情況下學生取書閱覽但不辦借閱（尤其是參考工具書館內看）、或老師整班借出未逐一掃描，導致實際使用未反映在系統。**避雷:** 推行**館內閱覽登記**制度，學生看參考書時可以簡單掃碼登記“館內使用一次”。老師大量借書給班級閱讀時，也請協助做好批次借還紀錄。雖增加一點手續，但能讓**使用量有跡可循**。至少對長期零借閱的書，館員可詢問老師確認真沒在用再決定淘汰。這樣避免誤判實際被利用但未借出的資源。
*   **⚠️ 缺乏長遠館藏發展計畫:** 年度選書若全憑當下直覺或外部捐贈，容易顧此失彼，館藏結構失衡。如連年買同類熱門讀物，冷門但必要的領域持續空白。**避雷:** 制定**中長期館藏發展計畫**（哪怕只是非正式的），每年有側重主題。比如三年計畫第一年重點補科學類，第二年補社會科學類，第三年更新文學類。並設定目標如“平均館藏年齡降至5年以內”“每生擁書達50冊”。有了計畫，就不致受到一時風潮左右而忽略長遠需求。
*   **⚠️ 圖書館與教師脫節:** 如果課堂上老師從未引導學生利用圖書館資源，再好的館藏也可能閒置。這在沒有專職館員時更易發生——圖書館變成一個獨立角落。**避雷:** **主動出擊**建立合作：圖書教師定期在教研會議分享館藏新進資料，提醒各科老師有哪些書可用於他們的課程。邀請老師帶學生來辦讀書活動或上資訊素養課。當教師把圖書館視為教學延伸時，就會更頻繁推薦學生借閱相關書籍，館藏利用率自然提高，良性循環避免圖書館邊緣化。

總之，中小學館藏管理的痛點多源於**人力不足**與**觀念落差**。避開這些坑需要**制度流程**加持，也需要館員與學校同仁的**共識**與**合作**。提前預見問題並採取對策，能讓圖書館少走彎路，在有限資源下發揮最大效益。

8) 可交付給 AI 小助理的任務清單
-------------------

在中小學圖書館管理中，引入 AI 助手可以替代許多重複性工作並提供智能分析。以下是一些可交由AI圖書館小助理執行的任務範例：

*   **館藏狀態標記：**「請幫我標記出館藏中**兩年未曾借閱**的書籍清單。」AI將根據借閱紀錄自動篩選出超過兩年無借閱的項目，供館員檢視處理（此功能已在許多系統以報表形式實現）[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=6,Analyze%20circulation%20patterns)。
*   **汰舊建議書單生成：**「幫我生成一份**館藏汰舊建議清單**。」AI會綜合各種標準（久未借閱[library.sd.gov](https://library.sd.gov/LIB/SLC/doc/Guide-SDSL-SchLibrrn-CollectAssess.pdf#:~:text=6,Analyze%20circulation%20patterns)、出版超過N年、狀態破損等）列出建議淘汰的書籍清單，附每項理由（如“MUSTIE-資訊過時”），供館員決策參考。
*   **館藏分析報告：**「生成本學期**館藏使用分析**報告。」AI助理將輸出可視化圖表和摘要，包括總借閱量、各分類借閱比例、最受歡迎書籍Top10、零借閱書籍數量、館藏平均年齡變化等指標，讓館員用於期末檢討[knowledgequest.aasl.org](https://knowledgequest.aasl.org/weeding-the-great-library-divide-embracing-collection-maintenance-with-enthusiasm/#:~:text=The%20Circulation%20Reality)。
*   **新書採購建議：**「根據我們館藏的缺口，給出**下學期採購書目**建議。」AI可比對課程需求和現有館藏，利用外部書目資料庫推薦一些適合的新增書籍。例如發現本館幾乎沒有關於編程的童書且相關課程將開設，則建議幾本近年的兒童編程入門書，並提供出版社資訊。
*   **館藏多元性審視：**「請檢查館藏是否符合**多元與平衡**原則。」AI將分析館藏在語言、文化、性別議題等方面的覆蓋情況，列出例如「英文原文書比例僅5%」「原住民文化主題藏書僅2冊」等發現，以提醒館員增補弱項[studocu.com](https://www.studocu.com/in/document/central-university-of-punjab/managerial-economics/ifla-school-library-guidelines/34051772#:~:text=their%20students%2C%20have%20an%20important,members%20of%20the%20school%20community)。
*   **讀者興趣預測與推送：**「幫我為五年級學生生成**閱讀推薦書單**。」AI可根據該年級學生的借閱偏好和流行主題，推薦適合的書籍清單，並可自動過濾本館已有或不適齡的書。這幾乎是模擬圖書館員讀者諮詢服務的AI版，助力個性化閱讀推廣。
*   **書目資料校正：**「掃描本館館藏書目，幫我找出**可能的資料錯誤或缺失**。」AI可偵測到如作者姓名拼寫不一致、ISBN格式錯誤、分類號空缺等資料異常，提供校正建議，維護目錄品質。
*   **館藏與課程匹配度檢查：**「分析一下我們的館藏能否滿足**下學期課程**需求。」AI會讀入學校下學期的各科教學進度表或課綱重點，檢索館藏中相應主題的書籍數量，報告哪些單元的相關讀物明顯不足，提示館員提前備齊。
*   **借閱模式預測：**「預測一下**下月哪些類型**的書可能借閱高峰。」AI基於過去年度同期數據和目前趨勢，預測下月可能熱門的分類（例如每年科展前夕科學類書會上升），以便館員提前調整陳列、增加相關書本備取。
*   **自動化例行通知：**AI可執行許多定時任務，如學期末自動通知「請歸還長期未還圖書」、學年初提醒「開始館藏更新與汰舊盤點」，以及在教師生日或閱讀週推送個性化資訊等。這些貼心助理工作讓圖書館服務更**主動**且不遺漏重要時機。

上述任務清單展示了AI在館藏管理中的多種輔助作用，從重複勞務（數據篩選、通知）到智能分析（趨勢預測、選書建議）。隨著圖書館系統智慧化發展，教師館員可將越來越多的繁瑣環節交給AI處理，自己專注於決策和讀者互動，最終提升學校圖書館的運作效能與服務品質。

* * *

**本章關鍵搜尋詞（中英）**：館藏發展政策 (Collection Development Policy)、館藏建設 (Collection Building)、學校圖書館 指南 (School Library Guidelines)、AASL 學校圖書館 標準 (AASL school library standards)、IFLA School Library Guidelines、選書 原則 (Selection criteria school library)、圖書館 汰舊 (Library weeding)、淘汰 原則 圖書 (Book weeding criteria)、MUSTIE CREW 圖書館、館藏 評估 (Collection assessment)、流通 分析 (Circulation analysis)、借閱 統計 分析 (circulation statistics analysis)、教育部 中小學 圖書館 基準、閱讀推動教師 計畫、圖書館 系統 功能 設計、學校 圖書館 AI 應用

10:52 PM22:52

## Prompt:
ChatGPT-文獻 F 館藏管理系統規劃.md

File

你是我的「圖書資訊學 × 中小學圖書館系統」研究助理與資料策展員。我的目標是規劃並開發一套適合台灣中小學、在人力不足與預算有限情境下可快速導入的雲端圖書館管理系統（含編目、分類、主題分析、檢索、流通、館藏管理、使用者管理、統計報表），並在設計上兼顧圖資理論與實務流程。

請你用「大量蒐集與整理參考資料」的方式，建立一份「中英文對照、可追溯來源、可直接用於系統規格與企劃書」的資料庫。你的工作重點不是泛泛介紹，而是：
1) 提供概念與名詞的精確定義（中英文對照）
2) 指出在中小學場域中的常見做法、痛點與取捨（簡化策略）
3) 提供可落地的系統功能設計建議（資料欄位、規則、流程）
4) 優先引用權威來源（標準、官方文件、學術論文、圖書館專業機構）
5) 每個關鍵結論要附「來源線索」（可用：作者/機構、文件名、年份、章節/條目名稱、或可搜尋的關鍵字；若你具備瀏覽能力請直接附可查證的連結與引用）

【我的背景與限制】
- 我是台大圖資系大學部，有圖書資訊領域基礎。
- 目標使用者：沒有專職館員的中小學（教師兼任、行政負擔重）。
- 系統原則：少人力、低學習成本、資料結構正確、可擴充。
- 我希望輸出內容可以直接交給後續的 AI 小助理（未來要協助我做專案），因此你要「結構化」、「可復用」、「可轉成規格」。

【你要涵蓋的主題範圍（請全部處理）】
A. 編目（Cataloging）：書目記錄、欄位/分欄、著者/主題款目、控制款目、編目層級；MARC 21、ISBD、RDA（重點在理解結構與中小學簡化）
B. 分類（Classification）：DDC、索書號/類號、主題分類 vs 教學導向；分類亂用的現場問題；分類建議/視覺化架構
C. 主題分析（Subject Analysis）：主題標目、關鍵詞、自然語言 vs 控制詞彙、一致性；LCSH 概念；自訂中小學主題詞表
D. Metadata：描述/行政/結構/識別；Dublin Core；Application Profile（教育場域 metadata profile）
E. 資訊檢索（Information Retrieval）：查詢、欄位/全文、模糊搜尋、排序；Precision/Recall；小學生使用者行為；Browse vs Search
F. 館藏管理（Collection Management）：館藏發展、汰舊、流通率、生命週期；系統如何提示汰舊與未借書
G. 流通作業（Circulation）：借還、續借、預約、逾期；中小學流程簡化；自動化策略
H. 使用者管理（User Management）：角色權限、借閱隱私、學期升級/畢業、資料最小化
I. 資訊行為（Information Behavior）：兒童資訊尋求、瀏覽 vs 搜尋、UX 在圖資系統的應用
J. 資訊倫理與政策（Ethics & Policy）：借閱隱私、兒少資料保護、紀錄保存年限、最小蒐集原則

【輸出格式要求（請嚴格遵守）】
請分成 10 個章節（A-J）依序輸出，每章節都包含以下 8 個小節，並用清楚的標題：

1) 核心概念與名詞（中英文對照表）：至少 12 個術語，每個術語要有「一句話定義」與「同義詞/常見誤用」
2) 關鍵理論與必讀脈絡：列出 5-10 個必懂概念（含為何重要）
3) 標準/規範/權威資源：列出 5-10 項（機構、文件名、版本/年份、可搜尋線索或連結）
4) 中小學場域的簡化策略：哪些要做、哪些可不做、為什麼（列出具體取捨原則）
5) 對應到系統的資料欄位建議：用「欄位名/型別/是否必填/說明/例子」列出建議（至少 8 欄）
6) 對應到系統的功能設計建議：至少 8 條（用「需求→功能→為何」格式）
7) 常見坑與避雷清單：至少 8 條（含資料品質、一致性、使用者錯誤、維運）
8) 可交付給 AI 小助理的任務清單：至少 10 條（例如：幫我整理 DDC 教育版簡化、幫我找台灣中小學圖書館借閱規則案例…）

【額外要求】
- 請在每章結尾附上「本章關鍵搜尋詞（中英）」至少 15 個，讓我方便自行搜尋。
- 全文請以繁體中文為主，但術語必須保留英文。
- 不要只講概念，要能轉成「系統規格」與「提案文字」。
- 若遇到不同國家/機構的做法，請用「對照」方式呈現差異，並說明哪種較適合台灣中小學。
- 若你沒有即時瀏覽能力，請至少提供「可被搜尋驗證的完整線索」；若你有瀏覽能力，請把來源連結與引用一起放上。

請分析以下內容 並做相關的查詢文獻驗證

10:53 PM22:53

## Response:
收到，我會針對你上傳的「F 館藏管理系統規劃」文件進行文獻驗證與補充查找，並按照你指定的 8 小節結構，製作一份完整、可導入系統的對照資料庫，重點放在中小學圖書館場域的簡化與落地設計。

完成後會通知你檢閱，過程中你也可以隨時補充其他方向或文件。

10:52 PM22:52

Research completed in 13m · 18 sources · 160 searches

## Response:
中小學圖書館館藏管理系統知識庫
===============

1\. 核心概念與名詞（中英文對照表）
-------------------

*   **館藏 (Library Collection)**：指圖書館所擁有的全部文獻資料，包括書籍、期刊、多媒體等館內藏品[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E3%80%8C%E6%B2%83%E5%9C%9F%E8%A8%88%E7%95%AB%E3%80%8D%E5%80%9F%E5%8A%A9%E8%AE%80%E8%80%85%E4%B9%8B%E5%8A%9B%20%E7%A4%BE%E5%8D%80%E6%9B%B8%E5%BA%97%E9%99%AA%E5%AD%B8%E7%94%9F%E4%B8%80%E8%B5%B7%E9%95%B7%E5%A4%A7%20%E9%96%B1%E6%8E%A8%E6%95%99%E5%B8%AB%E6%98%AF2009%E5%B9%B4%E6%96%B0%E8%88%88%E7%9A%84%E8%A7%92%E8%89%B2%EF%BC%8C%E6%9B%BE%E5%93%81%E6%96%B9%E8%A7%A3%E9%87%8B%EF%BC%8C%E4%BB%96%E5%80%91%E9%83%BD%E6%8E%A5%E5%8F%97%E9%81%8E%E5%B0%88%E6%A5%AD%E8%A8%93%E7%B7%B4%EF%BC%8C%E5%9C%A8%E5%AD%B8%E6%A0%A1%E8%A6%81%E9%96%8B%E8%A8%AD%E5%B0%88%E9%96%80%E7%9A%84%E9%96%B1%E8%AE%80%E8%AA%B2%EF%BC%8C%20%E5%90%8C%E6%99%82%E8%82%A9%E8%B2%A0%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%AE%A1%E7%90%86%E4%BB%BB%E5%8B%99%E3%80%82%E5%9C%A8%E6%B2%92%E6%9C%89%E9%96%B1%E6%8E%A8%E8%80%81%E5%B8%AB%E7%9A%84%E5%AD%B8%E6%A0%A1%EF%BC%8C%E5%AD%B8%E7%94%9F%E4%B8%8D%E4%BD%86%E7%84%A1%E6%B3%95%E4%B8%8A%E9%96%B1%E8%AE%80%E8%AA%B2%20%E3%80%81%E6%9C%89%E7%B3%BB%E7%B5%B1%E5%AD%B8%E7%BF%92%E9%96%B1%E8%AE%80%E9%80%99%E9%A0%85%E8%83%BD%E5%8A%9B%EF%BC%8C%E6%A0%A1%E5%85%A7%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9B%B4%E5%8F%AF%E8%83%BD%E7%BC%BA%E4%B9%8F%E8%B3%BC%E6%9B%B8%E8%A6%8F%E5%8A%83%EF%BC%8C%E5%8D%B3%E4%BE%BF%E6%94%B6%E5%88%B0%E4%BB%96%E4%BA%BA%E8%B4%88%E6%9B%B8%EF%BC%8C%E4%B9%9F%E5%8F%AF%E8%83%BD%E5%9B%A0%E6%AC%A0%E7%BC%BA%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E7%9F%A5%E8%AD%98%EF%BC%8C%E7%84%A1%E6%B3%95%E5%B0%87%E8%B4%88%E6%9B%B8%E5%88%86%E9%96%80%E5%88%A5%E9%A1%9E%E4%B8%8A%E6%9E%B6%E3%80%82)。_同義/常見誤用_: 藏書、收藏（側重書籍）；典藏（有時指珍貴收藏）。
*   **館藏管理系統 (Library Management System, LMS)**：用於管理館藏、讀者及流通的軟體系統，又稱圖書館自動化系統或整合館藏系統 (Integrated Library System, ILS)。_同義_: ILS、Library Automation System；_常見誤用_: 誤以為僅限於電子書管理，其實涵蓋所有館藏類型。
*   **圖書館目錄 (Library Catalog/OPAC)**：組織館藏書目供查詢的清單，可透過**OPAC**（Online Public Access Catalog，線上公眾目錄）提供讀者檢索書目[zh.wikipedia.org](https://zh.wikipedia.org/zh-cn/OPAC#:~:text=OPAC%EF%BC%88%E5%85%A8%E7%A7%B0%20Online%20Public%20Access%20Catalogue%EF%BC%8C%E5%9B%BE%E4%B9%A6%E9%A6%86%E8%81%94%E6%9C%BA%E7%9B%AE%E5%BD%95%E3%80%81%E8%81%94%E6%9C%BA%E5%85%AC%E5%85%B1%E4%B9%A6%E7%9B%AE%E6%9F%A5%E8%AF%A2%E7%B3%BB%E7%BB%9F%EF%BC%89%EF%BC%8C%E5%8F%88%E7%A7%B0%E4%B8%BA%E2%80%9CWebPAC%EF%BC%88%E5%85%A8%E7%A7%B0,%E8%B5%84%E6%BA%90%2087%E3%80%82%E8%AF%BB%E8%80%85%E5%8F%AF%E4%BB%A5%E9%80%9A%E8%BF%87%E4%B8%87%E7%BB%B4%E7%BD%91%E5%AE%9E%E7%8E%B0%E5%9B%BE%E4%B9%A6%E7%9A%84%E6%9F%A5%E6%89%BE%E5%92%8C%E5%80%9F%E9%98%85%E3%80%82%E5%8E%9F%E6%9D%A5%E7%9A%84%E7%94%B5%E5%AD%90%E4%B9%A6%E7%9B%AE%E7%94%A8TELNET%20%E4%BD%9C%E4%B8%BA%E6%8A%80%E6%9C%AF%E6%94%AF%E6%8C%81%EF%BC%8C%E4%BD%86%E6%98%AF%E5%B7%B2%E4%B8%8D%E8%83%BD%E6%BB%A1%E8%B6%B3%E7%8E%B0%E4%BB%8A%2089%E9%97%B4%E7%9A%84%E4%B9%A6%E7%9B%AE%E8%BF%9B%20%E8%A1%8C%E6%B1%87%E6%80%BB%E3%80%82%E7%8E%B0%E5%9C%A8%E7%9A%84%E7%BD%91%E4%B8%8A%E4%B9%A6%E7%9B%AE%E5%A4%9A%E4%BB%A5%E5%9C%B0%E5%8C%BA%E6%80%A7%E5%9B%BE%E4%B9%A6%E9%A6%86%E7%9A%84%E4%B9%A6%E7%9B%AE%E5%8A%A0%E4%BB%A5%E6%B1%87%E6%80%BB%EF%BC%8C%E8%83%BD%E4%BD%BF%E8%AF%BB%E8%80%85%E7%9A%84%E6%9F%A5%E8%AF%A2%E7%BB%93%E6%9E%9C%E8%A6%86%E7%9B%96%E6%9B%B4%E5%A4%A7%E8%8C%83%E5%9B%B4%E7%9A%84%E5%9B%BE%E4%B9%A6%E9%A6%86%E3%80%82)。_同義_: 書目、聯機目錄；_誤用_: 有時與圖書館館藏混淆（目錄是檢索工具，非藏書本身）。
*   **編目 (Cataloging)**：將館藏資料的特徵彙整成書目記錄的過程，包括記述編目（書名、作者、出版資訊等）與主題編目（分類號、主題詞）。其目的在於建立規範的館藏目錄，方便讀者檢索利用[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE&search=%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE#:~:text=%E6%BC%A2%E8%AA%9E%E6%8B%BC%E9%9F%B3%EF%BC%9A%20t%C3%BA%20sh%C5%AB%20bi%C4%81n%20m%C3%B9,50%E8%AE%80%E6%9B%B8%20%2052%E4%B9%8B%20%2054%E3%80%82)。_同義_: Cataloguing、資料建檔；_常見誤用_: 與分類混淆（編目包含分類，但不等於僅做分類）。
*   **分類 (Classification)**：依據文獻主題將館藏分門別類的系統化做法，例如**杜威十進分類法** (Dewey Decimal Classification, DDC) 將知識劃分為十大類，以數字表示[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E5%8D%81%E9%80%B2%E5%88%86%E9%A1%9E%E6%B3%95&search=%E5%8D%81%E9%80%B2%E5%88%86%E9%A1%9E%E6%B3%95#:~:text=%E6%BC%A2%E8%AA%9E%E6%8B%BC%E9%9F%B3%EF%BC%9A%20sh%C3%AD%20j%C3%ACn%20f%C4%93n%20l%C3%A8i,46%E7%A8%B1%20%2048%E3%80%8C%E6%9D%9C%E5%A8%81%20%2049%E3%80%8D%E3%80%82)。_同義_: 圖書分類、主題分類；_誤用_: 被當作館藏排序的唯一方式（事實上也可按作者或類型排列，小型館藏可彈性處理）。
*   **索書號 (Call Number)**：貼在書背用于排架的代碼，通常由分類號+作者代號等組成，用於定位館藏的位置。_同義_: 索書碼、架位號；_誤用_: 混稱為ISBN（ISBN是國際書號，不等同館內索書號）。
*   **ISBN (International Standard Book Number)**：國際標準書號，識別單一本圖書的13位（舊版10位）編碼。常用於圖書館採購與編目，可用來快速比對或匯入書目資料。_同義_: 國際書號；_誤用_: 視為條碼號（ISBN可轉換為條碼但概念不同）。
*   **MARC 編目格式 (MARC – Machine Readable Cataloging)**：圖書館書目記錄的機讀格式標準，以特定欄位標識書目資料，以便電腦存取與交換[zh.wikipedia.org](https://zh.wikipedia.org/zh-hant/%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E6%A8%99%E6%BA%96#:~:text=%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E6%A8%99%E6%BA%96%EF%BC%88%E8%8B%B1%E8%AA%9E%20%EF%BC%9AMA%20chine,ataloging%EF%BC%8C%E7%B8%AE%E5%AF%AB%EF%BC%9AMARC%EF%BC%89%EF%BC%8C%E6%98%AF%E4%B8%80%E7%A8%AE%E5%9C%96%E6%9B%B8%E7%AE%A1%E7%90%86%E7%9A%84%E9%80%9A%E8%A8%8A%E6%A0%BC%E5%BC%8F%E6%A8%99%E6%BA%96%EF%BC%8C%E7%94%A8%E4%BB%A5%E8%AE%93%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%88%96%E5%87%BA%20%E7%89%88%E5%95%86%E4%B9%8B%E9%96%93%E4%BD%9C%2075%E8%A8%8A%E6%81%AF%E4%BA%A4%E6%8F%9B%E7%94%A8%E9%80%94%E3%80%82MARC%E6%A8%99%E6%BA%96%E6%B2%BF%E6%96%BC%E7%BE%8E%E5%9C%8B%E5%9C%8B%E6%9C%83%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%96%BC1970%E5%B9%B4%E4%BB%A3%E9%96%8B%E7%99%BC%E7%9A%84%E7%9B%AE%E9%8C%84%E6%A0%BC%E5%BC%8F%E3%80%82%E9%9B%96%E7%84%B6%E8%AA%AA%E6%98%AF%E6%A8%99%E6%BA%96%EF%BC%8C%E4%BD%86%E5%85%B6%E5%AF%A6MARC%E6%98%AF%E5%90%84%E5%9C%8B%E7%9A%84%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E6%A8%99%E6%BA%96%20%E7%9A%84%E4%B8%80%E5%80%8B%E5%A4%A7%E9%9B%86%E5%90%88%EF%BC%8C%E6%AF%8F%E5%80%8B%E5%9C%8B%E5%AE%B6%E4%BE%9D%E7%84%B6%E6%9C%89%E8%87%AA%E5%B7%B1%E7%9A%84%E6%A0%BC%E5%BC%8F%E6%A8%99%E6%BA%96%E3%80%82)。_同義_: MARC21、機讀目錄格式；_誤用_: 認為是軟體系統（其實是資料格式標準）。
*   **流通 (Circulation)**：館藏借出與歸還的過程，包括借閱登記、歸還、續借、預約等服務。_同義_: 借還、外借服務；_誤用_: 僅指借書（其實也包含還書和館內流轉）。
*   **館藏發展政策 (Collection Development Policy)**：圖書館為指導選書、採購、評鑑與淘汰而制定的方針[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E4%B9%8B%E9%81%B8%E6%93%87%E5%8F%8A%E6%8E%A1%E8%A8%AA%EF%BC%8C%E6%87%89%E7%AC%A6%E5%90%88%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%AD%E7%BD%AE%E7%9B%AE%E7%9A%84%EF%BC%8C%E4%B8%A6%E9%85%8D%E5%90%88%E7%A4%BE%E5%8D%80%E7%92%B0%E5%A2%83)[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95&search=%E9%A4%A8#:~:text=%E5%90%8D%E8%A9%9E%E8%A7%A3%E9%87%8B%EF%BC%9A%20%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E4%BF%82%E6%8C%87%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9C%89%E7%B3%BB%E7%B5%B1%E3%80%81%E6%9C%89%E8%A8%88%E7%95%AB%E5%9C%B0%E4%BE%9D%E6%93%9A%E6%97%A2%E5%AE%9A%E6%94%BF%E7%AD%96%E5%BB%BA%E7%AB%8B%E9%A4%A8%E8%97%8F%EF%BC%8C%E4%B8%A6%E4%B8%94%E8%A9%95%E9%91%91%E9%A4%A8%E8%97%8F%EF%BC%8C%E5%88%86%E6%9E%90%E9%A4%A8%E8%97%8F%E5%BC%B7%E5%BC%B1%EF%BC%8C%E6%8E%A2%E8%A8%8E%E8%AE%80%E8%80%85%E4%BD%BF%E7%94%A8%E9%A4%A8%E8%97%8F%E6%83%85%E5%BD%A2%EF%BC%8C%E4%BB%A5%E7%A2%BA%E5%AE%9A%E8%83%BD%E5%A4%A0%E5%88%A9%E7%94%A8%E9%A4%A8%E5%85%A7%E5%8F%8A%E9%A4%A8%E5%A4%96%E8%B3%87%E6%BA%90%E4%BE%86%E6%BB%BF%E8%B6%B3%E8%AE%80%E8%80%85%E8%B3%87%E8%A8%8A%E9%9C%80%E6%B1%82%E7%9A%84%E4%B8%80%E7%A8%AE%E9%81%8E%20%E7%A8%8B%E3%80%82%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E7%9A%84%E5%85%A7%E5%AE%B9%E5%8C%85%E6%8B%AC%EF%BC%9A%E7%A4%BE%E5%8D%80%E5%88%86%E6%9E%90%E3%80%81%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%94%BF%E7%AD%96%E4%B9%8B%E8%A8%82%E5%AE%9A%E3%80%81%E9%81%B8%E6%93%87%E3%80%81%E6%8E%A1%E8%A8%AA%E3%80%81%E9%A4%A8%E8%97%8F%E8%A9%95%E9%91%91%E3%80%81%E9%A4%A8%E8%97%8F%E6%B7%98%E6%B1%B0%E7%AD%89%E6%B4%BB%E5%8B%95%E3%80%82%E8%8C%B2%E5%B0%87%E5%90%84%E9%A0%85%E6%B4%BB%E5%8B%95%E8%AA%AA%E6%98%8E%E5%A6%82%E4%B8%8B%EF%BC%9A%20%E4%BB%BB%E4%BD%95%E4%B8%80%E5%80%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%83%BD%E4%BB%A5%E6%BB%BF%E8%B6%B3%E8%AE%80%E8%80%85%E9%9C%80%E6%B1%82%E7%82%BA%E7%9B%AE%E7%9A%84%EF%BC%8C%E6%89%80%E4%BB%A5%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A6%96%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E6%9C%8D%E5%8B%99%E4%B9%8B%E7%A4%BE%E5%8D%80%E5%8F%8A%E7%A4%BE%E5%8D%80%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%E3%80%82%E5%8D%B3%E4%BD%BF%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E9%A1%9E%E5%9E%8B%E7%9B%B8%E5%90%8C%EF%BC%8C%E7%A4%BE%E5%8D%80%E7%9A%84%E8%A6%8F%E6%A8%A1%E4%B9%9F%E7%9B%B8%E7%95%B6%EF%BC%8C%E4%BD%86%E7%A4%BE%E5%8D%80%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%E5%8F%AF%E8%83%BD%E6%9C%89%E7%9B%B8%E7%95%B6%E5%A4%A7%E7%9A%84%E5%B7%AE%20%E7%95%B0%E3%80%82%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%B8%8D%E5%83%85%E8%A6%81%E4%BA%86%E8%A7%A3%E7%8F%BE%E6%9C%89%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%EF%BC%8C%E4%B9%9F%E8%A6%81%E8%A8%AD%E6%B3%95%E4%BA%86%E8%A7%A3%E6%BD%9B%E5%9C%A8%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%E3%80%82,%E9%80%8F%E9%81%8E%E7%A4%BE%E5%8D%80%E5%88%86%E6%9E%90%E6%8E%8C%E6%8F%A1%E7%A4%BE%E5%8D%80%E7%9A%84%E9%9C%80%E6%B1%82%EF%BC%8C%E9%85%8D%E5%90%88%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E7%9B%AE%E7%9A%84%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%82%E5%AE%9A%E9%81%B8%E6%9B%B8%E6%94%BF%E7%AD%96%EF%BC%8C%E4%BB%A5%E4%BE%BF%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%83%BD%E5%A4%A0%E4%BE%9D%E6%93%9A%E5%9B%BA%E5%AE%9A%E7%9A%84%E6%94%BF%E7%AD%96%E8%88%87%E5%8E%9F%E5%89%87%E4%BE%86%E5%BE%9E%E4%BA%8B%E9%81%B8%E6%9B%B8%E5%B7%A5%E4%BD%9C%E3%80%82%E7%B6%93%E9%81%8E%E9%81%B8%E6%93%87%E7%9A%84%E5%9C%96%E6%9B%B8%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%88%A9%E7%94%A8%E6%9C%80%E6%9C%89%E6%95%88%E7%9A%84%E6%96%B9%E6%B3%95%EF%BC%8C%E4%BB%A5%E8%A8%82%20%E8%B3%BC%E3%80%81%E8%B4%88%E9%80%81%E6%88%96%E4%BA%A4%E6%8F%9B%E7%9A%84%E6%96%B9%E5%BC%8F%EF%BC%8C%E5%B0%87%E4%B9%8B%E8%92%90%E9%9B%86%E5%88%B0%E9%A4%A8%E3%80%82%E5%9C%96%E6%9B%B8%E5%88%B0%E9%A4%A8%E4%B9%8B%E5%BE%8C%EF%BC%8C%E5%BF%85%E9%A0%88%E7%B6%93%E9%81%8E%E5%88%86%E9%A1%9E%E3%80%81%E7%B7%A8%E7%9B%AE%E7%AD%89%E6%95%B4%E7%90%86%E5%B7%A5%E4%BD%9C%EF%BC%8C%E6%89%8D%E8%83%BD%E4%BE%9B%E8%AE%80%E8%80%85%E5%88%A9%E7%94%A8%E3%80%82%E7%82%BA%E4%BA%86%E4%BF%9D%E6%8C%81%E9%A4%A8%E8%97%8F%E7%9A%84%E6%B4%BB%E5%8A%9B%EF%BC%8C%E4%BD%BF%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9C%89%E6%9B%B4%E5%A4%9A%E7%9A%84%E7%A9%BA%E9%96%93%E4%BE%86%E5%AE%B9%E7%B4%8D%E6%96%B0%E7%9A%84%E9%A4%A8%E8%97%8F%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%BF%85%20%E9%A0%88%E5%B0%87%E7%BD%95%E7%94%A8%E3%80%81%E4%B8%8D%E5%86%8D%E8%A2%AB%E4%BD%BF%E7%94%A8%E6%88%96%E4%B8%8D%E5%A0%AA%E4%BD%BF%E7%94%A8%E7%9A%84%E5%9C%96%E6%9B%B8%EF%BC%8C%E4%BA%88%E4%BB%A5%E6%B7%98%E6%B1%B0%EF%BC%88%E8%A8%BB%E9%8A%B7%E6%88%96%E7%A7%BB%E6%9E%B6%EF%BC%89%E3%80%82%E5%90%8C%E6%99%82%EF%BC%8C%E7%82%BA%E4%BA%86%E8%A7%A3%E9%A4%A8%E8%97%8F%E5%BC%B7%E5%BC%B1%EF%BC%8C%E5%88%86%E6%9E%90%E9%A4%A8%E8%97%8F%E4%BD%BF%E7%94%A8%E6%83%85%E5%BD%A2%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A6%81%E9%80%B2%E8%A1%8C%E9%A4%A8%E8%97%8F%E8%A9%95%E9%91%91%EF%BC%8C%E6%89%BE%E5%87%BA%E9%A4%A8%E8%97%8F%E7%BC%BA%E5%A4%B1%E3%80%82%E8%A9%95%E9%91%91%E7%9A%84%E7%B5%90%E6%9E%9C%E5%8F%AF%E4%BB%A5%E5%8D%94%E5%8A%A9%E5%9C%96%E6%9B%B8%20%E9%A4%A8%E5%86%8D%E6%AC%A1%E5%9C%B0%E4%BA%86%E8%A7%A3%E7%A4%BE%E5%8D%80%E7%9A%84%E9%9C%80%E6%B1%82%EF%BC%8C%E4%B8%A6%E8%97%89%E4%BB%A5%E4%BF%AE%E6%AD%A3%E9%81%B8%E6%9B%B8%E6%94%BF%E7%AD%96%E3%80%82%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%98%AF%E4%B8%80%E7%A8%AE%E8%A6%8F%E7%95%AB%E7%9A%84%E9%81%8E%E7%A8%8B%EF%BC%8C%E6%AF%8F%E4%B8%80%E5%80%8B%E7%92%B0%E7%AF%80%E9%83%BD%E6%9C%83%E4%BA%92%E7%9B%B8%E5%BD%B1%E9%9F%BF%EF%BC%8C%E5%BD%BC%E6%AD%A4%E4%BA%92%E5%8B%95%E3%80%82)。確保館藏建設有計畫進行、滿足讀者需求。_同義_: 選書政策、採訪政策；_常見誤用_: 混同於採購清單（實際上政策涵蓋分析需求、制定標準，不只是列書單）。※注意：館藏發展常與「選擇(選書)」及「採訪(採購)」混淆，實則為不同層次的概念[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95&search=%E9%A4%A8#:~:text=%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%9C%89%E6%99%82%E6%9C%83%E8%88%87%E5%9C%96%E6%9B%B8%E9%81%B8%E6%93%87%E5%8F%8A%E5%9C%96%E6%9B%B8%E6%8E%A1%E8%A8%AA%E6%B7%B7%E7%82%BA%E4%B8%80%E8%AB%87%EF%BC%8C%E9%80%99%E4%B8%89%E8%80%85%E5%9C%A8%E5%B1%A4%E6%AC%A1%E4%B8%8A%E6%98%AF%E6%9C%89%E5%B7%AE%E7%95%B0%E7%9A%84%E3%80%82%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%98%AF%E6%9C%80%E4%B8%8A%E4%B8%80%E5%B1%A4%EF%BC%8C%E5%85%B7%E6%9C%89%E8%A6%8F%E7%95%AB%E7%9A%84%E5%8A%9F%E8%83%BD%E3%80%82%E5%BE%9E%E6%97%A2%E5%AE%9A%E7%9A%84%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E8%A8%88%E7%95%AB%E4%BE%86%E6%B1%BA%E5%AE%9A%E9%82%A3%E4%BA%9B%E8%B3%87%E6%96%99%E6%87%89%E7%B4%8D%E5%85%A5%E9%A4%A8%E8%97%8F%E6%88%96%E6%8E%92%E9%99%A4%E6%96%BC%E9%A4%A8%20%E8%97%8F%E4%B9%8B%E5%A4%96%EF%BC%8C%E6%AD%A4%E5%8D%B3%E7%AC%AC%E4%BA%8C%E5%B1%A4%E6%AC%A1%E9%81%B8%E6%93%87%E7%9A%84%E5%8A%9F%E8%83%BD%E3%80%82%E6%8E%A1%E8%A8%AA%E5%89%87%E6%98%AF%E5%86%8D%E6%AC%A1%E4%B8%80%E5%B1%A4%EF%BC%8C%E6%98%AF%E5%9F%B7%E8%A1%8C%E9%81%B8%E6%93%87%E4%B9%8B%E6%B1%BA%E7%AD%96%E4%BB%A5%E5%8F%8A%E5%9F%B7%E8%A1%8C%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E8%A8%88%E7%95%AB%E7%9A%84%E9%81%8E%E7%A8%8B%E3%80%82%20%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%20%2019%E6%8C%87,76%E7%9B%AE%E7%9A%84%20%EF%BC%8C%2078%EF%BC%8C%2021)。
*   **館藏淘汰 (Weeding/Deaccession)**：定期將館藏中不再適宜保存的資料移出館藏（又稱除藏、剔除），如多年無人借閱或內容陳舊的書籍，以保持館藏新鮮度和空間[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E5%9F%BA%E6%BA%96%EF%BC%8C%E8%A6%8F%E5%AE%9A%E5%A6%82%E9%99%84%E8%A1%A8%E4%BA%8C%E3%80%82)[gaya.org.tw](https://www.gaya.org.tw/journal/m33/33-manage.htm#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A1%8C%E6%94%BF%E6%B3%95%E5%80%8B%E6%A1%88%EF%BC%9A%20%E5%9C%96%E6%9B%B8%E8%B3%87%E6%96%99%E5%A0%B1%E5%BB%A2%E4%B9%8B%E6%AE%98%E5%80%BC%E5%95%8F%E9%A1%8C%20%E3%80%94%E6%A1%88%E7%94%B1%E3%80%95%EF%BC%9A%E6%B0%91%E5%9C%8B%E4%B9%9D%E5%8D%81%E5%B9%B4%E4%B8%80%E6%9C%88%E5%8D%81%E4%B9%9D%E6%97%A5%E6%96%BD%E8%A1%8C%E4%B9%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%B3%95%EF%BC%8C%E5%85%B6%E4%B8%AD%E7%AC%AC%E5%8D%81%E5%9B%9B%E6%A2%9D%E8%A6%8F%E5%AE%9A%EF%BC%9A%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%A6%82%E5%9B%A0%E9%A4%A8%E8%97%8F%E6%AF%80%E6%90%8D%E6%BB%85%E5%A4%B1%E3%80%81%E5%96%AA%E5%A4%B1%E4%BF%9D%E5%AD%98%E5%83%B9%E5%80%BC%E6%88%96%E4%B8%8D%E5%A0%AA%E4%BD%BF%E7%94%A8%E8%80%85%EF%BC%8C%E6%AF%8F%E5%B9%B4%E5%9C%A8%E4%B8%8D%E8%B6%85%E9%81%8E%E9%A4%A8%E8%97%8F%E9%87%8F%E7%99%BE%E5%88%86%E4%B9%8B%E4%B8%89%E7%AF%84%E5%9C%8D%E5%85%A7%EF%BC%8C%E5%BE%97%E8%87%AA%E8%A1%8C%E5%A0%B1%E5%BB%A2%E3%80%82%20%E7%8F%BE%E6%9C%89%20)。_同義_: 除藏、汰舊；_誤用_: 認為淘汰書就是銷毀知識（其實是為館藏品質管理，淘汰下架的書仍可依規定處置保存）。
*   **館藏清點 (Inventory Audit)**：核對館藏實體與目錄記錄是否相符的工作，通常定期進行，發現遺失或誤棚的情形並更新記錄[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E5%9F%BA%E6%BA%96%EF%BC%8C%E8%A6%8F%E5%AE%9A%E5%A6%82%E9%99%84%E8%A1%A8%E4%BA%8C%E3%80%82)。_同義_: 清查、盤點；_誤用_: 和館藏評鑑混淆（清點重在數量核對，評鑑則著重內容與使用價值評估）。
*   **讀者 (Patron/User)**：圖書館的服務對象，在中小學環境通常為學生與教師等使用者。_同義_: 借閱人、使用者；_誤用_: “客戶”或“顧客”用於商業語境，在圖書館語境中一般稱讀者或使用者。

**本章關鍵搜尋詞（中英）**：館藏 Collection、圖書館目錄 Library Catalog、OPAC 線上目錄、編目 Cataloging、分類 Classification、杜威十進分類 Dewey Decimal、索書號 Call Number、ISBN 國際標準書號、MARC 機讀編目、流通 Circulation、館藏發展 Collection Development、淘汰 除藏 Weeding、清點 Inventory Audit、讀者 使用者 Patron、圖書館管理系統 Library System。

2\. 關鍵理論與必讀脈絡
-------------

*   **圖書館學五律 (Five Laws of Library Science)** – 由印度圖書館學者阮甘納桑（S. R. Ranganathan）於1931年提出的五項經典法則，包括：「書是要能用的、每位讀者有其書、每本書有其讀者、節省讀者時間、圖書館是成長中的有機體」[zh.wikipedia.org](https://zh.wikipedia.org/zh-hant/%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%BA%94%E5%BE%8B#:~:text=1,%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%98%AF%E4%B8%80%E6%88%90%E9%95%B7%E4%B8%AD%E6%9C%89%E6%A9%9F%E9%AB%94%EF%BC%88Library%20is%20a%20growing%20organism%EF%BC%89%EF%BC%9A%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%BF%8E%E5%90%88%E8%91%97%E6%99%82%E4%BB%A3%E7%99%BC%E5%B1%95%EF%BC%8C%E8%88%87%E6%99%82%E4%BF%B1%E9%80%B2%E3%80%82)。這五律奠定了以讀者為中心的圖書館服務理念：強調館藏存在意義在於利用、圖書館服務應兼顧普及與效率，並隨時代成長變化。即使在今日資訊時代，五律仍指引著學校圖書館將重心放在讀者需求、有效利用館藏以及館務持續發展上。
*   **IFLA/UNESCO《學校圖書館宣言》** – 由國際圖書館協會聯盟(IFLA)與聯合國教科文組織(UNESCO)於1999年發布，2025年更新[ifla.org](https://www.ifla.org/ifla-unesco-school-library-manifesto-2025/#:~:text=The%20IFLA,library%20in%20teaching%20and)。“學校圖書館在為全民的教與學服務”是其宗旨，宣言明確了學校圖書館在教育中的使命：為所有學生提供平等的資訊獲取機會，支援教學與終身學習，並與公共圖書館及資訊網絡合作[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/mao/works/slmanifesto.htm#:~:text=%E6%A0%B9%E6%93%9A%E9%81%8E%E5%8E%BB%E7%9A%84%E7%B6%93%E9%A9%97%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%88%87%E6%95%99%E5%B8%AB%E4%B8%80%E8%B5%B7%E5%B7%A5%E4%BD%9C%E6%99%82%EF%BC%8C%E5%AD%B8%E7%94%9F%E9%81%94%E6%88%90%E8%BC%83%E9%AB%98%E5%B1%A4%E6%AC%A1%E7%9A%84%E7%B4%A0%E9%A4%8A%E3%80%81%E9%96%B1%E8%AE%80%E3%80%81%E5%AD%B8%E7%BF%92%E3%80%81%E8%A7%A3%E6%B1%BA%E5%95%8F%E9%A1%8C%E5%8F%8A%E8%B3%87%E8%A8%8A%E5%92%8C%E9%80%9A%E8%A8%8A%E7%A7%91%E6%8A%80%E7%9A%84%E8%83%BD%E5%8A%9B%E3%80%82)。此宣言重要在於獲全球認可，敦促政府及學校重視圖書館建設及專業人力，以提升教育品質。它為學校圖書館工作的價值與方向提供了權威背書。
*   **《IFLA 學校圖書館指南》（2015 年第2版）** – IFLA學校圖書館組發布的專業報告[repository.ifla.org](https://repository.ifla.org/items/e61cb0b6-8d19-45e8-9be1-24b45309464e/full#:~:text=dc,debate%2C%20and%20consultation%20with%20many)。該指南對學校圖書館的使命、館藏、服務、人力、設備等提出國際標準建議，協助教育決策者和圖書館員確保**所有學生和教師都能獲得高效的學校圖書館計劃與服務，由合格人員提供**[repository.ifla.org](https://repository.ifla.org/items/e61cb0b6-8d19-45e8-9be1-24b45309464e/full#:~:text=edition%20of%20the%20school%20library,year)。指南內容包含：學校圖書館的願景目標、館藏發展與組織、閱讀與資訊素養教育、空間與設施規劃、評估與改進等。此指南被視為全球各國（包括臺灣）制定學校圖書館政策時的重要參考，強調專業館員和完善館藏對學生學習成就的助益。
*   **AASL《全國學校圖書館標準》（2018）** – 美國學校圖書館協會(AASL)頒布的新一代標準，聚焦學習者能力與圖書館計畫的結合。其核心架構包含六大共享基礎（Shared Foundations）：**探究 Inquire、包容 Include、協作 Collaborate、策劃 Curate、探索 Explore、參與 Engage**[elementarylibrarian.com](https://elementarylibrarian.com/breaking-down-the-aasl-national-school-library-standards/#:~:text=Breaking%20Down%20the%20AASL%20National,called%20foundations%20and%20the)。每個面向都有相應的關鍵承諾和能力指標，引導學校圖書館在課程中培養學生的資訊素養、批判思考和創新能力。此標準重要之處在於提供了一套共同語言，讓圖書教師可與學科教師協作，將圖書館融入課程，並強調圖書館在21世紀技能教育中的角色。它反映當今教育對資訊技能與閱讀素養的重視。
*   **資訊素養 (Information Literacy)** – 指個人具備在需要資訊時，能夠有效地**找到、評估並利用**所需資訊的能力webnas.bhes.ntpc.edu.tw。資訊素養被視為現代公民的關鍵素養之一，在數位時代尤為重要。學校圖書館是培養學生資訊素養的主要場域，透過館員指導，學生學會使用檢索工具、辨別資訊真偽、正確引用資料等。資訊素養理論的重要性在於：學生若缺乏這種能力，面對海量資訊將無所適從；相反，具備資訊素養的學生才能成為自主學習者和終身學習者。因此各國教育標準（含臺灣108課綱）都將資訊素養納入核心，學校圖書館則是落實資訊素養教育的樞紐。
*   **閱讀推動教師** – 臺灣中小學近年興起的一種角色（始於2009年），由具圖書資訊或閱讀教育專長的教師兼任，負責推廣閱讀及管理學校圖書館[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E3%80%8C%E6%B2%83%E5%9C%9F%E8%A8%88%E7%95%AB%E3%80%8D%E5%80%9F%E5%8A%A9%E8%AE%80%E8%80%85%E4%B9%8B%E5%8A%9B%20%E7%A4%BE%E5%8D%80%E6%9B%B8%E5%BA%97%E9%99%AA%E5%AD%B8%E7%94%9F%E4%B8%80%E8%B5%B7%E9%95%B7%E5%A4%A7%20%E9%96%B1%E6%8E%A8%E6%95%99%E5%B8%AB%E6%98%AF2009%E5%B9%B4%E6%96%B0%E8%88%88%E7%9A%84%E8%A7%92%E8%89%B2%EF%BC%8C%E6%9B%BE%E5%93%81%E6%96%B9%E8%A7%A3%E9%87%8B%EF%BC%8C%E4%BB%96%E5%80%91%E9%83%BD%E6%8E%A5%E5%8F%97%E9%81%8E%E5%B0%88%E6%A5%AD%E8%A8%93%E7%B7%B4%EF%BC%8C%E5%9C%A8%E5%AD%B8%E6%A0%A1%E8%A6%81%E9%96%8B%E8%A8%AD%E5%B0%88%E9%96%80%E7%9A%84%E9%96%B1%E8%AE%80%E8%AA%B2%EF%BC%8C%20%E5%90%8C%E6%99%82%E8%82%A9%E8%B2%A0%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%AE%A1%E7%90%86%E4%BB%BB%E5%8B%99%E3%80%82%E5%9C%A8%E6%B2%92%E6%9C%89%E9%96%B1%E6%8E%A8%E8%80%81%E5%B8%AB%E7%9A%84%E5%AD%B8%E6%A0%A1%EF%BC%8C%E5%AD%B8%E7%94%9F%E4%B8%8D%E4%BD%86%E7%84%A1%E6%B3%95%E4%B8%8A%E9%96%B1%E8%AE%80%E8%AA%B2%20%E3%80%81%E6%9C%89%E7%B3%BB%E7%B5%B1%E5%AD%B8%E7%BF%92%E9%96%B1%E8%AE%80%E9%80%99%E9%A0%85%E8%83%BD%E5%8A%9B%EF%BC%8C%E6%A0%A1%E5%85%A7%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9B%B4%E5%8F%AF%E8%83%BD%E7%BC%BA%E4%B9%8F%E8%B3%BC%E6%9B%B8%E8%A6%8F%E5%8A%83%EF%BC%8C%E5%8D%B3%E4%BE%BF%E6%94%B6%E5%88%B0%E4%BB%96%E4%BA%BA%E8%B4%88%E6%9B%B8%EF%BC%8C%E4%B9%9F%E5%8F%AF%E8%83%BD%E5%9B%A0%E6%AC%A0%E7%BC%BA%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E7%9F%A5%E8%AD%98%EF%BC%8C%E7%84%A1%E6%B3%95%E5%B0%87%E8%B4%88%E6%9B%B8%E5%88%86%E9%96%80%E5%88%A5%E9%A1%9E%E4%B8%8A%E6%9E%B6%E3%80%82)。閱推教師的重要性在於彌補學校缺乏專任館員的現實：他們開設閱讀課程、培養學生閱讀習慣，並肩負圖書館日常管理工作[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E3%80%8C%E6%B2%83%E5%9C%9F%E8%A8%88%E7%95%AB%E3%80%8D%E5%80%9F%E5%8A%A9%E8%AE%80%E8%80%85%E4%B9%8B%E5%8A%9B%20%E7%A4%BE%E5%8D%80%E6%9B%B8%E5%BA%97%E9%99%AA%E5%AD%B8%E7%94%9F%E4%B8%80%E8%B5%B7%E9%95%B7%E5%A4%A7%20%E9%96%B1%E6%8E%A8%E6%95%99%E5%B8%AB%E6%98%AF2009%E5%B9%B4%E6%96%B0%E8%88%88%E7%9A%84%E8%A7%92%E8%89%B2%EF%BC%8C%E6%9B%BE%E5%93%81%E6%96%B9%E8%A7%A3%E9%87%8B%EF%BC%8C%E4%BB%96%E5%80%91%E9%83%BD%E6%8E%A5%E5%8F%97%E9%81%8E%E5%B0%88%E6%A5%AD%E8%A8%93%E7%B7%B4%EF%BC%8C%E5%9C%A8%E5%AD%B8%E6%A0%A1%E8%A6%81%E9%96%8B%E8%A8%AD%E5%B0%88%E9%96%80%E7%9A%84%E9%96%B1%E8%AE%80%E8%AA%B2%EF%BC%8C%20%E5%90%8C%E6%99%82%E8%82%A9%E8%B2%A0%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%AE%A1%E7%90%86%E4%BB%BB%E5%8B%99%E3%80%82%E5%9C%A8%E6%B2%92%E6%9C%89%E9%96%B1%E6%8E%A8%E8%80%81%E5%B8%AB%E7%9A%84%E5%AD%B8%E6%A0%A1%EF%BC%8C%E5%AD%B8%E7%94%9F%E4%B8%8D%E4%BD%86%E7%84%A1%E6%B3%95%E4%B8%8A%E9%96%B1%E8%AE%80%E8%AA%B2%20%E3%80%81%E6%9C%89%E7%B3%BB%E7%B5%B1%E5%AD%B8%E7%BF%92%E9%96%B1%E8%AE%80%E9%80%99%E9%A0%85%E8%83%BD%E5%8A%9B%EF%BC%8C%E6%A0%A1%E5%85%A7%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9B%B4%E5%8F%AF%E8%83%BD%E7%BC%BA%E4%B9%8F%E8%B3%BC%E6%9B%B8%E8%A6%8F%E5%8A%83%EF%BC%8C%E5%8D%B3%E4%BE%BF%E6%94%B6%E5%88%B0%E4%BB%96%E4%BA%BA%E8%B4%88%E6%9B%B8%EF%BC%8C%E4%B9%9F%E5%8F%AF%E8%83%BD%E5%9B%A0%E6%AC%A0%E7%BC%BA%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E7%9F%A5%E8%AD%98%EF%BC%8C%E7%84%A1%E6%B3%95%E5%B0%87%E8%B4%88%E6%9B%B8%E5%88%86%E9%96%80%E5%88%A5%E9%A1%9E%E4%B8%8A%E6%9E%B6%E3%80%82)。研究與觀察顯示，有閱推教師的學校，學生閱讀素養與圖書館利用率明顯提升；反之，**沒有閱推老師的學校，常見問題包括：沒有系統的購書計畫，收到贈書也因缺乏專業知識無法分類上架**[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E3%80%8C%E6%B2%83%E5%9C%9F%E8%A8%88%E7%95%AB%E3%80%8D%E5%80%9F%E5%8A%A9%E8%AE%80%E8%80%85%E4%B9%8B%E5%8A%9B%20%E7%A4%BE%E5%8D%80%E6%9B%B8%E5%BA%97%E9%99%AA%E5%AD%B8%E7%94%9F%E4%B8%80%E8%B5%B7%E9%95%B7%E5%A4%A7%20%E9%96%B1%E6%8E%A8%E6%95%99%E5%B8%AB%E6%98%AF2009%E5%B9%B4%E6%96%B0%E8%88%88%E7%9A%84%E8%A7%92%E8%89%B2%EF%BC%8C%E6%9B%BE%E5%93%81%E6%96%B9%E8%A7%A3%E9%87%8B%EF%BC%8C%E4%BB%96%E5%80%91%E9%83%BD%E6%8E%A5%E5%8F%97%E9%81%8E%E5%B0%88%E6%A5%AD%E8%A8%93%E7%B7%B4%EF%BC%8C%E5%9C%A8%E5%AD%B8%E6%A0%A1%E8%A6%81%E9%96%8B%E8%A8%AD%E5%B0%88%E9%96%80%E7%9A%84%E9%96%B1%E8%AE%80%E8%AA%B2%EF%BC%8C%20%E5%90%8C%E6%99%82%E8%82%A9%E8%B2%A0%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%AE%A1%E7%90%86%E4%BB%BB%E5%8B%99%E3%80%82%E5%9C%A8%E6%B2%92%E6%9C%89%E9%96%B1%E6%8E%A8%E8%80%81%E5%B8%AB%E7%9A%84%E5%AD%B8%E6%A0%A1%EF%BC%8C%E5%AD%B8%E7%94%9F%E4%B8%8D%E4%BD%86%E7%84%A1%E6%B3%95%E4%B8%8A%E9%96%B1%E8%AE%80%E8%AA%B2%20%E3%80%81%E6%9C%89%E7%B3%BB%E7%B5%B1%E5%AD%B8%E7%BF%92%E9%96%B1%E8%AE%80%E9%80%99%E9%A0%85%E8%83%BD%E5%8A%9B%EF%BC%8C%E6%A0%A1%E5%85%A7%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9B%B4%E5%8F%AF%E8%83%BD%E7%BC%BA%E4%B9%8F%E8%B3%BC%E6%9B%B8%E8%A6%8F%E5%8A%83%EF%BC%8C%E5%8D%B3%E4%BE%BF%E6%94%B6%E5%88%B0%E4%BB%96%E4%BA%BA%E8%B4%88%E6%9B%B8%EF%BC%8C%E4%B9%9F%E5%8F%AF%E8%83%BD%E5%9B%A0%E6%AC%A0%E7%BC%BA%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E7%9F%A5%E8%AD%98%EF%BC%8C%E7%84%A1%E6%B3%95%E5%B0%87%E8%B4%88%E6%9B%B8%E5%88%86%E9%96%80%E5%88%A5%E9%A1%9E%E4%B8%8A%E6%9E%B6%E3%80%82)。因此閱讀推動教師制度被視為圖書館法規未臨時到位前的替代方案，中華民國圖書館學會等團體並呼籲將其納入正式編制[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%AD%B8%E6%9C%83%E4%BB%8A%E5%A4%A9%E5%9C%A8%E8%A8%98%E8%80%85%E6%9C%83%E6%8F%90%E5%87%BA%E5%85%A9%E5%A4%A7%E8%A8%B4%E6%B1%82%EF%BC%9A)。對中小學而言，這強調了即便沒有專職館員，也需要由專業人員來主導閱讀與館藏管理，才能充分發揮圖書館支持教育的功能。
*   **108課綱與素養教育脈絡** – 中華民國108年（2019）起實施的新課程綱要，強調素養導向學習及閱讀理解能力在各科的重要性。國中會考更重視學生的閱讀素養表現[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=)。這一脈絡凸顯學校圖書館的重要：圖書館是培養閱讀素養與自學能力的基地。然而現狀是多數中小學缺乏專職圖書教師（僅17%學校有閱讀推動教師[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E6%AF%8F3C%E8%A1%9D%E6%93%8A%E5%AD%B8%E7%94%9F%E9%96%B1%E8%AE%80%E5%8B%95%E6%A9%9F%EF%BC%8C%E5%81%8F%E5%81%8F108%E8%AA%B2%E7%B6%B1%E4%B8%8A%E8%B7%AF%E5%BE%8C%EF%BC%8C%E5%9C%8B%E4%B8%AD%E6%9C%83%E8%80%83%E5%90%84%E7%A7%91%E9%83%BD%E6%9B%B4%E9%87%8D%E8%A6%96%E9%96%B1%E8%AE%80%E3%80%82%E4%BD%86%E5%85%A8%E5%8F%B0%E5%83%8517%EF%BC%85%E6%89%80%E5%9C%8B%E4%B8%AD%E5%B0%8F%EF%BC%88%E5%85%B1576%E6%A0%A1%EF%BC%89%E6%9C%89%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%EF%BC%8C%E8%83%BD%E9%96%8B%E8%A8%AD%E5%B0%88%E9%96%80%E9%96%B1%E8%AE%80%E8%AA%B2%EF%BC%8C%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%AD%B8%E6%9C%83%20%E4%BB%8A%EF%BC%8818%EF%BC%89%E6%97%A5%E8%88%89%E8%A1%8C%E8%A8%98%E8%80%85%E6%9C%83%E5%91%BC%E7%B1%B2%E6%94%BF%E5%BA%9C%E6%AD%A3%E8%A6%96%E6%AD%A4%E4%BA%8B%EF%BC%8C%E5%8F%8A%E6%97%A9%E8%90%BD%E5%AF%A6%E3%80%8C%E6%A0%A1%E6%A0%A1%E6%9C%89%E9%96%B1%E6%8E%A8%E5%B8%AB%E3%80%8D%EF%BC%8C%E6%8F%90%E5%8D%87%E9%96%B1%E8%AE%80%E6%95%99%E8%82%B2%E5%93%81%E8%B3%AA%E3%80%82)），形成課綱理念與執行資源間的落差。因此教育部近年推動「校校有閱讀推動教師」等政策[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%AD%B8%E6%9C%83%E4%BB%8A%E5%A4%A9%E5%9C%A8%E8%A8%98%E8%80%85%E6%9C%83%E6%8F%90%E5%87%BA%E5%85%A9%E5%A4%A7%E8%A8%B4%E6%B1%82%EF%BC%9A)來回應108課綱的需求。同時，108課綱下強調跨領域學習、探究與實作，學校圖書館需要提供多元館藏與學習空間來支援。例如，教師可能帶學生來圖書館進行專題探究、檢索資料；圖書館也需配合新課綱辦理閱讀指導課程或主題書展。總之，在108課綱素養教育的脈絡下，**學校無專職館員**的困境更加凸顯，圖書館如何簡化管理、發揮功能來支撐課程，就成為迫切的課題。

**本章關鍵搜尋詞（中英）**：圖書館學五律 Five Laws of Library Science、Ranganathan 五定律、IFLA 學校圖書館宣言 Manifesto、學校圖書館指南 School Library Guidelines、AASL 標準 School Library Standards、資訊素養 Information Literacy、108課綱 閱讀教育 New Curriculum reading literacy、閱讀推動教師 reading promotion teacher、終身學習 lifelong learning、IFLA 教育部 圖書館政策 library policy、素養導向 素養教育 competency literacy education、跨領域 閱讀理解 cross-curricular reading、學校圖書館 角色 role of school library、學生閱讀習慣 student reading habits。

3\. 標準/規範/權威資源
--------------

*   **臺灣教育部：《圖書館設立及營運標準》**（105年發布，110年修正，即 2016 年發布/2021 年修訂） – _國家法規_。規範各類圖書館（含中小學圖書館）的人員編制、經費、館藏量等最低要求。例如規定**國中小圖書館應至少有一名圖書館專業人員**，專業人力占館務人員比例至少三分之一[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%87%89%E7%BD%AE%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E4%BA%BA%E5%93%A1%E8%87%B3%E5%B0%91%E4%B8%80%E4%BA%BA%EF%BC%8C%E4%B8%94%E5%8D%A0%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B7%A5%E4%BD%9C%E4%BA%BA%E5%93%A1%E4%B9%8B%E6%AF%94%E7%8E%87%E5%A6%82%E4%B8%8B%EF%BC%9A%20%E4%B8%80%E3%80%81%E5%9C%8B%E5%AE%B6%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E5%9B%9B%E5%88%86%E4%B9%8B%E4%B8%89%E3%80%82%20%E4%BA%8C%E3%80%81%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82%20%E4%B8%89%E3%80%81%E5%A4%A7%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%BA%8C%E3%80%82%20%E5%9B%9B%E3%80%81%E5%B0%88%E7%A7%91%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%BA%8C%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82,%E4%BA%94%E3%80%81%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82%20%E5%85%AD%E3%80%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82%20%E4%B8%83%E3%80%81%E5%B0%88%E9%96%80%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E5%9B%9B%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82)；以及國中小圖書館每年圖書資訊採購經費宜達教學設備費10%以上[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E4%BA%94%E3%80%81%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%20,%E5%89%8D%E9%A0%85%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B9%B4%E5%BA%A6%E9%A0%90%E7%AE%97%E5%8C%85%E6%8B%AC%E5%90%84%E9%A0%85%E6%A5%AD%E5%8B%99%E6%94%AF%E5%87%BA%E8%B2%BB%E7%94%A8%E5%8F%8A%E8%B2%A1%E7%94%A2%E8%B3%BC%E7%BD%AE%E8%B2%BB%E7%94%A8%E3%80%82%E4%BD%86%E4%B8%8D%E5%8C%85%20%E6%8B%AC%E4%BA%BA%E4%BA%8B%E8%B2%BB%E5%8F%8A%E6%96%B0%E5%BB%BA%E9%A4%A8%E8%88%8D%E4%B9%8B%E7%B6%93%E8%B2%BB%E3%80%82)。此標準為臺灣校園圖書館設置與評鑑的根本依據。（**參考連結**：教育部法規內容網站)
*   **臺灣《圖書館法》**（民國90年公布施行，即 2001 年） – _國家法規_。建立各級圖書館的法律地位與主管機關責任。其中第五條授權教育部訂定各級學校圖書館設立及營運基準[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%96&search=%E5%9F%BA#:~:text=%E9%81%94%E6%88%90%E5%85%A8%E5%9C%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%BA%8B%E6%A5%AD%E5%90%88%E4%BD%9C%E7%99%BC%E5%B1%95%E7%9A%84%E7%9B%AE%E7%9A%84%EF%BC%8C%E5%9B%A0%E6%AD%A4%E8%87%B3%E7%82%BA%E9%87%8D%E8%A6%81%E3%80%82%E6%A8%99%E6%BA%96%E7%9A%84%E5%88%B6%E5%AE%9A%EF%BC%8C%E5%9D%87%E4%BF%82%E9%9B%86%E5%90%88%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%95%8C%E8%88%87%E6%95%99%E8%82%B2%E7%95%8C%E7%9A%84%E7%B2%BE%E8%8B%B1%EF%BC%8C%E9%9B%86%E6%80%9D%E5%BB%A3%E7%9B%8A%E5%85%B1%E5%90%8C%E7%A0%94%E8%A8%82%EF%BC%8C%E5%8B%99%E6%B1%82%E7%A7%91%E5%AD%B8%E5%90%88%E7%90%86%E3%80%82%E7%94%B1%E6%96%BC%E6%97%A2%E5%AE%9A%E7%9A%84%E6%A8%99%E6%BA%96%E5%9C%A8%E6%99%82%E7%A9%BA%E4%B8%8A%E6%9C%89%E5%85%B6%E9%81%A9%E7%94%A8%E7%9A%84%E9%99%90%E5%BA%A6%20%EF%BC%8C%E8%A6%81%E6%9C%89%E4%B8%8D%E6%96%B7%E7%9A%84%E4%BF%AE%E8%A8%82%E6%A9%9F%E5%88%B6%EF%BC%8C%E5%A7%8B%E8%83%BD%E4%BD%BF%E6%A8%99%E6%BA%96%E7%9A%84%E5%8A%9F%E8%83%BD%E6%8C%81%E7%BA%8C%E6%9C%89%E6%95%88%E7%99%BC%E6%8F%AE%E5%8A%9F%E7%94%A8%E3%80%82%E6%88%91%E5%9C%8B%E3%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%B3%95%E3%80%8D%E6%96%BC2001%E5%B9%B41%E6%9C%88%E7%B6%93%20%E7%B8%BD%E7%B5%B1%E6%98%8E%E4%BB%A4%E5%85%AC%E5%B8%83%E6%96%BD%E8%A1%8C%EF%BC%8C%E4%BE%9D%E8%A9%B2%E6%B3%95%E7%AC%AC%E4%BA%94%E6%A2%9D%E6%95%99%E8%82%B2%E9%83%A8%E6%87%89%E5%88%B6%E5%AE%9A%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E8%A8%AD%E7%AB%8B%E5%8F%8A%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%96%E3%80%82%E6%95%99%20%E8%82%B2%E9%83%A8%E7%88%B0%E5%A7%94%E8%A8%97%E5%9C%8B%E5%AE%B6%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%85%88%E8%A1%8C%E7%A0%94%E6%93%AC%EF%BC%8C%E5%86%8D%E7%94%B1%E6%95%99%E8%82%B2%E9%83%A8%E6%A0%B8%E5%AE%9A%E5%BE%8C%E7%99%BC%E5%B8%83%E3%80%82%E6%95%99%E8%82%B2%E9%83%A8%E5%88%86%E5%88%A5%E5%85%AC%E5%B8%83%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%A4%A7%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%B0%88%E7%A7%91%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E9%AB%98%E7%B4%9A%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E8%81%B7%E6%A5%AD%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%9C%8B%E6%B0%91%E5%B0%8F%20%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%AD%E7%AB%8B%E5%8F%8A%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%967%E7%A8%AE%E3%80%82%E5%90%84%E9%A1%9E%E5%9F%BA%E6%BA%96%E5%85%A7%E5%AE%B9%E8%A6%81%E9%A0%85%EF%BC%8C%E5%A4%A7%E6%8A%B5%E5%8C%85%E6%8B%AC%E7%B8%BD%E5%89%87%E3%80%81%E8%A8%AD%E7%AB%8B%E3%80%81%E7%B5%84%E7%B9%94%E4%BA%BA%E5%93%A1%E3%80%81%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E3%80%81%E9%A4%A8%E8%88%8D%EF%BC%88%E5%BB%BA%E7%AF%89%EF%BC%89%E8%A8%AD%E5%82%99%E3%80%81%E7%87%9F%E9%81%8B%E7%AE%A1%E7%90%86%EF%BC%88%E5%8C%85%E6%8B%AC%EF%BC%9A%E6%9C%8D%E5%8B%99%E8%88%87%E7%AE%A1%E7%90%86%EF%BC%89%E3%80%81%E9%99%84%E5%89%87%E7%AD%89%E9%83%A8%E5%88%86%EF%BC%8C%E7%AB%8B%E4%B8%8B%E6%9C%80%E4%BD%8E%E9%99%90%E5%BA%A6%E6%A8%99,45%E5%85%B6%20%2046%2047%20%E8%82%A9%E8%B2%A0)。圖書館法首條立法宗旨強調：「促進圖書館健全發展，提供完善圖書資訊服務，以推廣教育、提升文化…倡導終身學習」[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%96&search=%E5%9F%BA#:~:text=%E8%B6%8A%E7%B4%9A%E3%80%8D%EF%BC%88excellent%EF%BC%89%E3%80%82%E3%80%8C%E5%9F%BA%E6%9C%AC%E7%B4%9A%E3%80%8D%E7%9A%84%E6%9C%8D%E5%8B%99%E6%98%AF%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9C%80%E5%9F%BA%E6%9C%AC%E7%9A%84%E6%9C%8D%E5%8B%99%EF%BC%8C%E4%B9%9F%E6%98%AF%E6%AF%8F%E5%80%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%83%BD%E8%A6%81%E6%8F%90%E4%BE%9B%E7%9A%84%E6%9C%8D%E5%8B%99%EF%BC%9B%E5%85%B6%E4%BB%96%E7%AD%89%E7%B4%9A%E6%98%AF%E9%81%94%E5%88%B0%E3%80%8C%E5%9F%BA%E6%9C%AC%E7%B4%9A%E3%80%8D%E6%9C%8D%E5%8B%99%E4%B9%8B%E5%BE%8C%EF%BC%8C%E9%80%90%E7%B4%9A%E6%8F%90%E4%BE%9B%E6%AC%A1%E9%AB%98%E3%80%81%E6%9B%B4%E9%AB%98%E6%88%96%E6%9C%80%E9%AB%98%E7%B4%9A%EF%BC%88%20%E6%9C%80%E5%A5%BD%EF%BC%89%E7%9A%84%E6%9C%8D%E5%8B%99%EF%BC%8C%E7%94%A8%E4%BB%A5%E9%BC%93%E5%8B%B5%E6%89%80%E6%9C%89%E7%9A%84%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%83%BD%E6%87%89%E5%90%91%E6%8F%90%E4%BE%9B%E6%9C%80%E9%AB%98%E6%B0%B4%E5%B9%B3%E7%9A%84%E6%9C%8D%E5%8B%99%E6%96%B9%E5%90%91%E8%80%8C%E5%8A%AA%E5%8A%9B%E3%80%82%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%A8%99%E6%BA%96%E7%9A%84%E4%BD%9C%E7%94%A8%E5%9C%A8%E6%8F%90%E4%BE%9B%E5%90%84%E9%A4%A8%E5%8F%83%E7%85%A7%E5%AF%A6%E6%96%BD%EF%BC%8C%E4%BD%9C%E7%82%BA%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B6%93%E7%87%9F%E7%9A%84%E8%A6%8F%E7%AF%84%E5%8F%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A9%95%E4%BC%B0%E5%B7%A5%E4%BD%9C%E6%88%90%E6%95%88%E7%9A%84%E5%B0%BA%E5%BA%A6%EF%BC%8C%E4%B8%A6%E8%97%89%E4%BB%A5%20%E9%81%94%E6%88%90%E5%85%A8%E5%9C%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%BA%8B%E6%A5%AD%E5%90%88%E4%BD%9C%E7%99%BC%E5%B1%95%E7%9A%84%E7%9B%AE%E7%9A%84%EF%BC%8C%E5%9B%A0%E6%AD%A4%E8%87%B3%E7%82%BA%E9%87%8D%E8%A6%81%E3%80%82%E6%A8%99%E6%BA%96%E7%9A%84%E5%88%B6%E5%AE%9A%EF%BC%8C%E5%9D%87%E4%BF%82%E9%9B%86%E5%90%88%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%95%8C%E8%88%87%E6%95%99%E8%82%B2%E7%95%8C%E7%9A%84%E7%B2%BE%E8%8B%B1%EF%BC%8C%E9%9B%86%E6%80%9D%E5%BB%A3%E7%9B%8A%E5%85%B1%E5%90%8C%E7%A0%94%E8%A8%82%EF%BC%8C%E5%8B%99%E6%B1%82%E7%A7%91%E5%AD%B8%E5%90%88%E7%90%86%E3%80%82%E7%94%B1%E6%96%BC%E6%97%A2%E5%AE%9A%E7%9A%84%E6%A8%99%E6%BA%96%E5%9C%A8%E6%99%82%E7%A9%BA%E4%B8%8A%E6%9C%89%E5%85%B6%E9%81%A9%E7%94%A8%E7%9A%84%E9%99%90%E5%BA%A6%20%EF%BC%8C%E8%A6%81%E6%9C%89%E4%B8%8D%E6%96%B7%E7%9A%84%E4%BF%AE%E8%A8%82%E6%A9%9F%E5%88%B6%EF%BC%8C%E5%A7%8B%E8%83%BD%E4%BD%BF%E6%A8%99%E6%BA%96%E7%9A%84%E5%8A%9F%E8%83%BD%E6%8C%81%E7%BA%8C%E6%9C%89%E6%95%88%E7%99%BC%E6%8F%AE%E5%8A%9F%E7%94%A8%E3%80%82%E6%88%91%E5%9C%8B%E3%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%B3%95%E3%80%8D%E6%96%BC2001%E5%B9%B41%E6%9C%88%E7%B6%93%20%E7%B8%BD%E7%B5%B1%E6%98%8E%E4%BB%A4%E5%85%AC%E5%B8%83%E6%96%BD%E8%A1%8C%EF%BC%8C%E4%BE%9D%E8%A9%B2%E6%B3%95%E7%AC%AC%E4%BA%94%E6%A2%9D%E6%95%99%E8%82%B2%E9%83%A8%E6%87%89%E5%88%B6%E5%AE%9A%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E8%A8%AD%E7%AB%8B%E5%8F%8A%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%96%E3%80%82%E6%95%99,%E8%82%B2%E9%83%A8%E7%88%B0%E5%A7%94%E8%A8%97%E5%9C%8B%E5%AE%B6%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%85%88%E8%A1%8C%E7%A0%94%E6%93%AC%EF%BC%8C%E5%86%8D%E7%94%B1%E6%95%99%E8%82%B2%E9%83%A8%E6%A0%B8%E5%AE%9A%E5%BE%8C%E7%99%BC%E5%B8%83%E3%80%82%E6%95%99%E8%82%B2%E9%83%A8%E5%88%86%E5%88%A5%E5%85%AC%E5%B8%83%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%A4%A7%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%B0%88%E7%A7%91%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E9%AB%98%E7%B4%9A%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E8%81%B7%E6%A5%AD%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%9C%8B%E6%B0%91%E5%B0%8F%20%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%AD%E7%AB%8B%E5%8F%8A%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%967%E7%A8%AE%E3%80%82%E5%90%84%E9%A1%9E%E5%9F%BA%E6%BA%96%E5%85%A7%E5%AE%B9%E8%A6%81%E9%A0%85%EF%BC%8C%E5%A4%A7%E6%8A%B5%E5%8C%85%E6%8B%AC%E7%B8%BD%E5%89%87%E3%80%81%E8%A8%AD%E7%AB%8B%E3%80%81%E7%B5%84%E7%B9%94%E4%BA%BA%E5%93%A1%E3%80%81%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E3%80%81%E9%A4%A8%E8%88%8D%EF%BC%88%E5%BB%BA%E7%AF%89%EF%BC%89%E8%A8%AD%E5%82%99%E3%80%81%E7%87%9F%E9%81%8B%E7%AE%A1%E7%90%86%EF%BC%88%E5%8C%85%E6%8B%AC%EF%BC%9A%E6%9C%8D%E5%8B%99%E8%88%87%E7%AE%A1%E7%90%86%EF%BC%89%E3%80%81%E9%99%84%E5%89%87%E7%AD%89%E9%83%A8%E5%88%86%EF%BC%8C%E7%AB%8B%E4%B8%8B%E6%9C%80%E4%BD%8E%E9%99%90%E5%BA%A6%E6%A8%99%20%E6%BA%96%E3%80%82%E5%9F%BA%E6%BA%96%E8%A6%8F%E7%AF%84%E4%BA%86%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%AD%E7%AB%8B%E5%8F%8A%E7%87%9F%E9%81%8B%E7%9A%84%E5%9F%BA%E6%9C%AC%E8%A6%81%E6%B1%82%EF%BC%8C%E5%8F%AF%E4%BD%9C%E7%82%BA%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%A5%AD%E5%8B%99%E7%99%BC%E5%B1%95%E5%8F%8A%E8%A9%95%E9%91%91%E7%9A%84%E5%85%B7%E9%AB%94%E6%8C%87%E6%A8%99%EF%BC%8C%E4%BB%A5%E6%8F%90%E5%8D%87%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E6%9C%8D%E5%8B%99%E5%93%81%E8%B3%AA%EF%BC%8C%E5%8F%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B6%93%E7%87%9F%E7%B8%BE%E6%95%88%E3%80%82%E6%9C%AC%E5%9F%BA%E6%BA%96%E7%9A%84%E5%88%B6%E9%A0%92%EF%BC%8C%E4%B9%9F%E6%9C%9F%E7%94%A8%E4%BB%A5%E9%81%94%E6%88%90%E3%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%B3%95%E3%80%8D%20%E9%A6%96%E6%A2%9D%E6%8F%AD%E7%A4%BA%E3%80%8C%E4%BF%83%E9%80%B2%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%81%A5%E5%85%A8%E7%99%BC%E5%B1%95%EF%BC%8C%E6%8F%90%E4%BE%9B%E5%AE%8C%E5%96%84%E7%9A%84%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E6%9C%8D%E5%8B%99%EF%BC%8C%E4%BB%A5%E6%8E%A8%E5%BB%A3%E6%95%99%E8%82%B2%E3%80%81%E6%8F%90%E5%8D%87%E6%96%87%E5%8C%96%E3%80%81%E6%94%AF%E6%8F%B4%E6%95%99%E5%AD%B8%E7%A0%94%E7%A9%B6%E3%80%81%E5%80%A1%E5%B0%8E%E7%B5%82%E8%BA%AB%E5%AD%B8%E7%BF%92%E3%80%8D%E7%9A%84%E7%AB%8B%E6%B3%95%E8%A6%81%E6%97%A8%E3%80%82)。該法要求各級政府支持圖書館人力與經費，使每校有適當的圖書館服務。對中小學而言，《圖書館法》奠定了**學校圖書館應被視為教育重要環節**的法律基礎。（**搜尋線索**：圖書館法 2001 學校圖書館 第五條）
*   **IFLA/UNESCO《學校圖書館宣言》**（1999年通過，2025年更新版） – _國際宣言_。由IFLA與UNESCO共同制定，宣告學校圖書館對教育與社會的價值。內容包括學校圖書館的使命（支援課程、培養閱讀與學習習慣、提供平等資訊服務等）和目標、人員配置、運作原則等[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/mao/works/slmanifesto.htm#:~:text=%E6%A0%B9%E6%93%9A%E9%81%8E%E5%8E%BB%E7%9A%84%E7%B6%93%E9%A9%97%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%88%87%E6%95%99%E5%B8%AB%E4%B8%80%E8%B5%B7%E5%B7%A5%E4%BD%9C%E6%99%82%EF%BC%8C%E5%AD%B8%E7%94%9F%E9%81%94%E6%88%90%E8%BC%83%E9%AB%98%E5%B1%A4%E6%AC%A1%E7%9A%84%E7%B4%A0%E9%A4%8A%E3%80%81%E9%96%B1%E8%AE%80%E3%80%81%E5%AD%B8%E7%BF%92%E3%80%81%E8%A7%A3%E6%B1%BA%E5%95%8F%E9%A1%8C%E5%8F%8A%E8%B3%87%E8%A8%8A%E5%92%8C%E9%80%9A%E8%A8%8A%E7%A7%91%E6%8A%80%E7%9A%84%E8%83%BD%E5%8A%9B%E3%80%82)[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/mao/works/slmanifesto.htm#:~:text=%E6%8F%90%E4%BE%9B%E7%B4%A0%E9%A4%8A%E3%80%81%E6%95%99%E8%82%B2%E3%80%81%E8%B3%87%E8%A8%8A%EF%BC%8C%E4%BB%A5%E5%8F%8A%E7%B6%93%E6%BF%9F%E3%80%81%E7%A4%BE%E6%9C%83%E8%88%87%E6%96%87%E5%8C%96%E7%9A%84%E7%99%BC%E5%B1%95%EF%BC%8C%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%83%BD%E6%98%AF%E9%95%B7%E6%9C%9F%E7%AD%96%E7%95%A5%E8%A3%A1%E7%9A%84%E9%87%8D%E8%A6%81%E4%B8%80%E7%92%B0%E3%80%82%E5%81%9A%E7%82%BA%E5%9C%B0%E6%96%B9%E3%80%81%E5%8D%80%E5%9F%9F%E5%92%8C%E5%85%A8%E5%9C%8B%E7%9A%84%E6%AC%8A%E8%B2%AC%E5%96%AE%E4%BD%8D%EF%BC%8C%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%20%E9%A4%A8%E5%BF%85%E9%A0%88%E8%A2%AB%E7%AB%8B%E6%B3%95%E5%8F%8A%E6%94%BF%E7%AD%96%E6%94%AF%E6%8C%81%E3%80%82%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%BF%85%E9%A0%88%E6%9C%89%E9%81%A9%E7%95%B6%E4%B8%94%E9%95%B7%E6%9C%9F%E7%9A%84%E7%B6%93%E8%B2%BB%EF%BC%8C%E6%94%AF%E6%92%90%E5%8F%97%E8%A8%93%E9%81%8E%E7%9A%84%E9%A4%A8%E5%93%A1%E3%80%81%E8%B3%87%E6%96%99%E3%80%81%E7%A7%91%E6%8A%80%E8%88%87%E8%A8%AD%E5%82%99%E3%80%82%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%BF%85%E9%A0%88%E5%85%8D%E8%B2%BB%E3%80%82)。各國教育部門常據此宣言制定本國學校圖書館政策。2025年更新版反映數位科技與社會變遷對學校圖書館的新要求（例如融合數位素養、虛擬學習環境）。（**參考連結**：IFLA 官網《School Library Manifesto 2025》頁面）
*   **《IFLA 學校圖書館指南》（第2版）**（2015年） – _國際指導文件_。IFLA學校圖書館組出版的專業指南[repository.ifla.org](https://repository.ifla.org/items/e61cb0b6-8d19-45e8-9be1-24b45309464e/full#:~:text=dc,debate%2C%20and%20consultation%20with%20many)（IFLA Professional Reports No. 77）。涵蓋學校圖書館的使命願景、管理與服務標準、館藏發展、閱讀與資訊素養教育、評估等章節。第二版在2002年首版基礎上修訂，加強了數位資源、資訊科技應用等部分。此指南為各國培訓圖書教師及評估學校圖書館提供了詳細藍本，其中文翻譯本亦由國家圖書館等單位發行供臺灣學校參考。（**搜尋線索**：IFLA School Library Guidelines 2015 PDF）
*   **AASL《全國學校圖書館標準》**（National School Library Standards, 2018） – _專業協會標準_。由美國圖書館協會旗下AASL發布，包含針對學習者、館員、圖書館的三套標準框架，強調六大共享基礎（Inquire, Include 等）下的具體能力指標[elementarylibrarian.com](https://elementarylibrarian.com/breaking-down-the-aasl-national-school-library-standards/#:~:text=Breaking%20Down%20the%20AASL%20National,called%20foundations%20and%20the)。此標準被視為21世紀學校圖書館的行動指南，強調圖書館計畫需與課程融合，培養學生的學習力與素養。臺灣圖書館界也關注該標準，作為推動本土閱讀與資訊教育的靈感來源。（**參考線索**：AASL Standards 2018 六大面向）
*   **教育部國教署：《中小學圖書館設置及營運基準》**（2002年發布） – _行政指南_。早於2016年教育部將各級館標準整合立法前，國教署曾針對國民中小學發布專門基準，規定了各班級數學校應配置的圖書館人力（例如13班以上學校應有專任或兼任圖書館組長）、館舍空間、藏書冊數等要求[teacherlibrarian.lib.ntnu.edu.tw](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/103space/01_%E9%99%B3%E6%B5%B7%E6%B3%93%E8%80%81%E5%B8%AB.pdf#:~:text=%E6%95%99%E8%82%B2%E9%83%A8%282002%29%E3%80%82%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%AD%E7%AB%8B%E5%8F%8A%E7%87%9F%E9%81%8B%E5%9F%BA%E6%BA%96%E3%80%822002%E5%B9%B4)。此基準對各校圖書館的硬體與人力有指導意義，雖後來被新《圖書館設立及營運標準》取代，但在實務上仍可作為參考。（**搜尋線索**：國民小學圖書館 營運基準 2002）
*   **Texas State Library：《CREW：現代圖書館淘汰手冊》**（CREW: A Weeding Manual for Modern Libraries，1976年初版，2008/2012年修訂） – _國際通用指引_。由美國德州州立圖書館委員會發行，CREW代表「**持續檢視、評估並淘汰** (Continuous Review, Evaluation, and Weeding)」，提供圖書館如何根據書籍的年代、使用率、狀況等標準進行館藏淘汰的詳細指引[yln.libguides.com](https://yln.libguides.com/c.php?g=1077306&p=7958012#:~:text=Network%20yln,Continuous%20Review%2C%20Evaluation%2C%20and%20Weeding)。尤其適用於中小型圖書館管理館藏。此手冊被譽為館藏維護的黃金準則，全世界許多學校圖書館遵循其建議（如何判斷一本書該下架），以保持館藏新鮮、有關且符合讀者需求。（**搜尋線索**：CREW Weeding Manual 2012 PDF）
*   **《臺灣中小學圖書館評鑑指標》**（例如各縣市教育局制定的評鑑表）– _地方參考文件_。為提升校園圖書館效能，臺灣各地曾制定學校圖書館評鑑指標，內容涵蓋館藏量、人力、經費、利用推廣等項目，以量化標準評估學校圖書館辦館情形。雖各地版本不一，但多參考教育部標準與IFLA指南，成為學校自我檢視與改進的重要依據。（**搜尋線索**：中小學 圖書館 評鑑 指標 範例）

**本章關鍵搜尋詞（中英）**：教育部 圖書館營運標準 (MOE Library Standards Taiwan)、圖書館法 Library Act Taiwan、IFLA School Library Manifesto、學校圖書館宣言 2025、IFLA School Library Guidelines 2015、AASL School Library Standards 2018、中小學圖書館 基準 Taiwan K-12 library standards、CREW Weeding 手冊、圖書館淘汰指南 weeding guide、學校圖書館 評鑑 指標 evaluation indicators、圖書資訊專業標準 library professional standards。

4\. 中小學場域的簡化策略
--------------

中小學圖書館多由兼任教師或志工維護，缺乏專職館員[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E6%AF%8F3C%E8%A1%9D%E6%93%8A%E5%AD%B8%E7%94%9F%E9%96%B1%E8%AE%80%E5%8B%95%E6%A9%9F%EF%BC%8C%E5%81%8F%E5%81%8F108%E8%AA%B2%E7%B6%B1%E4%B8%8A%E8%B7%AF%E5%BE%8C%EF%BC%8C%E5%9C%8B%E4%B8%AD%E6%9C%83%E8%80%83%E5%90%84%E7%A7%91%E9%83%BD%E6%9B%B4%E9%87%8D%E8%A6%96%E9%96%B1%E8%AE%80%E3%80%82%E4%BD%86%E5%85%A8%E5%8F%B0%E5%83%8517%EF%BC%85%E6%89%80%E5%9C%8B%E4%B8%AD%E5%B0%8F%EF%BC%88%E5%85%B1576%E6%A0%A1%EF%BC%89%E6%9C%89%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E6%95%99%E5%B8%AB%EF%BC%8C%E8%83%BD%E9%96%8B%E8%A8%AD%E5%B0%88%E9%96%80%E9%96%B1%E8%AE%80%E8%AA%B2%EF%BC%8C%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%AD%B8%E6%9C%83%20%E4%BB%8A%EF%BC%8818%EF%BC%89%E6%97%A5%E8%88%89%E8%A1%8C%E8%A8%98%E8%80%85%E6%9C%83%E5%91%BC%E7%B1%B2%E6%94%BF%E5%BA%9C%E6%AD%A3%E8%A6%96%E6%AD%A4%E4%BA%8B%EF%BC%8C%E5%8F%8A%E6%97%A9%E8%90%BD%E5%AF%A6%E3%80%8C%E6%A0%A1%E6%A0%A1%E6%9C%89%E9%96%B1%E6%8E%A8%E5%B8%AB%E3%80%8D%EF%BC%8C%E6%8F%90%E5%8D%87%E9%96%B1%E8%AE%80%E6%95%99%E8%82%B2%E5%93%81%E8%B3%AA%E3%80%82)。因此在遵循圖書館專業理論的同時，需要因地制宜**取捨**，以有限人力達到最大效益：

*   **編目** – _要做_: 為每本館藏建立基本書目紀錄（如標題、作者、出版年、ISBN、索書號），確保可檢索、可識別；_可不做_: 完整MARC編目規則的細節（如繁複的欄位如內容註、統一標目等）以及逐一建立權威檔。**為何**：在無專業編目人員下，**以「足夠找到書」為原則**。簡化編目能減少50%以上工作量，降低錯誤，同時確保核心資訊完整[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=8,Enrichment%20%E2%9A%99%EF%B8%8E)。非必要欄位的省略可讓兼任人員更快上手。
*   **分類排架** – _要做_: 依據簡明分類體系對館藏分門別類，至少區分出主要的大類（如依杜威十進法的百位分類或以讀者年齡分區），並在書脊貼上清楚的分類標籤，保持架上排列有序；_可不做_: 追求過度精細的分類號（例如杜威小數點後多位的細分）或多重分類系統並用。**為何**：對師生而言，只要**分類標示一致**，就能快速找到主題相關的書籍（節省讀者時間是館員服務要則[zh.wikipedia.org](https://zh.wikipedia.org/zh-hant/%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%BA%94%E5%BE%8B#:~:text=3,%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%98%AF%E4%B8%80%E6%88%90%E9%95%B7%E4%B8%AD%E6%9C%89%E6%A9%9F%E9%AB%94%EF%BC%88Library%20is%20a%20growing%20organism%EF%BC%89%EF%BC%9A%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%BF%8E%E5%90%88%E8%91%97%E6%99%82%E4%BB%A3%E7%99%BC%E5%B1%95%EF%BC%8C%E8%88%87%E6%99%82%E4%BF%B1%E9%80%B2%E3%80%82)）。過細的分類超出師生理解反而造成混亂，簡化至易於維護的程度即可。同時，由於**許多學校缺專業館員，分類宜力求直觀**（如以顏色、圖示輔助年幼學生辨識分類）。
*   **選書與採購** – _要做_: 制定簡明的選書原則，優先購置與課程相關、適合學生閱讀水準且內容新穎的圖書。可透過老師推薦、學生需求調查等方式確定採購清單，有限預算集中在“必需”資源上；_可不做_: 為追求藏書量而大量採購學生不感興趣或超出他們理解程度的書，也不必盲目追求全集收藏。**為何**：有限經費下，“買對的書”比“買很多書”重要。**館藏發展政策強調滿足讀者資訊需求**[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95&search=%E9%A4%A8#:~:text=%E5%90%8D%E8%A9%9E%E8%A7%A3%E9%87%8B%EF%BC%9A%20%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E4%BF%82%E6%8C%87%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9C%89%E7%B3%BB%E7%B5%B1%E3%80%81%E6%9C%89%E8%A8%88%E7%95%AB%E5%9C%B0%E4%BE%9D%E6%93%9A%E6%97%A2%E5%AE%9A%E6%94%BF%E7%AD%96%E5%BB%BA%E7%AB%8B%E9%A4%A8%E8%97%8F%EF%BC%8C%E4%B8%A6%E4%B8%94%E8%A9%95%E9%91%91%E9%A4%A8%E8%97%8F%EF%BC%8C%E5%88%86%E6%9E%90%E9%A4%A8%E8%97%8F%E5%BC%B7%E5%BC%B1%EF%BC%8C%E6%8E%A2%E8%A8%8E%E8%AE%80%E8%80%85%E4%BD%BF%E7%94%A8%E9%A4%A8%E8%97%8F%E6%83%85%E5%BD%A2%EF%BC%8C%E4%BB%A5%E7%A2%BA%E5%AE%9A%E8%83%BD%E5%A4%A0%E5%88%A9%E7%94%A8%E9%A4%A8%E5%85%A7%E5%8F%8A%E9%A4%A8%E5%A4%96%E8%B3%87%E6%BA%90%E4%BE%86%E6%BB%BF%E8%B6%B3%E8%AE%80%E8%80%85%E8%B3%87%E8%A8%8A%E9%9C%80%E6%B1%82%E7%9A%84%E4%B8%80%E7%A8%AE%E9%81%8E%20%E7%A8%8B%E3%80%82%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E7%9A%84%E5%85%A7%E5%AE%B9%E5%8C%85%E6%8B%AC%EF%BC%9A%E7%A4%BE%E5%8D%80%E5%88%86%E6%9E%90%E3%80%81%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%94%BF%E7%AD%96%E4%B9%8B%E8%A8%82%E5%AE%9A%E3%80%81%E9%81%B8%E6%93%87%E3%80%81%E6%8E%A1%E8%A8%AA%E3%80%81%E9%A4%A8%E8%97%8F%E8%A9%95%E9%91%91%E3%80%81%E9%A4%A8%E8%97%8F%E6%B7%98%E6%B1%B0%E7%AD%89%E6%B4%BB%E5%8B%95%E3%80%82%E8%8C%B2%E5%B0%87%E5%90%84%E9%A0%85%E6%B4%BB%E5%8B%95%E8%AA%AA%E6%98%8E%E5%A6%82%E4%B8%8B%EF%BC%9A%20%E4%BB%BB%E4%BD%95%E4%B8%80%E5%80%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%83%BD%E4%BB%A5%E6%BB%BF%E8%B6%B3%E8%AE%80%E8%80%85%E9%9C%80%E6%B1%82%E7%82%BA%E7%9B%AE%E7%9A%84%EF%BC%8C%E6%89%80%E4%BB%A5%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A6%96%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E6%9C%8D%E5%8B%99%E4%B9%8B%E7%A4%BE%E5%8D%80%E5%8F%8A%E7%A4%BE%E5%8D%80%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%E3%80%82%E5%8D%B3%E4%BD%BF%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E9%A1%9E%E5%9E%8B%E7%9B%B8%E5%90%8C%EF%BC%8C%E7%A4%BE%E5%8D%80%E7%9A%84%E8%A6%8F%E6%A8%A1%E4%B9%9F%E7%9B%B8%E7%95%B6%EF%BC%8C%E4%BD%86%E7%A4%BE%E5%8D%80%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%E5%8F%AF%E8%83%BD%E6%9C%89%E7%9B%B8%E7%95%B6%E5%A4%A7%E7%9A%84%E5%B7%AE%20%E7%95%B0%E3%80%82%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%B8%8D%E5%83%85%E8%A6%81%E4%BA%86%E8%A7%A3%E7%8F%BE%E6%9C%89%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%EF%BC%8C%E4%B9%9F%E8%A6%81%E8%A8%AD%E6%B3%95%E4%BA%86%E8%A7%A3%E6%BD%9B%E5%9C%A8%E8%AE%80%E8%80%85%E7%9A%84%E9%9C%80%E6%B1%82%E3%80%82,%E9%80%8F%E9%81%8E%E7%A4%BE%E5%8D%80%E5%88%86%E6%9E%90%E6%8E%8C%E6%8F%A1%E7%A4%BE%E5%8D%80%E7%9A%84%E9%9C%80%E6%B1%82%EF%BC%8C%E9%85%8D%E5%90%88%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E7%9B%AE%E7%9A%84%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A8%82%E5%AE%9A%E9%81%B8%E6%9B%B8%E6%94%BF%E7%AD%96%EF%BC%8C%E4%BB%A5%E4%BE%BF%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%83%BD%E5%A4%A0%E4%BE%9D%E6%93%9A%E5%9B%BA%E5%AE%9A%E7%9A%84%E6%94%BF%E7%AD%96%E8%88%87%E5%8E%9F%E5%89%87%E4%BE%86%E5%BE%9E%E4%BA%8B%E9%81%B8%E6%9B%B8%E5%B7%A5%E4%BD%9C%E3%80%82%E7%B6%93%E9%81%8E%E9%81%B8%E6%93%87%E7%9A%84%E5%9C%96%E6%9B%B8%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%88%A9%E7%94%A8%E6%9C%80%E6%9C%89%E6%95%88%E7%9A%84%E6%96%B9%E6%B3%95%EF%BC%8C%E4%BB%A5%E8%A8%82%20%E8%B3%BC%E3%80%81%E8%B4%88%E9%80%81%E6%88%96%E4%BA%A4%E6%8F%9B%E7%9A%84%E6%96%B9%E5%BC%8F%EF%BC%8C%E5%B0%87%E4%B9%8B%E8%92%90%E9%9B%86%E5%88%B0%E9%A4%A8%E3%80%82%E5%9C%96%E6%9B%B8%E5%88%B0%E9%A4%A8%E4%B9%8B%E5%BE%8C%EF%BC%8C%E5%BF%85%E9%A0%88%E7%B6%93%E9%81%8E%E5%88%86%E9%A1%9E%E3%80%81%E7%B7%A8%E7%9B%AE%E7%AD%89%E6%95%B4%E7%90%86%E5%B7%A5%E4%BD%9C%EF%BC%8C%E6%89%8D%E8%83%BD%E4%BE%9B%E8%AE%80%E8%80%85%E5%88%A9%E7%94%A8%E3%80%82%E7%82%BA%E4%BA%86%E4%BF%9D%E6%8C%81%E9%A4%A8%E8%97%8F%E7%9A%84%E6%B4%BB%E5%8A%9B%EF%BC%8C%E4%BD%BF%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%9C%89%E6%9B%B4%E5%A4%9A%E7%9A%84%E7%A9%BA%E9%96%93%E4%BE%86%E5%AE%B9%E7%B4%8D%E6%96%B0%E7%9A%84%E9%A4%A8%E8%97%8F%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%BF%85%20%E9%A0%88%E5%B0%87%E7%BD%95%E7%94%A8%E3%80%81%E4%B8%8D%E5%86%8D%E8%A2%AB%E4%BD%BF%E7%94%A8%E6%88%96%E4%B8%8D%E5%A0%AA%E4%BD%BF%E7%94%A8%E7%9A%84%E5%9C%96%E6%9B%B8%EF%BC%8C%E4%BA%88%E4%BB%A5%E6%B7%98%E6%B1%B0%EF%BC%88%E8%A8%BB%E9%8A%B7%E6%88%96%E7%A7%BB%E6%9E%B6%EF%BC%89%E3%80%82%E5%90%8C%E6%99%82%EF%BC%8C%E7%82%BA%E4%BA%86%E8%A7%A3%E9%A4%A8%E8%97%8F%E5%BC%B7%E5%BC%B1%EF%BC%8C%E5%88%86%E6%9E%90%E9%A4%A8%E8%97%8F%E4%BD%BF%E7%94%A8%E6%83%85%E5%BD%A2%EF%BC%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%A6%81%E9%80%B2%E8%A1%8C%E9%A4%A8%E8%97%8F%E8%A9%95%E9%91%91%EF%BC%8C%E6%89%BE%E5%87%BA%E9%A4%A8%E8%97%8F%E7%BC%BA%E5%A4%B1%E3%80%82%E8%A9%95%E9%91%91%E7%9A%84%E7%B5%90%E6%9E%9C%E5%8F%AF%E4%BB%A5%E5%8D%94%E5%8A%A9%E5%9C%96%E6%9B%B8%20%E9%A4%A8%E5%86%8D%E6%AC%A1%E5%9C%B0%E4%BA%86%E8%A7%A3%E7%A4%BE%E5%8D%80%E7%9A%84%E9%9C%80%E6%B1%82%EF%BC%8C%E4%B8%A6%E8%97%89%E4%BB%A5%E4%BF%AE%E6%AD%A3%E9%81%B8%E6%9B%B8%E6%94%BF%E7%AD%96%E3%80%82%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E6%98%AF%E4%B8%80%E7%A8%AE%E8%A6%8F%E7%95%AB%E7%9A%84%E9%81%8E%E7%A8%8B%EF%BC%8C%E6%AF%8F%E4%B8%80%E5%80%8B%E7%92%B0%E7%AF%80%E9%83%BD%E6%9C%83%E4%BA%92%E7%9B%B8%E5%BD%B1%E9%9F%BF%EF%BC%8C%E5%BD%BC%E6%AD%A4%E4%BA%92%E5%8B%95%E3%80%82)。對沒有館員的學校，由教師組成選書小組即可執行基本館藏發展。捨棄不切實際的採購可以避免書架上充斥未讀之書、浪費預算。
*   **館藏維護與淘汰** – _要做_: 每年或每學期定期盤點館藏，將嚴重受損、內容過時或連續兩年以上零借閱的書列入淘汰清單[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E5%9F%BA%E6%BA%96%EF%BC%8C%E8%A6%8F%E5%AE%9A%E5%A6%82%E9%99%84%E8%A1%A8%E4%BA%8C%E3%80%82)。依學校政策報請報廢或以適當方式處理，騰出空間給新書；_可不做_: 抱著“不棄任何書”的心態導致書架囤積無用書籍，也無需等到館藏滿溢才來一次大掃除。**為何**：定期小規模汰舊比多年不管再一次清理更有效且壓力小。**館藏淘汰是館藏生命周期的正常部分**，如CREW法建議持續審視並移除利用率低的館藏，以維持整體品質[jila.lib.nccu.edu.tw](https://jila.lib.nccu.edu.tw/wp-content/uploads/2019/10/17_7.pdf#:~:text=%5BPDF%5D%20%E8%87%BA%E7%81%A3%E5%9C%B0%E5%8D%80%E5%A4%A7%E5%AD%B8%E6%9A%A8%E7%8D%A8%E7%AB%8B%E5%AD%B8%E9%99%A2,%E7%A9%BA%E9%96%93%E4%BE%86%E5%AE%B9%E7%B4%8D%E6%9B%B4%E6%96%B0%E7%A9%8E%E3%80%81%E4%B8%94%E7%AC%A6%E5%90%88%E8%AE%80%E8%80%85)。對人力有限的學校，漸進式淘汰能保持館藏活力，同時不致因一次性工作量過大而無法執行。
*   **借閱規則與流通** – _要做_: 訂定簡明易行的借閱規則，例如每人可借書冊數和借期（如每人2冊、2週），逾期處理以提醒為主而非重罰，並建立**借還登記制度**（紙本或電子系統皆可）；_可不做_: 繁瑣的罰款機制或過嚴的限制（如逾期即停權過長），以及複雜的館際互借流程（對中小學而言通常不涉及館際借書）。**為何**：規則太複雜會讓師生卻步，反而降低圖書利用率。以人少的學校而言，**建立基本的誠信借閱管理即可**。寬鬆友善的規則鼓勵學生多借閱，而非因害怕逾期受罰而不敢借書。同時，利用系統自動記錄借還可避免人工帳本遺漏，**提升準確性並減輕老師管理負擔**。
*   **資料輸入與品質** – _要做_: 制定館藏資料輸入的**一致性標準**（如作者姓名格式、分類取號規則），並盡量使用批次導入或現成的數據（如利用ISBN從國家書目抓取書目資料）以確保正確性[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=8,Enrichment%20%E2%9A%99%EF%B8%8E)。新書登錄時雙人復核關鍵欄位，避免輸入錯誤；_可不做_: 逐書手工錄入所有資訊或由未培訓人員隨意編寫，還有對每筆資料進行冗長的人工審核（人力不足下難以持續）。**為何**：數據品質直接影響檢索效果與館藏管理效率。透過**簡化輸入（善用自動抓取）和規範格式**，可最大程度減少拼寫錯誤、重複紀錄等問題[syncari.com](https://syncari.com/blog/top-5-data-quality-issues-and-how-to-fix-them/#:~:text=Learn%20about%20the%20top%20data,missing%20fields%2C%20and%20inconsistent%20formatting)。過度追求完美反而可能因人力不繼而導致資料維護中斷，因此找到規範與效率間的平衡點最重要。
*   **讀者服務與推廣** – _要做_: 積極將圖書館融入校園生活，例如定期舉辦閱讀活動（班級共讀、書展）或在朝會時間介紹新書；鼓勵各科教師利用圖書館資源教學，營造**全校一起推動閱讀**的風氣[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E8%80%8C%E9%87%9D%E5%B0%8D%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E4%BB%BB%E4%BA%BA%E5%93%A1%E8%A8%AD%E7%BD%AE%EF%BC%8C%E5%BC%B5%E7%A1%AF%E5%87%B1%E6%8F%90%E5%88%B0%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E4%BB%8A%E5%B9%B4%E8%B5%B7%E5%9F%B7%E8%A1%8C%E4%B8%80%E8%88%AC%E6%80%A7%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%80%83%E6%A0%B8%EF%BC%8C%E7%9B%BC%E5%8D%94%E5%8A%A9%E5%AD%B8%E6%A0%A1%E8%90%BD%E5%AF%A6%E7%9B%B8%E9%97%9C%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E4%BB%BB%E4%BA%BA%E5%93%A1%E7%9A%84%E8%A8%AD%E7%BD%AE%E3%80%82%E8%80%8C%E6%9C%89%E9%97%9C%E4%B8%8A%E8%BF%B0%E6%BA%96%E5%89%87%E7%9A%84%E4%BF%AE%E6%B3%95%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E9%A0%90%E8%A8%88%E6%9C%9D%E5%AD%B8%E6%9C%83%E7%9A%84%E8%A8%B4%E6%B1%82%E4%BE%86%E9%80%B2%20%E8%A1%8C%EF%BC%8C%E5%BE%8C%E7%BA%8C%E5%B0%87%E9%82%80%E9%9B%86%E5%9C%B0%E6%96%B9%E6%94%BF%E5%BA%9C%E8%A8%8E%E8%AB%96%E3%80%82)。服務時間上盡可能固定開放（如每天中午及每週選定課外活動時間），即使由行政人員輪流值班也要保持圖書館開門；_可不做_: 過於專業化而師生無法參與的服務（如複雜的參考諮詢系統），或依賴單一人力苦撐（全校應共同參與閱讀推廣，而非僅圖書館管理者的事務[reading.cw.com.tw](https://reading.cw.com.tw/trend-article/627#:~:text=%E8%80%8C%E9%87%9D%E5%B0%8D%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E4%BB%BB%E4%BA%BA%E5%93%A1%E8%A8%AD%E7%BD%AE%EF%BC%8C%E5%BC%B5%E7%A1%AF%E5%87%B1%E6%8F%90%E5%88%B0%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E4%BB%8A%E5%B9%B4%E8%B5%B7%E5%9F%B7%E8%A1%8C%E4%B8%80%E8%88%AC%E6%80%A7%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%80%83%E6%A0%B8%EF%BC%8C%E7%9B%BC%E5%8D%94%E5%8A%A9%E5%AD%B8%E6%A0%A1%E8%90%BD%E5%AF%A6%E7%9B%B8%E9%97%9C%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E4%BB%BB%E4%BA%BA%E5%93%A1%E7%9A%84%E8%A8%AD%E7%BD%AE%E3%80%82%E8%80%8C%E6%9C%89%E9%97%9C%E4%B8%8A%E8%BF%B0%E6%BA%96%E5%89%87%E7%9A%84%E4%BF%AE%E6%B3%95%EF%BC%8C%E6%95%99%E8%82%B2%E9%83%A8%E9%A0%90%E8%A8%88%E6%9C%9D%E5%AD%B8%E6%9C%83%E7%9A%84%E8%A8%B4%E6%B1%82%E4%BE%86%E9%80%B2%20%E8%A1%8C%EF%BC%8C%E5%BE%8C%E7%BA%8C%E5%B0%87%E9%82%80%E9%9B%86%E5%9C%B0%E6%96%B9%E6%94%BF%E5%BA%9C%E8%A8%8E%E8%AB%96%E3%80%82)）。**為何**：中小學圖書館的人力與時間都有限，只有透過**簡化服務模式並廣泛動員**，才能真正讓圖書館活起來。將重點放在培養學生閱讀興趣和基本檢索能力上，而非提供超出場域需求的高階研究服務。取捨之下，把有限的資源用于\*\*「哪些事情能直接提高學生閱讀與學習」\*\*，捨去華而不實的形式，才能達成圖書館支持教育的核心目標。
*   **技術與系統** – _要做_: 利用**適合規模**的技術工具提升效率，例如選擇一款簡單易用的館藏管理軟體（可考慮免費的如Koha等）來記錄書目和借閱，比用紙本紀錄更可靠；善用條碼掃描器辦理借還，降低人工錯誤。定期將資料庫備份，軟體保持更新；_可不做_: 追求大型圖書館才用得到的繁複系統功能（如完整的館際互借模組、大規模數據分析）或自行開發一套系統（維護成本高）。**為何**：**工具的複雜度需與人力相適應**。一套介面複雜的系統會讓未經專業訓練的教師望而生畏，增加出錯機會[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=1)；而一套輕量級、直觀的系統可以大幅提高工作效率，讓老師花更少時間在管理上、更多時間在指導學生上。同時，適度的自動化（如到期提醒、報表生成）能降低人工疏漏，但過度高深的功能無人會用反而成擺設。因此在技術取捨上，**夠用即可、簡便為上**，並確保有基本的維護（備份/更新）以避免資料遺失或安全漏洞[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=11)。

**本章關鍵搜尋詞（中英）**：學校圖書館 簡化管理、圖書館 編目 簡易 cataloging simplify、分類 簡化 broad classification、選書策略 collection selection strategy、館藏淘汰 weeding small library、借閱規則 制定 lending policy school、資料品質 一致性 data consistency library、閱讀活動 推廣 reading promotion school、圖書館 自動化 工具 library automation tools、Koha 中小學應用、備份 資料庫 backup library data、簡易圖書館系統 easy library system、教師 圖書館 協作 teacher library collaboration。

5\. 對應到系統的資料欄位建議
----------------

以下列出館藏管理系統中建議設置的主要資料欄位（包含名稱/型別/是否必填/說明/例子），以滿足中小學圖書館資訊結構需求：

*   **書名** (Title) / 文字 / **必填** / 圖書資料的主要名稱[pedia.cloud.edu.tw](https://pedia.cloud.edu.tw/Entry/Detail/?title=%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE&search=%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE#:~:text=%E6%BC%A2%E8%AA%9E%E6%8B%BC%E9%9F%B3%EF%BC%9A%20t%C3%BA%20sh%C5%AB%20bi%C4%81n%20m%C3%B9,50%E8%AE%80%E6%9B%B8%20%2052%E4%B9%8B%20%2054%E3%80%82)。例：`「哈利·波特－神祕的魔法石」`。
*   **作者** (Author) / 文字 / **必填** / 著者名稱（個人或團體）。例：`J.K. Rowling`（多作者可附註全部姓名）。
*   **出版者** (Publisher) / 文字 / 選填 / 出版機構名稱。例：`柿子文化股份有限公司`。
*   **出版年** (Publication Year) / 數字 (年份) / 選填 / 出版或版權年份。例：`1997` 年。
*   **ISBN** / 文字 / 選填 / 國際標準書號，13位數字（無ISBN之資料可不填）。例：`9789573317241`。
*   **索書號** (Call Number) / 文字 / **必填** / 圖書館內編制的館藏排架號碼，用於書籍在館內的存放定位。例：`J 823.7 1053`（兒童文學類，作者代號 1053）。
*   **館藏類別** (Category/Genre) / 文字 / 選填 / 館藏依內容或讀者群分類的類型標籤，方便統計與瀏覽。例：`童話故事`、`科普讀物`、`八年級適閱`。
*   **語言** (Language) / 文字 / 選填 / 資料的語言。例：`中文`、`English`。
*   **館藏編號** (Item ID/Barcode) / 文字或數字 / **必填** / 每一館藏實體的唯一識別碼，常以條碼呈現，用於借還掃描。例：`B2025001234`。
*   **狀態** (Status) / 枚舉 / **必填** / 資料目前流通狀態。例：`可借 (Available)`、`已借出 (Checked Out)`、`館內閱覽 (In Library)`、`遺失/剔除 (Missing/Withdrawn)`。
*   **頁數** (Pages) / 數字 / 選填 / 書籍頁數或資料長度。例：`256` 頁。
*   **附註** (Notes) / 文字 / 選填 / 其他需說明的事項，如版本、卷次或特殊館藏說明。例：`附光碟1片；第2版`。

> **說明**：以上欄位涵蓋了圖書館書目記錄常用的核心元素（如標題、作者、出版資訊、識別號等），這些欄位通常也是讀者檢索時會用到的要點[zh.wikipedia.org](https://zh.wikipedia.org/zh-cn/OPAC#:~:text=%E6%9F%A5%E6%89%BE%E6%96%B9%E5%BC%8F)。其中「書名/作者/出版年/出版社/ISBN」等屬**描述性資料**，記錄文獻的書目資訊；「索書號/館藏編號/狀態」等屬**管理性資料**，方便館內運作和讀者查找。例如，索書號對應實體排架，館藏編號用於掃描借還，而狀態則顯示可否借閱。透過這些欄位的設置，系統可以支持完整的館藏查詢與流通管理。同時保留一些選填欄位（如語言、類別）有助於未來擴充功能，如多語藏書統計或主題瀏覽，對中小學場域而言提供了彈性而不增加初期負擔。

**本章關鍵搜尋詞（中英）**：書目紀錄欄位 bibliographic fields、學校圖書館 元數據 metadata、必備欄位 core fields library、Title 作者 ISBN 出版 catalog fields、索書號 call number field、條碼 館藏編號 barcode ID、館藏狀態 availability status、館藏類型 category field、MARC 必要欄位 MARC core fields、OPAC 檢索欄位 search fields library (Title, Author, Year)、圖書館資料庫 設計 library database design。

6\. 對應到系統的功能設計建議
----------------

*   **需求:** 學生和教師能快速找到所需書籍 -> **功能:** 提供強大的書目檢索功能（依書名、作者、主題等搜索，並支援篩選與排序） -> **為何:** 便利的檢索介面可節省讀者找書時間，提高圖書館利用率[zh.wikipedia.org](https://zh.wikipedia.org/zh-hant/%E5%9C%96%E6%9B%B8%E9%A4%A8%E4%BA%94%E5%BE%8B#:~:text=3,%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%98%AF%E4%B8%80%E6%88%90%E9%95%B7%E4%B8%AD%E6%9C%89%E6%A9%9F%E9%AB%94%EF%BC%88Library%20is%20a%20growing%20organism%EF%BC%89%EF%BC%9A%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%BF%8E%E5%90%88%E8%91%97%E6%99%82%E4%BB%A3%E7%99%BC%E5%B1%95%EF%BC%8C%E8%88%87%E6%99%82%E4%BF%B1%E9%80%B2%E3%80%82)。對於不熟悉檢索技巧的師生，可透過關鍵字聯想、分類瀏覽等方式輔助，避免「找不到結果」的挫折感。
*   **需求:** 管理借還避免人工出錯 -> **功能:** **流通管理模組**（借書還書掃描登記、借期自動計算、逾期提醒） -> **為何:** 系統記錄每筆借閱，可即時查詢在借者與到期日，減輕老師人工紀錄負擔。逾期提醒功能自動發送通知，確保借閱人知悉歸還日期。這不僅降低圖書遺失率，也培養學生守時還書的習慣。此外，自動化流通**避免人工疏漏**（如忘記登記歸還），提升帳目準確度。
*   **需求:** 新書登錄要高效且準確 -> **功能:** **ISBN 資料匯入**與編目模板（掃描或輸入ISBN，自動抓取書目資料並套用預設欄位格式） -> **為何:** 非專業人員登錄圖書時，如果能透過網路數據庫自動帶入書名、作者等資料，**可大幅節省編目時間**，並確保關鍵資訊無誤[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=8,Enrichment%20%E2%9A%99%EF%B8%8E)。模板則保障每筆紀錄欄位完整性，減少遺漏。例如新增館藏時，只需輸入ISBN並選擇適用分類號，系統即自動完成大部分欄位填寫，比手動逐項輸入更可靠高效。
*   **需求:** 掌握館藏使用情況以輔助決策 -> **功能:** **報表與統計分析**（如借閱排行榜、館藏周轉率、未借閱清單） -> **為何:** 透過系統自動生成的報表，管理者可以**以數據佐證館藏發展決策**。例如，借閱排行榜可顯示最受歡迎的書，供下次選書參考；未曾借出的圖書清單提示哪些書可能需要淘汰或宣傳[yln.libguides.com](https://yln.libguides.com/c.php?g=1077306&p=7958012#:~:text=Network%20yln,Continuous%20Review%2C%20Evaluation%2C%20and%20Weeding)。館藏利用率統計亦能讓學校評估圖書館效益。這種功能相當於提供「館藏使用體檢」，有助於在無專職館員的情況下，依據客觀數據持續改進館藏結構。
*   **需求:** 減少教師管理日常瑣事的壓力 -> **功能:** **自動化例行任務**（如批次寄送到期提醒、生成新書通知單） -> **為何:** 例行工作透過系統自動執行，可避免人工遺漏並節省人力時間[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=Automation%20can%20greatly%20reduce%20the,more%20complex%20and%20meaningful%20tasks)。例如，系統每天自動檢查逾期清單並以Email或訊息通知借閱人歸還；每當有新書登錄時，自動生成清單供老師公告周知。這些自動化讓兼任館員的教師**把精力投入更重要的閱讀指導和服務上**，而非繁瑣行政。亦降低因人忙碌忘記通知而造成的服務瑕疵。
*   **需求:** 確保資料輸入一致、避免重複 -> **功能:** **資料驗證與提示**（如新增書目時檢查是否ISBN重複、必填欄未填則警示） -> **為何:** 系統在資料輸入端加入驗證規則，可防止常見錯誤。例如，若使用者試圖新增一本已存在的ISBN，系統應提示可能重複，避免建立兩筆重複紀錄[syncari.com](https://syncari.com/blog/top-5-data-quality-issues-and-how-to-fix-them/#:~:text=Top%205%20Data%20Quality%20Issues,missing%20fields%2C%20and%20inconsistent%20formatting)。又如必填欄位未填自動標示紅字提示。這些機制確保數據品質與一致性，**減少日後查找或統計時因格式不統一導致的困擾**。對缺專職人員的學校來說，等於內建了一個“質檢員”，在資料進庫時把關。
*   **需求:** 激勵學生多讀書並個性化服務 -> **功能:** **個人化推薦與閱讀追蹤**（推薦書單、生涯借閱紀錄查詢） -> **為何:** 系統根據學生歷史借閱記錄，運用簡單的推薦算法向其推薦相關主題或系列的書籍（如讀過某一系列第1集，推薦第2集）。這種“像Netflix般”的個人化推薦[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=2,Reading%20Lists%20%E2%9C%AA)可提高學生興趣，增加館藏使用率。同時，每個學生可查看自己的閱讀統計（如本學期讀了幾本書），老師也能查看班級整體借閱量。**這類功能能營造良性競爭與閱讀成就感**，在沒有館員親自指導的情況下，系統成為學生的閱讀顧問，輔助推動閱讀風氣。
*   **需求:** 非上班時間也能獲取幫助 -> **功能:** **圖書館Chatbot智能助理**（24/7線上問答，如查詢館藏位置、開放時間、簡易諮詢） -> **為何:** 透過嵌入式的聊天機器人，學生可隨時詢問「有沒有某主題的書？」、「還書期限是何時？」等問題，系統智能解析並回覆，提供類似真人館員的即時協助[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=3.%20Natural,Assistants%20%E2%9C%AA)。在缺少專職人員隨時駐館的中小學，這確保了**圖書館服務不中斷**。同時簡單問題由AI回答後，老師館員能省下精力處理更複雜的需求。有調查顯示超過八成使用者有使用圖書館聊天機器人的意願且多數問題在30秒內獲解決[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=3.%20Natural,Assistants%20%E2%9C%AA)，可見此功能能有效提升讀者滿意度。
*   **需求:** 確保系統與資料安全可靠 -> **功能:** **權限與備份管理**（多層使用者權限設定，定期自動備份資料庫） -> **為何:** 基於學生隱私與資料保護考量，系統應設計不同權限等級（如一般學生僅能查詢，教師可管理借還，管理者才能匯出資料），防止未經授權的敏感資訊存取[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=11)。此外，因學校可能缺乏專業IT人員，**自動備份**功能顯得尤為重要——例如每週備份資料庫到雲端或外接設備，並提供一鍵還原功能。如此即使硬體故障或人為失誤刪除資料，也能迅速復原，避免館藏管理中斷。這些設計讓系統具有企業級可靠性，即便在校園環境也能長期穩定運行。

**本章關鍵搜尋詞（中英）**：圖書館系統 檢索功能 library search、借還模組 circulation module、ISBN 匯入 自動編目 ISBN import catalog、圖書館 報表 分析 library reports analytics、逾期通知 automation overdue notice、資料驗證 library data validation duplicate、閱讀推薦 演算法 reading recommendation、圖書館 ChatBot 智慧助理 library AI chatbot、系統 權限 備份 library system backup permission、安全 安全性 library data security、學生 圖書館 互動 library user engagement tech。

7\. 常見坑與避雷清單
------------

*   **資料錄入不一致**：同一本作者有人登記為「J. K. Rowling」，有人寫「羅琳」，或分類標號隨意編，導致系統中出現重複或難以檢索的記錄。_避雷_: 制定並嚴格遵守書目輸入規範，例如統一使用原文作者名還是譯名，統一分類體系。[syncari.com](https://syncari.com/blog/top-5-data-quality-issues-and-how-to-fix-them/#:~:text=Learn%20about%20the%20top%20data,missing%20fields%2C%20and%20inconsistent%20formatting)指出**重複數據、格式不一致**是常見資料品質問題，要藉由規範與檢查來杜絕。
*   **重要欄位遺漏或錯誤**：如書名打錯、ISBN漏填，將導致讀者檢索不到館藏或無法透過ISBN導入數據。_避雷_: 系統層面加入必填欄位檢查，人工層面雙人校對新錄入資料。特別是索書號或分類錯誤時，書可能上錯書架永遠找不到（這在無館員情況下常發生）。務必**一開始就把資料登錄對**，勝過事後費力更正。
*   **圖書重複登錄**：缺乏檢查導致一本書在系統有兩筆紀錄，甚至條碼複用混亂。這會干擾借還與統計。_避雷_: 新增館藏時以ISBN或條碼作唯一鍵搜尋是否已存在[syncari.com](https://syncari.com/blog/top-5-data-quality-issues-and-how-to-fix-them/#:~:text=Top%205%20Data%20Quality%20Issues,missing%20fields%2C%20and%20inconsistent%20formatting)；定期檢視系統清單，清理明顯重複項。條碼要**一書一碼**不重複，一旦打印錯了寧可作廢換新，以免後患。
*   **不進行館藏淘汰**：多年累積的陳舊或受損書籍佔據寶貴空間且無人問津，導致書架擁擠、讀者找新書困難。_避雷_: 建立**除藏制度**，每年篩選一次老化館藏。例如參考“每年不超過館藏3%淘汰”的原則[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E5%9F%BA%E6%BA%96%EF%BC%8C%E8%A6%8F%E5%AE%9A%E5%A6%82%E9%99%84%E8%A1%A8%E4%BA%8C%E3%80%82)。不淘汰的坑在於館藏越積越冗，新的、有價值的書反而淹沒其中，讓圖書館成了“資訊墓地”而非資源中心。
*   **目錄資訊與實物不符**：系統顯示有的書其實找不到（可能丟失或未上架），或實體在架但目錄漏登。這會讓讀者和老師白跑一趟，信任度下降。_避雷_: **定期清點**，對照館藏實物與系統記錄，發現不符立即更正狀態[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E7%99%BC%E5%B1%95%E5%9F%BA%E6%BA%96%EF%BC%8C%E8%A6%8F%E5%AE%9A%E5%A6%82%E9%99%84%E8%A1%A8%E4%BA%8C%E3%80%82)。如書遺失就在系統標註「遺失」，免得下一位讀者再找。養成每學年末做一次館藏盤點，可將此類偏差降到最低。
*   **使用者操作失誤**：例如學生志工誤將書還錯類別區、老師借書沒在系統登記就拿走，造成館藏紀錄混亂。_避雷_: **培訓和簡化流程**並行。對參與館務的學生和教師進行基本培訓（例如如何掃描借還、如何排書），同時把系統介面設計得盡量簡單明了[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=1)。一旦發現錯誤操作，及時溝通更正並完善指引。
*   **缺乏資料備份**：系統裝在單一電腦上且未備份，一旦硬碟故障或操作失誤刪除，所有館藏數據付諸東流。_避雷_: 執行**定期備份**，最好有異地或雲端備份方案。很多學校沒有專職IT，但可以求助資訊老師設定自動備份，每週將資料庫拷貝一份到學校伺服器或雲端。唯有做好備份，才能在災難發生時迅速恢復，否則將重蹈一些學校之前因電腦故障導致多年館藏帳目蕩然無存的覆轍。
*   **軟體不維護**：圖書館管理軟體長期不更新，潛藏漏洞或與新電腦、新系統不相容。等到軟體無法使用時才發現為時已晚。_避雷_: 關注所用軟體的更新通知，適時**升級版本**。如果使用雲端服務，注意訂閱期限不要中斷。如自行架設系統，要定期檢查資料庫健康並更新安全補丁[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=11)。另外，**避免使用盜版或來路不明的軟體**，以免中病毒或法律風險。維護不到位可能導致系統崩潰或資料外洩，這類坑尤其要避免。
*   **過度複雜的規則與介面**：一些學校試圖套用大學圖書館的繁複規程，如多環節審核、嚴格分類細目，但對人少的小館而言難以執行，徒增錯誤機會。介面繁雜也讓使用者不願用。_避雷_: **KISS 原則**（Keep It Simple, Stupid）在此適用。規章制定和系統設計上，以足夠用、易操作為度，不搞花哨功能。定期收集老師學生的反饋，發現某功能大家不會用、不想用，就考慮簡化。過度設計本身就是一大地雷。

**本章關鍵搜尋詞（中英）**：資料品質 問題 data quality issues、圖書館 重複紀錄 duplicate records、館藏清點 inventory audit discrepancy、學校圖書館 淘汰 weeding pitfalls、使用者 錯誤 操作 user errors library、圖書館 備份 backup importance、系統 維護 更新 system maintenance library、介面 複雜 UI complexity library[linkedin.com](https://www.linkedin.com/pulse/top-20-common-problems-any-library-management-system-software--ckr7c#:~:text=1)、一致性 規範 consistency standards library、資料遺失 data loss library、隱私 安全 library privacy security。

8\. 可交付給 AI 小助理的任務清單
--------------------

1.  **幫我標記兩年未借的圖書**（根據借閱記錄篩選長期未借書籍，加上“久未借出”標記，以利清查館藏）。
2.  **幫我生成館藏淘汰建議清單**（分析館藏的出版年、借閱次數等，推薦應汰舊的書目列表）。
3.  **幫我推薦新書採購清單**（根據學生熱門搜尋主題和現有館藏空白，智能推薦值得增購的書籍清單）。
4.  **幫我檢查書目資料錯誤**（巡檢館藏資料庫，找出書名拼寫異常、重複條目或分類號不符合規則的紀錄，提出更正建議）。
5.  **幫我批次補全書目資料**（輸入一批ISBN後，自動抓取書名、作者、分類等資訊填入，減少手工登錄時間[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=8,Enrichment%20%E2%9A%99%EF%B8%8E)）。
6.  **幫我將書本依主題分類標籤**（讀取每本書的簡介，為其自動添加主題標籤或關鍵詞，方便主題檢索）。
7.  **幫我推薦適合各年級的閱讀清單**（分析不同年級學生的閱讀水平和偏好，從館藏中生成各年級推薦書單，供老師參考[grtech.com](https://www.grtech.com/blog/ai-librarian-21-things-you-can-do-with-one#:~:text=2,Reading%20Lists%20%E2%9C%AA)）。
8.  **幫我產生月度借閱報告**（自動統計每月借閱總冊數、最熱門書籍前10名、各分類借閱比例等，輸出圖表報告）。
9.  **幫我通知逾期未還者**（自動撰寫溫馨的提醒短信或Email，通知逾期未還的學生或家長，語氣禮貌並附帶所借書信息）。
10.  **幫我為新進館藏撰寫簡介**（根據新書內容自動生成一段簡短介紹或讀後感，便於在佈告欄或校網推薦新書時使用）。
11.  **幫我分析館藏使用趨勢**（利用借閱數據進行挖掘，比如找出年度借閱高峰月份、某類書逐年借閱增減趨勢，提供圖書館使用趨勢洞察）。
12.  **幫我按圖書內容建議分類號**（對於拿到的新書，AI閱讀其摘要後建議適合的分類號，例如杜威分類主類，供沒有專業知識的老師參考）。
13.  **幫我充當圖書館線上問答**（在聊天介面中回答學生關於館藏的提問，如“有沒有關於恐龍的故事書？”並據館藏資訊給出建議）。
14.  **幫我校對學生書目列表格式**（當學生交來參考書目，AI可依指定格式（如APA）檢查並糾正格式錯誤，確保書目格式正確）。
15.  **幫我將館藏資料導出多種格式**（AI依指示將館藏清單轉成Excel、CSV或JSON等格式，並可根據需求過濾欄位或翻譯欄位標題）。

> 透過上述 AI 小助理任務，學校圖書館可將許多繁瑣或進階的分析工作自動化。例如，任務1和2協助**清理閒置館藏**，任務3和7提供**藏書發展建議**，任務5和12輔助**編目分類**，任務8、11是**報表分析**，任務9、13屬**讀者服務**，任務4、6則提高**資料品質**。這些都是傳統上需要專業館員投入時間的工作，如今AI可部分承擔：**節省人力、降低錯誤並提升服務品質**。值得注意的是，AI 小助理執行此類任務時，仍需定期由教師審核結果，以確保建議合理可行。例如淘汰書單需經人為判斷最終決策，新書推薦也應結合師生反饋調整。總體而言，善用 AI 可以彌補中小學圖書館專業人力的不足，讓“小助理”成為館員的得力幫手，\*\*實踐“用科技讓館藏管理更智慧”\*\*的目標。

**本章關鍵搜尋詞（中英）**：圖書館 AI 助理 library AI assistant、AI 館員 任務 automation tasks、未借兩年 圖書 清單 unborrowed books AI、館藏淘汰 建議 AI weeding suggestion、選書 推薦 AI acquisition recommendation、書目 錯誤 檢查 AI data cleaning、ISBN 自動編目 AI cataloging autofill、主題標籤 自動生成 AI subject tagging、閱讀清單 推薦 AI reading list、借閱 報告 自動生成 circulation report AI、逾期通知 AI overdue notification、館藏 趨勢 分析 AI usage analytics、AI 分類 建議 AI classification suggestion、圖書館 ChatGPT 諮詢 chatbot reference、格式 校對 AI citation format.

10:53 PM22:53

## Prompt:
ChatGPT-文獻 F 館藏管理系統規劃.md

File

你是我的「圖書資訊學 × 中小學圖書館系統」研究助理與資料策展員。我的目標是規劃並開發一套適合台灣中小學、在人力不足與預算有限情境下可快速導入的雲端圖書館管理系統（含編目、分類、主題分析、檢索、流通、館藏管理、使用者管理、統計報表），並在設計上兼顧圖資理論與實務流程。

請你用「大量蒐集與整理參考資料」的方式，建立一份「中英文對照、可追溯來源、可直接用於系統規格與企劃書」的資料庫。你的工作重點不是泛泛介紹，而是：
1) 提供概念與名詞的精確定義（中英文對照）
2) 指出在中小學場域中的常見做法、痛點與取捨（簡化策略）
3) 提供可落地的系統功能設計建議（資料欄位、規則、流程）
4) 優先引用權威來源（標準、官方文件、學術論文、圖書館專業機構）
5) 每個關鍵結論要附「來源線索」（可用：作者/機構、文件名、年份、章節/條目名稱、或可搜尋的關鍵字；若你具備瀏覽能力請直接附可查證的連結與引用）

【我的背景與限制】
- 我是台大圖資系大學部，有圖書資訊領域基礎。
- 目標使用者：沒有專職館員的中小學（教師兼任、行政負擔重）。
- 系統原則：少人力、低學習成本、資料結構正確、可擴充。
- 我希望輸出內容可以直接交給後續的 AI 小助理（未來要協助我做專案），因此你要「結構化」、「可復用」、「可轉成規格」。

【你要涵蓋的主題範圍（請全部處理）】
A. 編目（Cataloging）：書目記錄、欄位/分欄、著者/主題款目、控制款目、編目層級；MARC 21、ISBD、RDA（重點在理解結構與中小學簡化）
B. 分類（Classification）：DDC、索書號/類號、主題分類 vs 教學導向；分類亂用的現場問題；分類建議/視覺化架構
C. 主題分析（Subject Analysis）：主題標目、關鍵詞、自然語言 vs 控制詞彙、一致性；LCSH 概念；自訂中小學主題詞表
D. Metadata：描述/行政/結構/識別；Dublin Core；Application Profile（教育場域 metadata profile）
E. 資訊檢索（Information Retrieval）：查詢、欄位/全文、模糊搜尋、排序；Precision/Recall；小學生使用者行為；Browse vs Search
F. 館藏管理（Collection Management）：館藏發展、汰舊、流通率、生命週期；系統如何提示汰舊與未借書
G. 流通作業（Circulation）：借還、續借、預約、逾期；中小學流程簡化；自動化策略
H. 使用者管理（User Management）：角色權限、借閱隱私、學期升級/畢業、資料最小化
I. 資訊行為（Information Behavior）：兒童資訊尋求、瀏覽 vs 搜尋、UX 在圖資系統的應用
J. 資訊倫理與政策（Ethics & Policy）：借閱隱私、兒少資料保護、紀錄保存年限、最小蒐集原則

【輸出格式要求（請嚴格遵守）】
請分成 10 個章節（A-J）依序輸出，每章節都包含以下 8 個小節，並用清楚的標題：

1) 核心概念與名詞（中英文對照表）：至少 12 個術語，每個術語要有「一句話定義」與「同義詞/常見誤用」
2) 關鍵理論與必讀脈絡：列出 5-10 個必懂概念（含為何重要）
3) 標準/規範/權威資源：列出 5-10 項（機構、文件名、版本/年份、可搜尋線索或連結）
4) 中小學場域的簡化策略：哪些要做、哪些可不做、為什麼（列出具體取捨原則）
5) 對應到系統的資料欄位建議：用「欄位名/型別/是否必填/說明/例子」列出建議（至少 8 欄）
6) 對應到系統的功能設計建議：至少 8 條（用「需求→功能→為何」格式）
7) 常見坑與避雷清單：至少 8 條（含資料品質、一致性、使用者錯誤、維運）
8) 可交付給 AI 小助理的任務清單：至少 10 條（例如：幫我整理 DDC 教育版簡化、幫我找台灣中小學圖書館借閱規則案例…）

【額外要求】
- 請在每章結尾附上「本章關鍵搜尋詞（中英）」至少 15 個，讓我方便自行搜尋。
- 全文請以繁體中文為主，但術語必須保留英文。
- 不要只講概念，要能轉成「系統規格」與「提案文字」。
- 若遇到不同國家/機構的做法，請用「對照」方式呈現差異，並說明哪種較適合台灣中小學。
- 若你沒有即時瀏覽能力，請至少提供「可被搜尋驗證的完整線索」；若你有瀏覽能力，請把來源連結與引用一起放上。

請分析以下內容 並做相關的查詢文獻驗證

11:02 PM23:02

## Response:
Thought for 17m 27s

According to a document from 2016-08-11（並於 2021-04-08 修正），“館藏管理（Collection Management）”這一章如果要能「放進系統規格書 + 放進提案書」且不被專業審查打臉，**最需要釐清的不是你寫得不夠多，而是：幾個關鍵條文的解讀要改對、引用要換成更權威、更台灣本土可追溯的來源**。

你上傳要我檢核的草稿在這：

ChatGPT-文獻 F 館藏管理系統規劃

下面我會用「逐條主張驗證 + 來源品質審計 + 可直接改進規格」的方式，幫你把 F 章節從“看起來很完整”提升到“拿得去投標/送審也站得住”。

* * *

一、先講結論：你這份草稿最需要修的 3 個地方
-----------------------

1.  **「3%」不是你草稿寫的那種意思**  
    你草稿有把「3%」寫成像是“每年增置/新增館藏比例”的味道；但在教育部《圖書館設立及營運標準》裡，**3% 是「每年報廢上限」**（在不超過館藏量 3% 的範圍內，得依《圖書館法》第 14 條辦理報廢），不是採購增置KPI。
2.  **「每年館藏增加量 %」這件事要分學制，不是國小國中都適用**  
    「每年館藏增加量不得低於基本館藏 X%」這種敘述，在現行基準是**偏高級中等學校的規範**（例如普通型高中的 4% / 其他類型 2%），不是你可以拿來套到國小國中。
3.  **你的引用清單裡有幾個“會被抓包”的來源（要換掉）**  
    像 Studocu、個人 Blog、Instagram 這種，當作「延伸閱讀」OK，但要當作規格書的“關鍵依據”會被挑戰。你需要把核心依據換成：
    *   教育部主管法規（edu.law.moe.gov.tw）
*   國教署補助要點與新聞稿（edu.tw）
*   國家圖書館/公資圖/國教院等公部門正式文件
*   IFLA（官方 repository）與 ALA（官方 toolkit）  
    我下面會給你一份「可直接替換到草稿」的權威來源對照。

* * *

二、逐條主張驗證（Claim Audit）：哪些 OK、哪些要修、怎麼修
------------------------------------

> 我先抓「最會影響系統規格」的主張來核對（尤其會牽涉到資料欄位與業務規則的）。

| 草稿主張（你文件中的核心意思） | 驗證結果 | 正確/可引用的表述（建議改寫） | 可追溯來源（權威） |
| --- | --- | --- | --- |
| 中小學圖書館需要訂「館藏發展政策」（Collection Development Policy, CDP） | ✅ 正確 | 圖書資訊選擇與採訪須符合設置目的並配合校務/社區特性，**應訂定館藏發展政策**，內容至少涵蓋蒐藏範圍、徵集工具、採訪分級、館藏評鑑與維護；並邀請使用者代表參與並公告。 | 教育部《圖書館設立及營運標準》第7條 |
| 國小/國中館藏量基準：國小 6000 種或每生 40 種；國中 9000 或每生 60 種（含期刊報紙最低量） | ✅ 正確（但要用官方表格/年鑑佐證） | 國小：至少 6000 種/件或每生 40 種以上；超過 13 班之後每增 1 班增加一定量；期刊至少 15 種、報紙 3 種（國中另有更高基準）。 | 《圖書館設立及營運標準》附表二（表格） ；另可用台灣中小學館藏現況調查佐證落差（期刊達標率問題） |
| 中小學圖書館購置圖書資訊經費有比例原則（例如國小國中 10%） | ✅ 正確 | 國民中學/國民小學圖書館：購置圖書資訊經費以**占教學設備費 10% 以上為原則**（高中另有不同％）。 | 教育部《圖書館設立及營運標準》第6條 |
| “每年館藏增加量至少達總館藏 3%”（或類似意思） | ❌ 需要修正（概念用錯） | **3% 是「報廢上限」不是「增置下限」**：圖書館定期清點；每年在不超過館藏量 3% 範圍內得依《圖書館法》第14條辦理報廢。若要談增置％，需分學制（高中另有年增置比例）。 | 《圖書館設立及營運標準》第8條（清點+報廢 3%） ；國教院館藏淘汰要點引用《圖書館法》第14條（3%） ；附表二高中年增置比例 |
| 館藏量需在發布日起 5 年內達標 | ✅ 正確（而且這會變成系統的「合規儀表板」需求） | 公立公共圖書館及各級學校圖書館之館藏量，應於標準發布日起五年內符合附表二。 | 《圖書館設立及營運標準》第13條 |
| 閱讀推動教師/圖書教師計畫與補助可作為館藏/閱讀推廣的人力與經費來源 | ✅ 正確（且你應該把它寫進“導入策略”） | 國教署自 98 學年度起辦理「增置國民中小學圖書館閱讀推動教師計畫」，並在近年持續補助學校；補助與金額、期程可依最新要點。 | 教育部新聞稿（含起始學年與最新年度補助概況） ；國教署閱讀素養教育補助作業要點（含圖書教師補助基準） |
| 汰舊可用 CREW/MUSTIE 作為作業框架 | ✅ 可用（但要把它降級成“工具方法”，主規範仍以台灣法規/機關要點為主） | CREW（Continuous Review, Evaluation, and Weeding）強調把盤點、維護、評估、汰舊變成常態流程；MUSTIE 是常用汰舊因子框架（在 CREW 手冊中有章節）。 | CREW 手冊（Texas State Library & Archives Commission, 2012） ；ALA 建議需有書面政策含 selection/deselection/weeding |
| 台灣現場痛點：期刊/報紙不易達標、數位資源多仰賴公共圖書館 | ✅ 有台灣實證可撐 | 台灣中小學圖書館現況調查顯示，**期刊達營運基準比例偏低**；數位資源館藏多數偏少，且常見與公共圖書館資源結合。 | 國家圖書館系統釋出的中小學圖書館現況（圖書館年鑑專題調查） |

* * *

三、你草稿的「來源品質審計」：哪些該留、哪些該換（台灣優先）
------------------------------

### 1) 建議保留（或升級成核心引用）的來源

*   **教育部主管法規共用系統：**《圖書館設立及營運標準》（含經費比率、CDP、清點報廢 3%、五年達標）
*   \*\*教育部/國教署：\*\*閱讀推動教師政策與補助要點（可以支撐“導入方案”與“人力配置”）
*   \*\*國家教育研究院（歷史法規但很能用）：\*\*館藏淘汰的定義、程序語言、3% 來源（引用《圖書館法》第14條）
*   **國立公共資訊圖書館（公資圖）作業要點：**“報廢暨移轉”處理的可操作流程範本（非常適合轉成系統工作流）
*   \*\*國家圖書館/圖書館年鑑資料：\*\*台灣中小學館藏現況與落差（拿去提案最有說服力）
*   \*\*ALA（工具包）：\*\*selection/deselection/weeding/reconsideration 應有政策，且需定期更新（用來支撐“政策化、可被治理”）
*   \*\*IFLA（官方 repository）：\*\*School Library Guidelines / Manifesto（用於“國際脈絡”與理念段落，不必硬套全合規）

### 2) 建議降級（只能當延伸閱讀，不要當關鍵依據）

*   Studocu 之類的二手轉載（容易遇到版本不明、內容被刪、來源不可考）
*   個人 blog/社群貼文（除非是官方帳號或機構公告）
*   商業顧問或非正式簡報（可以借用敘事，但不要拿來背書法規或標準）

> 你要的是「可直接進規格/企劃」：核心引用就得站在“主管機關法規 + 公部門作業要點 + 國際機構官方文件”上。

* * *

四、把「文獻驗證」直接轉成「系統規格」：我建議你補上的資料欄位與規則
----------------------------------

你草稿本來的欄位設計方向是對的，但要更像“能上線的館藏管理模組”，我建議加這些（特別是跟台灣法規/作業要點直接對應的）：

### 1) 建議新增/調整的欄位（針對館藏管理模組）

**（A）館藏發展政策 CDP（Policy）**

*   `policy_id`（UUID，必填）：政策主檔
*   `policy_version`（string，必填）：例如 v1.0 / 2025S1
*   `scope_statement`（text，必填）：蒐藏範圍（對應第7條）
*   `selection_tools`（text，選填）：徵集工具（書評/得獎書單/推薦清單）
*   `acquisition_level`（enum，選填）：採訪分級（例如核心/加強/補充）
*   `evaluation_maintenance_rules`（text，必填）：館藏評鑑與維護原則
*   `user_representatives`（json，選填）：使用者代表（學生/教師）參與紀錄（對應第7條“邀請使用者代表”）
*   `last_reviewed_at`（date，必填）：政策最近審查日期（方便做提醒）

**（B）清點/盤點（Inventory）**

*   `inventory_batch_id`（UUID，必填）
*   `inventory_type`（enum，必填）：例行/抽查/移交/盤點前汰舊
*   `started_at` / `closed_at`（datetime）
*   `coverage`（enum）：全館/某分類/某書區
*   `exceptions_count`（int）：遺失、錯架、條碼重複等

**（C）汰舊/報廢/移轉（Weeding & Disposal）**

*   `weed_candidate_flag`（bool）
*   `weed_reason_code`（enum，必填）：破損/過時/重複/低使用/不符館藏政策…（可參照國教院要點語氣）
*   `disposal_method`（enum，必填）：報廢/移轉/贈送/回收（公資圖作業要點有很好的流程語言可借）
*   `writeoff_year`（int，必填）：用來計算每年報廢比例（對應 3% 上限）
*   `approval_doc_no`（string，選填）：校內核准文號/會議紀錄（符合學校行政需求）
*   `writeoff_percentage_snapshot`（decimal，系統計算）：該年度報廢佔總館藏比例（合規儀表板）

**（D）預算/經費（Budget）**

*   `teaching_equipment_budget`（int，年度）
*   `acquisition_budget`（int，年度）
*   `acquisition_budget_ratio`（decimal，系統計算）：國中小目標 10%（對應第6條）
*   `funding_source`（enum）：校務預算/國教署補助/家長會/捐款（閱讀素養補助要點可支撐“補助”欄位存在）

### 2) 你規格書裡應該明寫的 6 條「可測試」規則（Business Rules）

1.  **CDP 必須存在**：系統啟用館藏採購/受贈流程前，必須至少建立一份有效版本的館藏發展政策（對應第7條）。
2.  **年度經費比率提示**：國中小若 `acquisition_budget_ratio < 0.10`，系統在年度結算報表提示“未達建議比率”（不是硬鎖，避免學校現實爆炸）。
3.  **報廢 3% 警戒線**：當年度已核准報廢數量 / 年初館藏量 > 0.03，系統強制進入“需主管加簽/需上傳核准文件”的流程（對應第8條 + 法14）。
4.  **館藏達標儀表板**：顯示國小 6000 或 每生40、期刊15、報紙3 等達標狀態；並顯示“與基準差距”。
5.  **盤點閉環**：每次盤點批次關閉前，必須處理“缺失清單”（遺失/待查/已賠償/已除帳），不讓資料卡在半空中。
6.  **捐贈與採購都走同一套評估**：受贈也要選擇 `weed_reason_code / accept_reason_code`，避免“捐什麼收什麼”導致館藏品質崩盤（這是台灣學校超常見痛點；你系統要替老師擋子彈）。

* * *

五、你草稿中「可直接替換」的兩段文字（我幫你改成不會被挑的版本）
--------------------------------

### 段落 1：把 3% 說清楚（避免被抓包）

> 建議改成這樣：  
> 教育部《圖書館設立及營運標準》規定，圖書館應定期辦理館藏清點，並得於每年不超過館藏量 3% 的範圍內，依《圖書館法》第 14 條規定辦理報廢；因此系統需能支援盤點批次、報廢申請/核准、報廢理由與年度比例控管，以降低學校在財產管理與稽核上的風險。

### 段落 2：把「館藏達標」變成系統 KPI（提案很吃香）

> 建議改成這樣：  
> 依《圖書館設立及營運標準》附表之館藏發展基準，中小學圖書館需滿足最低館藏量與期刊報紙配置；同時台灣中小學圖書館現況調查顯示，期刊與報紙等連續性出版品的達標比例偏低。系統應提供“館藏基準達標儀表板”與“差距清單”，協助兼任管理者用最少時間，掌握採購優先順序。

* * *

六、加值：你可以把「閱讀推動教師」直接寫成導入策略（這段超台灣、也超實務）
-------------------------------------

如果你提案要強調“低人力可導入”，閱讀推動教師（圖書教師）就是你的官方靠山：

*   國教署自 98 學年度起推動增置閱讀推動教師計畫，並在 114 學年度仍有補助學校與經費規模（可當作“政策延續性”與“人力支持”證據）。
*   補助作業要點裡明訂圖書教師補助基準、圖書館館藏充實、閱讀角建置等補助項目；你的系統可以把這些變成「內建模板報表/成果輸出」。

這會直接支持你系統的功能：

*   「年度閱讀推動成果報告自動產生」
*   「補助經費科目與使用證明整理」
*   「圖書館館藏充實採購清單 + 佐證統計」

* * *

七、給你（和未來 AI 小助理）的下一步檢索任務清單（全都可被查證）
----------------------------------

1.  整理《圖書館設立及營運標準》**第6/7/8/13條**，逐條轉成系統驗收條款（AC）。
2.  把附表二（國小/國中/高中）做成 **可機算的門檻表**（輸入學生數、班級數 → 自動算最低館藏）。
3.  蒐集 5 所台灣學校（國小/國中/高中各至少1）公開的「館藏發展政策」當作範本，比對共同欄位（選書小組、受贈原則、複本原則、汰舊原則）。
4.  從《教育部國民及學前教育署推動…閱讀素養教育補助作業要點》萃取：補助項目、金額上限、成果結報要素，轉成系統報表欄位。
5.  以「台灣中小學圖書館發展現況」找出：期刊/報紙/數位資源未達標的比例與原因，做成你提案的“痛點數據圖”。
6.  把國教院《館藏淘汰實施要點》的“報廢/撤架”語彙整理成 **汰舊理由代碼表（controlled vocabulary）**。
7.  解析公資圖「館藏報廢暨移轉處理作業要點」，整理出 **報廢/移轉工作流（含簽核點）**，套用到學校情境的簡化版。
8.  讀 CREW 手冊的 “CREWing children’s materials / disposal slip template”，抽出 **學校版最低限度汰舊規則**（例如：破損必處理、低使用列入候選但需人工確認）。
9.  建立「館藏健康度指標」：流通率、館藏周轉率、0 借閱清單、近 5 年出版比、損毀率；並設計如何在台灣現場不增加老師負擔。
10.  針對“捐贈爆量”情境，設計一個 **10 分鐘可完成** 的受贈評估流程（含自動拒收模板、感謝函模板）。
11.  蒐集各縣市教育局（若有）對學校財產報廢/移轉的行政流程差異，列出你系統需可配置的欄位（文號、會議、簽核層級）。
12.  從 IFLA School Library Guidelines/Manifesto 摘出 5 條可用在提案“理念段落”的句型，並對應到你系統模組（瀏覽、課程支援、資訊素養）。

* * *

八、本章（館藏管理）關鍵搜尋詞（中英）—給你快速擴充文獻用（≥15）
----------------------------------

*   館藏發展政策 Collection Development Policy (CDP)
*   館藏管理 Collection Management
*   汰舊 Weeding / Deselection
*   報廢 Withdrawal / Discarding
*   館藏清點 Inventory (Library)
*   館藏發展基準 Collection development standards / Minimum collection standards
*   周轉率 Turnover rate
*   流通率 Circulation rate
*   零借閱 Zero-circulation / Non-circulating items
*   採訪 Selection & Acquisition
*   受贈 Gifts and Donations
*   選書小組 Selection committee
*   使用者代表 User representatives
*   教學設備費 Teaching equipment budget
*   館藏評鑑 Collection evaluation / Assessment
*   MUSTIE factors MUSTIE
*   CREW method Continuous Review, Evaluation, and Weeding
*   閱讀推動教師 Teacher librarian / Reading promotion teacher / School library media specialist
*   閱讀素養 Reading literacy
*   教育部主管法規 edu.law.moe.gov.tw（關鍵來源域名）

* * *

如果你願意，我下一步可以直接幫你做兩件“能立刻提高可交付度”的工作（不需要你再補資料）：

1.  把你草稿中涉及法規的句子，逐句標註「應改寫」與「可直接引用條文」
2.  依照你系統要做的模組，把 **F 章節的欄位字典（Field Dictionary）** 產出成可貼進 PRD/規格書的版本（含代碼表、預設值、驗收條件）

你只要回我：你希望輸出偏「PRD格式」還是偏「資料庫 schema + API payload」我就直接開工。

11:12 PM23:12



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)