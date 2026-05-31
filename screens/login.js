import { signIn, signUp } from '../supabase.js';

export async function render(container) {
  container.innerHTML = `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px;background:var(--bg);">
      <div style="width:100%;max-width:380px;">

        <!-- Logo -->
        <div style="text-align:center;margin-bottom:36px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:var(--primary);border-radius:16px;margin-bottom:14px;box-shadow:0 4px 16px rgba(45,122,58,0.3);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
          </div>
          <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.5px;margin:0 0 4px;">ShareYourSwing</h1>
          <p style="color:var(--text-muted);font-size:14px;margin:0;">Deine Golfrunden. Deine Freunde.</p>
        </div>

        <!-- Card -->
        <div style="background:var(--surface);border-radius:var(--radius);border:1px solid var(--border-light);box-shadow:var(--shadow-md);padding:24px;">

          <!-- Tabs -->
          <div style="display:flex;gap:6px;margin-bottom:20px;background:var(--surface-2);border-radius:var(--radius-sm);padding:4px;">
            <button id="tab-login" style="flex:1;padding:8px;border:none;border-radius:6px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.15s ease;background:var(--primary);color:white;box-shadow:var(--shadow-sm);">Anmelden</button>
            <button id="tab-register" style="flex:1;padding:8px;border:none;border-radius:6px;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 0.15s ease;background:transparent;color:var(--text-muted);">Registrieren</button>
          </div>

          <form id="auth-form">
            <div id="username-field" style="display:none;margin-bottom:14px;">
              <label style="display:block;font-size:13px;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Benutzername</label>
              <input type="text" id="username" placeholder="z.B. max_mustermann" autocomplete="off">
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:13px;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">E-Mail</label>
              <input type="email" id="email" placeholder="deine@email.de" required>
            </div>
            <div style="margin-bottom:20px;">
              <label style="display:block;font-size:13px;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Passwort</label>
              <input type="password" id="password" placeholder="Mindestens 6 Zeichen" required>
            </div>
            <p id="auth-error" style="color:var(--danger);font-size:13px;display:none;margin-bottom:14px;padding:10px 12px;background:#fef2f2;border-radius:var(--radius-sm);border:1px solid #fecaca;"></p>
            <button type="submit" id="submit-btn" class="btn-primary">Anmelden</button>
          </form>
        </div>

      </div>
    </div>
  `;

  let mode = 'login';

  function setMode(m) {
    mode = m;
    const tabLogin = container.querySelector('#tab-login');
    const tabReg = container.querySelector('#tab-register');
    const active = 'background:var(--primary);color:white;box-shadow:var(--shadow-sm);font-weight:600;';
    const inactive = 'background:transparent;color:var(--text-muted);font-weight:500;';
    tabLogin.style.cssText += m === 'login' ? active : inactive;
    tabReg.style.cssText += m === 'register' ? active : inactive;
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
