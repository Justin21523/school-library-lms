# 文獻 A 編目 Cataloging

**User:** 呂翊銘 (b0979865617@gmail.com)  
**Created:** 12/23/2025 22:19:04  
**Updated:** 12/23/2025 23:41:51  
**Exported:** 12/23/2025 23:50:56  
**Link:** [https://chatgpt.com/g/g-p-694aa49ab4888191948b654ebba514ab-zhong-xiao-xue-tu-zi-xi-tong/c/694aa4d1-d968-8323-a1bf-241d9560b80f](https://chatgpt.com/g/g-p-694aa49ab4888191948b654ebba514ab-zhong-xiao-xue-tu-zi-xi-tong/c/694aa4d1-d968-8323-a1bf-241d9560b80f)  

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

現在開始，先輸出 A. 編目（Cataloging），輸出完成後停下等待我說「下一章」再繼續。

## Response:
這是一個非常完整且高品質的規劃。為了幫你蒐集與彙整「A. 編目（Cataloging）」相關資料，我需要確認幾個細節，以確保輸出能精準符合你的目標：

1.  是否希望包含繁體中文與英文圖書館學資源（例如臺灣國家圖書館與美國LC的對照）？
2.  是否需要特別收錄台灣十二年國教、教育部課綱或教育部圖書館政策等國內官方指引？
3.  MARC 21 欄位是否希望整理成完整欄位清單，或僅列出中小學系統常用的子集？
4.  是否需要涵蓋不同層級（書目層、館藏層、款目控制層）的資料結構建議？
5.  是否優先引用中文資料來源？或兩者並重也可？

請你確認這些點，或補充其他想法，我就可以開始進行 Cataloging 篇章的研究整理。

10:18 PM22:18

## Prompt:
1 是的 我希望包含中英文圖書館教學資源  2. 是 3. 需要 4. 需要 5. 學理部分以英文為主 實際場域盡量找中文的 台灣本土相關的 其他部分就是資源文獻越多越好

10:19 PM22:19

## Response:
收到，我會針對「A. 編目（Cataloging）」彙整中英文權威資料與實務做法，涵蓋學理與中小學場域應用，整理成可轉為系統規格的格式。內容完成後我會先停下來等你說「下一章」才會繼續。

我會開始蒐集並整理資料，過程中你可以隨時與我對話討論其他面向。

10:19 PM22:19

Research completed in 13m · 21 sources · 122 searches

## Response:
核心概念與名詞（中英文對照表）
===============

*   **編目 (Cataloging)：**圖書編目是將圖書資料的形體及內容特性按照一定規範記錄下來，以便讀者識別和利用[ting-wen.com](https://www.ting-wen.com/file/courseview/22-5A%E6%8A%80%E8%A1%93%E6%9C%8D%E5%8B%99%E4%B8%80%EF%BC%88%E4%B8%AD%E6%96%87%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%EF%BC%89%E8%A9%A6%E9%96%B1%E8%AC%9B%E7%BE%A9.pdf#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E6%9B%B8%E7%9B%AE%E8%B3%87%E8%A8%8A%E7%B5%84%E7%B9%94%E7%A8%B1%E7%82%BA%E3%80%8C%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E7%B0%A1%E7%A8%B1%E3%80%8C%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E3%80%8D%E6%88%96%E3%80%8C%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E8%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9B%AE%E9%8C%84%E6%98%AF%20%E7%B7%A8%E7%9B%AE%E7%9A%84%E6%88%90%E5%93%81%E3%80%82%20%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E6%98%AF%E5%B0%B1%E5%9C%96%E6%9B%B8%E8%B3%87%E6%96%99%E7%9A%84%E5%BD%A2%E9%AB%94%E5%8F%8A%E5%85%A7%E5%AE%B9%E7%89%B9%E6%80%A7%EF%BC%8C%E6%8C%89%E7%85%A7%E4%B8%80%E5%AE%9A%E7%9A%84%E8%A6%8F%E7%AF%84%E8%A8%98%E8%BC%89%E4%B8%8B%E4%BE%86%EF%BC%8C%E4%BB%A5%E4%BE%BF%E8%AE%80%E8%80%85%E8%BE%A8%E8%AD%98%E5%8F%8A%E5%88%A9%E7%94%A8%E3%80%82%20%E5%BB%A3%E7%BE%A9%E7%9A%84%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E5%8C%85%E5%90%AB%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%E8%88%87%E4%B8%BB%E9%A1%8C%E7%B7%A8%E7%9B%AE%E5%85%A9%E6%96%B9%E9%9D%A2%E3%80%82)。廣義的編目包括**記述編目**（描述書目資料，如題名、著者等）和**主題編目**（分析內容主題並決定分類號與主題標目）兩部分。狹義的編目通常專指記述編目工作。
*   **分類 (Classification)：**根據資料內容主題將館藏進行組織排列的過程，通常使用分類法將相同主題的資源歸類，以利讀者發現相關主題資料。分類的結果常反映在**分類號**上，並進一步組成**索書號**作為排架依據。
*   **索書號 (Call Number)：**每本館藏分配的一組代碼，用於表示其在館內的排列位置。索書號通常由分類號、作者號等組成，列印於**書標**上並貼於書背，供排架與查找之用[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E6%89%8B%E5%86%8A%E7%AC%AC204%E9%A0%81%E4%B8%89%E3%80%81%E7%B4%A2%E6%9B%B8%E8%99%9F%E6%89%80%E7%A4%BA%EF%BC%9A%E2%80%9C)。例如某書索書號為「863.599 // C561」，表示分類號863.599，加上作者號C561。
*   \*\*圖書館目錄 (Library Catalog / OPAC)：**圖書館館藏的有序清單，記錄每項館藏的書目資料。現代圖書館多以**線上公用目錄（OPAC）\*\*提供檢索服務，讀者可透過題名、作者、主題等檢索館藏。目錄是編目工作的成品[ting-wen.com](https://www.ting-wen.com/file/courseview/22-5A%E6%8A%80%E8%A1%93%E6%9C%8D%E5%8B%99%E4%B8%80%EF%BC%88%E4%B8%AD%E6%96%87%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%EF%BC%89%E8%A9%A6%E9%96%B1%E8%AC%9B%E7%BE%A9.pdf#:~:text=%E7%AF%84%E5%9C%8D%E3%80%81%E6%AF%8F%E4%B8%80%E7%AD%86%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E6%89%80%E5%8C%85%E5%90%AB%E7%9A%84%E8%B3%87%E8%A8%8A%E9%87%8F%E3%80%81%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E7%9A%84%E7%B5%84%E7%B9%94%E5%8F%8A%E6%AA%A2%E7%B4%A2%E6%96%B9%E5%BC%8F%E8%80%8C%E5%AE%9A%E3%80%82%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E4%B9%9F%E5%8C%85%E6%8B%AC%E6%9B%B8%E7%9B%AE%20%E8%91%97%E9%8C%84%E7%9A%84%E6%A8%99%E6%BA%96%E5%8C%96%EF%BC%8C%E6%9B%B8%E7%9B%AE%E7%B6%B2%E8%B7%AF%E6%88%96%E5%85%B6%E4%BB%96%E5%90%88%E4%BD%9C%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E4%BA%8B%E9%A0%85%E3%80%82%20%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E6%9B%B8%E7%9B%AE%E8%B3%87%E8%A8%8A%E7%B5%84%E7%B9%94%E7%A8%B1%E7%82%BA%E3%80%8C%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E7%B0%A1%E7%A8%B1%E3%80%8C%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E3%80%8D%E6%88%96%E3%80%8C%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E8%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9B%AE%E9%8C%84%E6%98%AF%20%E7%B7%A8%E7%9B%AE%E7%9A%84%E6%88%90%E5%93%81%E3%80%82%20%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E6%98%AF%E5%B0%B1%E5%9C%96%E6%9B%B8%E8%B3%87%E6%96%99%E7%9A%84%E5%BD%A2%E9%AB%94%E5%8F%8A%E5%85%A7%E5%AE%B9%E7%89%B9%E6%80%A7%EF%BC%8C%E6%8C%89%E7%85%A7%E4%B8%80%E5%AE%9A%E7%9A%84%E8%A6%8F%E7%AF%84%E8%A8%98%E8%BC%89%E4%B8%8B%E4%BE%86%EF%BC%8C%E4%BB%A5%E4%BE%BF%E8%AE%80%E8%80%85%E8%BE%A8%E8%AD%98%E5%8F%8A%E5%88%A9%E7%94%A8%E3%80%82)。
*   \*\*書目紀錄 (Bibliographic Record)：\*\*目錄中的基本單位，包含對某一文獻的書目資訊描述[ting-wen.com](https://www.ting-wen.com/file/courseview/22-5A%E6%8A%80%E8%A1%93%E6%9C%8D%E5%8B%99%E4%B8%80%EF%BC%88%E4%B8%AD%E6%96%87%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%EF%BC%89%E8%A9%A6%E9%96%B1%E8%AC%9B%E7%BE%A9.pdf#:~:text=%E9%81%8E%E7%A8%8B%E3%80%82%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E6%B6%B5%E8%93%8B%E6%89%80%E6%9C%89%E6%9B%B8%E7%9B%AE%E6%B4%BB%E5%8B%95%EF%BC%8C%E5%8C%85%E6%8B%AC%E5%90%84%E7%A8%AE%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E3%80%81%E6%9B%B8%E7%9B%AE%E6%AA%94%E5%8F%8A%E6%9B%B8%E7%9B%AE%E8%B3%87%E6%96%99%E5%BA%AB%E7%9A%84%E5%BB%BA%E7%AB%8B%E5%8F%8A%E7%B6%AD%E8%AD%B7%E3%80%82%E7%94%A8%20%E6%96%BC%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E7%9A%84%E5%B7%A5%E5%85%B7%E7%A8%B1%E7%82%BA%E6%9B%B8%E7%9B%AE%E6%AA%94%EF%BC%8C%E8%8B%A5%E7%82%BA%E8%87%AA%E5%8B%95%E5%8C%96%EF%BC%8C%E7%A8%B1%E7%82%BA%E6%9B%B8%E7%9B%AE%E8%B3%87%E6%96%99%E5%BA%AB%E3%80%82%E6%9B%B8%E7%9B%AE%E6%AA%94%E6%88%96%E6%9B%B8%E7%9B%AE%E8%B3%87%E6%96%99%E5%BA%AB%E7%9A%84%E5%9F%BA%E6%9C%AC%E5%96%AE%E4%BD%8D%20%E7%A8%B1%E7%82%BA%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E3%80%82%E6%9B%B8%E7%9B%AE%E6%AA%94%E6%9C%80%E5%B8%B8%E8%A6%8B%E7%9A%84%E9%A1%9E%E5%9E%8B%E5%8C%85%E6%8B%AC%E6%9B%B8%E7%9B%AE%E3%80%81%E7%B4%A2%E5%BC%95%E5%8F%8A%E7%9B%AE%E9%8C%84%EF%BC%8C%E5%90%84%E6%9C%89%E4%B8%8D%E5%90%8C%E7%9A%84%E5%BD%A2%E5%BC%8F%EF%BC%8C%E8%A6%96%E5%85%B6%E6%B6%B5%E8%93%8B%E7%9A%84%E8%B3%87%E6%96%99%20%E7%AF%84%E5%9C%8D%E3%80%81%E6%AF%8F%E4%B8%80%E7%AD%86%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E6%89%80%E5%8C%85%E5%90%AB%E7%9A%84%E8%B3%87%E8%A8%8A%E9%87%8F%E3%80%81%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E7%9A%84%E7%B5%84%E7%B9%94%E5%8F%8A%E6%AA%A2%E7%B4%A2%E6%96%B9%E5%BC%8F%E8%80%8C%E5%AE%9A%E3%80%82%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E4%B9%9F%E5%8C%85%E6%8B%AC%E6%9B%B8%E7%9B%AE%20%E8%91%97%E9%8C%84%E7%9A%84%E6%A8%99%E6%BA%96%E5%8C%96%EF%BC%8C%E6%9B%B8%E7%9B%AE%E7%B6%B2%E8%B7%AF%E6%88%96%E5%85%B6%E4%BB%96%E5%90%88%E4%BD%9C%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E4%BA%8B%E9%A0%85%E3%80%82,%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E6%9B%B8%E7%9B%AE%E8%B3%87%E8%A8%8A%E7%B5%84%E7%B9%94%E7%A8%B1%E7%82%BA%E3%80%8C%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E7%B0%A1%E7%A8%B1%E3%80%8C%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E3%80%8D%E6%88%96%E3%80%8C%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E8%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9B%AE%E9%8C%84%E6%98%AF%20%E7%B7%A8%E7%9B%AE%E7%9A%84%E6%88%90%E5%93%81%E3%80%82%20%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E6%98%AF%E5%B0%B1%E5%9C%96%E6%9B%B8%E8%B3%87%E6%96%99%E7%9A%84%E5%BD%A2%E9%AB%94%E5%8F%8A%E5%85%A7%E5%AE%B9%E7%89%B9%E6%80%A7%EF%BC%8C%E6%8C%89%E7%85%A7%E4%B8%80%E5%AE%9A%E7%9A%84%E8%A6%8F%E7%AF%84%E8%A8%98%E8%BC%89%E4%B8%8B%E4%BE%86%EF%BC%8C%E4%BB%A5%E4%BE%BF%E8%AE%80%E8%80%85%E8%BE%A8%E8%AD%98%E5%8F%8A%E5%88%A9%E7%94%A8%E3%80%82)。每筆書目紀錄記錄文獻的題名、責任者、出版項等細節，提供識別該文獻所需的資訊。一本書對應一筆書目紀錄；這些紀錄集合形成館藏目錄。
*   \*\*館藏紀錄 (Item/Holdings Record)：\*\*記錄館藏實體副本資訊的紀錄。例如某書在圖書館有2本館藏，則該書的書目紀錄下會有兩筆館藏紀錄，記載各自的館藏地、館藏號、條碼、狀態（可借出、館內閱覽等）等資訊。館藏紀錄聯結至書目紀錄，以追蹤實體藏書。
*   **權威紀錄 (Authority Record)：**權威控制檔中的基本單位，由一組權威資訊組成，規範了某一名稱或標目的用法。權威紀錄通常包含**權威欄目**（標目詞）以及變體形式、參照等，用以確定該名稱/標目的唯一合法形式[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84)。例如「Twain, Mark」作為權威著者標目，其權威紀錄會列出其別名如Samuel Clemens作參照。
*   \*\*權威控制 (Authority Control)：\*\*圖書館學中的規範控制過程，透過建立權威檔確保目錄中使用的檢索標目具有唯一性和一致性[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84)。例如透過權威控制，可保證同一作者或主題在目錄中只使用一種標目名稱，避免「張三」與「Chang San」混用。權威控制提升了檢索準確性和目錄管理效率。
*   **款目 (Entry)：**目錄或索引的最小單位，又稱**條目**。編目員根據著錄規則，將文獻的形式與內容特徵記錄成款目[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23831#:~:text=%E6%AC%BE%E7%9B%AE%3A%20%E6%98%AF%E7%9B%AE%E9%8C%84%E3%80%81%E7%B4%A2%E5%BC%95%E7%9A%84%E6%9C%80%E5%B0%8F%E5%96%AE%E4%BD%8D%EF%BC%8C%E5%8F%88%E7%A8%B1%E6%A2%9D%E7%9B%AE%EF%BC%8C%E6%98%AF%E7%B7%A8%E7%9B%AE%E5%93%A1%E6%A0%B9%E6%93%9A%E4%B8%80%E5%AE%9A%E7%9A%84%E8%91%97%E9%8C%84%E6%B3%95%EF%BC%8C%E5%B0%8D%E6%9F%90%E4%B8%80%E6%96%87%E7%8D%BB%E7%9A%84%E5%BD%A2%E5%BC%8F%E5%92%8C%E5%85%A7%E5%AE%B9%E7%89%B9%E5%BE%B5%E6%89%80%E5%81%9A%E7%9A%84%E8%A8%98%E9%8C%84%E3%80%82)。每一筆書目紀錄即為一個款目。初始編目完成描述後，再加上標目（檢索點）才能成為可檢索的款目。
*   **標目 (Heading / Access Point)：**為了組織和檢索目錄而指定的檢索項目[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23831#:~:text=%E6%A8%99%E7%9B%AE%3A%20%E7%95%B6%E7%B7%A8%E7%9B%AE%E5%93%A1%E5%AE%8C%E6%88%90%E5%B0%8D%E6%96%87%E7%8D%BB%E7%9A%84%E6%8F%8F%E8%BF%B0%E5%BE%8C%EF%BC%8C%E9%82%84%E9%9C%80%E8%A6%81%E5%8A%A0%E4%B8%8A%E7%B5%84%E7%B9%94%E7%9B%AE%E9%8C%84%E7%9A%84%E6%AA%A2%E7%B4%A2%E6%AC%BE%E7%9B%AE%EF%BC%8C%E9%80%99%E5%B0%B1%E6%98%AF%E6%88%91%E5%80%91%E8%AA%AA%E7%9A%84%E6%A8%99%E7%9B%AE%E6%88%96%E6%AA%A2%E7%B4%A2%E9%BB%9E%E3%80%82%E6%A8%99%E7%9B%AE%E6%98%AF%20%E7%9B%AE%E9%8C%84%E4%B8%8A%E6%8C%87%E5%BC%95%E7%9B%AE%E9%8C%84%E6%8E%92%E6%AA%A2%E7%B7%9A%E7%B4%A2%E7%9A%84%E9%A0%85%E7%9B%AE%EF%BC%8C%E4%B8%80%E8%88%AC%E5%8F%AF%E5%88%86%E7%82%BA%E9%A1%8C%E5%90%8D%E6%A8%99%E7%9B%AE%E3%80%81%E8%91%97%E8%80%85%E6%A8%99%E7%9B%AE%E3%80%81%E4%B8%BB%E9%A1%8C%E6%A8%99%E7%9B%AE%E3%80%81%E5%88%86%E9%A1%9E%E6%A8%99%E7%9B%AE%E3%80%82)。當編目員完成對文獻的描述後，需為其建立檢索用的標目，例如**題名標目**、**著者標目**、**主題標目**、**分類標目**等。標目使讀者能以不同途徑查找館藏，例如透過作者姓名或主題關鍵詞搜尋相關資源。＊**常見混淆：**「標目」指檢索用的名稱/詞彙，而「款目」指完整的紀錄條目；兩者意涵不同，不可混用[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23831#:~:text=%E6%AC%BE%E7%9B%AE%3A%20%E6%98%AF%E7%9B%AE%E9%8C%84%E3%80%81%E7%B4%A2%E5%BC%95%E7%9A%84%E6%9C%80%E5%B0%8F%E5%96%AE%E4%BD%8D%EF%BC%8C%E5%8F%88%E7%A8%B1%E6%A2%9D%E7%9B%AE%EF%BC%8C%E6%98%AF%E7%B7%A8%E7%9B%AE%E5%93%A1%E6%A0%B9%E6%93%9A%E4%B8%80%E5%AE%9A%E7%9A%84%E8%91%97%E9%8C%84%E6%B3%95%EF%BC%8C%E5%B0%8D%E6%9F%90%E4%B8%80%E6%96%87%E7%8D%BB%E7%9A%84%E5%BD%A2%E5%BC%8F%E5%92%8C%E5%85%A7%E5%AE%B9%E7%89%B9%E5%BE%B5%E6%89%80%E5%81%9A%E7%9A%84%E8%A8%98%E9%8C%84%E3%80%82)。
*   **MARC21機讀編目格式 (MARC21 Format)：**國際通用的機器可讀編目格式，用三位數欄位號和指標、子欄位標識符將書目資料編碼成電腦可處理的形式。MARC21包括書目格式、館藏（藏錄）格式、權威格式等子格式，用於交換和儲存編目紀錄。MARC記錄使全球圖書館能夠共享書目數據。＊`MARC`是**Machine-Readable Cataloging**的縮寫，21表示第21版（結合美國、加拿大等版本統一而成）。
*   \*\*RDA資源描述與檢索 (Resource Description and Access)：\*\*現行的編目內容規則，用於指導如何著錄館藏資源的內容特徵。RDA建立在FRBR概念模型之上，強調與使用者任務（查找、識別、選擇、獲得）相關的元素描述[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=,%E6%80%A7%E5%8F%8A%E4%B9%8B%E9%96%93%E7%9A%84%E9%97%9C%E4%BF%82)[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=match%20at%20L3398%20RDA%20%E7%9A%84%E5%AE%9A%E4%BD%8D%E7%82%BA%E5%85%A7%E5%AE%B9%E6%A8%99%E6%BA%96%EF%BC%8C%E6%98%AF%E4%B8%80%E7%A8%AE%E5%B0%88%E9%96%80%E7%82%BA%E6%95%B8%E4%BD%8D%E7%92%B0%E5%A2%83%E4%B8%AD%E8%B3%87%E6%BA%90%E8%91%97%E9%8C%84%E8%88%87%E6%AA%A2%E7%B4%A2%E8%80%8C%E7%99%BC%E5%B1%95,AACR%20%E7%8F%BE%E4%BB%A3%E5%8C%96%E3%80%81%E5%9C%8B%20%E9%9A%9B%E5%8C%96%E8%88%87%E7%B6%B2%E8%B7%AF%E5%8C%96%E7%9A%84%E6%88%90%E6%9E%9C%E3%80%82179%20RDA%20%E4%B8%8D%E5%83%85%E5%B8%8C%E6%9C%9B%E8%83%BD%E5%A4%A0%E5%85%A8%E9%9D%A2%E6%80%A7%E7%9A%84%E5%8C%85%E5%90%AB%E6%89%80%E6%9C%89%E9%A1%9E%E5%9E%8B%E7%9A%84%E8%B3%87%E6%BA%90%EF%BC%8C%E6%9B%B4%E6%8F%90%E5%87%BA%E4%B8%80%E8%87%B4%E6%80%A7%E7%9A%84%E6%8C%87%E5%B0%8E%E6%96%B9)。RDA自2010年代起逐步取代AACR2規則，提供更具數位環境兼容性和國際性的編目準則[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=match%20at%20L3398%20RDA%20%E7%9A%84%E5%AE%9A%E4%BD%8D%E7%82%BA%E5%85%A7%E5%AE%B9%E6%A8%99%E6%BA%96%EF%BC%8C%E6%98%AF%E4%B8%80%E7%A8%AE%E5%B0%88%E9%96%80%E7%82%BA%E6%95%B8%E4%BD%8D%E7%92%B0%E5%A2%83%E4%B8%AD%E8%B3%87%E6%BA%90%E8%91%97%E9%8C%84%E8%88%87%E6%AA%A2%E7%B4%A2%E8%80%8C%E7%99%BC%E5%B1%95,AACR%20%E7%8F%BE%E4%BB%A3%E5%8C%96%E3%80%81%E5%9C%8B%20%E9%9A%9B%E5%8C%96%E8%88%87%E7%B6%B2%E8%B7%AF%E5%8C%96%E7%9A%84%E6%88%90%E6%9E%9C%E3%80%82179%20RDA%20%E4%B8%8D%E5%83%85%E5%B8%8C%E6%9C%9B%E8%83%BD%E5%A4%A0%E5%85%A8%E9%9D%A2%E6%80%A7%E7%9A%84%E5%8C%85%E5%90%AB%E6%89%80%E6%9C%89%E9%A1%9E%E5%9E%8B%E7%9A%84%E8%B3%87%E6%BA%90%EF%BC%8C%E6%9B%B4%E6%8F%90%E5%87%BA%E4%B8%80%E8%87%B4%E6%80%A7%E7%9A%84%E6%8C%87%E5%B0%8E%E6%96%B9)。＊RDA著錄的記錄通常以MARC21格式存儲，兩者相輔相成。
*   \*\*ISBD國際標準書目著錄 (International Standard Bibliographic Description)：\*\*由IFLA制定的書目記錄著錄標準，規範書目描述的要素順序與標點符號。傳統上AACR2等編目規則採用了ISBD標點格式（例如題名後以「/」引出責任者）以統一呈現方式。RDA雖非強制要求ISBD標點，但許多圖書館在MARC記錄中仍採用ISBD標點以維持顯示的一致性[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf#:~:text=%E5%8C%85%E5%90%ABISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%EF%83%A0%20i%20%28%E4%B8%AD%E6%96%87%E4%BE%9D%E6%93%9ACCR%E3%80%81%E8%A5%BF%E6%96%87%E4%BE%9D%E6%93%9ARDA%EF%BC%8C%E4%B8%A6%E9%81%B5%E5%BE%AAISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%29%20%E4%B8%8D%E6%8E%A1%E7%94%A8ISBD%E4%B9%8B%E6%A0%BC%E5%BC%8F%EF%83%A0%20,ISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%E9%83%A8%E5%88%86%E7%9C%81%E7%95%A5%EF%83%A0%20c)[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf#:~:text=%E2%80%93%20%E2%80%9Ci%E2%80%9D%20,e%20contains%20the%20code%20%E2%80%9Crda%E2%80%9D)。
*   \*\*AACR2英美編目規則第二版 (Anglo-American Cataloguing Rules, 2nd Ed.)：**RDA之前廣泛使用的編目規則，自1978年起在全球圖書館通行數十年。AACR2提供了詳細的各類文獻（書籍、連續刊、視聽等）著錄規範和標目選擇規則。臺灣曾出版中文譯本**《中國編目規則（CCR）》\*\*供採用。RDA的出現使AACR2逐步停止更新，但許多舊有書目紀錄仍符合AACR2/CCR規範，需要在RDA環境下予以維護或升級。
*   **FRBR書目記錄功能需求 (Functional Requirements for Bibliographic Records)：**一種概念模型，將書目實體分為**作品**(Work)、**表現**(Expression)、**載體**(Manifestation)、**個體**(Item)四層級，定義了使用者在書目資料上的四大任務（Find/Identify/Select/Obtain）。FRBR為RDA等新一代編目規範提供了理論基礎，使編目能更好反映不同實體及其關係。例如同一作品的不同譯本屬於不同表現，不同館藏副本屬於不同個體。

關鍵理論與必讀脈絡
=========

**編目理論框架：**現代編目遵循一系列國際標準與概念模型，以平衡完整描述與使用效率。IFLA提出的**FRBR**模型奠定了編目實體關係的理論基石，將書目記錄區分為作品、表現、載體、個體等層級，以對應使用者在目錄查詢中的識別與獲取需求[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=,%E6%80%A7%E5%8F%8A%E4%B9%8B%E9%96%93%E7%9A%84%E9%97%9C%E4%BF%82)。基於FRBR理念，RDA規範強調將資訊拆解為基本元素，並清楚標示實體之間的關係（如作品與作者、作品與主題等），使目錄更符合使用者心智模型[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=,%E6%80%A7%E5%8F%8A%E4%B9%8B%E9%96%93%E7%9A%84%E9%97%9C%E4%BF%82)[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=match%20at%20L3417%20FRSAR%20%E7%AD%89%EF%BC%8C%E6%96%B0%E8%A6%8F%E5%89%87%E5%B0%87%E7%AC%AC%E4%B8%80%E9%83%A8%E5%88%86%E7%9A%84%E7%9B%AE%E6%A8%99%E8%A8%AD%E5%AE%9A%E5%9C%A8%E6%94%AF%E6%8F%B4,%E4%BA%8C%29%20%E7%99%BC%E5%B1%95%E6%A6%82%E6%B3%81)。同時，傳統目錄學中的**巴黎原則**與IFLA **國際編目原則**為編目提供了宏觀原則，例如統一標目、國際書目控制(UBC)等理念，強調在全球範圍內協調編目規則以利資料共享。這些理論脈絡構成編目工作的哲學基礎。

**編目規範與格式的關係：**編目規範（內容規則）與編目格式（結構標準）相輔相成。以AACR2/RDA與MARC21為例：**AACR2**和**RDA**是描述如何選擇和記錄書目資訊的規則（內容標準），而**MARC21**是承載這些資訊的通信格式（結構標準）。編目員依據RDA規則從資源上摘錄並組織資料，再以MARC21欄位加以編碼儲存[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf#:~:text=%E2%80%93%20%E2%80%9Ci%E2%80%9D%20,e%20contains%20the%20code%20%E2%80%9Crda%E2%80%9D)。此外，**ISBD**則提供了展示書目描述的標點和順序規範，在AACR時代被內嵌於內容規則中。總而言之：RDA告訴我們記哪些資訊、怎麼記；MARC21負責存在哪裡、以何種代碼存；ISBD則影響顯示呈現的格式。例如，RDA指示記錄出版地、出版社、年份等要素，MARC21則有對應的出版項欄位（如264），而ISBD建議在顯示時這些元素以規定順序排列並用符號「: ; ,」分隔[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf#:~:text=%E5%8C%85%E5%90%ABISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%EF%83%A0%20i%20%28%E4%B8%AD%E6%96%87%E4%BE%9D%E6%93%9ACCR%E3%80%81%E8%A5%BF%E6%96%87%E4%BE%9D%E6%93%9ARDA%EF%BC%8C%E4%B8%A6%E9%81%B5%E5%BE%AAISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%29%20%E4%B8%8D%E6%8E%A1%E7%94%A8ISBD%E4%B9%8B%E6%A0%BC%E5%BC%8F%EF%83%A0%20,ISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%E9%83%A8%E5%88%86%E7%9C%81%E7%95%A5%EF%83%A0%20c)。理解內容規則與格式標準的分工，有助於系統設計時在前端提供符合規則的輸入介面，在後端正確存儲為MARC結構。

**編目層級與書目控制：**不同類型與規模的圖書館在編目詳細程度上有所區分。國際上將書目著錄分為**完整級**、**核心級**、**簡略級**等：完整級紀錄內容最詳實，適用於國家圖書館等需要完備資料的環境；核心級保留關鍵識別元素；簡略級僅含最基本資訊，常見於小型圖書館或巡迴書箱等[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/MARC21%E7%B0%A1%E4%BB%8B.pdf#:~:text=%E2%86%92%20%E5%AE%8C%E6%95%B4%E8%91%97%E9%8C%84,Page%2013)。例如，對同一圖書，小學圖書館可能僅採第一層次著錄（題名、作者、出版年等少數欄位），而國家圖書館會詳錄至內容提要、附註、標識符等各方面。這種層級差異反映了館藏規模、人力資源與讀者需求的不同。透過**書目控制**（Bibliographic Control），一方面要確保館內每項資源皆有書目紀錄可供檢索，另一方面也透過權威控制、編目網路合作等手段，提升資料質量和共享性[ting-wen.com](https://www.ting-wen.com/file/courseview/22-5A%E6%8A%80%E8%A1%93%E6%9C%8D%E5%8B%99%E4%B8%80%EF%BC%88%E4%B8%AD%E6%96%87%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%EF%BC%89%E8%A9%A6%E9%96%B1%E8%AC%9B%E7%BE%A9.pdf#:~:text=%E9%81%8E%E7%A8%8B%E3%80%82%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E6%B6%B5%E8%93%8B%E6%89%80%E6%9C%89%E6%9B%B8%E7%9B%AE%E6%B4%BB%E5%8B%95%EF%BC%8C%E5%8C%85%E6%8B%AC%E5%90%84%E7%A8%AE%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E3%80%81%E6%9B%B8%E7%9B%AE%E6%AA%94%E5%8F%8A%E6%9B%B8%E7%9B%AE%E8%B3%87%E6%96%99%E5%BA%AB%E7%9A%84%E5%BB%BA%E7%AB%8B%E5%8F%8A%E7%B6%AD%E8%AD%B7%E3%80%82%E7%94%A8%20%E6%96%BC%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E7%9A%84%E5%B7%A5%E5%85%B7%E7%A8%B1%E7%82%BA%E6%9B%B8%E7%9B%AE%E6%AA%94%EF%BC%8C%E8%8B%A5%E7%82%BA%E8%87%AA%E5%8B%95%E5%8C%96%EF%BC%8C%E7%A8%B1%E7%82%BA%E6%9B%B8%E7%9B%AE%E8%B3%87%E6%96%99%E5%BA%AB%E3%80%82%E6%9B%B8%E7%9B%AE%E6%AA%94%E6%88%96%E6%9B%B8%E7%9B%AE%E8%B3%87%E6%96%99%E5%BA%AB%E7%9A%84%E5%9F%BA%E6%9C%AC%E5%96%AE%E4%BD%8D%20%E7%A8%B1%E7%82%BA%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E3%80%82%E6%9B%B8%E7%9B%AE%E6%AA%94%E6%9C%80%E5%B8%B8%E8%A6%8B%E7%9A%84%E9%A1%9E%E5%9E%8B%E5%8C%85%E6%8B%AC%E6%9B%B8%E7%9B%AE%E3%80%81%E7%B4%A2%E5%BC%95%E5%8F%8A%E7%9B%AE%E9%8C%84%EF%BC%8C%E5%90%84%E6%9C%89%E4%B8%8D%E5%90%8C%E7%9A%84%E5%BD%A2%E5%BC%8F%EF%BC%8C%E8%A6%96%E5%85%B6%E6%B6%B5%E8%93%8B%E7%9A%84%E8%B3%87%E6%96%99%20%E7%AF%84%E5%9C%8D%E3%80%81%E6%AF%8F%E4%B8%80%E7%AD%86%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E6%89%80%E5%8C%85%E5%90%AB%E7%9A%84%E8%B3%87%E8%A8%8A%E9%87%8F%E3%80%81%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E7%9A%84%E7%B5%84%E7%B9%94%E5%8F%8A%E6%AA%A2%E7%B4%A2%E6%96%B9%E5%BC%8F%E8%80%8C%E5%AE%9A%E3%80%82%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E4%B9%9F%E5%8C%85%E6%8B%AC%E6%9B%B8%E7%9B%AE%20%E8%91%97%E9%8C%84%E7%9A%84%E6%A8%99%E6%BA%96%E5%8C%96%EF%BC%8C%E6%9B%B8%E7%9B%AE%E7%B6%B2%E8%B7%AF%E6%88%96%E5%85%B6%E4%BB%96%E5%90%88%E4%BD%9C%E6%9B%B8%E7%9B%AE%E6%8E%A7%E5%88%B6%E4%BA%8B%E9%A0%85%E3%80%82,%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9A%84%E6%9B%B8%E7%9B%AE%E8%B3%87%E8%A8%8A%E7%B5%84%E7%B9%94%E7%A8%B1%E7%82%BA%E3%80%8C%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E7%B0%A1%E7%A8%B1%E3%80%8C%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E3%80%8D%E6%88%96%E3%80%8C%E7%B7%A8%E7%9B%AE%E3%80%8D%EF%BC%8C%E8%80%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9B%AE%E9%8C%84%E6%98%AF%20%E7%B7%A8%E7%9B%AE%E7%9A%84%E6%88%90%E5%93%81%E3%80%82%20%E5%9C%96%E6%9B%B8%E7%B7%A8%E7%9B%AE%E6%98%AF%E5%B0%B1%E5%9C%96%E6%9B%B8%E8%B3%87%E6%96%99%E7%9A%84%E5%BD%A2%E9%AB%94%E5%8F%8A%E5%85%A7%E5%AE%B9%E7%89%B9%E6%80%A7%EF%BC%8C%E6%8C%89%E7%85%A7%E4%B8%80%E5%AE%9A%E7%9A%84%E8%A6%8F%E7%AF%84%E8%A8%98%E8%BC%89%E4%B8%8B%E4%BE%86%EF%BC%8C%E4%BB%A5%E4%BE%BF%E8%AE%80%E8%80%85%E8%BE%A8%E8%AD%98%E5%8F%8A%E5%88%A9%E7%94%A8%E3%80%82)。在台灣，全國圖書書目資訊網（NBINet）由國家圖書館統籌，推行核心級紀錄標準並提供聯合編目平台，有效落實了國際書目控制的理念。

**館藏記錄分層架構：**為了管理複雜的館藏關聯，圖書館自動化系統通常實現**三層架構**：權威層、書目層、館藏層。權威層包含名稱權威檔、主題權威檔等，定義標目的統一形式；書目層包含對資源的描述，如題名著者等（對應FRBR的「載體/表現」層級）；館藏層則記錄每件實體的資訊（對應FRBR的「個體」）。三層分離帶來的好處是：**一次變更，全域生效**——例如更正作者權威檔姓名拼寫，所有相關書目紀錄即同步更新顯示[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84)；新增一筆書目，可在其下連結多筆館藏紀錄表示藏量。這種架構體現了資料庫實體-關係模型在目錄中的應用[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/02-3_%E5%BE%9E%E6%9B%B8%E7%9B%AE%E9%97%9C%E4%BF%82%E6%8E%A2%E8%A8%8EFRBR%20%E8%88%87%20BIBFRAME%E7%99%BC%E5%B1%95.pdf#:~:text=FRBR%E4%BD%BF%E7%94%A8%E9%97%9C%E9%80%A3%E5%BC%8F%E8%B3%87%E6%96%99%E5%BA%AB%E7%9A%84%E5%AF%A6%E9%AB%94%E2%80%94%E9%97%9C%E4%BF%82%E6%A8%A1%E5%9E%8B%EF%BC%88Entity)。對中小學圖書館而言，權威層可能未如大型圖書館般獨立維護，但系統設計上仍應預留權威控制的支持，以備未來擴充。

**新興趨勢：**編目領域正面臨從MARC向**BIBFRAME**等**關聯數據**框架轉型的趨勢。BIBFRAME由美國國會圖書館主導，旨在替代MARC成為網絡環境下書目資料的交換格式，以FRBR/LRM概念模型為基礎，用Linked Data方式表達書目實體及關係[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/02-3_%E5%BE%9E%E6%9B%B8%E7%9B%AE%E9%97%9C%E4%BF%82%E6%8E%A2%E8%A8%8EFRBR%20%E8%88%87%20BIBFRAME%E7%99%BC%E5%B1%95.pdf#:~:text=FRBR%E4%BD%BF%E7%94%A8%E9%97%9C%E9%80%A3%E5%BC%8F%E8%B3%87%E6%96%99%E5%BA%AB%E7%9A%84%E5%AF%A6%E9%AB%94%E2%80%94%E9%97%9C%E4%BF%82%E6%A8%A1%E5%9E%8B%EF%BC%88Entity)。未來的圖書館系統可能以三元組數據存儲編目資訊，使館藏資料能被網際網路上的其他應用廣泛檢索和重用。儘管中小學圖書館短期內仍以傳統MARC系統為主，但了解這一趨勢有助於在設計系統時考量長遠的兼容性，確保日後能與更廣泛的資料生態接軌。

標準 / 規範 / 權威資源
==============

\*\*國際與國家編目標準：\*\*中小學圖書館的編目需同時參照國際標準和本地規範，以兼顧專業一致性與在地適用性。以下是編目相關的重要標準與資源：

*   **MARC21** – _Machine-Readable Cataloging 21_：國際通行的機讀編目格式，涵蓋書目、權威、館藏等格式子集。維護單位為美國國會圖書館和合作者。MARC21為跨系統的書目資料交換提供了統一結構基礎，也是臺灣目前編目格式的主流選擇[nclfile.ncl.edu.tw](https://nclfile.ncl.edu.tw/files/201605/2a8cdb90-975e-4eef-97ef-b92cecc8848f.pdf#:~:text=%5BPDF%5D%20NBINet%20%E5%90%84%E9%A1%9E%E5%9E%8B%E6%A0%B8%E5%BF%83%E6%9B%B8%E7%9B%AE%E7%B4%80%E9%8C%84,%E4%BE%9D%E6%AC%84%E4%BD%8D%E6%8E%92%E5%BA%8F)。國家圖書館網站提供\*\*《MARC21中文手冊》\*\*等教材，列出各欄位對應的定義與使用規則。
*   **RDA** – _Resource Description and Access_：現行的編目內容規則，由多國圖書館共同制定。RDA採用了FRBR/IFLA LRM模型語境，強調元素的明確定義與關係記錄。RDA Toolkit為其線上版權威資源，內含完整指引和範例。國家圖書館編目園地亦提供RDA中文文件、培訓材料等[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=%E6%88%90%20RDA%EF%BC%8CRDA%20%E4%BF%AE%E8%A8%82%E8%81%AF%E5%90%88%E6%8C%87%E5%B0%8E%E5%A7%94%E5%93%A1%E6%9C%83,2011%20%E5%B9%B4%E4%B8%89%E6%9C%88%E8%83%BD%E5%87%BA%E7%88%90%20RDA%20%E6%9C%80%E7%B5%82%E6%B8%AC%E8%A9%A6%E5%A0%B1%E5%91%8A%EF%BC%8C%E4%BF%AE%E8%A8%82%E7%B7%A3%E8%B5%B7%E4%B8%BB%E8%A6%81%E6%98%AF%E5%9B%A0%20%E6%87%89%E6%99%82%E4%BB%A3%E7%9A%84%E8%AE%8A%E9%81%B7%EF%BC%8C%E9%9D%A2%E5%B0%8D%E7%B6%B2%E8%B7%AF%E5%AA%92%E9%AB%94%E5%8C%96%E5%92%8C%E5%9C%8B%E9%9A%9B%E4%BA%A4%E6%B5%81%E7%9A%84%E5%A4%A7%E7%92%B0%E5%A2%83%EF%BC%8C%E5%9B%A0%E6%AD%A4%E9%9C%80%E8%A6%81%E6%9C%89%E6%9B%B4%E9%81%A9%E5%90%88%E4%B8%94%E6%9B%B4%E5%85%BC)。由於RDA彈性高，部分學校圖書館在實務中仍以**AACR2**或其中文譯本\*\*CCR《中國編目規則》\*\*為基礎，再逐步過渡到RDA。
*   **ISBD** – _International Standard Bibliographic Description_：由IFLA發布的書目著錄國際標準。ISBD定義了八大區（題名與著者事項、版本事項、出版事項…）的資料及其標點格式，傳統上融入AACR等規則內使用。最新的\*\*ISBD整合版(2011)\*\*提供了適用各類資源的一致性著錄框架[web.lins.fju.edu.tw](https://web.lins.fju.edu.tw/upload/gra/thesis/9906195_49710603.pdf#:~:text=%E7%9A%84%E5%9F%BA%E7%A4%8E%E8%A6%8F%E7%AF%84%EF%BC%8C%E4%B8%8D%E5%83%85%E6%98%AF%20ISBD%20%E7%9A%84%E6%95%B4%E5%90%88%EF%BC%8C%E6%9B%B4%E5%BD%B1%E9%9F%BF%E5%88%B0%E5%90%84%E7%A8%AE%E7%B7%A8%E7%9B%AE%E8%A6%8F%E5%89%87%EF%BC%8C%E4%BE%8B%E5%A6%82%EF%BC%9ARDA%20%E6%88%96%E5%90%84%20%E5%9C%8B%E7%9A%84%E7%B7%A8%E7%9B%AE%E8%A6%8F%E5%89%87%E7%9A%84%E8%A3%BD%E8%A8%82%E6%88%96%E4%BF%AE%E6%94%B9%E7%AD%89%E3%80%82,%E5%87%BA%E7%89%88%20ISBD%20%E7%B5%B1%E4%B8%80%E7%89%88%E7%9A%84%E6%A0%B9%E6%9C%AC%E7%9B%AE%E7%9A%84%E5%9C%A8%E6%96%BC%E7%82%BA%E5%85%A8%E4%B8%96%E7%95%8C%E7%9A%84%E6%8F%8F%E8%BF%B0%E6%80%A7%E7%B7%A8%E7%9B%AE%E6%8F%90%E4%BE%9B%E4%B8%80%E8%87%B4%E6%80%A7%E7%9A%84%E6%A8%99%20%E6%BA%96%EF%BC%8C%E4%BB%A5%E5%B9%AB%E5%8A%A9%E5%9C%A8%E5%85%A8%E4%B8%96%E7%95%8C%E5%9C%96%E6%9B%B8%E9%A4%A8%E8%88%87%E8%B3%87%E8%A8%8A%E6%A9%9F%E6%A7%8B%E4%B9%8B%E9%96%93%E5%AF%A6%E7%8F%BE%E6%9B%B8%E7%9B%AE%E8%A8%98%E9%8C%84%E7%9A%84%E5%9C%8B%E9%9A%9B%E4%BA%A4%E6%8F%9B%EF%BC%9B%E9%81%A9%E6%87%89%E4%B8%8D%E5%90%8C)。在RDA時代，ISBD標點使用變為可選，但許多圖書館為了延續既有目錄呈現習慣，仍選擇在RDA著錄後輸出MARC記錄時保留ISBD標點[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf#:~:text=%E5%8C%85%E5%90%ABISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%EF%83%A0%20i%20%28%E4%B8%AD%E6%96%87%E4%BE%9D%E6%93%9ACCR%E3%80%81%E8%A5%BF%E6%96%87%E4%BE%9D%E6%93%9ARDA%EF%BC%8C%E4%B8%A6%E9%81%B5%E5%BE%AAISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%29%20%E4%B8%8D%E6%8E%A1%E7%94%A8ISBD%E4%B9%8B%E6%A0%BC%E5%BC%8F%EF%83%A0%20,ISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%E9%83%A8%E5%88%86%E7%9C%81%E7%95%A5%EF%83%A0%20c)。
*   **Dewey Decimal Classification (DDC)** **十進位分類法**：世界上應用最廣的圖書分類法之一，也是臺灣許多中小學圖書館採用的分類體系。DDC將知識分成10大類再細分，使用數字表示類目。臺灣有中文譯本（如\*\*《杜威第19版中文摘要本》**等）供參考。另有**中國圖書館分類法（中圖法）\*\*在部分館使用。分類法本身由國際機構維護（DDC由OCLC維護），確保分類號在全球範圍內具有可比性。
*   **Library of Congress Subject Headings (LCSH)** **美國國會圖書館主題標目表**：英文主題標目的權威詞表。許多英文圖書的主題編目採用LCSH詞彙。對於中文館藏，國家圖書館編製了\*\*《中文主題詞表》**等工具，提供中文標準主題詞彙，以及**中國分類主題詞表 (CCT)\*\* 等。本地中小學圖書館常依據課綱和校本需求自行增補主題標目，但整體上宜參照權威詞表以保持一致。
*   **國民中小學圖書館編目工作手冊**：教育部於2011年委託專家編寫的實務指引手冊，由賴苑玲等著[teacherlibrarian.lib.ntnu.edu.tw](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf#:~:text=%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A,%E9%9D%A2)。內容涵蓋編目工作的基本理念、使用工具，以及適用於中小學的具體編目規則、範例和簡化準則。手冊明確、簡潔、實用，被視為學校圖書館編目的重要參考依據[sites.google.com](https://sites.google.com/site/tlresource99/tu-shu-jiao-shi-fu-dao-tuan-chu-ban-pin#:~:text=)。例如手冊中對**索書號書標格式**、**著錄項目子集**等都有建議，在臺灣各校廣為應用。編目人員可將其作為日常工作指南，亦可用於訓練志工與館員。
*   **圖書館設立及營運標準**：教育部訂定的法規（最新修正110年），規範各級學校圖書館的人力、經費、館藏等基準[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556&KeyWord#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E6%87%89%E7%BD%AE%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E4%BA%BA%E5%93%A1%E8%87%B3%E5%B0%91%E4%B8%80%E4%BA%BA%EF%BC%8C%E4%B8%94%E5%8D%A0%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B7%A5%E4%BD%9C%E4%BA%BA%E5%93%A1%E4%B9%8B%E6%AF%94%E7%8E%87%E5%A6%82%E4%B8%8B%EF%BC%9A%20%E4%B8%80%E3%80%81%E5%9C%8B%E5%AE%B6%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E5%9B%9B%E5%88%86%E4%B9%8B%E4%B8%89%E3%80%82%20%E4%BA%8C%E3%80%81%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82%20%E4%B8%89%E3%80%81%E5%A4%A7%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%BA%8C%E3%80%82%20%E5%9B%9B%E3%80%81%E5%B0%88%E7%A7%91%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%BA%8C%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82,%E4%BA%94%E3%80%81%E9%AB%98%E7%B4%9A%E4%B8%AD%E7%AD%89%E5%AD%B8%E6%A0%A1%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82%20%E5%85%AD%E3%80%81%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E3%80%81%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E4%B8%89%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82%20%E4%B8%83%E3%80%81%E5%B0%88%E9%96%80%E5%9C%96%E6%9B%B8%E9%A4%A8%EF%BC%9A%E5%9B%9B%E5%88%86%E4%B9%8B%E4%B8%80%E3%80%82)[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556&KeyWord#:~:text=%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E4%BA%BA%E5%93%A1%E6%87%89%E5%85%B7%E5%82%99%E4%B8%8B%E5%88%97%E8%B3%87%E6%A0%BC%E4%B9%8B%E4%B8%80%EF%BC%9A%20%E4%B8%80%E3%80%81%E5%9C%8B%E5%85%A7%E5%A4%96%E5%A4%A7%E5%AD%B8%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E7%B3%BB%E3%80%81%E6%89%80%E6%88%96%E7%9B%B8%E9%97%9C%E7%B3%BB%E3%80%81%E6%89%80%E7%95%A2%E6%A5%AD%EF%BC%9B%E6%88%96%E6%9C%89%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E9%96%80%E5%AD%B8%E7%A7%91%20%E8%AB%96%E8%91%97%E7%B6%93%E5%85%AC%E9%96%8B%E5%87%BA%E7%89%88%E8%80%85%E3%80%82%20%E4%BA%8C%E3%80%81%E5%85%B7%E5%85%AC%E5%8B%99%E4%BA%BA%E5%93%A1%E5%9C%96%E6%9B%B8%E5%8F%B2%E6%96%99%E6%AA%94%E6%A1%88%E8%81%B7%E7%B3%BB%E4%BB%BB%E7%94%A8%E8%B3%87%E6%A0%BC%E3%80%82%20%E4%B8%89%E3%80%81%E4%BE%9D%E6%95%99%E8%82%B2%E4%BA%BA%E5%93%A1%E4%BB%BB%E7%94%A8%E6%A2%9D%E4%BE%8B%E9%80%B2%E7%94%A8%E4%B9%8B%E5%85%B7%E5%9C%8B%E5%85%A7%E5%A4%96%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E3%80%81%E4%BA%BA%E6%96%87%E7%A4%BE%E6%9C%83%E7%9B%B8%E9%97%9C%E7%A7%91%E6%89%80%E5%8F%8A,%E5%AD%B8%E4%BD%8D%E5%AD%B8%E7%A8%8B%E7%A2%A9%E5%A3%AB%E4%BB%A5%E4%B8%8A%E7%95%A2%E6%A5%AD%E8%B3%87%E6%A0%BC%E8%80%85%E3%80%82%20%E5%9B%9B%E3%80%81%E6%9B%BE%E4%BF%AE%E7%BF%92%E6%94%BF%E5%BA%9C%E6%A9%9F%E9%97%9C%EF%BC%88%E6%A7%8B%EF%BC%89%E3%80%81%E5%A4%A7%E5%B0%88%E6%A0%A1%E9%99%A2%E3%80%81%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%8F%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9B%B8%E9%97%9C%E6%B3%95%E4%BA%BA%E5%9C%98%E9%AB%94%E8%BE%A6%20%E7%90%86%E4%B9%8B%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E5%AD%B8%E8%AA%B2%E7%A8%8B%E4%BA%8C%E5%8D%81%E5%AD%B8%E5%88%86%E6%88%96%E4%B8%89%E7%99%BE%E4%BA%8C%E5%8D%81%E5%B0%8F%E6%99%82%E4%BB%A5%E4%B8%8A%E8%80%85%E3%80%82%20%E4%BA%94%E3%80%81%E5%85%B7%E4%B8%89%E5%B9%B4%E4%BB%A5%E4%B8%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E5%B7%A5%E4%BD%9C%E7%B6%93%E9%A9%97%E8%80%85%E3%80%82)。雖屬宏觀規範，但其中要求中小學圖書館應配備具圖書資訊專業人員，並接受定期訓練[edu.law.moe.gov.tw](https://edu.law.moe.gov.tw/LawContent.aspx?id=GL001556&KeyWord#:~:text=%E5%9B%9B%E3%80%81%E6%9B%BE%E4%BF%AE%E7%BF%92%E6%94%BF%E5%BA%9C%E6%A9%9F%E9%97%9C%EF%BC%88%E6%A7%8B%EF%BC%89%E3%80%81%E5%A4%A7%E5%B0%88%E6%A0%A1%E9%99%A2%E3%80%81%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%8F%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%9B%B8%E9%97%9C%E6%B3%95%E4%BA%BA%E5%9C%98%E9%AB%94%E8%BE%A6%20%E7%90%86%E4%B9%8B%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E5%AD%B8%E8%AA%B2%E7%A8%8B%E4%BA%8C%E5%8D%81%E5%AD%B8%E5%88%86%E6%88%96%E4%B8%89%E7%99%BE%E4%BA%8C%E5%8D%81%E5%B0%8F%E6%99%82%E4%BB%A5%E4%B8%8A%E8%80%85%E3%80%82%20%E4%BA%94%E3%80%81%E5%85%B7%E4%B8%89%E5%B9%B4%E4%BB%A5%E4%B8%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E5%B7%A5%E4%BD%9C%E7%B6%93%E9%A9%97%E8%80%85%E3%80%82%20%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%8F%8A%E5%9C%8B%E6%B0%91%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%A6%82%E7%84%A1%E5%89%8D%E9%A0%85%E8%B3%87%E6%A0%BC%E4%BA%BA%E5%93%A1%EF%BC%8C%E5%BE%97%E7%94%B1%E6%9B%BE%E4%BF%AE%E7%BF%92%E5%9C%96%20%E6%9B%B8%E8%B3%87%E8%A8%8A%E6%88%96%E9%96%B1%E8%AE%80%E6%8E%A8%E5%8B%95%E7%9B%B8%E9%97%9C%E5%B0%88%E6%A5%AD%E8%AA%B2%E7%A8%8B%E8%80%85%E6%93%94%E4%BB%BB%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E4%BA%BA%E5%93%A1%E3%80%82,%E5%89%8D%E4%BA%8C%E9%A0%85%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%B0%88%E6%A5%AD%E4%BA%BA%E5%93%A1%EF%BC%8C%E6%AF%8F%E5%B9%B4%E6%87%89%E6%8E%A5%E5%8F%97%E4%BA%8C%E5%8D%81%E5%B0%8F%E6%99%82%E4%BB%A5%E4%B8%8A%E4%B9%8B%E5%B0%88%E6%A5%AD%E8%A8%93%E7%B7%B4%E3%80%82)。此標準凸顯編目等技術服務的重要性。配合該標準，教育部及各縣市教育局亦制定**評鑑指標**，通常包括館藏編目率、編目品質等項，督促學校落實編目工作。
*   **編目園地與編目聯繫網絡**：國家圖書館**編目園地**網站提供豐富的規範、Q&A和培訓資料，是國內編目權威資訊來源[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E5%B0%B1%E5%80%8B%E4%BA%BA%E6%89%80%E7%9F%A5%EF%BC%8C%E4%BC%BC%E7%84%A1%E9%9C%80%E5%B0%87%E3%80%8C%E7%B7%9A%E4%B8%8A%E7%9B%AE%E9%8C%84%E3%80%8D%E5%8A%A0%E8%AB%B8%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E4%B9%8B%E5%89%8D%EF%BC%8C%E5%BD%A2%E6%88%90%E5%BD%A2%E5%AE%B9%E8%A9%9E%E6%80%A7%E7%9A%84%E8%A9%9E%E7%B5%84%EF%BC%9A%E3%80%8C%E7%B7%9A%E4%B8%8A%E7%9B%AE%E9%8C%84%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E7%9B%B4%E7%A8%B1%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E8%B1%88%E4%B8%8D%E7%9B%B4%E6%8E%A5%E4%BA%86%E7%95%B6%E4%B8%94%E7%B0%A1%E6%98%8E%E5%8F%AF%E5%8F%96%E3%80%82%20%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%20%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E3%80%81%E4%BB%A3%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%81%E7%8B%B9%E7%BE%A9%E8%A9%9E%E3%80%81%E5%BB%A3%E7%BE%A9%E8%A9%9E%E3%80%81%E5%8F%83%E9%A0%85%E7%9B%B8%E9%97%9C%E8%A9%9E%E3%80%8D%E7%AD%89%EF%BC%9A%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%B8%8D%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E5%8F%AA%E4%BD%9C%E7%82%BA%E6%8C%87%E5%BC%95%E4%BD%BF%E7%94%A8%E8%80%85%E5%8E%BB%E6%AA%A2%E9%96%B1%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BD%BF%20%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%E3%80%8D%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E5%8F%8A%E3%80%8C%E7%94%A8%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%8D%E3%80%82%20%E8%8C%B2%E8%88%89%E4%B8%80%E4%BE%8B%EF%BC%8C%E4%BB%A5%E6%98%8E%E9%AB%94%E5%88%B6%E3%80%82%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E4%BB%A3%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%81%E8%AB%96%E7%90%86%E5%AD%B8%E3%80%8D%EF%BC%8C%E7%8B%B9%E3%80%8C%E5%BD%A2%E5%BC%8F%E9%82%8F%E8%BC%AF%E3%80%81%E6%95%B8%E7%90%86%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E5%8F%83%E3%80%8C%E5%9B%A0%E6%98%8E%E3%80%81%E5%90%8D%E5%AD%B8%E3%80%8D%E3%80%82%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%8C%E7%94%A8%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%E3%80%82)。館員可查詢機讀格式、分類、權威等問題解答，獲取最新規則解讀。此外，**NBINet全國圖書書目資訊網**以及**圖書館自動化系統廠商**也提供編目相關資源，例如聯合目錄查詢、轉檔工具、編目社群討論區等。善用這些資源有助於掌握最新編目趨勢，並解決實務疑難。
*   **國際書目數據庫與合作計畫**：對於多語言或特殊資料編目，中小學圖書館可參考國際數據庫。如**OCLC WorldCat**提供全球書目紀錄共享，可用於抄編(copy cataloging)；**VIAF虛擬國際權威檔**整合多國權威檔，有助於確認作者名稱的權威形式。這些國際資源雖非直接規範，但可視作權威參考，有利於提升編目紀錄的品質與兼容性。

中小學場域的簡化策略
==========

中小學圖書館因人力與讀者群特性，常需在繁複的編目規範中採取**適當簡化**，以平衡編目品質與效率。以下梳理數項此場域中的常見痛點與對應的簡化策略：

*   **人力與專業不足：**許多中小學缺乏專職館員，編目工作多由兼任教師或志工負責，他們往往未受過完整的編目訓練[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E7%84%B6%E8%80%8C%E5%9B%A0%E5%AD%B8%E6%A0%A1%E7%B7%A8%E5%88%B6%EF%BC%8C%E7%84%A1%E5%B0%88%E4%BB%BB%E5%9C%96%E6%9B%B8%E5%AE%A4%E7%AE%A1%E7%90%86%E4%BA%BA%E5%93%A1%EF%BC%8C%E8%80%8C%E7%82%BA%E8%80%81%E5%B8%AB%E5%85%BC%E4%BB%BB%EF%BC%9B%E5%A4%A7%E9%83%A8%E5%88%86%E5%9C%96%E6%9B%B8%E5%AE%A4%E4%BA%8B%E5%8B%99%E7%9A%86%E5%80%9A%E9%9D%A0%E5%BF%97%E5%B7%A5%E8%99%95%E7%90%86%E3%80%82%E5%8E%9F%E5%85%88%E5%9C%96%E6%9B%B8%E7%9A%86%E5%BC%B5%E8%B2%BC%E6%9C%89%E6%9B%B8%E6%A8%99%EF%BC%8C%E4%B8%A6%E8%97%89%E6%AD%A4%E6%8E%92%E5%88%97%E6%9B%B8%E7%B1%8D%E3%80%82%E4%BD%86%E8%BF%91%E5%B9%B4%E4%BE%86%E5%B9%BE%E4%B9%8E%E6%89%80%E6%9C%89%E5%BF%97%E5%B7%A5%E5%B9%B4%E7%B4%80%E7%9A%86%E5%B7%B2%E8%B6%85%E9%81%8E65%E6%AD%B2%20%EF%BC%8C%E7%84%A1%E6%B3%95%E8%BC%95%E6%98%93%E7%9C%8B%E6%B8%85%E6%A5%9A%E6%9B%B8%E6%A8%99%E5%85%A7%E5%AE%B9%E4%B8%A6%E6%AD%A3%E7%A2%BA%E6%8E%92%E5%BA%8F%EF%BC%8C)。這導致全按高標準編目在實際上難以為繼。**簡化策略：**聚焦核心欄位，捨棄次要細節。手冊建議可採**核心紀錄集**，如題名、主要作者、出版年、出版社、頁數等重點著錄項，確保每本書至少基本可查，其餘高難度資訊（例如複雜附註、內容分析）可從簡處理或暫缺。此舉讓非專業人員也能順利完成大部分編目任務。另可利用**聯合編目**（抄編）降低門檻：透過NBINet或圖書館軟體的Z39.50功能搜尋他館紀錄，下載後僅調整館藏資訊，即可完成編目。這避免了從零開始原編的工作量和專業要求。
*   **館藏量大時間有限：**中小學每年新增書籍量可能不小，但編目時間有限。特別是開學前後、閱讀計畫推廣時會集中入藏大量新書。**簡化策略：**採取**分批逐步深化**的做法：新書先快速建立簡略紀錄上架（包含基本識別資訊供借閱），等高峰期過後再逐步補充完整資料，例如增加主題標目、內容提要等。這確保新書能及時提供服務，又兼顧長期質量。在此同時，可善用**批次處理工具**（如MarcEdit）對多筆紀錄進行全局增補或修改，提高補充細節的效率。
*   **志工年長視力不佳導致排架困難：**有些學校仰賴高齡志工協助，但細緻的索書號（含小數點、作者號等）對他們排架造成困擾[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E7%84%B6%E8%80%8C%E5%9B%A0%E5%AD%B8%E6%A0%A1%E7%B7%A8%E5%88%B6%EF%BC%8C%E7%84%A1%E5%B0%88%E4%BB%BB%E5%9C%96%E6%9B%B8%E5%AE%A4%E7%AE%A1%E7%90%86%E4%BA%BA%E5%93%A1%EF%BC%8C%E8%80%8C%E7%82%BA%E8%80%81%E5%B8%AB%E5%85%BC%E4%BB%BB%EF%BC%9B%E5%A4%A7%E9%83%A8%E5%88%86%E5%9C%96%E6%9B%B8%E5%AE%A4%E4%BA%8B%E5%8B%99%E7%9A%86%E5%80%9A%E9%9D%A0%E5%BF%97%E5%B7%A5%E8%99%95%E7%90%86%E3%80%82%E5%8E%9F%E5%85%88%E5%9C%96%E6%9B%B8%E7%9A%86%E5%BC%B5%E8%B2%BC%E6%9C%89%E6%9B%B8%E6%A8%99%EF%BC%8C%E4%B8%A6%E8%97%89%E6%AD%A4%E6%8E%92%E5%88%97%E6%9B%B8%E7%B1%8D%E3%80%82%E4%BD%86%E8%BF%91%E5%B9%B4%E4%BE%86%E5%B9%BE%E4%B9%8E%E6%89%80%E6%9C%89%E5%BF%97%E5%B7%A5%E5%B9%B4%E7%B4%80%E7%9A%86%E5%B7%B2%E8%B6%85%E9%81%8E65%E6%AD%B2%20%EF%BC%8C%E7%84%A1%E6%B3%95%E8%BC%95%E6%98%93%E7%9C%8B%E6%B8%85%E6%A5%9A%E6%9B%B8%E6%A8%99%E5%85%A7%E5%AE%B9%E4%B8%A6%E6%AD%A3%E7%A2%BA%E6%8E%92%E5%BA%8F%EF%BC%8C)。**簡化策略：**調整索書號與排架規則以降低難度。例如僅使用**粗分類號**（取DDC小數點前的整數部分）分類上架，同類號圖書不再細分排序[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=1)；輔以**顏色標記**，如在書背貼不同顏色圓點代表大類，方便志工辨識[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=2)。這種方法雖犧牲了精細排架的精確性，但在幼兒圖書、漫畫等特定館藏中已被證明實用[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E8%B2%B4%E9%A4%A8%E4%BB%A5%E5%BE%80%E6%9B%B8%E6%A8%99%E4%BB%A5%E7%B4%A2%E6%9B%B8%E8%99%9F%E7%82%BA%E4%B9%8B%EF%BC%8C%E6%9C%AA%E4%BE%86%E8%8B%A5%E6%94%B9%E7%82%BA%E4%B8%8D%E5%90%AB%E5%B0%8F%E6%95%B8%E9%BB%9E%E7%9A%84%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E6%88%96%E6%8E%A1%E7%94%A8%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%A8%99%E7%A4%BA%EF%BC%8C%E7%95%B6%E6%96%B0%E8%88%8A%E5%9C%96%E6%9B%B8%E4%BD%B5%E5%90%8C%E4%B8%8A%E6%9E%B6%E6%99%82%EF%BC%8C%E6%9C%83%E8%AE%93%E4%BA%BA%E6%9C%89%E6%9B%B8%E6%A8%99%E6%A0%BC%E5%BC%8F%E4%B8%8D%E4%B8%80%E8%87%B4%E7%9A%84%E8%A7%80%E6%84%9F%E3%80%82%E9%80%9A%E5%B8%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%83%85%E9%87%9D%E5%B0%8D%E5%85%B6%E4%B8%AD%E9%83%A8%E5%88%86%E9%A4%A8%E8%97%8F%E6%8E%A1%E7%94%A8%20%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%88%96%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E7%9A%84%E6%9B%B8%E6%A8%99%E6%96%B9%E5%BC%8F%EF%BC%88%E4%BE%8B%E5%A6%82%EF%BC%9A%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E4%B9%8B%E5%AC%B0%E5%B9%BC%E5%85%92%E5%9C%96%E6%9B%B8%E3%80%81%E7%AB%A5%E6%9B%B8%E3%80%81%E5%B0%8F%E8%AA%AA%E3%80%81%E6%BC%AB%E7%95%AB%EF%BC%89%EF%BC%8C%E4%B8%A6%E4%B8%94%E5%8F%A6%E5%8D%80%E4%B8%8A%E6%9E%B6%E9%99%B3%E5%88%97%E3%80%82)。國家圖書館亦指出多數圖書館傾向將此類簡化限於部分館藏，並**區隔擺放**以免與原有編目系統混亂[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E8%B2%B4%E9%A4%A8%E4%BB%A5%E5%BE%80%E6%9B%B8%E6%A8%99%E4%BB%A5%E7%B4%A2%E6%9B%B8%E8%99%9F%E7%82%BA%E4%B9%8B%EF%BC%8C%E6%9C%AA%E4%BE%86%E8%8B%A5%E6%94%B9%E7%82%BA%E4%B8%8D%E5%90%AB%E5%B0%8F%E6%95%B8%E9%BB%9E%E7%9A%84%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E6%88%96%E6%8E%A1%E7%94%A8%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%A8%99%E7%A4%BA%EF%BC%8C%E7%95%B6%E6%96%B0%E8%88%8A%E5%9C%96%E6%9B%B8%E4%BD%B5%E5%90%8C%E4%B8%8A%E6%9E%B6%E6%99%82%EF%BC%8C%E6%9C%83%E8%AE%93%E4%BA%BA%E6%9C%89%E6%9B%B8%E6%A8%99%E6%A0%BC%E5%BC%8F%E4%B8%8D%E4%B8%80%E8%87%B4%E7%9A%84%E8%A7%80%E6%84%9F%E3%80%82%E9%80%9A%E5%B8%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%83%85%E9%87%9D%E5%B0%8D%E5%85%B6%E4%B8%AD%E9%83%A8%E5%88%86%E9%A4%A8%E8%97%8F%E6%8E%A1%E7%94%A8%20%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%88%96%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E7%9A%84%E6%9B%B8%E6%A8%99%E6%96%B9%E5%BC%8F%EF%BC%88%E4%BE%8B%E5%A6%82%EF%BC%9A%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E4%B9%8B%E5%AC%B0%E5%B9%BC%E5%85%92%E5%9C%96%E6%9B%B8%E3%80%81%E7%AB%A5%E6%9B%B8%E3%80%81%E5%B0%8F%E8%AA%AA%E3%80%81%E6%BC%AB%E7%95%AB%EF%BC%89%EF%BC%8C%E4%B8%A6%E4%B8%94%E5%8F%A6%E5%8D%80%E4%B8%8A%E6%9E%B6%E9%99%B3%E5%88%97%E3%80%82)。學校採行前可權衡對讀者檢索和校外資料交換的影響。
*   **主題分析能力不足：**專業館員欠缺導致書籍主題標目往往難以嚴謹賦予。錯誤或欠精確的主題詞不僅無助檢索，甚至誤導讀者。**簡化策略：**對於一般性館藏，可使用**固定書架分類**替代詳細主題標目，例如將文學類按作者姓氏排列、自然科學類按課程章節分類等，同時在OPAC提供簡單關鍵字全文檢索，部分取代人工標目的功能。另外，也可引入**讀者年級分級**或**閱讀指標標記**（如Lexile值）作為輔助標目，這符合學校場域讀者需求，又較易取得（許多少兒圖書附有閱讀分級）。總之，以讀者看得懂的方式組織資源，讓目錄成為閱讀推廣的工具，而非堅守圖書館學術語而無人問津。
*   \*\*中英編目混用問題：\*\*臺灣中小學圖書館的館藏中，中文與英文（或其他語種）資料並存，常見編目問題如：西文圖書是否依AACR2/RDA英文準則著錄？標目要不要中英文對照？**簡化策略：**一般做法是**各語種各從其規範**：中文資料依中文版編目規則（CCR或RDA中文本地規則）處理，英文資料盡量依據ALA/LC英文編目準則，然後在本地系統中統一以MARC21格式存檔。對讀者顯示時，可透過OPAC介面做適當轉換或雙語對照，例如主題標目同時掛接英文LCSH和中文詞表，以利不同語言讀者檢索。此外，對人名標目可建立參考，如外文作者附加中文譯名參考，使讀者用中文亦能找到。例如檢索「馬克吐溫」時OPAC會引導至標目"Twain, Mark"的記錄。這些措施提高了目錄的語言友好性。
*   **硬體設備與經費限制：**部分學校軟硬體有限，如無條碼設備、RFID，編目上可能無法嚴格執行館藏編號、條碼掃描管理等。**簡化策略：**可採**簡易館藏編號**（如直接使用流水號貼紙），並在系統中允許手動輸入借還。雖效率略降，但能避免昂貴升級。在軟體方面，若圖書館自動化系統不支持完整MARC編輯，可透過**自訂欄位模板**方式讓工作人員填寫主要欄位，系統在背後生成簡化的MARC紀錄。對較少用到的子欄位可隱藏預設值以減少干擾。如經費允許，則盡量爭取升級設備，因為長遠而言，規範的編目配合良好的設備（如掃描槍快速錄入ISBN、條碼）能顯著提高效率並減少錯誤。

總之，中小學圖書館編目簡化的核心原則是：**從實際需求出發，確保讀者能找到書、館員能管好書即可**。凡不影響館藏識別與檢索的細節，可酌情省略。同時制定館內**編目政策**以書面形式記錄哪些項目簡化、哪些仍依標準執行，確保即使人員更替，政策延續且目錄資料保持一致性。簡化並非降低專業門檻的藉口，而是為在特定環境下達成目標所做的策略調適。

對應到系統的資料欄位建議
============

學校圖書館系統的設計需將編目規範轉化為具體的資料庫欄位。以下提供**書目（Bibliographic）**、**館藏（Item/Holdings）**、\*\*權威（Authority）\*\*三個層次的資料欄位建議。每個欄位包括名稱（中英文）、資料型別、是否必填、欄位說明及例子。其中加★者為中小學圖書館最常用的核心欄位。

\*\*➤ 書目紀錄欄位（Bibliographic Record Fields）：\*\*書目欄位描述館藏本身的書目特徵，大致對應MARC21書目格式。

| 欄位名稱 (中英文) | 資料型別 | 必填? | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| ★ 題名 (Title) | 文本 (Text) | 是 | 書刊的正題名，含副題名與責任者敘述。如有副題名以「:」分隔，責任者以「/」引出[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf#:~:text=%E5%8C%85%E5%90%ABISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%EF%83%A0%20i%20%28%E4%B8%AD%E6%96%87%E4%BE%9D%E6%93%9ACCR%E3%80%81%E8%A5%BF%E6%96%87%E4%BE%9D%E6%93%9ARDA%EF%BC%8C%E4%B8%A6%E9%81%B5%E5%BE%AAISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%29%20%E4%B8%8D%E6%8E%A1%E7%94%A8ISBD%E4%B9%8B%E6%A0%BC%E5%BC%8F%EF%83%A0%20,ISBD%E6%A8%99%E9%BB%9E%E7%AC%A6%E8%99%9F%E9%83%A8%E5%88%86%E7%9C%81%E7%95%A5%EF%83%A0%20c)。 | 例：`童年: 高爾基自傳三部曲之一 / (俄) 高爾基著` |
| 副題名 (Subtitle) | 文本 (Text) | 視情況 | 題名的補充說明，通常與正題名一同顯示，便於識別資料主題或範圍。 | 例：`我們與惡的距離 : 公視人生劇展原著小說` |
| ★ 責任者 (Author/Contributor) | 文本 (Text) | 是（有作者則必填） | 資料的主要創作者名稱。個人姓名採「姓，名」形式；多人時可列第一責任者[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23831#:~:text=%E6%A8%99%E7%9B%AE%3A%20%E7%95%B6%E7%B7%A8%E7%9B%AE%E5%93%A1%E5%AE%8C%E6%88%90%E5%B0%8D%E6%96%87%E7%8D%BB%E7%9A%84%E6%8F%8F%E8%BF%B0%E5%BE%8C%EF%BC%8C%E9%82%84%E9%9C%80%E8%A6%81%E5%8A%A0%E4%B8%8A%E7%B5%84%E7%B9%94%E7%9B%AE%E9%8C%84%E7%9A%84%E6%AA%A2%E7%B4%A2%E6%AC%BE%E7%9B%AE%EF%BC%8C%E9%80%99%E5%B0%B1%E6%98%AF%E6%88%91%E5%80%91%E8%AA%AA%E7%9A%84%E6%A8%99%E7%9B%AE%E6%88%96%E6%AA%A2%E7%B4%A2%E9%BB%9E%E3%80%82%E6%A8%99%E7%9B%AE%E6%98%AF%20%E7%9B%AE%E9%8C%84%E4%B8%8A%E6%8C%87%E5%BC%95%E7%9B%AE%E9%8C%84%E6%8E%92%E6%AA%A2%E7%B7%9A%E7%B4%A2%E7%9A%84%E9%A0%85%E7%9B%AE%EF%BC%8C%E4%B8%80%E8%88%AC%E5%8F%AF%E5%88%86%E7%82%BA%E9%A1%8C%E5%90%8D%E6%A8%99%E7%9B%AE%E3%80%81%E8%91%97%E8%80%85%E6%A8%99%E7%9B%AE%E3%80%81%E4%B8%BB%E9%A1%8C%E6%A8%99%E7%9B%AE%E3%80%81%E5%88%86%E9%A1%9E%E6%A8%99%E7%9B%AE%E3%80%82)。其餘次要貢獻者可另外記錄。 | 例：`高爾基, 1868-1936`；次要者：`林夢子 譯` |
| 版本項 (Edition) | 文本 (Text) | 否 | 資料的版本訊息。如版次、修訂版說明等。 | 例：`初版`；`修訂第2版` |
| ★ 出版地 (Place of Pub.) | 文本 (Text) | 是 | 出版事項的一部分：出版城市名稱。通常與出版社、年份一起構成出版項。 | 例：`臺北市` |
| ★ 出版者 (Publisher) | 文本 (Text) | 是 | 資料的出版機構或發行者名稱。 | 例：`親子天下` |
| ★ 出版年 (Publication Year) | 年份 (YYYY) | 是 | 出版發行的年份。如有多個年份（印刷年等）取主要年份。 | 例：`2020` |
| ★ 稽核項(ISBN/ISSN) | 文本/數字混合 | 是（有則填） | 國際標準書號ISBN或期刊ISSN。便於唯一識別及條碼掃描輸入[loc.gov](https://www.loc.gov/marc/umb/um07to10.html#:~:text=A%20Summary%20of,source%20%C2%B7%20100%20Main)。無ISBN者可不填。 | 例：`ISBN 9789571466125` |
| ★ 級別分類號 (Class Number) | 文本 (Text) | 是 | 資料主題的分類代碼。常用DDC或中圖法分類號。可包含整數+小數部分。 | 例：`863.599` (文學類西班牙小說) |
| 附加作者號 (Cutter Number) | 文本 (Text) | 推薦 | 協助區分同一分類下不同作品的字母碼，通常根據作者姓氏。與分類號合組索書號。 | 例：`G214` (依author Gorky 編配) |
| 索書號 (Call Number) | 文本 (Text) | 系統生成 | 該館藏完整的排架號，一般由分類號+作者號等組成[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E6%89%8B%E5%86%8A%E7%AC%AC204%E9%A0%81%E4%B8%89%E3%80%81%E7%B4%A2%E6%9B%B8%E8%99%9F%E6%89%80%E7%A4%BA%EF%BC%9A%E2%80%9C)。可由系統依分類號和作者號自動組合。 | 例：`863.599 G214 2011` |
| ★ 語文代碼 (Language) | 代碼 (Code) | 是 | 資料語種的標識。可用ISO639-2語言代碼。供檢索與統計使用。 | 例：`chi` (中文)；`eng` (英文) |
| 頁數/卷冊 (Extent) | 文本 (Text) | 是 | 稽核項的一部分，記載資料物理長度（頁數）或冊數。 | 例：`250頁`；`4冊` |
| 尺寸 (Dimensions) | 文本 (Text) | 否 | 資料尺寸，高度（公分）為主，可含寬度或其他單位。通常圖書可省略，高度標準化。 | 例：`21公分` |
| 附件項 (Accompanying Material) | 文本 (Text) | 否 | 是否有附件資料，如CD、習題冊等。 | 例：`含光碟 1片(4¾吋)` |
| 叢集系列 (Series) | 文本 (Text) | 視情況 | 若該書屬於叢書系列，記錄系列名及卷號。 | 例：`牛津英語文庫 ; 12` |
| ★ 主題標目 (Subject Headings) | 文本 (Text) | 推薦 | 資料主題的標準詞彙。可選用中文主題詞或LCSH等。複數主題可多筆記錄。 | 例：`青少年--心理學`；`圖書館員--小說` |
| 附註 (Notes) | 文本 (Text) | 否 | 補充說明資訊的欄位，包括內容提要、作者簡介、獲獎紀錄等。可多條。 | 例：`附錄: 含參考書目 (第233-240頁)` |
| 内容提要 (Summary) | 文本 (Text) | 選填 | 對作品內容的簡短介紹，方便讀者了解主旨。 | 例：`本書講述一隻小狐貍歷險找尋自我的故事...` |
| ★ 圖書類型 (Resource Type) | 枚舉值 (Enum) | 是 | 資源類型，如圖書(Book)、期刊(Serial)、AV資料等[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%28%E5%90%AB%E5%90%84%E9%A1%9E%E8%B3%87%E6%BA%90MARC%2021%E5%AF%A6%E4%BD%9C%29.pdf#:~:text=,%E2%96%B7%20337%20Media)。系統常用此決定編目模板。 | 例：`圖書`、`期刊`、`電子資源` |
| 關聯資源 (Related Works) | 識別碼列表 | 否 | 相關資料的識別，如前集/續集、改編電影的片名等。可用識別碼（如另一書目ID）。 | 例：`續作識別碼: BIB12456` |
| 分類號2 (Alt Class#) | 文本 (Text) | 否 | 第二分類號（如同時採用其他分類法時），或校本特殊分類。 | 例：`綜二 813`（校內課程分類代碼） |

_(註：上述字段與MARC21書目欄位大致對應。例如題名對應MARC的245欄，責任者主欄對應100/110欄，出版項對應264欄位等。為簡化，中小學場域可僅使用最常用子欄位)_[loc.gov](https://www.loc.gov/marc/umb/um07to10.html#:~:text=A%20Summary%20of,source%20%C2%B7%20100%20Main)[koha-community.org](https://koha-community.org/manual/latest/zh_Hant/epub/catalogingpreferences.xhtml#:~:text=%E7%B7%A8%E7%9B%AE%20%E5%85%B6%E5%85%A7%E5%AE%B9%E7%82%BAMARC%20%E7%9A%84%E6%AC%84%E8%99%9F,%E4%BE%8B%E5%A6%82%EF%BC%8C082ab%EF%BC%8C050ab%EF%BC%8C080ab%EF%BC%8C090ab%E5%9C%A8)。

**➤ 館藏紀錄欄位（Item/Holdings Record Fields）：**館藏欄位用於記錄每一實體副本的狀態與位置信息。在MARC21中常用**_MFHD_**格式或本地館藏表實現。

| 欄位名稱 (中英文) | 資料型別 | 必填? | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| ★ 館藏號 (Accession No.) | 識別碼 (ID) | 是 | 館藏件的唯一識別號，系統自動生成或手工指定。可與條碼相同。 | 例：`A202300157` (館藏流水號) |
| ★ 條碼號 (Barcode) | 條碼/文本 | 是 | 張貼於館藏上的條碼號，掃描用以借還。每冊唯一。 | 例：`4711234567890` |
| ★ 所在館別 (Location) | 文本 (代碼) | 是 | 館藏所在的館別或館室代碼。中小學通常只有一館，可設區域代碼。 | 例：`Main`（總館）; `Juv`（兒童區） |
| 架位標示 (Shelf Location) | 文本 | 否 | 館內細分的書架或區域位置標記。 | 例：`二樓東側/自然科學區` |
| 狀態 (Item Status) | 枚舉值 | 是 | 館藏狀態：可流通(in)、外借中(out)、館內閱覽、遺失等。 | 例：`可借出`；`館內閱覽` |
| 借閱次數 (Circulation Count) | 數字 | 否 | 該冊館藏累計借出次數，供統計分析。 | 例：`5`（借出5次） |
| 掛失標記 (Lost Status) | 布林值(Boolean) | 否 | 是否已掛失報銷。是則此館藏不再可借。 | 例：`否` / `是` |
| 購置日期 (Acquisition Date) | 日期 | 否 | 該館藏入館登錄日期。 | 例：`2023-08-15` |
| 價格 (Price) | 貨幣 | 否 | 購買或估算的價格，便於資產管理。 | 例：`NT$300` |
| 捐贈者 (Donor) | 文本 | 否 | 若此館藏為捐贈，記錄捐贈人或單位名稱。 | 例：`張三豐先生捐贈` |
| 附註 (Item Note) | 文本 | 否 | 特殊說明，如「附光碟存於櫃檯」等。 | 例：`光碟存放於視聽資料區` |
| 相關書目ID (Bib ID Link) | 識別碼 | 是 | 關聯的書目紀錄ID，將此館藏掛接到對應書目。 | 例：`BIBID 00012546` |

_(註：館藏紀錄可對應MARC21館藏格式如852欄位（位置）、876-878欄位（條碼、狀態）等。但實務中常由ILS系統以非MARC資料表管理。以上欄位基本滿足中小學館藏管理需求，可擴充)_。

\*\*➤ 權威紀錄欄位（Authority Record Fields）：\*\*權威欄位用於維護名稱、主題等檢索點的一致性。中小學圖書館或未獨立建立權威檔，但系統應具備相應結構以便擴充或匯入上級機構權威資料。

| 欄位名稱 (中英文) | 資料型別 | 必填? | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| 權威類型 (Authority Type) | 枚舉值 | 是 | 權威記錄種類：個人名稱(Name)、團體名稱、主題(Subject)、系列等。 | 例：`Name`；`Subject` |
| ★ 權威標目 (Authorized Heading) | 文本 | 是 | 經規範的標目正確形式[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84)。 | 例：`Twain, Mark, 1835-1910` |
| 變異參考 (Variant Reference) | 文本 (多值) | 否 | 非正式用法或別名的參考形式，指向本權威標目[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%20%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E3%80%81%E4%BB%A3%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%81%E7%8B%B9%E7%BE%A9%E8%A9%9E%E3%80%81%E5%BB%A3%E7%BE%A9%E8%A9%9E%E3%80%81%E5%8F%83%E9%A0%85%E7%9B%B8%E9%97%9C%E8%A9%9E%E3%80%8D%E7%AD%89%EF%BC%9A%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%B8%8D%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E5%8F%AA%E4%BD%9C%E7%82%BA%E6%8C%87%E5%BC%95%E4%BD%BF%E7%94%A8%E8%80%85%E5%8E%BB%E6%AA%A2%E9%96%B1%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BD%BF%20%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%E3%80%8D%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E5%8F%8A%E3%80%8C%E7%94%A8%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%8D%E3%80%82%20%E8%8C%B2%E8%88%89%E4%B8%80%E4%BE%8B%EF%BC%8C%E4%BB%A5%E6%98%8E%E9%AB%94%E5%88%B6%E3%80%82%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E4%BB%A3%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%81%E8%AB%96%E7%90%86%E5%AD%B8%E3%80%8D%EF%BC%8C%E7%8B%B9%E3%80%8C%E5%BD%A2%E5%BC%8F%E9%82%8F%E8%BC%AF%E3%80%81%E6%95%B8%E7%90%86%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E5%8F%83%E3%80%8C%E5%9B%A0%E6%98%8E%E3%80%81%E5%90%8D%E5%AD%B8%E3%80%8D%E3%80%82%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%8C%E7%94%A8%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%E3%80%82)。可多筆。 | 例：`Clemens, Samuel Langhorne` (Mark Twain別名) |
| 關聯權威 (Related Authority) | 識別碼 | 否 | 相關權威記錄的連結，例如系列權威連結至叢書權威。 | 例：`參見權威ID: AUTH000210 (Shakespeare, family)` |
| 欄目備註 (Authority Note) | 文本 | 否 | 欄目的其他說明，如名稱來源、使用範圍等。 | 例：`本名Samuel Langhorne Clemens，美國小說家。` |

_(註：權威記錄對應MARC21權威格式，如100欄（個人名稱正標目）、400欄（變異參考）、670欄（來源註）等。考量中小學應用，以上欄位已足夠基本權威控制。)_

上述欄位表力求完整又不至冗餘，特別標註★者屬**中小學常用核心欄位**。在系統實作時，可針對不同資料類型提供欄位子集。例如編目圖書時顯示大部分欄位，而編目視聽材料時額外顯示載體類型、長度等專屬欄位。透過資料庫正規化和適當的前端表單配置，確保欄位之間的分層關係（如多個館藏紀錄關聯同一書目紀錄）明確，為後續功能設計奠定良好基礎。

對應到系統的功能設計建議
============

為滿足中小學圖書館的實際需求，圖書館系統（ILS）除了欄位設計，還需提供相應功能。以下按照「需求→功能→為何」的方式，提出關鍵功能模組建議：

*   \*\*需求：\*\*降低編目難度，讓缺乏經驗的館員也能正確建檔。  
    **功能建議：**提供**原始編目模板 & 抄編輔助**。在介面上內建幾種常見素材的編目模板（如一般圖書、連續刊、AV資料），隱藏不必要的冷僻欄位，只呈現核心欄位供填寫。同時整合Z39.50/SRU查詢外館資料的抄編功能：館員輸入ISBN等關鍵字即可搜尋國圖或其他學校的MARC紀錄，一鍵匯入本館系統再做微調[sris-tw.libguides.com](https://sris-tw.libguides.com/c.php?g=733347&p=6933010#:~:text=Koha%20%E7%89%B9%E5%88%A5%E8%AA%AA%E6%98%8E%3A%20%E5%B0%8F%E5%9E%8B%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%BB%BA%E8%AD%B0%20,Koha%20%E7%B7%A8%E7%9B%AE%E5%8F%AF%E5%88%86%E7%82%BA%E5%8E%9F%E7%B7%A8%E5%8F%8A%E6%8A%84%E7%B7%A8%EF%BC%8C%E5%8E%9F%E7%B7%A8%E5%8D%B3%E6%8C%89MARC21%E7%9A%84%E7%B7%A8%E7%9B%AE%E8%A6%8F%E5%89%87%E5%8F%8A%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E6%94%BF%E7%AD%96%EF%BC%8C%E4%BE%9D%E7%85%A7%E6%AC%84%E4%BD%8D%E5%A1%AB%E5%85%A5%E7%9B%B8%E9%97%9C%E8%B3%87%E6%96%99%E3%80%82%E6%8A%84%E7%B7%A8%E5%89%87%E6%98%AF%E6%A0%B9%E6%93%9A%E9%A4%A8%E8%97%8F%E7%9A%84%E5%B9%BE%E5%80%8B%E9%87%8D%E8%A6%81%E8%BE%A8%E5%88%A5%E8%B3%87%E6%96%99%E5%A6%82ISBN%E3%80%81%E8%91%97%E8%80%85%E3%80%81%E9%A1%8C%E5%90%8D%E7%AD%89%E5%A1%AB)。  
    \*\*為何：\*\*模板降低了新手面對繁瑣欄位的畏難情緒，而抄編大幅節省時間並減少輸入錯誤。這兩者結合使非專業人員也能創建合格紀錄，緩解中小學缺專人的困境。
*   \*\*需求：\*\*確保關鍵欄位完整填寫，維持編目品質的一致性。  
    **功能建議：**實施**欄位完整性檢查與提示**。系統在館員存檔前自動檢查必填欄位（如題名、責任者、出版年等）是否空缺，若有缺漏彈出提示並阻止保存。另外，可設定業務規則，如檢查ISBN格式正確性、分類號是否符合預期範圍、主題詞是否選自權威表等，對不合規的地方發出警告。  
    \*\*為何：\*\*透過軟體把關，避免因疏忽出現殘缺紀錄[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E7%84%B6%E8%80%8C%E5%9B%A0%E5%AD%B8%E6%A0%A1%E7%B7%A8%E5%88%B6%EF%BC%8C%E7%84%A1%E5%B0%88%E4%BB%BB%E5%9C%96%E6%9B%B8%E5%AE%A4%E7%AE%A1%E7%90%86%E4%BA%BA%E5%93%A1%EF%BC%8C%E8%80%8C%E7%82%BA%E8%80%81%E5%B8%AB%E5%85%BC%E4%BB%BB%EF%BC%9B%E5%A4%A7%E9%83%A8%E5%88%86%E5%9C%96%E6%9B%B8%E5%AE%A4%E4%BA%8B%E5%8B%99%E7%9A%86%E5%80%9A%E9%9D%A0%E5%BF%97%E5%B7%A5%E8%99%95%E7%90%86%E3%80%82%E5%8E%9F%E5%85%88%E5%9C%96%E6%9B%B8%E7%9A%86%E5%BC%B5%E8%B2%BC%E6%9C%89%E6%9B%B8%E6%A8%99%EF%BC%8C%E4%B8%A6%E8%97%89%E6%AD%A4%E6%8E%92%E5%88%97%E6%9B%B8%E7%B1%8D%E3%80%82%E4%BD%86%E8%BF%91%E5%B9%B4%E4%BE%86%E5%B9%BE%E4%B9%8E%E6%89%80%E6%9C%89%E5%BF%97%E5%B7%A5%E5%B9%B4%E7%B4%80%E7%9A%86%E5%B7%B2%E8%B6%85%E9%81%8E65%E6%AD%B2%20%EF%BC%8C%E7%84%A1%E6%B3%95%E8%BC%95%E6%98%93%E7%9C%8B%E6%B8%85%E6%A5%9A%E6%9B%B8%E6%A8%99%E5%85%A7%E5%AE%B9%E4%B8%A6%E6%AD%A3%E7%A2%BA%E6%8E%92%E5%BA%8F%EF%BC%8C)。尤其對編目經驗不足者，系統提示能即時教育其遵循規範。例如提醒「主題標目未填，將影響主題檢索」，長期有助於培養正確編目習慣。
*   **需求：**快速定位資料、提供多元檢索途徑給讀者。  
    **功能建議：**加強**OPAC檢索**功能。支援**關鍵字模糊查詢**（不需完整拼寫也能找到），以及進階檢索選項（按題名、作者、主題、分類等欄位過濾）。提供**繁簡中文同檢**（如搜尋「後鼻音」同時找到「後鼻音」「后鼻音」）與**拼音/譯名檢索**（如輸入“Lu Xun”也可找到「魯迅」的書）。此外，可在OPAC整合館藏地圖或架位導引，顯示所查書籍在館內的具體位置。  
    **為何：**學生讀者常不知道如何精確拼寫或選擇檢索欄位，模糊搜尋和同義處理提高了檢索成功率。多元檢索途徑保障了各種找書策略（按作者找、按主題找）的實現。而架位導引能縮短取書時間，提升用戶體驗。這些功能均以**讀者為中心**，符合學校圖書館「便利可用」的服務要求。
*   **需求：**維持館藏標目的一致，避免同義詞混亂導致檢索不全。  
    **功能建議：**內建**權威控制模組**。系統應提供權威檔管理界面，讓館員可以建立/導入權威記錄並關聯至書目欄位（如作者、主題）。實現**自動核檢**：當新輸入一個名稱或主題時，系統自動比對現有權威檔，若發現相同實體的不同寫法，提示使用既有標目或建立參照[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%20%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E3%80%81%E4%BB%A3%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%81%E7%8B%B9%E7%BE%A9%E8%A9%9E%E3%80%81%E5%BB%A3%E7%BE%A9%E8%A9%9E%E3%80%81%E5%8F%83%E9%A0%85%E7%9B%B8%E9%97%9C%E8%A9%9E%E3%80%8D%E7%AD%89%EF%BC%9A%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%B8%8D%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E5%8F%AA%E4%BD%9C%E7%82%BA%E6%8C%87%E5%BC%95%E4%BD%BF%E7%94%A8%E8%80%85%E5%8E%BB%E6%AA%A2%E9%96%B1%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BD%BF%20%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%E3%80%8D%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E5%8F%8A%E3%80%8C%E7%94%A8%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%8D%E3%80%82%20%E8%8C%B2%E8%88%89%E4%B8%80%E4%BE%8B%EF%BC%8C%E4%BB%A5%E6%98%8E%E9%AB%94%E5%88%B6%E3%80%82%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E4%BB%A3%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%81%E8%AB%96%E7%90%86%E5%AD%B8%E3%80%8D%EF%BC%8C%E7%8B%B9%E3%80%8C%E5%BD%A2%E5%BC%8F%E9%82%8F%E8%BC%AF%E3%80%81%E6%95%B8%E7%90%86%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E5%8F%83%E3%80%8C%E5%9B%A0%E6%98%8E%E3%80%81%E5%90%8D%E5%AD%B8%E3%80%8D%E3%80%82%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%8C%E7%94%A8%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%E3%80%82)。例如，錄入「Mark Twain」時提醒「已有權威頭標：Twain, Mark」。  
    **為何：**沒有權威控制會導致目錄中出現多種拼法、譯名指向同一人或主題，讀者檢索時需逐一嘗試，體驗不佳[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84)。引入權威模組可確保**唯一標目**原則，每個人名、主題都統一，用不同別名檢索時系統也能導向。同時這也方便日後資料匯交換，與外部資料庫對接更準確。
*   **需求：**管理多冊館藏及複本情況，提高流通管理效率。  
    **功能建議：**加強**館藏流通子系統**與編目模組聯動。允許一筆書目下新增多筆館藏紀錄，各館藏可單獨記錄條碼和狀態。提供**批次館藏編號**生成功能（如登錄一套教材的多本時，自動產生連續條碼和館藏號）。同時在借還時，OPAC能即時顯示所有館藏的狀態（在架/借出/預約）和館藏地。對遺失或報廢的館藏，可一鍵修改狀態並在必要時將該館藏併入歷史檔，不影響其餘複本借閱。  
    **為何：**學校可能有多本相同教科書或熱門讀物，逐冊管理能掌握每本去向。批次館藏處理減少人工逐一輸入的重複勞動。借閱過程中，準確的館藏狀態讓管理人員和讀者即時了解可借副本數。此模組確保**一書多本**情況下依然井然有序，避免弄混。
*   **需求：**提升編目工作效率，減少重複勞動和人工錯誤。  
    **功能建議：**提供**批次與智能工具**。例如**批匯入/匯出**：可將Excel書目清單按照映射匯入系統自動生成紀錄，或將館藏紀錄批量匯出供備份分析。**MarcEdit接口**：高階館員可連接MarcEdit等外部工具進行批次編修再同步回系統。**拼寫檢查**：對題名、摘要等文字欄位整合拼字檢查或常見錯字提醒，特別是中文書名易出現異體字，可內建字詞轉換建議。**模板複製**：在編目類似館藏（如成套或系列）時，允許複製現有紀錄再修改差異部分。  
    **為何：**上述工具旨在**減少重工**與**降低錯誤**。例如一次採購多本同系列書，只需編目一本然後複製修改，即可產生其他紀錄，既省時又保證格式一致。拼寫檢查則避免因輸入錯別字導致目錄檢索不命中。這些功能解放館員時間，可專注於更需人工判斷的工作上（如分類號分配、主題分析）。
*   \*\*需求：\*\*輔助館員進行決策和管理，如了解館藏使用情況、編目進度等。  
    **功能建議：**開發**報表與統計分析**功能。內置常用報表，如「館藏分類分佈」、「借閱排行榜」、「未借出館藏清單」、「編目中待處理清單」等，一鍵生成。支持自訂查詢，如篩選出「近一年新增但仍未借出的書目」以評估選書效益。**編目日誌**功能則記錄每筆紀錄的建立/修改日期與人員，方便主管追蹤編目進度和質量。  
    **為何：**圖書館數據蘊含管理決策資訊。透過統計，館員可發現哪些類別圖書使用率高以便補強，哪些書常年不上架可考慮汰除。另外，對學校而言，這些數據也是向校方展示圖書館價值的依據（如每月借閱量、閱讀推廣成效）。編目日誌則保障**責任可追溯**，確保館員嚴謹對待編目品質。
*   **需求：**靈活應對本校特殊情況，例如校本分類、館藏特殊標記等。  
    **功能建議：**提供**自訂代碼與欄位**功能。允許系統管理員增修本校自用的代碼表（如讀者類型、館藏類型）。在編目欄位上，支持新增**本地欄位**（如MARC的9XX欄位）來記錄校內特有資訊。例如某校推行分級閱讀計畫，可增加「閱讀級別」欄位，供館員填入適讀年級。OPAC則可據此提供依年級篩選。  
    **為何：**每個學校可能有些與眾不同的需求，例如**校本課程**分類、書本難易度標示等。軟體若無法適應，館員只能透過備註欄曲線記錄，既不利檢索又可能破壞標準格式。有了可自訂欄位，學校特色與標準格式不再矛盾，系統既滿足本地需求又保持與上級標準兼容。

概括而言，**以使用者（讀者與館員）的需求為導向**來設計功能，是關鍵考量。中小學館員人力有限，因此系統應**多做事、減少人工**；學生讀者經驗不足，因此OPAC應**智能友善、引導發現**。以上建議的功能模組相互配合，能夠打造一個貼合中小學環境、兼具專業與便利的圖書館系統。

常見坑與避雷清單
========

在實務操作中，中小學圖書館編目和系統管理容易遇到一些陷阱。下面列出常見問題及避免方法，供館員參考以**避雷**：

*   **坑1：**將**分類工作等同於編目全部**。有時學校只做圖書分類上架，卻未建立對應的書目紀錄，導致OPAC查無資料。  
    \*\*避雷：\*\*務必認識分類與編目的區別[ting-wen.com](https://www.ting-wen.com/file/courseview/22-5A%E6%8A%80%E8%A1%93%E6%9C%8D%E5%8B%99%E4%B8%80%EF%BC%88%E4%B8%AD%E6%96%87%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%EF%BC%89%E8%A9%A6%E9%96%B1%E8%AC%9B%E7%BE%A9.pdf#:~:text=%E5%89%96%E8%A7%A3%E9%96%8B%E4%BE%86%E3%80%82%E5%9B%A0%E6%AD%A4%EF%BC%8C%E9%80%99%E7%A8%AE%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E7%9A%84%E7%B5%84%E7%B9%94%E6%96%B9%E5%BC%8F%EF%BC%8C%E5%AF%A6%E5%85%B7%E6%9C%89%E7%B5%90%E6%A7%8B%E4%B8%8A%E7%9A%84%E7%B5%84%E7%B9%94%E7%89%B9%E6%80%A7%E3%80%82%20%E4%B8%BB%E9%A1%8C%E7%B7%A8%E7%9B%AE%E5%8D%B3%E5%B0%8D%E8%B3%87%E8%A8%8A%E7%89%A9%E4%BB%B6%E4%BD%9C%E5%85%A7%E5%AE%B9%E4%B8%BB%E9%A1%8C%E7%9A%84%E5%88%86%E6%9E%90%EF%BC%8C%E4%BB%A5%E6%B1%BA%E5%AE%9A%E5%88%86%E9%A1%9E%E8%99%9F%E5%8F%8A%E4%B8%BB%E9%A1%8C%E6%A8%99%E7%9B%AE%EF%BC%8C%E4%BD%BF%E8%AE%80%E8%80%85%E7%9E%AD%E8%A7%A3%E5%85%B6%E5%85%A7%E5%AE%B9%E4%B8%BB%E9%A1%8C%20%E6%88%96%E5%AD%B8%E7%A7%91%E6%80%A7%E8%B3%AA%E3%80%82%E7%82%BA%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E5%88%86%E9%A1%9E%E7%9A%84%E7%9B%AE%E7%9A%84%E5%9C%A8%20%E6%B2%BB%E6%9B%B8%20%E3%80%82%E4%B8%80%E6%96%B9%E9%9D%A2%E6%98%AF%E7%82%BA%E4%BA%86%E7%B5%84%E7%B9%94%E5%9C%A8%E5%AA%92%E9%AB%94%E4%B8%AD%E7%9A%84%E5%85%A7%E5%AE%B9%EF%BC%8C%E5%B0%87%E7%9B%B8%E5%90%8C%E5%85%A7,%E6%9C%80%E5%B0%8F%E5%8A%AA%E5%8A%9B%E5%8E%9F%E5%89%87%EF%BC%8C%E6%89%BE%E5%88%B0%E4%BB%96%E5%80%91%E7%B4%A2%E6%B1%82%E7%9A%84%E5%9C%96%E8%A8%8A%E8%B3%87%E6%96%99%E3%80%82%E5%9B%A0%E6%AD%A4%EF%BC%8C%E6%88%91%E5%80%91%E8%AA%AA%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E7%9A%84%E5%88%86%E9%A1%9E%EF%BC%8C%E5%85%B7%E6%9C%89%20%E7%99%BC%E5%B1%95%20%E7%9A%84%E7%B5%84%E7%B9%94%20%E7%89%B9%E6%80%A7%E3%80%82%20%E7%8B%B9%E7%BE%A9%E7%9A%84%E7%B7%A8%E7%9B%AE%E5%B0%88%E6%8C%87%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%E3%80%82)。分類（貼標上架）不能取代書目紀錄的建立。即使暫無力詳編，也應至少輸入基本書目資料到系統，確保檢索可用。
*   **坑2：\*\*\*\*欄位誤用**造成資料混亂。例如將卷號寫入題名欄，或把附註內容塞進出版項。這會導致OPAC顯示錯誤資訊，讀者難以判斷。  
    \*\*避雷：\*\*參照標準範例，遵循欄位定義填寫。例如卷冊資訊應該填入「卷冊欄位」或附註，不要直接附加在題名後除非用規範格式[ting-wen.com](https://www.ting-wen.com/file/courseview/22-5A%E6%8A%80%E8%A1%93%E6%9C%8D%E5%8B%99%E4%B8%80%EF%BC%88%E4%B8%AD%E6%96%87%E5%9C%96%E6%9B%B8%E5%88%86%E9%A1%9E%E7%B7%A8%E7%9B%AE%EF%BC%89%E8%A9%A6%E9%96%B1%E8%AC%9B%E7%BE%A9.pdf#:~:text=%E5%BB%A3%E7%BE%A9%E7%9A%84%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E5%8C%85%E5%90%AB%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%E8%88%87%E4%B8%BB%E9%A1%8C%E7%B7%A8%E7%9B%AE%E5%85%A9%E6%96%B9%E9%9D%A2%E3%80%82%20%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%E5%8D%B3%E5%B0%8D%E8%B3%87%E8%A8%8A%E7%89%A9%E4%BB%B6%E4%BD%9C%E5%BD%A2%E9%AB%94%E4%B8%8A%E7%9A%84%E5%88%86%E6%9E%90%EF%BC%8C%E6%89%BE%E5%87%BA%E8%B6%B3%E4%BB%A5%E8%AD%98%E5%88%A5%E7%9A%84%E9%A0%85%E7%9B%AE%EF%BC%8C%E6%8C%89%E7%85%A7%E7%B7%A8%E7%9B%AE%E8%A6%8F%E5%89%87%E9%80%90%E9%A0%85%E8%A8%98%E8%BC%89%EF%BC%8C%E4%BD%BF%E8%AE%80%20%E8%80%85%E5%BE%9E%E5%90%84%E8%91%97%E9%8C%84%E9%A0%85%E7%9B%AE%E7%9A%84%E6%8F%8F%E8%BF%B0%EF%BC%8C%E7%9E%AD%E8%A7%A3%E8%A9%B2%E8%B3%87%E8%A8%8A%E7%89%A9%E4%BB%B6%E7%9A%84%E5%A4%96%E5%9C%A8%E7%89%B9%E6%80%A7%E3%80%82%E9%80%99%E7%A8%AE%E7%B5%84%E7%B9%94%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E7%9A%84%E8%A7%80%E5%BF%B5%E5%92%8C%E6%96%B9%E6%B3%95%EF%BC%8C%E6%97%A9%E5%9C%A8%E5%85%AC%20%E5%85%83%E5%89%8D%20250,%E7%9A%84%E4%BA%8C%E7%A8%AE%E4%BD%9C%E6%A5%AD%E4%B9%8B%E4%B8%80%EF%BC%8C%E5%AE%83%E7%9A%84%E7%9B%AE%E7%9A%84%E6%9C%89%E4%B8%89%20%EE%9B%AA%E9%91%91%E5%AE%9A%E5%9C%96%E8%A8%8A%E8%B3%87%E6%96%99%E6%9C%AC%E8%BA%AB%E7%9A%84%E7%89%B9%E5%BE%B5%EF%BC%8C%E5%BB%BA%E7%AB%8B%E5%96%AE%E4%BD%8D%E7%B4%80%E9%8C%84%E3%80%82%20%EE%9B%AB%E6%93%AC%E5%AE%9A%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BD%9C%E7%82%BA%E7%B7%A8%E8%A3%BD%E5%90%84%E7%A8%AE%E7%9B%AE%E9%8C%84%E7%9A%84%E6%A8%99%E6%BA%96%E3%80%82%20%EE%9B%AC%E6%B1%BA%E5%AE%9A%E6%AA%A2%E7%B4%A2%E9%A0%85%EF%BC%8C%E4%BD%9C%E7%82%BA%E7%B7%9A%E4%B8%8A%E7%9B%AE%E9%8C%84%E6%AA%A2%E7%B4%A2%E7%B3%BB%E7%B5%B1%E7%9A%84%E6%A0%B9%E6%93%9A%E3%80%82%20%E5%9C%96%E6%9B%B8%E8%B3%87%E8%A8%8A%E6%98%AF%E9%9B%B6%E7%A2%8E%E8%B3%87%E8%A8%8A%E7%9A%84%E5%90%88%E6%88%90%E9%AB%94%EF%BC%8C%E5%AE%83%E7%9A%84%E5%8A%9F%E7%94%A8%E6%98%AF%E4%BD%BF%E8%B3%87%E8%A8%8A%E6%88%96%E7%9F%A5%E8%AD%98%E5%92%8C%E8%AE%80%E8%80%85%E6%BA%9D%E9%80%9A%EF%BC%8C%E8%AE%80%E8%80%85%E5%A6%82%E4%BD%95%E6%89%8D%E8%83%BD%E5%AE%B9%E6%98%93%E5%9C%B0%E5%92%8C%E6%89%80)。可以將國圖編目範例集打印出來對照，遇不確定時查詢編目園地Q&A或請教有經驗者。
*   **坑3：\*\*\*\*缺乏權威控制**導致目錄碎片。常見如同一作者在不同紀錄中姓名拼法不同（王小明 vs. 小明王），導致使用者檢索不完整。  
    \*\*避雷：\*\*即便人手不足未建完整權威檔，也應養成檢查既有條目的習慣。輸入作者/主題前，先搜一下系統中是否已有類似拼法，儘量沿用現有形式。必要時手工建立「參見檔」，例如在其他地方記下“王小明 用See 王小明 (小明王)”以備查[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%20%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E3%80%81%E4%BB%A3%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%81%E7%8B%B9%E7%BE%A9%E8%A9%9E%E3%80%81%E5%BB%A3%E7%BE%A9%E8%A9%9E%E3%80%81%E5%8F%83%E9%A0%85%E7%9B%B8%E9%97%9C%E8%A9%9E%E3%80%8D%E7%AD%89%EF%BC%9A%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%B8%8D%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E5%8F%AA%E4%BD%9C%E7%82%BA%E6%8C%87%E5%BC%95%E4%BD%BF%E7%94%A8%E8%80%85%E5%8E%BB%E6%AA%A2%E9%96%B1%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BD%BF%20%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%E3%80%8D%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E5%8F%8A%E3%80%8C%E7%94%A8%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%8D%E3%80%82%20%E8%8C%B2%E8%88%89%E4%B8%80%E4%BE%8B%EF%BC%8C%E4%BB%A5%E6%98%8E%E9%AB%94%E5%88%B6%E3%80%82%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E4%BB%A3%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%81%E8%AB%96%E7%90%86%E5%AD%B8%E3%80%8D%EF%BC%8C%E7%8B%B9%E3%80%8C%E5%BD%A2%E5%BC%8F%E9%82%8F%E8%BC%AF%E3%80%81%E6%95%B8%E7%90%86%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E5%8F%83%E3%80%8C%E5%9B%A0%E6%98%8E%E3%80%81%E5%90%8D%E5%AD%B8%E3%80%8D%E3%80%82%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%8C%E7%94%A8%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%E3%80%82)。若系統支援，開啟權威控制功能讓軟體協助提醒。
*   **坑4：**編目紀錄**缺漏關鍵元素**。如只錄入題名和作者，沒有主題詞、分類號，使得讀者無法依主題或分類瀏覽館藏。  
    \*\*避雷：\*\*遵循核心欄位集原則[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/24081#:~:text=%E8%AB%8B%E5%8F%83%E8%80%83%EF%BC%9A%20NBINet%E5%90%84%EF%A7%90%E5%9E%8B%E6%A0%B8%E5%BF%83%E6%9B%B8%E7%9B%AE%E7%B4%80%EF%A4%BF%E2%94%80MARC%2021%EF%A4%9D%E4%BD%8D%E7%B8%BD%E8%A6%BD%20http%3A%2F%2Fnbinet.ncl.edu.tw%2FFileUpload%2FFckeditor%2Ffile%2F,f)。至少題名、主要責任者、出版資訊、分類號、主題詞這幾項要齊備。可根據《核心書目紀錄規範》檢核每筆紀錄。若暫時無法賦予主題詞，也建議日後補上或用簡易關鍵字填充，避免空白。
*   **坑5：\*\*\*\*過度簡化索書號**造成排架混亂或查找困難。比如只用大類號不細分，致同類書過多聚在一起或順序雜亂[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=1)。  
    **避雷：**簡化要有度。可參考國圖建議，僅對特定館藏（如幼兒繪本）使用粗分類+色標法[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E8%B2%B4%E9%A4%A8%E4%BB%A5%E5%BE%80%E6%9B%B8%E6%A8%99%E4%BB%A5%E7%B4%A2%E6%9B%B8%E8%99%9F%E7%82%BA%E4%B9%8B%EF%BC%8C%E6%9C%AA%E4%BE%86%E8%8B%A5%E6%94%B9%E7%82%BA%E4%B8%8D%E5%90%AB%E5%B0%8F%E6%95%B8%E9%BB%9E%E7%9A%84%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E6%88%96%E6%8E%A1%E7%94%A8%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%A8%99%E7%A4%BA%EF%BC%8C%E7%95%B6%E6%96%B0%E8%88%8A%E5%9C%96%E6%9B%B8%E4%BD%B5%E5%90%8C%E4%B8%8A%E6%9E%B6%E6%99%82%EF%BC%8C%E6%9C%83%E8%AE%93%E4%BA%BA%E6%9C%89%E6%9B%B8%E6%A8%99%E6%A0%BC%E5%BC%8F%E4%B8%8D%E4%B8%80%E8%87%B4%E7%9A%84%E8%A7%80%E6%84%9F%E3%80%82%E9%80%9A%E5%B8%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%83%85%E9%87%9D%E5%B0%8D%E5%85%B6%E4%B8%AD%E9%83%A8%E5%88%86%E9%A4%A8%E8%97%8F%E6%8E%A1%E7%94%A8%20%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%88%96%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E7%9A%84%E6%9B%B8%E6%A8%99%E6%96%B9%E5%BC%8F%EF%BC%88%E4%BE%8B%E5%A6%82%EF%BC%9A%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E4%B9%8B%E5%AC%B0%E5%B9%BC%E5%85%92%E5%9C%96%E6%9B%B8%E3%80%81%E7%AB%A5%E6%9B%B8%E3%80%81%E5%B0%8F%E8%AA%AA%E3%80%81%E6%BC%AB%E7%95%AB%EF%BC%89%EF%BC%8C%E4%B8%A6%E4%B8%94%E5%8F%A6%E5%8D%80%E4%B8%8A%E6%9E%B6%E9%99%B3%E5%88%97%E3%80%82)。對一般藏書仍宜保留作者號等細分，以維持基本有序。混用簡化與完整標籤時，記得**區隔陳列**避免視覺混淆[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/31551#:~:text=%E8%B2%B4%E9%A4%A8%E4%BB%A5%E5%BE%80%E6%9B%B8%E6%A8%99%E4%BB%A5%E7%B4%A2%E6%9B%B8%E8%99%9F%E7%82%BA%E4%B9%8B%EF%BC%8C%E6%9C%AA%E4%BE%86%E8%8B%A5%E6%94%B9%E7%82%BA%E4%B8%8D%E5%90%AB%E5%B0%8F%E6%95%B8%E9%BB%9E%E7%9A%84%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E6%88%96%E6%8E%A1%E7%94%A8%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%A8%99%E7%A4%BA%EF%BC%8C%E7%95%B6%E6%96%B0%E8%88%8A%E5%9C%96%E6%9B%B8%E4%BD%B5%E5%90%8C%E4%B8%8A%E6%9E%B6%E6%99%82%EF%BC%8C%E6%9C%83%E8%AE%93%E4%BA%BA%E6%9C%89%E6%9B%B8%E6%A8%99%E6%A0%BC%E5%BC%8F%E4%B8%8D%E4%B8%80%E8%87%B4%E7%9A%84%E8%A7%80%E6%84%9F%E3%80%82%E9%80%9A%E5%B8%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E5%83%85%E9%87%9D%E5%B0%8D%E5%85%B6%E4%B8%AD%E9%83%A8%E5%88%86%E9%A4%A8%E8%97%8F%E6%8E%A1%E7%94%A8%20%E5%9C%93%E9%BB%9E%E8%89%B2%E6%A8%99%E6%88%96%E7%B2%97%E5%88%86%E9%A1%9E%E8%99%9F%E7%9A%84%E6%9B%B8%E6%A8%99%E6%96%B9%E5%BC%8F%EF%BC%88%E4%BE%8B%E5%A6%82%EF%BC%9A%E5%85%AC%E5%85%B1%E5%9C%96%E6%9B%B8%E9%A4%A8%E9%A4%A8%E8%97%8F%E4%B9%8B%E5%AC%B0%E5%B9%BC%E5%85%92%E5%9C%96%E6%9B%B8%E3%80%81%E7%AB%A5%E6%9B%B8%E3%80%81%E5%B0%8F%E8%AA%AA%E3%80%81%E6%BC%AB%E7%95%AB%EF%BC%89%EF%BC%8C%E4%B8%A6%E4%B8%94%E5%8F%A6%E5%8D%80%E4%B8%8A%E6%9E%B6%E9%99%B3%E5%88%97%E3%80%82)。
*   \*\*坑6：\*\***複本處理不當**。如將多冊同書各自建成獨立書目紀錄，造成目錄重複。  
    \*\*避雷：\*\*正確方式是一書一筆書目，下設多筆館藏紀錄。若系統不支持從書目界面新增館藏，務必透過館藏模組連結現有書目ID，而非再次編目。同時在書目紀錄的卷冊註明總冊數（如「館藏2冊」），提醒管理。
*   **坑7：\*\*\*\*數據未備份或誤刪**導致資料永久遺失。學校伺服器維護可能不及時，一旦硬碟損毀或誤操作刪庫，後果嚴重。  
    \*\*避雷：\*\*養成定期備份MARC資料和館藏數據的習慣，可每月導出一份全庫紀錄並異地存放。對重要操作（如批次刪除）設定雙重確認或管理員審批流程。確保資訊中心對圖書館系統數據有納入校備援計畫。
*   \*\*坑8：\*\***忽略編目更新**。課程變革下圖書分類可能需調整，或作者權威名需改（如改用真實姓名）。若忽視更新，目錄將逐漸脫節。  
    \*\*避雷：\*\*定期檢視館藏紀錄。比如十二年國教新課綱實施後，檢查自然科學類書籍分類是否符合新科目架構，必要時批次更改分類號。又如知名作者改名（從筆名改本名出版），可在權威檔中將新名作正式標目、舊名作參考[catweb.ncl.edu.tw](https://catweb.ncl.edu.tw/QandA/page/23623#:~:text=%E6%AC%B2%E4%BA%86%E8%A7%A3%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%8C%E5%85%88%E8%A6%81%E4%BA%86%E8%A7%A3%E4%BB%80%E9%BA%BC%E6%98%AF%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%9F%E6%89%80%E8%AC%82%E3%80%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%EF%BC%88Authority%20File%EF%BC%89%EF%BC%8C%E5%8F%88%E8%AD%AF%E8%A6%8F%E7%AF%84%E6%AA%94%E3%80%82%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%AC%8A%E5%A8%81%20%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%96%87%E6%AA%94%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%E6%AC%8A%E5%A8%81%E6%AA%94%E5%8F%AF%E5%88%86%E7%82%BA%E5%90%8D%E7%A8%B1%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%81%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E5%92%8C%E5%8F%A2%E6%9B%B8%E6%AC%8A%E5%A8%81%E6%AA%943%E7%A8%AE%E3%80%82%20%E6%BA%96%20%E4%B8%8A%E8%80%8C%E8%A8%80%EF%BC%8C%E6%89%80%E8%AC%82%E3%80%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AA%94%E3%80%8D%E6%98%AF%E6%8C%87%E7%94%B1%E8%A8%B1%E5%A4%9A%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E8%A8%98%E9%8C%84%E7%B5%84%E6%88%90%E7%9A%84%E8%A8%88%E7%AE%97%E6%A9%9F%E6%96%87%E6%AA%94%EF%BC%8C%E5%85%B6%E4%BD%9C%E7%94%A8%E6%98%AF%E5%AF%A6%E8%A1%8C%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%8E%A7%E5%88%B6%EF%BC%88%E8%A6%8F%E7%AF%84%E6%8E%A7%E5%88%B6%EF%BC%89%EF%BC%8C%E4%BF%9D%E8%AD%89%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E5%94%AF%E4%B8%80%E6%80%A7%E5%92%8C%E4%B8%80%E8%87%B4%E6%80%A7%EF%BC%88%E7%B5%B1%E4%B8%80%E6%80%A7%EF%BC%89%EF%BC%8C%E4%BB%A5%E4%BE%BF%E6%9C%89,%E6%95%88%E5%9C%B0%E5%AF%A6%E7%8F%BE%E5%B0%8D%E6%A9%9F%E8%AE%80%E7%9B%AE%E9%8C%84%E4%B8%AD%E6%A8%99%E9%A1%8C%E6%A8%99%E7%9B%AE%E7%9A%84%E7%B5%B1%E4%B8%80%E7%AE%A1%E7%90%86%E3%80%82%20%E6%A8%99%E9%A1%8C%E6%AC%8A%E5%A8%81%E6%AC%BE%E7%9B%AE%E4%BE%9D%E6%A8%99%E7%9B%AE%E7%9A%84%E6%80%A7%E8%B3%AA%E6%88%96%E4%BD%9C%E7%94%A8%E5%8F%AF%E5%88%86%E7%82%BA%E3%80%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%92%8C%E3%80%8C%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E3%80%8D%E5%85%A9%E7%A8%AE%E3%80%82%E5%85%B6%E4%B8%AD%EF%BC%8C%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%20%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E3%80%81%E4%BB%A3%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%81%E7%8B%B9%E7%BE%A9%E8%A9%9E%E3%80%81%E5%BB%A3%E7%BE%A9%E8%A9%9E%E3%80%81%E5%8F%83%E9%A0%85%E7%9B%B8%E9%97%9C%E8%A9%9E%E3%80%8D%E7%AD%89%EF%BC%9A%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BF%82%E4%B8%8D%E4%BD%9C%E7%82%BA%E6%A8%99%E5%BC%95%E6%88%96%E6%AA%A2%E7%B4%A2%E4%BD%BF%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E5%8F%AA%E4%BD%9C%E7%82%BA%E6%8C%87%E5%BC%95%E4%BD%BF%E7%94%A8%E8%80%85%E5%8E%BB%E6%AA%A2%E9%96%B1%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%E4%BD%BF%20%E7%94%A8%E7%9A%84%E6%AC%BE%E7%9B%AE%EF%BC%8C%E4%BE%9D%E5%BA%8F%E8%91%97%E9%8C%84%E3%80%8C%E6%AC%BE%E7%9B%AE%E8%A9%9E%E3%80%8D%EF%BC%88%E6%88%96%E6%A8%99%E7%9B%AE%E8%A9%9E%EF%BC%89%E5%8F%8A%E3%80%8C%E7%94%A8%E9%A0%85%E5%90%8C%E7%BE%A9%E8%A9%9E%E3%80%8D%E3%80%82%20%E8%8C%B2%E8%88%89%E4%B8%80%E4%BE%8B%EF%BC%8C%E4%BB%A5%E6%98%8E%E9%AB%94%E5%88%B6%E3%80%82%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E4%BB%A3%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%81%E8%AB%96%E7%90%86%E5%AD%B8%E3%80%8D%EF%BC%8C%E7%8B%B9%E3%80%8C%E5%BD%A2%E5%BC%8F%E9%82%8F%E8%BC%AF%E3%80%81%E6%95%B8%E7%90%86%E9%82%8F%E8%BC%AF%E3%80%8D%EF%BC%8C%E5%8F%83%E3%80%8C%E5%9B%A0%E6%98%8E%E3%80%81%E5%90%8D%E5%AD%B8%E3%80%8D%E3%80%82%E9%9D%9E%E6%AD%A3%E5%BC%8F%E6%A8%99%E9%A1%8C%E6%AC%BE%E7%9B%AE%EF%BC%9A%E3%80%8C%E7%90%86%E5%89%87%E5%AD%B8%E3%80%8C%E7%94%A8%E3%80%8C%E9%82%8F%E8%BC%AF%E3%80%8D%E3%80%82)。持續的編目維護能保持目錄生命力。
*   \*\*坑9：\*\***在編與流通脫節**。若編目人員未及時將新書狀態從「處理中」改為「可借閱」，前端OPAC可能查不到，影響讀者取閱。  
    \*\*避雷：\*\*建立編目流程清單，新書到館→編目→覆核→上架，每步完成即在系統更新狀態。同時可設定系統自動化：只要填妥必備欄位並存檔，紀錄即默認可供讀者查詢（除非特別標記為未上架）。此外，館員應定期抽查最近新增紀錄是否已正常顯示於OPAC。
*   \*\*坑10：\*\***未考慮資料交換與升級**。如果採用過於本地化的做法（如自創格式、省略標準欄位），將來想匯入外部資料或更換系統會遇困難。  
    **避雷：**儘量在簡化的同時**保留標準兼容**。例如雖然館內顯示只用粗分類，但背後MARC仍可存完整分類號（簡化部分存在另一欄位標註即可）。又如新增本地自訂欄位時，應選擇MARC的9XX或備註欄，不要侵佔標準欄位的用法。如此在未來需要與外界共享書目或升級系統時，可透過轉換程式較容易地映射到標準格式上。

每個坑點的出現，往往源自對規範瞭解不足或權衡取捨不當。保持學習和與同行交流是避免重蹈覆轍的良方。利用編目園地等平臺吸取他館經驗，結合上述避雷建議，中小學圖書館的編目作業將更臻完善，少走彎路。

可交付給 AI 小助理的任務清單
================

為進一步提升編目與管理效能，可將部分知識型工作交由AI助理處理。以下列出十項適合由AI協助執行的任務：

1.  \*\*批量編目初稿生成：\*\*提供書籍的基本資訊（如ISBN、書名、作者、出版年），AI助理可自動查詢外部數據庫並根據RDA/MARC規則產出書目紀錄初稿，包括分類號與主題建議，供館員審核。【需求→AI】例如輸入ISBN列表，AI批量返回MARC紀錄檔案。
2.  \*\*書目紀錄完整性檢查：\*\*AI掃描館藏資料庫，找出紀錄中缺漏關鍵欄位者（如沒有主題標目或分類號的紀錄），生成清單提醒館員補全。亦可檢測不合規字段（如年份明顯錯誤）標示出來，維護目錄品質。
3.  \*\*權威名錄比對與合併：\*\*AI定期分析館內作者與主題標目，識別可能屬同一實體的異拼寫或異體字。如發現“Peter Zhang”與“張彼得”高度相關，提示館員合併為單一權威。AI亦可自動連接VIAF等權威來源，更新本地權威紀錄。【需求→AI】這有助於保持標目一致，減輕人工權威控制負擔。
4.  \*\*分類號建議與驗證：\*\*AI根據書名、摘要自動判斷圖書主題，建議一個DDC或中圖法分類號，提供給館員作參考。同時校驗已有分類號是否合理（例如是否與標題主題吻合，是否存在細分錯誤），對可疑者提出提醒。
5.  \*\*主題關鍵字提取與標目建議：\*\*對於缺主題標目的紀錄，AI可讀取圖書簡介或全文目次，自動抽取關鍵詞並匹配標準主題詞表，建議2-3個適合的主題標目供館員選擇。這能彌補館員專業知識不足，確保重要主題都有標引。
6.  \*\*重複書目偵測：\*\*AI助理定期檢查資料庫，透過比對題名、作者、ISBN等，多策略偵測出可能的重複紀錄（如同一本書被建了兩筆）。將懷疑重複者列表提供給館員審核合併，保持目錄整潔。此功能對多人編目或歷年資料累積特別有用。
7.  \*\*館藏狀態監控與預警：\*\*AI可根據借還數據，分析每本書的流通情況。如發現某書長期未歸還超期，AI自動標記提醒館員跟進催還或理賠程序。又如某分類整體借閱率低，AI可提示是否需要剔舊或調整藏書結構。
8.  \*\*自動生成館藏統計報告：\*\*每月或每學期末，AI根據借閱系統數據自動生成圖書館運行情況報告，包括總藏書量、增書數、借閱次數top10、各分類借閱比例等，以圖表呈現，館員僅需稍作調整即可對外報告。這將繁瑣的統計工作自動化，提高效率和準確度。
9.  \*\*MARC紀錄格式轉換：\*\*對於館藏元數據需要在不同格式間轉換的情境，AI可介入執行。例如將一批Excel館藏清單轉為MARC21格式檔案；或將舊系統匯出的CMARC紀錄轉為MARC21編碼。【需求→AI】AI能根據欄位映射規則完成批量轉換，減少人工對照勞動。
10.  \*\*圖書資訊諮詢問答：\*\*AI小助理可直接面向讀者或館員提供智能問答服務。例如讀者提問「有沒有適合五年級閱讀的探險小說推薦？」，AI可即時從館藏中篩選符合年級和題材的書目。或者館員詢問「245欄哪些子欄位必需？」，AI能根據編目規則答覆[loc.gov](https://www.loc.gov/marc/umb/um07to10.html#:~:text=A%20Summary%20of,source%20%C2%B7%20100%20Main)。這相當於一個7x24的虛擬參考員與編目顧問，提高服務水準。

上述任務透過AI協助，可顯著降低人工成本並提升資料品質。同時，人機協作能讓館員將精力投入更高價值的工作（如策展、閱讀指導），實現圖書館服務的升級。

最後強調，在引入AI時須做好結果審核與規則制定，確保AI產出符合專業標準。但可以預見，AI小助理將成為學校圖書館重要的幫手，助力\*\*「智慧編目」**與**「精準服務」\*\*的實現。

**本章關鍵搜尋詞（中英）：**

*   中小學圖書館 編目 標準 / _school library cataloging standards_
*   MARC21 欄位 常用 子集 / _MARC21 fields common subset_
*   圖書館 編目 簡化 策略 / _library cataloging simplification strategy_
*   MARC21 與 RDA 關係 / _MARC21 and RDA relationship_
*   權威控制 中文 名稱 欄位 / _authority control Chinese name fields_
*   國民中小學 圖書館 編目 工作手冊 / _primary secondary school library cataloging handbook_
*   學校圖書館 分類 編目 教育部 / _school library classification cataloging MOE_
*   編目 欄位 設計 ILS / _ILS cataloging field design_
*   FRBR RDA 編目 模型 / _FRBR RDA cataloging model_
*   Z39.50 抄編 圖書館 / _Z39.50 copy cataloging library_
*   權威 紀錄 名稱 標目 / _authority record name heading_
*   OPAC 檢索 功能 設計 / _OPAC search functionality design_
*   編目 常見 錯誤 避免 / _cataloging common errors avoid_
*   MARC 批次 轉換 工具 / _MARC batch conversion tool_
*   學校圖書館 系統 AI 助理 / _school library system AI assistant_

10:20 PM22:20

## Prompt:
ChatGPT-文獻 A 編目 Cataloging.md

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

10:20 PM22:20

## Response:
Thought for 13m 37s

According to a document from 2025-12-23（你上傳的〈ChatGPT-文獻 A 編目 Cataloging.md〉內有 Created/Updated 時戳），這份「A. 編目（Cataloging）」草稿架構已經非常接近可用在系統規格書的程度；我做了兩件事：**(1) 逐條抓出需要更正/補強的地方**、**(2) 以權威來源做「文獻驗證」並補上可追溯引用**，最後再給你一份**可直接貼進企劃/規格**的「校園簡化版 A 章資料庫」。

ChatGPT-文獻 A 編目 Cataloging

* * *

一、你這份 A 章草稿的「文獻驗證」重點與修正建議
-------------------------

### 1) 關鍵錯誤：你寫「MARC 21 的 21 表示第 21 版」

*   你草稿原文提到：「21表示第21版（結合美國、加拿大等版本統一而成）」
    ChatGPT-文獻 A 編目 Cataloging
*   **文獻驗證：正確說法是「MARC 21 這個名稱是在 USMARC 與 CAN/MARC 協調一致後採用；『21』是指邁向 21 世紀、也暗示其國際化」**（不是“第 21 版”）。[The Library of Congress+1](https://www.loc.gov/marc/annmarc21.html?utm_source=chatgpt.com)
*   系統規格上對你的影響：你可以在提案/規格的「標準相容性」段落寫得更精準：**支援 MARC 21（harmonized USMARC/CANMARC）作為交換格式，確保與國圖/NBINet/他校資料共享相容。**[The Library of Congress+1](https://www.loc.gov/marc/annmarc21.html?utm_source=chatgpt.com)

### 2) RDA 的定位：你寫得大方向對，但建議補上「RDA 現代定義」

你草稿把 RDA 描述為內容規則、承接 FRBR/LRM，方向 OK。

*   **權威補強：RDA Toolkit 官方把 RDA 定義為「data elements + guidelines + instructions」用於建立圖書館與文化資源的 metadata，且面向 linked data 應用。**[RDA Toolkit+2RDA Toolkit+2](https://www.rdatoolkit.org/rsc/content/about-rda?utm_source=chatgpt.com)
*   \*\*LRM 補強：IFLA LRM 的使用者任務是 5 個：Find/Identify/Select/Obtain/**Explore**（你草稿多用 FRBR 的 4 任務；需要補上 Explore，對你後面做 Discovery/瀏覽設計很有用）。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com)

### 3) 「內容規則 vs 結構格式 vs 顯示標點」你草稿寫得對，可用權威來源加固

你草稿那段「RDA 告訴我們記哪些資訊；MARC21 負責存在哪裡；ISBD影響顯示」是非常適合放進規格書的架構句。

*   用國圖教材可直接佐證（你草稿也引用了國圖教材）。[CatWeb+1](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf?utm_source=chatgpt.com)
*   ISBD 的權威定義與用途可用 IFLA 的 consolidated edition 佐證。[IFLA+2IFLA Repository+2](https://www.ifla.org/files/assets/cataloguing/isbd/isbd-cons_20110321.pdf?utm_source=chatgpt.com)

### 4) 你提到 Z39.50 / SRU 抄編：方向正確，建議補「標準來源」讓它變規格級證據

*   **Z39.50**：可用 NISO primer 或 ANSI/NISO 標準文件佐證它是跨系統檢索/取回協定。[NISO+2The Library of Congress+2](https://www.niso.org/sites/default/files/2017-08/Z3950_primer.pdf?utm_source=chatgpt.com)
*   **SRU**：直接用 LC 的 SRU 標準頁最乾淨。[The Library of Congress+1](https://www.loc.gov/standards/sru/?utm_source=chatgpt.com)
*   **OCLC WorldCat 的 Z39.50 Cataloging 服務**可作「實務可行性」證據（不是抽象理論）。[OCLC Support](https://help.oclc.org/Metadata_Services/Z3950_Cataloging?utm_source=chatgpt.com)

### 5) 台灣本土「中小學編目」一手資料：你草稿有提到，但我幫你補到“可以打包進提案附件”的等級

你草稿裡提到「國中小圖書館編目手冊」等線索（而且國圖 Q&A 也指向下載位置）。我幫你補上真正可用的主文獻：

*   **《國民中小學圖書館編目工作手冊》**（有 PDF，可直接當你系統欄位/流程簡化的本土依據）。[Teacher Librarian+2cirn.k12ea.gov.tw+2](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)
*   **NBINet 合作編目資源**（含「MARC21 核心書目紀錄欄位」「書目分級原則」「中文RDA編目MARC21著錄原則」等，超適合做你 MVP 的“必填欄位集”依據）。[nbinet.ncl.edu.tw](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
*   **國圖編目園地（機讀格式/權威/編目規則）**：可當你規格書的「國家級規範來源」。[CatWeb+3CatWeb+3CatWeb+3](https://catweb.ncl.edu.tw/standard/east/marc?utm_source=chatgpt.com)

* * *

A. 編目（Cataloging）—「校園簡化版、可直接用於系統規格與企劃」資料庫（文獻驗證版）
================================================

> 設計前提（你可直接貼到企劃書「問題與策略」）：  
> 台灣多數中小學圖書館人力不足、編目由教師兼任，因此系統應用\*\*「核心欄位 + 抄編優先 + 規則自動化 + 仍保留標準相容」\*\*的策略；以便兼顧導入速度與未來可交換/可升級。[Teacher Librarian+2nbinet.ncl.edu.tw+2](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)

* * *

1) 核心概念與名詞（中英文對照表）
------------------

| 術語（中/英） | 一句話定義 | 同義詞/常見誤用（你系統介面/訓練要特別防） |
| --- | --- | --- |
| 編目 Cataloging | 依規範建立資源描述與檢索點，使使用者能找到、辨識並取得資源。 | 誤用：把「貼標/上架」當編目全部。 |
| 記述編目 Descriptive cataloging | 著錄題名、責任者、出版、稽核、附註等「外顯特徵」。 | 常混：把內容主題分析也算進來（那是 subject analysis）。 |
| 主題編目 Subject cataloging | 對內容作分析，給予主題標目/關鍵詞/分類號等檢索點。 | 誤用：只貼關鍵字不控詞彙，導致檢索碎裂。 |
| 書目記錄 Bibliographic record | 描述一個作品/版本層次資源的紀錄（不是某一冊）。 | 常混：把每一本複本都建成一筆書目。 |
| 館藏/複本記錄 Item/Copy record | 描述「這一冊」的條碼、館藏地、狀態、流通資訊。 | 常混：把索書號只放在書目，卻忘了複本層要有可流通的 call number。 |
| 館藏記錄 Holdings record | 記錄館藏持有狀況（期刊卷期、館藏範圍等），常用於連續性資源。 | 誤用：把 holdings 當 item；其實 holdings 更偏集合/範圍。 |
| 款目 Entry | 目錄/索引的最小紀錄單位（條目）。 | 常混：把款目=標目；其實標目是檢索點。[CatWeb](https://catweb.ncl.edu.tw/QandA/page/23831?utm_source=chatgpt.com) |
| 標目 Heading / Access point | 用來排列與檢索的「檢索點」（題名/著者/主題/分類等）。 | 常混：標目 vs 款目；國圖 Q&A 有清楚區分。[CatWeb](https://catweb.ncl.edu.tw/QandA/page/23831?utm_source=chatgpt.com) |
| 追尋 Tracing | 傳統卡片目錄時代記錄「要做哪些附加檢索點」的概念。 | 常被忽略；但對你做「索引欄位」設計很有啟發。[CatWeb](https://catweb.ncl.edu.tw/QandA/page/31057?utm_source=chatgpt.com) |
| 權威控制 Authority control | 維持人名/團體/題名/主題等標目一致，並用參照連結變體。 | 誤用：以為只有大館才需要；其實小館更怕同名異寫。[CatWeb+1](https://catweb.ncl.edu.tw/QandA/page/31499?utm_source=chatgpt.com) |
| 權威記錄 Authority record | 記錄首選標目、變體、來源（如 670）等，用於一致化。 | 常偷懶：全丟備註欄，之後永遠合併不了。[The Library of Congress+1](https://www.loc.gov/marc/authority/ad670.html?utm_source=chatgpt.com) |
| MARC 21 | 機讀交換格式，用欄位/指標/分欄編碼書目與權威等資料。 | 常見誤用：把 MARC 當「編目規則」；其實是 encoding/format。[The Library of Congress+1](https://www.loc.gov/marc/marc21_ann.html?utm_source=chatgpt.com) |
| RDA | 內容規則/元素集，用於建立資源描述與關係資料，面向 linked data。 | 誤用：以為 RDA=一定要很複雜；其實可採 core elements。[RDA Toolkit+1](https://www.rdatoolkit.org/rsc/content/about-rda?utm_source=chatgpt.com) |
| ISBD | 國際書目描述標準，規範描述區塊順序與標點呈現。 | 誤用：把 ISBD 標點直接硬存成字串，導致欄位不可重用。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/isbd/isbd-cons_20110321.pdf?utm_source=chatgpt.com) |
| IFLA LRM | 書目概念模型，定義實體/關係與使用者任務（含 Explore）。 | 常忽略 Explore；但對 K–12「瀏覽」設計很關鍵。[IFLA](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com) |
| 抄編 Copy cataloging | 從外部資料庫取回既有記錄再微調，節省人力。 | 誤用：完全不審核就匯入，錯誤會被放大。[OCLC Support+1](https://help.oclc.org/Metadata_Services/Z3950_Cataloging?utm_source=chatgpt.com) |
| 原始編目 Original cataloging | 無可用外部記錄時自行建立完整書目/檢索點。 | 常見風險：不訂館內政策，每個人做法不同。 |
| Z39.50 | 分散式檢索取回協定，常用於跨館抄編取 MARC 記錄。 | 誤用：以為只有老系統用；其實很多 ILS/資料源仍支援。[NISO+1](https://www.niso.org/sites/default/files/2017-08/Z3950_primer.pdf?utm_source=chatgpt.com) |
| SRU | 基於 URL 的搜尋取回標準，常作為 Z39.50 的 web 替代方案。 | 常混：SRU vs SRW；你規格可先支援 SRU（REST-like）。[The Library of Congress+1](https://www.loc.gov/standards/sru/?utm_source=chatgpt.com) |

* * *

2) 關鍵理論與必讀脈絡（5–10 個必懂概念）
------------------------

1.  **使用者任務 User tasks（Find/Identify/Select/Obtain/Explore）**：這直接對應你 Discovery/OPAC 的「搜尋 + 瀏覽」混合設計；中小學尤其吃重 Explore（逛分類、逛主題、逛系列）。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com)
2.  **國際編目原則 ICP / 巴黎原則 Paris Principles**：用一句話說就是「目錄要幫使用者確認館藏、聚合同一作品、提供一致檢索點」；這是你做「欄位必填門檻」與「標目一致性」的理論底座。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/icp/icp_2016-en.pdf?utm_source=chatgpt.com)
3.  **書目控制 Bibliographic Control 與 UBC（Universal Bibliographic Control）**：你要靠資料共享（NBINet/他校/國圖）省人力，UBC 就是那個“為什麼抄編很合理”的國際論述。[IFLA+1](https://www.ifla.org/projects-and-initiatives-4/ubc-working-group/?utm_source=chatgpt.com)
4.  **實體–關係思維（Work/Expression/Manifestation/Item）**：哪怕 MVP 不做完整 FRBR 化，你的資料模型也一定要先分清 **書目 vs 複本**（否則後面流通/報表都會爆炸）。[IFLA](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com)
5.  **內容規則 vs 結構格式 vs 顯示呈現**：RDA（記什麼）/MARC（怎麼編碼存放）/ISBD（怎麼顯示），把這三層拆開，你系統才做得到「欄位可重用、可轉出、可換皮」。[CatWeb+1](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf?utm_source=chatgpt.com)
6.  **權威控制 Authority control**：在中文姓名/譯名/筆名超常見的環境，沒權威控制，檢索會碎成一地玻璃渣（而且是你自己要掃）。[CatWeb+1](https://catweb.ncl.edu.tw/QandA/page/31499?utm_source=chatgpt.com)
7.  **書目分級（Full/Core/Minimal）與在地政策**：中小學要的是「可用」而不是「國圖級完美」；用 NBINet 的核心欄位與分級概念當你的“最低可上架”門檻最務實。[nbinet.ncl.edu.tw+1](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
8.  **抄編優先（Copy first）是 K–12 的生存策略**：不把 Z39.50/SRU/批次匯入當第一等公民，你系統就會變成「逼老師學 AACR2/RDA」的酷刑工具。[NISO+2The Library of Congress+2](https://www.niso.org/sites/default/files/2017-08/Z3950_primer.pdf?utm_source=chatgpt.com)

* * *

3) 標準 / 規範 / 權威資源（可追溯線索＋用途）
---------------------------

> 下面每一項我都用「你在規格書會用到的角度」寫用途，避免只是一坨書單。

1.  **Library of Congress（LC）— MARC 21 Formats（含 Bib/Authority/Holdings…）**：系統「MARC 匯入匯出、欄位驗證、9XX 本地欄位策略」的權威來源。[The Library of Congress+1](https://www.loc.gov/marc/marc21_ann.html?utm_source=chatgpt.com)
2.  **LC — “MARC 21: Harmonized USMARC and CAN/MARC (1999)”**：你提案寫「採 MARC 21 的理由」可引用（協調後單一版、面向 21 世紀）。[The Library of Congress](https://www.loc.gov/marc/annmarc21.html?utm_source=chatgpt.com)
3.  **國家圖書館 編目園地（Catweb）— 機讀格式（含 MARC21 教材、CMARC3↔MARC21 對照/轉換）**：台灣在地落地與轉檔最重要入口。[CatWeb+1](https://catweb.ncl.edu.tw/standard/east/marc?utm_source=chatgpt.com)
4.  **NBINet 全國圖書書目資訊網 — 合作編目相關資源/處理原則/核心書目欄位**：你要做「校園核心欄位集」「最低可借閱門檻」「批次檢核」的本土權威依據。[nbinet.ncl.edu.tw](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
5.  **《國民中小學圖書館編目工作手冊》（更新資訊見 CIRN/圖書教師團資源）**：你做「中小學簡化策略」時，這本可以當最強中文實務來源。[Teacher Librarian+1](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)
6.  **RDA Toolkit（About RDA / RSC）**：你規格書寫「RDA 元素、關係、核心欄位」與未來 linked data 擴充的權威來源。[RDA Toolkit+1](https://www.rdatoolkit.org/rsc/content/about-rda?utm_source=chatgpt.com)
7.  **IFLA — Library Reference Model（2017）**：資料模型與使用者任務的理論根基（尤其 Explore 對兒童瀏覽）。[IFLA](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com)
8.  **IFLA — ISBD Consolidated edition（2011）**：顯示層（display string）怎麼呈現、哪些標點屬展示規範。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/isbd/isbd-cons_20110321.pdf?utm_source=chatgpt.com)
9.  **IFLA — Statement of International Cataloguing Principles（ICP 2016）/ Paris Principles 1961**：你做「目錄功能」「檢索點策略」「聚合/一致性」的引用來源。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/icp/icp_2016-en.pdf?utm_source=chatgpt.com)
10.  **NISO / LC — Z39.50（ISO 23950 / ANSI/NISO Z39.50）**：你做「抄編連線」的協定標準與說明。[NISO+2The Library of Congress+2](https://www.niso.org/sites/default/files/2017-08/Z3950_primer.pdf?utm_source=chatgpt.com)
11.  **LC — SRU (Search/Retrieve via URL)**：你做「用 HTTP 取回外部書目」的標準入口（比 Z39.50 更 web-friendly）。[The Library of Congress+1](https://www.loc.gov/standards/sru/?utm_source=chatgpt.com)
12.  **Koha Manual（英/繁中）— Cataloging + Z39.50 匯入 + 基本/進階編輯器**：用來參考「小館可用的 UI/流程設計」超實用，且有繁中版可當教學資源。[koha-community.org+2koha-community.org+2](https://koha-community.org/manual/latest/zh_Hant/html/cataloging.html?utm_source=chatgpt.com)
13.  **VIAF（OCLC）**：跨國人名權威整合服務；你做「作者名比對/建議」可以引用。[VIAF](https://viaf.org/en?utm_source=chatgpt.com)
14.  **LC BIBFRAME Initiative**：長期路線圖用（先 MARC、後 linked data 相容）。[The Library of Congress+1](https://www.loc.gov/bibframe/?utm_source=chatgpt.com)

* * *

4) 中小學場域的簡化策略（具體取捨原則）
---------------------

> 目標不是“少做”，而是**把人力花在會影響「找得到書、借得出去、統計跑得出來」的地方**。[Teacher Librarian+1](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)

1.  **抄編優先（Copy-first）**：ISBN/題名查 NBINet/國圖/他館，能匯入就匯入；原始編目只做例外。理由：老師時間是稀缺資源。[nbinet.ncl.edu.tw+2NISO+2](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
2.  **核心欄位優先（Core record）**：用 NBINet「MARC21核心書目紀錄欄位」概念做你 MVP 的必填集（你系統可用「缺欄位不給上架」或「先上架但標示待補」兩段式）。[nbinet.ncl.edu.tw](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
3.  **把 ISBD 標點當“顯示層”而不是“資料層”**：資料庫存元素（title/publisher/date），OPAC 再套版拼成 ISBD 樣式；避免未來轉格式/排序/分面時痛苦。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/isbd/isbd-cons_20110321.pdf?utm_source=chatgpt.com)
4.  **權威控制做「輕量版」**：先針對高頻欄位（作者、叢書名、常用主題）做簡單權威檔/同義名參照；不要一開始就追求國家級完整權威。[CatWeb+1](https://catweb.ncl.edu.tw/QandA/page/31499?utm_source=chatgpt.com)
5.  **模板化 + 隱藏冷門欄位**：預設「一般圖書」「漫畫」「繪本」「視聽」等模板，表單只露出 10–15 個核心欄位；需要的人再切進階。Koha 的 basic/advanced editor 是很好參考。[koha-community.org+1](https://koha-community.org/manual/latest/zh_Hant/html/cataloging.html?utm_source=chatgpt.com)
6.  **館內政策文字化**：把「我們學校題名怎麼寫、叢書怎麼記、作者用本名還是筆名、閱讀級別放哪」寫成一頁政策，系統內建政策提示（換人也不崩）。本土手冊通常也會強調一致性。[Teacher Librarian+1](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)
7.  **本地欄位走 9XX（或獨立擴充欄位）**：例如閱讀級別、適讀年級、校本主題標籤，不要污染標準欄位；保留未來匯出/轉移的可映射性。[The Library of Congress+1](https://www.loc.gov/marc/marc21_ann.html?utm_source=chatgpt.com)
8.  **“可借閱門檻”自動化**：新書只要滿足必填欄位 + 有複本條碼/館藏地，就能自動轉為可查詢/可借閱（除非人工標示處理中）。這是減少「在編與流通脫節」的最短路。[koha-community.org+1](https://koha-community.org/manual/24.05/en/html/cataloging.html?utm_source=chatgpt.com)
9.  **中文在地優先、英文規範作底**：描述元素遵循 RDA/ISBD 的精神，但實作上以國圖/本土手冊的中文例子與慣用做法為主，降低學習門檻。[Teacher Librarian+2CatWeb+2](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)

* * *

5) 對應到系統的資料欄位建議（至少 8 欄；我給你「可直接當 field dictionary」的版本）
-----------------------------------------------------

> 你系統資料層強烈建議分三層：**Bibliographic（書目） / Item（複本） / Authority（權威）**。這個分層本身就是在實作 LRM/FRBR 的最小可行版本。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com)

### 5.1 書目（Bibliographic）欄位（MVP 核心）

| 欄位名（CN/EN） | 型別 | 必填 | 說明 | 例子 | 常見 MARC21 對應（供匯入匯出） |
| --- | --- | --- | --- | --- | --- |
| 題名 Title | text | 是 | 正題名（可另拆副題名） | `小王子` | 245 $a |
| 副題名 Subtitle | text | 否 | 題名補充資訊 | `給大人的童話` | 245 $b |
| 責任者敘述 Statement of responsibility | text | 否 | 封面/書名頁上的責任者字串 | `/ 安東尼·聖修伯里著` | 245 $c |
| 主要創作者 Primary creator | text + authority\_id | 否（建議） | 可連到權威檔；小學可先不做權威也能跑 | `Saint-Exupéry, Antoine de` | 100 / 110 |
| 其他貢獻者 Contributors | repeatable | 否 | 譯者/繪者/編者 | `王小明（譯）` | 700 / 710 |
| 版本 Edition | text | 否 | 版本敘述 | `二版` | 250 |
| 出版地 Place of publication | text | 否 | 出版地 | `臺北市` | 264 $a |
| 出版者 Publisher | text | 否 | 出版者 | `小天下` | 264 $b |
| 出版年 Date of publication | year | 是（建議） | 年份/日期（可允許不確定） | `2019` | 264 $c |
| 稽核/頁數 Extent | text | 否 | 頁數、冊數、時長等 | `200面` | 300 |
| ISBN | text (normalized) | 否（建議） | 建議做正規化（去破折號）與多值 | `978986...` | 020 |
| 語言 Language | code | 否（預設） | 預設 `zh`；匯入時讀碼 | `zh` | 041 / 008 |
| 摘要 Summary | text | 否 | 讓小學生更好判斷內容 | `一個小王子旅行的故事…` | 520 |
| 主題（關鍵詞）Subjects/Keywords | repeatable | 否（建議） | MVP 可先用自然語言；之後再導入控制詞彙 | `友誼`、`成長` | 650 |
| 分類號 Classification number | text | 否（建議） | 先存完整號，再另存校園視覺分類 | `863.57` or `843.912` | 082/090 等（依館用法） |

（MARC 欄位對應屬「匯入匯出層」規格；MVP 介面不必把 245/264 露出來給老師看。）[CatWeb+1](https://catweb.ncl.edu.tw/sites/default/files/upload/training/03_%E8%A8%98%E8%BF%B0%E7%B7%A8%E7%9B%AE%EF%BC%8D%E6%A9%9F%E8%AE%80%E7%B7%A8%E7%9B%AE%E6%A0%BC%E5%BC%8F%E5%8F%8A%E5%85%B6%E8%91%97%E9%8C%84.pdf?utm_source=chatgpt.com)

### 5.2 複本/館藏（Item）欄位（流通一定用得到）

| 欄位名（CN/EN） | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| 條碼 Barcode | text | 是 | 掃描槍輸入 | `A123456789` |
| 索書號 Call number | text | 是（建議） | 上架/找書核心 | `863.57 1234` |
| 館藏地 Location | code | 是 | 書庫/班級書箱/閱讀角 | `LIB_MAIN` |
| 冊次/複本序號 Copy number | int | 否 | 同書多冊 | `2` |
| 狀態 Item status | enum | 是 | `處理中/可借/借出/遺失/報廢` | `可借` |
| 入館日期 Accession date | date | 否 | 到館/建檔日期 | `2025-09-01` |
| 來源/經費 Fund/Source | code | 否 | 便於報表與盤點 | `MOE_GRANT` |
| 價格 Price | number | 否 | 遺失賠償/統計 | `320` |

（這部分對應 ILS 實務；Koha 也明確把「書目」與「館藏/匯入」等流程拆開。）[koha-community.org+1](https://koha-community.org/manual/24.05/en/html/cataloging.html?utm_source=chatgpt.com)

### 5.3 權威（Authority）欄位（輕量版就好，但要留擴充）

| 欄位名（CN/EN） | 型別 | 必填 | 說明 | 例子 | 權威格式線索 |
| --- | --- | --- | --- | --- | --- |
| 首選標目 Authorized heading | text | 是 | 權威控制用的標準形式 | `Mark Twain` | 100（個人名）[The Library of Congress](https://www.loc.gov/marc/authority/ad100.html?utm_source=chatgpt.com) |
| 變體標目 Variant heading | repeatable | 否 | 筆名/異體字/不同拼法 | `Twain, Mark` | 400（常見） |
| 類型 Type | enum | 是 | `Person/Corporate/Series/Topic` | `Person` | 依館內政策 |
| 來源註 Source citation | repeatable | 否 | 記載查證來源（像 670 的概念） | `From title page…` | 670[The Library of Congress](https://www.loc.gov/marc/authority/ad670.html?utm_source=chatgpt.com) |
| 外部識別碼 External ID | text | 否 | VIAF/ISNI 等（非 MVP 也先留欄） | `VIAF:12345` | VIAF[VIAF](https://viaf.org/en?utm_source=chatgpt.com) |

* * *

6) 對應到系統的功能設計建議（至少 8 條；需求→功能→為何）
--------------------------------

1.  **需求：老師不會 MARC/RDA。→ 功能：基本編目表單 + 進階編輯器切換。→ 為何：像 Koha 一樣把複雜度藏起來，讓新手先能建檔。**[koha-community.org+1](https://koha-community.org/manual/latest/zh_Hant/html/cataloging.html?utm_source=chatgpt.com)
2.  **需求：人力不足要快。→ 功能：ISBN 掃描後自動抄編（NBINet/國圖/他館），一鍵匯入並可微調。→ 為何：抄編是 K–12 的生存技能。**[nbinet.ncl.edu.tw+2NISO+2](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
3.  **需求：避免資料爛掉。→ 功能：核心欄位完整性檢核（缺題名/出版年/條碼就警示或阻擋上架）。→ 為何：用 NBINet 的核心欄位概念當最低門檻最在地。**[nbinet.ncl.edu.tw](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
4.  **需求：避免重複建檔。→ 功能：重複書目偵測（ISBN/題名+作者相似度）+ 合併工具（merge）。→ 為何：中小學常見多人輪流做，最容易爆 duplicate。**[Teacher Librarian](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)
5.  **需求：中文姓名/筆名太亂。→ 功能：作者名自動完成 + 權威合併建議 + 參照（see/see also）。→ 為何：權威控制能提升檢索效率與一致性。**[CatWeb+1](https://catweb.ncl.edu.tw/QandA/page/31499?utm_source=chatgpt.com)
6.  **需求：要能跟外界交換資料、未來可搬家。→ 功能：MARC21 / MARCXML 匯入匯出 + CSV 匯出 + 定期備份。→ 為何：標準相容是避免 vendor lock-in 的保命符。**[The Library of Congress+1](https://www.loc.gov/marc/marc21_ann.html?utm_source=chatgpt.com)
7.  **需求：老師不想理解 ISBD 標點。→ 功能：資料元素化儲存 + 顯示模板（可輸出 ISBD 樣式字串）。→ 為何：讓資料可重用、可排序、可分面。**[IFLA+1](https://www.ifla.org/files/assets/cataloguing/isbd/isbd-cons_20110321.pdf?utm_source=chatgpt.com)
8.  **需求：抄編連線要可維運。→ 功能：支援 Z39.50 與 SRU 兩種連線設定（資料源清單、超時、字元集）。→ 為何：不同資料源支援程度不同；雙協定更務實。**[NISO+2The Library of Congress+2](https://www.niso.org/sites/default/files/2017-08/Z3950_primer.pdf?utm_source=chatgpt.com)
9.  **需求：小學讀者更常用“逛的”。→ 功能：以 LRM user tasks 導向的 OPAC（瀏覽系列/作者/主題/新書）。→ 為何：Explore 任務在兒童情境特別重要。**[IFLA](https://www.ifla.org/files/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf?utm_source=chatgpt.com)
10.  **需求：新書流程常卡住。→ 功能：新書處理狀態工作流（到館→編目→覆核→上架）+ 自動轉狀態。→ 為何：減少「有書但查不到」的事故。**[koha-community.org+1](https://koha-community.org/manual/24.05/en/html/cataloging.html?utm_source=chatgpt.com)

* * *

7) 常見坑與避雷清單（至少 8 條）
-------------------

1.  \*\*坑：把每一冊複本建成獨立書目。\*\*避雷：一書目多複本（bib→items），否則 OPAC 會一堆重複結果、報表也會亂。[koha-community.org+1](https://koha-community.org/manual/24.05/en/html/cataloging.html?utm_source=chatgpt.com)
2.  \*\*坑：完全自由輸入作者名（同一人 3 種寫法）。\*\*避雷：至少做「自動完成 + 同名合併提示」的輕權威。[CatWeb+1](https://catweb.ncl.edu.tw/QandA/page/31499?utm_source=chatgpt.com)
3.  \*\*坑：抄編不審核，錯誤直接複製貼上。\*\*避雷：匯入後跑「核心欄位檢核 + 語言/出版年合理性檢查」。[nbinet.ncl.edu.tw+1](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
4.  \*\*坑：把 ISBD 標點硬塞進題名欄，導致排序/切分失真。\*\*避雷：元素化存放、顯示層再拼。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/isbd/isbd-cons_20110321.pdf?utm_source=chatgpt.com)
5.  \*\*坑：本地需求硬塞標準欄位（污染 MARC）。\*\*避雷：本地欄位用 9XX 或系統擴充欄位，保留映射策略。[The Library of Congress+1](https://www.loc.gov/marc/marc21_ann.html?utm_source=chatgpt.com)
6.  \*\*坑：新書建完書目卻沒建 item（沒有條碼/館藏地），流通無法借。\*\*避雷：存檔時強制檢查 item 必備欄位。[koha-community.org+1](https://koha-community.org/manual/24.05/en/html/cataloging.html?utm_source=chatgpt.com)
7.  \*\*坑：不做備份/匯出，系統一換就全滅。\*\*避雷：每月自動備份 + 管理者可一鍵匯出 MARC/CSV。[koha-community.org+1](https://koha-community.org/manual/24.05/en/html/cataloging.html?utm_source=chatgpt.com)
8.  \*\*坑：欄位必填設太嚴，老師乾脆不建檔。\*\*避雷：兩段式門檻——「可上架最低集」+「品質加分欄位」（摘要/主題/系列等）。[nbinet.ncl.edu.tw+1](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
9.  \*\*坑：忽略「中文在地編目慣例」導致訓練成本爆表。\*\*避雷：以國圖/中小學手冊的中文例子做 UI 範例與提示。[Teacher Librarian+2CatWeb+2](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)

* * *

8) 可交付給 AI 小助理的任務清單（至少 10 條）
----------------------------

1.  **整理 NBINet「MARC21 核心書目紀錄欄位」→轉成我系統的 MVP 必填欄位清單（含欄位說明與驗收條件）。**[nbinet.ncl.edu.tw](https://nbinet.ncl.edu.tw/content.aspx?id=33&t=m&utm_source=chatgpt.com)
2.  **把《國民中小學圖書館編目工作手冊》中的流程/欄位，萃取成「中小學編目政策模板（1 頁版）」**（可直接給學校填空）。[Teacher Librarian+1](https://teacherlibrarian.lib.ntnu.edu.tw/vj-attachment/share/%E5%9C%8B%E6%B0%91%E4%B8%AD%E5%B0%8F%E5%AD%B8%E5%9C%96%E6%9B%B8%E9%A4%A8%E7%B7%A8%E7%9B%AE%E5%B7%A5%E4%BD%9C%E6%89%8B%E5%86%8A.pdf?utm_source=chatgpt.com)
3.  **蒐集國圖編目園地「機讀格式/權威/編目規則」各自最常用的教材 PDF 清單**（標註適合新手的章節）。[CatWeb+2CatWeb+2](https://catweb.ncl.edu.tw/standard/east/marc?utm_source=chatgpt.com)
4.  **設計「ISBN 掃描 → 抄編 → 補件 → 建立複本 → 上架」的 UI wireflow**（每步不超過 1–2 個決策點）。
5.  **做一份「中小學常見資源類型（繪本/漫畫/橋樑書/套書/視聽）」的編目模板欄位子集**（每種 10–15 欄）。
6.  **把 Koha 的「基本/進階編目」與「Z39.50 匯入」流程整理成可借鏡的功能需求**（中英對照，轉成 user story）。[koha-community.org+1](https://koha-community.org/manual/latest/zh_Hant/html/cataloging.html?utm_source=chatgpt.com)
7.  **蒐集台灣學校圖書館常見的“閱讀級別/適讀年級”標示做法**，提出「本地欄位 vs MARC 9XX」的最佳落點建議。
8.  **整理「權威控制最小可行」規格**：哪些類型先做（人名/叢書/主題），變體如何存、如何在 OPAC 做 “參照”。[CatWeb+1](https://catweb.ncl.edu.tw/QandA/page/31499?utm_source=chatgpt.com)
9.  **做一份「抄編連線規格」**：Z39.50 與 SRU 的差異、必備參數、錯誤處理、字元集（UTF-8）策略。[NISO+2The Library of Congress+2](https://www.niso.org/sites/default/files/2017-08/Z3950_primer.pdf?utm_source=chatgpt.com)
10.  **把 ICP/Paris Principles 的“目錄功能敘述”濃縮成你提案書可用的 5 句話**（面向校長/主任的版本）。[IFLA+1](https://www.ifla.org/files/assets/cataloguing/icp/icp_2016-en.pdf?utm_source=chatgpt.com)
11.  **整理 LC MARC Authority（100/400/670）最常用欄位的中文速查**，轉成系統內建 tooltip 文案。[The Library of Congress+1](https://www.loc.gov/marc/authority/ad100.html?utm_source=chatgpt.com)
12.  **提出「MARC→內部欄位」與「內部欄位→MARC」映射表 MVP 版**（只涵蓋你必填/常用欄位）。[The Library of Congress+1](https://www.loc.gov/marc/marc21_ann.html?utm_source=chatgpt.com)

* * *

本章關鍵搜尋詞（中英，至少 15 個）
-------------------

1.  中小學圖書館 編目 工作手冊 / _school library cataloging handbook_
2.  國民中小學圖書館編目工作手冊 / _Taiwan K-12 cataloging manual_
3.  NBINet 合作編目 核心書目紀錄 / _NBINet core bibliographic record_
4.  MARC21 核心欄位 / _MARC 21 core fields_
5.  機讀編目格式 著錄 / _MARC bibliographic format description_
6.  款目 標目 差異 / _entry vs heading access point_
7.  權威控制 權威檔 / _authority control authority file_
8.  MARC 21 Authority 100 400 670 / _MARC authority 100 400 670_
9.  RDA core elements / _RDA core elements_
10.  ISBD consolidated edition punctuation / _ISBD punctuation display_
11.  IFLA LRM user tasks Explore / _IFLA LRM user tasks explore_
12.  Z39.50 抄編 / _Z39.50 copy cataloging_
13.  SRU Search Retrieve via URL / _SRU protocol CQL_
14.  Koha Z39.50 匯入 編目 / _Koha Z39.50 cataloging import_
15.  編目 政策 一致性 / _cataloging policy consistency_
16.  書目分級 完整級 核心級 簡略級 / _record level full core minimal_
17.  BIBFRAME transition from MARC / _BIBFRAME transition path_

* * *

如果你同意這版的方向，下一步我建議你回我一句：「**下一章**」我就接著做 **B. 分類（Classification）**，並且會把 **DDC/教學導向分類、台灣校園常見亂象、視覺化瀏覽架構、以及可落地的索書號與書架導引**整套輸出。

10:20 PM22:20



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)