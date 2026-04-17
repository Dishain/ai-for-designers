(function() {
  // Prevent double-run
  if (document.querySelector('.spt-overlay')) { document.querySelector('.spt-overlay').remove(); }

  // Check we're on Payhip
  if (!location.hostname.includes('payhip.com')) {
    alert('Open payhip.com first, then click the bookmarklet.');
    return;
  }

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '.spt-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif}',
    '.spt-modal{background:#1a1a1a;border:1px solid #333;border-radius:16px;width:90vw;max-width:900px;max-height:85vh;overflow:auto;padding:32px;color:#e0e0e0;box-shadow:0 20px 60px rgba(0,0,0,.5)}',
    '.spt-modal h2{font-size:22px;color:#fff;margin-bottom:4px}',
    '.spt-meta{color:#888;font-size:13px;margin-bottom:20px}',
    '.spt-table{width:100%;border-collapse:collapse;font-size:13px}',
    '.spt-table th{text-align:left;padding:10px 12px;border-bottom:2px solid #333;color:#888;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.5px}',
    '.spt-table td{padding:10px 12px;border-bottom:1px solid #222;vertical-align:top}',
    '.spt-table tr:hover td{background:#222}',
    '.spt-name{color:#fff;font-weight:500}',
    '.spt-email{color:#666;font-size:11px}',
    '.spt-bar-bg{background:#222;border-radius:100px;height:8px;width:100px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:6px}',
    '.spt-bar{height:100%;border-radius:100px}',
    '.spt-pct{font-weight:600;font-size:12px}',
    '.spt-lesson{font-size:12px;color:#ccc;margin-top:2px}',
    '.spt-lesson-done{color:#22c55e}',
    '.spt-lesson-next{color:#eab308}',
    '.spt-lesson-count{color:#888;font-size:11px}',
    '.spt-status{display:inline-block;padding:2px 8px;border-radius:100px;font-size:12px;font-weight:500}',
    '.spt-close{position:absolute;top:16px;right:20px;background:none;border:none;color:#666;font-size:24px;cursor:pointer;line-height:1}',
    '.spt-close:hover{color:#fff}',
    '.spt-loading{text-align:center;padding:40px;color:#888}',
    '.spt-loading .spin{display:inline-block;width:32px;height:32px;border:3px solid #333;border-top-color:#2563eb;border-radius:50%;animation:spt-spin 1s linear infinite}',
    '@keyframes spt-spin{to{transform:rotate(360deg)}}',
    '.spt-summary{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}',
    '.spt-card{background:#222;border-radius:10px;padding:14px 18px;flex:1;min-width:120px}',
    '.spt-card .num{font-size:24px;font-weight:700;color:#fff}',
    '.spt-card .label{font-size:12px;color:#888;margin-top:2px}',
    '.spt-alert{background:#422;border:1px solid #633;border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#f99}',
    '.spt-expand{cursor:pointer;color:#2563eb;font-size:11px;margin-top:4px;display:inline-block}',
    '.spt-expand:hover{color:#60a5fa}',
    '.spt-lessons-detail{display:none;margin-top:6px;padding:6px 0;font-size:11px;color:#888}',
    '.spt-lessons-detail.open{display:block}',
    '.spt-lessons-detail div{padding:2px 0}',
    '.spt-check{color:#22c55e}',
    '.spt-pending{color:#444}'
  ].join('\n');
  document.head.appendChild(style);

  // Create overlay
  var overlay = document.createElement('div');
  overlay.className = 'spt-overlay';
  overlay.innerHTML = '<div class="spt-modal" style="position:relative">' +
    '<button class="spt-close" id="spt-close-btn">&times;</button>' +
    '<div class="spt-loading"><div class="spin"></div>' +
    '<p style="margin-top:16px">Loading students...</p>' +
    '<p class="spt-progress-text" style="margin-top:8px;font-size:12px"></p>' +
    '</div></div>';
  document.body.appendChild(overlay);

  document.getElementById('spt-close-btn').onclick = function() { overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var seen = {};
  var students = [];
  var page = 1;

  function updateStatus(text) {
    var el = overlay.querySelector('.spt-progress-text');
    if (el) el.textContent = text;
  }

  // Step 1: Collect all students from /students pages
  function fetchStudentList() {
    var url = '/students' + (page > 1 ? '?page=' + ((page - 1) * 10) : '');
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
        students.push({
          id: id,
          name: nameMatch ? nameMatch[1].trim() : fullText,
          email: emailMatch ? emailMatch[1] : '',
          lastLogin: lastLogin,
          progress: null,
          status: '',
          lessons: [],
          lastCompleted: '',
          nextLesson: '',
          completedCount: 0,
          totalLessons: 0
        });
      });
      updateStatus('Found ' + students.length + ' students...');
      if (newCount > 0 && page < 20) { page++; fetchStudentList(); }
      else { fetchStudentData(0); }
    }).catch(function() { fetchStudentData(0); });
  }

  // Step 2: For each student, get enrollments (progress %) AND activity feed (lesson details)
  function fetchStudentData(i) {
    if (i >= students.length) { renderResults(); return; }
    updateStatus('Loading ' + (i + 1) + '/' + students.length + ': ' + students[i].name + '...');

    fetch('/student-details/' + students[i].id + '?tab=enrollments').then(function(r) { return r.text(); }).then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var rows = doc.querySelectorAll('.js-general-row');
      rows.forEach(function(row) {
        var cols = row.querySelectorAll('.col-md-2');
        if (cols.length >= 2) {
          students[i].progress = parseInt(cols[0].textContent.trim()) || 0;
          var badge = cols[1].querySelector('.badge');
          students[i].status = badge ? badge.textContent.trim() : 'Unknown';
        }
      });
      fetchActivityFeed(i, 1, []);
    }).catch(function() {
      students[i].progress = 0;
      students[i].status = 'Error';
      fetchStudentData(i + 1);
    });
  }

  // Fetch activity feed pages (paginated)
  function fetchActivityFeed(studentIdx, feedPage, allLessons) {
    var url = '/student-details/' + students[studentIdx].id + '?tab=activity-feed' + (feedPage > 1 ? '&page=' + ((feedPage - 1) * 10) : '');
    fetch(url).then(function(r) { return r.text(); }).then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var rows = doc.querySelectorAll('.general-row.row');
      var newLessons = 0;
      rows.forEach(function(row) {
        var lessonCol = row.querySelector('.lesson-type-icon-and-lesson-name-wrapper');
        var dateCol = row.querySelector('.col-md-3');
        if (!lessonCol) return;
        var lessonName = lessonCol.textContent.trim();
        var completedDate = dateCol ? dateCol.textContent.trim() : '';
        if (lessonName === 'Lesson' || lessonName === '') return;
        allLessons.push({ name: lessonName, completed: completedDate !== '', date: completedDate });
        newLessons++;
      });
      var nextLink = doc.querySelector('.pagination a[href*="page="]');
      var hasNext = nextLink && newLessons > 0 && feedPage < 5;
      if (hasNext) {
        fetchActivityFeed(studentIdx, feedPage + 1, allLessons);
      } else {
        var s = students[studentIdx];
        s.lessons = allLessons;
        s.totalLessons = allLessons.length;
        s.completedCount = allLessons.filter(function(l) { return l.completed; }).length;

        var reversed = allLessons.slice().reverse();
        var lastDone = null;
        var nextTodo = null;
        for (var j = 0; j < reversed.length; j++) {
          if (reversed[j].completed) lastDone = reversed[j];
        }
        for (var k = 0; k < allLessons.length; k++) {
          if (!allLessons[k].completed) { nextTodo = allLessons[k]; break; }
        }
        s.lastCompleted = lastDone ? lastDone.name : '\u2014';
        s.nextLesson = nextTodo ? nextTodo.name : 'All done!';

        fetchStudentData(studentIdx + 1);
      }
    }).catch(function() {
      fetchStudentData(studentIdx + 1);
    });
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
    if (max >= 60) {
      alertHTML = '<div class="spt-alert">\u26A0\uFE0F Max progress ' + max + '% \u2014 students approaching the last available lesson!</div>';
    }

    var h = '<button class="spt-close" onclick="this.closest(\'.spt-overlay\').remove()">&times;</button>';
    h += '<h2>\uD83D\uDCCA Student Progress Report</h2>';
    h += '<p class="spt-meta">' + new Date().toLocaleDateString('en-US', {day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'}) + '</p>';
    h += '<div class="spt-summary">';
    h += '<div class="spt-card"><div class="num">' + total + '</div><div class="label">Total students</div></div>';
    h += '<div class="spt-card"><div class="num">' + active + '</div><div class="label">Started learning</div></div>';
    h += '<div class="spt-card"><div class="num">' + avg + '%</div><div class="label">Avg progress</div></div>';
    h += '<div class="spt-card"><div class="num">' + max + '%</div><div class="label">Max progress</div></div>';
    h += '</div>';
    h += alertHTML;
    h += '<table class="spt-table"><thead><tr>';
    h += '<th>Student</th><th>Progress</th><th>Last completed</th><th>Next lesson</th><th>Last login</th>';
    h += '</tr></thead><tbody>';

    students.forEach(function(s, idx) {
      var p = s.progress || 0;
      var c = p === 0 ? '#444' : p < 30 ? '#2563eb' : p < 70 ? '#eab308' : '#22c55e';

      h += '<tr>';
      h += '<td><div class="spt-name">' + s.name + '</div><div class="spt-email">' + s.email + '</div></td>';
      h += '<td><div class="spt-bar-bg"><div class="spt-bar" style="width:' + p + '%;background:' + c + '"></div></div>';
      h += '<span class="spt-pct" style="color:' + c + '">' + p + '%</span>';
      h += '<div class="spt-lesson-count">' + s.completedCount + '/' + s.totalLessons + ' lessons</div>';
      if (s.lessons.length > 0) {
        h += '<span class="spt-expand" onclick="var d=this.nextElementSibling;d.classList.toggle(\'open\');this.textContent=d.classList.contains(\'open\')?\'^Hide lessons ^\':  \'Show lessons v\'">Show lessons \u25BC</span>';
        h += '<div class="spt-lessons-detail">';
        var ordered = s.lessons.slice().reverse();
        ordered.forEach(function(l) {
          if (l.completed) {
            h += '<div class="spt-check">\u2713 ' + l.name + (l.date ? ' <span style="color:#555">(' + l.date + ')</span>' : '') + '</div>';
          } else {
            h += '<div class="spt-pending">\u25CB ' + l.name + '</div>';
          }
        });
        h += '</div>';
      }
      h += '</td>';
      h += '<td><div class="spt-lesson spt-lesson-done">' + s.lastCompleted + '</div></td>';
      h += '<td><div class="spt-lesson spt-lesson-next">' + s.nextLesson + '</div></td>';
      h += '<td style="color:#888;font-size:12px">' + s.lastLogin + '</td>';
      h += '</tr>';
    });

    h += '</tbody></table>';
    modal.innerHTML = h;
  }

  // Start
  fetchStudentList();
})();
