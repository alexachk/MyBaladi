/** Inline pdf.js viewer for WebView (recap + stored PDFs). */
export function buildPdfPreviewHtml(base64: string, title: string): string {
  const safeTitle = title.replace(/[<>&"']/g, '');
  const safeB64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
  <title>${safeTitle}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #525659; height: 100%; }
    #pages { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 12px 0 24px; }
    canvas { max-width: 100%; height: auto !important; box-shadow: 0 2px 8px rgba(0,0,0,.35); background: #fff; }
    #status { color: #eee; font: 14px system-ui, sans-serif; text-align: center; padding: 24px; }
    #err { color: #ffb4b4; }
  </style>
</head>
<body>
  <div id="status">Loading PDF…</div>
  <div id="pages"></div>
  <script>
    (function () {
      var b64 = '${safeB64}';
      var status = document.getElementById('status');
      var pages = document.getElementById('pages');
      function fail(msg) {
        status.innerHTML = '<span id="err">' + msg + '</span>';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
        }
      }
      if (!b64) { fail('Empty PDF data.'); return; }
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        var raw = atob(b64);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          status.style.display = 'none';
          var chain = Promise.resolve();
          for (var p = 1; p <= pdf.numPages; p++) {
            (function (pageNum) {
              chain = chain.then(function () {
                return pdf.getPage(pageNum).then(function (page) {
                  var viewport = page.getViewport({ scale: 1.5 });
                  var canvas = document.createElement('canvas');
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  pages.appendChild(canvas);
                  return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
                });
              });
            })(p);
          }
          return chain.then(function () {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready', pages: pdf.numPages }));
            }
          });
        }).catch(function (e) {
          fail(e && e.message ? e.message : 'Could not render PDF.');
        });
      } catch (e) {
        fail(e && e.message ? e.message : 'PDF viewer error.');
      }
    })();
  </script>
</body>
</html>`;
}
