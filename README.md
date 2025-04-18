## Flowmap custom visual for PowerBI

* Please find the plugin files in the **dist** folder.
* Please find the source code in the **code** folder.
    * `npm run start` to activate the custom visual.
* Need more info/help? Please visit [here](https://weiweicui.github.io/PowerBI-Flowmap).


# Power BI Flowmap - Azure Maps Migration README

## ✨ 프로젝트 개요
Bing Maps 기반의 Power BI Flowmap Custom Visual을 **Azure Maps 기반으로 마이그레이션**하는 작업을 진행 중입니다.

- 기존 프로젝트: `PowerBI-Flowmap`
- 대상 파일: `src/flowmap/visual.ts`
- 주요 리팩토링 경로: `src/lava/bingmap/* ➔ src/lava/azuremap/*`
- 상태: **`visual.ts` 파일 최종 수정 및 테스트 완료 직전**

---

## 🎓 주요 수정 사항

### ✏️ 마이그레이션
- `Bing Maps` 관련 의존성 제거: `@types/bingmaps`, `Microsoft.Maps.*` 코드
- `Azure Maps` 모듈 생성:
  - `azuremap/controller.ts`
  - `azuremap/converter.ts`
  - `azuremap/geoQuery.ts`
  - `azuremap/mapFormat.ts`

### 🔧 app.ts 수정
- `tooltipForPath`, `reset`, `repaint` 등에서 `Config<F>` 제네릭 사용 오류 수정
- `groupBy`, `key2rows` 로직 새롭게 정의
- `ctx.config` → `cfg.context` 등 참조 방식 수정

### 🗂 flow.ts, pie.ts, pins.ts 수정
- `events.hover?.(rows)` 등 옵셔널 체이닝 에러 수정 (구형 `ts-loader` 대응)
- `mapctl.pixel()`, `mapctl.location()` 등 Azure Maps 호환화

---

## 📦 빌드 및 테스트

### ✈️ 빌드 도구
- `pbiviz` 버전: 5.6.0
- `typescript`: 4.9.5
- `ts-loader`: 9.4.4 (**v6.x 제거**) 

### ⚡ package.json 핵심
```json
"powerbi-visuals-api": "~5.6.0",
"typescript": "4.9.5",
"ts-loader": "^9.4.4",
"webpack": "^5.x",
```

### tsconfig.json 핵심
```json
"compilerOptions": {
  "target": "es2019",
  "lib": ["es2019", "dom"],
  "skipLibCheck": true
},
"files": ["src/flowmap/visual.ts"]
```

### 🧾 명령어
```bash
# 로컬 테스트 (Report Server는 개발자 모드 미지원)
pbiviz package

# 결과: ./dist/visual.pbiviz
# Power BI Desktop RS 에\uuc11c 복통해 실행 가능
```

---

## 📅 다음 작업 예정
- [ ] Power BI RS에서 `visual.pbiviz` 직접 임포트 후 결과 확인
- [ ] 배포 전 “Format Pane” 등 경고 사항 검토 (권장 사항)
- [ ] GitHub 커밋 정리 및 release tag 생성 예정

---

## 🔹 참고 커맨드
```bash
# npm 충돌 발생 시
npm install --legacy-peer-deps

# webpack 관련 에러 시
npm install webpack webpack-cli --save-dev --legacy-peer-deps

# ts-loader 업그레이드
npm install ts-loader@9.4.4 --save-dev --legacy-peer-deps
```

---

## ✨ Special Notes
- `geoQuery.ts` / `controller.ts` 내 `AZURE_MAPS_KEY`는 `config.ts`에서 별도 관리
- tsconfig에서 `files` 항목은 `visual.ts`만 빌드 대상으로 설정함

---

## 📑 변경 히스토리 (간략)
- `2025-04-17`: Azure Maps 마이그레이션 본격 시작
- `2025-04-18`: visual.ts 수정 및 pbiviz package 성공

---
 