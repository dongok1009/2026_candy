<!-- 트레일링 스탑 청산 옵션 추가 작업 체크리스트 -->
# 트레일링 스탑 추가 체크리스트

## 요구사항 요약
- TP 대신 **트레일링 스탑**을 선택할 수 있게 한다 (전역 청산 설정).
- 롱 기준. 1차 목표가(TP 트리거)에 도달하면 트레일링 활성화.
- 활성화 후 고가가 오를수록 청산선도 따라 오르고, **고가 대비 가격 X% 하락** 시 청산.
- 1차 목표가 도달 전에 하락하면 기존 SL로 청산.
- X%는 **가격 기준**(레버리지 미적용).

## 1단계 — 백테스트 엔진 (검증 가능)
- [x] `lib/engine.cjs` 청산 루프에 트레일링 상태(`trailActive`, `trailPeak`) 추가
- [x] 활성화 트리거 = 기존 tpPrice, 활성화 전 SL 유지
- [x] 활성화 후 peak 추적 + trailStop 계산 + `TRAIL` 청산
- [x] `TRAIL` 청산의 수수료(taker)·순ROI(시장가 차익) 계산 (else 분기 자동 처리)
- [x] SWITCHING/TIMEOUT 우선순위 유지 확인
- [x] **검증: OFF 시 기존과 완전 일치 (승29/패12/ROI -10.93/MDD 62.17)**
- [x] 검증: 상승 지속 시 TP(5%)보다 높은 이익 (예 ROE 11%)
- [x] 검증: 활성화 직후 반전 시 소폭 이익 (ROE ~2%)
- [x] 검증: 목표 미달 하락 시 SL, 청산가가 기대 SL가와 정확히 일치
- [x] 커밋 (25f0357)

## 2단계 — 설정 배선
- [x] `run_backtest.cjs`에 `--useTrailingStop` / `--trailStopPct` 파싱
- [x] `server.cjs` 백테스트 API가 req.body에서 두 값 전달
- [x] `bybit_trader.cjs` 전역 config 로딩에 두 값 반영
- [x] 커밋 (df0d522 + 4단계 커밋)

## 3단계 — 백테스트 UI
- [x] `BacktestForm.jsx` 청산 설정에 TP/트레일링 선택 + 트레일 % 입력
- [x] 요청 body에 두 값 포함 (기존 `{...config}`에 자연 포함)
- [x] 검증: 브라우저 실행 → 요청에 값 전달, 결과 TRAIL 16/SL 11/TIMEOUT 2
- [x] 커밋 (2579a72)

## 4단계 — 라이브 UI + 실전 봇
- [x] `SignalSettings.jsx`(라이브)에 동일 선택·입력 추가 (rules.global)
- [x] 체크 시 trailStopPct 기본값(0.01) 심기 — 봇에서 조용히 비활성 방지
- [x] `bybit_trader.cjs` 진입 시 Bybit 트레일링 매핑 (activePrice/trailingStop/stopLoss)
- [x] 진입 후 중복 TP/SL 재설정 블록도 트레일링 분기 처리 (takeProfit 하드코딩 버그 수정)
- [x] 텔레그램 알림 문구 트레일링 모드 대응
- [x] 검증: 라이브 체크박스 렌더·저장, 껐다 켜기로 기본값 심기 OK
- [x] **거래소 실주문 검증은 사용자 몫 (에이전트 실행 금지) — 미검증**
- [ ] 커밋

## 5단계 — 마무리
- [x] 컨텍스트 노트 최종 갱신
- [x] 전체 빌드 통과 확인
