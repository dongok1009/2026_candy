# BTCUSDT Trading Strategy - Backtest Result Log

이 문서는 **v3.0.0**부터 최신 **v7.0.5**까지의 모든 백테스트 결과와 각 버전별 상세 지표 조건을 기술합니다. 나중 재검증을 위해 모든 수치와 조건을 생략 없이 기록합니다.

---

## 📅 1. 테스트 히스토리 종합 요약 (Comprehensive Summary)
*기준 기간: 2025.01.01 ~ 2026.03.31 (약 15개월)*

| 버전 | 특징 | TP / SL | 승률 | 최종 수익률 | 상태 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v8.2.0-Patch** | **Signal Bot 30초 오프셋 지연 패치 (API Rate Limit 충돌 방지)** | - | - | **배포 완료** | **인프라 패치 완료** |
| **v8.2.0** | **RSI AND 필터 조건 UI/엔진 연동 & 진입 시점 지표 보장** | 가변(UI) | - | **배포 완료** | **최신 로직 (v8.2.0)** |
| **v7.0.6** | **12시간봉(12h) 추세 필터 강화 모델** | 3% / 15% | - | **검증 대기** | **최신 로직** |
| **v7.0.5** | **Oracle Cloud 무중단 배포 & 실전 매매 엔진** | 3% / 15% | - | **가동 중** | **최신 실전 가동** |
| **v7.0.4** | **UI 연동 익절/손절 가변 설정 모델** | 가변(UI) | - | **검증 완료** | 로직 최적화 |
| **v7.0.1** | **확정봉(T-1) 시그널 & T+1 진입 원칙** | 3% / 15% | - | **대기 중** | 로직 확정 |
| **v7.0.0** | **ADX 에너지 필터 (1h & 5m ADX >= 30)** | 3% / 15% | - | **+17.7%** | 테스트 완료 |
| **v6.0.2** | **리트레이스 최적화 (1.5% Retrace)** | 3% / 15% | 91.9% | **+134.3%** | 실전 후보 |
| **v6.0.0** | **고빈도 최적화 (1d StochRSI OFF)** | 3% / 15% | 87.5% | **🚀 +2910.3%** | **🏆 통합 챔피언** |

---

## 📘 2. 버전별 상세 지표 조건 및 실행 결과 (Detailed Version Logs)

 모든 신호는 **확정봉(Wait-on-Close)** 기준으로 판정합니다.

### **[v8.2.0-Patch] 깃버전 알림 봇 30초 오프셋 지연 패치 (API Rate Limit 방지)**
- **주요 변경 사항**:
    - **30초 지연 오프셋 도입**: `src/v600_live_bot.cjs` 내 실행 지연 주기를 정각 대비 `+30초`로 딜레이 패치.
    - **Rate Limit 충돌 방지**: 매 00초에 가동되는 실전 매매 봇(`bybit_trader.cjs`)과 30초 오프셋을 두고 가동하여 동일 IP 환경에서 Bybit API 호출 충돌 및 차단 문제 원천 제거(0%).
    - **전략 동적 로드**: 알림 봇에서도 `.env` 설정에 따른 `STRATEGY_VERSION` (예: `Logic.v8.2.0.cjs`)을 동적으로 임포트하도록 리팩토링.
    - **원격 저장소 반영**: 최신 패치를 `origin/main` 원격 리포지토리에 푸시하여 오라클 서버에서 pm2 멀티 봇(`bybit-live` & `signal-bot`) 동시 가동 환경 보장.
- **상태**: 2026-06-01 오라클 서버 가용성 이중화 배포 완료.

### **[v8.2.0] RSI AND 필터 조건 UI/엔진 연동 및 지표 정합성 고도화 (v8.2.0)**
- **주요 변경 사항**:
    - **Logic.v8.2.0.cjs 생성**: 5m, 1h, 1d 타임프레임별 `useRSI` 활성화 여부 및 `5 < RSI < 95` AND 조건 필터 구현.
    - **UI-엔진 양방향 바인딩**: `SignalSettings`, `BacktestForm` 내 RSI 입력 필드 가로/세로 10% 미세 확장 스타일링 적용 및 Flex 자동 정렬 완료.
    - **진입 시점 데이터 정합성 보장**: 백테스트 CSV 출력(`engine.cjs`) 및 UI 엑셀 다운로드 시 진입 시점 기준의 정확한 RSI 값(`m5_rsi`, `h1_rsi`, `d1_rsi`) 표기 완료.
    - **오라클 .env 연동**: `rules_helper.cjs`를 통해 RSI 룰 양방향 싱크 및 `.env.example` 최신화 완료.
- **상태**: 2026-06-01 빌드 테스트 및 배포 완료.

### **[v7.0.5] 실전 클라우드 배포 모델 (Cloud & Live Engine)**
- **주요 변경 사항**:
    - **Oracle Cloud VPS** (Ubuntu 24.04) 환경 배포 및 PM2 무중단 운영 체계 구축.
    - `bybit_trader.cjs`를 통한 **Bybit 선물 실전 매매 API** 연동 완료.
    - 환경 변수(`.env`)를 통한 주문 금액 및 레버리지 실시간 제어 기능.
    - 포지션 상태 영속성 관리 (`bybit_live_state.json`)로 서버 재부팅 시 대응.
- **상태**: 2026-05-04부터 오라클 클라우드에서 24/7 실전 가동 중.

### **[v7.0.4] UI 가변 설정 대응 모델 (Configurable ROI/SL)**
- **주요 변경 사항**:
    - **가변 TP/SL**: 대시보드 UI에서 설정한 익절(ROI) 및 손절(SL) 값을 로직에 동적으로 반영.
    - **헤더 슬림화**: 백테스트 결과 파일 가독성을 위해 M5 MACD 항목 등 불필요한 데이터 제거.
    - **M5 지표 조정**: 5분봉에서 StochRSI 및 ADX 중심의 추세 추종 성능 강화.
- **상태**: 로직 검증 및 UI 통합 완료.

### **[v7.0.1] 확정봉 기반 안정성 강화 모델 (Stability)**
- **핵심 원칙**: `T-1` 확정봉 데이터 기준 지표 계산 및 `T+1` 분봉 진입 시점 준수.
- **상태**: 실전 전환 전 최종 로직 안정화 단계.

### 📊 Official Record: Record.7.0.5.1
- ROI: 329.22% | 87W/10L
- Params: BTCUSDT 5x | 1000 -> 4292.181377191123
---

### 📊 Official Record: Record.7.0.5.2
- ROI: 900.63% | 429W/92L
- Params: BTCUSDT 5x | 1000 -> 10006.273235473616
---

### 📊 Official Record: Record.7.0.5.3
- ROI: 142.43% | 530W/105L
- Params: BTCUSDT 5x | 1000 -> 2424.3434948329427
---

### 📊 Official Record: Record.7.0.4.5
- ROI: 878.68% | 175W/21L
- Params: BTCUSDT 5x | 1000 -> 9786.770966327958
---

### 📊 Official Record: Record.7.0.4.6
- ROI: 393.92% | 94W/11L
- Params: BTCUSDT 5x | 1000 -> 4939.231724444618
---

### 📊 Official Record: Record.7.0.4.7
- ROI: 389.21% | 96W/17L
- Params: BTCUSDT 5x | 1000 -> 4892.075627075557
---

### 📊 Official Record: Record.7.0.4.5
- ROI: 1082.92% | 383W/90L
- Params: BTCUSDT 5x | 1000 -> 11829.236504926772
---

### 📊 Official Record: Record.7.0.4.6
- ROI: 1596.61% | 383W/76L
- Params: BTCUSDT 5x | 1000 -> 16966.1282118397
---

### 📊 Official Record: Record.7.0.4.7
- ROI: 77.58% | 85W/16L
- Params: BTCUSDT 5x | 1000 -> 1775.8295590265784
---

### 📊 Official Record: Record.7.0.4.1
- ROI: 2373.25% | 510W/99L
- Params: BTCUSDT 5x | 1000 -> 24732.54853313242
---

### 📊 Official Record: Record.7.0.4.2
- ROI: 1082.92% | 383W/90L
- Params: BTCUSDT 5x | 1000 -> 11829.236504926772
---

### 📊 Official Record: Record.7.0.4.3
- ROI: 863.94% | 186W/30L
- Params: BTCUSDT 5x | 1000 -> 9639.417981989982
---

### 📊 Official Record: Record.7.0.4.4
- ROI: 173.27% | 131W/27L
- Params: BTCUSDT 5x | 1000 -> 2732.719240078968
---

### 📊 Official Record: Record.7.0.4.5
- ROI: 21.65% | 24W/6L
- Params: BTCUSDT 5x | 1000 -> 1216.5348030950008
---

### 📊 Official Record: Record.7.0.4.6
- ROI: 32.01% | 25W/8L
- Params: BTCUSDT 5x | 1000 -> 1320.142671248577
---

### 📊 Official Record: Record.7.0.4.7
- ROI: 1679.58% | 195W/35L
- Params: BTCUSDT 5x | 1000 -> 17795.769955728178
---

### 📊 Official Record: Record.7.0.4.8
- ROI: 1279.48% | 199W/40L
- Params: BTCUSDT 5x | 1000 -> 13794.797114440738
---

### 📊 Official Record: Record.7.0.4.9
- ROI: 499.17% | 377W/109L
- Params: BTCUSDT 5x | 1000 -> 5991.667711221474
---

### 📊 Official Record: Record.7.0.4.10
- ROI: 1068.76% | 199W/31L
- Params: BTCUSDT 5x | 1000 -> 11687.632434295983
---

### 📊 Official Record: Record.7.0.4.11
- ROI: 1011.01% | 204W/32L
- Params: BTCUSDT 5x | 1000 -> 11110.088667601773
---

### 📊 Official Record: Record.7.0.4.12
- ROI: 1240.00% | 199W/34L
- Params: BTCUSDT 5x | 1000 -> 13399.95743463103
---

### 📊 Official Record: Record.7.0.4.13
- ROI: 370.81% | 394W/108L
- Params: BTCUSDT 5x | 1000 -> 4708.119362164552
---

### 📊 Official Record: Record.7.0.4.14
- ROI: 2.98% | 24W/7L
- Params: BTCUSDT 5x | 1000 -> 1029.7967108199182
---

### 📊 Official Record: Record.7.0.4.15
- ROI: 4.24% | 24W/8L
- Params: BTCUSDT 5x | 1000 -> 1042.3560382801347
---

### 📊 Official Record: Record.7.0.4.16
- ROI: 1034.31% | 199W/35L
- Params: BTCUSDT 5x | 1000 -> 11343.063968415167
---

### 📊 Official Record: Record.7.0.4.17
- ROI: 1649.90% | 168W/40L
- Params: BTCUSDT 5x | 1000 -> 17498.987836964152
---

### 📊 Official Record: Record.7.0.4.18
- ROI: 1634.37% | 166W/39L
- Params: BTCUSDT 5x | 1000 -> 17343.739136152955
---

### 📊 Official Record: Record.7.0.4.19
- ROI: 857.93% | 322W/106L
- Params: BTCUSDT 5x | 1000 -> 9579.311404141974
---

### 📊 Official Record: Record.7.0.4.20
- ROI: 2941.32% | 419W/119L
- Params: BTCUSDT 5x | 1000 -> 30413.18618367197
---

### 📊 Official Record: Record.7.0.4.21
- ROI: 861.44% | 330W/129L
- Params: BTCUSDT 5x | 1000 -> 9614.444289744471
---

### 📊 Official Record: Record.7.0.4.22
- ROI: -47.07% | 440W/142L
- Params: BTCUSDT 5x | 1000 -> 529.329555554669
---

### 📊 Official Record: Record.7.0.4.19
- ROI: 247.81% | 536W/116L
- Params: BTCUSDT 5x | 1000 -> 3478.1361986171987
---

### 📊 Official Record: Record.7.0.4.20
- ROI: 182.67% | 538W/107L
- Params: BTCUSDT 5x | 1000 -> 2826.6596679388103
---

### 📊 Official Record: Record.7.0.4.21
- ROI: 1179.55% | 419W/124L
- Params: BTCUSDT 5x | 1000 -> 12795.46182998753
---

### 📊 Official Record: Record.7.0.4.22
- ROI: 889.36% | MDD: 31.91% | 199W/32L
- Params: BTCUSDT 5x | 1000 -> 9893.58085563155
---

### 📊 Official Record: Record.7.0.4.23
- ROI: 3415.93% | MDD: 62.05% | 424W/108L
- Params: BTCUSDT 5x | 1000 -> 35159.28509298845
---

### 📊 Official Record: Record.7.0.4.24
- ROI: 577.14% | MDD: 73.29% | 329W/124L
- Params: BTCUSDT 5x | 1000 -> 6771.365715468021
---

### 📊 Official Record: Record.7.0.4.25
- ROI: 863.43% | MDD: 31.91% | 194W/32L
- Params: BTCUSDT 5x | 1000 -> 9634.294166051226
---

### 📊 Official Record: Record.7.0.4.26
- ROI: 758.88% | MDD: 44.84% | 223W/26L
- Params: BTCUSDT 5x | 1000 -> 8588.836376119007
---

### 📊 Official Record: Record.7.0.4.27
- ROI: 908.71% | MDD: 35.20% | 182W/33L
- Params: BTCUSDT 5x | 1000 -> 10087.114613475627
---

### 📊 Official Record: Record.7.0.4.28
- ROI: 706.61% | MDD: 60.91% | 349W/91L
- Params: BTCUSDT 5x | 1000 -> 8066.132524225447
---

### 📊 Official Record: Record.7.0.4.29
- ROI: 1364.32% | MDD: 63.51% | 395W/111L
- Params: BTCUSDT 5x | 1000 -> 14643.155263835806
---

### 📊 Official Record: Record.7.0.4.30
- ROI: 11.64% | MDD: 77.73% | 417W/137L
- Params: BTCUSDT 5x | 1000 -> 1116.401808307859
---

### 📊 Official Record: Record.7.0.4.31
- ROI: 14.61% | MDD: 21.10% | 30W/8L
- Params: BTCUSDT 5x | 1000 -> 1146.0912019292196
---

### 📊 Official Record: Record.7.0.4.32
- ROI: 1745.60% | MDD: 63.91% | 447W/101L
- Params: BTCUSDT 5x | 1000 -> 18456.03549576441
---

### 📊 Official Record: Record.7.0.4.33
- ROI: 503.61% | MDD: 75.67% | 367W/112L
- Params: BTCUSDT 5x | 1000 -> 6036.1014707816585
---

### 📊 Official Record: Record.7.0.4.34
- ROI: -49.28% | MDD: 83.37% | 438W/138L
- Params: BTCUSDT 5x | 1000 -> 507.2448110363468
---

### 📊 Official Record: Record.7.0.4.35
- ROI: 25.44% | MDD: 77.44% | 574W/107L
- Params: BTCUSDT 5x | 1000 -> 1254.4125427166293
---

### 📊 Official Record: Record.7.0.4.36
- ROI: 1561.65% | MDD: 63.25% | 558W/89L
- Params: BTCUSDT 5x | 1000 -> 16616.485012696307
---

### 📊 Official Record: Record.7.0.4.37
- ROI: 753.71% | MDD: 64.80% | 434W/79L
- Params: BTCUSDT 5x | 1000 -> 8537.10801837601
---

### 📊 Official Record: Record.7.0.4.38
- ROI: 299133.83% | MDD: 61.73% | 1091W/222L
- Params: BTCUSDT 5x | 1000 -> 2992338.31616552
---

### 📊 Official Record: Record.8.0.0.1
- ROI: 1442.06% | MDD: 31.91% | 193W/29L
- Params: BTCUSDT 5x | 1000 -> 15420.618412181848
---

### 📊 Official Record: Record.8.0.0.2
- ROI: 1294.84% | MDD: 54.52% | 374W/86L
- Params: BTCUSDT 5x | 1000 -> 13948.427793665489
---

### 📊 Official Record: Record.8.0.0.3
- ROI: 2193.88% | MDD: 55.72% | 478W/91L
- Params: BTCUSDT 5x | 1000 -> 22938.848304908206
---

### 📊 Official Record: Record.8.0.0.4
- ROI: 673.90% | MDD: 74.82% | 517W/107L
- Params: BTCUSDT 5x | 1000 -> 7739.018343551461
---

### 📊 Official Record: Record.8.0.0.5
- ROI: 5.66% | MDD: 79.96% | 422W/129L
- Params: BTCUSDT 5x | 1000 -> 1056.6489975978152
---

### 📊 Official Record: Record.8.1.0.1
- ROI: 627.99% | MDD: 35.65% | 163W/17L
- Params: BTCUSDT 5x | 1000 -> 7279.909635457232
---

### 📊 Official Record: Record.8.1.0.2
- ROI: 627.99% | MDD: 35.65% | 163W/17L
- Params: BTCUSDT 5x | 1000 -> 7279.909635457232
---

### 📊 Official Record: Record.8.0.0.6
- ROI: 995.68% | MDD: 32.26% | 168W/26L
- Params: BTCUSDT 5x | 1000 -> 10956.759400549407
---

### 📊 Official Record: Record.8.0.0.7
- ROI: 995.68% | MDD: 32.26% | 168W/26L
- Params: BTCUSDT 5x | 1000 -> 10956.759400549407
---

### 📊 Official Record: Record.8.1.0.3
- ROI: 995.68% | MDD: 32.26% | 168W/26L
- Params: BTCUSDT 5x | 1000 -> 10956.759400549407
---

### 📊 Official Record: Record.8.1.0.4
- ROI: 1072.48% | MDD: 32.26% | 171W/26L
- Params: BTCUSDT 5x | 1000 -> 11724.799867317946
---

### 📊 Official Record: Record.8.1.0.5
- ROI: 1034.50% | MDD: 50.01% | 343W/77L
- Params: BTCUSDT 5x | 1000 -> 11345.044336960884
---

### 📊 Official Record: Record.8.1.0.6
- ROI: 312.83% | MDD: 77.11% | 340W/98L
- Params: BTCUSDT 5x | 1000 -> 4128.252635782312
---

### 📊 Official Record: Record.7.0.4.39
- ROI: 483.49% | MDD: 29.80% | 94W/10L
- Params: BTCUSDT 5x | 1000 -> 5834.886856993051
---

### 📊 Official Record: Record.7.0.3.1
- ROI: 483.49% | MDD: 29.80% | 94W/10L
- Params: BTCUSDT 5x | 1000 -> 5834.886856993051
---

### 📊 Official Record: Record.8.0.0.8
- ROI: 483.49% | MDD: 29.80% | 94W/10L
- Params: BTCUSDT 5x | 1000 -> 5834.886856993051
---

### 📊 Official Record: Record.8.1.0.7
- ROI: 483.49% | MDD: 29.80% | 94W/10L
- Params: BTCUSDT 5x | 1000 -> 5834.886856993051
---

### 📊 Official Record: Record.8.1.0.8
- ROI: 729.76% | MDD: 27.78% | 78W/11L
- Params: BTCUSDT 5x | 1000 -> 8297.612189836327
---

### 📊 Official Record: Record.8.1.0.9
- ROI: 2604.99% | MDD: 55.32% | 311W/88L
- Params: BTCUSDT 5x | 1000 -> 27049.93627104609
---

### 📊 Official Record: Record.8.1.0.10
- ROI: 4610.12% | MDD: 47.30% | 393W/94L
- Params: BTCUSDT 5x | 1000 -> 47101.24733836387
---

### 📊 Official Record: Record.8.1.0.11
- ROI: 118.19% | MDD: 82.75% | 285W/118L
- Params: BTCUSDT 5x | 1000 -> 2181.9435009528893
---

### 📊 Official Record: Record.8.1.0.12
- ROI: 188.77% | MDD: 80.60% | 294W/119L
- Params: BTCUSDT 5x | 1000 -> 2887.6504300720117
---

### 📊 Official Record: Record.8.1.0.13
- ROI: 1135.18% | MDD: 35.20% | 174W/30L
- Params: BTCUSDT 5x | 1000 -> 12351.795039883258
---

### 📊 Official Record: Record.8.1.0.14
- ROI: 1109.52% | MDD: 51.50% | 347W/85L
- Params: BTCUSDT 5x | 1000 -> 12095.190139711585
---

### 📊 Official Record: Record.8.1.0.15
- ROI: 3270.42% | MDD: 54.50% | 440W/88L
- Params: BTCUSDT 5x | 1000 -> 33704.22522897145
---

### 📊 Official Record: Record.8.1.0.16
- ROI: 365.49% | MDD: 81.32% | 347W/106L
- Params: BTCUSDT 5x | 1000 -> 4654.877009385484
---

### 📊 Official Record: Record.8.1.0.17
- ROI: 177.51% | MDD: 74.48% | 462W/114L
- Params: BTCUSDT 5x | 1000 -> 2775.0595179580696
---

### 📊 Official Record: Record.8.1.0.18
- ROI: 272.72% | MDD: 82.90% | 338W/105L
- Params: BTCUSDT 5x | 1000 -> 3727.209301226488
---

### 📊 Official Record: Record.8.1.0.19
- ROI: 3336.01% | MDD: 54.50% | 437W/87L
- Params: BTCUSDT 5x | 1000 -> 34360.07014537007
---

### 📊 Official Record: Record.8.1.0.20
- ROI: 1074.29% | MDD: 51.50% | 346W/85L
- Params: BTCUSDT 5x | 1000 -> 11742.903048263668
---

### 📊 Official Record: Record.8.1.0.21
- ROI: 1359.16% | MDD: 35.20% | 174W/29L
- Params: BTCUSDT 5x | 1000 -> 14591.60666259097
---

### 📊 Official Record: Record.8.1.0.22
- ROI: 1266.20% | MDD: 33.89% | 185W/28L
- Params: BTCUSDT 5x | 1000 -> 13662.021080968549
---

### 📊 Official Record: Record.8.1.0.23
- ROI: 1334.71% | MDD: 52.07% | 370W/84L
- Params: BTCUSDT 5x | 1000 -> 14347.12002079894
---

### 📊 Official Record: Record.8.1.0.24
- ROI: 205.21% | MDD: 83.35% | 359W/106L
- Params: BTCUSDT 5x | 1000 -> 3052.0558161191398
---

### 📊 Official Record: Record.8.1.0.25
- ROI: 182.04% | MDD: 77.38% | 549W/96L
- Params: BTCUSDT 5x | 1000 -> 2820.432095672015
---

### 📊 Official Record: Record.8.1.0.26
- ROI: 1339.75% | MDD: 54.92% | 515W/79L
- Params: BTCUSDT 5x | 1000 -> 14397.47169359195
---

### 📊 Official Record: Record.8.1.0.27
- ROI: 1017.13% | MDD: 46.45% | 213W/23L
- Params: BTCUSDT 5x | 1000 -> 11171.29479650385
---

### 📊 Official Record: Record.8.1.0.28
- ROI: 1004.47% | MDD: 30.46% | 237W/20L
- Params: BTCUSDT 5x | 1000 -> 11044.74232035081
---

### 📊 Official Record: Record.8.1.0.29
- ROI: 420.91% | MDD: 62.21% | 462W/65L
- Params: BTCUSDT 5x | 1000 -> 5209.075005496961
---

### 📊 Official Record: Record.8.2.0.1
- ROI: 1013.01% | MDD: 32.09% | 168W/31L
- Params: BTCUSDT 5x | 1000 -> 11130.123183384585
---

### 📊 Official Record: Record.8.2.0.2
- ROI: 994.03% | MDD: 31.16% | 196W/22L
- Params: BTCUSDT 5x | 1000 -> 10940.310876815027
---
