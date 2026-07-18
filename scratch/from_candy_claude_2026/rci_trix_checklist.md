<!-- RCI/TRIX 작업 체크리스트 -->
# RCI / TRIX 체크리스트

## Phase 1 — 계산 + 차트 + 로깅
- [ ] 1. lib/indicators.cjs: calculateRCI, calculateTRIX 추가 + export ➔ node -e 로드/스모크 테스트
- [ ] 2. src/shared/utils/indicatorUtils.js: 동일 2함수 추가 + export
- [ ] 3. lib/engine.cjs: 지표 보장 블록 계산 + tradeData + 시그널행 + 헤더 2곳 + 행배열
- [ ] 4. PriceChart.jsx: RCI/TRIX 서브차트 2개 (refs, chart, series, legend, 5경로, JSX)
- [ ] 5. TradeLogTable.jsx + exportUtils.js: 컬럼 추가
- [ ] P1검증: npm run build 통과 + 백테스트 CSV 신규컬럼 + 차트 6패널 스크린샷

## Phase 2 — 진입 필터
- [ ] 6. strategies/CC.v0.2.0.cjs 신설 (RCI/TRIX Cross 필터 + indicators_logic)
- [ ] 7. lib/rules_helper.cjs: .env 파싱
- [ ] 8. .env 기본값 추가
- [ ] 9. RulesEditor.jsx: 체크박스 + TRIX 시그널 기간 입력
- [ ] 10. rulesNormalizer.js passthrough
- [ ] 11. strategyConfigs.js CC.v0.2.0 등록
- [ ] 12. engine ↔ signal_logic trixSignalPeriod 연동 확인
- [ ] P2검증: 필터 OFF 동등성 + 필터 ON 거래수 변화

## Phase 3 — 버전/문서
- [ ] 13. CC.v1.2.0 버전/문서 갱신
- [ ] 14. 최종 검증 + 커밋
