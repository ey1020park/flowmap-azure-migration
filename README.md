## Flowmap custom visual for PowerBI

* Please find the plugin files in the **dist** folder.
* Please find the source code in the **code** folder.
    * `npm run start` to activate the custom visual.
* Need more info/help? Please visit [here](https://weiweicui.github.io/PowerBI-Flowmap).

##📖 Google Maps 기반 변환 작업 정리
📌 프로젝트 개요
원본: Bing Maps 기반 FlowMap Custom Visual

1차: Azure Maps로 변환 완료

최종: Google Maps 기반으로 재변환 시도

대상 플랫폼: Power BI Desktop (MSI) → Power BI Report Server

📂 브랜치 관리
master : Azure Maps 버전

googlemap : Google Maps 변환용 브랜치 (진행 중)

🛠️ 주요 변경 내역
1. Google Maps API 로딩 추가
visual.ts에 Google Maps API 동적 로딩 코드 삽입

function loadGoogleMaps() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${(window as any).GOOGLE_MAPS_API_KEY}&callback=initFlowmap`;
  script.async = true;
  window["initFlowmap"] = () => console.log("Google Maps API loaded");
  document.head.appendChild(script);
}
constructor에서 loadGoogleMaps() 호출

2. Azure Maps 의존 코드 제거
atlas.Map 타입 삭제

google.maps.Map 타입으로 변환하여 지도 조작

지도 이동 및 중심 좌표 설정:

setCenter

setZoom

getCenter

3. geoQuery.ts 수정
Azure Maps Search API → Google Maps Geocoding API로 전환

 
const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
Geocoding 결과를 파싱하여 latitude, longitude 추출

4. config.ts 삭제
API Key는 window.GOOGLE_MAPS_API_KEY를 통해 런타임에 주입

소스 코드에 하드코딩된 Key 제거

⚠️ 현재 확인된 한계

항목	상태
Power BI Online (app.powerbi.com)	❌ 외부 스크립트 로딩 차단 (CSP 위반)
Power BI Desktop (Store 버전)	❌ 외부 스크립트 로딩 차단
Power BI Desktop (MSI 버전)	🔄 개발자 모드 활성화 후 테스트 필요
Power BI Report Server	🔄 CSP 설정 변경 시 허용 가능성 있음
Power BI 환경은 기본적으로 외부 스크립트 삽입을 차단 (Content-Security-Policy 적용)

따라서 Google Maps 기반 시각화는 플랫폼에 따라 정상 동작 여부가 다를 수 있음

⚙️ 로컬 테스트 방법
pbiviz package 명령어로 .pbiviz 파일 생성

Power BI Desktop (MSI 설치 버전) 설치 및 개발자 모드 활성화

생성한 .pbiviz 파일을 임포트

window.GOOGLE_MAPS_API_KEY 값을 수동 주입 (또는 스크립트 삽입)

지도와 FlowMap 시각화가 정상적으로 동작하는지 확인

📋 요약
Google Maps 기반 변환 완료

Power BI CSP 정책에 따라 제한 가능성 존재

Report Server 배포 시 CSP 설정 변경 가능성 확인 필요

