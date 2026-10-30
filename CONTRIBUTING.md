# 개발과 커밋 규칙

introme와 같은 규칙을 따릅니다.

## 형식
`type(scope): 한국어 변경 요약`

- type: feat, fix, docs, style, refactor, test, chore
- scope: t09 또는 repo
- 하나의 커밋에는 하나의 설명 가능한 변경 목적을 담습니다.
- 본문: 변경 / 이유 / 검증을 기록합니다. 미검증 상태는 그대로 씁니다.
- push 전 `npm run check`로 개인정보·비밀값을 확인합니다. `.env`와 원본 리추얼 파일은 커밋하지 않습니다.
- 강제 push하지 않습니다.

## 로컬 규칙 적용
`git config core.hooksPath .githooks`
