# 권한별 화면 접근 매트릭스(권장)

표기:
- **R**: 조회
- **W**: 작성/수정
- **D**: 삭제
- **A**: 승인/반려(Review)
- **P**: 배포(Deploy)

## 1) 프로젝트 단위
| 화면 | Owner | Admin | Editor | Author | Reviewer | Viewer |
|---|---|---|---|---|---|---|
| `/studio/projects` (프로젝트 리스트) | R/W/D | R/W | R | R | R | R |
| `/studio/projects/[projectId]` (프로젝트 홈) | R/W | R/W | R | R | R | R |
| `/studio/projects/[projectId]/cast` | R/W/D | R/W/D | R/W | R/W | R/A | R |
| `/studio/projects/[projectId]/scenes` | R/W/D | R/W/D | R/W | R/W | R/A | R |
| `/studio/projects/[projectId]/lorebook` (전역) | R/W/D | R/W/D | R/W | R/W | R/A | R |
| `/studio/projects/[projectId]/rules` (전역) | R/W/D | R/W/D | R/W | R/W | R/A | R |
| `/studio/projects/[projectId]/simulator` | R/W | R/W | R/W | R/W | R/W | R |

## 2) 캐릭터 단위
| 화면 | Owner | Admin | Editor | Author | Reviewer | Viewer |
|---|---|---|---|---|---|---|
| `/studio/projects/[projectId]/cast/[characterId]/prompt` | R/W/D | R/W/D | R/W | R/W | R/A | R |
| `/studio/projects/[projectId]/cast/[characterId]/triggers` | R/W/D | R/W/D | R/W | R/W | R/A | R |

## 3) 씬 단위
| 화면 | Owner | Admin | Editor | Author | Reviewer | Viewer |
|---|---|---|---|---|---|---|
| `/studio/projects/[projectId]/scenes/[sceneId]` | R/W/D | R/W/D | R/W | R/W | R/A | R |

## 4) 승인/배포 권장 분리(정책)
권장 정책 예시:
- Reviewer는 **A(승인/반려)** 가능, P(배포)는 불가
- Admin/Owner는 **P(배포)** 가능

대안 정책:
- Reviewer가 승인과 배포까지 수행(P 포함)

