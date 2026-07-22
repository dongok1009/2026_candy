<!-- signal-bot을 bybit-live로 통합하는 작업 체크리스트 -->
# signal-bot → bybit-live 통합 체크리스트

## 코드 (bybit_trader.cjs, 거래 로직 불변)
- [x] checkSignalTransition 헬퍼 추가 — 신호 변화 시 정보 알림
- [x] 비IDLE(포지션 보유) 신규 신호 → "🚀 신호 발생!(관망)" (signal-bot에 없던 강화)
- [x] 신호→HOLD 전환 → "💤 신호 종료!(가상 ROE)"
- [x] 매 사이클 currentSig 계산 + 모니터 호출(자체 try/catch로 거래와 격리)
- [x] 하트비트에 "현재 신호" 한 줄 추가(Summary 가시성 흡수)
- [x] node --check 통과

## 배포 (사용자 수행, 에이전트 검증 불가)
- [ ] git push (사용자 확인 후)
- [ ] 오라클: git pull
- [ ] 오라클: `pm2 delete signal-bot` (중복 프로세스 제거 → API 호출 절반)
- [ ] 오라클: `pm2 restart bybit-live --update-env`
- [ ] 실제 진입/청산/신호 알림이 오는지 확인
- [ ] `pm2 logs bybit-live`에서 fetch failed·10006(레이트리밋)이 줄었는지 확인

## 주의
- 기존 죽은 HOLD 알림(line 269 `finalSignal === 'HOLD'`, 소문자라 미작동)은 그대로 둠(무해).
- IDLE 신규 진입 알림은 여전히 handleEntry가 담당(중복 방지).
