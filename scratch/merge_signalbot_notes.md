<!-- signal-bot을 bybit-live로 완전 통합하는 작업의 결정과 근거 -->
# signal-bot → bybit-live 완전 통합 컨텍스트 노트

## 왜 통합하나
봇 2개(bybit-live=bybit_trader.cjs, signal-bot=v600_live_bot.cjs)가 같은 IP에서
각자 매분 Bybit를 호출 → retCode:10006 레이트 리밋. 하나로 합치면 API 호출 절반.
signal-bot은 이미 bybit-live와 동일 signal_logic을 쓰므로 신호는 동일하다.

## signal-bot이 실제로 하던 일 (원본 v600 분석)
- 매분(:30 오프셋) m5/h1/d1 fetch → signal_logic.
- 신호 '변화' 시: traderStatus===IDLE일 때만 알림(비IDLE이면 SKIP, 트레이더 알림과 중복 방지).
  - non-hold: 🚀 신호 발생! (TP/SL/WHAT-IF) 또는 🚫 WHAT-IF 차단
  - hold 전환: 💤 신호 종료! (가상 ROE 계산 포함)
- 12시간마다 📡 Summary(현재가·신호).
→ 즉 signal-bot은 IDLE에서만 신호발생 알림. 이건 bybit-live의 handleEntry 진입알림과 겹친다.
  bybit-live에 이미 있는 것: 진입 🚀신호발생, 🚫차단, 💤HOLD종료(단순), 시간별 하트비트.

## 통합 설계 (거래 로직 불변, 알림만 추가)
중복을 피하려고 **역할을 분담**한다.
- **IDLE + 신호**: 기존 handleEntry 진입 알림이 담당(그대로 둠).
- **비IDLE(포지션 보유) + 신규 신호**: 새 모니터가 "🚀 신호 발생!(관망)" 정보 알림 → signal-bot엔 없던 강화(사용자 요청).
- **신호→HOLD 전환**: 새 모니터가 "💤 신호 종료!(가상 ROE)"로 통일 → 기존 단순 HOLD 메시지(1개) 대체.
- **하트비트**: 기존 시간별 하트비트에 '현재 신호' 한 줄 추가(Summary 가시성 흡수).

구현.
- 모듈 레벨 상태: lastMonitorSig, lastMonitorEntryPrice, lastMonitorEntryTime.
- checkMarkets에서 RESCUE 후·IDLE분기 전에 currentSig 1회 계산(IDLE분기서 재사용).
- checkSignalTransition(currentSig, status, price, ...) 헬퍼가 위 분담대로 알림.
- 거래·주문·상태 코드는 일절 변경하지 않는다.

## 검증 한계
에이전트는 오라클/텔레그램 실전송을 테스트 불가. 문법 체크(node --check)만 로컬 수행.
사용자가 배포 후 실제 알림으로 검증. 푸시 전 diff 확인 필수.

## 배포
git push → 오라클 git pull → `pm2 delete signal-bot` → `pm2 restart bybit-live --update-env`.
signal-bot 프로세스 제거로 API 호출 절반.
