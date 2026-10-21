(() => {
  const URL = "https://tszkyygildzfkefivzhs.supabase.co";
  const KEY = "sb_publishable_WsZy2W_CfZIH1hU8pLXUgw_gWSakvSP";

  const panel = document.createElement("section");
  panel.style.cssText = "max-width:1100px;margin:16px auto;padding:18px;background:#141821;color:#f4f6fb;border:1px solid #2a3140;border-radius:16px;font-family:Arial,sans-serif";
  panel.innerHTML = `
    <h2 style="color:#b7ff35">☁️ TRANSFORM ALBERO CLOUD</h2>
    <p id="taStatus">Preparazione connessione…</p>
    <input id="taEmail" type="email" placeholder="La tua email" style="padding:12px;width:100%;box-sizing:border-box">
    <button id="taLogin" style="padding:12px;margin:8px 4px 8px 0">Ricevi link di accesso</button>
    <button id="taSync" style="padding:12px" disabled>Sincronizza diario</button>
    <button id="taLogout" style="padding:12px">Esci</button>
  `;
  document.querySelector(".wrap").prepend(panel);

  const $ = id => panel.querySelector("#" + id);
  const say = text => $("taStatus").textContent = text;
  let db, user, busy = false;

  function update() {
    $("taEmail").hidden = !!user;
    $("taLogin").hidden = !!user;
    $("taSync").disabled = !user || busy;
    $("taLogout").hidden = !user;
  }

  async function sync() {
    if (!user || busy) return;
    busy = true;
    update();
    say("Sincronizzazione in corso…");
    try {
      const { data: rows, error } = await db
        .from("transform_diary_entries")
        .select("entry_date,data")
        .eq("user_id", user.id);
      if (error) throw error;

      const entries = Array.isArray(state.entries) ? state.entries : [];
      const byDate = new Map(entries.map(e => [e.date, e]));
      let restored = 0;

      for (const row of rows || []) {
        if (!byDate.has(row.entry_date)) {
          byDate.set(row.entry_date, row.data);
          restored++;
        }
      }

      state.entries = [...byDate.values()].sort((a,b) => a.date.localeCompare(b.date));
      save();
      render();

      const payload = state.entries.map(e => ({
        user_id: user.id,
        entry_date: e.date,
        data: e,
        updated_at: new Date().toISOString()
      }));

      if (payload.length) {
        const result = await db.from("transform_diary_entries")
          .upsert(payload, { onConflict: "user_id,entry_date" });
        if (result.error) throw result.error;
      }

      say("Sincronizzato! Giornate nel cloud: " + state.entries.length +
          ". Recuperate dal cloud: " + restored +
          ". Le giornate locali già esistenti sono state mantenute.");
    } catch (err) {
      say("Errore: " + err.message + ". I dati locali restano sul dispositivo.");
    } finally {
      busy = false;
      update();
    }
  }

  async function start() {
    try {
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      db = window.supabase.createClient(URL, KEY);
      const result = await db.auth.getSession();
      if (result.error) throw result.error;
      user = result.data.session?.user || null;
      update();

      if (user) await sync();
      else say("Inserisci la tua email per ricevere un link di accesso.");

      db.auth.onAuthStateChange((event, session) => {
        user = session?.user || null;
        update();
        if (user && event === "SIGNED_IN") setTimeout(sync, 500);
      });
    } catch (err) {
      say("Connessione non riuscita. Ricarica il sito e riprova.");
    }
  }

  $("taLogin").onclick = async () => {
    const email = $("taEmail").value.trim();
    if (!email) return say("Inserisci la tua email.");
    say("Invio del link di accesso…");
    const result = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname }
    });
    say(result.error ? result.error.message :
        "Controlla la posta e apri il link di accesso.");
  };

  $("taSync").onclick = sync;
  $("taLogout").onclick = async () => {
    await db.auth.signOut();
    user = null;
    update();
    say("Disconnesso. I dati locali restano sul dispositivo.");
  };

  start();
})();
