# 文獻 I 中小學圖書館系統規劃

**User:** 呂翊銘 (b0979865617@gmail.com)  
**Created:** 12/23/2025 23:57:22  
**Updated:** 12/24/2025 0:17:57  
**Exported:** 12/24/2025 0:18:06  
**Link:** [https://chatgpt.com/g/g-p-694aa49ab4888191948b654ebba514ab-zhong-xiao-xue-tu-zi-xi-tong/c/694abbe0-b38c-8322-9e85-6989624618dd](https://chatgpt.com/g/g-p-694aa49ab4888191948b654ebba514ab-zhong-xiao-xue-tu-zi-xi-tong/c/694abbe0-b38c-8322-9e85-6989624618dd)  

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

現在開始，先輸出 I. 資訊行為（Information Behavior）

## Response:
Thought for 12m 41s

I. 資訊行為（Information Behavior）
-----------------------------

* * *

### 1) 核心概念與名詞（中英文對照表）

| 術語（中文 / English） | 一句話定義 | 同義詞 / 常見誤用（你在系統規格要避免的） |
| --- | --- | --- |
| 資訊行為 / **Information behavior** | 人在各種情境下，與資訊來源與資訊管道互動的**全部行為總和**（含主動、被動、使用與分享）。 | 常被誤用成只等於「搜尋（search）」；或只談 OPAC 操作而忽略情境、情緒與社會因素。 |
| 資訊尋求 / **Information seeking** | 為了達成目標而進行的**有目的的找資訊活動**（找什麼、去哪找、問誰）。 | 常與 information searching 混用；也常被誤解為「只在系統內找」。 |
| 資訊搜尋 / **Information searching** | 使用者在資訊系統中進行查詢、篩選、點選、修正查詢等**系統互動層面的行為**。 | 常被誤當成 seeking 的全部；忽略「先問同學/老師」等非系統行為。 |
| 資訊使用 / **Information use** | 將取得的資訊拿來做理解、決策、寫作、報告、分享等**後續使用**。 | 常被系統設計忽略，導致只做「找到」不支援「用得上」。 |
| 資訊需求 / **Information need** | 個體在情境中感到「需要知道」的狀態，通常只能透過行為與表述**間接觀察**。 | 誤用為「系統功能需求」或把需求當成固定不變；忽略需求會在探索中改變。 |
| 不確定性 / **Uncertainty** | 在搜尋初期常見的焦慮、模糊與不確定感，會隨著聚焦逐步下降。 | 常被誤判為「學生不會用系統」；其實可能是題目尚未聚焦。 |
| 資訊搜尋歷程 / **Information Search Process, ISP** | 將資訊尋求視為分階段的歷程（如 initiation→selection→exploration→formulation→collection→presentation），並強調情緒/認知/行動的變化。 | 常被誤用成「線性流程」，但實務上會來回反覆。 |
| 意義建構 / **Sense-making** | 使用者在「情境—落差（gap）—橋接策略（bridge）—結果」中建構可用的理解與行動。 | 常被誤當成「資料很多就會懂」；忽略介面要幫忙跨越 gap。 |
| 瀏覽 / **Browsing** | 不以精準關鍵詞為前提，透過分類、主題、封面、推薦等方式逐步縮小範圍的尋找方式。 | 常被視為「不會搜尋才用」；但對兒童與新手其實是主要路徑。 |
| 莓果採摘 / **Berrypicking** | 查詢目標與線索會在過程中不斷變動，使用者透過多次小步驟（點選、回退、改詞、追引用）逐步「採集」資訊。 | 誤用成「隨便亂找」；其實可被系統以可回溯與多入口設計支持。 |
| 查詢形成 / **Query formulation** | 將腦中的問題轉成可輸入的詞（或語音/選單）並能修正與擴充。 | 常忽略兒童的拼字/輸入法/詞彙不足，導致「零結果」挫折。 |
| 認知負荷 / **Cognitive load** | 使用者在理解介面、閱讀結果、做選擇時的心智負擔。 | 常被誤當成「介面資訊越多越好」；對中小學反而要減量、分步。 |
| 相關性判斷 / **Relevance judgment** | 使用者判斷結果是否「對我有用」的評估，受任務、年齡、閱讀能力與呈現方式影響。 | 常被設計成只給書目資訊；但兒童更需要封面、簡介、難易度線索。 |
| 資訊視域 / **Information horizon** | 個體可動用的資訊資源版圖（人、工具、網站、書、經驗），且資源之間有相對可近性。 | 常被誤解為「只有網路/只有圖書館」；忽略老師與同儕是關鍵節點。 |
| 日常生活資訊尋求 / **Everyday Life Information Seeking, ELIS** | 人在日常生活（興趣、社交、娛樂、家庭）中的資訊尋求模式，與課業任務不同。 | 常被學校系統忽略，導致只支援「作業找資料」不支援「興趣閱讀」。 |

> 本表定義與脈絡主要參考：Wilson 對 information behavior/ seeking/ searching 的界定、Kuhlthau 的 ISP 與不確定性、Bates 的 berrypicking、Dervin 的 sense-making、Savolainen 的 ELIS，以及兒童搜尋研究（Druin、Bilal 等）。 [Wiley Online Library+6inform.nu+6Rutgers SC&I Wordpress Network+6](https://inform.nu/Articles/Vol3/v3n2p49-56.pdf?utm_source=chatgpt.com)

* * *

### 2) 關鍵理論與必讀脈絡（5–10 個必懂概念：含為何重要）

1.  **「行為」大於「搜尋框」：Wilson 的資訊行為總覽視角**
    *   為何重要：學童常「先問同學/老師、再上網、最後才到圖書館」，如果系統只優化搜尋框，會錯失支援真正流程的機會。 [inform.nu+1](https://inform.nu/Articles/Vol3/v3n2p49-56.pdf?utm_source=chatgpt.com)
    *   落地到系統：設計「瀏覽入口」「任務導引」「可請求協助」「推薦與書單」等，讓資訊取得不是只有查詢。
2.  **Kuhlthau ISP：把「不確定與焦慮」當成正常狀態來設計**
    *   為何重要：探索期資訊越多可能越不確定；若介面只回傳大量結果，會加劇挫折。 [Rutgers SC&I Wordpress Network+1](https://wp.comminfo.rutgers.edu/ckuhlthau/information-search-process/?utm_source=chatgpt.com)
    *   落地到系統：提供「逐步縮小」與「聚焦提示」（例如：你想找人物/地點/原因/做法？）而不是只堆結果。
3.  **Bates berrypicking：真實搜尋是非線性、反覆修正的**
    *   為何重要：孩子會點進去、回來改字、換類別、追同系列；系統需要支援「回溯與多入口」。 [GSEIS Pages+1](https://pages.gseis.ucla.edu/faculty/bates/berrypicking.html?utm_source=chatgpt.com)
    *   落地到系統：提供「最近看過」「你剛才用過的篩選」「搜尋路徑 breadcrumbs」「一鍵回到結果」。
4.  **Dervin Sense-making：情境—落差—橋接策略**
    *   為何重要：學生常說不清楚要什麼（gap），系統應提供可被理解的橋（bridge），例如：範例問題、同義詞、主題卡。 [tefkos.comminfo.rutgers.edu+1](https://tefkos.comminfo.rutgers.edu/Courses/612/Articles/DervinMindseye.pdf?utm_source=chatgpt.com)
    *   落地到系統：以「提問模板」與「選擇題式的需求澄清」降低表述門檻。
5.  **兒童搜尋研究：拼字/輸入/查詢形成/讀結果都是障礙**
    *   為何重要：研究指出即使「常用網路」，孩子仍會被拼字、打字、查詢形成與理解結果頁卡住。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
    *   落地到系統：強制內建容錯（錯字、近義詞、模糊比對）、提供語音/選單式查詢、結果頁「少而精」。
6.  **瀏覽偏好與成功率：孩子常更擅長用目錄/分類瀏覽找到資料**
    *   為何重要：在 Yahooligans（目錄式）等研究中，孩子瀏覽常比關鍵詞搜尋更有效，但他們仍「偏好打字搜」。 [Wiley Online Library+1](https://asistdl.onlinelibrary.wiley.com/doi/abs/10.1002/%28SICI%291097-4571%282000%2951%3A7%3C646%3A%3AAID-ASI7%3E3.0.CO%3B2-A?utm_source=chatgpt.com)
    *   落地到系統：同時提供「可視化瀏覽」與「搜尋框」，並在搜尋失敗時自動引導到可行的瀏覽路徑。
7.  **資訊視域（information horizon）：老師與同儕是重要資訊節點**
    *   為何重要：台灣研究也顯示學童常依賴父母/他人協助，且教師/導師對閱讀與使用行為影響大。 [Airiti Library+1](https://www.airitilibrary.com/Article/Detail/16822889-200403-201308190035-201308190035-92-106?utm_source=chatgpt.com)
    *   落地到系統：把「老師推薦」「班級書單」「同儕熱門」做成正式入口，而不是只做館員後台功能。
8.  **Human-centred design：把年齡層差異視為不同產品模式（不是同一套 UI）**
    *   為何重要：ISO 9241-210 強調以使用者需求與情境驅動設計；小一與國九的能力差異巨大。 [ISO+1](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
    *   落地到系統：以「學段模式（低/中/高年級）」切換：文字量、結果呈現、輸入方式、瀏覽粒度都不同。

* * *

### 3) 標準 / 規範 / 權威資源（5–10 項：機構、文件名、年份、可查證線索或連結）

> 這一節你可以直接搬進企劃書的「理論依據與設計依循」。

1.  **T.D. Wilson**｜_Human Information Behavior_｜2000
    *   用途：information behavior / seeking / searching 的基本界定，適合用來寫「本系統為何要做瀏覽、推薦、求助入口」。 [inform.nu](https://inform.nu/Articles/Vol3/v3n2p49-56.pdf?utm_source=chatgpt.com)
2.  **Carol C. Kuhlthau**｜_Information Search Process (ISP)_（含 stages 與 uncertainty）｜1991/2004 脈絡
    *   用途：把「不確定性」納入需求與介面設計，支撐「分步導引」與「聚焦提示」。 [Rutgers SC&I Wordpress Network+1](https://wp.comminfo.rutgers.edu/ckuhlthau/information-search-process/?utm_source=chatgpt.com)
3.  **Marcia J. Bates**｜_The Design of Browsing and Berrypicking Techniques_｜1989
    *   用途：支撐「非線性搜尋」「多入口」「可回溯」的互動設計。 [GSEIS Pages](https://pages.gseis.ucla.edu/faculty/bates/berrypicking.html?utm_source=chatgpt.com)
4.  **Brenda Dervin**｜_Sense-Making_（From the Mind’s Eye of the User…）｜1992（經典方法論線）
    *   用途：用於設計「提問模板」「需求澄清」與「橋接策略」（同義詞、範例、任務卡）。 [tefkos.comminfo.rutgers.edu](https://tefkos.comminfo.rutgers.edu/Courses/612/Articles/DervinMindseye.pdf?utm_source=chatgpt.com)
5.  **Reijo Savolainen**｜_Approaching information seeking in the context of “way of life” (ELIS)_｜1995
    *   用途：支撐「不只課業，也要支援興趣/休閒閱讀」的系統定位。 [ScienceDirect](https://www.sciencedirect.com/science/article/pii/0740818895900489?utm_source=chatgpt.com)
6.  **Allison Druin et al. (ACM)**｜_How children search the Internet with keyword interfaces_｜2009
    *   用途：兒童在拼字、輸入、查詢形成、理解結果頁的障礙與介面建議；可直接轉成需求。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
7.  **Dania Bilal (JASIST)**｜_Children’s use of the Yahooligans! Web search engine…_｜2000（系列研究）
    *   用途：孩子「瀏覽較成功但仍偏好打字搜」的矛盾，支撐「搜尋＋瀏覽雙主軸」。 [Wiley Online Library+1](https://asistdl.onlinelibrary.wiley.com/doi/abs/10.1002/%28SICI%291097-4571%282000%2951%3A7%3C646%3A%3AAID-ASI7%3E3.0.CO%3B2-A?utm_source=chatgpt.com)
8.  **IFLA（國際圖聯）**｜_IFLA School Library Guidelines (2nd revised edition)_｜2015
    *   用途：用於提案中的「學校圖書館服務應以教與學為核心、以使用者為中心」的國際權威依據。 [IFLA+1](https://www.ifla.org/files/assets/school-libraries-resource-centers/publications/ifla-school-library-guidelines.pdf?utm_source=chatgpt.com)
9.  **ISO**｜_ISO 9241-210:2019 Human-centred design for interactive systems_｜2019
    *   用途：把「以使用者需求與情境驅動設計」寫進系統開發流程與驗收。 [ISO+1](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
10.  **台灣研究線索（代表性，供在地化）**｜（可在 NDLTD / Airiti 查證）
    *   國小高年級網路資訊尋求（台北市、訪談/關鍵事件回憶、常見困難：找不到資料等）｜2004｜Airiti/NTU PDF [Airiti Library+1](https://www.airitilibrary.com/Article/Detail/16822889-200403-201308190035-201308190035-92-106?utm_source=chatgpt.com)
*   國高中生網路資訊尋求影響因素（台北市、問卷、常見障礙：找不到資料/速度慢/垃圾資訊）｜2003｜NDLTD/Airiti [NCLTD+1](https://ndltd.ncl.edu.tw/r/n28e9a?utm_source=chatgpt.com)
*   兒童 OPAC 發展與使用（兒童檢索點偏好、困難類型、需要兒童友善介面）｜（淡江大學論文/NDLTD） [NCLTD](https://ndltd.ncl.edu.tw/r/10485064641369836584?utm_source=chatgpt.com)

* * *

### 4) 中小學場域的簡化策略（哪些要做、哪些可不做、為什麼）

> 目標：**在沒有專職館員、低訓練成本**下，讓孩子「找得到、借得到、想再來」。

#### 4.1 取捨原則（建議直接寫進產品原則/需求文件）

1.  **先支援「自然行為」，再談「理想行為」**：孩子先天偏好瀏覽、點前幾筆、用自然語言；系統要順著行為設計，而不是要求他們先學會布林檢索。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
2.  **把「不確定性」視為正常**：搜尋初期焦慮不是錯誤；介面要提供聚焦與下一步提示。 [Rutgers SC&I Wordpress Network+1](https://wp.comminfo.rutgers.edu/ckuhlthau/information-search-process/?utm_source=chatgpt.com)
3.  **低年級：減少輸入、增加可視化與選擇題式互動**；高年級：逐步提供更多欄位與篩選（但仍要容錯）。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
4.  **少人力維運：優先做「可自動生成」的引導**（例如：自動同義詞、常見錯字、年級書單模板），避免需要館員天天維護。
5.  **行為資料以「匿名聚合」為原則**：要能改善系統，但不建立個人可追溯的長期搜尋史（這會牽涉隱私與學校風險；細節可放到 J 章）。 [ISO](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)

#### 4.2 「必做 / 可後做」清單（MVP 導向）

*   **MVP 必做（強烈建議）**
    *   搜尋＋瀏覽雙入口（封面牆、分類/主題卡、熱門/推薦）
    *   查詢容錯：錯字、同音/近形（中文）、同義詞、模糊比對
    *   結果頁「少而清楚」：Top N 優先、可視覺線索（封面/難易度/系列）
    *   低年級模式：大按鈕、少字、圖像分類、語音/拼音/注音輔助（可先做「選單式」替代語音）
    *   事件級匿名分析（只存 query、點選位置、是否零結果等）用於改善搜尋品質
*   **Phase 2 可做（看資源）**
    *   任務式導引（作業/報告嚮導、研究筆記、引用工具）對應 ISP 的後段
    *   個人化推薦（但要非常小心隱私與解釋性）
    *   深度學習分析（先用規則與同義詞字典通常就很夠）

#### 4.3 不同國家/情境做法對照（並給台灣中小學建議）

| 面向 | 國外兒童搜尋研究常見結論 | 台灣在地研究/現場線索 | 對台灣中小學系統建議 |
| --- | --- | --- | --- |
| 輸入與查詢形成 | 拼字、打字、找「正確關鍵詞」是障礙；孩子常用自然語言句子。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com) | 國小研究顯示「方便」是優點，但「找不到資料」是最大缺點；常用入口（早期）偏向入口網站/分類目錄。 [Airiti Library+1](https://www.airitilibrary.com/Article/Detail/16822889-200403-201308190035-201308190035-92-106?utm_source=chatgpt.com) | 中文情境更需要：同音/近形容錯、同義詞、以及「分類瀏覽＋建議詞」的混合介面。 |
| 社會支持 | 家庭環境與同儕會影響資訊取得（家用/校用情境不同）。 [ACM Digital Library](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com) | 偏遠地區研究指出「導師」是閱讀/使用行為關鍵影響者，開放時間也會影響借還。 [NLPI+1](https://www.nlpi.edu.tw/FileDownLoad/LibraryPublication/20190524110957532395960.pdf?utm_source=chatgpt.com) | 做「班級/老師書單」「老師推薦」入口；提供「班級到館/借閱窗口」設定以貼近學校作息。 |
| 人力與制度 | 多數研究假設有一定圖書館支援 | 台灣校圖長期困境：人力不足、經費/服務時數不足等。 [LAC](https://www.lac.org.tw/sites/default/files/field_files/publish/attach143.pdf?utm_source=chatgpt.com) | 介面要「自解釋」與「少維護」：預設值、模板、批次操作、錯誤防呆優先。 |

* * *

### 5) 對應到系統的資料欄位建議（至少 8 欄）

> 這裡的欄位是「支援兒童資訊行為」＋「讓系統可被持續改進」的最小集合；建議以**事件紀錄（event log）採匿名/去識別**方式保存（個資策略可在 J 章完整化）。

| 欄位名（CN / EN） | 型別 | 必填 | 說明（可直接寫進規格） | 例子 |
| --- | --- | --- | --- | --- |
| 使用者匿名代碼 / `user_pseudo_id` | string | 否 | 用於區分行為樣本但不可回推真實身分（可用每日/每週輪替 salt）。 | `u_8f3a…` |
| 學段 / `grade_band` | enum | 否 | 低/中/高年級或國中；用於分析介面是否適配。 | `E1-2` |
| 事件時間 / `event_ts` | datetime | 是 | 行為事件時間戳。 | `2025-12-23T10:21:33+08:00` |
| 事件類型 / `event_type` | enum | 是 | `search_submit`/`browse_open`/`result_click`/`filter_apply`/`no_result`… | `result_click` |
| 搜尋工作階段 / `session_id` | string | 是 | 將同一次尋找串起來（支援 berrypicking）。 | `s_20251223_ab12` |
| 查詢字串 / `query_text` | string | 否 | 使用者輸入的關鍵詞（若敏感可做雜湊＋保留前 N 字）。 | `恐龍化石` |
| 查詢來源 / `query_input_mode` | enum | 是 | `keyboard`/`suggestion`/`category`/`voice`（若未做語音可先保留） | `category` |
| 系統建議詞是否使用 / `used_suggestion` | boolean | 否 | 使用者是否點選自動完成/同義詞建議。 | `true` |
| 瀏覽入口 / `browse_entry` | enum | 否 | `ddc`/`subject`/`series`/`teacher_list`/`popular`… | `teacher_list` |
| 篩選器快照 / `filters_json` | json | 否 | 記錄套用的篩選（館藏地點、年級推薦、語言、媒體類型…）。 | `{"lang":"zh","type":"book"}` |
| 結果數 / `result_count` | int | 否 | 回傳結果筆數（零結果判斷）。 | `0` |
| 點選結果排名 / `clicked_rank` | int | 否 | 點選的是第幾筆（孩子常點前幾筆，影響排序設計）。 [ResearchGate](https://www.researchgate.net/publication/221238265_How_children_search_the_Internet_with_keyword_interfaces) | `1` |
| 點選的書目ID / `clicked_bib_id` | string | 否 | 用於分析哪類資源被找到與被忽略。 | `bib_001239` |
| 首次點選耗時 / `time_to_first_click_ms` | int | 否 | 用於衡量介面清晰度與困惑程度。 | `4200` |
| 失敗原因標記 / `failure_reason` | enum | 否 | `no_result`/`too_many`/`gave_up`（由規則推論）。 | `no_result` |

> 欄位設計背後的行為理據：支援非線性歷程（berrpicking）、降低兒童查詢形成障礙並可回頭改善（children search studies）。 [GSEIS Pages+2ACM Digital Library+2](https://pages.gseis.ucla.edu/faculty/bates/berrypicking.html?utm_source=chatgpt.com)

* * *

### 6) 對應到系統的功能設計建議（至少 8 條：需求→功能→為何）

1.  **需求：低年級打字/拼字/輸入法困難** → **功能：圖像化分類瀏覽＋建議詞按鈕（可一句話問題模板）** → **為何：降低 query formulation 門檻，符合兒童障礙研究。** [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
2.  **需求：孩子常點前幾筆、很少翻頁** → **功能：結果頁「Top 5 大卡片」＋「最相關先呈現」＋「避免密集文字」** → **為何：結果頁設計需符合兒童選擇行為，否則找不到就放棄。** [ResearchGate+1](https://www.researchgate.net/publication/221238265_How_children_search_the_Internet_with_keyword_interfaces)
3.  **需求：搜尋初期越找越不確定** → **功能：探索期提示（例如：你想找「人物/事件/做法/原因」？）＋一鍵縮小建議** → **為何：對應 ISP 的 exploration→formulation 轉折，幫使用者聚焦。** [Rutgers SC&I Wordpress Network+1](https://wp.comminfo.rutgers.edu/ckuhlthau/information-search-process/?utm_source=chatgpt.com)
4.  **需求：孩子喜歡瀏覽，但又習慣先打字** → **功能：搜尋失敗自動切換到「可走的瀏覽路徑」（主題卡/分類樹/系列書）** → **為何：Bilal 指出瀏覽常更有效，系統應把成功路徑顯性化。** [Wiley Online Library](https://asistdl.onlinelibrary.wiley.com/doi/abs/10.1002/%28SICI%291097-4571%282000%2951%3A7%3C646%3A%3AAID-ASI7%3E3.0.CO%3B2-A?utm_source=chatgpt.com)
5.  **需求：同義詞/口語詞與編目詞不一致** → **功能：學生友善詞彙（student-friendly terms）對映表＋「你是不是想找…」** → **為何：用 sense-making 的 bridge 概念，讓使用者跨越詞彙落差。** [tefkos.comminfo.rutgers.edu+1](https://tefkos.comminfo.rutgers.edu/Courses/612/Articles/DervinMindseye.pdf?utm_source=chatgpt.com)
6.  **需求：學校情境中老師/班級是行為推力** → **功能：老師推薦書單、班級書單入口、同班熱門** → **為何：資訊視域中「人」是關鍵節點；台灣研究也支持導師影響。** [NLPI+1](https://www.nlpi.edu.tw/FileDownLoad/LibraryPublication/20190524110957532395960.pdf?utm_source=chatgpt.com)
7.  **需求：沒有專職館員，訓練時間極少** → **功能：模式化 UI（低/中/高年級切換）＋預設值＋一步完成（借閱/查找）** → **為何：human-centred design 要以情境限制設計；人力不足是現實。** [ISO+1](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
8.  **需求：想持續改善搜尋品質，但不想蒐集敏感個資** → **功能：匿名事件記錄＋聚合報表（零結果詞、常用入口、放棄率）** → **為何：以行為資料改善介面與同義詞庫，而不建立個人化監控。** [inform.nu+1](https://inform.nu/Articles/Vol3/v3n2p49-56.pdf?utm_source=chatgpt.com)
9.  **需求：孩子需要快速判斷「這本適不適合我」** → **功能：結果卡顯示封面、簡短摘要、年級建議/難易度、系列標記** → **為何：提升 relevance judgment 的可見線索，降低認知負荷。 [ACM Digital Library](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)**
10.  **需求：不同能力的學生需要可及性（易讀、可操作）** → **功能：字級可調、鍵盤可操作、可預測導覽、錯誤可復原（符合 WCAG 思路）** → **為何：學校系統需要兼顧不同閱讀/操作能力，降低挫折與求助成本。** [W3C+1](https://www.w3.org/TR/WCAG22/?utm_source=chatgpt.com)

* * *

### 7) 常見坑與避雷清單（至少 8 條：含資料品質、一致性、使用者錯誤、維運）

1.  **把「不會用」都歸因於使用者**：其實常是 ISP 的不確定性或詞彙落差；要用導引與建議詞處理。 [Rutgers SC&I Wordpress Network+1](https://wp.comminfo.rutgers.edu/ckuhlthau/information-search-process/?utm_source=chatgpt.com)
2.  **只做搜尋框、不做瀏覽**：對兒童與新手等於逼他們跨越 query formulation 障礙，會直接放棄。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
3.  **結果頁太密、太多連結、需要滾動與翻頁**：兒童常只看前幾筆，密集結果頁會降低成功率。 [ResearchGate](https://www.researchgate.net/publication/221238265_How_children_search_the_Internet_with_keyword_interfaces)
4.  **把成人 OPAC 直接縮小字體給孩子用**：台灣兒童 OPAC 研究已指出需要兒童友善介面與引導。 [NCLTD+1](https://ndltd.ncl.edu.tw/r/10485064641369836584?utm_source=chatgpt.com)
5.  **同義詞/錯字容錯沒做就上線**：中文情境輸入成本高，零結果會造成「系統不好用」印象，後續很難挽回。
6.  **用太多艱深篩選（facet）**：facet 對成人有效，但對低年級會增加認知負荷；應分級顯示。 [ISO](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
7.  **忽略「老師/班級」在學校情境的推力**：沒有把推薦與班級書單做入口，會讓系統與校園日常脫節。 [NLPI+1](https://www.nlpi.edu.tw/FileDownLoad/LibraryPublication/20190524110957532395960.pdf?utm_source=chatgpt.com)
8.  **行為紀錄蒐集過量（可追溯到個人）**：在中小學環境會引發隱私/政策風險；應採匿名聚合與最小化。 [ISO](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
9.  **把「熱門」當成唯一推薦邏輯**：會造成強者恆強、館藏長尾永遠不被看見；至少要有主題/年級/系列的多元入口。
10.  **沒有回溯與復原**（例如返回結果後篩選全消失）：違反 berrypicking 的實際行為，使用者會迷路。 [GSEIS Pages](https://pages.gseis.ucla.edu/faculty/bates/berrypicking.html?utm_source=chatgpt.com)
11.  **分析報表只看 PV/查詢量**：沒有「零結果詞」「放棄率」「點選排名」等，就無法改善兒童真正卡住的地方。 [ResearchGate](https://www.researchgate.net/publication/221238265_How_children_search_the_Internet_with_keyword_interfaces)
12.  **忽略偏遠/人力不足學校的作息限制**：開放時間、借還節點受活動影響，流程要能設定彈性。 [NLPI+1](https://www.nlpi.edu.tw/FileDownLoad/LibraryPublication/20190524110957532395960.pdf?utm_source=chatgpt.com)

* * *

### 8) 可交付給 AI 小助理的任務清單（至少 10 條）

1.  **整理「兒童查詢形成（query formulation）」常見錯誤類型**，並產出「中文同音/近形容錯規則」草案（例：注音/拼音輸入常錯）。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
2.  **彙整台灣中小學生資訊尋求研究（NDLTD/Airiti）**：依「年齡、任務（課業/休閒）、障礙、偏好」做一頁式對照表。 [Airiti Library+2NCLTD+2](https://www.airitilibrary.com/Article/Detail/16822889-200403-201308190035-201308190035-92-106?utm_source=chatgpt.com)
3.  **把 Kuhlthau ISP 各階段轉成介面提示文案（中文）**：每階段 2–3 句「下一步你可以…」。 [Rutgers SC&I Wordpress Network+1](https://wp.comminfo.rutgers.edu/ckuhlthau/information-search-process/?utm_source=chatgpt.com)
4.  **設計「低/中/高年級」三種搜尋結果卡片版型**：每種限制文字量、資訊層級與可操作元件。 [ACM Digital Library+1](https://dl.acm.org/doi/pdf/10.1145/1551788.1551804?utm_source=chatgpt.com)
5.  **產出「搜尋失敗（0 結果）處理策略」規格**：自動改寫、同義詞建議、引導到分類瀏覽、提示改用系列/作者等。 [Wiley Online Library](https://asistdl.onlinelibrary.wiley.com/doi/abs/10.1002/%28SICI%291097-4571%282000%2951%3A7%3C646%3A%3AAID-ASI7%3E3.0.CO%3B2-A?utm_source=chatgpt.com)
6.  **整理「孩子偏好瀏覽」的研究證據摘要**，並轉成企劃書用的 3–5 句論述（含引用）。 [Wiley Online Library+1](https://asistdl.onlinelibrary.wiley.com/doi/abs/10.1002/%28SICI%291097-4571%282000%2951%3A7%3C646%3A%3AAID-ASI7%3E3.0.CO%3B2-A?utm_source=chatgpt.com)
7.  **建立「學生友善主題詞（student-friendly subjects）→控制詞彙」對映表的產製流程**（先從熱門借閱與課綱關鍵詞蒐集）。
8.  **制定匿名行為事件（event log）最小欄位集與保留期限建議**（技術規格＋校務可接受說明）。 [ISO+1](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
9.  **找出台灣「兒童 OPAC / 兒童友善目錄」相關研究與設計原則**，整理成「兒童 OPAC 介面準則」清單。 [NCLTD+1](https://ndltd.ncl.edu.tw/r/10485064641369836584?utm_source=chatgpt.com)
10.  **把 ISO 9241-210 的 human-centred design 活動**轉成你專案可用的「需求訪談→原型→可用性測試→驗收」里程碑模板。 [ISO+1](https://www.iso.org/standard/77520.html?utm_source=chatgpt.com)
11.  **把 WCAG 2.2 中與「導航、可預測、錯誤防呆」相關條目**萃取成 K–12 搜尋介面檢核表。 [W3C+1](https://www.w3.org/TR/WCAG22/?utm_source=chatgpt.com)
12.  **設計「班級/老師推薦」模組**：資料欄位、權限（誰可發布）、首頁呈現、推薦理由字數限制。 [NLPI+1](https://www.nlpi.edu.tw/FileDownLoad/LibraryPublication/20190524110957532395960.pdf?utm_source=chatgpt.com)
13.  **彙整偏遠地區學童圖書館使用情形**對系統的含意（開放時間、舒適性、系列書偏好）並轉成需求。 [NLPI+1](https://www.nlpi.edu.tw/FileDownLoad/LibraryPublication/20190524110957532395960.pdf?utm_source=chatgpt.com)
14.  **提出「搜尋→借閱」最短路徑的 UI 流程**（低年級 3 步內、高年級 5 步內），並列出驗收指標（成功率/時間）。
15.  **建立「零結果詞」每月盤點流程**：如何更新同義詞庫、主題卡、推薦書單以降低零結果率。

* * *

本章關鍵搜尋詞（中英，至少 15 個）
-------------------

1.  資訊行為 **Information behavior**
2.  資訊尋求 **Information seeking**
3.  資訊搜尋 **Information searching**
4.  資訊使用 **Information use**
5.  資訊需求 **Information need**
6.  不確定性 **Uncertainty**（Kuhlthau）
7.  資訊搜尋歷程 **Information Search Process (ISP)**
8.  意義建構 **Sense-making**（Dervin）
9.  莓果採摘 **Berrypicking**（Bates）
10.  瀏覽 **Browsing**（children browsing preference）
11.  查詢形成 **Query formulation**
12.  認知負荷 **Cognitive load**
13.  相關性判斷 **Relevance judgment**
14.  兒童搜尋介面 **Children search interface design**
15.  兒童資訊尋求 **Children information seeking behavior**
16.  國小學生 網路資訊尋求行為（台灣）
17.  兒童 OPAC / 兒童線上公用目錄（台灣）
18.  資訊視域 **Information horizon**
19.  日常生活資訊尋求 **ELIS (Everyday Life Information Seeking)**
20.  以使用者為中心設計 **Human-centred design / ISO 9241-210**
21.  網站可及性 **WCAG 2.2 / accessibility**

* * *

如果你接下來要把本章直接轉成「系統規格文件」的段落（例如：Discovery 模組的 UX 原則、事件紀錄 schema、驗收指標 KPI），我可以用你指定的格式（需求文件/PRD/測試案例）把第 5–7 節再「規格化」成可交付給工程與測試的版本。

11:57 PM23:57



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)