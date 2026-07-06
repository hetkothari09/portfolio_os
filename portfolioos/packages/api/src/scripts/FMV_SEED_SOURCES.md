# FMV-as-on-31-Jan-2018 Seed Data — Provenance

Accessed / compiled: **2026-07-06**.

Both seed files are used by the LTCG grandfathering engine (Section 55(2)(ac)/112A) to floor
the cost of acquisition at the FMV on 31-Jan-2018 (capped at sale proceeds) for equity
shares/units acquired before 1-Feb-2018.

## Methodology

- **Listed equity shares**: FMV = the **highest price** quoted on a recognized stock exchange
  on 31-Jan-2018 (a normal trading Wednesday — no holiday fallback needed). This is the day's
  **HIGH**, never the closing price.
- **Mutual fund units**: FMV = the fund's **NAV as on 31-Jan-2018**.
- All new rows below are sourced from primary, official, machine-downloaded data — not from
  scraped third-party tables — wherever a primary source was reachable.

---

## Part 1 — Stocks (`fmv_31jan2018_seed.json`)

**Row counts:** 200 (pre-existing) → **1,717 total** (1,517 new rows added; the original 200 were
later corrected in place from CLOSE to HIGH — see below).

### Primary source used
- **NSE official bhavcopy archive**, downloaded directly:
  `https://archives.nseindia.com/content/historical/EQUITIES/2018/JAN/cm31JAN2018bhav.csv.zip`
  — the exchange's own end-of-day file for 31-Jan-2018, containing `SYMBOL, SERIES, OPEN, HIGH,
  LOW, CLOSE, ..., ISIN` for every traded instrument that day.
- Included series: `EQ` (1,370 rows), `BE` (253, trade-to-trade equity), `BZ` (16, equity under
  surveillance), `SM` (78, SME-platform equity) — all are listed equity shares eligible for
  Section 112A grandfathering. Excluded series: government/sovereign bonds (`GB`), depository
  receipts (`DR`), InvIT units (`IV`), NCD/FMP-type instruments (`MF`, `N*` etc.) — not "equity
  shares."
- For each included row, `HIGH` and `ISIN` were taken **directly** from this file — no
  transcription or OCR step, no name-matching required (ISIN is a native column).
- All 200 pre-existing ISINs were found present in this same NSE file (confirms they are valid,
  actively-traded 31-Jan-2018 instruments) and were **left untouched** per instructions.
- 1,517 new ISINs not already in the seed were added, `fmvPerUnit` = NSE `HIGH`, formatted to 2
  decimal places.

### Cross-validation performed
- **Independent second source**: BSE official bhavcopy, also downloaded directly:
  `https://www.bseindia.com/download/BhavCopy/Equity/EQ310118_CSV.ZIP` (no ISIN column in this
  legacy format, so matched to the NSE rows by normalized company-name).
- 657 of the 1,517 new rows matched a BSE row by name. Result: **median difference 0.28%, mean
  0.76%** between NSE-HIGH and BSE-HIGH — consistent with the two exchanges having independent
  order books for the same stock (expected, not an error signal).
- 10 of 657 (1.5%) showed >5% divergence — all thinly-traded small-caps (e.g. BILENERGY,
  MCDHOLDING, VISESHINFO) where cross-exchange liquidity fragmentation genuinely produces wider
  price gaps; both figures are independently sourced and legitimate, this is not treated as an
  error. One case (`PANACHE`, ISIN `INE895W01019`, 69% "difference") is almost certainly a
  name-collision artifact of the fuzzy matching script picking the wrong BSE row — it does **not**
  affect the actual seed value, which was taken directly from the NSE file keyed by ISIN, not by
  name-matching.
- This exceeds the requested 30–50 ISIN cross-check sample by more than an order of magnitude.

### ⚠️ Correction applied to the existing 200 rows (2026-07-06, user-approved follow-up)
Spot-checking 12 of the pre-existing 200 entries (RELIANCE, TCS, HDFCBANK, INFY, ITC, SBIN,
BAJAJ-AUTO, BAJFINANCE, MARUTI, ASIANPAINT, WIPRO, HINDUNILVR) against the same NSE bhavcopy
row-for-row showed that **every single one matched the day's CLOSING price column, not the HIGH
column** (e.g. RELIANCE stored `961.30` = NSE `CLOSE`; NSE `HIGH` that day was `964.50`). A full
re-check of all 200 (not just the 12-row sample) confirmed the same pattern 200/200 — the
original seed's source used closing price instead of the statutory day's-high, understating the
grandfathered cost basis (and so overstating tax) for every one of these 200 blue-chip ISINs.

This was flagged to the user, who approved a same-commit fix. All 200 values were re-derived from
the identical NSE bhavcopy file used for the other 1,517 rows in this seed (`HIGH` column, keyed
by ISIN, 2-decimal formatting) — same primary source, same methodology, no mixed provenance. No
row was estimated; every one of the 200 was matched by ISIN in the official file. Post-fix, all
1,717 rows in this file are HIGH-derived and internally consistent.

---

## Part 2 — Mutual Fund equity scheme units (`fmv_mf_31jan2018_seed.json`, new file)

**Row count:** 660 unique ISINs, all equity-oriented growth-plan schemes.

### Primary source used
- **AMFI's own official historical NAV portal**, downloaded directly:
  `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=31-Jan-2018&todt=31-Jan-2018`
  — AMFI (Association of Mutual Funds in India) is the industry body of record for scheme NAVs;
  this endpoint returns every scheme's official NAV for the requested date, semicolon-delimited,
  including each scheme's growth-plan ISIN.
- Filtered to 15 SEBI equity-style categories only (Multi/Large/Large&Mid/Mid/Small Cap,
  Dividend Yield, Value, Contra, Focused, Sectoral/Thematic, Flexi Cap, ELSS ×2 legacy+current
  category labels, equity Index Funds, equity ETFs ["Other ETFs"]). Debt, liquid, gilt, hybrid,
  arbitrage and FoF categories were deliberately excluded — out of scope per task guidance since
  they don't get equity-style Section 112A grandfathering treatment in this app.
  - Category breakdown: Sectoral/Thematic 159, ELSS (new label) 75, ELSS (legacy label) 66,
    Large Cap 63, Large & Mid Cap 47, Mid Cap 47, Flexi Cap 42, Index Funds 38, Focused 35,
    Small Cap 32, Value 26, Multi Cap 22, Contra 6, Other ETFs 2.
  - Only "Growth" plan rows kept (Dividend/IDCW variants excluded); both Direct and Regular
    growth plans included, since both are legitimately held by real investors.
- Note: AMFI's historical download retroactively labels old NAV rows with each scheme's
  **current** name (e.g. the 2018 NAV for what was then "SBI Blue Chip Fund" appears under
  today's name "SBI Large Cap FUND-REGULAR PLAN GROWTH"). `scripName` reflects this AMFI-supplied
  name as-is.

### Sources that did NOT work / were rejected
- **scripbox.com/mutual-fund/isin-fair-market-values** (the source suggested in the task): a
  JS-rendered SPA, successfully loaded and scraped via Playwright (1,275 rows extracted). However,
  cross-checking it against the AMFI data revealed **456 of 509 ISIN-matched rows differed by
  >0.5%**, with several well-known large-cap schemes off by 2–9% (e.g. Franklin India Technology
  Fund: AMFI `143.8213` vs scripbox `131.21`, an 8.8% gap). This is too large and too
  inconsistent to be rounding/formatting noise.
- To determine which source was wrong, both were triangulated against a **third, independent**
  source: **mfapi.in** (a well-known third-party mirror of AMFI's own historical NAV archive,
  queried live via `https://api.mfapi.in/mf/{schemeCode}`). For SBI Large Cap Fund – Regular
  Plan – Growth (ISIN `INF200K01180`), AMFI-direct and mfapi.in **both** independently show
  `39.2322` on 31-Jan-2018 — scripbox showed a different, lower figure for the equivalent
  comparison set generally. **Conclusion: scripbox's page is unreliable for this exact date and
  was discarded entirely, not used for either the seed data or the validation.**
- `chartered.tax` — DNS resolution failed (domain unreachable from this environment).
- `finlib.in` — HTTP 403 even via the fetch tool; not pursued further via headless browser since
  the official NSE/AMFI archives already gave complete, superior-quality primary-source coverage.
- CCH PDF and Scribd document sources were not needed, for the same reason.

### Cross-validation actually used (in place of scripbox)
- Random sample of **60 scheme codes** queried against **mfapi.in** (independent third-party
  mirror of the official AMFI archive) for their 31-Jan-2018 NAV.
- **Result: 59/60 exact matches.** The one non-match (`ICICI Prudential R.I.G.H.T. Fund Growth`,
  scheme code 112100) was not a data error — mfapi.in simply has no historical coverage for that
  scheme prior to Sept-2019 (a closed-ended ELSS fund); the AMFI-direct figure (`43.7100`) is
  still the authoritative primary-source value and was kept.
- This exceeds the requested 30–50 ISIN cross-check sample.

---

## Summary

| File | Rows before | Rows added | Rows after | Duplicate ISINs |
|---|---|---|---|---|
| `fmv_31jan2018_seed.json` | 200 | 1,517 | **1,717** | 0 |
| `fmv_mf_31jan2018_seed.json` (new) | 0 | 660 | **660** | 0 |

Both files are valid JSON arrays of `{isin, scripName, fmvPerUnit}` objects, sorted by ISIN,
with `fmvPerUnit` as a plain decimal string (no currency symbols or commas). No number in either
file was fabricated, estimated, or interpolated — every row traces to an official exchange
(NSE/BSE) or regulatory-body (AMFI) source file, downloaded directly and re-verified above.
