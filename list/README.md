# list 数据文件清单

这个目录存放构建期刊主库所需的原始清单文件。`scripts/build_journals.py` 会读取这里的文件，合并生成 `data/journals.json`、`data/meta.json` 等前端数据。

## ABDC Journal Quality List

状态：已接入为可选数据源；当前使用官方 2025 版 Excel。

推荐放入的官方文件名：

- `ABDC-JQL-2025-v1-260326.xlsx`

也会自动识别这些常见命名：

- `ABDC Journal Quality List 2025.xlsx`
- `ABDC_Journal_Quality_List_2025.xlsx`
- `ABDC-JQL-2025.csv`
- `ABDC Journal Quality List 2025.csv`
- `ABDC-JQL-2022-v3-100523.xlsx`
- `ABDC Journal Quality List 2022.xlsx`
- `ABDC_Journal_Quality_List_2022.xlsx`
- `ABDC-JQL-2022.csv`
- `ABDC Journal Quality List 2022.csv`

来源说明：

- 数据源：ABDC Journal Quality List 2025。
- 评级字段：`A*`、`A`、`B`、`C`。
- 用途：经管类期刊质量等级展示，合并到国际期刊主表字段 `abdc`。
- 匹配优先级：`ISSN` > `ISSN Online / eISSN` > 期刊标题。

脚本期望字段：

- `Journal Title`
- `Publisher`
- `ISSN`
- `ISSN Online`
- `FoR`
- `2025 rating`

备注：

- 请优先使用 ABDC 官方发布文件，不建议从非官方镜像复制二手表。
- 若官方表头有轻微大小写或空格差异，脚本已做兼容。
- 文件放入后运行 `python3 scripts/build_journals.py`，前端会显示 `ABDC A* / A / B / C` 徽章。

## 已有主要文件

- `oaj_journals.xlsx` / `oaj_journals.csv` / `oaj_journals.json`：从 OAJ 官网 `https://www.oaj.com.cn/simplesearch?field=1` 提取的 773 种开放获取期刊列表。可用 `python3 scripts/fetch_oaj_journals.py` 重新抓取。
- `doaj_journals.csv`：DOAJ 官方公开 Journal CSV，来源 `https://doaj.org/csv`。用于标记 DOAJ 收录、许可证、APC、同行评议与 DOAJ 学科。
- `Science Citation Index Expanded (SCIE).csv`
- `Social Sciences Citation Index (SSCI).csv`
- `Arts & Humanities Citation Index (AHCI).csv`
- `Emerging Sources Citation Index (ESCI).csv`
- `JCR 2025.csv`
- `ESI全部期刊列表.xlsx`
- `2025中科院分区表完整版（附2023vs2025对比版）.xlsx`
- `中国科学院2025年期刊大类划分（仅供参考用）第二来源-长江大学.xlsx`
- `ShowJCR_JCR_2024.csv`
- `ShowJCR_中科院分区_2025.csv`
- `ShowJCR_中科院新锐版_2026.csv`
- `ShowJCR_CCF推荐_2026.csv`
- `ShowJCR_CCF-T_2025.csv`
- `ShowJCR_国际期刊预警_2025.csv`
- `CPXSourceList_102025.xlsx`
- `CSSCI(2025-2026)来源期刊目录.pdf`
- `CSSCI(2025-2026)扩展版来源期刊目录.pdf`
- `北大《中文核心期刊要目总览》（2023年版）.pdf`
- `浙江大学国内学术期刊分级目录指南·2024 版.pdf`
- `中国科协科学技术创新部高质量科技期刊分级目录总汇.pdf`
