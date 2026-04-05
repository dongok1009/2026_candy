# Changelog
 
## [Infrastructure Update] - 2026-04-04
### Added
- **통합 백테스트 엔진(Unified Engine) 및 전략 버전 관리 시스템 도입**
- **모듈화**: 지표 계산(`lib/indicators.cjs`), 엔진(`lib/engine.cjs`), 유틸리티(`lib/utils.cjs`)로 코드 분리.
- **버전 불변성**: `/strategies` 폴더에 각 버전별(`.cjs`) 전략 정의서를 독립적으로 관리하여 과거 결과 보존.
- **자동 결과 로깅**: 모든 백테스트 결과는 `/results` 폴더에 버전 및 실행 시점이 포함된 파일명으로 자동 저장.
- **진입 로직 강화**: 시장가 및 지정가 진입 시 발생하는 가격 갭(Gap) 대응 로직 표준화.


## [6.0.0] - 2026-03-31
### Added
- **고빈도 수익 최적화 (High Frequency Optimized)**: 1일봉의 StochRSI 필터(`kd > dd`)를 제거하여 추세 추종 빈도를 비약적으로 향상.
- **상세 신호 조건 (Signals)**:
    - **5분봉(5m)**: StochRSI Cross Only
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: **MACD Cross Only** (StochRSI 필터 OFF)
- **6개년 통합 검증 결과 (2020~2026)**: 
    - **2020년**: ROI **+6,809.0%** | 승률 87.6% (757승 / 107패) | 864회
    - **2021년**: ROI **+1,470,074.6%** | 승률 89.0% (1,081승 / 133패) | 1,214회
    - **2022년**: ROI **+90.8%** | 승률 85.5% (719승 / 122패) | 841회
    - **2023년**: ROI **+902.6%** | 승률 87.5% (468승 / 67패) | 535회
    - **2024년**: ROI **+923.2%** | 승률 86.7% (659승 / 101패) | 760회
    - **2025~26년**: ROI **+2,910.3%** | 승률 87.5% (677승 / 97패) | 774회
- **파일**: `backtest_v600_final.cjs` 및 상세 결과 CSV (`backtest_v600_results.csv`) 저장.

### Changed
- **신호 필터 간소화**: 1일봉은 MACD 방향성만 확인하도록 변경하여 1시간/5분봉 신호가 즉각적으로 복리 수익에 기여하도록 최적화.

## [5.0.1] - 2026-03-31
### Fixed
- **필터 보정 (Filter Fix)**: v5.0.0에서 누락되었던 1일봉 StochRSI 골든/데드크로스 필터를 복구하여 승률 안정성 확보.
- **상세 신호 조건 (Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: **MACD Cross AND StochRSI Cross** (에너지 필터 OFF)
- **실행 결과 상세**:
    - **2024년**: ROI +451.9% | 승률 87.6% (305승/43패) | 348회
    - **2025~26년**: ROI +1027.9% | 승률 87.9% (400승/55패) | 455회

### Added
- **거래량(Volume) 로깅**: 진입 시점의 5분봉 및 1시간봉 거래량을 CSV에 기록하여 유동성 분석 토대 마련.
- **하이브리드 진입 (Better Price Entry)**: 시장가와 지정가를 실시간 비교하여 유리한 가격으로 진입하는 로직 적용.

## [3.4.2] - 2026-03-30
### Added
- **에너지 필터 제거 (Energy Filter OFF)**: 1일봉의 MACD히스토그램 임계값(|MACD - Signal| > 300) 조건을 제거하여 수익 기회 대폭 확대.
- **상세 신호 조건 (Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: **MACD Cross AND StochRSI Cross** (에너지 필터 OFF)
- **성능**: 수익률 **+1120.6%** 달성 (v3.4.0 대비 약 2.7배 상승), 승률 88.0%.

## [3.4.1] - 2026-03-29
### Added
- **고배율 실험 (High Leverage 10x)**: 10배 레버리지 및 TP 6% / SL 30% 설정 실험.
- **결과**: ROI **+620.1%** 달성, 승률 88.2% 유지 확인.

## [3.4.0] - 2026-03-29
### Added
- **5분봉 지정가 진입 (5m Limit Entry)**: 진입 로직을 직전 5분봉의 Low(Long) / High(Short)로 개선하여 평단가 최적화.
- **상세 신호 조건 (Signals)**:
    - **5분봉(5m)**: StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross AND **Energy Filter 300**
- **성능**: 수익률 **+412.1%** (v3.3.0 대비 약 2배 향상), 승률 88.1%.

## [3.3.0] - 2026-03-29
### Added
- **지정가 진입 로직 (1m Limit Entry)**: 신호 발생 시 직전 1분봉의 Low(Long) / High(Short)에 지정가 배치.
- **성과**: 수익률 **+220.0%**, 승률 87.4% 기록.

## [3.1.0] - 2026-03-29
### Added
- **재진입 금지(No Re-entry) 로직**: 거래 종료 후 동일 파동 내 즉시 재투자 방지로 횡보장 손실 차단.
- **성과**: 수익률 -34%에서 **+105.1%**로 극적 반전 성공.

## [3.0.0] - 2026-03-26
### Official Baseline Release
- **특징**: 확정봉(Wait-on-Close) 기반 분석과 1일봉 에너지 필터 300 적용.
- **상세 신호 조건 (Signals)**:
    - **5분봉(5m)**: MACD Filter (-10/10) AND StochRSI Cross
    - **1시간봉(1h)**: MACD Cross AND StochRSI Cross
    - **1일봉(1d)**: MACD Cross AND StochRSI Cross AND Energy Filter 300
- **수익률**: +27.4%, 승률 90.9%.
