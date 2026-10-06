/**
 * Chabad of Teaneck Digital Pushka — v1 demo
 * Simulate $1 gives via tap / Space / DeviceMotion shake / ?give=1
 * Persist in localStorage. No real payments.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "teaneck-pushka-v1";
  const DEFAULT_GOAL = 36;
  const GIVE_AMOUNT = 1;
  const SHAKE_THRESHOLD = 18; // m/s²-ish peak delta
  const SHAKE_COOLDOWN_MS = 700;

  const els = {
    app: document.getElementById("app"),
    pushka: document.getElementById("pushka"),
    pushkaHit: document.getElementById("pushka-hit"),
    fill: document.getElementById("fill"),
    feedback: document.getElementById("feedback"),
    statGiven: document.getElementById("stat-given"),
    statFill: document.getElementById("stat-fill"),
    statGoal: document.getElementById("stat-goal"),
    statSession: document.getElementById("stat-session"),
    miniFill: document.getElementById("mini-fill"),
    btnReset: document.getElementById("btn-reset"),
    motionSheet: document.getElementById("motion-sheet"),
    motionEnable: document.getElementById("motion-enable"),
    motionSkip: document.getElementById("motion-skip"),
    coinLayer: document.getElementById("coin-layer"),
    liquidBody: document.getElementById("liquid-body"),
    liquidTop: document.getElementById("liquid-top"),
    liquidDepth: document.getElementById("liquid-depth"),
    liquidMeniscus: document.getElementById("liquid-meniscus"),
    liquidClipRect: document.getElementById("liquid-clip-rect"),
    liquidClipTop: document.getElementById("liquid-clip-top"),
    hint: document.getElementById("hint"),
  };

  /** @type {{ given: number, goal: number, session: number }} */
  let state = loadState();
  let sessionGiven = 0;
  let giving = false;
  let lastShake = 0;
  let lastAccel = { x: 0, y: 0, z: 0 };
  let motionListening = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          given: Math.max(0, Number(parsed.given) || 0),
          goal: Math.max(1, Number(parsed.goal) || DEFAULT_GOAL),
        };
      }
    } catch (_) { /* ignore */ }
    return { given: 0, goal: DEFAULT_GOAL };
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ given: state.given, goal: state.goal })
      );
    } catch (_) { /* private mode etc. */ }
  }

  function formatMoney(n) {
    return "$" + Math.round(n);
  }

  function fillPct() {
    if (state.given <= 0) return 0;
    // True ratio, but keep a visible floor so early $1 gifts read on the cylinder
    const raw = (state.given / state.goal) * 100;
    const floored = Math.max(raw, Math.min(8, raw + 5));
    return Math.min(100, floored);
  }

  // Liquid level geometry (SVG user units, see index.html)
  const LEVEL_EMPTY_Y = 286; // surface at the base
  const LEVEL_FULL_Y = 78;   // surface just under the lid
  const SVG_NS = "http://www.w3.org/2000/svg";
  let levelY = LEVEL_EMPTY_Y;
  let levelAnim = 0;

  function setLevel(y) {
    levelY = y;
    const h = LEVEL_EMPTY_Y + 40 - y;
    els.liquidBody.setAttribute("y", y.toFixed(2));
    els.liquidBody.setAttribute("height", h.toFixed(2));
    els.liquidClipRect.setAttribute("y", y.toFixed(2));
    els.liquidClipRect.setAttribute("height", h.toFixed(2));
    els.liquidDepth.setAttribute("y", y.toFixed(2));
    els.liquidDepth.setAttribute("height", h.toFixed(2));
    els.liquidTop.setAttribute("cy", y.toFixed(2));
    els.liquidMeniscus.setAttribute("cy", y.toFixed(2));
    els.liquidClipTop.setAttribute("cy", y.toFixed(2));
  }

  function animateLevelTo(target, instant) {
    window.cancelAnimationFrame(levelAnim);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || reduce) { setLevel(target); return; }
    const from = levelY;
    const start = performance.now();
    const dur = 900;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 4); // easeOutQuart
      setLevel(from + (target - from) * e);
      if (t < 1) levelAnim = window.requestAnimationFrame(step);
    };
    levelAnim = window.requestAnimationFrame(step);
  }

  let firstRender = true;
  function render() {
    const pct = fillPct();
    const truePct = Math.min(100, (state.given / state.goal) * 100);
    const targetY = LEVEL_EMPTY_Y - (LEVEL_EMPTY_Y - LEVEL_FULL_Y) * (pct / 100);
    els.fill.setAttribute("opacity", pct > 0 ? "1" : "0");
    animateLevelTo(targetY, firstRender);
    firstRender = false;
    els.statGiven.textContent = formatMoney(state.given);
    els.statFill.textContent = formatMoney(Math.min(state.given, state.goal));
    els.statGoal.textContent = formatMoney(state.goal);
    els.statSession.textContent = formatMoney(sessionGiven);
    els.miniFill.style.width = truePct.toFixed(2) + "%";
    els.app.classList.toggle("goal-reached", state.given >= state.goal);
  }

  function showFeedback(text) {
    const node = els.feedback;
    node.hidden = false;
    node.textContent = text;
    // restart CSS animation
    node.style.animation = "none";
    // force reflow
    void node.offsetWidth;
    node.style.animation = "";
    window.clearTimeout(showFeedback._t);
    showFeedback._t = window.setTimeout(() => {
      node.hidden = true;
    }, 600);
  }

  // A minimal gold coin, face-on, that slides down into the slot
  function spawnCoin() {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "coin");
    const mk = (tag, attrs) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      g.appendChild(n);
      return n;
    };
    mk("circle", { cx: 120, cy: 22, r: 17, fill: "url(#g-gold)" });
    mk("circle", { cx: 120, cy: 22, r: 13, fill: "url(#g-gold-top)" });
    mk("circle", { cx: 120, cy: 22, r: 13, fill: "none", stroke: "#6e4c1a", "stroke-opacity": 0.35, "stroke-width": 0.6 });
    mk("path", { d: "M106.5 15 A16 16 0 0 1 127 7", fill: "none", stroke: "#fff6dc", "stroke-opacity": 0.7, "stroke-width": 0.9, "stroke-linecap": "round" });
    els.coinLayer.appendChild(g);
    window.setTimeout(() => g.remove(), 700);
  }

  function haptic() {
    try {
      if (navigator.vibrate) navigator.vibrate([12, 30, 18]);
    } catch (_) { /* ignore */ }
  }

  function animatePushka() {
    els.pushka.classList.remove("shake");
    void els.pushka.offsetWidth;
    els.pushka.classList.add("shake");
  }

  /**
   * @param {{ silent?: boolean, source?: string }} [opts]
   */
  function give(opts) {
    opts = opts || {};
    if (giving) return;
    giving = true;

    state.given += GIVE_AMOUNT;
    sessionGiven += GIVE_AMOUNT;
    saveState();
    render();

    if (!opts.silent) {
      animatePushka();
      spawnCoin();
      haptic();
      showFeedback("Gave $1");
    } else {
      animatePushka();
      spawnCoin();
      haptic();
      showFeedback("Gave $1");
    }

    // brief lockout so rapid multi-fire still feels intentional
    window.setTimeout(() => {
      giving = false;
    }, 280);
  }

  // —— Input: tap / click ——
  els.pushkaHit.addEventListener("click", (e) => {
    e.preventDefault();
    give({ source: "tap" });
  });

  // —— Input: keyboard Space / Enter ——
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      give({ source: "keyboard" });
    } else if (e.key === "Enter" && document.activeElement === els.pushkaHit) {
      e.preventDefault();
      give({ source: "keyboard" });
    }
  });

  // —— Reset ——
  els.btnReset.addEventListener("click", () => {
    if (!window.confirm("Reset demo balance to $0? (This only clears local demo data.)")) {
      return;
    }
    state.given = 0;
    sessionGiven = 0;
    saveState();
    render();
    showFeedback("Reset");
  });

  // —— DeviceMotion shake ——
  function onMotion(event) {
    const a = event.accelerationIncludingGravity || event.acceleration;
    if (!a) return;
    const x = a.x || 0;
    const y = a.y || 0;
    const z = a.z || 0;
    const dx = x - lastAccel.x;
    const dy = y - lastAccel.y;
    const dz = z - lastAccel.z;
    lastAccel = { x, y, z };
    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const now = Date.now();
    if (delta > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN_MS) {
      lastShake = now;
      give({ source: "shake" });
    }
  }

  function startMotion() {
    if (motionListening) return;
    window.addEventListener("devicemotion", onMotion, { passive: true });
    motionListening = true;
    if (els.hint) {
      els.hint.innerHTML =
        "Shake your phone · tap the pushka · or press <kbd>Space</kbd>";
    }
  }

  function needsMotionPermission() {
    return (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    );
  }

  function maybeOfferMotion() {
    // Only prompt on likely mobile + if permission API exists (iOS 13+)
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!mobile) return;
    if (typeof DeviceMotionEvent === "undefined") return;

    if (needsMotionPermission()) {
      // Don't auto-prompt on load — wait until user taps "Enable"
      // Show sheet once per session if not previously skipped this session
      if (sessionStorage.getItem("motion-skip") === "1") return;
      els.motionSheet.hidden = false;
    } else {
      // Android / older: just listen
      startMotion();
    }
  }

  els.motionEnable.addEventListener("click", async () => {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      if (res === "granted") startMotion();
    } catch (_) { /* denied / unavailable */ }
    els.motionSheet.hidden = true;
  });

  els.motionSkip.addEventListener("click", () => {
    sessionStorage.setItem("motion-skip", "1");
    els.motionSheet.hidden = true;
  });

  // —— QR / deep-link: ?give=1 or path /q/teaneck ——
  function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const path = (window.location.pathname || "").replace(/\/+$/, "");
    const giveParam = params.get("give");
    const isQrPath =
      /\/q\/teaneck$/i.test(path) ||
      /\/q\/teaneck\.html$/i.test(path);

    if (giveParam === "1" || giveParam === "true" || isQrPath) {
      // Defer slightly so first paint shows the pushka, then animate
      window.setTimeout(() => {
        give({ source: "qr" });
        // Clean URL so refresh doesn't re-give (keep path, drop give param)
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("give");
          // If opened as /q/teaneck, leave path; parent server may not rewrite.
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        } catch (_) { /* ignore */ }
      }, 450);
    }
  }

  // —— Init ——
  render();
  handleDeepLink();
  // Offer motion after a beat so it doesn't fight the QR feedback
  window.setTimeout(maybeOfferMotion, 900);
})();
