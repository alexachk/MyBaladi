/** Inline Leaflet map for WebView — tap/drag pin, posts coords to RN. */
export function buildMapPinPickerHtml(initialLat: number, initialLng: number, zoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .leaflet-container { background: #eef1f4; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${initialLat}, ${initialLng}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const marker = L.marker([${initialLat}, ${initialLng}], { draggable: true }).addTo(map);

    function postPin(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pinMoved',
          latitude: lat,
          longitude: lng
        }));
      }
    }

    marker.on('dragend', function () {
      const p = marker.getLatLng();
      postPin(p.lat, p.lng);
    });

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      postPin(e.latlng.lat, e.latlng.lng);
    });

    function setMapPin(lat, lng, zoom) {
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], zoom || 16);
      postPin(lat, lng);
    }
    window.setMapPin = setMapPin;

    function handleMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'setPin') {
          setMapPin(Number(msg.latitude), Number(msg.longitude), Number(msg.zoom || 16));
        }
      } catch (e) {}
    }

    document.addEventListener('message', function (event) { handleMessage(event.data); });
    window.addEventListener('message', function (event) { handleMessage(event.data); });

    postPin(${initialLat}, ${initialLng});
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  </script>
</body>
</html>`;
}
