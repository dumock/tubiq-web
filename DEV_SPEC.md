TubiQ-Web 개발서 (DEV_SPEC v1)
0. 목적

Next.js(App Router) + Tailwind 기반 웹 대시보드 UI를 일관된 디자인/구조로 빠르게 확장한다.

초기 단계는 UI만 구현하고, 데이터는 mock로 처리한다.

뷰트랩(기존 서비스) 캡쳐를 참고하되, 픽셀 완전 동일보다 일관된 시스템을 우선한다.

1) 기술 스택 고정

Framework: Next.js (App Router)

Styling: Tailwind CSS

Charts: Recharts

Icon: lucide-react

상태 관리: 초기엔 local state만, 필요 시 추후 zustand 검토

데이터: /src/mock/의 mock 데이터 사용 (API 연결 전까지)

2) 폴더/파일 구조 규칙 (고정)

프로젝트 루트는 소문자 하이픈: tubiq-web

/app
  /page.tsx            // 페이지 조립만 (레이아웃 배치)
  /layout.tsx          // 전역 레이아웃
/src
  /components
    Header.tsx
    FilterBar.tsx
    ChannelTable.tsx
    GrowthChart.tsx
    ui/                // 재사용 UI(버튼, 배지, 카드 등) 필요시
  /mock
    channels.ts
    growth.ts
  /lib
    format.ts          // 숫자 포맷/유틸
    cn.ts              // className 병합(필요시)
  /styles
    globals.css

파일 네이밍

컴포넌트: PascalCase (Header.tsx)

유틸: camelCase (format.ts)

mock 데이터: 복수형 소문자 (channels.ts)

3) 컴포넌트 역할 규칙 (중요)
3.1 Page는 “조립만”

app/page.tsx에서는 레이아웃 배치만 한다.

데이터 처리/로직은 최대한 컴포넌트 내부 또는 /src/mock에서.

3.2 컴포넌트는 “단일 책임”

Header: 상단 네비/검색/아이콘 영역

FilterBar: 필터/정렬/기간/내보내기 등 컨트롤 영역

GrowthChart: 그래프 카드(타이틀, 수치 뱃지 포함)

ChannelTable: 테이블(행/컬럼/상태뱃지/페이지네이션)

4) 디자인 시스템 (일관성 규칙)
4.1 레이아웃

전체 폭: max-w-7xl 기준

좌우 패딩: px-6 (모바일은 px-4)

섹션 간격: space-y-6

카드 패딩: p-6

4.2 카드 스타일

배경: bg-white

테두리: border border-gray-200

라운드: rounded-2xl

그림자: shadow-sm

4.3 텍스트 규칙

페이지 주요 타이틀: text-lg font-semibold

섹션 타이틀: text-base font-semibold

설명 텍스트: text-sm text-gray-500

본문: text-sm text-gray-900

4.4 버튼 규칙

기본 버튼: 흰색 + 테두리

주요 액션(예: 내보내기): 검정 바탕 bg-black text-white

버튼 높이: h-10 고정

아이콘 버튼: h-10 w-10 원형 또는 라운드

4.5 배지/상태 (통일)

Growing: 초록 계열

Stable: 파랑 계열

Active: 회색 계열

증감률:

상승: 초록 텍스트 + 화살표 up

하락: 빨강 텍스트 + 화살표 down

5) 데이터/포맷 규칙

숫자 표기:

구독자/조회수: 1.2M, 850K 형태 허용

퍼센트: +12.5%, -2.1%

날짜: YYYY. MM. DD 또는 YYYY-MM-DD 둘 중 하나로 고정 (현재 UI는 YYYY. MM. DD 추천)

/src/lib/format.ts에 아래 유틸을 만든다(혹은 이미 있으면 그거 사용):

formatCompactNumber(n)

formatPercent(n)

formatDate(d)

6) 상태/인터랙션 규칙 (UI만)

필터 변경 시: 실제 데이터 필터링은 일단 mock에서 “겉으로만” 동작하거나, 최소한 selected 상태 표시

검색: 입력 상태만 관리, 엔터/버튼 클릭 시 콘솔 로그 또는 mock 필터 적용

내보내기: 일단 버튼 클릭 시 toast/alert 대신 console.log("export")

7) 반응형 원칙 (데스크탑 우선)

Desktop 기준 먼저 맞추고,

Mobile에서는:

네비 메뉴 일부 숨김(md:flex, hidden md:flex)

테이블은 가로 스크롤 허용(overflow-x-auto)

필터바는 줄바꿈 허용(flex-wrap)

8) 작업 절차 (AI에게 시키는 방식)
8.1 변경 단위

한 번 요청에 한 컴포넌트 또는 한 화면 섹션만 변경

“전체 코드 다 뜯기” 금지 (일관성 깨짐)

8.2 요청할 때 반드시 포함할 것

바꾸고 싶은 화면 위치 (예: FilterBar 오른쪽)

추가/삭제 요소 목록

뷰트랩 캡쳐 기준이면 “어떤 부분을 닮게” 할지

DEV_SPEC 준수 문구

9) AI 명령 템플릿 (복붙용)
템플릿 A: UI 수정
DEV_SPEC 기준으로 진행.
대상 파일: /src/components/FilterBar.tsx

요구사항:
- (1) 오른쪽에 "영상 수집" 버튼 추가 (h-10, bg-black)
- (2) 기간 선택은 그대로 유지
- (3) 모바일에서는 버튼이 아래로 내려가도 됨

완료 조건:
- npm run dev에서 에러 없이 렌더링
- 스타일은 DEV_SPEC의 버튼/간격 규칙 준수

템플릿 B: 새 컴포넌트 추가
DEV_SPEC 기준으로 진행.
새 컴포넌트: /src/components/ActionBar.tsx 생성
page.tsx에 Header 아래로 배치.

구성:
- 좌측: 검색 입력 + "보관함 1회 검색" 버튼
- 우측: "영상 수집", "연관 채널 수집", "영상 삭제" 버튼 그룹

제약:
- 기능은 mock(클릭 시 console.log)
- 디자인은 DEV_SPEC 카드/버튼 규칙 유지

템플릿 C: 테이블 컬럼 변경
DEV_SPEC 기준으로 진행.
대상: /src/components/ChannelTable.tsx

컬럼을 아래로 변경:
- 선택 체크박스
- 썸네일
- 제목
- 조회수
- 구독자
- 기여도(텍스트)
- 상태(배지)
- 게시일

완료 조건:
- 테이블 overflow-x-auto 적용
- 배지 색/라벨 DEV_SPEC 준수

10) 금지 사항 (일관성 깨짐 방지)

임의로 폰트/색/간격을 컴포넌트마다 다르게 쓰지 말 것

page.tsx에 로직을 넣지 말 것

파일/폴더 대소문자 섞지 말 것 (특히 import 경로)

한 번에 여러 컴포넌트를 “대규모 리팩터링”하지 말 것

END