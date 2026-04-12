# ✅ Code Verification Guide

이 문서는 코드가 수정될 때마다 엔진과 전략의 정합성을 검증하기 위한 가이드라인입니다. 모든 수정은 아래 조건을 통과해야 합니다.

## 1. 필수 검증 체크리스트 (Hard Rules)

### 📊 데이터 참조 정합성 (Data Integrity)
- [ ] **Confirmed Candles Only:** `findLastIndex`를 사용하여 `k.time + 주기 <= referenceTime` 조건으로 인덱스를 찾는가? (단순 `Index - 1` 사용 금지)
- [ ] **No Look-ahead Bias:** 현재 시간 `T`의 고가/저가/종가가 시그널 판단(`signal_logic`)에 포함되지 않았는가?
- [ ] **1D Sync:** 1일봉 데이터가 현재 시점 이전에 **완전히 마감된 어제의 데이터**를 가리키는가?

### ⚙️ 시스템 연동 (System Integration)
- [ ] **UI Sync:** 전략 파일의 `signal_logic`이 `overrideRules` 인자를 받아 대시보드 설정을 최우선으로 따르는가?
- [ ] **Timing Consistency:** 시그널 발생 즉시(`T`) 진입을 시도하기 위해 `entry_logic` 루프가 `currentIndex`부터 시작하는가?

### 📁 로그 및 기록 (Logging)
- [ ] **Validation Log:** `validation_FULL_...csv` 파일에 기록된 지표값이 대시역보드 설정 및 실제 지표와 일치하는가?

---

## 2. 자동 검증 스크립트 실행 방법
코드 수정 후 터미널에서 다음 명령어를 실행하여 로직 결함 여부를 확인합니다.

```bash
node scripts/verify_logic.cjs
```

이 스크립트는 다음 항목을 스캔합니다:
1. `engine.cjs` 내 인덱스 탐색 로직의 안전성
2. `signal_logic`의 인자 구성 및 `overrideRules` 사용 여부
3. 핵심 파일간의 버전 동기화 상태
