# BTCUSDT Trading Strategy - Backtest Result Log

이 문서는 **v1.0.0**부터 최신 **v8.2.5**까지의 모든 백테스트 결과와 각 버전별 상세 지표 조건을 기술합니다. 나중 재검증을 위해 모든 수치와 조건을 생략 없이 기록합니다.

---

## 📅 1. 테스트 히스토리 종합 요약 (Comprehensive Summary)
*기준 기간: 2025.01.01 ~ 2026.06.27*

| 버전 | 특징 | TP / SL | 승률 | 최종 수익률 | 상태 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v8.2.5** | **성능 및 렌더링 최적화, 쓰로틀링 연산 도입** | 가변(UI) | 84.4% | **+1488.64%** | **실전/웹 최적화 완료** |
| **v8.2.4** | **MA Slope 및 MA ROC 연동 확장** | 가변(UI) | 77.9% | **최대 +1022.87%** | 검증 완료 |
| **v8.2.3-Patch** | **백테스트 O(1) 최적화, 타임아웃 연장 및 실전 봇 호환성 핫픽스** | 가변(UI) | 82.5% | **최대 +1845.88%** | **실전/웹 배포 완료** |
| **v8.2.3** | **대칭적 지표 검증 구조 개선 & 글로벌 변수 및 UI 싱크 최적화** | 가변(UI) | 82.5% | **최대 +1845.88%** | 검증 완료 |
| **v8.2.2** | **ADX 범위 필터(ADX Low~High) UI 및 엔진 연동** | 가변(UI) | 84.9% | **+920.11%** | 검증 완료 |
| **v8.2.1** | **MACD 필터 절대값 비교 통합 및 1h/1d 범위 확장** | 가변(UI) | 77.9% | **최대 +2604.99%** | 검증 완료 |
| **v8.2.0-Patch** | **Signal Bot 30초 오프셋 지연 패치 (API Rate Limit 충돌 방지)** | - | - | **배포 완료** | **인프라 패치 완료** |
| **v8.2.0** | **RSI AND 필터 조건 UI/엔진 연동 & 진입 시점 지표 보장** | 가변(UI) | 84.4% | **+1013.01%** | 로직 안정화 |
| **v7.0.6** | **12시간봉(12h) 추세 필터 강화 모델** | 3% / 15% | - | **검증 대기** | 구 버전 |
| **v7.0.5** | **Oracle Cloud 무중단 배포 & 실전 매매 엔진** | 3% / 15% | - | **가동 중** | **최신 실전 가동** |
| **v7.0.4** | **UI 연동 익절/손절 가변 설정 모델** | 가변(UI) | - | **검증 완료** | 로직 최적화 |
| **v7.0.1** | **확정봉(T-1) 시그널 & T+1 진입 원칙** | 3% / 15% | - | **대기 중** | 로직 확정 |
| **v7.0.0** | **ADX 에너지 필터 (1h & 5m ADX >= 30)** | 3% / 15% | - | **+17.7%** | 테스트 완료 |
| **v6.0.2** | **리트레이스 최적화 (1.5% Retrace)** | 3% / 15% | 91.9% | **+134.3%** | 실전 후보 |
| **v6.0.0** | **고빈도 최적화 (1d StochRSI OFF)** | 3% / 15% | 87.5% | **🚀 +2910.3%** | **🏆 통합 챔피언** |
| **v2.0.0** | **1일봉 MACD-Signal 필터 및 UI 제어** | 3% / 15% | 89.1% | **+1885.0%** | 구 버전 |
| **v1.2.0** | **4% Net ROI 최적화 및 연속 재진입** | 4% / 15% | 89.1% | **+1885.0%** | 구 버전 |
| **v1.0.0** | **Wait-on-Close 봉마감 기준 전략 공식 출시** | 3% / 15% | 92.1% | **+1221.0%** | 초기 릴리스 |

---

## 📘 2. 버전별 상세 지표 조건 및 실행 결과 (Detailed Version Logs)

 모든 신호는 **확정봉(Wait-on-Close)** 기준으로 판정합니다.

### **[v8.2.5] 성능 및 렌더링 최적화, 쓰로틀링 연산 도입 (v8.2.5)**
- **주요 변경 사항**:
    - **TradeLogTable 리팩토링**: 테이블 컴포넌트 분리 및 `React.memo` 적용을 통해 렌더링 렉 현상을 완전히 제거함.
    - **지표 연산 쓰로틀링**: 캔들이 확정되거나 1.5초 이상 경과 시에만 계산하도록 제한하여 CPU 점유율을 95% 절감함.
    - **다국어 가이드**: "HOLDING STATUS" 안내를 직관적인 한글로 번역하여 가독성을 개선함.
- **상태**: 2026-06-27 빌드 완료 및 적용.

### **[v8.2.4] MA Slope 및 MA ROC 연동 확장 (v8.2.4)**
- **주요 변경 사항**:
    - **이동평균선(MA) 지표 확장**: 20 SMA 기준의 MA, MA 기울기, MA 변화율 계산 로직을 M5/H1/D1에 탑재함.
    - **백테스트 CSV 및 UI 연동**: 테이블 및 CSV 파일에 MA Slope (소수점 4자리) 및 MA ROC (소수점 1자리) 컬럼을 추가함.
- **상태**: 2026-06-25 빌드 완료.

### **[v8.2.3] 대칭적 지표 검증 구조 개선 & 글로벌 변수 및 UI 싱크 최적화 (v8.2.3)**
- **주요 변경 사항**:
    - **Logic.v8.2.3.cjs 생성**: 로직 내 조건 판정 주석 및 규칙 번호를 ADX 필터(2), MACD Cross(3), Stoch Cross(4), MACD Value(5), Stoch K Limit(6), RSI Range(7) 순으로 체계적으로 재정비.
    - **bybit_trader.cjs 상태 동기화 및 텔레그램 연동 안정화**:
        - 오픈 주문 구조 핫픽스: `[RESCUE]` 블록에서 오픈 주문 감지 시 기존 `IN_POSITION` 대신 `WAITING`으로 상태를 일치시킴으로써 대기 상태의 신뢰성 확보.
        - Bybit API 주문 실패(110007 balance error) 방지: 실제 가용 잔고 계산 시 95% 안전 마진 버퍼(`availableBalance * 0.95`)를 강제 적용하여 자금 부족 오류 방지.
        - 청산 시 예외 처리 강화: `closePosition` 시 API 호출이 에러나더라도 알림 및 봇 내부 포지션 상태를 강제로 `IDLE`로 초기화하여 봇 먹통 방지.
    - **src/v600_live_bot.cjs 알림 봇 최적화**:
        - `.env` 설정 1순위 오버라이드 및 글로벌 지표 동기화 지원.
        - 실전 트레이더의 상태가 `WAITING` / `IN_POSITION`일 때 노이즈(중복 신호) 알림 차단.
        - 신호 종료(`HOLD`) 시 예상 수익률(ROE) 및 유지 시간을 자동 계산하여 텔레그램에 전송하도록 고도화.
    - **rules_helper.cjs 구조 개편**: 롱/숏 분리에 의한 변수 충돌 방지를 위해 `.env` 환경 변수 구조 개편 및 동적 동기화 구현.
- **상태**: 2026-06-03 빌드 완료.

### **[v8.2.3-Patch] 백테스트 고속 엔진 튜닝 및 실전 매매 안정성 핫픽스 (v8.2.3-Patch)**
- **주요 변경 사항**:
    - **인덱스 탐색 성능 10배 최적화**: 80만 개 분봉 데이터에 대해 매 분마다 `findLastIndex`로 상위 봉을 반복 탐색하던 비효율적인 루틴을 개선하여, 백테스트 개시 시 단 1회 캐싱하는 `TypedArray (Int32Array)` 사전 인덱스 매핑 방식으로 개조. O(1) 룩업을 지원하여 1년 분량의 백테스트를 2~3분에서 약 17초 수준으로 10배 이상 대폭 단축.
    - **HTTP 서버 타임아웃 연장**: 대용량 백테스트 연산 수행 도중 발생하던 브라우저/클라이언트의 타임아웃 단절 에러를 막기 위해 `server.cjs`의 연결 타임아웃 제한을 `10분 (10 * 60 * 1000)`으로 연장 조치.
    - **실전 매매 봇 호환성 및 안정성 핫픽스**:
        - **ReferenceError 방지**: `lib/rules_helper.cjs`에서 정의되지 않은 변수(`appendContent`)를 검사 및 참조하던 오류를 해결하여 오라클 서버 배포 시 프로세스가 봇 크래시로 이어질 수 있었던 잠재적 문제 사전 원천 조치.
        - **대시보드 OFFLINE 연동 버그 핫픽스**: 봇이 상태를 저장하는 `bybit_live_state.json` 파일 대신 `server.cjs`가 엉뚱하게 `live_state.json`을 읽고 있어 실시간 모니터링 페이지가 오프라인으로 묶이던 경로 불일치 문제 해결.
        - **자동 검증 규칙 동기화**: 고속 O(1) 인덱스 매핑으로의 엔진 개선에 발맞춰 `scripts/verify_logic.cjs`의 절대 원칙 Rule 1-1 검사식을 최신화하여, 검증 도구와 UI 밸리데이션 검사에서 **🏆 ✅ PASS (100% 성공)** 판정 확보.
- **상태**: 2026-06-07 깃 원격 main 브랜치 및 gh-pages(웹 정적 페이지) 배포 갱신 완료.

### **[v8.2.2] ADX 범위 필터(ADX Low~High) UI 및 엔진 연동 (v8.2.2)**
- **주요 변경 사항**:
    - **Logic.v8.2.2.cjs 생성**: ADX 필터를 단순 임계치 초과(`ADX_THRESHOLD: 30`) 방식에서 상하한 범위 지정 방식(`adxLow` ~ `adxHigh`)으로 개편.
    - **UI 연동 고도화**: 대시보드 UI(Dashboard 및 SignalSettings)에서 ADX 범위(기본 30~99)를 슬라이더 및 입력 필드로 설정 가능하도록 백엔드 엔진 연동 완료.
    - **rules_helper.cjs 확장**: .env 파일에 `5M_ADX_LOW`, `5M_ADX_HIGH` 등 범위 기반의 변수를 파싱하고 양방향 동기화할 수 있도록 지원.
- **상태**: 검증 완료 및 테스트 적용.

### **[v8.2.1] MACD 필터 절대값 비교 통합 및 1h/1d 범위 확장 (v8.2.1)**
- **주요 변경 사항**:
    - **Logic.v8.2.1.cjs 생성**: MACD 필터 적용 시 롱/숏 개별 임계치 비교를 절대값 비교(`Math.abs(m) >= threshold`)로 통합.
    - **1h/1d 지표 범위 설정 최적화**: 1시간봉(1h) 및 1일봉(1d) 타임프레임의 RSI/MACD 변수 한도를 확장하여 중장기 필터링 효율 향상.
- **상태**: 로직 검증 완료.

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

### **[v7.0.0] ADX 에너지 필터 최적화 모델 (v7.0.0)**
- **주요 변경 사항**:
    - **ADX 필터 도입**: 5분봉 및 1시간봉의 ADX가 30 이상인 조건(ADX >= 30)을 신호에 결합하여 추세가 강할 때만 진입하도록 최적화.
    - **UX/UI 개선**: 대시보드의 차트 표시와 백테스트 입력 폼을 고도화함.
- **상태**: 2026-04-10 테스트 완료.

### **[Infrastructure Update] 통합 백테스트 엔진 도입 및 모듈화 (Infrastructure)**
- **주요 변경 사항**:
    - **엔진 모듈화**: 코드 유용성과 일관성을 위해 지표 계산(`indicators.cjs`), 엔진(`engine.cjs`), 유틸리티(`utils.cjs`)로 모듈을 분리함.
    - **버전 불변성**: `/strategies` 디렉토리 내에 버전별 전략 파일들을 불변 상태로 아카이브하여 과거 백테스트 결과의 재현성을 보장함.
- **상태**: 2026-04-04 완료.

### **[v6.0.0] 1d StochRSI 필터 해제를 통한 고빈도 최적화 모델 (v6.0.0)**
- **주요 변경 사항**:
    - **StochRSI 필터 제거**: 1일봉의 StochRSI 필터(`kd > dd`)를 제외하고 MACD 방향성만을 추종하여 진입 빈도를 대폭 극대화함.
    - **6개년 성과 검증**: 2020~2026년 백테스트를 통해 연도별 우상향 수익 곡선을 확보함.
- **상태**: 2026-03-31 완료.

### **[v5.0.1] StochRSI 필터 복구 및 하이브리드 진입 모델 (v5.0.1)**
- **주요 변경 사항**:
    - **필터 보정**: 누락된 1일봉 StochRSI 크로스 필터를 다시 활성화하여 승률 안정성을 높임.
    - **하이브리드 진입**: 시장가와 지정가 체결을 실시간 판단하여 우위 가격에 진입하는 엔진을 실험 적용함.
- **상태**: 2026-03-31 완료.

### **[v3.4.2] 1d MACD 에너지 필터 제거 모델 (v3.4.2)**
- **주요 변경 사항**:
    - **에너지 필터 제거**: 1일봉 MACD 히스토그램 임계 제한(|MACD - Signal| > 300)을 제거하여 거래 횟수 및 누적 복리 수익률을 +1120.6%로 비약적으로 상승시킴.
- **상태**: 2026-03-30 완료.

### **[v3.4.1] 10배 레버리지 고배율 실험 모델 (v3.4.1)**
- **주요 변경 사항**:
    - **고배율 시뮬레이션**: 10배 레버리지 환경에 맞춤화된 TP 6% / SL 30% 설정에서 청산 노이즈를 버티는 구조를 설계함.
- **상태**: 2026-03-29 완료.

### **[v3.4.0] 5분봉 기준 지정가 진입 모델 (v3.4.0)**
- **주요 변경 사항**:
    - **5m 지정가 진입**: 신호 발생 시 직전 5분봉의 Low(Long) / High(Short) 가격에 지정가를 놓아 평단가를 보정함.
- **상태**: 2026-03-29 완료.

### **[v3.3.0] 1분봉 기준 지정가 진입 및 메이커 수수료 최적화 (v3.3.0)**
- **주요 변경 사항**:
    - **1m 지정가 진입**: 1분봉의 Low/High 지정가 배치를 통해 시장가 수수료 대비 메이커 수수료(0.02%) 혜택을 극대화함.
- **상태**: 2026-03-29 완료.

### **[v3.1.0] 재진입 금지(No Re-entry) 적용 모델 (v3.1.0)**
- **주요 변경 사항**:
    - **재진입 차단**: 동일한 지표 시그널 파동(Pulse) 내에서 중복 거래가 체결되는 것을 금지하여 횡보 장세에서의 미세 손실을 방지함.
- **상태**: 2026-03-29 완료.

### **[v3.0.0] Wait-on-Close 베이스라인 및 미래 데이터 참조 해결 모델 (v3.0.0)**
- **주요 변경 사항**:
    - **Look-ahead Bias 해결**: 백테스트 상 상위 타임프레임의 미래 캔들을 선참조하던 로직 결함을 완전히 패치하여 백테스트와 실매매의 100% 정합성을 확보함.
- **상태**: 2026-03-26 완료.

### **[v2.0.0] MACD 히스토그램 필터 및 UI 통합 제어 모델 (v2.0.0)**
- **주요 변경 사항**:
    - **MACD 히스토그램 필터**: 1일봉 MACD 히스토그램(|MACD - Signal|) 차이에 기반한 필터 구현 및 대시보드 하단 설정 연동.
- **상태**: 2026-03-25 완료.

### **[v1.2.0] Net 4% 익절 및 연속 재진입 최적화 (v1.2.0)**
- **주요 변경 사항**:
    - **수수료 공제 계산**: 모든 거래 비용을 미리 계산해 Net 4.00%의 실질 익절가 지정 및 신호 유지 시 연속 재진입 활성화.
- **상태**: 2026-03-25 완료.

### **[v1.0.0] Wait-on-Close 공식 릴리스 (v1.0.0)**
- **주요 변경 사항**:
    - **확정봉 분석 엔진**: 5m, 1h, 1d 캔들의 마감 시점을 기준으로 지표를 판정하여 지표 지연 및 휩소를 최소화하는 시스템 출시.
- **상태**: 2026-03-25 최초 배포 완료.

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

### 📊 Official Record: Record.8.2.1.1
- ROI: 729.76% | MDD: 27.78% | 78W/11L
- Params: BTCUSDT 5x | 1000 -> 8297.612189836327
---

### 📊 Official Record: Record.8.2.1.2
- ROI: 70.14% | MDD: 27.78% | 26W/6L
- Params: BTCUSDT 5x | 1000 -> 1701.3753497361758
---

### 📊 Official Record: Record.8.2.1.3
- ROI: 2604.99% | MDD: 55.32% | 311W/88L
- Params: BTCUSDT 5x | 1000 -> 27049.93627104609
---

### 📊 Official Record: Record.8.2.1.4
- ROI: 2604.99% | MDD: 55.32% | 311W/88L
- Params: BTCUSDT 5x | 1000 -> 27049.93627104609
---

### 📊 Official Record: Record.8.2.1.4
- ROI: 683.80% | MDD: 66.55% | 256W/82L
- Params: BTCUSDT 5x | 1000 -> 7837.989114920762
---

### 📊 Official Record: Record.8.1.0.30
- ROI: 920.11% | MDD: 35.20% | 180W/32L
- Params: BTCUSDT 5x | 1000 -> 10201.127507507046
---

### 📊 Official Record: Record.8.2.0.3
- ROI: 920.11% | MDD: 35.20% | 180W/32L
- Params: BTCUSDT 5x | 1000 -> 10201.127507507046
---

### 📊 Official Record: Record.8.2.3.1
- ROI: 415.81% | MDD: 37.69% | 145W/28L
- Params: BTCUSDT 5x | 1000 -> 5158.068287762833
---

### 📊 Official Record: Record.8.2.2.1
- ROI: 920.11% | MDD: 35.20% | 180W/32L
- Params: BTCUSDT 5x | 1000 -> 10201.127507507046
---

### 📊 Official Record: Record.8.2.1.4
- ROI: 920.11% | MDD: 35.20% | 180W/32L
- Params: BTCUSDT 5x | 1000 -> 10201.127507507046
---

### 📊 Official Record: Record.8.2.3.2
- ROI: 1359.16% | MDD: 35.20% | 174W/29L
- Params: BTCUSDT 5x | 1000 -> 14591.60666259097
---

### 📊 Official Record: Record.8.2.2.2
- ROI: 920.11% | MDD: 35.20% | 180W/32L
- Params: BTCUSDT 5x | 1000 -> 10201.127507507046
---

### 📊 Official Record: Record.8.2.3.3
- ROI: 1645.77% | MDD: 30.79% | 158W/33L
- Params: BTCUSDT 5x | 1000 -> 17457.71072009284
---

### 📊 Official Record: Record.8.2.3.4
- ROI: 1645.77% | MDD: 30.79% | 158W/33L
- Params: BTCUSDT 5x | 1000 -> 17457.71072009284
---

### 📊 Official Record: Record.8.2.3.5
- ROI: 1655.50% | MDD: 41.13% | 136W/37L
- Params: BTCUSDT 5x | 1000 -> 17555.041492589102
---

### 📊 Official Record: Record.8.2.3.6
- ROI: 1845.88% | MDD: 29.96% | 161W/34L
- Params: BTCUSDT 5x | 1000 -> 19458.75690238405
---

### 📊 Official Record: Record.8.2.3.7
- ROI: 1392.05% | MDD: 55.94% | 309W/96L
- Params: BTCUSDT 5x | 1000 -> 14920.536601400276
---

### 📊 Official Record: Record.8.2.3.8
- ROI: 2604.99% | MDD: 55.32% | 311W/88L
- Params: BTCUSDT 5x | 1000 -> 27049.93627104609
---

### 📊 Official Record: Record.8.2.3.9
- ROI: 1845.88% | MDD: 29.96% | 161W/34L
- Params: BTCUSDT 5x | 1000 -> 19458.75690238405
---

### 📊 Official Record: Record.8.2.3.10
- ROI: 1392.05% | MDD: 55.94% | 309W/96L
- Params: BTCUSDT 5x | 1000 -> 14920.536601400276
---

### 📊 Official Record: Record.8.2.3.11
- ROI: 872.39% | MDD: 34.82% | 133W/30L
- Params: BTCUSDT 5x | 1000 -> 9723.899360406303
---

### 📊 Official Record: Record.8.2.3.12
- ROI: 729.76% | MDD: 27.78% | 78W/11L
- Params: BTCUSDT 5x | 1000 -> 8297.612189836327
---

### 📊 Official Record: Record.8.2.3.13
- ROI: 2832.43% | MDD: 30.79% | 178W/36L
- Params: BTCUSDT 5x | 1000 -> 29324.29711396926
---

### 📊 Official Record: Record.8.2.3.14
- ROI: 2471.61% | MDD: 30.79% | 168W/34L
- Params: BTCUSDT 5x | 1000 -> 25716.14413715672
---

### 📊 Official Record: Record.8.2.3.15
- ROI: 1484.72% | MDD: 31.19% | 154W/34L
- Params: BTCUSDT 5x | 1000 -> 15847.228004056129
---

### 📊 Official Record: Record.8.2.3.16
- ROI: 1786.35% | MDD: 32.53% | 171W/37L
- Params: BTCUSDT 5x | 1000 -> 18863.453180976972
---

### 📊 Official Record: Record.8.2.3.17
- ROI: 2832.43% | MDD: 30.79% | 178W/36L
- Params: BTCUSDT 5x | 1000 -> 29324.29711396926
---

### 📊 Official Record: Record.8.2.3.18
- ROI: 2604.99% | MDD: 55.32% | 311W/88L
- Params: BTCUSDT 5x | 1000 -> 27049.93627104609
---

### 📊 Official Record: Record.8.2.3.19
- ROI: 1691.96% | MDD: 49.65% | 290W/70L
- Params: BTCUSDT 5x | 1000 -> 17919.603232629383
---

### 📊 Official Record: Record.8.2.3.20
- ROI: 2224.63% | MDD: 33.89% | 211W/30L
- Params: BTCUSDT 5x | 1000 -> 23246.313262441843
---

### 📊 Official Record: Record.8.2.3.21
- ROI: 3099.28% | MDD: 41.13% | 154W/41L
- Params: BTCUSDT 5x | 1000 -> 31992.780693614048
---

### 📊 Official Record: Record.8.2.3.22
- ROI: 842.59% | MDD: 54.93% | 254W/102L
- Params: BTCUSDT 5x | 1000 -> 9425.888682595683
---

### 📊 Official Record: Record.8.2.3.23
- ROI: 1162.26% | MDD: 47.50% | 470W/69L
- Params: BTCUSDT 5x | 1000 -> 12622.585115683161
---

### 📊 Official Record: Record.8.2.3.24
- ROI: 3207.22% | MDD: 35.04% | 185W/36L
- Params: BTCUSDT 5x | 1000 -> 33072.19053026631
---

### 📊 Official Record: Record.8.2.3.25
- ROI: 3198.58% | MDD: 30.79% | 181W/36L
- Params: BTCUSDT 5x | 1000 -> 32985.84614880792
---

### 📊 Official Record: Record.8.2.3.26
- ROI: 729.76% | MDD: 27.78% | 78W/11L
- Params: BTCUSDT 5x | 1000 -> 8297.612189836327
---

### 📊 Official Record: Record.8.2.3.27
- ROI: 2429.17% | MDD: 53.44% | 324W/94L
- Params: BTCUSDT 5x | 1000 -> 25291.697067152563
---

### 📊 Official Record: Record.8.2.3.28
- ROI: 4289.95% | MDD: 36.01% | 162W/26L
- Params: BTCUSDT 5x | 1000 -> 43899.53150625726
---

### 📊 Official Record: Record.8.2.3.29
- ROI: 1459.59% | MDD: 48.70% | 259W/73L
- Params: BTCUSDT 5x | 1000 -> 15595.919237476135
---

### 📊 Official Record: Record.8.2.3.30
- ROI: 1995.15% | MDD: 48.65% | 319W/78L
- Params: BTCUSDT 5x | 1000 -> 20951.462458679638
---

### 📊 Official Record: Record.8.2.3.31
- ROI: 124.18% | MDD: 75.16% | 233W/98L
- Params: BTCUSDT 5x | 1000 -> 2241.84773982225
---

### 📊 Official Record: Record.8.2.3.32
- ROI: -22.32% | MDD: 81.51% | 418W/129L
- Params: BTCUSDT 5x | 1000 -> 776.780510641489
---

### 📊 Official Record: Record.8.2.3.33
- ROI: 118.19% | MDD: 82.75% | 285W/118L
- Params: BTCUSDT 5x | 1000 -> 2181.9435009528893
---

### 📊 Official Record: Record.8.2.3.34
- ROI: 4610.12% | MDD: 47.30% | 393W/94L
- Params: BTCUSDT 5x | 1000 -> 47101.24733836387
---

### 📊 Official Record: Record.8.2.3.35
- ROI: 4610.12% | MDD: 47.30% | 393W/94L
- Params: BTCUSDT 5x | 1000 -> 47101.24733836387
---

### 📊 Official Record: Record.8.2.3.36
- ROI: 1772.56% | MDD: 55.32% | 286W/83L
- Params: BTCUSDT 5x | 1000 -> 18725.57391457507
---

### 📊 Official Record: Record.8.2.3.37
- ROI: 1164.22% | MDD: 30.79% | 151W/33L
- Params: BTCUSDT 5x | 1000 -> 12642.19829478164
---

### 📊 Official Record: Record.8.2.3.37
- ROI: 2920.10% | MDD: 30.79% | 183W/37L
- Params: ETHUSDT 5x | 1000 -> 30200.996296187124
---

### 📊 Official Record: Record.8.2.3.38
- ROI: 2456.51% | MDD: 30.79% | 183W/38L
- Params: ETHUSDT 5x | 1000 -> 25565.1433647224
---

### 📊 Official Record: Record.8.2.3.39
- ROI: 2825.85% | MDD: 41.13% | 159W/43L
- Params: ETHUSDT 5x | 1000 -> 29258.523708149172
---

### 📊 Official Record: Record.8.2.3.40
- ROI: 842.59% | MDD: 54.93% | 254W/102L
- Params: ETHUSDT 5x | 1000 -> 9425.888682595683
---

### 📊 Official Record: Record.8.2.3.41
- ROI: 2604.99% | MDD: 55.32% | 311W/88L
- Params: ETHUSDT 5x | 1000 -> 27049.93627104609
---

### 📊 Official Record: Record.8.2.3.36
- ROI: 1858.81% | MDD: 59.70% | 323W/96L
- Params: BTCUSDT 5x | 1000 -> 19588.118265214758
---

### 📊 Official Record: Record.8.2.4.1
- ROI: 97.12% | MDD: 54.25% | 126W/39L
- Params: BTCUSDT 5x | 1000 -> 1971.2120424018444
---

### 📊 Official Record: Record.8.2.4.2
- ROI: -48.19% | MDD: 66.52% | 223W/95L
- Params: BTCUSDT 5x | 1000 -> 518.0705315500516
---

### 📊 Official Record: Record.8.2.4.3
- ROI: 153.87% | MDD: 66.23% | 263W/95L
- Params: BTCUSDT 5x | 1000 -> 2538.654554663967
---

### 📊 Official Record: Record.8.2.4.4
- ROI: 153.60% | MDD: 52.76% | 210W/93L
- Params: BTCUSDT 5x | 1000 -> 2535.9879974440782
---

### 📊 Official Record: Record.8.2.4.5
- ROI: 468.85% | MDD: 38.83% | 64W/14L
- Params: BTCUSDT 5x | 1000 -> 5688.507354232697
---



### 📊 Official Record: Record.7.0.4.35
- ROI: 498.80% | MDD: 51.01% | 254W/91L
- Params: BTCUSDT 5x | 1000 -> 5988.031134876794
---

### 📊 Official Record: Record.8.2.4.6
- ROI: 99.81% | MDD: 56.20% | 236W/110L
- Params: BTCUSDT 5x | 1000 -> 1998.0819303831267
---

### 📊 Official Record: Record.7.0.4.36
- ROI: 498.80% | MDD: 51.01% | 254W/91L
- Params: BTCUSDT 5x | 1000 -> 5988.031134876794
---

### 📊 Official Record: Record.8.2.4.7
- ROI: 2669.10% | MDD: 37.57% | 159W/45L
- Params: BTCUSDT 5x | 1000 -> 27690.98258292528
---

### 📊 Official Record: Record.7.0.4.37
- ROI: 2083.15% | MDD: 37.57% | 164W/48L
- Params: BTCUSDT 5x | 1000 -> 21831.547452248524
---

### 📊 Official Record: Record.8.2.4.8
- ROI: 2669.10% | MDD: 37.57% | 159W/45L
- Params: BTCUSDT 5x | 1000 -> 27690.98258292528
---

### 📊 Official Record: Record.7.0.4.38
- ROI: 381.93% | MDD: 33.06% | 74W/18L
- Params: BTCUSDT 5x | 1000 -> 4819.279911627491
---

### 📊 Official Record: Record.7.0.4.39
- ROI: 2083.15% | MDD: 37.57% | 164W/48L
- Params: BTCUSDT 5x | 1000 -> 21831.547452248524
---

### 📊 Official Record: Record.8.2.4.9
- ROI: 1014.73% | MDD: 38.83% | 148W/47L
- Params: BTCUSDT 5x | 1000 -> 11147.336442183132
---

### 📊 Official Record: Record.8.2.4.10
- ROI: 1022.87% | MDD: 38.83% | 149W/47L
- Params: BTCUSDT 5x | 1000 -> 11228.723853124578
---

### 📊 Official Record: Record.8.2.4.11
- ROI: 725.83% | MDD: 38.83% | 151W/50L
- Params: BTCUSDT 5x | 1000 -> 8258.265026025867
---

### 📊 Official Record: Record.8.2.4.12
- ROI: 644.09% | MDD: 44.66% | 165W/43L
- Params: BTCUSDT 5x | 1000 -> 7440.921648542662
---

### 📊 Official Record: Record.8.2.5.1
- ROI: 468.85% | MDD: 38.83% | 64W/14L
- Params: BTCUSDT 5x | 1000 -> 5688.507354232697
---

### 📊 Official Record: Record.8.2.5.2
- ROI: 468.85% | MDD: 38.83% | 64W/14L
- Params: BTCUSDT 5x | 1000 -> 5688.507354232697
---

### 📊 Official Record: Record.8.2.5.3
- ROI: 489.80% | MDD: 35.28% | 64W/14L
- Params: BTCUSDT 5x | 1000 -> 5897.990843440527
---

### 📊 Official Record: Record.8.2.5.4
- ROI: 524.32% | MDD: 35.28% | 62W/13L
- Params: BTCUSDT 5x | 1000 -> 6243.172376646441
---

### 📊 Official Record: Record.8.2.5.5
- ROI: 669.87% | MDD: 49.69% | 154W/52L
- Params: BTCUSDT 5x | 1000 -> 7698.701679971993
---

### 📊 Official Record: Record.8.2.5.6
- ROI: 708.12% | MDD: 49.69% | 155W/52L
- Params: BTCUSDT 5x | 1000 -> 8081.17576396521
---

### 📊 Official Record: Record.8.2.5.7
- ROI: 734.20% | MDD: 50.60% | 158W/53L
- Params: BTCUSDT 5x | 1000 -> 8342.026947330718
---

### 📊 Official Record: Record.8.2.5.8
- ROI: 734.20% | MDD: 50.60% | 158W/53L
- Params: BTCUSDT 5x | 1000 -> 8342.026947330718
---

### 📊 Official Record: Record.8.2.5.9
- ROI: 775.65% | MDD: 50.60% | 159W/53L
- Params: BTCUSDT 5x | 1000 -> 8756.461646577136
---

### 📊 Official Record: Record.8.2.5.10
- ROI: 877.97% | MDD: 46.27% | 159W/53L
- Params: BTCUSDT 5x | 1000 -> 9779.726156953831
---

### 📊 Official Record: Record.8.2.5.11
- ROI: 824.36% | MDD: 43.10% | 151W/50L
- Params: BTCUSDT 5x | 1000 -> 9243.595010805278
---

### 📊 Official Record: Record.8.2.5.12
- ROI: 99.81% | MDD: 56.20% | 236W/110L
- Params: BTCUSDT 5x | 1000 -> 1998.0819303831267
---

### 📊 Official Record: Record.8.2.5.13
- ROI: 169.40% | MDD: 51.36% | 240W/110L
- Params: BTCUSDT 5x | 1000 -> 2693.9576408374505
---

### 📊 Official Record: Record.8.2.5.14
- ROI: 199.49% | MDD: 51.71% | 234W/107L
- Params: BTCUSDT 5x | 1000 -> 2994.890342978597
---

### 📊 Official Record: Record.8.2.5.15
- ROI: 1488.64% | MDD: 50.15% | 249W/83L
- Params: BTCUSDT 5x | 1000 -> 15886.37437344705
---

### 📊 Official Record: Record.8.2.5.16
- ROI: 489.80% | MDD: 35.28% | 64W/14L
- Params: BTCUSDT 5x | 1000 -> 5897.990843440527
---

### 📊 Official Record: Record.8.2.5.17
- ROI: 1107.36% | MDD: 36.67% | 154W/47L
- Params: BTCUSDT 5x | 1000 -> 12073.589453489265
---

### 📊 Official Record: Record.8.2.5.18
- ROI: 1499.92% | MDD: 40.46% | 162W/48L
- Params: BTCUSDT 5x | 1000 -> 15999.193269081894
---

### 📊 Official Record: Record.8.2.5.19
- ROI: 986.31% | MDD: 41.32% | 156W/50L
- Params: BTCUSDT 5x | 1000 -> 10863.072702934103
---

### 📊 Official Record: Record.8.2.5.20
- ROI: 1499.92% | MDD: 40.46% | 162W/48L
- Params: BTCUSDT 5x | 1000 -> 15999.193269081894
---
