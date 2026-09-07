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
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-row">
            <div class="sidebar-brand">
              <h2>Absensi LT</h2>
            </div>
          </div>
          <div class="sidebar-header-meta">
            <span class="sidebar-header-sub">Salinan Statis HTML/CSS</span>
            <span class="sidebar-header-user">Mode Offline / Preview</span>
          </div>
        </div>
        <nav class="sidebar-menu">
          <span class="sidebar-section-label">Menu Utama</span>
          <a href="#" class="active">Dashboard</a>
          <a href="#">Absensi</a>
          <a href="#">Histori</a>
          <a href="#">Jadwal</a>
          <a href="#">Profil</a>
        </nav>
      </aside>
      <main class="main-content">
        <div class="topbar">
          <div class="topbar-date">Rabu, 3 September 2026</div>
          <div class="topbar-user">
            <div class="user-avatar">AD</div>
            <div class="sidebar-user-info">
              <span class="topbar-user-name">Administrator</span>
              <span class="topbar-user-role">Panel Statis</span>
            </div>
          </div>
        </div>
        <div class="dashboard-container" style="padding: 24px;">
          <div class="card" style="padding: 24px; background: var(--card-bg, #fff); border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h2>Salinan Statis HTML & CSS Berhasil Dibuat</h2>
            <p style="margin: 12px 0; color: var(--text-muted, #64748b);">Semua lembar gaya (CSS) disalin langsung dari hasil build produksi Vite dengan struktur layout yang identik.</p>
            <div style="margin-top: 20px; display: flex; gap: 12px;">
              <a href="http://localhost:5001" target="_blank" class="btn" style="background: var(--accent-brand, #16a34a); color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Buka Aplikasi Live (:5001)</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('/Users/anm/Desktop/absensi-lt-static/dashboard.html', htmlContent);
console.log('SUCCESS: dashboard.html generated');
