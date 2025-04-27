__lavaBuildMap = null;
__geocode_jsonp0 = null;
__geocode_jsonp1 = null;
__geocode_jsonp2 = null;
__geocode_jsonp3 = null;
__geocode_jsonp4 = null;
__geocode_jsonp5 = null;
__geocode_jsonp6 = null;

// 🔽 Google Maps API 동적 로딩
(function loadGoogleMapsAPI() {
    fetch("config.js")
      .then((res) => res.text())
      .then((code) => {
        eval(code); // config.js에서 GOOGLE_MAPS_API_KEY 가져오기
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initFlowmap`;
        script.async = true;
        document.head.appendChild(script);
      });
  })();
  
  // Google Maps 로딩 완료 후 호출될 함수
  window.initFlowmap = function () {
    console.log("✅ Google Maps API 로딩 완료");
    window.__lavaBuildMap = google.maps;
  };