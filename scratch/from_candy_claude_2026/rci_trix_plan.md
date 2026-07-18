<!-- RCI/TRIX 지표 추가 작업 계획 (2026-07-18) -->
# RCI / TRIX 지표 추가 — 계획

## 목표
차트에 RCI(이중 9/26), TRIX(14 + 시그널 9) 지표 패널을 추가하고, 백테스트 CSV 로그에 값 기록, 그리고 진입 필터 조건으로도 사용 가능하게 한다.

## 확정된 사양 (사용자 결정)
- **범위**: 표시 + CSV 로그 + 진입 필터 (전체)
- **RCI**: 이중 라인 9 / 26. 필터 = 교차 (롱: RCI9 > RCI26, 숏: RCI9 < RCI26). 기간 고정.
- **TRIX**: 기간 14 + 시그널 9. 시그널 기간은 백테스트에서 가변(룰별 입력). 필터 = 시그널선 교차 (롱: TRIX > Signal, 숏: TRIX < Signal).

## 계산식
- **RCI(p)**: 스피어만 순위상관. 최근봉 timeRank=1..오래된봉 p, 가격 높은순 priceRank=1..(동점 평균). RCI = (1 − 6·Σd² / (p³−p)) · 100, d = timeRank − priceRank. 범위 −100~+100.
- **TRIX(p, sp)**: EMA 3중(각 p) → e3. TRIX = (e3[i]−e3[i−1])/e3[i−1]·100. Signal = EMA(TRIX, sp). 중첩 EMA는 기존 MACD와 동일하게 null 필터 후 재정렬.

## 3단계 진행
### Phase 1 — 계산 + 차트표시 + CSV 로깅 (필터 제외)
1. lib/indicators.cjs: calculateRCI, calculateTRIX 추가/export
2. src/shared/utils/indicatorUtils.js: 동일 2함수 추가/export
3. lib/engine.cjs: m5/h1/d1 지표 보장 블록에 rci9/rci26/trix/trixSig 계산, tradeData + 시그널행 + CSV 헤더 2곳 + 행 배열에 컬럼 추가
4. PriceChart.jsx: RCI 서브차트(9/26 2선) + TRIX 서브차트(TRIX/Signal 2선) 추가 — 5개 계산경로 + JSX
5. TradeLogTable.jsx + exportUtils.js: 표/CSV 내보내기 컬럼 추가
→ 검증: npm run build 통과, 백테스트 실행 후 CSV에 신규 컬럼 값 존재, 차트 4→6 패널 렌더

### Phase 2 — 진입 필터 배선
6. strategies/CC.v0.2.0.cjs 신설: signal_logic에 RCI Cross(10), TRIX Cross(11) 필터 블록 + indicators_logic에 rci9/rci26/trix/trixSignal 계산
7. lib/rules_helper.cjs: .env 키 파싱 ([TF]_[SIDE]_USE_RCI_CROSS, _USE_TRIX_CROSS, _TRIX_SIGNAL_PERIOD) → rciCrossEnabled/trixCrossEnabled/trixSignalPeriod
8. .env: 신규 키 기본값(false, 9) 추가
9. RulesEditor.jsx: RCI Cross / TRIX Cross 체크박스 + TRIX 시그널 기간 입력
10. rulesNormalizer.js: 신규 필드 passthrough
11. strategyConfigs.js: CC.v0.2.0 레지스트리 항목(기본 OFF) 등록
12. engine: signal_logic가 trixSignalPeriod를 rules에서 받도록 확인/연동
→ 검증: 필터 OFF 시 기존과 결과 동일, RCI/TRIX 필터 ON 시 거래수 변화 확인

### Phase 3 — 버전/문서/최종검증
13. 버전 CC.v1.2.0: package.json, UI 뱃지 4곳, CLAUDE.md, CHANGELOG.md, BACKTEST_HISTORY.md
14. 최종 build + 백테스트 + 차트 스크린샷 검증 후 커밋

## 열 이름 규칙 (CSV)
M5_RCI9, M5_RCI26, M5_TRIX, M5_TRIX_SIG / H1_*, D1_* (기존 M5_MA_Slope 계열 뒤에 append)
