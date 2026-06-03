import { getCourses, addCourse, deleteCourse, updateCourse, getCourse, getMyProfile } from '../supabase.js';
import { icons } from '../components/icons.js';
import { dmsToDecimal } from '../utils/geo.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container) {
  const profile = await getMyProfile();
  const isAdmin = profile?.is_admin ?? false;

  container.innerHTML = `
    <h1>Plätze</h1>
    <div id="course-list"></div>
    ${isAdmin ? '<button class="btn-primary" id="show-form-btn" style="margin-top:16px">Neuer Platz</button>' : ''}
  `;

  function closeSheet() {
    const existing = document.getElementById('sheet-wrap');
    if (existing) existing.remove();
  }

  function showSheet(innerHTML) {
    closeSheet();
    const wrap = document.createElement('div');
    wrap.id = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="overlay" id="sheet-overlay"></div>
      <div class="bottom-sheet" id="bottom-sheet">
        <div class="handle"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('sheet-overlay').addEventListener('click', closeSheet);
    updateSheetContent(innerHTML);
  }

  function updateSheetContent(innerHTML) {
    const sheet = document.getElementById('bottom-sheet');
    if (!sheet) return;
    const content = sheet.querySelector('#sheet-content');
    if (content) content.innerHTML = innerHTML;
    else sheet.insertAdjacentHTML('beforeend', `<div id="sheet-content">${innerHTML}</div>`);
  }

  async function refresh() {
    const courses = await getCourses();
    const list = container.querySelector('#course-list');
    if (!courses.length) {
      list.innerHTML = '<p class="text-muted">Noch keine Plätze.</p>';
      return;
    }
    list.innerHTML = courses.map(c => {
      const totalPar = c.holes.reduce((s, h) => s + h.par, 0);
      return `
        <div class="card">
          <div>
            <div style="font-weight:600">${escapeHTML(c.name)}</div>
            <div class="text-muted">Par ${totalPar} · 18 Bahnen</div>
          </div>
          ${isAdmin ? `<button class="btn-icon" data-edit="${c.id}" aria-label="Bearbeiten">${icons.edit}</button>` : ''}
        </div>
      `;
    }).join('');
  }

  function showNameStep() {
    showSheet(`
      <a href="#" id="cancel-form" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:16px;color:var(--text-muted);text-decoration:none">${icons.chevronLeft} Abbrechen</a>
      <label style="font-weight:600;display:block;margin-bottom:6px">Platzname</label>
      <input id="course-name" placeholder="z.B. Golfclub Musterstadt" style="margin-bottom:16px;">
      <button class="btn-primary" id="name-next-btn">Weiter ${icons.chevronRight}</button>
    `);

    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelector('#name-next-btn').addEventListener('click', () => {
      const name = sheet.querySelector('#course-name').value.trim();
      if (!name) return;
      showHoleStep(name, []);
    });
    sheet.querySelector('#cancel-form').addEventListener('click', e => {
      e.preventDefault();
      closeSheet();
    });
  }

  function showHoleStep(courseName, holes) {
    const holeIndex = holes.length;
    let currentPar = 3;

    function draw() {
      const holeNumber = holeIndex + 1;
      updateSheetContent(`
        <a href="#" id="cancel-form" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:16px;color:var(--text-muted);text-decoration:none">${icons.chevronLeft} Abbrechen</a>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Platz: ${escapeHTML(courseName)}</div>
        <div class="hole-header">
          <div class="hole-number">Bahn ${holeNumber}</div>
          <div class="par-badge">Par ${currentPar}</div>
        </div>
        <div class="score-counter" style="justify-content:center;margin-bottom:8px;">
          <button id="btn-minus">−</button>
          <div class="score-value" style="font-size:48px;font-weight:700;min-width:60px;text-align:center">${currentPar}</div>
          <button id="btn-plus">+</button>
        </div>
        <div style="text-align:center;margin-bottom:32px;font-size:14px;color:var(--text-muted);min-height:20px"></div>
        <button class="btn-primary" id="btn-confirm">Bestätigen</button>
      `);

      const sheet = document.getElementById('bottom-sheet');
      sheet.querySelector('#btn-minus').addEventListener('click', () => {
        if (currentPar > 2) {
          currentPar--;
          draw();
          document.getElementById('bottom-sheet')?.querySelector('.score-value')?.classList.add('score-pop');
        }
      });
      sheet.querySelector('#btn-plus').addEventListener('click', () => {
        if (currentPar < 6) {
          currentPar++;
          draw();
          document.getElementById('bottom-sheet')?.querySelector('.score-value')?.classList.add('score-pop');
        }
      });
      sheet.querySelector('#btn-confirm').addEventListener('click', async () => {
        holes.push({ par: currentPar });
        if (holeIndex < 17) {
          showHoleStep(courseName, holes);
        } else {
          await addCourse(courseName, holes);
          closeSheet();
          await refresh();
        }
      });
      sheet.querySelector('#cancel-form').addEventListener('click', e => {
        e.preventDefault();
        closeSheet();
      });
    }

    draw();
  }

  function showEditStep(id, currentName) {
    showSheet(`
      <label style="font-weight:600;display:block;margin-bottom:6px">Platzname</label>
      <input id="edit-course-name" value="${escapeHTML(currentName)}" style="margin-bottom:16px;">
      <button class="btn-primary" id="save-course-btn">Speichern</button>
      <button id="coord-import-btn" style="margin-top:12px;width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2);cursor:pointer;font-size:0.95rem;">Koordinaten importieren</button>
      <button class="btn-danger" id="delete-course-btn" style="margin-top:12px;width:100%">Platz löschen</button>
    `);

    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelector('#save-course-btn').addEventListener('click', async () => {
      const name = sheet.querySelector('#edit-course-name').value.trim();
      if (!name) return;
      await updateCourse({ ...(await getCourse(id)), name });
      closeSheet();
      await refresh();
    });
    sheet.querySelector('#coord-import-btn').addEventListener('click', async () => {
      const course = await getCourse(id);
      showCoordImportStep(course);
    });
    sheet.querySelector('#delete-course-btn').addEventListener('click', async () => {
      await deleteCourse(id);
      closeSheet();
      await refresh();
    });
  }

  function showCoordImportStep(course) {
    const holes = course.holes.map(h => ({ ...h }));
    showSheet(`
      <a href="#" id="back-to-edit" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:16px;color:var(--text-muted);text-decoration:none">${icons.chevronLeft} Zurück</a>
      <h3 style="margin:0 0 16px">Koordinaten importieren</h3>
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px">
        18 Zeilen, eine pro Loch. Format: DMS (<code>54°09'54.5"N 9°52'33.7"E</code>) oder Dezimal (<code>54.165,9.876</code>).
      </p>
      <textarea id="coord-textarea" style="width:100%;height:240px;font-family:monospace;font-size:13px;padding:10px;border:1px solid var(--border);border-radius:var(--radius);resize:vertical" placeholder="Zeile 1 = Loch 1&#10;54°09'54.5"N 9°52'33.7"E&#10;..."></textarea>
      <div style="display:flex;gap:8px;margin-top:12px">
        <label style="flex:1;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2);cursor:pointer;text-align:center;font-size:0.9rem">
          Aus Datei laden
          <input type="file" id="coord-file" accept=".txt,.csv" style="display:none">
        </label>
        <button id="coord-apply-btn" class="btn-primary" style="flex:1">Übernehmen</button>
      </div>
      <div id="coord-status" style="margin-top:12px;font-size:.85rem;color:var(--text-muted);min-height:20px"></div>
    `);

    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelector('#back-to-edit').addEventListener('click', e => {
      e.preventDefault();
      showEditStep(course.id, course.name);
    });

    sheet.querySelector('#coord-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        sheet.querySelector('#coord-textarea').value = reader.result;
      };
      reader.readAsText(file);
    });

    sheet.querySelector('#coord-apply-btn').addEventListener('click', async () => {
      const raw = sheet.querySelector('#coord-textarea').value.trim().split('\n').filter(Boolean);
      const status = sheet.querySelector('#coord-status');

      if (raw.length !== 18) {
        status.textContent = `Fehler: ${raw.length} Zeilen, erwartet 18.`;
        return;
      }

      let ok = 0, err = 0;
      for (let i = 0; i < 18; i++) {
        const parsed = parseCoordLine(raw[i]);
        if (parsed) {
          holes[i].pinLat = parsed.lat;
          holes[i].pinLng = parsed.lng;
          ok++;
        } else {
          err++;
        }
      }

      if (err > 0) {
        status.textContent = `${ok} übernommen, ${err} Fehler. Korrigieren und erneut versuchen.`;
        status.style.color = 'var(--danger)';
        return;
      }

      await updateCourse({ ...course, holes });
      status.textContent = '✓ Alle 18 Koordinaten gespeichert.';
      status.style.color = 'var(--primary)';
      closeSheet();
      await refresh();
    });
  }

  function parseCoordLine(line) {
    line = line.trim();
    if (!line) return null;
    if (line.includes('°')) {
      return dmsToDecimal(line);
    }
    const parts = line.split(/[,\s]+/);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0].replace(',', '.'));
      const lng = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
  }

  await refresh();

  if (isAdmin) container.querySelector('#show-form-btn').addEventListener('click', showNameStep);

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const id = btn.dataset.edit;
    const course = await getCourse(id);
    if (course) showEditStep(id, course.name);
  });
}
