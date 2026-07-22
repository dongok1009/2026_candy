<!-- 시장가 청산 슬리피지를 백테스트 엔진에 반영하는 작업 체크리스트 -->
# 시장가 청산 슬리피지 반영 체크리스트

목표: 백테스트를 실전에 근접시키기 위해 SL·TRAIL·SWITCHING(시장가/taker) 청산에
손실 방향 슬리피지를 부과한다. TP·TIMEOUT(지정가/maker)은 제외. 펀딩비·수수료는 이미 반영됨.

## Phase 1 — 엔진 코어
- [x] lib/engine.cjs: 청산 정산부에 `EXIT_SLIPPAGE_RATE` 적용 (taker 청산만) → 검증: 값 미지정 시 exitSlippage=0으로 기존과 동일(회귀 by construction)
- [x] strategies/Logic.v8.2.5.cjs: `EXIT_SLIPPAGE_RATE: 0.0005` 기본값 추가
- [x] verify 스크립트로 슬리피지 OFF/ON 대조 → 상반기 1690→1477→1289%(0/0.05/0.10%), 승패 불변(220건) 확인

## Phase 2 — 플러밍 (UI에서 조절)
- [x] run_backtest.cjs: `--exitSlippageRate` CLI 파라미터 매핑 → 끝단 검증: ROI −11.04%→−35.79%(0/0.5%), 거래 불변
- [x] server.cjs: req.body에서 추출 후 CLI 인자 구성
- [x] BacktestForm.jsx: config 기본값 + 입력 필드(penetrationRate 옆) → 브라우저 렌더 확인(value 0.0005)

## 범위 밖(문서화만)
- 60초 신호 지연, 진입 시장가 슬리피지 → 별도 작업(더 침습적)
- 스프레드는 슬리피지에 합산해 단일 파라미터로 근사
