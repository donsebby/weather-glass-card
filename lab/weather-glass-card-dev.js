/* Weather Glass Card - frosted-glass weather widget for Home Assistant
 * Shows current conditions, an animated weather scene, a live clock and a
 * multi-day forecast, plus optional extras:
 *  - one or more small warning badges next to the clock (`warning_entity`
 *    shorthand, or the `warnings: [...]` array for more than one)
 *  - a UV-index chip, read straight off the weather entity's `uv_index`
 *    attribute
 *  - a pollen chip showing the strongest currently-active pollen type
 *    (Pollenflug-style Gefahrenindex, 0-3 scale) from a configurable list
 *    of sensors; once the Gefahrenindex reaches 2 ("Mittel") or higher the
 *    chip shows a small inline warning-triangle icon
 * UV/pollen chips are tappable and navigate to their own popup (default
 * "#uv-popup" / "#pollen-popup") instead of the card's default more-info
 * action, so each can open a dedicated bubble-card pop-up with more detail.
 * `look: solid` (opt-in) swaps the frosted glass for a calm solid panel
 * without blur, gradients, glows or the canvas animation - for dashboards
 * whose page background already shows an animated sky.
 * Without `look:` the theme decides via the CSS variable `--lg-look`
 * (`solid` | `glass`, default glass).
 * type: custom:weather-glass-card-dev
 * MIT
 */
const CARD_VERSION = "1.4.0-dev";

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const LABELS = {
  "clear-night": "Klare Nacht",
  cloudy: "Bedeckt",
  fog: "Nebel",
  hail: "Hagel",
  lightning: "Gewitter",
  "lightning-rainy": "Gewitter mit Regen",
  partlycloudy: "Heiter bis wolkig",
  pouring: "Starkregen",
  rainy: "Regen",
  snowy: "Schneefall",
  "snowy-rainy": "Schneeregen",
  sunny: "Sonnig",
  windy: "Windig",
  "windy-variant": "Windig",
  exceptional: "Ungewöhnlich"
};

// visual traits per HA weather state
const TRAITS = {
  "clear-night": { moon: 1, tint: "linear-gradient(165deg, rgba(120,150,235,0.22) 0%, rgba(40,50,95,0.16) 45%, rgba(10,12,18,0) 80%)" },
  sunny: { sun: 1, tint: "linear-gradient(165deg, rgba(255,183,77,0.26) 0%, rgba(255,120,64,0.10) 42%, rgba(10,12,18,0) 72%)" },
  partlycloudy: { sun: 1, cloud: 1, tint: "linear-gradient(165deg, rgba(255,206,120,0.18) 0%, rgba(120,170,235,0.14) 45%, rgba(10,12,18,0) 78%)" },
  cloudy: { cloud: 1, tint: "linear-gradient(165deg, rgba(178,196,222,0.20) 0%, rgba(90,105,130,0.12) 48%, rgba(10,12,18,0) 80%)" },
  rainy: { cloud: 1, rain: 1, tint: "linear-gradient(165deg, rgba(96,166,230,0.24) 0%, rgba(60,90,140,0.14) 48%, rgba(10,12,18,0) 80%)" },
  pouring: { cloud: 1, rain: 1, heavy: 1, tint: "linear-gradient(165deg, rgba(76,146,220,0.28) 0%, rgba(45,75,125,0.16) 48%, rgba(10,12,18,0) 80%)" },
  "snowy-rainy": { cloud: 1, rain: 1, snow: 1, tint: "linear-gradient(165deg, rgba(180,210,240,0.22) 0%, rgba(100,130,170,0.12) 48%, rgba(10,12,18,0) 80%)" },
  snowy: { cloud: 1, snow: 1, tint: "linear-gradient(165deg, rgba(196,222,255,0.22) 0%, rgba(120,150,190,0.12) 48%, rgba(10,12,18,0) 80%)" },
  hail: { cloud: 1, snow: 1, tint: "linear-gradient(165deg, rgba(196,222,255,0.22) 0%, rgba(120,150,190,0.12) 48%, rgba(10,12,18,0) 80%)" },
  lightning: { cloud: 1, bolt: 1, tint: "linear-gradient(165deg, rgba(126,120,220,0.24) 0%, rgba(50,60,110,0.16) 48%, rgba(10,12,18,0) 80%)" },
  "lightning-rainy": { cloud: 1, rain: 1, bolt: 1, tint: "linear-gradient(165deg, rgba(126,120,220,0.24) 0%, rgba(50,60,110,0.16) 48%, rgba(10,12,18,0) 80%)" },
  fog: { cloud: 1, fog: 1, tint: "linear-gradient(165deg, rgba(200,205,215,0.20) 0%, rgba(110,118,132,0.14) 50%, rgba(10,12,18,0) 82%)" },
  windy: { cloud: 1, fog: 1, tint: "linear-gradient(165deg, rgba(200,205,215,0.18) 0%, rgba(110,118,132,0.12) 50%, rgba(10,12,18,0) 82%)" },
  "windy-variant": { cloud: 1, fog: 1, tint: "linear-gradient(165deg, rgba(200,205,215,0.18) 0%, rgba(110,118,132,0.12) 50%, rgba(10,12,18,0) 82%)" },
  exceptional: { cloud: 1, tint: "linear-gradient(165deg, rgba(226,140,140,0.20) 0%, rgba(110,60,60,0.12) 50%, rgba(10,12,18,0) 82%)" },
  "partlycloudy-night": { moon: 1, cloud: 1, tint: "linear-gradient(165deg, rgba(140,160,220,0.20) 0%, rgba(55,65,115,0.14) 45%, rgba(10,12,18,0) 78%)" }
};

// Some weather integrations only ever report the daytime condition name
// (e.g. "sunny") and never switch to a night variant overnight, even though
// HA's own sun.sun entity knows it's dark out. Map those to a night-looking
// variant so the hero icon doesn't show a bright sun/blue sky at 2am.
const NIGHT_VARIANT = { sunny: "clear-night", partlycloudy: "partlycloudy-night" };

// UV index category labels (WHO scale)
function uvLabel(v) {
  if (v == null || isNaN(v)) return null;
  if (v < 3) return "Niedrig";
  if (v < 6) return "Mäßig";
  if (v < 8) return "Hoch";
  if (v < 11) return "Sehr hoch";
  return "Extrem";
}

// Pollenflug-style Gefahrenindex (0-3) category labels
const POLLEN_LEVEL = ["Keine", "Gering", "Mittel", "Hoch"];

class WeatherGlassCard extends HTMLElement {
  static getStubConfig() {
    return { entity: "weather.forecast_home", days: 5 };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
        { name: "name", selector: { text: {} } },
        { name: "days", selector: { number: { min: 3, max: 7, step: 1, mode: "slider" } } },
        { name: "show_clock", selector: { boolean: {} } },
        { name: "animations", selector: { boolean: {} } },
        { name: "blur", selector: { number: { min: 0, max: 40, step: 2, mode: "slider", unit_of_measurement: "px" } } },
        { name: "panel_shade", selector: { number: { min: -100, max: 100, step: 5, mode: "slider", unit_of_measurement: "%" } } },
        { name: "look", selector: { select: { mode: "dropdown", options: [{ value: "glass", label: "Glas" }, { value: "solid", label: "Solide" }] } } },
        { name: "show_uv", selector: { boolean: {} } },
        { name: "uv_navigate", selector: { text: {} } },
        { name: "pollen_navigate", selector: { text: {} } },
        { name: "warning_entity", selector: { entity: { domain: "binary_sensor" } } },
        { name: "warning_icon", selector: { icon: {} } },
        { name: "warning_color", selector: { text: {} } },
        { name: "warning_navigate", selector: { text: {} } }
      ],
      // Note: additional warning badges beyond `warning_entity` (e.g. a
      // second, more urgent one for lightning) are configured via the
      // `warnings: [{entity, icon, color, navigate}, ...]` array, which has
      // no GUI editor yet - add those entries directly in YAML/code mode.
      // Same for `pollen_entities: [{entity, label}, ...]` - the list of
      // sensors the pollen chip picks its "strongest active type" from.
      // UV reads `uv_index` straight off the weather entity, so it needs
      // no entity of its own - just toggle it with `show_uv`.
      computeLabel: (s) => ({
        entity: "Weather entity",
        name: "Title (defaults to friendly name)",
        days: "Forecast days",
        show_clock: "Show clock & date",
        animations: "Animated weather scene",
        blur: "Backdrop blur",
        panel_shade: "Panel brightness",
        look: "Stil",
        show_uv: "Show UV index chip",
        uv_navigate: "UV chip tap navigation path",
        pollen_navigate: "Pollen chip tap navigation path",
        warning_entity: "Warning entity (optional binary_sensor)",
        warning_icon: "Warning icon (defaults to mdi:alert)",
        warning_color: "Warning icon color",
        warning_navigate: "Warning tap navigation path"
      }[s.name] || s.name)
    };
  }

  setConfig(config) {
    if (!config.entity) throw new Error("Please provide a 'weather' entity.");
    this._config = config;
    this._days = Math.max(3, Math.min(7, config.days ?? 5));
    this._showClock = config.show_clock !== false;
    // look: solid is opt-in; anything else keeps the glass look untouched.
    // The solid look stays calm: no canvas rain/snow/fog and no moving
    // icons (the page behind already shows the animated sky).
    // `look:` in the config wins; otherwise the theme decides via the CSS
    // variable --lg-look (see _effectiveLook / _checkLook).
    this._solid = this._effectiveLook(config) === "solid";
    this._anim = config.animations !== false && !this._solid;
    this._blur = config.blur ?? 20;
    this._panelShade = config.panel_shade ?? 6;
    this._showUv = config.show_uv !== false;
    this._pollen = Array.isArray(config.pollen_entities)
      ? config.pollen_entities.filter((p) => p && p.entity)
      : [];
    // Tapping the UV chip or the pollen chip navigates to its own hash
    // instead of triggering the card's default more-info action - same
    // navigate-by-hash mechanism the warning badges use, so each can open
    // its own bubble-card pop-up with a fuller breakdown.
    this._uvNavigate = config.uv_navigate || "#uv-popup";
    this._pollenNavigate = config.pollen_navigate || "#pollen-popup";
    // One or more small warning badges, rendered left-to-right next to the
    // clock. `warning_entity`/`warning_icon`/`warning_color`/`warning_navigate`
    // stay as the simple single-badge shorthand (GUI-editable); `warnings: []`
    // is the escape hatch for extra badges (e.g. a second, more urgent one
    // for lightning) - no GUI editor for that one yet, YAML/code mode only.
    const warnList = [];
    if (config.warning_entity) warnList.push({
      entity: config.warning_entity,
      icon: config.warning_icon || null,
      color: config.warning_color || "#ff9800",
      navigate: config.warning_navigate || "#warnungen-popup"
    });
    if (Array.isArray(config.warnings)) {
      for (const w of config.warnings) {
        if (!w || !w.entity) continue;
        warnList.push({
          entity: w.entity,
          icon: w.icon || null,
          color: w.color || "#ff9800",
          navigate: w.navigate || "#warnungen-popup"
        });
      }
    }
    this._warnings = warnList;
    // A rebuild throws the old canvas away: stop its loop/observer so the
    // new canvas gets its own, and force a full re-render of the new DOM.
    this._stopCanvas();
    this._lastSig = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = "";
    this._build();
    if (this._hass) this._render();
    if (this._anim && this.isConnected) this._startCanvas();
  }

  getCardSize() { return 6; }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    // Theme switches arrive via hass.themes - only then re-read --lg-look
    // (no getComputedStyle on every hass tick).
    const th = hass && hass.themes;
    const themeSig = th ? th.theme + "|" + th.darkMode : "";
    if (th !== this._themesRef || themeSig !== this._themeSig) {
      this._themesRef = th;
      this._themeSig = themeSig;
      this._scheduleLookCheck();
    }
    if (first || this._forecastStale()) this._fetchForecast();
    this._render();
  }

  connectedCallback() {
    this._clock = setInterval(() => this._renderClock(), 1000);
    if (!this._onThemeChanged) this._onThemeChanged = () => this._scheduleLookCheck();
    window.addEventListener("lg-theme-changed", this._onThemeChanged);
    this._scheduleLookCheck();
    if (this._anim) this._startCanvas();
  }

  disconnectedCallback() {
    clearInterval(this._clock);
    if (this._onThemeChanged) window.removeEventListener("lg-theme-changed", this._onThemeChanged);
    cancelAnimationFrame(this._lookRaf);
    this._stopCanvas();
  }

  /* ---------- look (glass | solid) ---------- */

  // Effective look: `look: solid|glass` in the config, else the theme's
  // --lg-look variable on this element (quotes tolerated), else glass.
  _effectiveLook(config) {
    const own = config && config.look;
    if (own === "solid" || own === "glass") return own;
    let v = "";
    try { v = getComputedStyle(this).getPropertyValue("--lg-look"); } catch (e) { v = ""; }
    v = String(v || "").trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase();
    return v === "solid" ? "solid" : "glass";
  }

  // Re-read the theme now and once more on the next frame (the theme may
  // only apply its variables after this element got connected / hass).
  _scheduleLookCheck() {
    this._checkLook();
    cancelAnimationFrame(this._lookRaf);
    this._lookRaf = requestAnimationFrame(() => this._checkLook());
  }

  _checkLook() {
    const c = this._config;
    if (!c || c.look === "solid" || c.look === "glass") return;
    const solid = this._effectiveLook(c) === "solid";
    // The DOM depends on the look (canvas, scene markup), so rebuild as if
    // setConfig had run again with the same config.
    if (solid !== this._solid) this.setConfig(c);
  }

  _stopCanvas() {
    cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  }

  static _shade(v, maxWhite, maxBlack) {
    const n = Number(v) || 0;
    if (n >= 0) return "rgba(255,255,255," + ((n / 100) * maxWhite).toFixed(3) + ")";
    return "rgba(18,20,26," + ((Math.abs(n) / 100) * maxBlack).toFixed(3) + ")";
  }

  _build() {
    const style = document.createElement("style");
    style.textContent = `
      :host { display:block; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
      .card { position:relative; border-radius:var(--lg-radius, 22px); overflow:hidden; cursor:pointer;
        background:${WeatherGlassCard._shade(this._panelShade, 0.3, 0.6)};
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 20px 40px -20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter:${this._config.blur != null ? `blur(${this._blur}px) saturate(180%)` : `var(--lg-backdrop, blur(${this._blur}px) saturate(180%))`};
        -webkit-backdrop-filter:${this._config.blur != null ? `blur(${this._blur}px) saturate(180%)` : `var(--lg-backdrop, blur(${this._blur}px) saturate(180%))`}; }
      .tint { position:absolute; inset:0; pointer-events:none; transition:background 700ms ease; }
      .sheen { position:absolute; inset:0; pointer-events:none;
        background:linear-gradient(155deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 28%, transparent 55%); }
      canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
      .inner { position:relative; padding:22px 24px 20px; }
      .top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .loc { color:var(--primary-text-color,#fff); font-size:15px; font-weight:600; letter-spacing:.2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .date { color:rgba(255,255,255,.45); font-size:11.5px; font-weight:500; margin-top:3px; }
      .clock { color:var(--primary-text-color,#fff); font-size:22px; font-weight:300; letter-spacing:1px; font-variant-numeric:tabular-nums; text-align:right; }
      .hero { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:18px 0 4px; }
      .tempRow { display:flex; align-items:flex-start; color:var(--primary-text-color,#fff); }
      .tempRow b { font-size:74px; font-weight:200; line-height:.86; letter-spacing:-3px; font-variant-numeric:tabular-nums; }
      .tempRow i { font-style:normal; font-size:26px; font-weight:200; line-height:1; margin-top:4px; }
      .cond { color:rgba(255,255,255,.72); font-size:14px; font-weight:600; margin-top:6px; }
      .hl { display:flex; align-items:center; gap:10px; color:rgba(255,255,255,.5); font-size:12px; font-weight:600; margin-top:6px; font-variant-numeric:tabular-nums; }
      .hl span.sep { width:1px; height:10px; background:rgba(255,255,255,.2); }
      .chips { display:flex; align-items:center; gap:8px; margin-top:10px; flex-wrap:wrap; }
      .chip { display:flex; align-items:center; gap:6px; padding:5px 10px; border-radius:10px; cursor:pointer;
        background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.10); transition:background .2s ease; }
      .chip:hover { background:rgba(255,255,255,.14); }
      .chip ha-icon { --mdc-icon-size:14px; color:rgba(255,255,255,.75); }
      .chip span { color:rgba(255,255,255,.85); font-size:11.5px; font-weight:600; white-space:nowrap; }
      .chip.chip-warn { background:rgba(255,159,67,.16); border-color:rgba(255,159,67,.38); }
      .chip-warn-icon { --mdc-icon-size:13px; color:#ff9f43 !important; }
      .scene { position:relative; width:112px; height:104px; flex:0 0 auto; }
      .sun { position:absolute; top:10px; right:14px; width:56px; height:56px; }
      .sun .halo { position:absolute; inset:-18px; border-radius:50%; background:radial-gradient(circle, rgba(255,196,92,.55), transparent 68%); animation:wgc-halo 5s ease-in-out infinite; }
      .sun .disc { position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle at 34% 30%, #fff6dd 0%, #ffd27a 45%, #ff9f43 100%);
        box-shadow:0 0 26px rgba(255,178,74,.6), inset 0 1px 2px rgba(255,255,255,.8); }
      .moon { position:absolute; top:14px; right:20px; width:50px; height:50px; border-radius:50%;
        background:radial-gradient(circle at 36% 32%, #f3f6ff 0%, #cfd8ee 55%, #9aa8c6 100%);
        box-shadow:0 0 30px rgba(160,190,255,.45), inset -6px -4px 12px rgba(90,105,140,.5); }
      .cloud { position:absolute; left:6px; bottom:26px; width:92px; height:44px; animation:wgc-drift 9s ease-in-out infinite; }
      .cloud .base { position:absolute; left:0; bottom:0; width:92px; height:24px; border-radius:14px;
        background:linear-gradient(180deg, rgba(255,255,255,.92), rgba(206,218,238,.72));
        box-shadow:0 8px 20px -8px rgba(0,0,0,.55), inset 0 1px 1px rgba(255,255,255,.9); }
      .cloud .p1 { position:absolute; left:14px; bottom:12px; width:40px; height:40px; border-radius:50%; background:linear-gradient(160deg,#fff,rgba(214,225,243,.85)); }
      .cloud .p2 { position:absolute; left:44px; bottom:8px; width:30px; height:30px; border-radius:50%; background:linear-gradient(160deg,#f7fafe,rgba(200,213,235,.85)); }
      .bolt { position:absolute; left:44px; bottom:2px; width:20px; height:30px; background:linear-gradient(180deg,#fff6c9,#ffcf4d);
        clip-path:polygon(58% 0%,18% 56%,46% 56%,32% 100%,82% 40%,52% 40%); filter:drop-shadow(0 0 10px rgba(255,206,64,.8)); animation:wgc-bolt 3.4s linear infinite; }
      .fog { position:absolute; left:12px; bottom:6px; display:flex; flex-direction:column; gap:6px; }
      .fog i { display:block; height:5px; border-radius:3px; background:rgba(255,255,255,.45); animation:wgc-fogline 6.5s ease-in-out infinite; }
      .fog i:nth-child(1){ width:78px; } .fog i:nth-child(2){ width:62px; animation-duration:7.5s; animation-direction:reverse; } .fog i:nth-child(3){ width:70px; animation-duration:8.5s; }
      .rule { height:1px; margin:16px 0 12px; background:linear-gradient(90deg, transparent, rgba(255,255,255,.14) 20%, rgba(255,255,255,.14) 80%, transparent); }
      .rows { display:flex; flex-direction:column; gap:2px; }
      .row { display:grid; grid-template-columns:52px 30px 34px 1fr 34px; align-items:center; gap:10px; padding:7px 8px; border-radius:12px; transition:background .2s ease; }
      .row:hover { background:rgba(255,255,255,.07); }
      .row .day { color:rgba(255,255,255,.86); font-size:13px; font-weight:600; }
      .row .lo { color:rgba(255,255,255,.45); font-size:12.5px; font-weight:600; text-align:right; font-variant-numeric:tabular-nums; }
      .row .hi { color:var(--primary-text-color,#fff); font-size:12.5px; font-weight:600; font-variant-numeric:tabular-nums; }
      .track { position:relative; height:5px; border-radius:3px; background:rgba(255,255,255,.10); overflow:hidden; }
      .track div { position:absolute; top:0; bottom:0; border-radius:3px; background:linear-gradient(90deg,#6cc7ff,#f7d15f 55%,#ff9b52); box-shadow:0 0 8px rgba(255,255,255,.25); }
      .mini { position:relative; width:26px; height:26px; }
      .mini .s { position:absolute; top:4px; left:4px; width:18px; height:18px; border-radius:50%;
        background:radial-gradient(circle at 34% 30%, #fff6dd, #ffc465 60%, #ff9f43); box-shadow:0 0 10px rgba(255,178,74,.55); }
      .mini .cb { position:absolute; left:1px; top:7px; width:24px; height:12px; border-radius:7px; background:linear-gradient(180deg, rgba(255,255,255,.9), rgba(204,216,238,.7)); }
      .mini .cp { position:absolute; left:6px; top:2px; width:12px; height:12px; border-radius:50%; background:#fff; }
      .mini .d1,.mini .d2 { position:absolute; bottom:0; width:2px; height:6px; border-radius:2px; background:rgba(150,205,255,.95); animation:wgc-fall 1.1s linear infinite; }
      .mini .d1 { left:6px; } .mini .d2 { left:13px; animation-delay:.4s; opacity:.8; }
      .mini .f1,.mini .f2 { position:absolute; bottom:1px; width:3px; height:3px; border-radius:50%; background:#fff; animation:wgc-flake 1.6s linear infinite; }
      .mini .f1 { left:7px; } .mini .f2 { left:15px; animation-delay:.6s; }
      .mini .b { position:absolute; left:10px; bottom:-1px; width:8px; height:12px; background:#ffd24d;
        clip-path:polygon(58% 0%,18% 56%,46% 56%,32% 100%,82% 40%,52% 40%); animation:wgc-bolt 3s linear infinite; }
      .err { padding:20px; color:#ffb4b4; font-size:13px; }
      .top-right { display:flex; align-items:center; gap:10px; flex:0 0 auto; }
      .warn-slots { display:flex; align-items:center; gap:6px; }
      .warn-badge { width:30px; height:30px; border-radius:50%; flex:0 0 auto;
        display:none; align-items:center; justify-content:center; cursor:pointer;
        background:color-mix(in srgb, var(--warn-badge-color,#ff9800) 22%, transparent);
        border:1px solid color-mix(in srgb, var(--warn-badge-color,#ff9800) 55%, transparent);
        box-shadow:0 4px 14px -4px color-mix(in srgb, var(--warn-badge-color,#ff9800) 65%, transparent);
        animation:wgc-warn-pulse 1.4s ease-in-out infinite; }
      .warn-badge ha-icon { --mdc-icon-size:17px; color:var(--warn-badge-color,#ff9800); }
      /* look: solid - calm solid panel instead of frosted glass: no blur,
         no tint/sheen gradients, no glows or soft shadows, flat icons that
         keep still. Colours come from the page's design tokens (--surface,
         --lg-tile-bg, text colours) with fallbacks. Only applies with the
         .solid class, the glass rules above stay untouched. */
      .card.solid { background:var(--lg-tile-bg, var(--surface, color-mix(in srgb, var(--card-background-color, #1c1f28) 88%, transparent)));
        border: var(--lg-tile-edge, 1px solid rgba(255,255,255,0.06)); border-radius:var(--lg-radius, 20px); box-shadow: var(--lg-tile-shadow, none);
        backdrop-filter: var(--lg-panel-backdrop, none); -webkit-backdrop-filter: var(--lg-panel-backdrop, none); }
      .card.solid .tint, .card.solid .sheen { display:none; }
      .card.solid .inner { padding:16px; }
      .card.solid .loc { font-size:15px; font-weight:600; }
      .card.solid .date { color:var(--secondary-text-color, rgba(255,255,255,.6)); font-size:13px; font-weight:400; }
      .card.solid .cond { color:var(--primary-text-color,#fff); font-size:15px; font-weight:400; }
      .card.solid .hl { color:var(--secondary-text-color, rgba(255,255,255,.6)); font-size:13px; font-weight:500; }
      .card.solid .hl span.sep { background:color-mix(in srgb, var(--primary-text-color,#fff) 20%, transparent); }
      .card.solid .chip { padding:6px 10px; background:var(--lg-tile-bg, color-mix(in srgb, var(--primary-text-color,#fff) 8%, transparent));
        border:var(--lg-tile-edge, 1px solid rgba(255,255,255,0.04)); box-shadow:var(--lg-tile-shadow, none); border-radius:calc(var(--lg-radius, 20px) - 4px); }
      .card.solid .chip:hover { background:color-mix(in srgb, var(--primary-text-color,#fff) 6%, var(--lg-tile-bg, color-mix(in srgb, var(--primary-text-color,#fff) 8%, transparent))); }
      .card.solid .chip ha-icon { --mdc-icon-size:16px; color:var(--secondary-text-color, rgba(255,255,255,.6)); }
      .card.solid .chip span { color:var(--primary-text-color,#fff); font-size:13px; font-weight:500; }
      .card.solid .chip.chip-warn { background:color-mix(in srgb, #ff9f43 20%, var(--lg-tile-bg, color-mix(in srgb, var(--primary-text-color,#fff) 8%, transparent))); }
      .card.solid .chip-warn-icon { --mdc-icon-size:16px; }
      .card.solid .scene *, .card.solid .mini * { animation:none; }
      .card.solid .sun .halo { display:none; }
      .card.solid .sun .disc, .card.solid .mini .s { background:#ffc857; box-shadow:none; }
      .card.solid .moon, .card.solid .mini .s.moon-s { background:#dfe5f2; box-shadow:none; }
      .card.solid .cloud .base, .card.solid .cloud .p1, .card.solid .cloud .p2,
      .card.solid .mini .cb, .card.solid .mini .cp { background:#eef2f8; box-shadow:none; }
      .card.solid .bolt { background:#ffd24d; filter:none; }
      .card.solid .fog i { background:color-mix(in srgb, var(--primary-text-color,#fff) 45%, transparent); }
      .card.solid .rule { display:none; }
      .card.solid .rows { margin-top:16px; padding:4px; gap:0;
        background:var(--lg-tile-bg, color-mix(in srgb, var(--primary-text-color,#fff) 8%, transparent));
        border:var(--lg-tile-edge, 1px solid rgba(255,255,255,0.04)); box-shadow:var(--lg-tile-shadow, none); border-radius:calc(var(--lg-radius, 20px) - 4px); }
      .card.solid .row { grid-template-columns:56px 30px 40px 1fr 40px; padding:8px 10px; border-radius:calc(var(--lg-radius, 20px) - 8px); }
      .card.solid .row:hover { background:color-mix(in srgb, var(--primary-text-color,#fff) 6%, transparent); }
      .card.solid .row .day { color:var(--primary-text-color,#fff); font-size:15px; font-weight:500; }
      .card.solid .row .lo { color:var(--secondary-text-color, rgba(255,255,255,.6)); font-size:15px; font-weight:500; }
      .card.solid .row .hi { font-size:15px; font-weight:500; }
      .card.solid .track { height:6px; background:color-mix(in srgb, var(--primary-text-color,#fff) 10%, transparent); }
      .card.solid .track div { background:color-mix(in srgb, var(--primary-text-color,#fff) 60%, transparent); box-shadow:none; }
      .card.solid .err { font-size:13px; }
      .card.solid .warn-badge { width:36px; height:36px; background:var(--warn-badge-color,#ff9800); border:none; box-shadow:none; }
      .card.solid .warn-badge ha-icon { --mdc-icon-size:20px; color:#16181d; }
      @keyframes wgc-halo { 0%,100%{ transform:scale(1); opacity:.55; } 50%{ transform:scale(1.14); opacity:.9; } }
      @keyframes wgc-drift { 0%{ transform:translateX(-6px);} 50%{ transform:translateX(6px);} 100%{ transform:translateX(-6px);} }
      @keyframes wgc-fall { 0%{ transform:translateY(-6px); opacity:0;} 25%{opacity:1;} 100%{ transform:translateY(20px); opacity:0;} }
      @keyframes wgc-flake { 0%{ transform:translate(0,-4px); opacity:0;} 30%{opacity:1;} 100%{ transform:translate(4px,20px); opacity:0;} }
      @keyframes wgc-bolt { 0%,88%,100%{opacity:.25;} 90%,96%{opacity:1;} 93%{opacity:.4;} }
      @keyframes wgc-fogline { 0%,100%{ transform:translateX(-8px); opacity:.35;} 50%{ transform:translateX(8px); opacity:.85;} }
      @keyframes wgc-warn-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.55; transform:scale(1.18); } }
      @media (prefers-reduced-motion: reduce) { * { animation:none !important; } }
      @media (prefers-reduced-motion: reduce) { .card.solid .chip, .card.solid .row { transition:none; } }
    `;
    this.shadowRoot.appendChild(style);

    this._card = document.createElement("div");
    this._card.className = "card" + (this._solid ? " solid" : "");
    this._card.innerHTML = `<div class="tint"></div><div class="sheen"></div>${this._anim ? '<canvas></canvas>' : ""}<div class="inner"></div>`;
    this._card.addEventListener("click", () => this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: this._config.entity }, bubbles: true, composed: true
    })));
    this.shadowRoot.appendChild(this._card);
    this._tintEl = this._card.querySelector(".tint");
    this._inner = this._card.querySelector(".inner");
    this._canvas = this._card.querySelector("canvas");

    // Delegated click handler for the UV/pollen chips - delegated because
    // .inner's innerHTML (and therefore the chip nodes) gets rebuilt on
    // every _render(). Stops propagation so the card's own click listener
    // (which opens the weather entity's more-info dialog) doesn't also
    // fire - tapping a chip should only navigate to its own pop-up. Each
    // chip carries data-popup="uv"|"pollen" (see _render()) so the two
    // chips can point at two different hashes.
    this._inner.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      e.stopPropagation();
      const hash = chip.dataset.popup === "pollen" ? this._pollenNavigate : this._uvNavigate;
      history.pushState(null, "", hash);
      window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
    });

    // optional warning badges - one per entry in this._warnings, each shown
    // when its entity is "on". They live as persistent, detached nodes
    // re-parented into the ".warn-slots" placeholder next to the clock on
    // every full re-render (see _render()) - that keeps them in normal flex
    // flow (no absolute-position collisions with the clock) while surviving
    // .inner's innerHTML rebuilds.
    // Tapping one does NOT open the weather entity's more-info dialog (that's
    // the card's own default tap action) - it navigates like a Lovelace
    // tap_action: navigate would, so it can open a dedicated popup.
    // Note: UV/pollen are deliberately NOT in this list - they're everyday
    // info, not alerts, so they render as plain ".chip" elements inside
    // innerHTML instead (see _render()). Pollen additionally gets an inline
    // chip-warn triangle (no pulse/click behaviour of its own) once its
    // Gefahrenindex reaches 2 - see the pollen chip markup in _render().
    this._warnBadges = this._warnings.map((w) => {
      const el = document.createElement("div");
      el.className = "warn-badge";
      el.innerHTML = "<ha-icon></ha-icon>";
      el.style.setProperty("--warn-badge-color", w.color);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        history.pushState(null, "", w.navigate);
        window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
      });
      return { config: w, el };
    });
  }

  /* ---------- forecast ---------- */

  _forecastStale() {
    return !this._fcAt || (Date.now() - this._fcAt) > 15 * 60 * 1000;
  }

  async _fetchForecast() {
    this._fcAt = Date.now();
    const st = this._hass.states[this._config.entity];
    if (!st) return;
    try {
      const res = await this._hass.callWS({
        type: "call_service",
        domain: "weather",
        service: "get_forecasts",
        service_data: { type: "daily" },
        target: { entity_id: this._config.entity },
        return_response: true
      });
      const list = res && res.response && res.response[this._config.entity]
        ? res.response[this._config.entity].forecast : null;
      if (list && list.length) { this._forecast = list; this._render(); }
    } catch (e) {
      // legacy fallback: forecast attribute (HA < 2024.x)
      if (st.attributes.forecast) { this._forecast = st.attributes.forecast; this._render(); }
    }
  }

  /* ---------- animation ---------- */

  _startCanvas() {
    if (!this._canvas || this._raf) return;
    const cv = this._canvas, ctx = cv.getContext("2d");
    let parts = [], kind = null, flash = 0, last = performance.now();
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this._w = r.width; this._h = r.height;
    };
    this._ro = new ResizeObserver(size);
    this._ro.observe(cv);
    size();
    const seed = (k) => {
      const w = this._w || 1, h = this._h || 1;
      const n = k === "snow" ? 46 : k === "rain" ? 70 : k === "heavy" ? 120 : k === "fog" ? 7 : 0;
      parts = [];
      for (let i = 0; i < n; i++) parts.push({
        x: Math.random() * w, y: Math.random() * h,
        v: k === "snow" ? 14 + Math.random() * 22 : k === "fog" ? 4 + Math.random() * 6 : 190 + Math.random() * 200,
        r: k === "snow" ? .9 + Math.random() * 1.6 : k === "fog" ? 40 + Math.random() * 60 : 5 + Math.random() * 9,
        a: .18 + Math.random() * .5, p: Math.random() * 6.283
      });
    };
    const loop = (t) => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      const tr = this._traits || {};
      const k = tr.snow ? "snow" : tr.heavy ? "heavy" : tr.rain ? "rain" : tr.fog ? "fog" : "none";
      if (k !== kind) { kind = k; seed(k); }
      const w = this._w || 0, h = this._h || 0;
      ctx.clearRect(0, 0, w, h);
      if (kind === "rain" || kind === "heavy") {
        ctx.lineCap = "round"; ctx.lineWidth = 1.1;
        for (const p of parts) {
          p.y += p.v * dt; p.x += p.v * dt * .16;
          if (p.y > h) { p.y = -p.r; p.x = Math.random() * w; }
          ctx.strokeStyle = "rgba(190,225,255," + p.a * .75 + ")";
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.r * .16, p.y - p.r); ctx.stroke();
        }
      } else if (kind === "snow") {
        for (const p of parts) {
          p.p += dt * 1.5; p.y += p.v * dt; p.x += Math.sin(p.p) * 10 * dt;
          if (p.y > h) { p.y = -4; p.x = Math.random() * w; }
          ctx.fillStyle = "rgba(255,255,255," + p.a * .85 + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284); ctx.fill();
        }
      } else if (kind === "fog") {
        for (const p of parts) {
          p.p += dt * .4; p.x += Math.sin(p.p) * p.v * dt * 2;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, "rgba(226,232,240," + p.a * .22 + ")");
          g.addColorStop(1, "rgba(226,232,240,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284); ctx.fill();
        }
      }
      if (tr.bolt) {
        if (flash <= 0 && Math.random() < .006) flash = .34;
        if (flash > 0) {
          flash -= dt;
          ctx.fillStyle = "rgba(226,232,255," + Math.max(0, Math.sin(flash * 22)) * .16 + ")";
          ctx.fillRect(0, 0, w, h);
        }
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  /* ---------- render ---------- */

  _renderClock() {
    if (!this._showClock || !this._clockEl) return;
    const n = new Date(), p = (x) => String(x).padStart(2, "0");
    this._clockEl.textContent = p(n.getHours()) + ":" + p(n.getMinutes());
  }

  _render() {
    if (!this._hass || !this._config) return;
    const st = this._hass.states[this._config.entity];
    if (!st) { this._inner.innerHTML = `<div class="err">Entity nicht gefunden: ${this._config.entity}</div>`; this._lastSig = null; return; }

    // Warning badges - updated unconditionally on every hass push (cheap:
    // just a display/icon toggle per badge), independent of the
    // weather-state dirty-check below, so they react immediately even when
    // the weather itself hasn't changed.
    for (const b of this._warnBadges) {
      const wst = this._hass.states[b.config.entity];
      const active = !!wst && wst.state === "on";
      b.el.style.display = active ? "flex" : "none";
      if (active) {
        const icon = b.config.icon || (wst.attributes && wst.attributes.icon) || "mdi:alert";
        const iconEl = b.el.querySelector("ha-icon");
        if (iconEl && iconEl.getAttribute("icon") !== icon) iconEl.setAttribute("icon", icon);
      }
    }

    const state = st.state;
    const sunSt = this._hass.states["sun.sun"];
    const isNight = !!sunSt && sunSt.state === "below_horizon";
    const visKey = (isNight && NIGHT_VARIANT[state]) || state;
    const tr = TRAITS[visKey] || TRAITS.cloudy;
    this._traits = tr;
    this._tintEl.style.background = tr.tint;

    const unit = st.attributes.temperature_unit || "°";
    const now = new Date();
    const fc = (this._forecast || []).slice(0, this._days);

    const nums = [];
    fc.forEach((d) => {
      if (d.temperature != null) nums.push(d.temperature);
      if (d.templow != null) nums.push(d.templow);
    });
    const gMax = nums.length ? Math.max.apply(null, nums) : 1;
    const gMin = nums.length ? Math.min.apply(null, nums) : 0;
    const span = Math.max(1, gMax - gMin);

    const today = fc[0] || {};
    const hi = today.temperature != null ? Math.round(today.temperature) : null;
    const lo = today.templow != null ? Math.round(today.templow) : null;

    // Home Assistant pushes a fresh `hass` object (and therefore calls this
    // setter) far more often than the displayed data actually changes - e.g.
    // whenever any other unrelated entity on the dashboard updates. Rebuilding
    // .inner's innerHTML on every one of those pushes destroys and recreates
    // the scene icons (sun/cloud/bolt/fog), which restarts their CSS keyframe
    // animations from frame zero each time - that's the twitch/stutter users
    // would see. So: only rebuild the DOM when something we actually display
    // (weather, forecast, UV, or pollen) has changed.
    const curTemp = st.attributes.temperature != null ? Math.round(st.attributes.temperature) : null;
    const humidity = st.attributes.humidity != null ? Math.round(st.attributes.humidity) : null;

    // UV index comes straight off the weather entity - no separate sensor
    // needed. Rounded to 1 decimal so e.g. 6.4 doesn't get lost to Math.round.
    const uvVal = this._showUv && st.attributes.uv_index != null
      ? Math.round(st.attributes.uv_index * 10) / 10 : null;

    // Strongest currently-active pollen type among the configured entities
    // (Pollenflug-style Gefahrenindex 0-3 scale). Shows nothing if the list
    // is empty or every entity is unavailable/NaN.
    let pollenBest = null;
    for (const p of this._pollen) {
      const pst = this._hass.states[p.entity];
      if (!pst) continue;
      const val = parseFloat(pst.state);
      if (isNaN(val)) continue;
      if (!pollenBest || val > pollenBest.val) {
        pollenBest = { val, label: p.label || (pst.attributes && pst.attributes.friendly_name) || p.entity };
      }
    }

    const chips = [];
    if (uvVal != null) chips.push(
      `<div class="chip" data-popup="uv"><ha-icon icon="mdi:weather-sunny"></ha-icon><span>UV ${uvVal} · ${uvLabel(uvVal)}</span></div>`
    );
    if (pollenBest && pollenBest.val > 0) {
      // "Mittel" (2) or higher on the Gefahrenindex scale gets a small
      // inline warning-triangle instead of a separate pulsing badge - keeps
      // pollen inside its own chip/popup instead of the alerts row.
      const pollenWarn = pollenBest.val >= 2;
      chips.push(
        `<div class="chip${pollenWarn ? " chip-warn" : ""}" data-popup="pollen">${pollenWarn ? '<ha-icon class="chip-warn-icon" icon="mdi:alert"></ha-icon>' : ""}<ha-icon icon="mdi:flower-pollen"></ha-icon><span>${pollenBest.label} · ${POLLEN_LEVEL[Math.min(3, Math.max(0, Math.round(pollenBest.val)))]}</span></div>`
      );
    }
    const chipsHtml = chips.length ? `<div class="chips">${chips.join("")}</div>` : "";

    const fcSig = fc.map((d) => d.datetime + "|" + d.condition + "|" + (d.temperature != null ? Math.round(d.temperature) : "x") + "|" + (d.templow != null ? Math.round(d.templow) : "x")).join(",");
    const sig = [state, isNight, curTemp, humidity, unit, this._config.name || "", now.getDate(), fcSig, uvVal, pollenBest ? pollenBest.val : "x"].join("::");
    if (sig === this._lastSig) return;
    this._lastSig = sig;

    const mini = (s) => {
      const t = TRAITS[s] || TRAITS.cloudy;
      return `<div class="mini">
        ${t.sun ? '<div class="s"></div>' : ""}
        ${t.moon ? (this._solid ? '<div class="s moon-s"></div>' : '<div class="s" style="background:radial-gradient(circle at 36% 32%,#f3f6ff,#c3cee6 60%,#94a2c0);box-shadow:0 0 10px rgba(160,190,255,.5)"></div>') : ""}
        ${t.cloud ? '<div class="cb"></div><div class="cp"></div>' : ""}
        ${t.rain && !t.bolt ? '<div class="d1"></div><div class="d2"></div>' : ""}
        ${t.snow ? '<div class="f1"></div><div class="f2"></div>' : ""}
        ${t.bolt ? '<div class="b"></div>' : ""}
      </div>`;
    };

    const rows = fc.map((d, i) => {
      const dt = new Date(d.datetime);
      const max = d.temperature != null ? Math.round(d.temperature) : null;
      const min = d.templow != null ? Math.round(d.templow) : null;
      const left = min != null ? ((min - gMin) / span) * 100 : 0;
      const width = (min != null && max != null) ? ((max - min) / span) * 100 : 0;
      return `<div class="row">
        <div class="day">${i === 0 ? "Heute" : DAYS_SHORT[dt.getDay()] + "."}</div>
        ${mini(d.condition)}
        <div class="lo">${min != null ? min + "°" : "-"}</div>
        <div class="track"><div style="left:${left.toFixed(1)}%;width:${Math.max(width, 4).toFixed(1)}%"></div></div>
        <div class="hi">${max != null ? max + "°" : "-"}</div>
      </div>`;
    }).join("");

    this._inner.innerHTML = `
      <div class="top">
        <div style="min-width:0">
          <div class="loc">${this._config.name || st.attributes.friendly_name || this._config.entity}</div>
          ${this._showClock ? `<div class="date">${DAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}</div>` : ""}
        </div>
        <div class="top-right">
          <div class="warn-slots"></div>
          ${this._showClock ? `<div class="clock"></div>` : ""}
        </div>
      </div>
      <div class="hero">
        <div>
          <div class="tempRow"><b>${st.attributes.temperature != null ? Math.round(st.attributes.temperature) : "-"}</b><i>${unit.replace("C", "").replace("F", "") || "°"}</i></div>
          <div class="cond">${LABELS[state] || state}</div>
          <div class="hl">
            ${hi != null ? `<span>H ${hi}°</span>` : ""}
            ${hi != null && lo != null ? '<span class="sep"></span>' : ""}
            ${lo != null ? `<span>T ${lo}°</span>` : ""}
            ${st.attributes.humidity != null ? `<span class="sep"></span><span>${st.attributes.humidity}%</span>` : ""}
          </div>
          ${chipsHtml}
        </div>
        <div class="scene">
          ${tr.sun ? '<div class="sun"><div class="halo"></div><div class="disc"></div></div>' : ""}
          ${tr.moon ? '<div class="moon"></div>' : ""}
          ${tr.cloud ? '<div class="cloud"><div class="base"></div><div class="p1"></div><div class="p2"></div></div>' : ""}
          ${tr.bolt ? '<div class="bolt"></div>' : ""}
          ${tr.fog ? '<div class="fog"><i></i><i></i><i></i></div>' : ""}
        </div>
      </div>
      <div class="rule"></div>
      <div class="rows">${rows || '<div class="err" style="padding:4px 8px;color:rgba(255,255,255,.45)">Keine Vorhersage verfügbar.</div>'}</div>
    `;
    this._clockEl = this._inner.querySelector(".clock");
    this._renderClock();
    const warnSlots = this._inner.querySelector(".warn-slots");
    if (warnSlots) for (const b of this._warnBadges) warnSlots.appendChild(b.el);
    if (this._anim) this._startCanvas();
  }
}

if (!customElements.get('weather-glass-card-dev')) customElements.define('weather-glass-card-dev', WeatherGlassCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weather-glass-card-dev",
  name: "Weather Glass Card",
  description: "Frosted-glass weather widget with animated conditions, clock, daily min/max forecast, optional warning badges, and UV/pollen chips.",
  preview: true
});
