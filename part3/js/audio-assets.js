// ════════════════════════════════════════════════════════════════════════════
// AUDIO — WebAudio Procedural Synthesizer, Mixer, Reverb Convolver, Ambient
// ════════════════════════════════════════════════════════════════════════════
const AudioSys = (() => {
  let ctx = null;
  let initialized = false;
  let masterGain = null, compNode = null, limiter = null;
  let buses = {};
  let reverbNode = null, reverbIndoorNode = null;
  let noiseBuffer = null;
  let ambientLoop = null;
  let hrtfEnabled = true;

  function ensureInit() {
    if (initialized) {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    compNode = ctx.createDynamicsCompressor();
    compNode.threshold.value = -12;
    compNode.ratio.value = 3;
    compNode.attack.value = 0.005;
    compNode.release.value = 0.15;

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;

    masterGain = ctx.createGain();
    masterGain.gain.value = CONFIG.audio.master;

    compNode.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(ctx.destination);

    buses = {
      sfx: ctx.createGain(),
      ambient: ctx.createGain(),
      ui: ctx.createGain(),
      music: ctx.createGain()
    };
    buses.sfx.gain.value = CONFIG.audio.sfx;
    buses.ambient.gain.value = CONFIG.audio.ambient;
    buses.ui.gain.value = CONFIG.audio.ui;
    buses.music.gain.value = CONFIG.audio.music;
    Object.values(buses).forEach(b => b.connect(compNode));

    // Shared 2-second noise buffer
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Procedural outdoor & indoor impulse responses
    reverbNode = ctx.createConvolver();
    reverbNode.buffer = buildImpulse(1.4, 3.2);
    const revOutGain = ctx.createGain();
    revOutGain.gain.value = 0.25;
    reverbNode.connect(revOutGain);
    revOutGain.connect(buses.sfx);

    reverbIndoorNode = ctx.createConvolver();
    reverbIndoorNode.buffer = buildImpulse(0.48, 4.5);
    const revInGain = ctx.createGain();
    revInGain.gain.value = 0.35;
    reverbIndoorNode.connect(revInGain);
    revInGain.connect(buses.sfx);

    startAmbientBed();
    initialized = true;
    return true;
  }

  function buildImpulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function startAmbientBed() {
    if (!ctx || ambientLoop) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.7;

    const g = ctx.createGain();
    g.gain.value = 0.14;
    src.connect(filter);
    filter.connect(g);
    g.connect(buses.ambient);
    src.start();
    ambientLoop = { src, filter, gain: g };
  }

  function updateAmbient(windFactor, rainFactor) {
    if (!ambientLoop || !ctx) return;
    const freq = 260 + windFactor * 220 + rainFactor * 1450;
    const gain = 0.08 + windFactor * 0.06 + rainFactor * 0.18;
    ambientLoop.filter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.2);
    ambientLoop.gain.gain.setTargetAtTime(gain, ctx.currentTime, 0.2);
  }

  function applySettings(s) {
    hrtfEnabled = !!s.audioHrtf;
    if (!initialized || !ctx) return;
    const t = ctx.currentTime;
    masterGain.gain.setTargetAtTime(s.audioMaster, t, 0.05);
    buses.sfx.gain.setTargetAtTime(s.audioSfx, t, 0.05);
    buses.ambient.gain.setTargetAtTime(s.audioAmbient, t, 0.05);
    buses.ui.gain.setTargetAtTime(s.audioUi, t, 0.05);
    buses.music.gain.setTargetAtTime(s.audioMusic, t, 0.05);
  }

  function playUiTone(kind = 'click') {
    if (!ensureInit()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    if (kind === 'hover') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, t);
      osc.frequency.exponentialRampToValueAtTime(780, t + 0.03);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      osc.connect(g); g.connect(buses.ui);
      osc.start(t); osc.stop(t + 0.04);
    } else if (kind === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.setValueAtTime(680, t + 0.08);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g); g.connect(buses.ui);
      osc.start(t); osc.stop(t + 0.22);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.045);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(g); g.connect(buses.ui);
      osc.start(t); osc.stop(t + 0.055);
    }
  }

  const SHOT_RECIPES = {
    ar_556:   { crackHz: 4400, bodyHz: 960,  thumpHz: 70,  tail: 0.7, range: 800 },
    ar_762:   { crackHz: 3700, bodyHz: 680,  thumpHz: 55,  tail: 0.9, range: 900 },
    smg_45:   { crackHz: 3400, bodyHz: 1100, thumpHz: 90,  tail: 0.4, range: 500 },
    pistol_9: { crackHz: 4000, bodyHz: 1320, thumpHz: 100, tail: 0.3, range: 350 },
    sr:       { crackHz: 3000, bodyHz: 520,  thumpHz: 45,  tail: 1.6, range: 1200 },
    shotgun:  { crackHz: 2500, bodyHz: 440,  thumpHz: 50,  tail: 0.8, range: 600 },
    melee:    { crackHz: 1200, bodyHz: 420,  thumpHz: 110, tail: 0.15, range: 30 }
  };

  let listenerPos = new THREE.Vector3();

  function updateListener(pos, fwd, up) {
    listenerPos.copy(pos);
    if (!initialized || !ctx) return;
    const L = ctx.listener;
    if (L.positionX) {
      const t = ctx.currentTime;
      L.positionX.setValueAtTime(pos.x, t);
      L.positionY.setValueAtTime(pos.y, t);
      L.positionZ.setValueAtTime(pos.z, t);
      L.forwardX.setValueAtTime(fwd.x, t);
      L.forwardY.setValueAtTime(fwd.y, t);
      L.forwardZ.setValueAtTime(fwd.z, t);
      L.upX.setValueAtTime(up.x, t);
      L.upY.setValueAtTime(up.y, t);
      L.upZ.setValueAtTime(up.z, t);
    } else if (L.setPosition) {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  function routeSpatial(pos, maxDist, occluded = false) {
    const dest = buses.sfx;
    if (!pos) return { out: dest, delay: 0, gainScale: 1.0, filterHz: 18000 };
    const dist = listenerPos.distanceTo(pos);
    const delay = dist > 4 ? dist / CONFIG.audio.speedOfSound : 0;
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.06;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = occluded ? 1100 : Math.max(1200, 16000 - dist * 22);

    const panner = ctx.createPanner();
    panner.panningModel = hrtfEnabled ? 'HRTF' : 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 4;
    panner.maxDistance = maxDist;
    panner.rolloffFactor = 1.0;
    if (panner.positionX) {
      panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z;
    } else {
      panner.setPosition(pos.x, pos.y, pos.z);
    }
    filter.connect(panner);
    panner.connect(dest);
    return { out: filter, delay, gainScale: occluded ? 0.38 : 1.0, dist, pitchJitter };
  }

  function playGunshot(recipeKey = 'ar_556', pos = null, suppressed = false, occluded = false, indoor = false) {
    if (!ensureInit()) return;
    const r = SHOT_RECIPES[recipeKey] || SHOT_RECIPES.ar_556;
    const maxRange = suppressed ? 120 : r.range;
    const sp = pos ? routeSpatial(pos, maxRange, occluded) : { out: buses.sfx, delay: 0, gainScale: 1.0, dist: 0, pitchJitter: 1 + (Math.random() - 0.5) * 0.06 };
    if (sp.dist > maxRange) return;

    const t = ctx.currentTime + sp.delay;
    const gMaster = ctx.createGain();
    gMaster.gain.value = sp.gainScale * (suppressed ? 0.42 : 0.92);
    gMaster.connect(sp.out);
    if (!suppressed) gMaster.connect(indoor ? reverbIndoorNode : reverbNode);

    // 1. Highpass Crack / Transient (12ms)
    const nCrack = ctx.createBufferSource();
    nCrack.buffer = noiseBuffer;
    nCrack.playbackRate.value = sp.pitchJitter;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = suppressed ? r.crackHz * 0.55 : r.crackHz;
    const gCrack = ctx.createGain();
    gCrack.gain.setValueAtTime(suppressed ? 0.25 : 0.95, t);
    gCrack.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
    nCrack.connect(hp); hp.connect(gCrack); gCrack.connect(gMaster);
    nCrack.start(t, Math.random() * 1.2, 0.04);

    // 2. Caliber Body Bandpass
    const nBody = ctx.createBufferSource();
    nBody.buffer = noiseBuffer;
    nBody.playbackRate.value = sp.pitchJitter;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (suppressed ? r.bodyHz * 0.65 : r.bodyHz) * sp.pitchJitter;
    bp.Q.value = 1.2;
    const gBody = ctx.createGain();
    gBody.gain.setValueAtTime(suppressed ? 0.35 : 0.85, t);
    gBody.gain.exponentialRampToValueAtTime(0.001, t + (suppressed ? 0.09 : Math.min(0.45, r.tail * 0.45)));
    nBody.connect(bp); bp.connect(gBody); gBody.connect(gMaster);
    nBody.start(t, Math.random() * 1.1, 0.5);

    // 3. Low Thump punch
    const thump = ctx.createOscillator();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(r.thumpHz * 2.2, t);
    thump.frequency.exponentialRampToValueAtTime(Math.max(28, r.thumpHz * 0.7), t + 0.085);
    const gThump = ctx.createGain();
    gThump.gain.setValueAtTime(suppressed ? 0.3 : 0.82, t);
    gThump.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    thump.connect(gThump); gThump.connect(gMaster);
    thump.start(t); thump.stop(t + 0.11);

    // 4. Mechanical bolt snap
    const mech = ctx.createOscillator();
    mech.type = 'square';
    mech.frequency.setValueAtTime(1900 * sp.pitchJitter, t + 0.008);
    mech.frequency.exponentialRampToValueAtTime(420, t + 0.032);
    const gMech = ctx.createGain();
    gMech.gain.setValueAtTime(0.14, t + 0.008);
    gMech.gain.exponentialRampToValueAtTime(0.001, t + 0.036);
    mech.connect(gMech); gMech.connect(gMaster);
    mech.start(t + 0.008); mech.stop(t + 0.04);
  }

  function playMechanical(kind = 'reload_mag') {
    if (!ensureInit()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    if (kind === 'empty') {
      osc.type = 'square'; osc.frequency.setValueAtTime(1400, t); osc.frequency.exponentialRampToValueAtTime(600, t + 0.025);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.connect(g); g.connect(buses.sfx); osc.start(t); osc.stop(t + 0.035);
    } else if (kind === 'bolt') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(720, t); osc.frequency.setValueAtTime(980, t + 0.06);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g); g.connect(buses.sfx); osc.start(t); osc.stop(t + 0.15);
    } else if (kind === 'hitmarker') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(1650, t); osc.frequency.exponentialRampToValueAtTime(1050, t + 0.035);
      g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(g); g.connect(buses.ui); osc.start(t); osc.stop(t + 0.045);
    } else if (kind === 'headshot') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(2200, t); osc.frequency.exponentialRampToValueAtTime(640, t + 0.07);
      g.gain.setValueAtTime(0.24, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g); g.connect(buses.ui); osc.start(t); osc.stop(t + 0.09);
    } else if (kind === 'pan') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(780, t); osc.frequency.exponentialRampToValueAtTime(520, t + 0.45);
      g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(g); g.connect(buses.sfx); osc.start(t); osc.stop(t + 0.5);
    } else {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(480, t); osc.frequency.exponentialRampToValueAtTime(260, t + 0.06);
      g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g); g.connect(buses.sfx); osc.start(t); osc.stop(t + 0.075);
    }
  }

  function playImpact(matType = 'concrete', pos = null) {
    if (!ensureInit()) return;
    const sp = pos ? routeSpatial(pos, 80, false) : { out: buses.sfx, delay: 0, gainScale: 0.7 };
    const t = ctx.currentTime + sp.delay;
    if (matType === 'glass') {
      for (let k = 0; k < 3; k++) {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.setValueAtTime(2600 + k * 900 + Math.random() * 600, t + k * 0.02);
        o.frequency.exponentialRampToValueAtTime(1100, t + k * 0.02 + 0.08);
        const og = ctx.createGain(); og.gain.setValueAtTime(0.12 * sp.gainScale, t + k * 0.02); og.gain.exponentialRampToValueAtTime(0.001, t + k * 0.02 + 0.09);
        o.connect(og); og.connect(sp.out); o.start(t + k * 0.02); o.stop(t + k * 0.02 + 0.1);
      }
    }
    if (matType === 'metal' || matType === 'pan') {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.setValueAtTime(1450 + Math.random() * 500, t); o.frequency.exponentialRampToValueAtTime(780, t + 0.22);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.18 * sp.gainScale, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.connect(g); g.connect(sp.out); o.start(t); o.stop(t + 0.25);
      return;
    }
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = matType === 'wood' ? 680 : matType === 'water' ? 920 : 1250;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.22 * sp.gainScale, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(f); f.connect(g); g.connect(sp.out); n.start(t, Math.random(), 0.1);
  }

  function playFootstep(matType = 'grass', stance = 'stand', speed = 5.0) {
    if (!ensureInit()) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
    n.playbackRate.value = 0.88 + Math.random() * 0.24;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = matType === 'wood' ? 320 : matType === 'concrete' || matType === 'asphalt' ? 540 : matType === 'water' ? 750 : 280;
    f.Q.value = 1.1;
    const g = ctx.createGain();
    const amp = Util.clamp(speed / 6.8, 0.25, 1.0) * (stance === 'prone' ? 0.35 : stance === 'crouch' ? 0.55 : 0.9) * 0.18;
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    n.connect(f); f.connect(g); g.connect(buses.sfx);
    n.start(t, Math.random(), 0.1);
  }

  function playExplosion(pos, isFlash = false) {
    if (!ensureInit()) return;
    const sp = pos ? routeSpatial(pos, 500, false) : { out: buses.sfx, delay: 0, gainScale: 1, dist: 5 };
    const t = ctx.currentTime + sp.delay;
    if (isFlash) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      n.connect(g); g.connect(sp.out); n.start(t, 0, 0.26);
      if (sp.dist < 16) {
        const ring = ctx.createOscillator(); ring.type = 'sine'; ring.frequency.setValueAtTime(4100, t);
        const rg = ctx.createGain(); rg.gain.setValueAtTime(0.14 * (1 - sp.dist / 16), t); rg.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
        ring.connect(rg); rg.connect(buses.ui); ring.start(t); ring.stop(t + 2.9);
      }
      return;
    }
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(420, t); lp.frequency.exponentialRampToValueAtTime(80, t + 1.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.95 * sp.gainScale, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    n.connect(lp); lp.connect(g); g.connect(sp.out); g.connect(reverbNode);
    n.start(t, 0, 1.45);
  }

  function playChidori(phase = 'burst', pos = null) {
    if (!ensureInit()) return;
    const sp = pos ? routeSpatial(pos, 180, false) : { out: buses.sfx, delay: 0, gainScale: 1 };
    const t = ctx.currentTime + sp.delay;
    if (phase === 'cast') {
      // High-frequency "thousand birds" electric chirp + crackle
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'sawtooth' : 'square';
        o.frequency.setValueAtTime(1600 + i * 520, t + i * 0.03);
        o.frequency.exponentialRampToValueAtTime(3400 + i * 300, t + i * 0.03 + 0.14);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.08 * sp.gainScale, t + i * 0.03);
        og.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.18);
        o.connect(og); og.connect(sp.out); o.start(t + i * 0.03); o.stop(t + i * 0.03 + 0.19);
      }
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 1.8;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.28 * sp.gainScale, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      n.connect(hp); hp.connect(ng); ng.connect(sp.out); n.start(t, Math.random(), 0.36);
      return;
    }
    // Chidori detonation: electric zap + thunderclap crackle
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(2800, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.55);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.32 * sp.gainScale, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    o.connect(og); og.connect(sp.out); o.start(t); o.stop(t + 0.6);

    const n = ctx.createBufferSource(); n.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(160, t + 0.9);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.95 * sp.gainScale, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    n.connect(bp); bp.connect(ng); ng.connect(sp.out); ng.connect(reverbNode); n.start(t, 0, 1.0);
  }

  let nextEngineTick = 0;
  function playVehiclePulse(speedRatio = 0.2, isMoto = false, boost = false) {
    if (!ensureInit()) return;
    const now = performance.now();
    if (now < nextEngineTick) return;
    nextEngineTick = now + (isMoto ? 75 : 95);
    const t = ctx.currentTime;
    const baseHz = isMoto ? (68 + speedRatio * 140 + (boost ? 45 : 0)) : (48 + speedRatio * 96 + (boost ? 30 : 0));
    const o = ctx.createOscillator();
    o.type = isMoto ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(baseHz, t);
    o.frequency.linearRampToValueAtTime(baseHz * 1.04, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045 + speedRatio * 0.04, t);
    g.gain.exponentialRampToValueAtTime(0.002, t + 0.095);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = isMoto ? 520 : 320;
    o.connect(lp); lp.connect(g); g.connect(buses.sfx);
    o.start(t); o.stop(t + 0.1);
  }

  return {
    ensureInit, applySettings, playUiTone, updateAmbient, updateListener,
    playGunshot, playMechanical, playImpact, playFootstep, playExplosion, playChidori, playVehiclePulse,
    get context() { return ctx; },
    get noiseBuffer() { return noiseBuffer; },
    get buses() { return buses; },
    get isHrtf() { return hrtfEnabled; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// ASSETS — Procedural PBR Canvas Texture & Material Library (14 Seamless Sets)
// ════════════════════════════════════════════════════════════════════════════
const Assets = (() => {
  const materials = {};
  const textures = [];

  function wrapRepeat(tex, rx, ry, aniso) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    tex.anisotropy = aniso;
    tex.needsUpdate = true;
    textures.push(tex);
    return tex;
  }

  // Generate Sobel normal map directly from height float buffer [0..1]
  function heightToNormalTexture(heightData, size, strength, rx, ry, aniso) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const img = canvas.getContext('2d').createImageData(size, size);
    const out = img.data;
    const at = (x, y) => heightData[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
        const l  = at(x - 1, y),                        r  = at(x + 1, y);
        const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;
        const inv = 1 / Math.hypot(nx, ny, nz);
        nx *= inv; ny *= inv; nz *= inv;
        const idx = (y * size + x) * 4;
        out[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
        out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        out[idx + 3] = 255;
      }
    }
    canvas.getContext('2d').putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    return wrapRepeat(tex, rx, ry, aniso);
  }

  // Seamless periodic tileable noise helper using 4D/torus sampling
  function tileNoise(u, v, scale, seed) {
    // Periodic tiling by blending 4 shifted samples
    const x = u * scale, y = v * scale;
    const n0 = Util.valueNoise2D(x, y, seed);
    const nx = Util.valueNoise2D(x - scale, y, seed);
    const ny = Util.valueNoise2D(x, y - scale, seed);
    const nxy = Util.valueNoise2D(x - scale, y - scale, seed);
    const tx = u, ty = v;
    return Util.lerp(Util.lerp(n0, nx, tx), Util.lerp(ny, nxy, tx), ty);
  }

  function makePBRSet(name, size, aniso, cfg) {
    const colCanvas = document.createElement('canvas');
    colCanvas.width = size; colCanvas.height = size;
    const colCtx = colCanvas.getContext('2d');
    const colImg = colCtx.createImageData(size, size);

    const rghCanvas = document.createElement('canvas');
    rghCanvas.width = size; rghCanvas.height = size;
    const rghCtx = rghCanvas.getContext('2d');
    const rghImg = rghCtx.createImageData(size, size);

    const hBuf = new Float32Array(size * size);
    const cData = colImg.data;
    const rData = rghImg.data;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const res = cfg.evalPixel(u, v, x, y, size);
        const i = y * size + x;
        hBuf[i] = Util.clamp(res.h, 0, 1);
        const p = i * 4;
        cData[p]     = Util.clamp(Math.round(res.r), 0, 255);
        cData[p + 1] = Util.clamp(Math.round(res.g), 0, 255);
        cData[p + 2] = Util.clamp(Math.round(res.b), 0, 255);
        cData[p + 3] = 255;
        const rv = Util.clamp(Math.round(res.rough * 255), 10, 255);
        rData[p] = rData[p + 1] = rData[p + 2] = rv;
        rData[p + 3] = 255;
      }
    }
    colCtx.putImageData(colImg, 0, 0);
    rghCtx.putImageData(rghImg, 0, 0);

    const rx = cfg.rx || 1, ry = cfg.ry || 1;
    const map = wrapRepeat(new THREE.CanvasTexture(colCanvas), rx, ry, aniso);
    map.colorSpace = THREE.SRGBColorSpace;
    const roughnessMap = wrapRepeat(new THREE.CanvasTexture(rghCanvas), rx, ry, aniso);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    const normalMap = heightToNormalTexture(hBuf, size, cfg.normStrength || 2.2, rx, ry, aniso);

    const mat = new THREE.MeshStandardMaterial({
      name,
      map,
      normalMap,
      roughnessMap,
      metalness: cfg.metalness ?? 0.0,
      roughness: cfg.roughness ?? 1.0,
      side: cfg.doubleSide ? THREE.DoubleSide : THREE.FrontSide
    });
    materials[name] = mat;
    return mat;
  }

  function buildAll(presetCfg, onStep) {
    // Dispose old textures if rebuilding
    textures.forEach(t => t.dispose());
    textures.length = 0;
    const size = Math.min(presetCfg.texRes || 512, 512);
    const aniso = presetCfg.aniso || 4;

    const specs = {
      concrete: {
        rx: 2, ry: 2, normStrength: 1.25, roughness: 0.88,
        evalPixel: (u, v) => {
          const n = tileNoise(u, v, 8, 11) * 0.5 + tileNoise(u, v, 24, 17) * 0.3 + tileNoise(u, v, 48, 23) * 0.2;
          const pit = tileNoise(u, v, 32, 91) < -0.58 ? -0.14 : 0;
          const b = 158 + n * 22 + pit * 30;
          return { r: b + 2, g: b + 1, b: b - 2, h: 0.5 + n * 0.22 + pit * 0.2, rough: 0.86 - n * 0.06 };
        }
      },
      brick: {
        rx: 2, ry: 2, normStrength: 2.2, roughness: 0.88,
        evalPixel: (u, v) => {
          const rows = 8, cols = 4;
          const gy = v * rows;
          const row = Math.floor(gy);
          const off = (row % 2) * 0.5;
          const gx = (u * cols + off) % cols;
          const fx = gx - Math.floor(gx);
          const fy = gy - row;
          const mortar = fx < 0.05 || fx > 0.95 || fy < 0.08 || fy > 0.92;
          const brickSeed = row * 13 + Math.floor(gx) * 7;
          const shade = ((brickSeed * 37) % 19) - 9;
          const n = tileNoise(u, v, 24, 303) * 14;
          if (mortar) return { r: 158 + n, g: 154 + n, b: 146 + n, h: 0.30, rough: 0.94 };
          return { r: 154 + shade + n, g: 76 + shade * 0.6 + n * 0.7, b: 58 + shade * 0.4 + n * 0.5, h: 0.78 + n * 0.006, rough: 0.86 };
        }
      },
      plaster: {
        rx: 2, ry: 2, normStrength: 1.05, roughness: 0.88,
        evalPixel: (u, v) => {
          const n = tileNoise(u, v, 6, 51) * 0.6 + tileNoise(u, v, 18, 57) * 0.4;
          const stain = Math.max(0, v - 0.68) * (14 + tileNoise(u, v, 5, 66) * 16);
          return { r: 214 + n * 14 - stain, g: 205 + n * 13 - stain, b: 186 + n * 12 - stain, h: 0.5 + n * 0.12, rough: 0.88 };
        }
      },
      plasterWarm: {
        rx: 2, ry: 2, normStrength: 1.0, roughness: 0.88,
        evalPixel: (u, v) => {
          const n = tileNoise(u, v, 7, 151) * 0.6 + tileNoise(u, v, 20, 157) * 0.4;
          const baseSkirt = v > 0.84 ? 26 : 0;
          return { r: 222 + n * 12 - baseSkirt, g: 208 + n * 11 - baseSkirt, b: 178 + n * 10 - baseSkirt * 0.9, h: 0.5 + n * 0.12, rough: 0.87 };
        }
      },
      terracotta: {
        rx: 4, ry: 4, normStrength: 2.6, roughness: 0.78,
        evalPixel: (u, v) => {
          const rows = 10, cols = 12;
          const gy = v * rows;
          const row = Math.floor(gy);
          const fy = gy - row;
          const gx = (u * cols + (row % 2) * 0.5) % cols;
          const fx = gx - Math.floor(gx);
          const arch = Math.sin(fx * Math.PI);
          const ridge = fy < 0.14 ? 0.15 : fy > 0.88 ? 0.25 : 0.55 + arch * 0.42;
          const tileSeed = ((row * 17 + Math.floor(gx) * 29) % 21) - 10;
          const moss = tileNoise(u, v, 5, 731) > 0.62 ? 1 : 0;
          const shadow = fy < 0.14 ? -32 : fy > 0.88 ? -14 : arch * 18;
          return {
            r: 158 + tileSeed + shadow - moss * 34,
            g: 74 + tileSeed * 0.5 + shadow * 0.6 + moss * 14,
            b: 46 + tileSeed * 0.3 + shadow * 0.4 - moss * 10,
            h: Util.clamp(ridge, 0.1, 0.98),
            rough: moss ? 0.92 : 0.74
          };
        }
      },
      darkWood: {
        rx: 2, ry: 2, normStrength: 1.8, roughness: 0.68,
        evalPixel: (u, v) => {
          const grain = Math.sin((u * 36 + tileNoise(u, v, 8, 91) * 2.5) * Math.PI) * 0.5 + 0.5;
          return { r: 68 + grain * 18, g: 46 + grain * 12, b: 30 + grain * 8, h: 0.45 + grain * 0.22, rough: 0.66 - grain * 0.10 };
        }
      },
      wood: {
        rx: 2, ry: 2, normStrength: 1.9, roughness: 0.78,
        evalPixel: (u, v) => {
          const plank = Math.floor(u * 5);
          const seam = (u * 5 - plank) < 0.035;
          const grain = Math.sin((u * 42 + tileNoise(u, v, 8, 70 + plank) * 3.2) * Math.PI) * 0.5 + 0.5;
          const tone = ((plank * 19) % 15) - 7;
          if (seam) return { r: 54, g: 36, b: 24, h: 0.20, rough: 0.95 };
          return { r: 124 + grain * 28 + tone, g: 86 + grain * 20 + tone * 0.7, b: 54 + grain * 12, h: 0.55 + grain * 0.20, rough: 0.72 - grain * 0.12 };
        }
      },
      gunmetal: {
        rx: 1, ry: 1, normStrength: 0.55, metalness: 0.48, roughness: 0.42,
        evalPixel: (u, v) => {
          const grain = tileNoise(u, v, 28, 81) * 6 + tileNoise(u, v, 52, 83) * 5;
          const microWear = tileNoise(u, v, 14, 89) > 0.60 ? 14 : 0;
          const c = 80 + grain + microWear;
          return { r: c, g: c + 2, b: c + 5, h: 0.5 + grain * 0.008, rough: microWear ? 0.28 : 0.44 };
        }
      },
      rust: {
        rx: 2, ry: 2, normStrength: 1.5, metalness: 0.16, roughness: 0.76,
        evalPixel: (u, v) => {
          const n = tileNoise(u, v, 8, 121) * 0.5 + 0.5;
          const r2 = tileNoise(u, v, 24, 127) * 0.5 + 0.5;
          const isRust = n > 0.44;
          return isRust
            ? { r: 148 + r2 * 34, g: 84 + r2 * 22, b: 56 + r2 * 14, h: 0.62 + r2 * 0.20, rough: 0.84 }
            : { r: 112 + r2 * 20, g: 116 + r2 * 20, b: 118 + r2 * 20, h: 0.45, rough: 0.56 };
        }
      },
      zincRoof: {
        rx: 3, ry: 2, normStrength: 1.6, metalness: 0.24, roughness: 0.48,
        evalPixel: (u, v) => {
          const wave = Math.sin(u * Math.PI * 16) * 0.5 + 0.5;
          const grit = tileNoise(u, v, 14, 140) * 14;
          const rDot = tileNoise(u, v, 9, 149) > 0.54 ? 1 : 0;
          const c = 148 + wave * 34 + grit;
          return { r: c + rDot * 26, g: c - rDot * 6, b: c - rDot * 16, h: 0.30 + wave * 0.55, rough: 0.44 + rDot * 0.28 };
        }
      },
      containerRed: {
        rx: 2, ry: 1, normStrength: 1.3, metalness: 0.16, roughness: 0.62,
        evalPixel: (u, v) => {
          const rib = Math.sin(u * Math.PI * 22) * 0.5 + 0.5;
          const wear = tileNoise(u, v, 12, 912) * 16;
          return { r: 148 + rib * 24 + wear, g: 58 + rib * 12 + wear * 0.4, b: 48 + rib * 10 + wear * 0.4, h: 0.35 + rib * 0.5, rough: 0.62 };
        }
      },
      containerBlue: {
        rx: 2, ry: 1, normStrength: 1.3, metalness: 0.16, roughness: 0.62,
        evalPixel: (u, v) => {
          const rib = Math.sin(u * Math.PI * 22) * 0.5 + 0.5;
          const wear = tileNoise(u, v, 12, 922) * 16;
          return { r: 52 + rib * 12 + wear * 0.4, g: 94 + rib * 18 + wear * 0.6, b: 132 + rib * 22 + wear, h: 0.35 + rib * 0.5, rough: 0.62 };
        }
      },
      containerOlive: {
        rx: 2, ry: 1, normStrength: 1.3, metalness: 0.14, roughness: 0.66,
        evalPixel: (u, v) => {
          const rib = Math.sin(u * Math.PI * 22) * 0.5 + 0.5;
          const wear = tileNoise(u, v, 12, 932) * 16;
          return { r: 84 + rib * 16 + wear * 0.6, g: 108 + rib * 18 + wear * 0.7, b: 68 + rib * 12 + wear * 0.4, h: 0.35 + rib * 0.5, rough: 0.65 };
        }
      },
      asphalt: {
        rx: 4, ry: 4, normStrength: 1.6, roughness: 0.88,
        evalPixel: (u, v) => {
          const grit = tileNoise(u, v, 40, 211) * 16 + tileNoise(u, v, 10, 219) * 10;
          const c = 70 + grit;
          return { r: c, g: c, b: c + 3, h: 0.5 + grit * 0.015, rough: 0.86 };
        }
      },
      sand: {
        rx: 12, ry: 12, normStrength: 1.5, roughness: 0.94,
        evalPixel: (u, v) => {
          const ripple = Math.sin((u * 12 + tileNoise(u, v, 4, 311) * 0.8) * Math.PI) * 0.5 + 0.5;
          const grit = tileNoise(u, v, 36, 317) * 12;
          return { r: 188 + ripple * 10 + grit, g: 170 + ripple * 8 + grit, b: 128 + grit, h: 0.45 + ripple * 0.25, rough: 0.93 };
        }
      },
      grass: {
        rx: 18, ry: 18, normStrength: 2.3, roughness: 0.90,
        evalPixel: (u, v) => {
          const patch = tileNoise(u, v, 5, 401);
          const blade = tileNoise(u, v, 34, 409);
          const fine = Math.sin(u * 140 + blade * 4.5) * Math.cos(v * 110 + patch * 3.5);
          const clover = tileNoise(u, v, 22, 433) > 0.58 ? 8 : 0;
          return {
            r: 74 + patch * 16 + blade * 16 + fine * 7 + clover,
            g: 112 + patch * 22 + blade * 20 + fine * 9 + clover * 1.4,
            b: 45 + patch * 9 + blade * 9 + fine * 4,
            h: 0.45 + blade * 0.34 + fine * 0.12,
            rough: 0.90
          };
        }
      },
      dirt: {
        rx: 10, ry: 10, normStrength: 2.6, roughness: 0.95,
        evalPixel: (u, v) => {
          const n = tileNoise(u, v, 8, 501) * 16 + tileNoise(u, v, 28, 509) * 14;
          return { r: 102 + n, g: 82 + n * 0.8, b: 58 + n * 0.6, h: 0.5 + n * 0.015, rough: 0.95 };
        }
      },
      rock: {
        rx: 8, ry: 8, normStrength: 3.6, roughness: 0.9,
        evalPixel: (u, v) => {
          const strata = tileNoise(u, v, 10, 601) * 22 + tileNoise(u, v, 26, 613) * 14;
          const c = 104 + strata;
          return { r: c + 3, g: c + 1, b: c - 2, h: 0.5 + strata * 0.016, rough: 0.88 };
        }
      },
      cloth: {
        rx: 3, ry: 3, normStrength: 1.8, roughness: 0.95,
        evalPixel: (u, v) => {
          const weave = (Math.sin(u * 120) * Math.sin(v * 120)) * 8;
          const n = tileNoise(u, v, 10, 701) * 8;
          return { r: 78 + weave + n, g: 86 + weave + n, b: 64 + weave + n, h: 0.5 + weave * 0.03, rough: 0.94 };
        }
      },
      bark: {
        rx: 2, ry: 4, normStrength: 3.8, roughness: 0.94,
        evalPixel: (u, v) => {
          const furrow = Math.sin(u * Math.PI * 14 + tileNoise(u, v, 6, 801) * 4.5);
          const n = tileNoise(u, v, 22, 809) * 12;
          return { r: 74 + furrow * 18 + n, g: 56 + furrow * 14 + n * 0.8, b: 42 + furrow * 10, h: 0.5 + furrow * 0.35, rough: 0.94 };
        }
      },
      limestone: {
        rx: 3, ry: 3, normStrength: 1.55, roughness: 0.84,
        evalPixel: (u, v) => {
          const rows = 8, cols = 4;
          const gy = v * rows, row = Math.floor(gy), fy = gy - row;
          const gx = (u * cols + (row % 2) * 0.5) % cols, fx = gx - Math.floor(gx);
          const seam = fx < 0.03 || fx > 0.97 || fy < 0.045 || fy > 0.955;
          const n = tileNoise(u, v, 10, 911) * 10 + tileNoise(u, v, 26, 919) * 6;
          const shade = seam ? -26 : 0;
          return { r: 196 + n + shade, g: 184 + n * 0.9 + shade, b: 162 + n * 0.8 + shade, h: seam ? 0.25 : 0.68 + n * 0.008, rough: seam ? 0.94 : 0.82 };
        }
      },
      pavingStone: {
        rx: 6, ry: 6, normStrength: 2.1, roughness: 0.44, metalness: 0.10,
        evalPixel: (u, v) => {
          const rows = 10, cols = 6;
          const gy = v * rows, row = Math.floor(gy), fy = gy - row;
          const gx = (u * cols + (row % 2) * 0.5) % cols, fx = gx - Math.floor(gx);
          const joint = fx < 0.05 || fy < 0.07;
          const blockShade = (((row * 19 + Math.floor(gx) * 31) % 15) - 7) * 1.4;
          const puddle = tileNoise(u, v, 3, 941);
          const wetSpot = puddle > 0.25 ? 1 : 0;
          const base = 58 + blockShade + tileNoise(u, v, 22, 947) * 8 - (joint ? 16 : 0);
          return { r: base, g: base + 3, b: base + 9, h: joint ? 0.22 : 0.72 + blockShade * 0.01, rough: wetSpot ? 0.20 : 0.52 };
        }
      },
      slateRoof: {
        rx: 4, ry: 4, normStrength: 2.0, roughness: 0.66,
        evalPixel: (u, v) => {
          const rows = 12, cols = 10;
          const gy = v * rows, row = Math.floor(gy), fy = gy - row;
          const gx = (u * cols + (row % 2) * 0.5) % cols, fx = gx - Math.floor(gx);
          const seam = fy < 0.1 || fx < 0.04;
          const n = tileNoise(u, v, 16, 971) * 7;
          const vBase = 44 + n - (seam ? 12 : 0);
          return { r: vBase, g: vBase + 4, b: vBase + 12, h: seam ? 0.3 : 0.72, rough: 0.64 };
        }
      },
      bronzeStatue: {
        rx: 2, ry: 2, normStrength: 1.8, roughness: 0.38, metalness: 0.72,
        evalPixel: (u, v) => {
          const pat = tileNoise(u, v, 10, 991);
          const verdigris = pat > 0.35 ? 12 : 0;
          const n = tileNoise(u, v, 24, 997) * 8;
          return { r: 58 + n - verdigris * 0.4, g: 54 + n + verdigris * 0.7, b: 44 + n + verdigris * 0.4, h: 0.5 + n * 0.015, rough: 0.34 + pat * 0.12 };
        }
      },
      busBlue: {
        rx: 2, ry: 2, normStrength: 0.55, roughness: 0.26, metalness: 0.38,
        evalPixel: (u, v) => {
          const n = tileNoise(u, v, 12, 1013) * 5;
          return { r: 22 + n, g: 52 + n, b: 96 + n * 1.2, h: 0.55 + n * 0.008, rough: 0.24 };
        }
      }
    };

    const keys = Object.keys(specs);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      makePBRSet(k, size, aniso, specs[k]);
      if (onStep) onStep(k, i + 1, keys.length);
    }

    // Foliage leaf alpha, breakable glass & lightweight emissive/metallic urban materials
    materials.leafCard = buildFoliageMaterial(aniso);
    materials.glass = new THREE.MeshPhysicalMaterial({
      color: 0x3D637A, transparent: true, opacity: 0.56, roughness: 0.08, metalness: 0.25,
      side: THREE.DoubleSide, depthWrite: false
    });
    materials.warmGlow = new THREE.MeshStandardMaterial({
      name: 'warmGlow', color: 0xFFE6BC, emissive: 0xFFB347, emissiveIntensity: 1.55, roughness: 0.28, metalness: 0.05
    });
    materials.neonCyan = new THREE.MeshStandardMaterial({
      name: 'neonCyan', color: 0xC4F6FF, emissive: 0x2CE6FF, emissiveIntensity: 1.75, roughness: 0.2, metalness: 0.1
    });
    materials.goldTrim = new THREE.MeshStandardMaterial({
      name: 'goldTrim', color: 0xE5B842, emissive: 0x9E720A, emissiveIntensity: 0.35, roughness: 0.32, metalness: 0.82
    });
    materials.craneYellow = new THREE.MeshStandardMaterial({
      name: 'craneYellow', color: 0xE0A11B, roughness: 0.48, metalness: 0.35
    });
    materials.darkIron = new THREE.MeshStandardMaterial({
      name: 'darkIron', color: 0x1D2127, roughness: 0.44, metalness: 0.68
    });
    materials.redSignal = new THREE.MeshStandardMaterial({
      name: 'redSignal', color: 0xFF4242, emissive: 0xFF2828, emissiveIntensity: 1.6, roughness: 0.25
    });
  }

  function buildFoliageMaterial(aniso) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.clearRect(0, 0, s, s);
    // Draw rich cluster of leaves
    const rng = Util.mulberry32(9901);
    for (let i = 0; i < 64; i++) {
      const lx = s * 0.5 + (rng() - 0.5) * s * 0.56;
      const ly = s * 0.5 + (rng() - 0.5) * s * 0.56;
      const rx = 16 + rng() * 14;
      const ry = 8 + rng() * 8;
      const rot = rng() * Math.PI * 2;
      g.save();
      g.translate(lx, ly);
      g.rotate(rot);
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      const grn = 160 + Math.floor(rng() * 70);
      g.fillStyle = `rgb(${Math.floor(grn * 0.65)}, ${grn}, ${Math.floor(grn * 0.45)})`;
      g.fill();
      g.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    textures.push(tex);
    return new THREE.MeshStandardMaterial({
      name: 'leafCard',
      map: tex,
      alphaTest: 0.42,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
  }

  return {
    buildAll,
    get(name) { return materials[name] || materials.concrete; },
    get all() { return materials; }
  };
})();

