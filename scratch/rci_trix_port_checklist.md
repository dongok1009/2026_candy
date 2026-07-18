<!-- RCI/TRIX 이식 작업 체크리스트 -->
# RCI/TRIX 이식 체크리스트

## 1단계 — 지표 계산
- [x] `lib/indicators.cjs`에 `realignTo` 헬퍼 추가 (중첩 EMA null 정렬)
- [x] `lib/indicators.cjs`에 `calculateRCI(closes, p)` 추가
- [x] `lib/indicators.cjs`에 `calculateTRIX(closes, p, signalPeriod)` 추가
- [x] exports에 두 함수 반영
- [x] `src/shared/utils/indicatorUtils.js`에 동일 함수 추가 (차트용)
- [x] 검증: RCI 값이 −100~+100 범위, 단조 상승 구간에서 +100 근접
- [x] 검증: TRIX 시그널선 길이가 trix 배열과 정렬됨
- [ ] 커밋

## 2단계 — 전략 + 엔진
- [ ] `strategies/Logic.v8.2.6.cjs` → `Logic.v8.2.7.cjs` 복사 (원본 수정 금지)
- [ ] v8.2.7의 `name`/`description` 갱신
- [ ] `indicators_logic`에 rci9/rci26/trix/trix_sig 계산 추가
- [ ] 룰별 가변 TRIX 시그널 기간 지원 (`trix_sig_{n}`)
- [ ] `signal_logic`에 RCI 교차 필터 추가 (기본 OFF)
- [ ] `signal_logic`에 TRIX 교차 필터 추가 (기본 OFF)
- [ ] **WHAT-IF·MA_SLOPE_ALIGN 코드 무변경 확인**
- [ ] `lib/engine.cjs` 지표 보장 블록에 rci9/rci26/trix/trix_sig 추가
- [ ] `lib/engine.cjs` tradeData에 12개 필드 추가 (m5/h1/d1 × rci9/rci26/trix/trix_sig)
- [ ] `lib/engine.cjs` CSV 헤더 + 행에 12개 컬럼 추가
- [ ] **검증(필수): 필터 OFF 시 v8.2.6과 ROI·승패·MDD 완전 일치**
- [ ] 검증: 필터 ON 시 거래 수 감소
- [ ] 커밋

## 3단계 — 설정 배선
- [ ] `lib/rules_helper.cjs`에 `USE_RCI_CROSS`/`USE_TRIX_CROSS`/`TRIX_SIGNAL_PERIOD` 파싱 추가
- [ ] 동일 키를 write-back(`syncRulesToEnv`) 및 legacy 정리 목록에 추가
- [ ] **기존 MA_SLOPE_ALIGN·WHAT_IF 파싱 무변경 확인**
- [ ] `src/shared/config/strategyConfigs.js`에 Logic.v8.2.7 등록 (신규 필드 기본 false/9)
- [ ] 검증: env 재현 파일로 `buildRulesFromEnv` 호출 시 신규 키가 false/9로 파싱됨
- [ ] 커밋

## 4단계 — UI
- [ ] `PriceChart.jsx`에 RCI 패널 추가 (RCI9/RCI26 라인, ±80 기준선)
- [ ] `PriceChart.jsx`에 TRIX 패널 추가 (TRIX/시그널 라인, 0 기준선)
- [ ] 차트 동기화(crosshair·시간축) 목록에 신규 차트 반영
- [ ] `BacktestForm.jsx` 룰 편집 영역에 RCI Cross 체크박스 추가
- [ ] `BacktestForm.jsx` 룰 편집 영역에 TRIX Cross 체크박스 + 시그널 기간 입력 추가
- [ ] `BacktestForm.jsx` 거래 로그 표에 12개 컬럼 추가
- [ ] 검증: `npm run build` 통과
- [ ] 검증: 대시보드에서 패널 렌더 및 값 표시 확인
- [ ] 커밋

## 5단계 — 마무리
- [ ] 컨텍스트 노트 최종 갱신
- [ ] `main` 병합 및 푸시
- [ ] 구 저장소(`candy_claude_2026`) 삭제 가능 여부 최종 확인
