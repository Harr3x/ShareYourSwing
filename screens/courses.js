import { getAllCourses, addCourse, deleteCourse } from '../db.js';

function parInputsHTML() {
  return Array.from({ length: 18 }, (_, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <label style="min-width:60px;font-size:14px;">Bahn ${i + 1}</label>
      <input type="number" min="2" max="6" value="3" data-hole="${i}"
        style="width:70px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:16px;">
    </div>
  `).join('');
}

export async function render(container) {
  container.innerHTML = `
    <h1>Plätze</h1>
    <div id="course-list"></div>
    <div class="mt-16">
      <h2>Neuer Platz</h2>
      <input id="course-name" placeholder="Platzname" style="width:100%;padding:12px;font-size:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px;">
      <div id="par-inputs">${parInputsHTML()}</div>
      <button class="btn-primary mt-16" id="add-course-btn">Platz speichern</button>
    </div>
  `;

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
            <div style="font-weight:600">${c.name}</div>
            <div class="text-muted">Par ${totalPar} · 18 Bahnen</div>
          </div>
          <button class="btn-danger" style="padding:0 14px;min-height:36px;font-size:13px;" data-delete="${c.id}">Löschen</button>
        </div>
      `;
    }).join('');
  }

  await refresh();

  container.querySelector('#add-course-btn').addEventListener('click', async () => {
    const name = container.querySelector('#course-name').value.trim();
    if (!name) return;
    const holes = Array.from(container.querySelectorAll('[data-hole]')).map(inp => ({
      par: parseInt(inp.value, 10) || 3
    }));
    await addCourse(name, holes);
    container.querySelector('#course-name').value = '';
    container.querySelectorAll('[data-hole]').forEach(inp => inp.value = '3');
    await refresh();
  });

  container.addEventListener('click', async e => {
    const id = e.target.dataset.delete;
    if (!id) return;
    await deleteCourse(id);
    await refresh();
  });
}
