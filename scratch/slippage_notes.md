<!-- 슬리피지 반영 작업의 결정과 근거 -->
# 슬리피지 반영 컨텍스트 노트

## 왜 슬리피지만 추가하는가
엔진을 정독한 결과, 실전 대비 백테스트에서 빠진 기계적 비용은 **시장가 청산 슬리피지 하나뿐**이다.
- 펀딩비: engine.cjs:563-568에 이미 구현(FUNDING_FEE_RATE 0.0001/8h, 통과 경계 횟수 차감).
- 수수료: TP/TIMEOUT=maker, SL/TRAIL/SWITCHING=taker로 이미 구분(engine.cjs:544).
- 슬리피지: SL은 SL_ROI 정확값, TRAIL/SWITCHING은 exitPrice(트리거) 정확값으로 정산 → 손실 슬리피지 0.

## 적용 규칙
- **taker 청산에만** 부과: SL, TRAIL, SWITCHING. TP·TIMEOUT은 maker(지정가)라 제외.
  판별식은 기존 수수료 분기와 동일: `!(exitReason==='TP' || exitReason==='TIMEOUT')`.
- ROI 차감 방식: `(feeRate + exitSlippage) * LEVERAGE`. 슬리피지 s(가격 분수)는
  불리한 방향 체결이므로 레버리지 배로 순ROI를 깎는다. 수수료와 동일한 환산이라 일관적.
  - SL(롱): 트리거보다 더 낮게 매도 → 추가 손실 s×lev.
  - TRAIL/SWITCHING: priceDiff 이득이 s만큼 감소 → s×lev 차감. 롱·숏 대칭.
- 로그의 exitPrice는 트리거 가격 그대로 둔다(진단용). 실현 ROI에만 슬리피지 반영.
  → CSV의 exitPrice와 roe 사이 미세 불일치는 의도된 것. 문서화로 갈음.

## 기본값
- `EXIT_SLIPPAGE_RATE = 0.0005`(0.05%). Bybit BTCUSDT는 유동성이 커 평상시 슬리피지는 작지만,
  급변동 시 스탑 체결이 크게 밀리는 것을 평균적으로 보수 반영. 스프레드도 여기에 합산 근사.
  UI에서 조절 가능하게 노출해 사용자가 실측 체결과 맞추도록 한다.
- 엔진은 미지정 시 0으로 처리 → 기존 전략/백테스트 회귀 보존.

## 검증
- OFF(미지정)=기존 결과 완전 일치.
- ON(0.0005)=SL/TRAIL 청산 건에서만 소폭 손실 확대. TP-only 구간은 거의 불변.
