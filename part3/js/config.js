// ════════════════════════════════════════════════════════════════════════════
// CONFIG — Single source of truth (Lampiran A + Section Tables)
// ════════════════════════════════════════════════════════════════════════════
const _uaStr = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
const _hasTouchInput = (typeof window !== 'undefined') && (('ontouchstart' in window) || ((navigator?.maxTouchPoints || 0) > 0));
const _isCoarsePtr = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(pointer: coarse)').matches : false;
const _isIOSDev = /iPad|iPhone|iPod/.test(_uaStr) || (_uaStr.includes('Mac') && _hasTouchInput && (navigator?.maxTouchPoints || 0) > 1);
const _isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(_uaStr);
const _isMobileDevice = Boolean(_isMobileUA || _isIOSDev || (_hasTouchInput && (_isCoarsePtr || Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 920)));
const _isStandaloneApp = (typeof window !== 'undefined') && (
  Boolean(window.matchMedia && (window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches))
  || Boolean(window.navigator?.standalone)
);

const CONFIG = {
  version: '1.0.0',
  seedDefault: 20261114,
  isMobile: _isMobileDevice,
  isIOS: _isIOSDev,
  isStandalone: _isStandaloneApp,
  hasTouch: _hasTouchInput,
  storageKeys: {
    settings: 'rajawali_settings_v1',
    stats: 'rajawali_stats_v1'
  },
  world: {
    size: 1600,
    halfSize: 800,
    oceanBorder: 400,
    chunk: 100,
    chunksPerSide: 16,
    seaLevel: 0,
    maxHeight: 95,
    collisionCell: 8
  },
  sim: { fixedDt: 1 / 60, maxSubsteps: 5, ballisticDt: 1 / 120, aiHz: _isMobileDevice ? 6 : 10, aiBudgetMs: _isMobileDevice ? 0.9 : 1.5 },
  player: {
    hp: 100, radius: 0.35,
    height: { stand: 1.80, crouch: 1.30, prone: 0.60 },
    eye: { stand: 1.65, crouch: 1.15, prone: 0.45 },
    speed: { sprint: 6.8, jog: 5.0, walk: 2.8, crouch: 2.0, prone: 0.9, backMult: 0.8, strafeMult: 0.9, adsMult: 0.6, heavyMult: 0.95 },
    stanceBlendTime: 0.18,
    gravity: 18, jump: 5.6, stepUp: 0.45, slopeMax: 50,
    vaultMaxH: 1.2, vaultDuration: 0.55,
    climbMaxH: 1.9, climbDuration: 1.1,
    fallDamageStart: 3.5, fallDamagePerM: 12,
    leanAngle: 15, leanOffset: 0.25,
    sprintBreathAfterSec: 6.0
  },
  camera: { fov: 75, near: 0.05, far: 1500, viewmodelFov: 58, tppOffset: [0.45, 0.25, 2.2] },
  ballistics: { gravity: 9.81, maxLife: 3.0, maxDist: 1200, convergence: 80, ballisticDt: 1 / 120 },
  ammoDrag: { '556': 0.0009, '762': 0.0007, '45': 0.0022, '9mm': 0.0020, '12ga': 0.0040, 'rocket': 0.0001 },
  hitMult: { head: 2.35, neck: 1.60, chest: 1.00, abdomen: 0.95, arm: 0.90, leg: 0.80 },
  armor: {
    helm: [ { abs: 0.30, dur: 80 }, { abs: 0.40, dur: 150 }, { abs: 0.55, dur: 230 } ],
    vest: [ { abs: 0.30, dur: 200 }, { abs: 0.40, dur: 220 }, { abs: 0.55, dur: 250 } ]
  },
  zone: [
    { wait: 120, shrink: 90, r0: 780, r1: 520, dps: 1.0 },
    { wait: 100, shrink: 75, r0: 520, r1: 360, dps: 1.5 },
    { wait: 90,  shrink: 65, r0: 360, r1: 240, dps: 2.5 },
    { wait: 80,  shrink: 55, r0: 240, r1: 150, dps: 4.0 },
    { wait: 70,  shrink: 50, r0: 150, r1: 90,  dps: 6.0 },
    { wait: 60,  shrink: 45, r0: 90,  r1: 45,  dps: 8.0 },
    { wait: 50,  shrink: 40, r0: 45,  r1: 20,  dps: 10.0 },
    { wait: 40,  shrink: 35, r0: 20,  r1: 0,   dps: 12.0 }
  ],
  plane: { speed: 60, altitude: 600 },
  fall: { terminal: 78, normal: 55, horizontalMax: 30, chuteOpenAGL: 120, chuteDescend: 6, chuteHorizontal: 14 },
  bots: {
    count: 39,
    difficulty: {
      rookie:  { react: 0.90, err: 3.20, recoilCtrl: 0.40 },
      regular: { react: 0.55, err: 1.60, recoilCtrl: 0.70 },
      veteran: { react: 0.30, err: 0.75, recoilCtrl: 0.90 }
    }
  },
  audio: { master: 0.8, sfx: 1.0, ambient: 0.6, ui: 0.6, music: 0.4, speedOfSound: 343 },
  quality: {
    low:    { label: 'Low',    viewDist: _isMobileDevice ? 440 : 350, cascades: 1, shadowSize: _isMobileDevice ? 768 : 1024, grassDist: 0,  trees: _isMobileDevice ? 4200 : 8000, bloom: false, fxaa: false, particles: _isMobileDevice ? 120 : 200, texRes: 512, dynRes: true, aniso: 2, maxDpr: _isMobileDevice ? 1.5 : 1.5 },
    medium: { label: 'Medium', viewDist: 550, cascades: _isMobileDevice ? 1 : 2, shadowSize: _isMobileDevice ? 768 : 1536, grassDist: _isMobileDevice ? 18 : 40, trees: _isMobileDevice ? 9000 : 18000, bloom: !_isMobileDevice, fxaa: !_isMobileDevice, particles: _isMobileDevice ? 260 : 600, texRes: 512, dynRes: true, aniso: 4, maxDpr: _isMobileDevice ? 1.75 : 2.0 },
    high:   { label: 'High',   viewDist: 800, cascades: 3, shadowSize: 2048, grassDist: 70,  trees: 28000, bloom: true,  fxaa: true,  particles: 1200, texRes: 1024, dynRes: false, aniso: 8,  maxDpr: 2.0 },
    ultra:  { label: 'Ultra',  viewDist: 1100, cascades: 4, shadowSize: 2048, grassDist: 100, trees: 38000, bloom: true,  fxaa: true,  particles: 2000, texRes: 1024, dynRes: false, aniso: 16, maxDpr: 2.0 }
  },
  timeOfDay: {
    pagi:  { label: 'Pagi',  elevation: 22,  azimuth: 115, exposure: 1.00, sunColor: 0xFFE3B8, sunInt: 2.9, hemiSky: 0x90C5EE, hemiGnd: 0x566048, hemiInt: 0.92, fogColor: 0x99BED9, fogDensity: 0.00038, skyTop: 0x1D4E89, skyBot: 0xE6B98A, night: false },
    siang: { label: 'Siang', elevation: 58,  azimuth: 155, exposure: 1.00, sunColor: 0xFFF7EA, sunInt: 3.3, hemiSky: 0x86CAF8, hemiGnd: 0x5B664C, hemiInt: 1.02, fogColor: 0x88BEE2, fogDensity: 0.00020, skyTop: 0x1557A8, skyBot: 0x8BC6EE, night: false },
    sore:  { label: 'Sore',  elevation: 12,  azimuth: 252, exposure: 0.98, sunColor: 0xFF9C54, sunInt: 2.7, hemiSky: 0xDC926E, hemiGnd: 0x453C32, hemiInt: 0.80, fogColor: 0xC48A69, fogDensity: 0.00042, skyTop: 0x263B6B, skyBot: 0xEA7E48, night: false },
    malam: { label: 'Malam', elevation: 32,  azimuth: 215, exposure: 1.08, sunColor: 0xA8C8FF, sunInt: 1.18, hemiSky: 0x3A5484, hemiGnd: 0x222C26, hemiInt: 0.86, fogColor: 0x0E1726, fogDensity: 0.00068, skyTop: 0x040914, skyBot: 0x182A48, night: true }
  },
  weather: {
    cerah:  { label: 'Cerah',  fogMult: 1.0, rain: 0.0, wind: 1.0, wet: 0.0 },
    mendung:{ label: 'Mendung',fogMult: 1.5, rain: 0.0, wind: 1.4, wet: 0.1 },
    kabut:  { label: 'Kabut',  fogMult: 3.4, rain: 0.0, wind: 0.7, wet: 0.25 },
    hujan:  { label: 'Hujan',  fogMult: 2.1, rain: 1.0, wind: 2.2, wet: 1.0 }
  },
  pois: [
    { id: 'pelabuhan', name: 'Pelabuhan Karang',  x: -440, z: 540,  w: 350, h: 250, tier: 3, kind: 'port',    targetH: 3.2 },
    { id: 'sukamaju',  name: 'Desa Sukamaju',     x: -110, z: 280,  w: 240, h: 240, tier: 2, kind: 'village', targetH: 14.0 },
    { id: 'pabrik',    name: 'Pabrik Tua',        x: -420, z: 40,   w: 220, h: 180, tier: 3, kind: 'factory', targetH: 18.0 },
    { id: 'pangkalan', name: 'Pangkalan Elang',   x: 430,  z: 420,  w: 420, h: 260, tier: 3, kind: 'airbase', targetH: 10.0 },
    { id: 'kotamini',  name: 'Kota Piccadilly',   x: 160,  z: 90,   w: 340, h: 340, tier: 3, kind: 'urban',   targetH: 20.0 },
    { id: 'bukitpinus',name: 'Bukit Pinus',       x: -430, z: -380, w: 300, h: 300, tier: 1, kind: 'forest',  targetH: 52.0 },
    { id: 'menara',    name: 'Menara Radio',      x: -20,  z: -240, w: 120, h: 120, tier: 2, kind: 'Peak',    targetH: 82.0 },
    { id: 'pantai',    name: 'Pantai Selatan',    x: 100,  z: 610,  w: 400, h: 140, tier: 1, kind: 'beach',   targetH: 2.2 },
    { id: 'benteng',   name: 'Benteng Batu',      x: 470,  z: -380, w: 200, h: 200, tier: 3, kind: 'fort',    targetH: 48.0 },
    { id: 'pompa',     name: 'Stasiun Pompa',     x: -220, z: -120, w: 160, h: 160, tier: 2, kind: 'pump',    targetH: 11.0 },
    { id: 'nelayan',   name: 'Kampung Nelayan',   x: 560,  z: -20,  w: 220, h: 180, tier: 2, kind: 'dock',    targetH: 2.5 },
    { id: 'ladang',    name: 'Ladang Tengah',     x: -80,  z: -20,  w: 280, h: 220, tier: 2, kind: 'farm',    targetH: 15.0 }
  ],
  defaultKeybinds: {
    forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
    sprint: 'ShiftLeft', walk: 'AltLeft', jump: 'Space', crouch: 'KeyC', prone: 'KeyZ',
    leanLeft: 'KeyQ', leanRight: 'KeyE', reload: 'KeyR', fireMode: 'KeyB',
    interact: 'KeyF', inventory: 'Tab', map: 'KeyM', perspective: 'KeyV',
    grenade: 'KeyG', healMedkit: 'Digit7', healFirstAid: 'Digit8', healBandage: 'Digit9', healBoost: 'Digit0',
    zeroUp: 'PageUp', zeroDown: 'PageDown', inspect: 'KeyI', melee: 'KeyX', flashlight: 'KeyT'
  },
  defaultSettings: {
    preset: 'medium',
    resScale: 1.0,
    viewDist: 550,
    shadowCascades: 2,
    grassDist: 40,
    bloom: true,
    fov: 75,
    fpsCap: 60,
    showFps: true,
    sensitivity: 1.0,
    adsSens: 0.72,
    invertY: false,
    crouchToggle: true,
    adsHold: true,
    sprintHold: true,
    gamepadEnabled: true,
    audioMaster: 0.8,
    audioSfx: 1.0,
    audioAmbient: 0.6,
    audioUi: 0.6,
    audioMusic: 0.4,
    audioHrtf: true,
    lang: 'id',
    bloodFx: true,
    hitMarkers: true,
    crosshairColor: '#EDEFF1',
    autoPickup: false,
    autoSprint: false,
    defaultTpp: false,
    colorblind: 'none',
    uiScale: 100,
    reduceShake: false,
    subtitles: true,
    touchControls: 'auto',
    keybinds: null // populated on clone
  },
  mobileDefaults: {
    preset: 'low',
    resScale: 1.0,
    viewDist: 440,
    shadowCascades: 1,
    grassDist: 0,
    bloom: false,
    fpsCap: 60,
    showFps: false,
    sensitivity: 1.15,
    adsHold: false,
    crouchToggle: true,
    autoSprint: true,
    touchControls: 'auto'
  }
};
CONFIG.defaultSettings.keybinds = { ...CONFIG.defaultKeybinds };

// ════════════════════════════════════════════════════════════════════════════
// UTIL — Seeded PRNG, Noise (Simplex/Value FBM + Ridged), Math, Pools, Storage
// ════════════════════════════════════════════════════════════════════════════
const Util = (() => {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(ix, iy, seed = 1337) {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

  // Fast deterministic 2D gradient noise in [-1, 1]
  function valueNoise2D(x, y, seed = 101) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = hash2(ix, iy, seed);
    const b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed);
    const d = hash2(ix + 1, iy + 1, seed);
    return (lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2) - 1;
  }

  function fbm2D(x, y, octaves = 5, lacunarity = 2.02, gain = 0.5, seed = 101) {
    let sum = 0, amp = 0.5, freq = 1.0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 71);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  function ridged2D(x, y, octaves = 4, seed = 404) {
    let sum = 0, amp = 0.5, freq = 1.0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1.0 - Math.abs(valueNoise2D(x * freq, y * freq, seed + i * 97));
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return sum / norm;
  }

  function distToSegmentSq(px, pz, ax, az, bx, bz) {
    const abx = bx - ax, abz = bz - az;
    const apx = px - ax, apz = pz - az;
    const abLenSq = abx * abx + abz * abz;
    if (abLenSq <= 1e-6) return apx * apx + apz * apz;
    const t = clamp((apx * abx + apz * abz) / abLenSq, 0, 1);
    const dx = ax + t * abx - px;
    const dz = az + t * abz - pz;
    return dx * dx + dz * dz;
  }

  function loadStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  const nextFrame = () => new Promise((res) => requestAnimationFrame(() => res()));

  // Scratch vectors to prevent hot-loop allocations
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const m4 = new THREE.Matrix4();

  return {
    mulberry32, hash2, smoothstep, clamp, lerp, damp,
    valueNoise2D, fbm2D, ridged2D, distToSegmentSq,
    loadStorage, saveStorage, nextFrame,
    v1, v2, v3, m4
  };
})();

