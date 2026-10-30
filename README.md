# storyme · T09 나를 말하는 에이전트

53일 동안 남긴 아침·마무리 리추얼 기록만을 근거로 권주회의 강점과 이야기를 찾는 에이전트입니다.
ALEPH 과제 9의 산출물(서사 문서, 강점 지도, 고비 이야기, 자기소개서 초안, 포트폴리오 뼈대)을 한 페이지에 모으고,
기록에 직접 질문할 수 있는 에이전트를 붙였습니다.

- 공개 페이지: https://storyme-t09.vercel.app
- 제출용 서사 문서: [docs/T09-narrative.md](docs/T09-narrative.md) (페이지에서도 내려받기 가능)

## 구조

```
dist/                  배포되는 정적 페이지 (Vercel outputDirectory)
  index.html, app.js, styles.css
  agent/core.js        에이전트 핵심 — 규칙 5개, 강점 집계, 기록 검색, 답변. 프레임워크 무관 ES 모듈
  data/records.json    공개용으로 정제한 리추얼 기록
  data/story.json      서사 문서의 원본 데이터(강점 지도·초안·제출 점검)
  T09-narrative.md     story.json에서 생성한 서사 문서 사본
api/ask.js             선택 기능 — ANTHROPIC_API_KEY가 있을 때만 켜지는 AI 답변 모드
scripts/
  build-records.mjs    리추얼 JSON → records.json (허용 목록 방식으로 칸을 거름)
  build-doc.mjs        story.json → docs/T09-narrative.md
  agent-check.mjs      에이전트 답변 검사 7개
  privacy-check.mjs    공개 파일의 개인정보·비밀값 검사
  dev-server.mjs       로컬 확인용 서버(정적 + /api/ask)
```

## 기록 갱신

```bash
# 9번 과제 화면의 'JSON으로 담기'로 받은 파일을 private/ 에 둔다(커밋되지 않음)
node scripts/build-records.mjs private/ritual-history-YYYY-MM-DD.json
node scripts/build-doc.mjs
npm run check
```

## 실행

별도 설치 없이 `npm run dev` → http://localhost:4190

## 두 가지 답변 모드

| 모드 | 조건 | 동작 |
|---|---|---|
| 기록 검색 | 기본 | `agent/core.js`가 기록에서 날짜 붙은 원문을 찾아 답한다. 외부 호출 없음 |
| AI | Vercel에 `ANTHROPIC_API_KEY` 설정 | 규칙 5개를 시스템 프롬프트로, 검색한 기록만 근거로 넘겨 답한다. 근거 원문은 같이 표시 |

## 공개 범위

- 원본 리추얼 파일은 저장소에 올리지 않는다(`private/`는 .gitignore).
- 공개 기록에는 "나"에 관한 칸만 남긴다. 내가 동료에게 말한 장점, 동료가 쓴 감사, 호흡 시간은 제외한다.
- 동료 이름은 내보내기 단계에서 가려져 있다. `npm run check`가 남은 칸·비밀값 패턴·이름 형태를 다시 검사한다.

## introme에 붙일 때

`dist/agent/core.js`와 `dist/data/*.json`만 옮기면 된다. `answer(records, story, q)`가 `{mode, answer, citations}`를 돌려준다.
introme의 CSP(`script-src 'self'; connect-src 'self'`)를 그대로 지키도록 외부 요청 없이 작성했다.

## 기록

- [개발 규칙](CONTRIBUTING.md)
- 과제 진행 기록은 Notion Aleph_work의 T09 페이지에 남긴다.
