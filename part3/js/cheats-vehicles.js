// ════════════════════════════════════════════════════════════════════════════
// CHEATS-VEHICLES — Bom Chidori, Mobil & Motor (Kebal Saat Naik), Menu Cheat Stik
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const ChidoriSys = (() => {
  const orbs = [];
  const bursts = [];
  const tmpV = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function buildLightningLines(count = 10, radius = 0.65, colorHex = 0x7DF3FF) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const th = (i / count) * Math.PI * 2;
      const ph = ((i * 1.7) % Math.PI) - Math.PI * 0.5;
      let cx = 0, cy = 0, cz = 0;
      const dx = Math.cos(th) * Math.cos(ph);
      const dy = Math.sin(ph);
      const dz = Math.sin(th) * Math.cos(ph);
      for (let s = 1; s <= 4; s++) {
        const t = s / 4;
        const j = s === 4 ? 0 : (radius * 0.34);
        const nx = dx * radius * t + (Math.random() - 0.5) * j;
        const ny = dy * radius * t + (Math.random() - 0.5) * j;
        const nz = dz * radius * t + (Math.random() - 0.5) * j;
        pts.push(cx, cy, cz, nx, ny, nz);
        cx = nx; cy = ny; cz = nz;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: colorHex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending
    });
    return { lines: new THREE.LineSegments(geo, mat), geo, mat };
  }

  function fireChidori() {
    const scene = Render.scene;
    if (!scene || !Render.camera || !Player.alive) return false;
    Render.camera.getWorldDirection(tmpDir);
    const origin = Player.pos.clone();
    origin.y += 1.42;
    origin.addScaledVector(tmpDir, 1.15);

    const grp = new THREE.Group();
    grp.position.copy(origin);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending })
    );
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x22C8FF, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const bolt = buildLightningLines(12, 0.85, 0x99F6FF);
    const light = new THREE.PointLight(0x45E4FF, 16, 26, 1.5);
    grp.add(core, aura, bolt.lines, light);
    scene.add(grp);

    const vel = tmpDir.clone().multiplyScalar(40);
    vel.y += 1.8;
    orbs.push({ grp, core, aura, bolt, light, pos: grp.position, vel, ttl: 1.8 });
    AudioSys.playChidori('cast', origin);
    return true;
  }

  function detonateChidori(pos) {
    const scene = Render.scene;
    if (!scene) return;
    AudioSys.playChidori('burst', pos);
    const grp = new THREE.Group();
    grp.position.copy(pos);

    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x33D6FF, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), domeMat);
    const bolt = buildLightningLines(20, 7.5, 0xCCF9FF);
    const light = new THREE.PointLight(0x55ECFF, 58, 45, 1.3);
    grp.add(dome, bolt.lines, light);
    scene.add(grp);
    bursts.push({ grp, dome, domeMat, bolt, light, t: 0, dur: 0.65 });

    for (let p = 0; p < 28; p++) {
      Ballistics.spawnParticle(
        pos,
        new THREE.Vector3((Math.random() - 0.5) * 20, 3 + Math.random() * 14, (Math.random() - 0.5) * 20),
        p % 2 === 0 ? 0x62EEFF : 0xFFFFFF,
        0.7, 0.42, 14
      );
    }

    // Shatter glass panes nearby
    if (typeof WorldBuildings !== 'undefined') {
      const panes = WorldBuildings.glassPanes;
      for (let i = 0; i < panes.length; i++) {
        if (!panes[i].shattered && Math.hypot(panes[i].x - pos.x, panes[i].z - pos.z) < 22) {
          panes[i].shatter();
        }
      }
    }

    // Massive AoE lightning damage to enemies & range dummies (player immune to own Chidori)
    const rad = 18;
    const bots = AI.bots;
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (!b.alive) continue;
      const dist = b.pos.distanceTo(pos);
      if (dist <= rad) {
        const dmg = 280 * (1 - (dist / rad) * 0.65);
        AI.applyBotDamage(b, dmg, 'chest', dist, b.pos.clone(), b.pos.clone().sub(pos).normalize(), 'player');
      }
    }
    const tgts = Player.targets || [];
    for (let i = 0; i < tgts.length; i++) {
      const t = tgts[i];
      if (!t.alive) continue;
      const dist = t.pos.distanceTo(pos);
      if (dist <= rad) {
        t.hp = 0; t.alive = false; t.respawnTimer = 2.5;
        if (t.mesh) t.mesh.rotation.x = -Math.PI / 2.2;
        Player.showHitFeedback?.(260, 'chest', dist, false);
      }
    }
  }

  function update(dt) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.ttl -= dt;
      o.vel.y -= 9.2 * dt;
      tmpV.copy(o.vel).multiplyScalar(dt);
      const step = tmpV.length();
      let hitNow = false;
      if (step > 0.01) {
        tmpDir.copy(tmpV).multiplyScalar(1 / step);
        const h = Physics.raycast(o.pos.x, o.pos.y, o.pos.z, tmpDir.x, tmpDir.y, tmpDir.z, step + 0.35);
        if (h) { o.pos.addScaledVector(tmpDir, Math.max(0, h.t - 0.1)); hitNow = true; }
      }
      if (!hitNow) o.pos.add(tmpV);

      o.bolt.lines.rotation.y += dt * 18;
      o.bolt.lines.rotation.x += dt * 13;
      o.core.scale.setScalar(0.9 + Math.sin(performance.now() * 0.04) * 0.2);

      // Proximity trigger against enemy bots
      const bots = AI.bots;
      for (let bi = 0; bi < bots.length; bi++) {
        if (bots[bi].alive && bots[bi].pos.distanceTo(o.pos) < 2.4) { hitNow = true; break; }
      }
      const gh = World.getHeight(o.pos.x, o.pos.z) + 0.35;
      if (o.pos.y <= gh) { o.pos.y = gh; hitNow = true; }

      if (hitNow || o.ttl <= 0) {
        const boomPos = o.pos.clone();
        Render.scene?.remove(o.grp);
        o.bolt.geo.dispose(); o.bolt.mat.dispose();
        orbs.splice(i, 1);
        detonateChidori(boomPos);
      }
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const bv = bursts[i];
      bv.t += dt;
      const u = bv.t / bv.dur;
      if (u >= 1) {
        Render.scene?.remove(bv.grp);
        bv.dome.geometry.dispose(); bv.domeMat.dispose();
        bv.bolt.geo.dispose(); bv.bolt.mat.dispose();
        bursts.splice(i, 1);
      } else {
        bv.dome.scale.setScalar(0.8 + u * 16.5);
        bv.domeMat.opacity = 0.78 * (1 - u);
        bv.bolt.lines.rotation.y += dt * 22;
        bv.bolt.lines.scale.setScalar(0.6 + u * 2.2);
        bv.bolt.mat.opacity = 1 - u;
        bv.light.intensity = 58 * (1 - u) * (1 - u);
      }
    }
  }

  function clearAll() {
    orbs.forEach(o => { Render.scene?.remove(o.grp); o.bolt.geo.dispose(); o.bolt.mat.dispose(); });
    orbs.length = 0;
    bursts.forEach(bv => { Render.scene?.remove(bv.grp); bv.dome.geometry.dispose(); bv.domeMat.dispose(); bv.bolt.geo.dispose(); bv.bolt.mat.dispose(); });
    bursts.length = 0;
  }

  return { fireChidori, detonateChidori, update, clearAll };
})();

const VehiclesSys = (() => {
  const vehicles = [];
  let activeVehicle = null;
  let headSpot = null;
  let headTarget = null;
  const wheelMats = [];

  function ensureHeadSpot(scene) {
    if (!headSpot && scene) {
      headSpot = new THREE.SpotLight(0xFFF3CC, 0, 95, Math.PI * 0.24, 0.55, 1.15);
      headTarget = new THREE.Object3D();
      scene.add(headSpot, headTarget);
      headSpot.target = headTarget;
    }
  }

  function makeWheel(rad, width, isMoto = false) {
    const g = new THREE.Group();
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1A1D21, roughness: 0.88, metalness: 0.08 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xC6CDD4, roughness: 0.28, metalness: 0.78 });
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, width, 16), tireMat);
    tire.rotation.z = Math.PI * 0.5;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.58, rad * 0.58, width + 0.02, 12), rimMat);
    rim.rotation.z = Math.PI * 0.5;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, rad * 0.9, 0.05), rimMat);
    g.add(tire, rim, spoke);
    if (isMoto) {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, width + 0.06, 8), rimMat);
      hub.rotation.z = Math.PI * 0.5;
      g.add(hub);
    }
    return g;
  }

  function buildMobilMesh() {
    const grp = new THREE.Group();
    const bodyGrp = new THREE.Group();
    grp.add(bodyGrp);

    const paint = new THREE.MeshStandardMaterial({ color: 0x1856B8, roughness: 0.26, metalness: 0.52 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x1E2228, roughness: 0.65, metalness: 0.3 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xF2B705, roughness: 0.35, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x182634, roughness: 0.08, metalness: 0.65, transparent: true, opacity: 0.86 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xFFF7D6 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xFF2828 });

    // Forward = -Z
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.56, 4.45), paint);
    chassis.position.set(0, 0.56, 0);
    chassis.castShadow = true; chassis.receiveShadow = true;

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 1.45), paint);
    hood.position.set(0, 0.85, -1.35);
    hood.rotation.x = 0.08;

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 4.35), stripeMat);
    stripe.position.set(0, 0.92, -0.05);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.64, 2.05), trim);
    cabin.position.set(0, 1.15, 0.24);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.08, 1.85), paint);
    roof.position.set(0, 1.49, 0.28);

    const wsFront = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.52, 0.08), glassMat);
    wsFront.position.set(0, 1.15, -0.78);
    wsFront.rotation.x = -0.34;

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.24, 0.22), trim);
    bumperF.position.set(0, 0.36, -2.26);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.24, 0.20), trim);
    bumperR.position.set(0, 0.38, 2.24);

    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.06, 0.34), trim);
    spoilerWing.position.set(0, 1.08, 2.06);
    const spL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.16), trim); spL.position.set(-0.72, 0.96, 2.06);
    const spR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.16), trim); spR.position.set(0.72, 0.96, 2.06);

    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), headMat); hlL.position.set(-0.68, 0.62, -2.24);
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), headMat); hlR.position.set(0.68, 0.62, -2.24);
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), tailMat); tlL.position.set(-0.70, 0.66, 2.24);
    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.08), tailMat); tlR.position.set(0.70, 0.66, 2.24);

    bodyGrp.add(chassis, hood, stripe, cabin, roof, wsFront, bumperF, bumperR, spoilerWing, spL, spR, hlL, hlR, tlL, tlR);

    const wheels = [];
    const wPos = [[-0.98, 0.38, -1.36], [0.98, 0.38, -1.36], [-0.98, 0.38, 1.38], [0.98, 0.38, 1.38]];
    for (const [wx, wy, wz] of wPos) {
      const w = makeWheel(0.38, 0.28, false);
      w.position.set(wx, wy, wz);
      grp.add(w);
      wheels.push(w);
    }
    return { grp, bodyGrp, wheels };
  }

  function buildMotorMesh() {
    // Motor detail tinggi dari MotoKit (rangka tubular, fork upside-down, mesin bersirip, knalpot, rantai, rem cakram)
    return MotoKit.buildRideable(0xD02424);
  }
  function spawnVehicle(kind = 'mobil', autoBoard = true) {
    const scene = Render.scene;
    if (!scene || !Player.alive) return null;
    ensureHeadSpot(scene);
    if (activeVehicle) dismount(true);

    const sinY = Math.sin(Player.yaw), cosY = Math.cos(Player.yaw);
    const sx = Util.clamp(Player.pos.x - sinY * 4.2, -760, 760);
    const sz = Util.clamp(Player.pos.z - cosY * 4.2, -760, 760);
    const sy = Math.max(0.1, World.getHeight(sx, sz));

    const model = kind === 'motor' ? buildMotorMesh() : buildMobilMesh();
    model.grp.position.set(sx, sy, sz);
    model.grp.rotation.y = Player.yaw;
    scene.add(model.grp);

    // Keep pool trimmed to max 6 spawned vehicles
    if (vehicles.length >= 6) {
      const old = vehicles.shift();
      if (old && old !== activeVehicle) scene.remove(old.grp);
    }

    const v = {
      id: `veh-${vehicles.length + 1}`,
      kind,
      label: kind === 'motor' ? 'Motor Trail Supermoto' : 'Mobil Rajawali GT',
      maxSpeed: kind === 'motor' ? 42 : 36,
      boostSpeed: kind === 'motor' ? 54 : 48,
      accel: kind === 'motor' ? 32 : 24,
      turnRate: kind === 'motor' ? 2.65 : 2.15,
      grp: model.grp,
      bodyGrp: model.bodyGrp,
      wheels: model.wheels,
      pos: model.grp.position,
      yaw: Player.yaw,
      speed: 0,
      lean: 0
    };
    vehicles.push(v);
    if (autoBoard) boardVehicle(v);
    AudioSys.playUiTone('alert');
    return v;
  }

  function boardVehicle(v) {
    if (!v || !Player.alive) return false;
    activeVehicle = v;
    ensureHeadSpot(Render.scene);
    Player.setTpp?.(true); // Start vehicle cam in TPP chase so you can see it clearly; L1/V toggles FPP/TPP anytime
    document.getElementById('hud-vehicle-pill')?.classList.remove('hidden');
    return true;
  }

  function dismount(silent = false) {
    if (!activeVehicle) return false;
    const v = activeVehicle;
    activeVehicle = null;
    if (headSpot) headSpot.intensity = 0;
    document.getElementById('hud-vehicle-pill')?.classList.add('hidden');
    // Step out safely to the left side of the vehicle
    const sx = Util.clamp(v.pos.x - Math.cos(v.yaw) * 2.1, -760, 760);
    const sz = Util.clamp(v.pos.z + Math.sin(v.yaw) * 2.1, -760, 760);
    Player.pos.set(sx, Math.max(0.1, World.getHeight(sx, sz)) + 0.08, sz);
    Player.yaw = v.yaw;
    if (!silent) AudioSys.playMechanical('reload_mag');
    return true;
  }

  function findNearestVehicle(pos, maxDist = 3.8) {
    let best = null, bestD = maxDist;
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v === activeVehicle) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function updatePlayerDriving(dt, gp, view) {
    const v = activeVehicle;
    if (!v) return;
    const cheatOpen = typeof CheatUI !== 'undefined' && CheatUI.isOpen;

    // Exit check: F key OR Stik Square / Circle (when cheat panel closed)
    if (!cheatOpen && (Input.wasPressed('interact') || gp?.reloadJust || gp?.crouchJust)) {
      dismount();
      return;
    }

    const gasKey = Input.isDown('forward') ? 1 : 0;
    const brakeKey = Input.isDown('backward') ? 1 : 0;
    const padGas = !cheatOpen && gp ? (gp.fire ? 1 : Math.max(0, -gp.moveY)) : 0;
    const padBrake = !cheatOpen && gp ? (gp.ads ? 1 : Math.max(0, gp.moveY)) : 0;
    const throttle = Util.clamp(Math.max(gasKey, padGas), 0, 1);
    const reverse = Util.clamp(Math.max(brakeKey, padBrake), 0, 1);
    const boost = !cheatOpen && (Input.isDown('sprint') || !!gp?.sprint);

    let steerIn = (Input.isDown('left') ? 1 : 0) - (Input.isDown('right') ? 1 : 0);
    if (!cheatOpen && gp) steerIn -= gp.moveX;
    steerIn = Util.clamp(steerIn, -1, 1);

    const top = boost ? v.boostSpeed : v.maxSpeed;
    if (throttle > 0.05) {
      v.speed = Util.damp(v.speed, throttle * top, boost ? 6.5 : 4.2, dt);
    } else if (reverse > 0.05) {
      v.speed = v.speed > 2 ? Util.damp(v.speed, 0, 9.5, dt) : Util.damp(v.speed, -12 * reverse, 4.5, dt);
    } else {
      v.speed = Util.damp(v.speed, 0, 1.8, dt);
    }

    const spdAbs = Math.abs(v.speed);
    const steerGrip = Util.clamp(spdAbs / 4.5, 0.25, 1.0) * (v.speed >= -0.2 ? 1 : -1);
    v.yaw += steerIn * v.turnRate * steerGrip * dt;

    const sinY = Math.sin(v.yaw), cosY = Math.cos(v.yaw);
    v.pos.x = Util.clamp(v.pos.x - sinY * v.speed * dt, -CONFIG.world.halfSize + 14, CONFIG.world.halfSize - 14);
    v.pos.z = Util.clamp(v.pos.z - cosY * v.speed * dt, -CONFIG.world.halfSize + 14, CONFIG.world.halfSize - 14);

    // Resolve building collisions cleanly
    const floorH = Physics.resolveCapsuleXZ(v.pos, v.kind === 'motor' ? 0.65 : 1.35, 1.85);
    const groundY = Math.max(CONFIG.world.seaLevel - 0.8, Math.max(floorH, World.getHeight(v.pos.x, v.pos.z)));
    v.pos.y = Util.damp(v.pos.y, groundY, 22, dt);

    // Terrain pitch slope & Motor corner lean
    const fH = World.getHeight(v.pos.x - sinY * 1.4, v.pos.z - cosY * 1.4);
    const bH = World.getHeight(v.pos.x + sinY * 1.4, v.pos.z + cosY * 1.4);
    const slopePitch = Util.clamp(Math.atan2(fH - bH, 2.8), -0.45, 0.45);
    const targetLean = v.kind === 'motor' ? steerIn * Util.clamp(spdAbs / 18, 0, 0.42) : steerIn * Util.clamp(spdAbs / 28, 0, 0.08);
    v.lean = Util.damp(v.lean, targetLean, 10, dt);

    v.grp.rotation.set(slopePitch, v.yaw, v.lean);
    for (let w = 0; w < v.wheels.length; w++) {
      v.wheels[w].rotation.x -= (v.speed / 0.36) * dt;
    }

    // Sync player position cleanly with vehicle seat (so zone, minimap & AI tracking work!)
    Player.pos.set(v.pos.x, v.pos.y + (v.kind === 'motor' ? 0.25 : 0.35), v.pos.z);

    // Ramming roadkill vs enemy bots
    if (spdAbs > 7.5) {
      const bots = AI.bots;
      const hitRad = v.kind === 'motor' ? 1.8 : 2.35;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        if (!b.alive) continue;
        if (Math.hypot(b.pos.x - v.pos.x, b.pos.z - v.pos.z) < hitRad && Math.abs(b.pos.y - v.pos.y) < 2.2) {
          AI.applyBotDamage(b, 200, 'chest', 1.5, b.pos.clone(), new THREE.Vector3(-sinY, 0.3, -cosY), 'player');
          AudioSys.playImpact('metal', b.pos);
        }
      }
    }

    // Dust trail & engine synth sound
    if (spdAbs > 3.5) {
      AudioSys.playVehiclePulse(Util.clamp(spdAbs / 45, 0, 1), v.kind === 'motor', boost);
      if (Math.random() < (boost ? 0.8 : 0.4)) {
        Ballistics.spawnParticle(
          new THREE.Vector3(v.pos.x + sinY * 1.6, v.pos.y + 0.18, v.pos.z + cosY * 1.6),
          new THREE.Vector3((Math.random() - 0.5) * 2.5, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 2.5),
          boost ? 0x38D6FF : 0x8F836E, 0.65, 0.38, 12
        );
      }
    }

    // Headlight beam illuminating road ahead
    if (headSpot) {
      const isNight = !!CONFIG.timeOfDay[Render.tod]?.night;
      headSpot.intensity = isNight ? 52 : 12;
      headSpot.position.set(v.pos.x - sinY * 1.6, v.pos.y + 0.95, v.pos.z - cosY * 1.6);
      headTarget.position.set(v.pos.x - sinY * 26, v.pos.y - 1.2, v.pos.z - cosY * 26);
    }

    // Camera tracking (works smoothly with Right Stick / Mouse in FPP & TPP!)
    const cam = Render.camera;
    const camYaw = view.yaw;
    const camPitch = view.pitch;
    const cSin = Math.sin(camYaw), cCos = Math.cos(camYaw);
    if (!view.isTpp) {
      // Driver hood / biker FPP view
      const eyeY = v.kind === 'motor' ? 1.58 : 1.42;
      cam.position.set(v.pos.x - sinY * 0.25, v.pos.y + eyeY, v.pos.z - cosY * 0.25);
      cam.rotation.order = 'YXZ';
      cam.rotation.set(camPitch, camYaw, 0);
    } else {
      // Smooth TPP chase camera orbiting around vehicle
      const chaseD = v.kind === 'motor' ? 5.2 : 6.8;
      const chaseH = v.kind === 'motor' ? 2.25 : 2.65;
      const ox = v.pos.x + cSin * Math.cos(camPitch * 0.6) * chaseD;
      const oz = v.pos.z + cCos * Math.cos(camPitch * 0.6) * chaseD;
      const oy = Math.max(World.getHeight(ox, oz) + 0.65, v.pos.y + chaseH - Math.sin(camPitch) * 3.8);
      cam.position.set(ox, oy, oz);
      cam.lookAt(v.pos.x, v.pos.y + 1.15, v.pos.z);
    }
    const baseFov = UI.settings.fov || CONFIG.camera.fov;
    cam.fov = Util.damp(cam.fov, baseFov + (spdAbs / 45) * 14 + (boost ? 6 : 0), 8, dt);
    cam.updateProjectionMatrix();
    Render.setViewmodelEnabled(false);

    // Update Speedometer pill
    const kmh = Math.round(spdAbs * 3.6);
    const spEl = document.getElementById('hud-veh-speed');
    if (spEl) spEl.textContent = `${kmh} KM/J${boost ? ' ⚡TURBO' : ''}`;
  }

  function clearAll() {
    dismount(true);
    vehicles.forEach(v => Render.scene?.remove(v.grp));
    vehicles.length = 0;
  }

  return {
    spawnVehicle, boardVehicle, dismount, findNearestVehicle, updatePlayerDriving, clearAll,
    isDriving: () => !!activeVehicle,
    get activeVehicle() { return activeVehicle; },
    get vehicles() { return vehicles; }
  };
})();

const CheatUI = (() => {
  let open = false;
  let selIdx = 0;
  let chidoriShortcut = false;
  let stickRepeatCd = 0;

  const ITEMS = [
    {
      id: 'equip_bazooka',
      title: '🚀 Pilih Basoka RPG-7 (Penghancur Rumah & Kota)',
      desc: 'Langsung pakai Basoka tanpa ambil! Tembak rumah/gedung agar hancur berlubang [Tombol 2 / B].',
      badge: () => (Player.activeWeapon?.id === 'bazooka' ? 'AKTIF' : 'PAKAI'),
      action: () => { Player.equipWeaponInSlot('bazooka', 1); AudioSys.playUiTone('alert'); close(); }
    },
    {
      id: 'chidori_fire',
      title: '⚡ Keluarkan Bom Chidori',
      desc: 'Tembakkan bola petir Chidori meledak ke arah bidikan (AoE 18m).',
      badge: () => 'TEMBAK',
      action: () => { close(); ChidoriSys.fireChidori(); }
    },
    {
      id: 'chidori_toggle',
      title: '⚡ Shortcut Bom Chidori [R1 / G]',
      desc: 'Saat aktif, tekan R1 (stik) atau G kapan saja untuk melempar Bom Chidori.',
      badge: () => chidoriShortcut ? 'AKTIF' : 'NONAKTIF',
      action: () => { chidoriShortcut = !chidoriShortcut; AudioSys.playUiTone('click'); render(); }
    },
    {
      id: 'spawn_car',
      title: '🚗 Spawn & Naik Mobil Rajawali GT',
      desc: 'Ngebut cepat (R2 Gas • L3 Turbo • Kebal tembakan sampai turun!).',
      badge: () => 'SPAWN',
      action: () => { close(); VehiclesSys.spawnVehicle('mobil', true); }
    },
    {
      id: 'spawn_moto',
      title: '🏍️ Spawn & Naik Motor Trail Supermoto',
      desc: 'Motor super kencang & lincah (Kebal selama naik, kecuali turun!).',
      badge: () => 'SPAWN',
      action: () => { close(); VehiclesSys.spawnVehicle('motor', true); }
    },
    {
      id: 'dismount',
      title: '🚶 Turun dari Kendaraan',
      desc: 'Keluar dari mobil/motor (kembali rentan terhadap tembakan musuh).',
      badge: () => VehiclesSys.isDriving() ? 'TURUN' : '—',
      action: () => { VehiclesSys.dismount(); close(); }
    },
    {
      id: 'unlim_ammo',
      title: '♾️ Peluru Pemain Unlimited (Musuh Tetap Terbatas)',
      desc: 'Peluru khusus pemain tidak pernah habis; AI bot tetap kehabisan peluru.',
      badge: () => Player.unlimitedAmmo ? 'AKTIF' : 'NONAKTIF',
      action: () => { Player.setUnlimitedAmmo(!Player.unlimitedAmmo); AudioSys.playUiTone('click'); render(); }
    },
    {
      id: 'heal_full',
      title: '💉 Isi HP, Boost & Armor Level 3 Penuh',
      desc: 'Memulihkan HP 100%, energi penuh, serta Helm & Rompi Lv.3.',
      badge: () => 'PULIHKAN',
      action: () => { Player.healFull(); render(); }
    },
    {
      id: 'god_mode',
      title: '🛡️ Mode Kebal Jalan Kaki (Opsional)',
      desc: 'Nonaktif agar tetap realistis tertembak mati saat turun kendaraan.',
      badge: () => Player.godMode ? 'AKTIF' : 'NONAKTIF',
      action: () => { Player.setGodMode(!Player.godMode); AudioSys.playUiTone('click'); render(); }
    }
  ];

  function render() {
    const list = document.getElementById('cheat-list');
    if (!list) return;
    list.innerHTML = ITEMS.map((it, idx) => `
      <div class="cheat-row ${idx === selIdx ? 'active' : ''}" data-cidx="${idx}">
        <div>
          <div class="cheat-title">${it.title}</div>
          <div class="cheat-desc">${it.desc}</div>
        </div>
        <span class="cheat-badge ${it.badge() === 'AKTIF' ? 'on' : ''}">${it.badge()}</span>
      </div>`).join('');
    list.querySelectorAll('.cheat-row').forEach(row => {
      row.onclick = () => {
        selIdx = Number(row.dataset.cidx);
        ITEMS[selIdx].action();
      };
    });
    const padBadge = document.getElementById('cheat-pad-status');
    if (padBadge) {
      padBadge.textContent = Input.gamepadConnected
        ? `STIK AKTIF: ${Input.gamepadName.slice(0, 32)}`
        : 'STIK BELUM TERDETEKSI (TEKAN SEMBARANG TOMBOL STIK / PAKAI F4)';
    }
  }

  function openMenu() {
    if (Game.state !== 'PRACTICE' && Game.state !== 'MATCH') return;
    open = true;
    document.exitPointerLock?.();
    render();
    document.getElementById('cheat-overlay')?.classList.remove('hidden');
    AudioSys.playUiTone('alert');
  }

  function close() {
    open = false;
    document.getElementById('cheat-overlay')?.classList.add('hidden');
    if (typeof Game !== 'undefined' && (Game.state === 'PRACTICE' || Game.state === 'MATCH') && !UI.hasModalOpen && !(typeof MapUI !== 'undefined' && MapUI.isOpen)) {
      try {
        const pr = document.getElementById('gl-canvas')?.requestPointerLock?.();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      } catch (_) {}
    }
  }

  function toggle() {
    if (open) close(); else openMenu();
  }

  function update(dt) {
    if (Game.state !== 'PRACTICE' && Game.state !== 'MATCH') {
      if (open) close();
      return;
    }
    const gp = Input.pollGamepad();
    // HUD Pad status badge update
    const padHud = document.getElementById('hud-pad-badge');
    if (padHud) {
      padHud.classList.toggle('connected', !!gp);
      padHud.textContent = gp ? 'STIK AKTIF • [START] MENU CHEAT' : 'STIK SIAP • TEKAN START UNTUK CHEAT';
    }

    // Start button on Gamepad or F4 toggles Cheat Menu
    if (gp?.startJust || Input.wasCodePressed('F4')) {
      toggle();
      return;
    }

    // Quick Chidori trigger when shortcut enabled
    if (!open && chidoriShortcut && (gp?.grenadeJust || Input.wasCodePressed('KeyG'))) {
      ChidoriSys.fireChidori();
    }

    if (!open) return;
    if (stickRepeatCd > 0) stickRepeatCd -= dt;

    let moveDir = 0;
    if (gp?.dpadUpJust || Input.wasCodePressed('ArrowUp') || Input.wasCodePressed('KeyW')) moveDir = -1;
    else if (gp?.dpadDownJust || Input.wasCodePressed('ArrowDown') || Input.wasCodePressed('KeyS')) moveDir = 1;
    else if (gp && Math.abs(gp.moveY) > 0.55 && stickRepeatCd <= 0) {
      moveDir = gp.moveY > 0 ? 1 : -1;
      stickRepeatCd = 0.19;
    }

    if (moveDir !== 0) {
      selIdx = (selIdx + moveDir + ITEMS.length) % ITEMS.length;
      AudioSys.playUiTone('click');
      render();
    }
    if (gp?.jumpJust || gp?.fireJust || Input.wasCodePressed('Enter')) {
      ITEMS[selIdx].action();
    } else if (gp?.crouchJust) {
      close();
    }
  }

  return {
    open: openMenu, close, toggle, update, render,
    get isOpen() { return open; },
    get chidoriShortcut() { return chidoriShortcut; }
  };
})();
