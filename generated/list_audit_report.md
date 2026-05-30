# list 目录与 WoS 匹配审计（2026-05-21）

口径：以 `data/journals.json` 中含 SCIE/SSCI/AHCI/ESCI 的记录作为 WoS Core 基线；按 ISSN/eISSN 优先、标题规范化兜底匹配。`not_in_current` 表示未匹配 WoS 且当前主库也找不到，可能需要新增为独立条目，但需再按“是否期刊/是否 active/是否应纳入产品范围”人工过滤。

## build_journals.py 当前合并结果

- WoS Core：SCIE 9,433；SSCI 2,831；AHCI 1,358；ESCI 9,309；JCR 合并后主库 23,185。
- JCR/ESI/CAS：ESI matched 12,272；CAS matched 21,697，unmatched 75；ShowJCR IF matched 22,249；FQB matched 21,733；XR matched 22,281。
- Scopus：matched 21,135；standalone active 新增 9,480；inactive matched 710。
- EI Compendex：matched 4,730；standalone 新增 139；中文题名 merged 365。
- ABDC：matched 2,651；未新增 standalone。
- ABS/AJG：matched 1,822；standalone 新增 303。
- 当前主库总量：33,653；有 IF 21,525；Scopus 29,817；EI 4,503；ABDC 2,651；ABS 1,822。

## 逐源审计快照

| 源文件 | 总条目 | 未匹配 WoS | 当前主库也无 | 备注 |
|---|---:|---:|---:|---|
| JCR 2025.csv | 22,399 | 0 | 0 | 已完全并入 |
| ShowJCR_JCR_2024.csv | 22,247 | 0 | 0 | 已完全并入 |
| ShowJCR_中科院分区_2025.csv | 21,772 | 39 | 31 | 多为 CAS 表额外题名，需人工核实 |
| ShowJCR_中科院新锐版_2026 / CASXR_2026 | 22,299 | 18 | 7 | 7 条应考虑补为独立/新刊 |
| ShowJCR_国际期刊预警_2025.csv | 5 | 1 | 1 | `SCALABLE COMPUTING-PRACTICE AND EXPERIENCE` 需单独核对 |
| ShowJCR_CCF推荐_2026.csv | 675 | 396 | 392 | 大量为会议，不宜全部新增为“期刊” |
| ShowJCR_CCF-T_2025.csv | 15 | 3 | 1 | `Journal of Automatica Sinica` 需核对 |
| ESI全部期刊列表.xlsx | 12,275 | 45 | 40 | 部分标题列未解析，仅 ISSN 命中；需复核 |
| 2025中科院分区表完整版 | 21,771 | 75 | 66 | 与 build 输出一致 |
| 长江大学第二来源 | 21,971 | 171 | 141 | 第二来源额外条目较多 |
| Scopus ext_list_Mar_2026.xlsx | 48,356 | 27,113 | 17,406 | 不能全加；build 已只新增 active standalone 9,480 |
| CPXSourceList_102025.xlsx | — | — | — | 简易审计未解析，build 已新增 EI standalone 139 |
| ABDC-JQL-2025 | — | — | — | 简易审计未解析，build 已匹配 2,651，无 standalone |
| ABS AJG 2024 | — | — | — | 简易审计未解析，build 已新增 standalone 303 |
| CSSCI/北大 OCR JSON | 少量异常 | 全未匹配 | 全未匹配 | OCR 结果质量明显异常，不能直接作为新增依据 |
| CNKX records | 7,754 | 1,780 | 1,135 | 国内/中文条目多，需按国内 tab 逻辑处理 |
| ZJU tiers | 1,863 | 1,533 | 962 | 国内/高校目录条目多，不能并入国际主库 |

## 当前结论

1. **无需新增**：JCR 2025、ShowJCR JCR 2024 两个核心 IF/JCR 源已与 WoS 完全对齐。
2. **已通过 build 自动新增**：Scopus active standalone、EI standalone、ABS standalone 已被纳入当前主库。
3. **需要人工过滤后再新增**：CAS/FQB/XR/ESI/长江大学第二来源中少量未匹配条目；优先核对新刊、改名刊、ISSN 缺失刊。
4. **不应批量新增**：CCF 推荐源包含大量会议，不应作为期刊主库独立条目批量加入。
5. **暂不可靠**：CSSCI/北大 OCR JSON 当前存在明显 OCR 噪声（如乱码、页眉），不能作为新增依据；应先重做/清洗 OCR。
