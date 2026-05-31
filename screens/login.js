import { signIn, signUp } from '../supabase.js';

export async function render(container) {
  container.innerHTML = `
    <div style="max-width:400px;margin:60px auto;padding:0 20px">
      <h1 style="text-align:center;margin-bottom:32px">ShareYourSwing</h1>
      <div style="display:flex;gap:8px;margin-bottom:24px">
        <button id="tab-login" class="tab-btn active">Anmelden</button>
        <button id="tab-register" class="tab-btn">Registrieren</button>
      </div>

      <form id="auth-form">
        <div id="username-field" style="display:none;margin-bottom:12px">
          <label>Benutzername</label>
          <input type="text" id="username" placeholder="z.B. max_mustermann" autocomplete="off">
        </div>
        <div style="margin-bottom:12px">
          <label>E-Mail</label>
          <input type="email" id="email" placeholder="deine@email.de" required>
        </div>
        <div style="margin-bottom:24px">
          <label>Passwort</label>
          <input type="password" id="password" placeholder="Mindestens 6 Zeichen" required>
        </div>
        <p id="auth-error" style="color:var(--error,#e53e3e);display:none;margin-bottom:12px"></p>
        <button type="submit" id="submit-btn" class="btn-primary" style="width:100%">Anmelden</button>
      </form>
    </div>
  `;

  let mode = 'login';

  function setMode(m) {
    mode = m;
    container.querySelector('#tab-login').classList.toggle('active', m === 'login');
    container.querySelector('#tab-register').classList.toggle('active', m === 'register');
    container.querySelector('#username-field').style.display = m === 'register' ? 'block' : 'none';
    container.querySelector('#submit-btn').textContent = m === 'login' ? 'Anmelden' : 'Konto erstellen';
    container.querySelector('#auth-error').style.display = 'none';
  }

  container.querySelector('#tab-login').addEventListener('click', () => setMode('login'));
  container.querySelector('#tab-register').addEventListener('click', () => setMode('register'));

  container.querySelector('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;
    const errEl = container.querySelector('#auth-error');
    const btn = container.querySelector('#submit-btn');

    btn.disabled = true;
    btn.textContent = '...';
    errEl.style.display = 'none';

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const username = container.querySelector('#username').value.trim();
        if (!username) throw new Error('Bitte Benutzername eingeben.');
        await signUp(email, password, username);
      }
      location.hash = '#home';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      setMode(mode);
    }
  });
}
