# 자동화 오피스

pixel-agents를 화면으로 쓰고, 프로젝트마다 사무실 방을 하나씩 두는 구성이다.
각 프로젝트는 별도 저장소이고, 그 폴더에서 실행한 Claude Code 에이전트가 해당 방의 자리에 앉아 일한다.

| 방 | 저장소 | 하는 일 |
|---|---|---|
| 모니터링 | `j2013dh-bit/monitor` | 매니저(T/O 8, 활동 5) 5개 채널 데일리 체크: 게시 수·가이드 준용·요약 |
| 신규영업 분석 | `j2013dh-bit/company-analysis` | 업체 분석 → 영업 브리프 (기본정보·재무·업황·차량 수요·문의처·전략) |
| 플레이스 마케팅 | `j2013dh-bit/place-marketing` | 장기전문지점 블로그·인스타 데일리 콘텐츠 → 네이버플레이스 유입 |

## 설정 (한 번)

```bash
# pixel-agents(VS Code 패널, npx pixel-agents)를 닫은 상태에서
node office/setup-office.mjs            # 프로젝트를 ~/agent-office/ 에 clone + Directory/방 등록
```

1. pixel-agents를 열고 **Layout → Areas** 도구로 방마다 책상·의자가 있는 구역을 칠한 뒤 Save.
2. **+** 버튼에서 Directory(예: "신규영업 분석")를 골라 에이전트를 실행하면 그 방에 앉는다.
3. 에이전트에게 일을 시킨다. 예: `/analyze-company 가나제약`

`layout.json`이 아직 없다는 메시지가 나오면 오피스를 한 번 열어 저장한 뒤 스크립트를 다시 실행한다.

## 프로젝트 추가

1. 새 저장소를 만들고 `CLAUDE.md`(역할·규칙)와 `.claude/skills/<작업>/SKILL.md`(작업 절차)를 둔다.
2. `office/projects.json`에 한 줄 추가 (`name`, `repo`, `folder`, `area`, `color`).
3. `node office/setup-office.mjs` 재실행 → 새 방에 구역을 칠한다.

여러 번 실행해도 안전하다. 바뀐 내용이 있을 때만 `~/.pixel-agents/config.json`, `layout.json`을 쓰고, 쓰기 전에 `*.bak-<시각>`으로 백업한다.
이미 clone된 폴더는 건드리지 않는다.
