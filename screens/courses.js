import { getAllCourses, addCourse, deleteCourse, updateCourse, getCourse } from '../db.js';
import { icons } from '../components/icons.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container) {
  container.innerHTML = `
    <h1>Plätze</h1>
    <div id="course-list"></div>
    <button class="btn-primary" id="show-form-btn" style="margin-top:16px">Neuer Platz</button>
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
    const courses = await getAllCourses();
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
          <button class="btn-icon" data-edit="${c.id}" aria-label="Bearbeiten">${icons.edit}</button>
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
    sheet.querySelector('#delete-course-btn').addEventListener('click', async () => {
      await deleteCourse(id);
      closeSheet();
      await refresh();
    });
  }

  await refresh();

  container.querySelector('#show-form-btn').addEventListener('click', showNameStep);

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const id = btn.dataset.edit;
    const course = await getCourse(id);
    if (course) showEditStep(id, course.name);
  });
}
