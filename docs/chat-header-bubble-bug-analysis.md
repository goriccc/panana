# 채팅 헤더/말풍선 버그 분석 (코드베이스 기준)

## 현상
- 글 입력 시 이전 버튼·캐릭터 이름이 있는 **헤더가 사라짐**
- **내 말풍선이 스크린 위쪽 바깥**에 있어서 스크롤을 내려야 보임

---

## 1. 구조 (일반 대화 `src/app/c/[slug]/chat/ui.tsx`)

- **chatContainerRef**: `className="fixed inset-0 flex flex-col overflow-hidden"` 인 div.
- **useEffect**에서 이 div에 다음을 **인라인으로 덮어씀**:
  - `position: fixed`, `top: vv.offsetTop`(또는 0), `left`, `width: vv.width`, `height: vv.height`
- 자식 순서: **header** (shrink-0) → (온보딩) → **main** (scrollRef, flex-1, overflow-y-auto) → **composer** (별도 div, `fixed left-0 right-0 bottom-0`).
- **스크롤**은 `scrollRef.current`(main) 한 곳에서만 수행: `scrollTop = scrollRef.current.scrollHeight`, `endRef.scrollIntoView({ block: "end" })`.
- **endRef**는 메시지 목록 끝의 빈 div.

---

## 2. 헤더가 사라지는 이유 (코드 + 알려진 Safari 동작)

- 컨테이너 위치/크기는 **전적으로** `visualViewport`(vv)의 `offsetTop`, `offsetLeft`, `width`, `height`에 의존함.
- Safari 버그: 키보드가 열렸을 때 **`visualViewport.offsetTop`이 0으로 잘못 보고**되는 경우가 있음.
- 이때 코드는 `top = Math.max(0, offsetTop) = 0`, `height = vv.height`로 설정.
- 실제 사용자가 보는 영역(visual viewport)이 스크롤 등으로 **위쪽이 0이 아닌** 상태면, "보이는 영역"은 화면 중·하단이고, 컨테이너는 `top: 0`으로 **레이아웃 뷰포트 맨 위**에 붙음.
- 따라서 **컨테이너 상단(헤더)이 보이는 영역 밖 위**로 나가서, 헤더가 사라진 것처럼 보임.

**결론**: Visual Viewport로 채팅 컨테이너 전체의 위치/크기를 덮어쓰는 것이, Safari의 잘못된 `offsetTop`과 결합해 헤더가 보이지 않게 만드는 **직접 원인**으로 볼 수 있음.

---

## 3. 말풍선이 위쪽 바깥에 있어 스크롤을 내려야 보이는 이유

- 새 메시지 추가 시 `useEffect([messages.length, showTyping])`에서 `scrollTop = scrollRef.current.scrollHeight` 실행.
- 이 effect는 **React가 DOM을 갱신한 직후**에 돌지만, **레이아웃(reflow)은 그 다음 프레임**에 일어남.
- 따라서 실행 시점의 `scrollHeight`는 **아직 새 메시지가 반영되기 전 값**일 수 있음.
- 그 상태에서 `scrollTop = scrollHeight`로 맞추면, 레이아웃이 끝난 뒤에는 **scrollHeight가 더 커진** 상태가 되고, 결과적으로 **스크롤이 한 칸 위**에 머무름 → 방금 보낸 말풍선이 뷰포트 **위쪽 바깥**에 있게 됨.

**결론**: "메시지 추가 직후 한 번만" 스크롤하는 방식은 **레이아웃 완료 시점**과 맞지 않아, 말풍선이 위로 나가 보이는 현상의 원인이 됨.

---

## 4. 수정 방향 (코드베이스 + 알려진 이슈에만 기반)

1. **헤더 사라짐**
   - **Visual Viewport로 chatContainerRef의 position/top/left/width/height를 덮어쓰는 로직 제거.**
   - 컨테이너는 `fixed inset-0`만 유지.
   - → 헤더는 항상 레이아웃 뷰포트 상단에 고정되고, Safari의 `offsetTop` 버그와 무관해짐.

2. **말풍선 가시성**
   - **스크롤을 "레이아웃이 끝난 뒤"에 한 번 더 맞추기**: `scrollRef`(main)에 **MutationObserver**를 걸고, 자식이 추가될 때(`childList: true`, `subtree: true`) **isAtBottomRef.current === true**인 경우에만 이중 rAF 후 `scrollTop = scrollHeight` 및 `endRef.scrollIntoView({ block: "end" })` 실행.
   - (ResizeObserver는 overflow 컨테이너 내부 콘텐츠 증가 시 호출되지 않으므로 사용하지 않음.)
   - → 새 메시지가 DOM에 반영된 뒤 레이아웃이 끝난 시점에 맨 아래로 스크롤되므로, 말풍선이 위로 나가 보이는 현상을 방지할 수 있음.
