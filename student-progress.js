(function() {
  if (document.querySelector('.spt-overlay')) { document.querySelector('.spt-overlay').remove(); }
  if (!location.hostname.includes('payhip.com')) { alert('Open payhip.com first, then click the bookmarklet.'); return; }
  var style = document.createElement('style');
  style.textContent = '.spt-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.spt-modal{background:#1a1a1a;border:1px solid #333;border-radius:16px;width:90vw;max-width:800px;max-height:85vh;overflow:auto;padding:32px;color:#e0e0e0;box-shadow:0 20px 60px rgba(0,0,0,.5)}.spt-modal h2{font-size:22px;color:#fff;margin-bottom:4px}.spt-meta{color:#888;font-size:13px;margin-bottom:20px}.spt-table{width:100%;border-collapse:collapse;font-size:14px}.spt-table th{text-align:left;padding:10px 12px;border-bottom:2px solid #333;color:#888;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.5px}.spt-table td{padding:10px 12px;border-bottom:1px solid #222}.spt-table tr:hover td{background:#222}.spt-name{color:#fff;font-weight:500}.spt-email{color:#666;font-size:12px}.spt-bar-bg{background:#222;border-radius:100px;height:8px;width:120px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:8px}.spt-bar{height:100%;border-radius:100px}.spt-pct{font-weight:600;font-size:13px}.spt-status{display:inline-block;padding:2px 8px;border-radius:100px;font-size:12px;font-weight:500}.spt-close{position:absolute;top:16px;right:20px;background:none;border:none;color:#666;font-size:24px;cursor:pointer;line-height:1}.spt-close:hover{color:#fff}.spt-loading{text-align:center;padding:40px;color:#888}.spt-loading .spin{display:inline-block;width:32px;height:32px;border:3px solid #333;border-top-color:#2563eb;border-radius:50%;animation:spt-spin 1s linear infinite}@keyframes spt-spin{to{transform:rotate(360deg)}}.spt-summary{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}.spt-card{background:#222;border-radius:10px;padding:14px 18px;flex:1;min-width:120px}.spt-card .num{font-size:24px;font-weight:700;color:#fff}.spt-card .label{font-size:12px;color:#888;margin-top:2px}.spt-alert{background:#422;border:1px solid #633;border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#f99}';
  document.head.appendChild(style);
  var overlay = document.createElement('div');
  overlay.className = 'spt-overlay';
  overlay.innerHTML = '<div class="spt-modal" style="position:relative"><button class="spt-close" id="spt-close-btn">&times;</button><div class="spt-loading"><div class="spin"></div><p style="margin-top:16px">Loading students...</p><p class="spt-progress-text" style="margin-top:8px;font-size:12px"></p></div></div>';
  document.body.appendChild(overlay);
  document.getElementById('spt-close-btn').onclick = function() { overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var seen = {};
  var students = [];
  var page = 1;
  function updateStatus(text) { var el = overlay.querySelector('.spt-progress-text'); if (el) el.textContent = text; }
  function fetchPage() {
    var url = '/students' + (page > 1 ? '?page=' + page : '');
    fetch(url).then(function(r) { return r.text(); }).then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var rows = doc.querySelectorAll('.js-student-row');
      var newCount = 0;
      rows.forEach(function(row) {
        var link = row.querySelector('a[href*="student-details"]');
        if (!link) return;
        var href = link.getAttribute('href');
        var id = href.split('/student-details/')[1].split('?')[0];
        if (seen[id]) return;
        seen[id] = true;
        newCount++;
        var h3 = row.querySelector('h3.author-name') || row.querySelector('h3');
        var fullText = h3 ? h3.textContent.trim() : '';
        var nameMatch = fullText.match(/^(.+?)\s*\(/);
        var emailMatch = fullText.match(/\(([^)]+)\)/);
        var lastLogin = '';
        var ps = row.querySelectorAll('p');
        ps.forEach(function(p) { var m = p.textContent.match(/Last login:\s*(.+)/); if (m) lastLogin = m[1].trim(); });
        students.push({ id: id, name: nameMatch ? nameMatch[1].trim() : fullText, email: emailMatch ? emailMatch[1] : '', lastLogin: lastLogin, progress: null, status: '' });
      });
      updateStatus('Found ' + students.length + ' students...');
      if (newCount > 0 && page < 20) { page++; fetchPage(); } else { fetchProgress(0); }
    }).catch(function() { fetchProgress(0); });
  }
  function fetchProgress(i) {
    if (i >= students.length) { renderResults(); return; }
    updateStatus('Progress: ' + (i + 1) + '/' + students.length + '...');
    fetch('/student-details/' + students[i].id + '?tab=enrollments').then(function(r) { return r.text(); }).then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var rows = doc.querySelectorAll('.js-general-row');
      rows.forEach(function(row) { var cols = row.querySelectorAll('.col-md-2'); if (cols.length >= 2) { students[i].progress = parseInt(cols[0].textContent.trim()) || 0; var badge = cols[1].querySelector('.badge'); students[i].status = badge ? badge.textContent.trim() : 'Unknown'; } });
      fetchProgress(i + 1);
    }).catch(function() { students[i].progress = 0; students[i].status = 'Error'; fetchProgress(i + 1); });
  }
  function renderResults() {
    students.sort(function(a, b) { return (b.progress || 0) - (a.progress || 0); });
    var total = students.length;
    var active = students.filter(function(s) { return s.progress > 0; }).length;
    var avg = total > 0 ? Math.round(students.reduce(function(sum, s) { return sum + (s.progress || 0); }, 0) / total) : 0;
    var max = 0;
    students.forEach(function(s) { if ((s.progress || 0) > max) max = s.progress || 0; });
    var modal = overlay.querySelector('.spt-modal');
    var alertHTML = '';
    if (max >= 60) { alertHTML = '<div class="spt-alert">Max progress ' + max + '% — students approaching the last available lesson!</div>'; }
    var h = '<button class="spt-close" onclick="this.closest(\'.spt-overlay\').remove()">&times;</button>';
    h += '<h2>Student Progress Report</h2>';
    h += '<p class="spt-meta">' + new Date().toLocaleDateString('en-US', {day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'}) + '</p>';
    h += '<div class="spt-summary"><div class="spt-card"><div class="num">' + total + '</div><div class="label">Total students</div></div><div class="spt-card"><div class="num">' + active + '</div><div class="label">Started learning</div></div><div class="spt-card"><div class="num">' + avg + '%</div><div class="label">Avg progress</div></div><div class="spt-card"><div class="num">' + max + '%</div><div class="label">Max progress</div></div></div>';
    h += alertHTML;
    h += '<table class="spt-table"><thead><tr><th>Student</th><th>Progress</th><th>Status</th><th>Last login</th></tr></thead><tbody>';
    students.forEach(function(s) {
      var p = s.progress || 0;
      var c = p === 0 ? '#444' : p < 30 ? '#2563eb' : p < 70 ? '#eab308' : '#22c55e';
      var sc = s.status === 'Enrolled' ? 'color:#166534;background:#052e16' : 'color:#666;background:#222';
      h += '<tr><td><div class="spt-name">' + s.name + '</div><div class="spt-email">' + s.email + '</div></td>';
      h += '<td><div class="spt-bar-bg"><div class="spt-bar" style="width:' + p + '%;background:' + c + '"></div></div><span class="spt-pct" style="color:' + c + '">' + p + '%</span></td>';
      h += '<td><span class="spt-status" style="' + sc + '">' + s.status + '</span></td>';
      h += '<td style="color:#888;font-size:13px">' + s.lastLogin + '</td></tr>';
    });
    h += '</tbody></table>';
    modal.innerHTML = h;
  }
  fetchPage();
})();
