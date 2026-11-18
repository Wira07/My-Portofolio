// ════════════════════════════════════════════════════════════════════════════
// THROWABLES — Frag, Smoke, Flashbang, Trajectory Arc, Physics Bounce & RedZone
// ════════════════════════════════════════════════════════════════════════════
const Throwables = (() => {
  const SPECS = {
    frag: { id: 'frag', name: 'Granat Frag M67', fuse: 4.5, radius: 10.5, maxDmg: 110, speed: 25, bounce: 0.42, col: 0x3A4B31 },
    smoke: { id: 'smoke', name: 'Granat Asap M18', fuse: 1.4, radius: 11.5, duration: 40, speed: 23, bounce: 0.35, col: 0x5C6561 },
    flashbang: { id: 'flashbang', name: 'Flashbang M84', fuse: 1.6, radius: 18, speed: 25, bounce: 0.40, col: 0x3E4652 }
  };
  const ORDER = ['frag', 'smoke', 'flashbang'];

  let sceneRef = null;
  let arcGroup = null;
  const arcBeads = [];
  const activeGrenades = [];
  const smokes = [];
  const blastVfx = [];
  const tmpV1 = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  let grenadeMode = false;
  let curIdx = 0;
  let cooking = false;
  let cookTimer = 0;
  let flashTimer = 0;
  let flashPeak = 0;
  let grenGeo = null;
  let smokeMat = null;
  let smokeGeo = null;

  function initScene(scene) {
    sceneRef = scene;
    clearAll();
    if (!grenGeo) grenGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10);
    if (!smokeGeo) smokeGeo = new THREE.SphereGeometry(1, 10, 8);
    if (!smokeMat) smokeMat = new THREE.MeshStandardMaterial({ color: 0xBCC4C8, roughness: 1.0, metalness: 0.0, transparent: true, opacity: 0.56, depthWrite: false });
    if (!arcGroup) {
      arcGroup = new THREE.Group();
      const bGeo = new THREE.SphereGeometry(0.075, 6, 6);
      const bMat = new THREE.MeshBasicMaterial({ color: 0xF2B705, transparent: true, opacity: 0.85, depthTest: false });
      for (let i = 0; i < 18; i++) {
        const m = new THREE.Mesh(bGeo, bMat);
        m.visible = false;
        arcGroup.add(m);
        arcBeads.push(m);
      }
      arcGroup.visible = false;
    }
    if (sceneRef && arcGroup.parent !== sceneRef) sceneRef.add(arcGroup);
  }

  function clearAll() {
    for (let i = 0; i < activeGrenades.length; i++) sceneRef?.remove(activeGrenades[i].mesh);
    activeGrenades.length = 0;
    for (let i = 0; i < smokes.length; i++) {
      for (let j = 0; j < smokes[i].puffs.length; j++) sceneRef?.remove(smokes[i].puffs[j].mesh);
    }
    smokes.length = 0;
    for (let i = 0; i < blastVfx.length; i++) sceneRef?.remove(blastVfx[i].mesh);
    blastVfx.length = 0;
    grenadeMode = false; cooking = false; cookTimer = 0; flashTimer = 0; flashPeak = 0;
    if (arcGroup) arcGroup.visible = false;
    Render.setFlashIntensity?.(0);
    const fl = document.getElementById('fx-overlay-flash');
    if (fl) fl.style.opacity = '0';
  }

  function updateArcPreview(show, origin, dir, typeId = 'frag') {
    if (!arcGroup) return;
    if (!show || !origin || !dir) { arcGroup.visible = false; return; }
    const sp = SPECS[typeId] || SPECS.frag;
    arcGroup.visible = true;
    const vx = dir.x * sp.speed, vy = dir.y * sp.speed + 3.4, vz = dir.z * sp.speed;
    let px = origin.x, py = origin.y, pz = origin.z;
    const stepDt = 0.08;
    let cvy = vy;
    let hitStop = false;
    for (let i = 0; i < arcBeads.length; i++) {
      const m = arcBeads[i];
      px += vx * stepDt;
      cvy -= 20 * stepDt;
      py += cvy * stepDt;
      pz += vz * stepDt;
      const gh = World.getHeight(px, pz) + 0.08;
      if (py <= gh) { py = gh; hitStop = true; }
      m.position.set(px, py, pz);
      m.scale.setScalar(i === arcBeads.length - 1 || hitStop ? 1.8 : 1.0);
      m.visible = !hitStop || i === 0 || (py === gh);
      if (hitStop) {
        for (let k = i + 1; k < arcBeads.length; k++) arcBeads[k].visible = false;
        break;
      }
    }
  }

  function spawnBlastFlash(pos, colorHex, maxScale, dur) {
    if (!sceneRef) return;
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, depthWrite: false });
    const mesh = new THREE.Mesh(smokeGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.5);
    sceneRef.add(mesh);
    blastVfx.push({ mesh, mat, t: 0, dur, maxScale });
  }

  function hasLineOfSight(from, to) {
    tmpV1.copy(to).sub(from);
    const d = tmpV1.length();
    if (d < 0.3) return true;
    tmpV1.multiplyScalar(1 / d);
    const hit = Physics.raycast ? Physics.raycast(from, tmpV1, d - 0.25) : null;
    return !hit;
  }

  function detonate(typeId, pos, owner = 'player', radiusOverride = null) {
    const sp = SPECS[typeId] || SPECS.frag;
    const rad = radiusOverride || sp.radius;
    const pEye = tmpV2.set(pos.x, pos.y + 0.35, pos.z);

    if (typeId === 'smoke') {
      AudioSys.playExplosion(pos, false);
      const puffs = [];
      for (let i = 0; i < 10; i++) {
        const mesh = new THREE.Mesh(smokeGeo, smokeMat);
        const ang = (i / 10) * Math.PI * 2;
        const off = i === 0 ? 0 : (1.5 + (i % 3) * 1.4);
        mesh.position.set(pos.x + Math.cos(ang) * off, pos.y + 1.1 + (i % 2) * 1.3, pos.z + Math.sin(ang) * off);
        mesh.scale.setScalar(0.8);
        sceneRef?.add(mesh);
        puffs.push({ mesh, targetR: i === 0 ? 4.8 : (3.4 + (i % 3) * 0.9), ang, off });
      }
      smokes.push({ active: true, x: pos.x, y: pos.y + 1.5, z: pos.z, r: rad, ttl: sp.duration, age: 0, puffs });
      return;
    }

    if (typeId === 'flashbang') {
      AudioSys.playExplosion(pos, true);
      spawnBlastFlash(pEye, 0xFFFFFF, 4.2, 0.28);
      if (Player.alive && Render.camera) {
        const toCam = tmpV1.copy(Render.camera.position).sub(pEye);
        const dist = toCam.length();
        if (dist < rad && hasLineOfSight(pEye, Render.camera.position)) {
          Render.camera.getWorldDirection(tmpDir);
          toCam.normalize();
          const lookFactor = Util.clamp((-tmpDir.dot(toCam) + 0.5) * 0.8, 0.28, 1.0);
          flashPeak = Util.clamp((1 - dist / rad * 0.65) * lookFactor * 1.15, 0.3, 1.0);
          flashTimer = 3.2 * flashPeak;
        }
      }
      const bots = AI.bots;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        if (!b.alive) continue;
        const d = b.pos.distanceTo(pos);
        if (d < rad && hasLineOfSight(pEye, tmpDir.set(b.pos.x, b.pos.y + 1.4, b.pos.z))) {
          b.reactTimer = Math.max(b.reactTimer || 0, 3.4);
          b.fireCd = Math.max(b.fireCd || 0, 3.4);
        }
      }
      return;
    }

    // Frag Grenade or Artillery Mortar
    AudioSys.playExplosion(pos, false);
    spawnBlastFlash(pEye, 0xFF8C2A, rad * 0.65, 0.34);
    for (let p = 0; p < 18; p++) {
      Ballistics.spawnParticle(pEye, new THREE.Vector3((Math.random() - 0.5) * 14, 4 + Math.random() * 10, (Math.random() - 0.5) * 14), p % 2 ? 0x2F2B26 : 0xFF9933, 0.75, 0.28, 16);
    }

    if (Player.alive) {
      const pTarget = tmpDir.set(Player.pos.x, Player.pos.y + 1.0, Player.pos.z);
      const dist = pTarget.distanceTo(pEye);
      if (dist < rad && hasLineOfSight(pEye, pTarget)) {
        const raw = (sp.maxDmg * (radiusOverride ? 1.25 : 1.0)) * (1 - (dist / rad) * 0.85);
        Player.takeDamage(raw, 'chest', pEye, owner === 'player' ? 'Granat Frag' : 'Ledakan');
      }
    }

    const bots = AI.bots;
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (!b.alive) continue;
      const bTarget = tmpDir.set(b.pos.x, b.pos.y + 1.0, b.pos.z);
      const dist = bTarget.distanceTo(pEye);
      if (dist < rad && hasLineOfSight(pEye, bTarget)) {
        const dmg = sp.maxDmg * (radiusOverride ? 1.3 : 1.0) * (1 - (dist / rad) * 0.85);
        AI.applyBotDamage(b, dmg, 'chest', dist, bTarget, bTarget.clone().sub(pEye).normalize(), owner);
      }
    }
  }

  function throwGrenade(origin, dir, typeId = 'frag', owner = 'player', preCooked = 0) {
    if (!sceneRef) return null;
    const sp = SPECS[typeId] || SPECS.frag;
    const mat = new THREE.MeshStandardMaterial({ color: sp.col, roughness: 0.65, metalness: 0.35 });
    const mesh = new THREE.Mesh(grenGeo, mat);
    mesh.position.copy(origin);
    sceneRef.add(mesh);
    const vel = dir.clone().multiplyScalar(sp.speed);
    vel.y += 3.4;
    const g = { type: sp.id, mesh, pos: mesh.position, vel, fuse: Math.max(0.15, sp.fuse - preCooked), bounce: sp.bounce, owner, settled: false };
    activeGrenades.push(g);
    AudioSys.playMechanical('reload');
    return g;
  }

  function detonateArtillery(targetX, targetZ) {
    if (!sceneRef) return;
    const gy = Math.max(0, World.getHeight(targetX, targetZ));
    const mat = new THREE.MeshStandardMaterial({ color: 0x35393E, roughness: 0.5, metalness: 0.6 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 8), mat);
    mesh.position.set(targetX, gy + 95, targetZ);
    sceneRef.add(mesh);
    activeGrenades.push({
      type: 'artillery', mesh, pos: mesh.position,
      vel: new THREE.Vector3((Math.random() - 0.5) * 4, -68, (Math.random() - 0.5) * 4),
      fuse: 3.0, bounce: 0, owner: 'redzone', isArtillery: true, groundY: gy
    });
  }

  function update(dt) {
    for (let i = activeGrenades.length - 1; i >= 0; i--) {
      const g = activeGrenades[i];
      g.fuse -= dt;
      g.vel.y -= (g.isArtillery ? 12 : 20) * dt;
      tmpV1.copy(g.vel).multiplyScalar(dt);
      const stepDist = tmpV1.length();
      if (!g.isArtillery && stepDist > 0.01 && Physics.raycast) {
        tmpDir.copy(tmpV1).multiplyScalar(1 / stepDist);
        const hit = Physics.raycast(g.pos, tmpDir, stepDist + 0.08);
        if (hit && hit.normal) {
          g.vel.reflect(hit.normal).multiplyScalar(g.bounce);
          tmpV1.multiplyScalar(0.3);
        }
      }
      g.pos.add(tmpV1);
      g.mesh.rotation.x += dt * 9;
      g.mesh.rotation.z += dt * 6;
      const gh = World.getHeight(g.pos.x, g.pos.z) + 0.07;
      if (g.pos.y <= gh) {
        g.pos.y = gh;
        if (g.isArtillery) { g.fuse = 0; }
        else if (Math.abs(g.vel.y) > 1.2) {
          g.vel.y = Math.abs(g.vel.y) * g.bounce;
          g.vel.x *= 0.68; g.vel.z *= 0.68;
          AudioSys.playImpact('stone', g.pos);
        } else {
          g.vel.set(g.vel.x * 0.85, 0, g.vel.z * 0.85);
        }
      }
      if (g.fuse <= 0) {
        sceneRef?.remove(g.mesh);
        activeGrenades.splice(i, 1);
        detonate(g.isArtillery ? 'frag' : g.type, g.pos.clone(), g.owner, g.isArtillery ? 14.5 : null);
      }
    }

    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.age += dt;
      s.ttl -= dt;
      const grow = Math.min(1, s.age / 2.2);
      const fadeOut = s.ttl < 5 ? Math.max(0, s.ttl / 5) : 1;
      for (let j = 0; j < s.puffs.length; j++) {
        const pf = s.puffs[j];
        pf.mesh.scale.setScalar(0.4 + pf.targetR * grow * fadeOut);
        pf.mesh.position.x = s.x + Math.cos(pf.ang + s.age * 0.12) * pf.off * grow;
        pf.mesh.position.z = s.z + Math.sin(pf.ang + s.age * 0.12) * pf.off * grow;
      }
      if (s.ttl <= 0) {
        s.active = false;
        for (let j = 0; j < s.puffs.length; j++) sceneRef?.remove(s.puffs[j].mesh);
        smokes.splice(i, 1);
      }
    }

    for (let i = blastVfx.length - 1; i >= 0; i--) {
      const bv = blastVfx[i];
      bv.t += dt;
      const u = bv.t / bv.dur;
      if (u >= 1) {
        sceneRef?.remove(bv.mesh);
        bv.mat.dispose();
        blastVfx.splice(i, 1);
      } else {
        bv.mesh.scale.setScalar(0.6 + u * bv.maxScale);
        bv.mat.opacity = 0.85 * (1 - u);
      }
    }

    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - dt);
      const intensity = Util.clamp(flashTimer / 2.2, 0, 1) * flashPeak;
      Render.setFlashIntensity?.(intensity);
      const fl = document.getElementById('fx-overlay-flash');
      if (fl) fl.style.opacity = String(intensity.toFixed(2));
    } else if (flashPeak > 0) {
      flashPeak = 0;
      Render.setFlashIntensity?.(0);
      const fl = document.getElementById('fx-overlay-flash');
      if (fl) fl.style.opacity = '0';
    }
  }

  function updatePlayerThrow(dt, inp) {
    update(dt);
    if (!Player.alive || UI.hasModalOpen) { updateArcPreview(false); return; }

    const inv = Player.getInventoryData();
    const gp = Input.pollGamepad();
    const pressed5 = Input.wasCodePressed('Digit5');
    const pressedG = Input.wasCodePressed('KeyG') || (gp?.grenadeJust && !(typeof CheatUI !== 'undefined' && CheatUI.chidoriShortcut));
    if (pressed5 || pressedG) {
      if (grenadeMode) curIdx = (curIdx + 1) % ORDER.length;
      else grenadeMode = true;
      // Pick first non-empty throwable if current is empty
      for (let t = 0; t < ORDER.length; t++) {
        const k = ORDER[(curIdx + t) % ORDER.length];
        if ((inv.throwables[k] || 0) > 0) { curIdx = (curIdx + t) % ORDER.length; break; }
      }
    }
    if (Input.wasCodePressed('Digit1') || Input.wasCodePressed('Digit2') || Input.wasCodePressed('Digit3') || Input.wasCodePressed('Digit4') || gp?.switchJust) {
      grenadeMode = false; cooking = false; cookTimer = 0; updateArcPreview(false);
    }

    const barSlots = document.querySelectorAll('#hud-weapon-bar .wslot');
    if (grenadeMode) {
      barSlots.forEach((el, idx) => el.classList.toggle('active', idx === 4));
      const tid = ORDER[curIdx];
      const sp = SPECS[tid];
      const cnt = inv.throwables[tid] || 0;
      const wNameEl = document.getElementById('hud-weapon-name');
      const wModeEl = document.getElementById('hud-fire-mode');
      const wAmmoEl = document.getElementById('hud-ammo');
      if (wNameEl) wNameEl.textContent = sp.name.toUpperCase();
      if (wModeEl) wModeEl.textContent = 'LEMPAR';
      if (wAmmoEl) wAmmoEl.innerHTML = `${cnt}<span>/ TERSISA</span>`;

      const throwHeld = (Input.pointerLocked && Input.lmbDown) || !!gp?.fire;
      if (cnt > 0 && (Input.pointerLocked || gp)) {
        Render.camera.getWorldDirection(tmpDir);
        const startOrigin = tmpV2.copy(Render.camera.position).addScaledVector(tmpDir, 0.85);
        startOrigin.y -= 0.12;
        if (throwHeld && !cooking) { cooking = true; cookTimer = 0; }
        if (cooking) {
          cookTimer += dt;
          updateArcPreview(true, startOrigin, tmpDir, tid);
          const castEl = document.getElementById('hud-cast-bar');
          const castLbl = document.getElementById('cast-label');
          const castTime = document.getElementById('cast-time');
          const castFill = document.getElementById('cast-fill');
          if (castEl && castLbl && castTime && castFill) {
            castEl.classList.remove('hidden');
            castLbl.textContent = `Menyiapkan ${sp.name}...`;
            const rem = Math.max(0, sp.fuse - cookTimer);
            castTime.textContent = `${rem.toFixed(1)}s`;
            castFill.style.width = `${Util.clamp((cookTimer / sp.fuse) * 100, 0, 100)}%`;
          }
          if (!throwHeld || cookTimer >= sp.fuse - 0.1) {
            throwGrenade(startOrigin, tmpDir, tid, 'player', cookTimer);
            inv.throwables[tid] = Math.max(0, cnt - 1);
            cooking = false; cookTimer = 0;
            updateArcPreview(false);
            if (!Player.castActive) document.getElementById('hud-cast-bar')?.classList.add('hidden');
          }
        } else {
          updateArcPreview(true, startOrigin, tmpDir, tid);
        }
      } else {
        updateArcPreview(false);
      }
    } else {
      updateArcPreview(false);
    }
  }

  return {
    SPECS, initScene, clearAll, update, updatePlayerThrow, throwGrenade, detonateArtillery, updateArcPreview, detonate, spawnBlastFlash,
    get smokes() { return smokes; },
    get activeGrenades() { return activeGrenades; },
    get inGrenadeMode() { return grenadeMode; },
    setGrenadeType(t) { const i = ORDER.indexOf(t); if (i >= 0) { curIdx = i; grenadeMode = true; } }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// INPUT — Remappable Keyboard, Mouse Pointer Lock, Wheel, Gamepad API (dz 0.12)
// ════════════════════════════════════════════════════════════════════════════
const Input = (() => {
  const keys = new Set();
  const justPressed = new Set();
  let mouseDx = 0, mouseDy = 0;
  let lmbDown = false, rmbDown = false, lmbJust = false, rmbJust = false;
  let wheelDelta = 0;
  let pointerLocked = false;
  let canvasEl = null;
  let lockActiveState = false;
  let onLockLost = null;

  const touchState = {
    active: false,
    moveX: 0,
    moveY: 0,
    sprint: false,
    fire: false,
    fireJust: false,
    ads: false,
    jumpHeld: false,
    jumpJust: false,
    crouchJust: false,
    reloadJust: false,
    perspJust: false,
    interactJust: false,
    lastTouchMs: 0
  };

  function isTouchUi() {
    return (typeof UI !== 'undefined' && UI.isTouchUiEnabled) ? UI.isTouchUiEnabled() : CONFIG.isMobile;
  }

  function resetTouchInputs() {
    touchState.moveX = 0;
    touchState.moveY = 0;
    touchState.sprint = false;
    touchState.fire = false;
    touchState.fireJust = false;
    touchState.jumpHeld = false;
    document.getElementById('touch-fire')?.classList.remove('active');
    document.getElementById('touch-joy-base')?.classList.remove('sprinting');
    const knob = document.getElementById('touch-joy-knob');
    if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
  }

  function init(canvas, callbacks = {}) {
    canvasEl = canvas;
    onLockLost = callbacks.onLockLost || null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' && lockActiveState) e.preventDefault();
      if (!keys.has(e.code)) justPressed.add(e.code);
      keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => { keys.clear(); lmbDown = rmbDown = false; resetTouchInputs(); });

    canvas.addEventListener('click', () => {
      AudioSys.ensureInit();
      if (isTouchUi() || (performance.now() - touchState.lastTouchMs < 900)) return;
      const overlayOpen = UI.hasModalOpen || (typeof CheatUI !== 'undefined' && CheatUI.isOpen) || (typeof MapUI !== 'undefined' && MapUI.isOpen);
      if (lockActiveState && !pointerLocked && !overlayOpen) {
        if (!lmbDown) lmbJust = true;
        lmbDown = true;
        try {
          const pr = canvas.requestPointerLock?.();
          if (pr && typeof pr.catch === 'function') pr.catch(() => {});
        } catch (_) {}
      }
    });

    // Make HUD weapon slot pills (#ws-1..#ws-5) directly clickable (especially 2: BASOKA)
    const slotKeyCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    slotKeyCodes.forEach((code, idx) => {
      const el = document.getElementById(`ws-${idx + 1}`);
      if (!el) return;
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        AudioSys.ensureInit();
        slotKeyCodes.forEach(c => justPressed.delete(c));
        if (idx < 4 && typeof Player !== 'undefined' && Player.selectSlot) {
          Player.selectSlot(idx);
        } else {
          justPressed.add(code);
        }
        if (lockActiveState && !pointerLocked && !isTouchUi()) {
          try {
            const pr = canvas.requestPointerLock?.();
            if (pr && typeof pr.catch === 'function') pr.catch(() => {});
          } catch (_) {}
        }
      });
    });

    // Tappable Heal Quickslots (7/8/9/0) & Minimap (M) for touch/mouse convenience
    const qCodes = ['Digit7', 'Digit8', 'Digit9', 'Digit0'];
    document.querySelectorAll('.quickslot-row .qslot').forEach((el, idx) => {
      if (!qCodes[idx]) return;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        AudioSys.ensureInit();
        justPressed.add(qCodes[idx]);
      });
    });
    document.querySelector('.minimap-wrap')?.addEventListener('click', (ev) => {
      if (!lockActiveState) return;
      ev.stopPropagation();
      AudioSys.ensureInit();
      justPressed.add(actionCode('map'));
    });

    // Mobile utility bar buttons (Bag, Cheat, Fullscreen, Pause)
    document.getElementById('mbtn-bag')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      AudioSys.ensureInit();
      justPressed.add(actionCode('inventory'));
    });
    document.getElementById('mbtn-cheat')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      AudioSys.ensureInit();
      if (typeof CheatUI !== 'undefined') CheatUI.toggle?.();
    });
    document.getElementById('mbtn-full')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      AudioSys.ensureInit();
      Render.toggleFullscreen?.();
    });
    document.getElementById('mbtn-pause')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      AudioSys.ensureInit();
      resetTouchInputs();
      if (typeof CheatUI !== 'undefined' && CheatUI.isOpen) CheatUI.close();
      else if (typeof MapUI !== 'undefined' && MapUI.isOpen) MapUI.closeBigMap();
      else if (typeof UI !== 'undefined' && UI.hasModalOpen) UI.closeModal();
      else if (typeof Game !== 'undefined' && Game.triggerPause) Game.triggerPause();
      else window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    });

    // Virtual Joystick + Canvas Look Drag + Virtual Action Buttons (Pointer Events for multitouch + pen + Playwright)
    const joyZone = document.getElementById('touch-joy-zone');
    const joyBase = document.getElementById('touch-joy-base');
    const joyKnob = document.getElementById('touch-joy-knob');
    let joyPtrId = null;

    function updateJoyFromPoint(clientX, clientY) {
      if (!joyBase || !joyKnob) return;
      const rect = joyBase.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxR = Math.max(24, rect.width * 0.44);
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const scale = dist > maxR ? maxR / dist : 1;
      const cxOff = dx * scale;
      const cyOff = dy * scale;
      joyKnob.style.transform = `translate3d(${cxOff.toFixed(1)}px, ${cyOff.toFixed(1)}px, 0)`;
      touchState.moveX = cxOff / maxR;
      touchState.moveY = cyOff / maxR;
      touchState.sprint = dist > maxR * 0.76 && touchState.moveY < -0.35;
      joyBase.classList.toggle('sprinting', touchState.sprint);
    }

    if (joyZone) {
      joyZone.addEventListener('pointerdown', (e) => {
        if (UI.hasModalOpen) return;
        e.preventDefault();
        e.stopPropagation();
        AudioSys.ensureInit();
        touchState.active = true;
        touchState.lastTouchMs = performance.now();
        joyPtrId = e.pointerId;
        try { joyZone.setPointerCapture?.(e.pointerId); } catch {}
        updateJoyFromPoint(e.clientX, e.clientY);
      });
      joyZone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== joyPtrId) return;
        e.preventDefault();
        touchState.lastTouchMs = performance.now();
        updateJoyFromPoint(e.clientX, e.clientY);
      });
      const clearJoy = (e) => {
        if (e.pointerId !== joyPtrId) return;
        joyPtrId = null;
        touchState.moveX = 0;
        touchState.moveY = 0;
        touchState.sprint = false;
        joyBase?.classList.remove('sprinting');
        if (joyKnob) joyKnob.style.transform = 'translate3d(0, 0, 0)';
      };
      joyZone.addEventListener('pointerup', clearJoy);
      joyZone.addEventListener('pointercancel', clearJoy);
    }

    let lookPtrId = null, lookLastX = 0, lookLastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !isTouchUi()) return;
      const overlayOpen = UI.hasModalOpen || (typeof CheatUI !== 'undefined' && CheatUI.isOpen) || (typeof MapUI !== 'undefined' && MapUI.isOpen);
      if (!lockActiveState || overlayOpen) return;
      AudioSys.ensureInit();
      if (CONFIG.isMobile && !document.fullscreenElement && !document.webkitFullscreenElement) {
        Render.tryEnterFullscreen?.(true);
      }
      touchState.active = true;
      touchState.lastTouchMs = performance.now();
      if (lookPtrId === null) {
        lookPtrId = e.pointerId;
        lookLastX = e.clientX;
        lookLastY = e.clientY;
        try { canvas.setPointerCapture?.(e.pointerId); } catch {}
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookPtrId) return;
      e.preventDefault();
      touchState.lastTouchMs = performance.now();
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      mouseDx += dx * 1.45;
      mouseDy += dy * 1.45;
    });
    const clearLook = (e) => { if (e.pointerId === lookPtrId) lookPtrId = null; };
    canvas.addEventListener('pointerup', clearLook);
    canvas.addEventListener('pointercancel', clearLook);

    const fireBtn = document.getElementById('touch-fire');
    let firePtrId = null, fireLastX = 0, fireLastY = 0;
    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        AudioSys.ensureInit();
        touchState.active = true;
        touchState.lastTouchMs = performance.now();
        firePtrId = e.pointerId;
        fireLastX = e.clientX;
        fireLastY = e.clientY;
        touchState.fire = true;
        touchState.fireJust = true;
        fireBtn.classList.add('active');
        try { fireBtn.setPointerCapture?.(e.pointerId); } catch {}
      });
      fireBtn.addEventListener('pointermove', (e) => {
        if (e.pointerId !== firePtrId) return;
        e.preventDefault();
        touchState.lastTouchMs = performance.now();
        const dx = e.clientX - fireLastX;
        const dy = e.clientY - fireLastY;
        fireLastX = e.clientX;
        fireLastY = e.clientY;
        mouseDx += dx * 1.35;
        mouseDy += dy * 1.35;
      });
      const clearFire = (e) => {
        if (e.pointerId !== firePtrId) return;
        firePtrId = null;
        touchState.fire = false;
        fireBtn.classList.remove('active');
      };
      fireBtn.addEventListener('pointerup', clearFire);
      fireBtn.addEventListener('pointercancel', clearFire);
    }

    const adsBtn = document.getElementById('touch-ads');
    if (adsBtn) {
      adsBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        AudioSys.ensureInit();
        touchState.active = true;
        touchState.lastTouchMs = performance.now();
        touchState.ads = !touchState.ads;
        adsBtn.classList.toggle('active', touchState.ads);
      });
    }

    const bindTouchPulse = (id, justKey, heldKey = null) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        AudioSys.ensureInit();
        touchState.active = true;
        touchState.lastTouchMs = performance.now();
        touchState[justKey] = true;
        if (heldKey) touchState[heldKey] = true;
        btn.classList.add('active');
      });
      const release = (e) => {
        if (heldKey) touchState[heldKey] = false;
        btn.classList.remove('active');
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    };
    bindTouchPulse('touch-jump', 'jumpJust', 'jumpHeld');
    bindTouchPulse('touch-crouch', 'crouchJust');
    bindTouchPulse('touch-reload', 'reloadJust');
    bindTouchPulse('touch-persp', 'perspJust');
    bindTouchPulse('touch-interact', 'interactJust');

    document.getElementById('hud-interact')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      AudioSys.ensureInit();
      touchState.interactJust = true;
    });

    document.addEventListener('pointerlockchange', () => {
      const wasLocked = pointerLocked;
      pointerLocked = document.pointerLockElement === canvasEl;
      if (pointerLocked && !lockActiveState) {
        pointerLocked = false;
        try { document.exitPointerLock?.(); } catch {}
        return;
      }
      const overlayOpen = UI.hasModalOpen || (typeof CheatUI !== 'undefined' && CheatUI.isOpen) || (typeof MapUI !== 'undefined' && MapUI.isOpen);
      document.getElementById('pointer-banner')?.classList.toggle('hidden', isTouchUi() || !lockActiveState || pointerLocked || overlayOpen);
      if (wasLocked && !pointerLocked && lockActiveState && !overlayOpen && onLockLost) {
        onLockLost();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!pointerLocked) return;
      mouseDx += e.movementX || 0;
      mouseDy += e.movementY || 0;
    });

    window.addEventListener('mousedown', (e) => {
      if (UI.hasModalOpen || isTouchUi() || (performance.now() - touchState.lastTouchMs < 900)) return;
      if (e.target?.closest?.('.wslot-pill, #hud-weapon-slots, .qslot, .minimap-wrap, #touch-controls, #mobile-util-row, #match-status-pill, #cheat-overlay, #map-overlay, #modal-backdrop')) return;
      if (e.button === 0) { if (!lmbDown) lmbJust = true; lmbDown = true; }
      if (e.button === 2) { if (!rmbDown) rmbJust = true; rmbDown = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) lmbDown = false;
      if (e.button === 2) rmbDown = false;
    });
    window.addEventListener('contextmenu', (e) => { if (lockActiveState) e.preventDefault(); });
    window.addEventListener('wheel', (e) => {
      if (lockActiveState && !UI.hasModalOpen) wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });
  }

  function setGameplayActive(active) {
    lockActiveState = active;
    document.getElementById('pointer-banner')?.classList.toggle('hidden', isTouchUi() || !active || pointerLocked || UI.hasModalOpen);
    if (!active) {
      resetTouchInputs();
      pointerLocked = false;
      try { document.exitPointerLock?.(); } catch {}
    }
  }

  function actionCode(act) { return UI.settings.keybinds?.[act] || CONFIG.defaultKeybinds[act]; }
  function isDown(act) { return keys.has(actionCode(act)); }
  function isCodeDown(code) { return keys.has(code); }
  function wasPressed(act) { return justPressed.has(actionCode(act)); }
  function wasCodePressed(code) { return justPressed.has(code); }

  const prevPadBtns = new Uint8Array(24);
  let prevFire = false;
  let cachedGp = null;
  let connectedPadName = '';

  function findActivePad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    let best = null;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      if (!best) best = p;
      const anyPressed = p.buttons?.some(b => b.pressed || b.value > 0.25);
      const anyAxis = p.axes?.some(a => Math.abs(a) > 0.2);
      if (anyPressed || anyAxis || p.mapping === 'standard') return p;
    }
    return best;
  }

  function readGamepadRaw() {
    if (!UI.settings.gamepadEnabled || !navigator.getGamepads) {
      prevPadBtns.fill(0);
      prevFire = false;
      connectedPadName = '';
      cachedGp = null;
      return null;
    }
    const gp = findActivePad();
    if (!gp) {
      prevPadBtns.fill(0);
      prevFire = false;
      connectedPadName = '';
      cachedGp = null;
      return null;
    }
    connectedPadName = gp.id || 'Controller';
    const isStd = gp.mapping === 'standard';
    const dz = (v) => Math.abs(v) < 0.13 ? 0 : (v - Math.sign(v) * 0.13) / 0.87;
    const curve = (v) => {
      const d = dz(v);
      return d === 0 ? 0 : Math.sign(d) * (0.55 * Math.abs(d) + 0.45 * d * d);
    };
    const btnDown = (idx) => !!(gp.buttons[idx]?.pressed || (gp.buttons[idx]?.value || 0) > 0.45);
    const btnJust = (idx) => {
      const d = btnDown(idx);
      const just = d && !prevPadBtns[idx];
      return just;
    };

    const rawRx = gp.axes[2] || 0;
    const rawRy = isStd ? (gp.axes[3] || 0) : (gp.axes.length >= 6 ? (gp.axes[5] ?? gp.axes[3] ?? 0) : (gp.axes[3] || 0));
    const fireVal = isStd ? (gp.buttons[7]?.value || (gp.buttons[7]?.pressed ? 1 : 0)) : (gp.buttons[7]?.value || (gp.buttons[5]?.pressed ? 1 : 0));
    const adsVal = isStd ? (gp.buttons[6]?.value || (gp.buttons[6]?.pressed ? 1 : 0)) : (gp.buttons[6]?.value || (gp.buttons[4]?.pressed ? 1 : 0));
    const fireDown = fireVal > 0.30;
    const fireJust = fireDown && !prevFire;

    // Non-standard DirectInput hat fallback if buttons[12..15] empty & axis[9] exists
    let dUp = btnDown(12), dDown = btnDown(13), dLeft = btnDown(14), dRight = btnDown(15);
    if (!isStd && gp.axes.length > 9 && !dUp && !dDown && !dLeft && !dRight) {
      const hat = gp.axes[9];
      if (hat >= -1.05 && hat <= 1.05 && Math.abs(hat) < 1.2) {
        if (hat < -0.75) dUp = true;
        else if (hat > -0.1 && hat < 0.35) dDown = true;
        else if (hat > 0.55 && hat <= 1.01) dLeft = true;
        else if (hat > -0.65 && hat < -0.25) dRight = true;
      }
    }

    const res = {
      connected: true,
      id: connectedPadName,
      moveX: curve(gp.axes[0] || 0),
      moveY: curve(gp.axes[1] || 0),
      lookX: curve(rawRx),
      lookY: curve(rawRy),
      fire: fireDown,
      fireJust,
      ads: adsVal > 0.30,
      jump: btnDown(0),
      jumpJust: btnJust(0),
      crouchHeld: btnDown(1),
      crouchJust: btnJust(1),
      reloadJust: btnJust(2),
      switchJust: btnJust(3),
      perspJust: btnJust(4),
      grenadeJust: btnJust(5),
      selectJust: btnJust(8),
      startDown: btnDown(9),
      startJust: btnJust(9),
      sprint: btnDown(10),
      l3Just: btnJust(10),
      r3Just: btnJust(11),
      dUp, dDown, dLeft, dRight,
      dpadUpJust: dUp && !prevPadBtns[12],
      dpadDownJust: dDown && !prevPadBtns[13],
      dpadLeftJust: dLeft && !prevPadBtns[14],
      dpadRightJust: dRight && !prevPadBtns[15]
    };

    for (let b = 0; b < 16; b++) {
      if (b === 12) prevPadBtns[b] = dUp ? 1 : 0;
      else if (b === 13) prevPadBtns[b] = dDown ? 1 : 0;
      else if (b === 14) prevPadBtns[b] = dLeft ? 1 : 0;
      else if (b === 15) prevPadBtns[b] = dRight ? 1 : 0;
      else prevPadBtns[b] = btnDown(b) ? 1 : 0;
    }
    prevFire = fireDown;
    cachedGp = res;
    return res;
  }

  function pollGamepad() {
    return cachedGp;
  }

  function consumeFrame() {
    readGamepadRaw();
    const res = { dx: mouseDx, dy: mouseDy, wheel: wheelDelta, lmbJust, rmbJust };
    mouseDx = 0; mouseDy = 0; wheelDelta = 0;
    lmbJust = false; rmbJust = false;
    return res;
  }
  function setTouchInteract(visible, label = 'AMBIL') {
    const btn = document.getElementById('touch-interact');
    if (!btn) return;
    btn.classList.toggle('hidden', !visible);
    if (visible && label) btn.textContent = label;
  }

  function endFrame() {
    justPressed.clear();
    touchState.fireJust = false;
    touchState.jumpJust = false;
    touchState.crouchJust = false;
    touchState.reloadJust = false;
    touchState.perspJust = false;
    touchState.interactJust = false;
  }

  return {
    init, setGameplayActive, isDown, isCodeDown, wasPressed, wasCodePressed, pollGamepad, consumeFrame, endFrame, resetTouchInputs, setTouchInteract,
    get touch() { return touchState; },
    get lmbDown() { return lmbDown; },
    get rmbDown() { return rmbDown; },
    get pointerLocked() { return pointerLocked; },
    get gamepadConnected() { return !!cachedGp; },
    get gamepadName() { return connectedPadName; }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// WEAPONS_DB + ATTACHMENTS_DB + THROWABLES_DB (Data-Driven Lampiran B)
// ════════════════════════════════════════════════════════════════════════════
const WEAPONS_DB = (() => {
  function genPattern(len, vPitch, hAmp, seed) {
    const rng = Util.mulberry32(seed);
    const pts = [];
    for (let i = 0; i < len; i++) {
      const stage = i < 6 ? 0.85 : i < 16 ? 1.15 : 1.0;
      const sway = Math.sin(i * 0.45 + seed) * hAmp * (i < 5 ? 0.3 : 1.0);
      pts.push([Number((sway + (rng() - 0.5) * hAmp * 0.45).toFixed(3)), Number((vPitch * stage * (0.9 + rng() * 0.2)).toFixed(3))]);
    }
    return pts;
  }

  const list = {
    akm: {
      id: 'akm', name: 'AKM', class: 'AR', ammo: '762', damage: 48, rpm: 820, muzzleVel: 715, drag: 0.0007,
      mag: 30, magExt: 40, reload: { tactical: 2.2, empty: 2.9 }, modes: ['auto', 'single'],
      falloff: [[0,1.0],[50,1.0],[150,0.94],[300,0.85],[500,0.72]],
      recoil: { pitch: [0.72, 0.42], yaw: 0.25, recovery: 5.5, pattern: genPattern(30, 0.78, 0.34, 11) },
      spread: { base: 0.55, ads: 0.22, move: 1.75, jump: 3.2, crouch: 0.72, prone: 0.52 },
      ads: { time: 0.23, fov: 56 }, heavy: false, sound: 'ar_762', pellets: 1,
      sockets: { optic: [0, 0.088, 0.04], muzzle: [0, 0.025, 0.52], grip: null, mag: [0, -0.075, 0.09], stock: null, eject: [0.025, 0.055, 0.05] },
      slots: { optic: true, muzzle: true, grip: false, mag: true, stock: false }, style: 'ak'
    },
    m416: {
      id: 'm416', name: 'M416', class: 'AR', ammo: '556', damage: 42, rpm: 1200, muzzleVel: 820, drag: 0.0007,
      mag: 50, magExt: 75, reload: { tactical: 1.6, empty: 2.1 }, modes: ['auto', 'single'],
      falloff: [[0,1.0],[50,1.0],[150,0.95],[300,0.88],[500,0.78]],
      recoil: { pitch: [0.22, 0.14], yaw: 0.07, recovery: 9.5, pattern: genPattern(50, 0.24, 0.09, 22) },
      spread: { base: 0.32, ads: 0.09, move: 1.1, jump: 2.2, crouch: 0.65, prone: 0.45 },
      ads: { time: 0.18, fov: 55 }, heavy: false, sound: 'ar_556', pellets: 1,
      sockets: { optic: [0, 0.086, 0.03], muzzle: [0, 0.025, 0.50], grip: [0, -0.03, 0.24], mag: [0, -0.07, 0.07], stock: [0, 0.015, -0.22], eject: [0.025, 0.052, 0.04] },
      slots: { optic: true, muzzle: true, grip: true, mag: true, stock: true }, style: 'ar'
    },
    scarl: {
      id: 'scarl', name: 'SCAR-L', class: 'AR', ammo: '556', damage: 41, rpm: 880, muzzleVel: 770, drag: 0.0009,
      mag: 30, magExt: 40, reload: { tactical: 2.15, empty: 2.8 }, modes: ['auto', 'single'],
      falloff: [[0,1.0],[50,1.0],[150,0.94],[300,0.85],[500,0.73]],
      recoil: { pitch: [0.52, 0.32], yaw: 0.16, recovery: 6.5, pattern: genPattern(30, 0.52, 0.18, 33) },
      spread: { base: 0.48, ads: 0.19, move: 1.5, jump: 2.8, crouch: 0.74, prone: 0.54 },
      ads: { time: 0.21, fov: 55 }, heavy: false, sound: 'ar_556', pellets: 1,
      sockets: { optic: [0, 0.095, 0.03], muzzle: [0, 0.028, 0.49], grip: [0, -0.028, 0.24], mag: [0, -0.07, 0.07], stock: null, eject: [0.026, 0.058, 0.05] },
      slots: { optic: true, muzzle: true, grip: true, mag: true, stock: false }, style: 'scar'
    },
    ump45: {
      id: 'ump45', name: 'UMP45', class: 'SMG', ammo: '45', damage: 39, rpm: 900, muzzleVel: 400, drag: 0.0022,
      mag: 25, magExt: 35, reload: { tactical: 1.9, empty: 2.5 }, modes: ['auto', 'burst', 'single'],
      falloff: [[0,1.0],[40,0.96],[100,0.80],[200,0.62],[350,0.45]],
      recoil: { pitch: [0.38, 0.22], yaw: 0.12, recovery: 7.5, pattern: genPattern(30, 0.36, 0.14, 44) },
      spread: { base: 0.36, ads: 0.20, move: 1.1, jump: 2.2, crouch: 0.78, prone: 0.6 },
      ads: { time: 0.16, fov: 58 }, heavy: false, sound: 'smg_45', pellets: 1,
      sockets: { optic: [0, 0.086, 0.02], muzzle: [0, 0.026, 0.38], grip: [0, -0.028, 0.18], mag: [0, -0.075, 0.07], stock: null, eject: [0.022, 0.05, 0.04] },
      slots: { optic: true, muzzle: true, grip: true, mag: true, stock: false }, style: 'smg'
    },
    vector: {
      id: 'vector', name: 'Vector', class: 'SMG', ammo: '45', damage: 31, rpm: 1380, muzzleVel: 360, drag: 0.0022,
      mag: 19, magExt: 33, reload: { tactical: 1.75, empty: 2.25 }, modes: ['auto', 'burst', 'single'],
      falloff: [[0,1.0],[35,0.94],[80,0.74],[180,0.52]],
      recoil: { pitch: [0.28, 0.18], yaw: 0.10, recovery: 8.2, pattern: genPattern(30, 0.26, 0.11, 55) },
      spread: { base: 0.32, ads: 0.18, move: 0.95, jump: 2.0, crouch: 0.78, prone: 0.6 },
      ads: { time: 0.15, fov: 58 }, heavy: false, sound: 'smg_45', pellets: 1,
      sockets: { optic: [0, 0.084, 0.02], muzzle: [0, 0.012, 0.32], grip: [0, -0.035, 0.15], mag: [0, -0.08, 0.09], stock: [0, 0.015, -0.18], eject: [0.022, 0.048, 0.03] },
      slots: { optic: true, muzzle: true, grip: true, mag: true, stock: true }, style: 'vector'
    },
    sks: {
      id: 'sks', name: 'SKS', class: 'DMR', ammo: '762', damage: 53, rpm: 300, muzzleVel: 800, drag: 0.0007,
      mag: 10, magExt: 20, reload: { tactical: 2.4, empty: 3.1 }, modes: ['single'],
      falloff: [[0,1.0],[100,1.0],[300,0.94],[600,0.84]],
      recoil: { pitch: [1.10, 0.5], yaw: 0.25, recovery: 5.0, pattern: genPattern(30, 1.15, 0.22, 66) },
      spread: { base: 0.65, ads: 0.08, move: 1.9, jump: 3.5, crouch: 0.65, prone: 0.45 },
      ads: { time: 0.24, fov: 52 }, heavy: true, sound: 'ar_762', pellets: 1,
      sockets: { optic: [0, 0.085, 0.02], muzzle: [0, 0.024, 0.58], grip: [0, -0.025, 0.24], mag: [0, -0.06, 0.07], stock: [0, 0.01, -0.22], eject: [0.024, 0.055, 0.04] },
      slots: { optic: true, muzzle: true, grip: true, mag: true, stock: true }, style: 'dmr'
    },
    kar98k: {
      id: 'kar98k', name: 'Kar98k', class: 'SR', ammo: '762', damage: 79, rpm: 32, muzzleVel: 760, drag: 0.0007,
      mag: 5, magExt: 5, reload: { tactical: 2.8, empty: 3.6 }, modes: ['single'], boltAction: true,
      falloff: [[0,1.0],[150,1.0],[400,0.96],[800,0.88]],
      recoil: { pitch: [1.85, 0.7], yaw: 0.2, recovery: 4.0, pattern: genPattern(30, 1.85, 0.16, 77) },
      spread: { base: 1.2, ads: 0.03, move: 2.6, jump: 4.2, crouch: 0.6, prone: 0.4 },
      ads: { time: 0.26, fov: 50 }, heavy: true, sound: 'sr', pellets: 1,
      sockets: { optic: [0, 0.082, 0.03], muzzle: [0, 0.022, 0.66], grip: null, mag: null, stock: [0, 0.005, -0.23], eject: [0.022, 0.052, 0.03] },
      slots: { optic: true, muzzle: true, grip: false, mag: false, stock: true }, style: 'bolt'
    },
    m24: {
      id: 'm24', name: 'M24', class: 'SR', ammo: '762', damage: 82, rpm: 34, muzzleVel: 790, drag: 0.0007,
      mag: 5, magExt: 7, reload: { tactical: 2.5, empty: 3.2 }, modes: ['single'], boltAction: true,
      falloff: [[0,1.0],[150,1.0],[400,0.97],[800,0.90]],
      recoil: { pitch: [1.75, 0.65], yaw: 0.18, recovery: 4.2, pattern: genPattern(30, 1.75, 0.14, 88) },
      spread: { base: 1.15, ads: 0.025, move: 2.5, jump: 4.0, crouch: 0.6, prone: 0.4 },
      ads: { time: 0.25, fov: 50 }, heavy: true, sound: 'sr', pellets: 1,
      sockets: { optic: [0, 0.088, 0.03], muzzle: [0, 0.024, 0.68], grip: null, mag: [0, -0.055, 0.07], stock: [0, 0.01, -0.24], eject: [0.022, 0.054, 0.03] },
      slots: { optic: true, muzzle: true, grip: false, mag: true, stock: true }, style: 'sr'
    },
    s12k: {
      id: 's12k', name: 'S12K', class: 'Shotgun', ammo: '12ga', damage: 22, rpm: 240, muzzleVel: 350, drag: 0.0040,
      mag: 5, magExt: 8, reload: { tactical: 2.2, empty: 2.9 }, modes: ['single'], pellets: 9,
      falloff: [[0,1.0],[15,0.9],[35,0.52],[70,0.20]],
      recoil: { pitch: [1.9, 0.6], yaw: 0.45, recovery: 4.5, pattern: genPattern(30, 1.85, 0.4, 99) },
      spread: { base: 2.6, ads: 1.9, move: 2.9, jump: 3.8, crouch: 0.85, prone: 0.75 },
      ads: { time: 0.20, fov: 60 }, heavy: true, sound: 'shotgun',
      sockets: { optic: [0, 0.088, 0.03], muzzle: [0, 0.026, 0.53], grip: null, mag: [0, -0.07, 0.09], stock: null, eject: [0.026, 0.055, 0.04] },
      slots: { optic: true, muzzle: true, grip: false, mag: true, stock: false }, style: 'shotgun'
    },
    p92: {
      id: 'p92', name: 'P92', class: 'Pistol', ammo: '9mm', damage: 35, rpm: 440, muzzleVel: 380, drag: 0.0020,
      mag: 15, magExt: 20, reload: { tactical: 1.5, empty: 2.0 }, modes: ['single'],
      falloff: [[0,1.0],[25,0.95],[60,0.72],[120,0.45]],
      recoil: { pitch: [0.45, 0.2], yaw: 0.12, recovery: 8.5, pattern: genPattern(30, 0.45, 0.14, 111) },
      spread: { base: 0.45, ads: 0.20, move: 0.9, jump: 1.8, crouch: 0.8, prone: 0.65 },
      ads: { time: 0.13, fov: 62 }, heavy: false, sound: 'pistol_9', pellets: 1,
      sockets: { optic: [0, 0.068, 0.03], muzzle: [0, 0.028, 0.20], grip: [0, -0.005, 0.14], mag: [0, -0.065, -0.02], stock: null, eject: [0.015, 0.042, 0.03] },
      slots: { optic: true, muzzle: true, grip: true, mag: true, stock: false }, style: 'pistol'
    },
    bazooka: {
      id: 'bazooka', name: 'BAZOOKA RPG-7', class: 'Launcher', ammo: 'rocket', damage: 280, rpm: 240, muzzleVel: 210, drag: 0.0001,
      mag: 20, magExt: 30, reload: { tactical: 0.8, empty: 1.0 }, modes: ['auto', 'single'], isRocket: true, blastRadius: 8.5,
      falloff: [[0,1.0],[600,1.0]],
      recoil: { pitch: [1.1, 0.45], yaw: 0.12, recovery: 6.5, pattern: [[0, 1.0]] },
      spread: { base: 0.10, ads: 0.02, move: 0.25, jump: 0.6, crouch: 0.5, prone: 0.3 },
      ads: { time: 0.18, fov: 52 }, heavy: false, sound: 'sr', pellets: 1,
      sockets: { optic: [0, 0.088, 0.03], muzzle: [0, 0.042, 0.65], grip: null, mag: null, stock: null, eject: null },
      slots: { optic: true, muzzle: false, grip: false, mag: false, stock: false }, style: 'bazooka'
    },
    pan: {
      id: 'pan', name: 'Panci Baja', class: 'Melee', ammo: 'none', damage: 60, rpm: 95, muzzleVel: 20, drag: 0,
      mag: 0, magExt: 0, reload: { tactical: 0, empty: 0 }, modes: ['melee'],
      falloff: [[0,1.0],[3,1.0]],
      recoil: { pitch: [0,0], yaw: 0, recovery: 8, pattern: [[0,0]] },
      spread: { base: 0, ads: 0, move: 0, jump: 0, crouch: 1, prone: 1 },
      ads: { time: 0.18, fov: 65 }, heavy: false, sound: 'melee', pellets: 1,
      sockets: { optic: null, muzzle: null, grip: null, mag: null, stock: null, eject: null },
      slots: { optic: false, muzzle: false, grip: false, mag: false, stock: false }, style: 'pan'
    }
  };
  return list;
})();

const ATTACHMENTS_DB = {
  reddot:     { id: 'reddot',     name: 'Red Dot Sight',      slot: 'optic', zoom: 1.15, adsSpeed: 1.15, reticle: 'dot' },
  holo:       { id: 'holo',       name: 'Holographic Sight',  slot: 'optic', zoom: 1.25, adsSpeed: 1.10, reticle: 'holo' },
  scope2x:    { id: 'scope2x',    name: 'Scope 2x',           slot: 'optic', zoom: 2.0,  adsSpeed: 0.95, reticle: 'ring2x' },
  scope3x:    { id: 'scope3x',    name: 'Scope 3x',           slot: 'optic', zoom: 3.0,  adsSpeed: 0.90, reticle: 'bdc' },
  scope4x:    { id: 'scope4x',    name: 'Scope 4x ACOG',      slot: 'optic', zoom: 4.0,  adsSpeed: 0.85, reticle: 'chevron' },
  scope6x:    { id: 'scope6x',    name: 'Scope 6x',           slot: 'optic', zoom: 6.0,  minZoom: 3.0, adsSpeed: 0.80, reticle: 'mildot' },
  scope8x:    { id: 'scope8x',    name: 'Scope 8x CQBSS',     slot: 'optic', zoom: 8.0,  minZoom: 4.0, adsSpeed: 0.72, reticle: 'mildot' },
  scope15x:   { id: 'scope15x',   name: 'Scope 15x PM II',    slot: 'optic', zoom: 15.0, minZoom: 7.0, adsSpeed: 0.65, reticle: 'sniper15' },
  comp:       { id: 'comp',       name: 'Compensator',        slot: 'muzzle', recoilMult: 0.75, hideFlash: false, suppressed: false },
  flashhider: { id: 'flashhider', name: 'Flash Hider',        slot: 'muzzle', recoilMult: 0.90, hideFlash: true,  suppressed: false },
  suppressor: { id: 'suppressor', name: 'Suppressor',         slot: 'muzzle', recoilMult: 0.95, hideFlash: true,  suppressed: true },
  choke:      { id: 'choke',      name: 'Shotgun Choke',      slot: 'muzzle', spreadMult: 0.75, recoilMult: 0.95, hideFlash: false, suppressed: false },
  vertgrip:   { id: 'vertgrip',   name: 'Vertical Grip',      slot: 'grip', pitchMult: 0.85, yawMult: 0.95 },
  angledgrip: { id: 'angledgrip', name: 'Angled Foregrip',    slot: 'grip', yawMult: 0.86, adsSpeed: 1.20 },
  halfgrip:   { id: 'halfgrip',   name: 'Half Grip',          slot: 'grip', pitchMult: 0.90, yawMult: 0.90, recoveryMult: 1.15 },
  laser:      { id: 'laser',      name: 'Tactical Laser',     slot: 'grip', hipSpreadMult: 0.80, isLaser: true },
  extmag:     { id: 'extmag',     name: 'Extended Mag',       slot: 'mag', extended: true, reloadMult: 1.0 },
  qdmag:      { id: 'qdmag',      name: 'Quickdraw Mag',      slot: 'mag', extended: false, reloadMult: 0.70 },
  extqdmag:   { id: 'extqdmag',   name: 'Ext. Quickdraw Mag', slot: 'mag', extended: true,  reloadMult: 0.70 },
  tacstock:   { id: 'tacstock',   name: 'Tactical Stock',     slot: 'stock', pitchMult: 0.90, recoveryMult: 1.15, swayMult: 0.82 },
  cheekpad:   { id: 'cheekpad',   name: 'Cheek Pad',          slot: 'stock', pitchMult: 0.90, swayMult: 0.78 }
};

// ════════════════════════════════════════════════════════════════════════════
// MODEL BUILDERS — Multi-Part Procedural Weapons, Attachments & Tactical Hands
// ════════════════════════════════════════════════════════════════════════════
const ModelBuilders = (() => {
  const sleeveBlueMat = new THREE.MeshStandardMaterial({ name: 'vmSleeveBlue', color: 0x26384E, roughness: 0.72, metalness: 0.08 });
  const cuffRibMat    = new THREE.MeshStandardMaterial({ name: 'vmCuffRib', color: 0x1B2634, roughness: 0.80, metalness: 0.06 });
  const gloveTanMat   = new THREE.MeshStandardMaterial({ name: 'vmGloveTan', color: 0x78705A, roughness: 0.66, metalness: 0.08 });
  const gloveDarkMat  = new THREE.MeshStandardMaterial({ name: 'vmGloveDark', color: 0x1B1F24, roughness: 0.58, metalness: 0.22 });
  const wristScreen   = new THREE.MeshStandardMaterial({ name: 'vmWristHud', color: 0x0A2536, emissive: 0x18B8FF, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.5 });

  function buildAttachmentMesh(attId) {
    const def = ATTACHMENTS_DB[attId];
    if (!def) return null;
    if (def.slot === 'optic')  return GunKit.buildOptic(attId);
    if (def.slot === 'muzzle') return GunKit.buildMuzzle(attId);
    if (def.slot === 'grip')   return GunKit.buildGrip(attId);
    if (def.slot === 'mag')    return GunKit.buildMag(attId);
    if (def.slot === 'stock')  return GunKit.buildStock(attId);
    return new THREE.Group();
  }

  function buildWeaponModel(weaponId, equippedAttachments = {}) {
    const def = WEAPONS_DB[weaponId] || WEAPONS_DB.m416;
    const root = new THREE.Group();
    root.name = `Weapon_${def.id}`;
    const style = def.style;

    if (style === 'pan') {
      const metal = GunKit.mat('black');
      const steel = GunKit.mat('steel');
      const panPts = [[0.001, 0], [0.115, 0.002], [0.135, 0.042], [0.128, 0.045], [0.108, 0.008], [0.001, 0.008]];
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(panPts.map(([r, y]) => new THREE.Vector2(r, y)), 24), metal);
      bowl.position.set(0, 0.02, 0.28);
      bowl.rotation.x = Math.PI / 2;
      const handle = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.012, 0.17, 2, 0.003), metal);
      handle.position.set(0, 0.01, 0.08);
      const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.04), steel);
      bolster.position.set(0, 0.016, 0.155);
      root.add(bowl, handle, bolster);
      return { root, sightY: 0.06, attachNodes: {} };
    }

    const body = GunKit.getBody(def);
    root.add(GunKit.instantiate(body.geos));

    // Modern tactical rifles/SMGs/Bazooka display the factory boxy reflex optic by default (matching Reference Image 1)
    const defaultReflex = !equippedAttachments.optic && (style === 'ar' || style === 'scar' || style === 'smg' || style === 'vector' || style === 'bazooka');
    const effOptic = equippedAttachments.optic || (defaultReflex ? 'reddot' : null);

    // Backup Iron Sights (folded flat behind optic when an optic is mounted, deployed when bare)
    const irons = GunKit.ironSights(body, !!effOptic);
    if (irons) root.add(irons);

    // Default flash-hider / muzzle device when no custom muzzle is attached
    if (!equippedAttachments.muzzle && !body.hasMuzzle) {
      const dm = GunKit.defaultMuzzle(body);
      if (dm) root.add(dm);
    }

    const attachNodes = mountAllSockets(root, def, body, equippedAttachments, defaultReflex);

    // Accurate ADS sight line height
    let sightY = 0.095;
    if (body.pistol) {
      sightY = effOptic && body.sockets.optic ? (body.sockets.optic[1] + GunKit.opticLine(effOptic)) : 0.073;
    } else if (effOptic && body.sockets.optic) {
      sightY = body.sockets.optic[1] + GunKit.opticLine(effOptic);
    } else {
      sightY = (body.railTop || 0.075) + 0.020;
    }

    return { root, sightY, attachNodes };
  }

  function mountAllSockets(root, def, body, equipped, defaultReflex) {
    const nodes = {};
    const sockets = body?.sockets || def.sockets || {};
    Object.entries(def.sockets).forEach(([slot, fallbackPos]) => {
      const pos = sockets[slot] || fallbackPos;
      if (!pos) return;
      const g = new THREE.Group();
      g.position.set(pos[0], pos[1], pos[2]);
      root.add(g);
      nodes[slot] = g;
      const attId = equipped[slot];
      if (attId) {
        const mesh = buildAttachmentMesh(attId);
        if (mesh) g.add(mesh);
      } else if (slot === 'mag' && body) {
        const defMag = GunKit.buildDefaultMag(body);
        if (defMag) g.add(defMag);
      } else if (slot === 'optic' && defaultReflex) {
        const defOpt = GunKit.buildOptic('reddot');
        if (defOpt) g.add(defOpt);
      }
    });
    return nodes;
  }

  // First-Person Viewmodel Arms + Two-Tone Tactical Gloves (matching Reference Image 1)
  // Note: vmHands is rotated Math.PI around Y in player.js so +Z points downrange (-Z in camera)
  // and +X in authoring space becomes -X in camera space (shooter's LEFT support arm).
  function buildViewmodelHands() {
    const grp = new THREE.Group();
    grp.name = 'ViewmodelHands';

    // 1. LEFT SUPPORT ARM (+X in authoring space -> left side of handguard in FPP)
    const leftArm = new THREE.Group();
    const lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.30, 14), sleeveBlueMat);
    lSleeve.rotation.x = Math.PI / 2 - 0.36;
    lSleeve.position.set(0.068, -0.068, 0.105);
    lSleeve.rotation.y = -0.32;

    // Jacket sleeve folds + ribbed tactical cuff reaching right up to the wrist
    const lFold1 = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.006, 8, 14), sleeveBlueMat);
    lFold1.position.set(0.046, -0.038, 0.165);
    lFold1.rotation.y = -0.32;
    lFold1.rotation.x = -0.36;
    const lFold2 = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 8, 14), sleeveBlueMat);
    lFold2.position.set(0.041, -0.028, 0.182);
    lFold2.rotation.y = -0.30;
    lFold2.rotation.x = -0.36;
    const lCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.030, 12), cuffRibMat);
    lCuff.rotation.x = Math.PI / 2 - 0.32;
    lCuff.position.set(0.036, -0.020, 0.194);
    lCuff.rotation.y = -0.26;

    // Tactical wrist watch / mini-PDA on left wrist
    const watchBody = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.009, 0.028, 2, 0.002), gloveDarkMat);
    watchBody.position.set(0.046, -0.014, 0.188);
    watchBody.rotation.z = -0.45;
    const watchGlass = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.002, 0.022), wristScreen);
    watchGlass.position.set(0.048, -0.010, 0.188);
    watchGlass.rotation.z = -0.45;

    // Left glove back-of-hand (tan/olive leather) + carbon knuckle guard + thumb & fingers gripping M-LOK handguard
    const lPalm = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.056, 0.078, 2, 0.008), gloveTanMat);
    lPalm.position.set(0.028, 0.002, 0.222);
    lPalm.rotation.z = -0.26;
    lPalm.rotation.y = -0.10;

    const lKnuckle = new THREE.Mesh(new RoundedBoxGeometry(0.010, 0.044, 0.062, 2, 0.004), gloveDarkMat);
    lKnuckle.position.set(0.016, -0.010, 0.218);
    lKnuckle.rotation.z = -0.26;

    // Thumb resting high along the left side of the handguard rail (exact match to Reference Image 1)
    const lThumbBase = new THREE.Mesh(new RoundedBoxGeometry(0.020, 0.022, 0.042, 2, 0.005), gloveTanMat);
    lThumbBase.position.set(0.026, 0.028, 0.212);
    lThumbBase.rotation.x = -0.18;
    lThumbBase.rotation.z = -0.35;
    const lThumbTip = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.017, 0.032, 2, 0.004), gloveDarkMat);
    lThumbTip.position.set(0.022, 0.034, 0.238);
    lThumbTip.rotation.x = -0.08;

    // Four curled fingers wrapping under the handguard bottom
    for (let i = 0; i < 4; i++) {
      const fz = 0.196 + i * 0.0165;
      const finger = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.015, 0.014, 2, 0.003), i % 2 === 0 ? gloveDarkMat : gloveTanMat);
      finger.position.set(0.006, -0.016, fz);
      finger.rotation.z = 0.25;
      leftArm.add(finger);
    }

    leftArm.add(lSleeve, lFold1, lFold2, lCuff, watchBody, watchGlass, lPalm, lKnuckle, lThumbBase, lThumbTip);

    // 2. RIGHT TRIGGER ARM (-X in authoring space -> right side gripping pistol grip)
    const rightArm = new THREE.Group();
    const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.30, 12), sleeveBlueMat);
    rSleeve.rotation.x = Math.PI / 2;
    rSleeve.position.set(-0.055, -0.095, -0.21);
    rSleeve.rotation.y = 0.22;
    rSleeve.rotation.z = 0.16;

    const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.032, 12), cuffRibMat);
    rCuff.rotation.x = Math.PI / 2;
    rCuff.position.set(-0.022, -0.062, -0.095);

    const rPalm = new THREE.Mesh(new RoundedBoxGeometry(0.040, 0.056, 0.064, 2, 0.008), gloveTanMat);
    rPalm.position.set(-0.012, -0.048, -0.072);
    const rKnuckle = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.022, 0.054, 2, 0.004), gloveDarkMat);
    rKnuckle.position.set(-0.014, -0.032, -0.068);

    rightArm.add(rSleeve, rCuff, rPalm, rKnuckle);
    grp.add(leftArm, rightArm);
    return grp;
  }

  return { buildWeaponModel, buildAttachmentMesh, buildViewmodelHands };
})();

// ════════════════════════════════════════════════════════════════════════════
// PHYSICS — 8x8m Spatial Hash Grid, Colliders, Capsule Movement, Vault/Water
// ════════════════════════════════════════════════════════════════════════════
const Physics = (() => {
  const CELL = CONFIG.world.collisionCell;
  const grid = new Map();
  const colliders = [];

  function clear() {
    grid.clear();
    colliders.length = 0;
  }

  function clearTag(tag) {
    let kept = 0;
    for (let i = colliders.length - 1; i >= 0; i--) {
      if (colliders[i].tag === tag) {
        colliders[i].disabled = true;
        colliders.splice(i, 1);
      } else {
        kept++;
      }
    }
    if (kept === 0) {
      grid.clear();
      return;
    }
    grid.clear();
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      const cx0 = Math.floor(box.minX / CELL), cx1 = Math.floor(box.maxX / CELL);
      const cz0 = Math.floor(box.minZ / CELL), cz1 = Math.floor(box.maxZ / CELL);
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const k = cellKey(cx, cz);
          let arr = grid.get(k);
          if (!arr) { arr = []; grid.set(k, arr); }
          arr.push(box);
        }
      }
    }
  }

  function cellKey(cx, cz) { return `${cx},${cz}`; }

  function addCollider(box) {
    // box: { minX, maxX, minY, maxY, minZ, maxZ, mat, penetrable, tag, targetRef, openState }
    const id = colliders.length;
    colliders.push(box);
    const cx0 = Math.floor(box.minX / CELL), cx1 = Math.floor(box.maxX / CELL);
    const cz0 = Math.floor(box.minZ / CELL), cz1 = Math.floor(box.maxZ / CELL);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = cellKey(cx, cz);
        let arr = grid.get(k);
        if (!arr) { arr = []; grid.set(k, arr); }
        arr.push(box);
      }
    }
    return box;
  }

  const querySeen = new Set();
  const queryOut = [];
  function queryAABB(minX, maxX, minZ, maxZ) {
    querySeen.clear();
    queryOut.length = 0;
    const cx0 = Math.floor(minX / CELL), cx1 = Math.floor(maxX / CELL);
    const cz0 = Math.floor(minZ / CELL), cz1 = Math.floor(maxZ / CELL);
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const arr = grid.get(cellKey(cx, cz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (!querySeen.has(b) && !(b.disabled)) {
            querySeen.add(b);
            queryOut.push(b);
          }
        }
      }
    }
    return queryOut;
  }

  function rayBox(ox, oy, oz, dx, dy, dz, maxT, b) {
    let tmin = 0, tmax = maxT;
    let nx = 0, ny = 0, nz = 0;
    const axes = [
      [ox, dx, b.minX, b.maxX, -1, 0, 0],
      [oy, dy, b.minY, b.maxY, 0, -1, 0],
      [oz, dz, b.minZ, b.maxZ, 0, 0, -1]
    ];
    for (let i = 0; i < 3; i++) {
      const [o, d, bMin, bMax, sx, sy, sz] = axes[i];
      if (Math.abs(d) < 1e-8) {
        if (o < bMin || o > bMax) return null;
      } else {
        const inv = 1 / d;
        let t1 = (bMin - o) * inv;
        let t2 = (bMax - o) * inv;
        let sign = 1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = -1; }
        if (t1 > tmin) {
          tmin = t1;
          nx = sx * sign; ny = sy * sign; nz = sz * sign;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    return { t: tmin, nx, ny, nz, collider: b };
  }

  function raycast(ox, oy, oz, dx, dy, dz, maxDist, ignoreTarget = null) {
    let bestT = maxDist;
    let bestHit = null;

    // 1. Check static/dynamic colliders along ray bounding box
    const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
    const candidates = queryAABB(Math.min(ox, ex) - 1, Math.max(ox, ex) + 1, Math.min(oz, ez) - 1, Math.max(oz, ez) + 1);
    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (ignoreTarget && b.targetRef === ignoreTarget) continue;
      const hit = rayBox(ox, oy, oz, dx, dy, dz, bestT, b);
      if (hit && hit.t < bestT && hit.t > 0.001) {
        bestT = hit.t;
        bestHit = hit;
      }
    }

    // 2. Binary-refined Terrain heightfield raymarch
    const step = Math.min(2.0, Math.max(0.5, maxDist * 0.02));
    for (let t = 0.05; t <= bestT; t += step) {
      const px = ox + dx * t;
      const py = oy + dy * t;
      const pz = oz + dz * t;
      const th = World.getHeight(px, pz);
      if (py <= th) {
        let lo = Math.max(0, t - step), hi = t;
        for (let k = 0; k < 5; k++) {
          const mid = (lo + hi) * 0.5;
          const mpy = oy + dy * mid;
          const mth = World.getHeight(ox + dx * mid, oz + dz * mid);
          if (mpy <= mth) hi = mid; else lo = mid;
        }
        const tHit = (lo + hi) * 0.5;
        if (tHit < bestT) {
          const hx = ox + dx * tHit, hz = oz + dz * tHit;
          const n = World.getNormal(hx, hz, Util.v3);
          const groundMat = World.getHeight(hx, hz) < 2.2 ? 'sand' : 'grass';
          bestT = tHit;
          bestHit = { t: tHit, nx: n.x, ny: n.y, nz: n.z, collider: { mat: groundMat, tag: 'terrain' } };
        }
        break;
      }
    }

    // 3. Water surface plane check (y = seaLevel)
    if (dy < -0.001 && oy > CONFIG.world.seaLevel) {
      const tw = (CONFIG.world.seaLevel - oy) / dy;
      if (tw > 0 && tw < bestT) {
        bestT = tw;
        bestHit = { t: tw, nx: 0, ny: 1, nz: 0, collider: { mat: 'water', tag: 'water', penetrable: true } };
      }
    }

    return bestHit;
  }

  function resolveCapsuleXZ(pos, radius, height) {
    const list = queryAABB(pos.x - radius - 0.5, pos.x + radius + 0.5, pos.z - radius - 0.5, pos.z + radius + 0.5);
    let maxFloorY = World.getHeight(pos.x, pos.z);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (pos.x + radius <= b.minX || pos.x - radius >= b.maxX || pos.z + radius <= b.minZ || pos.z - radius >= b.maxZ) continue;
      if (pos.y >= b.maxY - CONFIG.player.stepUp) {
        if (b.maxY > maxFloorY) maxFloorY = b.maxY;
        continue;
      }
      if (pos.y + height <= b.minY || pos.y >= b.maxY) continue;
      const cx = Util.clamp(pos.x, b.minX, b.maxX);
      const cz = Util.clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const dSq = dx * dx + dz * dz;
      if (dSq < radius * radius) {
        const d = Math.sqrt(dSq);
        if (d > 1e-5) {
          const push = radius - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        } else {
          // Deep overlap fallback: push out smallest axis
          const dl = Math.abs(pos.x - b.minX), dr = Math.abs(b.maxX - pos.x);
          const df = Math.abs(pos.z - b.minZ), db = Math.abs(b.maxZ - pos.z);
          const m = Math.min(dl, dr, df, db);
          if (m === dl) pos.x = b.minX - radius;
          else if (m === dr) pos.x = b.maxX + radius;
          else if (m === df) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    return maxFloorY;
  }

  function carveExplosionHole(center, radius) {
    const r = Math.max(1.2, radius);
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.disabled) continue;
      const cx = Util.clamp(center.x, b.minX, b.maxX);
      const cy = Util.clamp(center.y, b.minY, b.maxY);
      const cz = Util.clamp(center.z, b.minZ, b.maxZ);
      const dist = Math.hypot(center.x - cx, center.y - cy, center.z - cz);
      if (dist > r) continue;
      if (b.glassRef) {
        b.glassRef.shatter();
        b.disabled = true;
      } else if (b.doorRef) {
        b.doorRef.isOpen = true;
        b.doorRef.animT = 1;
        b.disabled = true;
      } else if (b.tag === 'world') {
        const midX = (b.minX + b.maxX) * 0.5;
        const midZ = (b.minZ + b.maxZ) * 0.5;
        const gH = World.getHeight(midX, midZ);
        // Keep foundation floors beneath terrain safe so player doesn't fall under world
        if (b.maxY > gH + 0.45) b.disabled = true;
      }
    }
  }

  return { clear, clearTag, addCollider, queryAABB, raycast, resolveCapsuleXZ, carveExplosionHole };
})();

// ════════════════════════════════════════════════════════════════════════════
// FX & BALLISTICS — 120Hz Projectiles, Hitboxes, Penetration, Ricochet, Pools
// ════════════════════════════════════════════════════════════════════════════
const Ballistics = (() => {
  const MAX_BULLETS = 256;
  const bulletPool = Array.from({ length: MAX_BULLETS }, () => ({
    active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), prevPos: new THREE.Vector3(),
    dmg: 40, drag: 0.0009, ammo: '556', life: 0, dist: 0, falloff: null, owner: null, isSuppressed: false,
    isRocket: false, blastRadius: 0, mesh: null
  }));

  const MAX_TRACERS = 64;
  const tracers = [];
  const MAX_DECALS = 256;
  const decals = [];
  let decalIdx = 0;
  const rocketMeshes = [];

  let particles = null;
  let particleStates = [];
  let particleIdx = 0;
  let maxParticles = 600;
  let shotCounter = 0;
  const lastDebug = { event: 'none', pos: new THREE.Vector3(), dist: 0, mat: '', tgt: '', dmg: 0, hitY: 0 };
  const bDir = new THREE.Vector3();
  const bHitPos = new THREE.Vector3();
  const bNorm = new THREE.Vector3();

  function initFX(scene, presetCfg) {
    maxParticles = presetCfg.particles || 600;
    tracers.forEach(t => scene.remove(t.line));
    tracers.length = 0;
    const tMat = new THREE.LineBasicMaterial({ color: 0xFFE29A, transparent: true, opacity: 0.8 });
    for (let i = 0; i < MAX_TRACERS; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, tMat.clone());
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      tracers.push({ line, life: 0 });
    }

    rocketMeshes.forEach(m => scene.remove(m));
    rocketMeshes.length = 0;
    const rBodyMat = new THREE.MeshStandardMaterial({ color: 0x52613A, roughness: 0.45, metalness: 0.35 });
    const rFlameMat = new THREE.MeshBasicMaterial({ color: 0xFF8822 });
    const rHeadGeo = new THREE.ConeGeometry(0.06, 0.24, 10);
    rHeadGeo.rotateX(Math.PI * 0.5);
    const rShaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8);
    rShaftGeo.rotateX(Math.PI * 0.5);
    const rFlameGeo = new THREE.ConeGeometry(0.05, 0.24, 8);
    rFlameGeo.rotateX(-Math.PI * 0.5);
    for (let i = 0; i < 24; i++) {
      const rg = new THREE.Group();
      const head = new THREE.Mesh(rHeadGeo, rBodyMat); head.position.z = 0.14;
      const shaft = new THREE.Mesh(rShaftGeo, rBodyMat); shaft.position.z = -0.08;
      const flame = new THREE.Mesh(rFlameGeo, rFlameMat); flame.position.z = -0.32;
      rg.add(head, shaft, flame);
      rg.visible = false;
      rg.userData.inUse = false;
      scene.add(rg);
      rocketMeshes.push(rg);
    }

    decals.forEach(d => scene.remove(d.mesh));
    decals.length = 0;
    const dGeo = new THREE.PlaneGeometry(0.14, 0.14);
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(dGeo, new THREE.MeshBasicMaterial({ color: 0x16181A, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.visible = false;
      scene.add(m);
      decals.push({ mesh: m, life: 0 });
    }

    if (particles) scene.remove(particles);
    const pGeo = new THREE.BoxGeometry(0.032, 0.032, 0.05);
    const pMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.6 });
    particles = new THREE.InstancedMesh(pGeo, pMat, maxParticles);
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particles.frustumCulled = false;
    const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    particleStates = Array.from({ length: maxParticles }, (_, i) => {
      particles.setMatrixAt(i, zeroM);
      particles.setColorAt(i, new THREE.Color(0xD4AF37));
      return { life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 1, grav: 9.81 };
    });
    scene.add(particles);
  }

  function spawnParticle(pos, vel, colorHex = 0xCCCCCC, scale = 1, life = 0.6, grav = 9.81) {
    if (!particles) return;
    const i = particleIdx;
    particleIdx = (particleIdx + 1) % maxParticles;
    const st = particleStates[i];
    st.pos.copy(pos); st.vel.copy(vel); st.scale = scale; st.life = life; st.maxLife = life; st.grav = grav;
    particles.setColorAt(i, Util.v1.set ? new THREE.Color(colorHex) : new THREE.Color(colorHex));
    if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
  }

  function spawnTracer(p0, p1) {
    for (let i = 0; i < tracers.length; i++) {
      const tr = tracers[i];
      if (tr.life <= 0) {
        const arr = tr.line.geometry.attributes.position.array;
        arr[0] = p0.x; arr[1] = p0.y; arr[2] = p0.z;
        arr[3] = p1.x; arr[4] = p1.y; arr[5] = p1.z;
        tr.line.geometry.attributes.position.needsUpdate = true;
        tr.line.visible = true;
        tr.line.material.opacity = 0.85;
        tr.life = 0.12;
        return;
      }
    }
  }

  function spawnDecal(pos, nx, ny, nz, matType) {
    const d = decals[decalIdx];
    decalIdx = (decalIdx + 1) % MAX_DECALS;
    d.mesh.position.set(pos.x + nx * 0.015, pos.y + ny * 0.015, pos.z + nz * 0.015);
    d.mesh.lookAt(pos.x + nx, pos.y + ny, pos.z + nz);
    d.mesh.material.color.setHex(matType === 'wood' ? 0x2B1D12 : matType === 'metal' ? 0x4A5259 : 0x181A1D);
    d.mesh.material.opacity = 0.88;
    d.mesh.visible = true;
    d.life = 90.0;
  }

  function computeZeroPitch(vel, drag, dist) {
    // Analytical drop compensation for zeroing distance (e.g. 100..800m)
    const avgV = vel / (1 + drag * dist * 0.5);
    const t = dist / Math.max(50, avgV);
    const drop = 0.5 * CONFIG.ballistics.gravity * t * t;
    return Math.atan2(drop, dist);
  }

  function fireBullet(origin, dir, weaponDef, opts = {}) {
    shotCounter++;
    const showTracer = !opts.suppressed && (shotCounter % 3 === 1);
    for (let i = 0; i < bulletPool.length; i++) {
      const b = bulletPool[i];
      if (!b.active) {
        b.active = true;
        b.pos.copy(origin);
        b.prevPos.copy(origin);
        b.vel.copy(dir).normalize().multiplyScalar(weaponDef.muzzleVel);
        b.dmg = weaponDef.damage;
        b.drag = weaponDef.drag || CONFIG.ammoDrag[weaponDef.ammo] || 0.001;
        b.falloff = weaponDef.falloff;
        b.life = CONFIG.ballistics.maxLife;
        b.dist = 0;
        b.owner = opts.owner || null;
        b.isSuppressed = !!opts.suppressed;
        b.wantTracer = showTracer;
        b.isRocket = !!weaponDef.isRocket;
        b.blastRadius = weaponDef.blastRadius || 8.5;
        b.mesh = null;
        if (b.isRocket) {
          for (let r = 0; r < rocketMeshes.length; r++) {
            if (!rocketMeshes[r].userData.inUse) {
              const rm = rocketMeshes[r];
              rm.userData.inUse = true;
              rm.position.copy(origin);
              rm.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
              rm.visible = true;
              b.mesh = rm;
              break;
            }
          }
        }
        return;
      }
    }
  }

  function evalFalloff(falloff, dist) {
    if (!falloff || !falloff.length) return 1.0;
    for (let i = 1; i < falloff.length; i++) {
      if (dist <= falloff[i][0]) {
        const [d0, m0] = falloff[i - 1], [d1, m1] = falloff[i];
        return Util.lerp(m0, m1, (dist - d0) / Math.max(1, d1 - d0));
      }
    }
    return falloff[falloff.length - 1][1];
  }

  function releaseRocketMesh(b) {
    if (b.mesh) {
      b.mesh.visible = false;
      b.mesh.userData.inUse = false;
      b.mesh = null;
    }
    b.isRocket = false;
  }

  function step(dt, targets, onHitTarget) {
    const subDt = CONFIG.ballistics.ballisticDt || (1 / 120);
    const steps = Math.max(1, Math.round(dt / subDt));
    const hDt = dt / steps;

    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < bulletPool.length; i++) {
        const b = bulletPool[i];
        if (!b.active) continue;
        b.prevPos.copy(b.pos);

        // Quadratic air drag + gravity 9.81 m/s² (rockets have low drop / self-propelled feel)
        const spd = b.vel.length();
        const dragDecel = b.drag * spd;
        b.vel.multiplyScalar(Math.max(0, 1 - dragDecel * hDt));
        b.vel.y -= CONFIG.ballistics.gravity * (b.isRocket ? 0.15 : 1.0) * hDt;

        const speed = b.vel.length();
        const segLen = speed * hDt;
        if (!Number.isFinite(speed) || speed < 0.001 || segLen < 0.001) { releaseRocketMesh(b); b.active = false; continue; }
        bDir.copy(b.vel).divideScalar(speed);

        // Check entity targets first (spheres/boxes along ray)
        let hitTarget = null, hitTargetT = segLen, hitZone = 'chest';
        for (let ti = 0; ti < targets.length; ti++) {
          const tgt = targets[ti];
          if (!tgt.alive || tgt === b.owner) continue;
          const res = tgt.rayHitTest(b.pos, bDir, hitTargetT);
          if (res && res.t < hitTargetT) {
            hitTargetT = res.t;
            hitTarget = tgt;
            hitZone = res.zone;
          }
        }

        const worldHit = Physics.raycast(b.pos.x, b.pos.y, b.pos.z, bDir.x, bDir.y, bDir.z, hitTargetT);
        if (worldHit && worldHit.t <= hitTargetT) {
          const hx = b.pos.x + bDir.x * worldHit.t;
          const hy = b.pos.y + bDir.y * worldHit.t;
          const hz = b.pos.z + bDir.z * worldHit.t;
          bHitPos.set(hx, hy, hz);
          if (b.isRocket) {
            bNorm.set(worldHit.nx, worldHit.ny, worldHit.nz);
            lastDebug.event = 'rocketDetonate'; lastDebug.pos.copy(bHitPos); lastDebug.mat = worldHit.collider?.mat || 'concrete'; lastDebug.dist = b.dist + worldHit.t;
            WorldBuildings.detonateRocket?.(bHitPos.clone(), bNorm.clone(), b.blastRadius || 8.5, b.owner, targets, onHitTarget);
            releaseRocketMesh(b);
            b.active = false;
            continue;
          }
          const matType = worldHit.collider?.mat || 'concrete';
          AudioSys.playImpact(matType, bHitPos);

          if (matType !== 'water') {
            spawnDecal(bHitPos, worldHit.nx, worldHit.ny, worldHit.nz, matType);
          }
          const spCol = matType === 'metal' ? 0xFFCC55 : matType === 'wood' ? 0x9C7248 : matType === 'water' ? 0xCBE8F2 : 0xB8B8B0;
          for (let p = 0; p < 4; p++) {
            spawnParticle(bHitPos, new THREE.Vector3(worldHit.nx * 3 + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, worldHit.nz * 3 + (Math.random() - 0.5) * 4), spCol, 1.1, 0.35, 12);
          }

          // Breakable window glass shatter
          if (worldHit.collider?.glassRef) {
            worldHit.collider.glassRef.shatter();
            worldHit.collider.disabled = true;
            lastDebug.event = 'glassShatter'; lastDebug.pos.copy(bHitPos); lastDebug.mat = 'glass';
            b.pos.copy(bHitPos).addScaledVector(bDir, 0.14);
            b.vel.multiplyScalar(0.88);
            if (b.wantTracer) spawnTracer(b.prevPos, b.pos);
            continue;
          }

          // Wood / Glass penetration (Sec 10.3)
          if (worldHit.collider?.penetrable && b.vel.length() > 140) {
            lastDebug.event = 'penetrate'; lastDebug.pos.copy(bHitPos); lastDebug.mat = matType;
            b.pos.copy(bHitPos).addScaledVector(bDir, 0.28);
            b.vel.multiplyScalar(0.6);
            b.dmg *= 0.6;
            if (b.wantTracer) spawnTracer(b.prevPos, b.pos);
            continue;
          }

          // Shallow ricochet (< 15 deg from surface plane) on metal/concrete
          const cosIncidence = Math.abs(bDir.x * worldHit.nx + bDir.y * worldHit.ny + bDir.z * worldHit.nz);
          if (cosIncidence < 0.258 && (matType === 'metal' || matType === 'concrete') && b.vel.length() > 180) {
            lastDebug.event = 'ricochet'; lastDebug.pos.copy(bHitPos); lastDebug.mat = matType;
            const dotN = bDir.x * worldHit.nx + bDir.y * worldHit.ny + bDir.z * worldHit.nz;
            b.vel.set(bDir.x - 2 * dotN * worldHit.nx, bDir.y - 2 * dotN * worldHit.ny, bDir.z - 2 * dotN * worldHit.nz).multiplyScalar(spd * 0.65);
            b.pos.copy(bHitPos).addScaledVector(bNorm.set(worldHit.nx, worldHit.ny, worldHit.nz), 0.05);
            continue;
          }

          lastDebug.event = 'worldStop'; lastDebug.pos.copy(bHitPos); lastDebug.mat = matType; lastDebug.dist = b.dist + worldHit.t;
          if (b.wantTracer) spawnTracer(b.prevPos, bHitPos);
          b.active = false;
          continue;
        }

        if (hitTarget) {
          bHitPos.copy(b.pos).addScaledVector(bDir, hitTargetT);
          if (b.isRocket) {
            bNorm.copy(bDir).negate();
            lastDebug.event = 'rocketDetonate'; lastDebug.pos.copy(bHitPos); lastDebug.tgt = hitTarget.name || ''; lastDebug.dist = b.dist + hitTargetT;
            WorldBuildings.detonateRocket?.(bHitPos.clone(), bNorm.clone(), b.blastRadius || 8.5, b.owner, targets, onHitTarget);
            releaseRocketMesh(b);
            b.active = false;
            continue;
          }
          const totalDist = b.dist + hitTargetT;
          const mult = CONFIG.hitMult[hitZone] || 1.0;
          const finalDmg = b.dmg * evalFalloff(b.falloff, totalDist) * mult;
          lastDebug.event = 'targetHit'; lastDebug.pos.copy(bHitPos); lastDebug.tgt = hitTarget.name || ''; lastDebug.dmg = finalDmg; lastDebug.dist = totalDist; lastDebug.hitY = bHitPos.y;
          if (b.wantTracer) spawnTracer(b.prevPos, bHitPos);
          if (onHitTarget) onHitTarget(hitTarget, finalDmg, hitZone, totalDist, bHitPos, bDir, b.owner);
          b.active = false;
          continue;
        }

        b.pos.addScaledVector(b.vel, hDt);
        b.dist += segLen;
        b.life -= hDt;
        if (b.isRocket) {
          if (b.mesh) {
            b.mesh.position.copy(b.pos);
            b.mesh.lookAt(b.pos.x + bDir.x, b.pos.y + bDir.y, b.pos.z + bDir.z);
          }
          if (s === steps - 1) {
            spawnParticle(b.pos, new THREE.Vector3(-bDir.x * 3 + (Math.random() - 0.5) * 1.2, 0.8 + Math.random(), -bDir.z * 3 + (Math.random() - 0.5) * 1.2), 0xCCCCCC, 3.2, 0.55, 0.5);
            spawnParticle(b.pos, new THREE.Vector3(-bDir.x * 2, (Math.random() - 0.5), -bDir.z * 2), 0xFF7722, 2.2, 0.16, 0.0);
          }
        }
        if (b.wantTracer && s === steps - 1) spawnTracer(b.prevPos, b.pos);
        if (b.life <= 0 || b.dist > CONFIG.ballistics.maxDist) {
          lastDebug.event = 'expired'; lastDebug.pos.copy(b.pos); lastDebug.dist = b.dist;
          releaseRocketMesh(b);
          b.active = false;
        }
      }
    }

    // Update Tracers, Decals & Instanced Particles
    for (let i = 0; i < tracers.length; i++) {
      const tr = tracers[i];
      if (tr.life > 0) {
        tr.life -= dt;
        tr.line.material.opacity = Math.max(0, (tr.life / 0.12) * 0.85);
        if (tr.life <= 0) tr.line.visible = false;
      }
    }
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i];
      if (d.life > 0) {
        d.life -= dt;
        if (d.life < 10) d.mesh.material.opacity = Math.max(0, (d.life / 10) * 0.85);
        if (d.life <= 0) d.mesh.visible = false;
      }
    }
    if (particles) {
      let dirty = false;
      for (let i = 0; i < particleStates.length; i++) {
        const p = particleStates[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vel.y -= p.grav * dt;
          p.pos.addScaledVector(p.vel, dt);
          const fl = World.getHeight(p.pos.x, p.pos.z);
          if (p.pos.y < fl + 0.02) { p.pos.y = fl + 0.02; p.vel.y *= -0.35; p.vel.x *= 0.6; p.vel.z *= 0.6; }
          const sc = p.life > 0 ? p.scale * Math.min(1, p.life / (p.maxLife * 0.35)) : 0;
          Util.m4.makeScale(sc, sc, sc).setPosition(p.pos);
          particles.setMatrixAt(i, Util.m4);
          dirty = true;
        }
      }
      if (dirty) particles.instanceMatrix.needsUpdate = true;
    }
  }

  return { initFX, spawnParticle, fireBullet, step, computeZeroPitch, evalFalloff, lastDebug };
})();

