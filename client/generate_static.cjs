const fs = require('fs');
const cssPath = '/Users/anm/Desktop/absensi-lt-mtsn1/client/dist/assets/';
const files = fs.readdirSync(cssPath);
const cssFile = files.find(f => f.endsWith('.css'));
const cssContent = fs.readFileSync(cssPath + cssFile, 'utf8');

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Absensi LT - Salinan Statis</title>
  <style>
    ${cssContent}
  </style>
</head>
<body>
  <div id="root">
    <div style="display: flex; height: 100vh; align-items: center; justify-content: center; background: var(--bg-main, #f8fafc); color: var(--text-main, #1e293b); font-family: system-ui, sans-serif;">
      <div style="text-align: center; background: var(--card-bg, #ffffff); padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 400px;">
        <h2>Absensi LT (Salinan Statis)</h2>
        <p style="margin: 16px 0; color: var(--text-muted, #64748b);">Halaman statis berhasil disalin dengan CSS asli.</p>
        <a href="/login.html" class="btn" style="display:inline-block; background: var(--accent-brand, #16a34a); color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Masuk ke Aplikasi</a>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.mkdirSync('/Users/anm/Desktop/absensi-lt-static', { recursive: true });
fs.writeFileSync('/Users/anm/Desktop/absensi-lt-static/index.html', htmlContent);
console.log('SUCCESS: Static HTML generated at /Users/anm/Desktop/absensi-lt-static/index.html');
