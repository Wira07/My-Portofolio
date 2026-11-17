// ════════════════════════════════════════════════════════════════════════════
// DEBUG — F3 Profiler Overlay & Automated selfTest() (?test=1)
// ════════════════════════════════════════════════════════════════════════════
const Debug = (() => {
  let enabled = new URLSearchParams(location.search).has('test') || location.hash.includes('debug');
  let overlayEl = null;
  let visible = false;
  let fpsAvg = 60;
  let frameMsAvg = 16.6;
  const tods = ['pagi', 'siang', 'sore', 'malam'];
  const weathers = ['cerah', 'mendung', 'kabut', 'hujan'];

  function log(...args) {
    if (enabled) console.debug('[RAJAWALI]', ...args);
  }

  function init() {
    overlayEl = document.getElementById('debug-overlay');
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        visible = !visible;
        enabled = true;
        overlayEl.classList.toggle('hidden', !visible);
      }
    });

    overlayEl.querySelectorAll('[data-dbg]').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.dbg;
        if (act === 'toggle-studio') Game.toggleStudioCamera();
        else if (act === 'tp-sukamaju') Game.teleportCam(-110, 280);
        else if (act === 'tp-pelabuhan') Game.teleportCam(-440, 540);
        else if (act === 'tp-menara') Game.teleportCam(-20, -240);
        else if (act === 'tp-kota') Game.teleportCam(156, 118);
        else if (act === 'cycle-time') {
          const nxt = tods[(tods.indexOf(Render.tod) + 1) % tods.length];
          Render.applyAtmosphere(nxt, Render.weather);
        } else if (act === 'cycle-weather') {
          const nxt = weathers[(weathers.indexOf(Render.weather) + 1) % weathers.length];
          Render.applyAtmosphere(Render.tod, nxt);
        } else if (act === 'spawn-bots') {
          AI.spawnPracticeSkirmish(Render.scene, 4);
        } else if (act === 'run-selftest') {
          const res = runSelfTest();
          const out = document.getElementById('dbg-selftest-out');
          out.classList.remove('hidden');
          out.textContent = JSON.stringify(res, null, 2);
        }
      };
    });
  }

  function update(dt, stateName) {
    const instFps = dt > 0 ? Math.min(240, 1 / dt) : 60;
    fpsAvg = Util.lerp(fpsAvg, instFps, 0.08);
    frameMsAvg = Util.lerp(frameMsAvg, dt * 1000, 0.08);

    const inlineFps = document.getElementById('hud-fps-inline');
    if (inlineFps) inlineFps.textContent = `${Math.round(fpsAvg)} FPS`;

    if (!visible || !Render.renderer) return;
    document.getElementById('dbg-state').textContent = `STATE: ${stateName} | ${Render.tod}/${Render.weather}`;
    const info = Render.renderer.info;
    const sc = Render.sceneStats;
    const cam = Render.camera.position;
    const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : 'N/A';
    document.getElementById('dbg-metrics').innerHTML = `
      <div>FPS: <b>${fpsAvg.toFixed(1)}</b> (${frameMsAvg.toFixed(1)} ms)</div>
      <div>Draw calls: <b>${sc.calls}</b></div>
      <div>Triangles: <b>${sc.triangles.toLocaleString()}</b></div>
      <div>Geometries: <b>${info.memory.geometries}</b></div>
      <div>Textures: <b>${info.memory.textures}</b></div>
      <div>JS Heap: <b>${mem}</b></div>
      <div>Pos: <b>${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, ${cam.z.toFixed(1)}</b></div>
      <div>Chunks: <b>${World.chunks}</b> | Seed: <b>${World.seed}</b></div>
      <div>PBR Mats: <b>${Object.keys(Assets.all).length}</b></div>
      <div>AI: <b>${AI.aiTimeMs.toFixed(2)} ms</b> (${AI.bots.filter(b => b.alive).length} aktif)</div>
    `;
  }

  function runSelfTest() {
    const checks = [];
    const assert = (name, cond, detail = '') => checks.push({ name, pass: !!cond, detail });

    assert('webgl2Renderer', !!Render.renderer && Render.renderer.capabilities.isWebGL2);
    assert('materialLibraryCount>=12', Object.keys(Assets.all).length >= 12, `count=${Object.keys(Assets.all).length}`);
    assert('terrainChunks==256', World.chunks === 256, `chunks=${World.chunks}`);
    const centerH = World.getHeight(-110, 280);
    assert('sukamajuHeightFinite', Number.isFinite(centerH) && centerH > 5, `h=${centerH.toFixed(2)}`);
    const seaH = World.getHeight(795, 795);
    assert('oceanEdgeSubmerged', seaH < 0, `h=${seaH.toFixed(2)}`);
    assert('zonePhases==8', CONFIG.zone.length === 8 && CONFIG.zone[0].r0 === 780 && CONFIG.zone[7].r1 === 0);
    assert('hitboxMultHead', CONFIG.hitMult.head === 2.35 && CONFIG.hitMult.leg === 0.8);
    assert('weaponsCatalog>=11', Object.keys(WEAPONS_DB).length >= 11, `n=${Object.keys(WEAPONS_DB).length}`);
    assert('attachmentsCatalog>=20', Object.keys(ATTACHMENTS_DB).length >= 20, `n=${Object.keys(ATTACHMENTS_DB).length}`);
    const z100 = Ballistics.computeZeroPitch(780, 0.0009, 100);
    const z300 = Ballistics.computeZeroPitch(780, 0.0009, 300);
    assert('ballisticZeroingMonotonic', z100 > 0 && z300 > z100 * 3.0, `100m=${z100.toFixed(5)} 300m=${z300.toFixed(5)}`);
    assert('armorLevels==3', CONFIG.armor.helm[2].abs === 0.55 && CONFIG.armor.vest[0].abs === 0.30);
    const navPath = NavGrid.findPath(-440, 540, -110, 280);
    assert('navGridBridgePath>=3', Array.isArray(navPath) && navPath.length >= 3, `wps=${navPath?.length || 0}`);
    assert('throwablesSpecs==3', Object.keys(Throwables.SPECS).length === 3);
    assert('lootSpawned>=500', Array.isArray(Loot.groundItems) && Loot.groundItems.length >= 500, `l=${Loot.groundItems?.length || 0}`);

    const passed = checks.every(c => c.pass);
    return { passed, timestamp: new Date().toISOString(), fps: Number(fpsAvg.toFixed(1)), checks };
  }

  return {
    init, update, runSelfTest, log,
    get fps() { return fpsAvg; },
    setVisible(v) { visible = v; overlayEl?.classList.toggle('hidden', !v); }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// MATCHSYS — BR Flow: Staging Lobby -> C-130 Plane -> Skydive/Chute -> 8-Phase
//            Zone -> Red Zone Artillery -> Airdrop -> Spectate & Victory
// ════════════════════════════════════════════════════════════════════════════
const MatchSys = (() => {
  let phase = 'IDLE'; // IDLE | LOBBY_ISLAND | PLANE | FREEFALL | PARACHUTE | MATCH | SPECTATE | RESULT
  let activeCfg = null;
  let totalParticipants = 40;
  let lobbyTimer = 15;
  let matchElapsed = 0;

  // Aircraft & Skydive state
  let planeMesh = null;
  let propDiscs = [];
  let chuteMesh = null;
  let skydiverRig = null;
  let planeProgress = 0;
  const planeStart = new THREE.Vector3();
  const planeEnd = new THREE.Vector3();
  const planePos = new THREE.Vector3();
  let planeYaw = 0;
  let botsSpawned = false;

  // 8-Phase Blue Zone + White Next Safe Zone
  const getWaitSec = (z) => Number(z.waitSec ?? z.wait ?? z.stay ?? z.delay ?? 90);
  const getShrinkSec = (z) => Number(z.shrinkSec ?? z.shrink ?? z.move ?? z.close ?? 60);
  let zoneMesh = null;
  let zoneIdx = 0;
  let zoneState = 'WAIT'; // WAIT | SHRINK
  let zoneTimer = 0;
  const blueZone = { x: 0, z: 0, r: 780, dps: 0.4 };
  const whiteZone = { x: 0, z: 0, r: 560 };
  const shrinkStart = { x: 0, z: 0, r: 780 };
  let rng = Util.mulberry32(CONFIG.seedDefault);

  // Red Zone Artillery
  let redZone = null; // { x, z, r, warnTimer, activeTimer, shellCd }
  let nextRedZoneCd = 28;

  // Supply Airdrop
  let airdrop = null; // { x, y, z, groundY, falling, landed, mesh, chute, smokeCols, crateSpawned }
  let nextAirdropCd = 22;

  // Spectate & Stats
  let spectateIdx = 0;
  let statsRecorded = false;
  let lastSummary = null;
  const tmpCamTarget = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function clearVisuals(scene) {
    if (planeMesh) { scene?.remove(planeMesh); planeMesh = null; propDiscs = []; }
    if (chuteMesh) { scene?.remove(chuteMesh); chuteMesh = null; }
    if (skydiverRig?.root) { scene?.remove(skydiverRig.root); skydiverRig = null; }
    if (zoneMesh) { scene?.remove(zoneMesh); zoneMesh = null; }
    if (airdrop?.mesh) { scene?.remove(airdrop.mesh); }
    if (airdrop?.smokeCols) airdrop.smokeCols.forEach(m => scene?.remove(m));
    airdrop = null;
    redZone = null;
    document.getElementById('match-status-pill')?.classList.add('hidden');
  }

  function ensureStatusPill() {
    let pill = document.getElementById('match-status-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'match-status-pill';
      pill.style.cssText = 'position:fixed;bottom:118px;left:50%;transform:translateX(-50%);background:rgba(12,14,16,0.82);border:1px solid rgba(242,183,5,0.55);color:#EDEFF1;padding:7px 16px;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:0.6px;z-index:25;pointer-events:auto;cursor:pointer;text-align:center;';
      document.getElementById('hud-layer')?.appendChild(pill);
    }
    return pill;
  }

  function buildC130Plane(scene) {
    if (planeMesh) scene.remove(planeMesh);
    propDiscs = [];
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x465242, roughness: 0.52, metalness: 0.42 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1D2226, roughness: 0.6, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x6BB2D8, roughness: 0.15, metalness: 0.8 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xF2B705 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 22), hullMat);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.68, 3.8, 12), hullMat);
    nose.rotation.x = Math.PI * 0.5; nose.position.set(0, -0.15, 12.92);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.8), glassMat);
    cockpit.position.set(0, 0.95, 11.1);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.2, 3.6), hullMat);
    tail.position.set(0, 3.2, -10.4);
    const hTail = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.35, 2.4), hullMat);
    hTail.position.set(0, 1.4, -10.3);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(28, 0.45, 3.8), hullMat);
    wing.position.set(0, 1.55, 1.0);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 3.8), darkMat);
    ramp.position.set(0, -1.65, -11.5); ramp.rotation.x = 0.28;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), beaconMat);
    beacon.position.set(0, 5.9, -10.4);
    g.add(body, nose, cockpit, tail, hTail, wing, ramp, beacon);

    const pGeo = new THREE.BoxGeometry(2.6, 0.14, 0.1);
    [-9.5, -5.2, 5.2, 9.5].forEach(wx => {
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 8), darkMat);
      nac.rotation.x = Math.PI * 0.5; nac.position.set(wx, 1.35, 2.2);
      const prop = new THREE.Mesh(pGeo, darkMat);
      prop.position.set(wx, 1.35, 3.7);
      g.add(nac, prop);
      propDiscs.push(prop);
    });

    scene.add(g);
    planeMesh = g;
  }

  function buildParachuteCanopy(scene) {
    if (chuteMesh) scene.remove(chuteMesh);
    const g = new THREE.Group();
    const cMat1 = new THREE.MeshStandardMaterial({ color: 0x5D6E3E, roughness: 0.72, side: THREE.DoubleSide });
    const cMat2 = new THREE.MeshStandardMaterial({ color: 0xF2B705, roughness: 0.58, side: THREE.DoubleSide });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x202428 });
    // Arched ram-air canopy spanning X (left-right wingspan) arching UP (+Y: sin(theta) > 0 for theta in [0.08pi, 0.92pi])
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5.2, 12, 1, true, Math.PI * 0.08, Math.PI * 0.84), cMat1);
    panel.rotation.z = Math.PI * 0.5;
    panel.position.y = 2.15;
    const accent = new THREE.Mesh(new THREE.CylinderGeometry(2.53, 2.53, 1.1, 12, 1, true, Math.PI * 0.08, Math.PI * 0.84), cMat2);
    accent.rotation.z = Math.PI * 0.5;
    accent.position.y = 2.15;
    g.add(panel, accent);
    const pts = [
      new THREE.Vector3(-0.22, 1.3, 0), new THREE.Vector3(-2.4, 2.75, -1.2),
      new THREE.Vector3(-0.22, 1.3, 0), new THREE.Vector3(-2.4, 2.75, 1.2),
      new THREE.Vector3(0.22, 1.3, 0), new THREE.Vector3(2.4, 2.75, -1.2),
      new THREE.Vector3(0.22, 1.3, 0), new THREE.Vector3(2.4, 2.75, 1.2)
    ];
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
    g.add(lines);
    scene.add(g);
    chuteMesh = g;
  }

  function buildZoneCylinder(scene) {
    if (zoneMesh) scene.remove(zoneMesh);
    const geo = new THREE.CylinderGeometry(1, 1, 560, 48, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2B8CFF, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    zoneMesh = new THREE.Mesh(geo, mat);
    zoneMesh.position.set(0, 220, 0);
    zoneMesh.visible = false;
    scene.add(zoneMesh);
  }

  function startMatch(cfg) {
    activeCfg = cfg;
    totalParticipants = cfg.participants || 40;
    rng = Util.mulberry32((cfg.seed || CONFIG.seedDefault) + 137);
    clearVisuals(Render.scene);
    Throwables.initScene(Render.scene);
    VerletRagdoll.init(Render.scene);
    AI.resetPlayerStats?.();
    const kf = document.getElementById('hud-kill-feed');
    if (kf) kf.innerHTML = '';
    const kl = document.getElementById('hud-kills');
    if (kl) kl.textContent = '0';

    const isCity = cfg?.mapArea === 'city';
    buildZoneCylinder(Render.scene);
    zoneIdx = 0;
    zoneState = 'WAIT';
    const p0 = CONFIG.zone[0];
    zoneTimer = getWaitSec(p0);
    blueZone.x = 0; blueZone.z = 0; blueZone.r = p0.r0; blueZone.dps = p0.dps;
    const ang0 = rng() * Math.PI * 2;
    const shift0 = (p0.r0 - p0.r1) * 0.45 * rng();
    whiteZone.x = isCity ? (160 + Math.cos(ang0) * 18) : (Math.cos(ang0) * shift0);
    whiteZone.z = isCity ? (90 + Math.sin(ang0) * 18) : (Math.sin(ang0) * shift0);
    whiteZone.r = p0.r1;
    shrinkStart.x = 0; shrinkStart.z = 0; shrinkStart.r = p0.r0;
    Player.setZonesRef({ blue: blueZone, white: whiteZone });

    nextRedZoneCd = 28;
    nextAirdropCd = 22;
    botsSpawned = false;
    statsRecorded = false;
    lastSummary = null;
    matchElapsed = 0;
    spectateIdx = 0;

    // Place player either at Kota Piccadilly urban square or SW Staging Coastland
    let sx = -440, sz = 540, syaw = 0.3, spitch = 0;
    if (isCity) {
      sx = 155.5; sz = 118.5; syaw = 0.08; spitch = 0.04;
    } else {
      for (let k = 0; k < 12; k++) {
        const tx = -440 + k * 22, tz = 540 - k * 18;
        if (World.getHeight(tx, tz) >= 2.2) { sx = tx; sz = tz; break; }
      }
    }
    Player.setPerspectiveMode(cfg.perspective || 'free');
    Player.initLoadoutForMode('br');
    Player.spawnAt(sx, sz, syaw, spitch);
    AI.bots.length = 0;

    phase = 'LOBBY_ISLAND';
    lobbyTimer = 15;
    Input.setGameplayActive(true);
    document.getElementById('hud-layer').classList.remove('hidden');
    document.getElementById('hud-alive').textContent = String(totalParticipants);
    const poiHud = document.getElementById('hud-poi-name');
    if (poiHud) poiHud.textContent = isCity ? 'Kota Piccadilly (Perkotaan)' : 'Pulau Persiapan';
    const pill = ensureStatusPill();
    pill.classList.remove('hidden');
    pill.innerHTML = (isCity ? 'KOTA PICCADILLY (LOBI)' : 'PULAU PERSIAPAN') + ' &bull; Terjun otomatis dalam <span id="lobby-sec">15</span>d &bull; <span style="color:#F2B705">[SPACE / Klik: Naik Pesawat Sekarang]</span>';
    pill.onclick = () => { if (phase === 'LOBBY_ISLAND') enterPlane(); };
  }

  function enterPlane() {
    if (phase !== 'LOBBY_ISLAND') return;
    phase = 'PLANE';
    buildC130Plane(Render.scene);

    // Compute seeded cross-island chord (passing directly above Kota Piccadilly if city mode)
    const isCity = activeCfg?.mapArea === 'city';
    const a = rng() * Math.PI * 2;
    const cx = isCity ? 160 : 0;
    const cz = isCity ? 90 : 0;
    const span = isCity ? 640 : 860;
    planeStart.set(cx + Math.cos(a) * span, 540, cz + Math.sin(a) * span);
    planeEnd.set(cx - Math.cos(a) * span, 540, cz - Math.sin(a) * span);
    planeProgress = isCity ? 0.34 : 0.22;
    planePos.lerpVectors(planeStart, planeEnd, planeProgress);
    planeYaw = Math.atan2(planeEnd.x - planeStart.x, planeEnd.z - planeStart.z);
    planeMesh.position.copy(planePos);
    planeMesh.rotation.set(0, planeYaw, 0);

    // Spawn AI bots cleanly across the island or concentrated around Kota Piccadilly
    if (!botsSpawned) {
      AI.spawnMatchBots(Render.scene, totalParticipants - 1, activeCfg?.difficulty || 'regular', {
        x: isCity ? 160 : 0,
        z: isCity ? 90 : 0,
        cityFocus: isCity
      });
      botsSpawned = true;
    }

    Player.initLoadoutForMode('br');
    Render.setViewmodelEnabled(false);
    Player.setForceRigVisible(false);
    document.getElementById('hud-poi-name').textContent = 'Pesawat Angkut C-130';
    const pill = ensureStatusPill();
    pill.classList.remove('hidden');
    pill.innerHTML = 'DI ATAS PESAWAT C-130 • <span style="color:#F2B705">[TEKAN F / SPACE / KLIK UNTUK TERJUN]</span>';
    pill.onclick = () => { if (phase === 'PLANE') ejectFromPlane(); };
  }

  function ejectFromPlane() {
    if (phase !== 'PLANE') return;
    phase = 'FREEFALL';
    Player.pos.set(planePos.x, planePos.y - 4, planePos.z);
    Player.setForceRigVisible(true);
    if (skydiverRig?.root) Render.scene?.remove(skydiverRig.root);
    skydiverRig = CharacterRig.createRig(0x4F5E3F);
    if (skydiverRig?.root) {
      skydiverRig.root.position.copy(Player.pos);
      Render.scene?.add(skydiverRig.root);
    }
    AudioSys.playUiTone('alert');
    const pill = ensureStatusPill();
    pill.classList.remove('hidden');
    pill.onclick = () => { if (phase === 'FREEFALL') openParachute(); };
  }

  function openParachute() {
    if (phase !== 'FREEFALL') return;
    phase = 'PARACHUTE';
    buildParachuteCanopy(Render.scene);
    AudioSys.playUiTone('click');
  }

  function touchdown() {
    phase = 'MATCH';
    if (chuteMesh) { Render.scene?.remove(chuteMesh); chuteMesh = null; }
    if (skydiverRig?.root) { Render.scene?.remove(skydiverRig.root); skydiverRig = null; }
    Player.setForceRigVisible(UI.settings.defaultPersp === 'tpp');
    Render.setViewmodelEnabled(true);
    Player.spawnAt(Player.pos.x, Player.pos.z, Player.yaw);
    AudioSys.playImpact('stone', Player.pos);
    document.getElementById('match-status-pill')?.classList.add('hidden');
    if (zoneMesh) zoneMesh.visible = true;
    const ab = document.getElementById('hud-alert-banner');
    if (ab) {
      ab.textContent = 'Mendarat! Kumpulkan senjata & perlengkapan di bangunan terdekat!';
      ab.classList.add('visible');
      setTimeout(() => ab.classList.remove('visible'), 4000);
    }
  }

  function advanceZone(dt) {
    if (zoneIdx >= CONFIG.zone.length) return;
    const zCfg = CONFIG.zone[zoneIdx];
    zoneTimer -= dt;
    blueZone.dps = zCfg.dps;

    if (zoneState === 'WAIT') {
      if (zoneTimer <= 0) {
        zoneState = 'SHRINK';
        zoneTimer = Math.max(1, getShrinkSec(zCfg));
        shrinkStart.x = blueZone.x; shrinkStart.z = blueZone.z; shrinkStart.r = blueZone.r;
      }
    } else {
      const frac = 1 - Util.clamp(zoneTimer / Math.max(1, getShrinkSec(zCfg)), 0, 1);
      blueZone.x = shrinkStart.x + (whiteZone.x - shrinkStart.x) * frac;
      blueZone.z = shrinkStart.z + (whiteZone.z - shrinkStart.z) * frac;
      blueZone.r = shrinkStart.r + (whiteZone.r - shrinkStart.r) * frac;
      if (zoneTimer <= 0) {
        zoneIdx++;
        if (zoneIdx < CONFIG.zone.length) {
          const nxt = CONFIG.zone[zoneIdx];
          zoneState = 'WAIT';
          zoneTimer = getWaitSec(nxt);
          const ang = rng() * Math.PI * 2;
          const maxShift = Math.max(0, blueZone.r - nxt.r1) * 0.55 * rng();
          whiteZone.x = Util.clamp(blueZone.x + Math.cos(ang) * maxShift, -560, 560);
          whiteZone.z = Util.clamp(blueZone.z + Math.sin(ang) * maxShift, -560, 560);
          whiteZone.r = nxt.r1;
        }
      }
    }

    if (zoneMesh) {
      zoneMesh.visible = true;
      zoneMesh.position.x = blueZone.x;
      zoneMesh.position.z = blueZone.z;
      const rVis = Math.max(1.5, blueZone.r);
      zoneMesh.scale.set(rVis, 1, rVis);
      zoneMesh.material.opacity = 0.16 + Math.sin(performance.now() * 0.004) * 0.05;
    }
  }

  function updateRedZoneAndAirdrop(dt) {
    // Red Zone (Phases 1..6)
    if (!redZone && zoneIdx >= 1 && zoneIdx <= 6) {
      nextRedZoneCd -= dt;
      if (nextRedZoneCd <= 0) {
        const ang = rng() * Math.PI * 2;
        const rad = blueZone.r * 0.5 * Math.sqrt(rng());
        redZone = { x: blueZone.x + Math.cos(ang) * rad, z: blueZone.z + Math.sin(ang) * rad, r: 95, warnTimer: 5.0, activeTimer: 12.0, shellCd: 0.4 };
        const ab = document.getElementById('hud-alert-banner');
        if (ab) {
          ab.textContent = 'PERINGATAN ZONA MERAH — Cari bangunan untuk berlindung!';
          ab.classList.add('visible');
          setTimeout(() => ab.classList.remove('visible'), 4500);
        }
      }
    } else if (redZone) {
      if (redZone.warnTimer > 0) {
        redZone.warnTimer -= dt;
      } else {
        redZone.activeTimer -= dt;
        redZone.shellCd -= dt;
        if (redZone.shellCd <= 0) {
          redZone.shellCd = 0.85;
          const a = rng() * Math.PI * 2;
          const rr = redZone.r * Math.sqrt(rng());
          Throwables.detonateArtillery(redZone.x + Math.cos(a) * rr, redZone.z + Math.sin(a) * rr);
        }
        if (redZone.activeTimer <= 0) {
          redZone = null;
          nextRedZoneCd = 38 + rng() * 18;
        }
      }
    }

    // Supply Airdrop
    if (!airdrop && zoneIdx <= 6) {
      nextAirdropCd -= dt;
      if (nextAirdropCd <= 0) {
        const a = rng() * Math.PI * 2;
        const rr = whiteZone.r * 0.55 * Math.sqrt(rng());
        const ax = Util.clamp(whiteZone.x + Math.cos(a) * rr, -580, 580);
        const az = Util.clamp(whiteZone.z + Math.sin(a) * rr, -580, 580);
        const gy = Math.max(0.5, World.getHeight(ax, az));

        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.35, 1.5), new THREE.MeshStandardMaterial({ color: 0x8F2323, roughness: 0.5, metalness: 0.35 }));
        box.position.y = 0.68; box.castShadow = true;
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.24, 1.58), new THREE.MeshStandardMaterial({ color: 0x263858, roughness: 0.45 }));
        lid.position.y = 1.35;
        const chute = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xE5E8EC, roughness: 0.7, side: THREE.DoubleSide }));
        chute.position.y = 4.2;
        g.add(box, lid, chute);
        g.position.set(ax, gy + 160, az);
        Render.scene?.add(g);

        airdrop = { x: ax, y: gy + 160, z: az, groundY: gy, falling: true, landed: false, mesh: g, chute, crateSpawned: false, smokeCols: [], ttl: 120 };
        const ab = document.getElementById('hud-alert-banner');
        if (ab) {
          ab.textContent = 'KOTAK SUPLAI UDARA DIJATUHKAN — Periksa peta taktis!';
          ab.classList.add('visible');
          setTimeout(() => ab.classList.remove('visible'), 4000);
        }
      }
    } else if (airdrop) {
      if (airdrop.falling) {
        airdrop.y -= 14 * dt;
        if (airdrop.y <= airdrop.groundY) {
          airdrop.y = airdrop.groundY;
          airdrop.falling = false;
          airdrop.landed = true;
          airdrop.chute.visible = false;
          AudioSys.playImpact('metal', airdrop.mesh.position);
          // Red signal flare plume
          const smMat = new THREE.MeshBasicMaterial({ color: 0xE5383B, transparent: true, opacity: 0.32, depthWrite: false });
          for (let k = 0; k < 4; k++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.9 + k * 0.45, 7, 6), smMat);
            p.position.set(airdrop.x, airdrop.groundY + 2 + k * 3.8, airdrop.z);
            Render.scene?.add(p);
            airdrop.smokeCols.push(p);
          }
          // Spawn real Tier-3 supply loot crate at drop coordinates
          const desiredIds = ['m24', 'helm3', 'vest3', 'bag3', 'scope8x', 'medkit', 'adrenaline'];
          const allDefs = Loot.ITEMS || {};
          const crateItems = desiredIds.filter(id => allDefs[id]).map(id => ({ itemId: id, id, def: allDefs[id], qty: allDefs[id].qty || 1 }));
          if (crateItems.length === 0) {
            Object.values(allDefs).slice(0, 5).forEach(d => crateItems.push({ itemId: d.id, id: d.id, def: d, qty: 1 }));
          }
          Loot.spawnDeathCrate(airdrop.x, airdrop.groundY, airdrop.z, crateItems, 'Suplai Udara Tier-3');
        }
        airdrop.mesh.position.set(airdrop.x, airdrop.y, airdrop.z);
      } else {
        airdrop.ttl -= dt;
        const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.14;
        airdrop.smokeCols.forEach((m, i) => { m.scale.setScalar(pulse); m.position.y = airdrop.groundY + 2 + i * 3.8 + Math.sin(performance.now() * 0.002 + i) * 0.4; });
        if (airdrop.ttl <= 0) {
          Render.scene?.remove(airdrop.mesh);
          airdrop.smokeCols.forEach(m => Render.scene?.remove(m));
          airdrop = null;
          nextAirdropCd = 45;
        }
      }
    }
  }

  function openResultModal() {
    if (!lastSummary) return;
    UI.showMatchResultModal(
      lastSummary,
      () => Game.exitToMenu(),
      () => Game.startMatchFlow(activeCfg)
    );
  }

  function finishMatch(win, cause) {
    if (statsRecorded) return;
    statsRecorded = true;
    const aliveBots = AI.bots.filter(b => b.alive).length;
    const rank = win ? 1 : (aliveBots + 1);
    const summary = {
      win,
      rank,
      total: totalParticipants,
      kills: AI.playerKills,
      damage: AI.playerDamage,
      headshots: 0,
      longestKill: 0,
      timeSec: matchElapsed,
      mode: 'Solo BR',
      cause
    };
    lastSummary = summary;
    UI.recordMatchStats(summary);
    setTimeout(() => {
      if (phase === 'SPECTATE' || phase === 'RESULT') {
        openResultModal();
      }
    }, win ? 1800 : 1200);
  }

  function updateZoneHud() {
    const phEl = document.getElementById('hud-zone-phase');
    const tmEl = document.getElementById('hud-zone-timer');
    const dsEl = document.getElementById('hud-zone-dist');
    if (phase === 'LOBBY_ISLAND') {
      if (phEl) phEl.textContent = 'PERSIAPAN';
      if (tmEl) tmEl.textContent = `00:${String(Math.max(0, Math.ceil(lobbyTimer))).padStart(2, '0')}`;
      if (dsEl) dsEl.textContent = 'Pulau Persiapan';
      return;
    }
    if (phEl) phEl.textContent = `FASE ${Math.min(8, zoneIdx + 1)}`;
    const sec = Math.max(0, Math.ceil(zoneTimer));
    if (tmEl) tmEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    if (dsEl) {
      const distOut = Math.hypot(Player.pos.x - blueZone.x, Player.pos.z - blueZone.z) - blueZone.r;
      dsEl.textContent = distOut > 0 ? `${Math.round(distOut)}m luar` : (zoneState === 'SHRINK' ? 'Menyusut' : 'Aman');
    }
  }

  function update(dt, elapsed, inp) {
    if (phase === 'IDLE' || !Render.camera) return;
    matchElapsed += dt;

    if (phase === 'LOBBY_ISLAND') {
      lobbyTimer -= dt;
      const secEl = document.getElementById('lobby-sec');
      if (secEl) secEl.textContent = String(Math.max(0, Math.ceil(lobbyTimer)));
      Player.update(dt, elapsed, inp);
      Throwables.updatePlayerThrow(dt, inp);
      updateZoneHud();
      const cheatOpen = typeof CheatUI !== 'undefined' && CheatUI.isOpen;
      if (lobbyTimer <= 0 || Input.wasCodePressed('Space') || (!cheatOpen && Input.pollGamepad()?.jumpJust)) enterPlane();
      return;
    }

    if (phase === 'PLANE') {
      planeProgress += dt * (62 / Math.max(100, planeStart.distanceTo(planeEnd)));
      planePos.lerpVectors(planeStart, planeEnd, Util.clamp(planeProgress, 0, 1));
      if (planeMesh) {
        planeMesh.position.copy(planePos);
        planeMesh.rotation.set(0, planeYaw, 0);
        propDiscs.forEach(p => { p.rotation.z += dt * 38; });
      }
      const gpP = Input.pollGamepad();
      Player.yaw -= ((inp.dx || 0) * 0.0022) + (gpP ? gpP.lookX * 2.1 * dt : 0);
      Player.pitch = Util.clamp(Player.pitch - (inp.dy || 0) * 0.002 - (gpP ? gpP.lookY * 1.65 * dt : 0), -0.8, 0.4);
      const distBack = 28;
      const chaseAng = planeYaw + Player.yaw - 0.35;
      Render.camera.position.set(
        planePos.x - Math.sin(chaseAng) * distBack,
        planePos.y + 8.5 - Math.sin(Player.pitch) * 10,
        planePos.z - Math.cos(chaseAng) * distBack
      );
      Render.camera.lookAt(planePos.x, planePos.y - 0.5, planePos.z);
      Player.pos.copy(planePos);
      const zObj = { blue: { ...blueZone, radius: blueZone.r }, white: { ...whiteZone, radius: whiteZone.r } };
      AI.update(dt, elapsed, Player.playerTarget, Throwables.smokes, zObj);
      MapUI.updateMinimap(Player.pos.x, Player.pos.z, Player.yaw, zObj);
      if (MapUI.isOpen) MapUI.drawBigMap(zObj, getPlaneInfo(), airdrop ? { x: airdrop.x, z: airdrop.z } : null, redZone);
      updateZoneHud();
      const cheatOpen = typeof CheatUI !== 'undefined' && CheatUI.isOpen;
      if (Input.wasCodePressed('KeyF') || Input.wasCodePressed('Space') || (!cheatOpen && (gpP?.jumpJust || gpP?.reloadJust)) || planeProgress >= 0.88) {
        ejectFromPlane();
      }
      return;
    }

    if (phase === 'FREEFALL' || phase === 'PARACHUTE') {
      const isChute = phase === 'PARACHUTE';
      const gpF = Input.pollGamepad();
      Player.yaw -= ((inp.dx || 0) * 0.0022) + (gpF ? gpF.lookX * 2.2 * dt : 0);
      Player.pitch = Util.clamp(Player.pitch - (inp.dy || 0) * 0.002 - (gpF ? gpF.lookY * 1.7 * dt : 0), -1.1, 0.55);
      const diveKey = Input.isCodeDown('KeyW') ? 1 : (Input.isCodeDown('KeyS') ? -0.4 : 0.25);
      const dive = Util.clamp(diveKey + (gpF && Math.abs(gpF.moveY) > 0.12 ? -gpF.moveY * 0.9 : 0), -0.5, 1.15);
      const strafeKey = (Input.isCodeDown('KeyD') ? 1 : 0) - (Input.isCodeDown('KeyA') ? 1 : 0);
      const strafe = Util.clamp(strafeKey + (gpF ? gpF.moveX : 0), -1, 1);
      const vFall = isChute ? 7.4 : (dive > 0.5 ? 74 : 52);
      const hSpeed = isChute ? 17.5 : 28;
      const sinY = Math.sin(Player.yaw), cosY = Math.cos(Player.yaw);
      Player.pos.x = Util.clamp(Player.pos.x + (-sinY * dive * hSpeed + cosY * strafe * 16) * dt, -760, 760);
      Player.pos.z = Util.clamp(Player.pos.z + (-cosY * dive * hSpeed - sinY * strafe * 16) * dt, -760, 760);
      Player.pos.y -= vFall * dt;

      const groundY = Math.max(0, World.getHeight(Player.pos.x, Player.pos.z));
      const agl = Math.max(0, Player.pos.y - groundY);
      if (skydiverRig?.root) {
        skydiverRig.root.position.copy(Player.pos);
        skydiverRig.root.rotation.set(isChute ? -0.14 : -0.68, Player.yaw, -strafe * 0.15);
        const rotOf = (part) => part?.rotation || part?.upper?.rotation || part?.piv?.rotation || part?.root?.rotation;
        rotOf(skydiverRig.armL)?.set(isChute ? 2.45 : 0.85, 0, isChute ? -0.25 : -0.65);
        rotOf(skydiverRig.armR)?.set(isChute ? 2.45 : 0.85, 0, isChute ? 0.25 : 0.65);
        rotOf(skydiverRig.legL)?.set(isChute ? -0.22 : -0.28, 0, -0.1);
        rotOf(skydiverRig.legR)?.set(isChute ? 0.16 : -0.14, 0, 0.1);
      }
      if (chuteMesh && isChute) {
        chuteMesh.position.copy(Player.pos);
        chuteMesh.rotation.set(dive * 0.12, Player.yaw, -strafe * 0.16);
      }

      Render.camera.position.set(
        Player.pos.x + sinY * 9.2,
        Player.pos.y + 1.85 - Math.sin(Player.pitch) * 3.5,
        Player.pos.z + cosY * 9.2
      );
      Render.camera.lookAt(Player.pos.x, Player.pos.y + 2.2, Player.pos.z);

      const pill = ensureStatusPill();
      pill.classList.remove('hidden');
      pill.innerHTML = isChute
        ? `PARASUT TERBUKA • Ketinggian <span class="tabular" style="color:#F2B705">${Math.round(agl)} m</span>`
        : `TERJUN BEBAS • Ketinggian <span class="tabular" style="color:#F2B705">${Math.round(agl)} m</span> • [SPACE] Buka Parasut (Auto 120m)`;

      const zObj = { blue: { ...blueZone, radius: blueZone.r }, white: { ...whiteZone, radius: whiteZone.r } };
      document.getElementById('hud-poi-name').textContent = World.getClosestPoiName(Player.pos.x, Player.pos.z);
      MapUI.updateMinimap(Player.pos.x, Player.pos.z, Player.yaw, zObj);
      if (MapUI.isOpen) MapUI.drawBigMap(zObj, null, null, null);
      AI.update(dt, elapsed, Player.playerTarget, Throwables.smokes, zObj);

      if (!isChute && (agl <= 120 || (agl < 480 && (Input.wasCodePressed('Space') || (!(typeof CheatUI !== 'undefined' && CheatUI.isOpen) && Input.pollGamepad()?.jumpJust))))) {
        openParachute();
      } else if (isChute && agl <= 0.85) {
        Player.pos.y = groundY;
        touchdown();
      }
      return;
    }

    if (phase === 'MATCH') {
      Player.update(dt, elapsed, inp);
      Throwables.updatePlayerThrow(dt, inp);
      advanceZone(dt);
      updateRedZoneAndAirdrop(dt);
      const zones = { blue: blueZone, white: whiteZone };
      AI.update(dt, elapsed, Player.playerTarget, Throwables.smokes, zones);
      if (MapUI.isOpen) MapUI.drawBigMap(zones, null, airdrop ? { x: airdrop.x, z: airdrop.z } : null, redZone);
      updateZoneHud();

      const aliveBots = AI.bots.filter(b => b.alive).length;
      const aliveTotal = (Player.alive ? 1 : 0) + aliveBots;
      const alEl = document.getElementById('hud-alive');
      if (alEl) alEl.textContent = String(aliveTotal);

      if (!Player.alive) {
        phase = aliveBots > 0 ? 'SPECTATE' : 'RESULT';
        finishMatch(false, 'Anda tereliminasi di medan tempur');
      } else if (aliveBots === 0 && totalParticipants > 1) {
        phase = 'RESULT';
        const pill = ensureStatusPill();
        pill.classList.remove('hidden');
        pill.innerHTML = '<span style="color:#F2B705;font-size:15px;">★ JUARA PULAU RAJAWALI — MAHKOTA TERAKHIR #1 ★</span>';
        AudioSys.playUiTone('alert');
        finishMatch(true, 'Mahkota Terakhir');
      }
      return;
    }

    if (phase === 'SPECTATE' || phase === 'RESULT') {
      advanceZone(dt);
      Throwables.update(dt);
      AI.update(dt, elapsed, Player.playerTarget, Throwables.smokes, { blue: blueZone, white: whiteZone });
      Ballistics.step(dt, AI.bots, (tgt, dmg, zone, dist, hitPos, hitDir, owner) => {
        if (tgt?.isBot) AI.applyBotDamage(tgt, dmg, zone, dist, hitPos, hitDir, owner);
      });
      const aliveBots = AI.bots.filter(b => b.alive);
      const pill = ensureStatusPill();
      pill.classList.remove('hidden');
      pill.onclick = () => { if (!UI.hasModalOpen) openResultModal(); };
      if (phase === 'SPECTATE' && aliveBots.length > 0) {
        if (Input.wasCodePressed('KeyQ')) spectateIdx = (spectateIdx - 1 + aliveBots.length) % aliveBots.length;
        if (Input.wasCodePressed('KeyE')) spectateIdx = (spectateIdx + 1) % aliveBots.length;
        const tgt = aliveBots[spectateIdx % aliveBots.length];
        Render.setViewmodelEnabled(false);
        pill.innerHTML = `SPEKTATOR: <span style="color:#F2B705">${tgt.name}</span> (${Math.round(tgt.hp)} HP) • [Q/E Ganti] • [SPACE / KLIK: Ringkasan]`;
        tmpCamTarget.set(tgt.pos.x + Math.sin(elapsed * 0.4) * 5.2, tgt.pos.y + 2.6, tgt.pos.z + Math.cos(elapsed * 0.4) * 5.2);
        Render.camera.position.lerp(tmpCamTarget, Math.min(1, dt * 6));
        Render.camera.lookAt(tgt.pos.x, tgt.pos.y + 1.35, tgt.pos.z);
      } else {
        pill.innerHTML = `${lastSummary?.win ? '<span style="color:#F2B705">★ JUARA #1 ★</span>' : 'PERTANDINGAN SELESAI'} • [KLIK / TEKAN SPACE: Ringkasan & Main Lagi]`;
      }
      if (!UI.hasModalOpen && lastSummary && (Input.wasCodePressed('Space') || Input.wasCodePressed('Enter') || (!(typeof CheatUI !== 'undefined' && CheatUI.isOpen) && Input.pollGamepad()?.startJust))) {
        openResultModal();
      }
    }
  }

  function getPlaneInfo() {
    if (phase !== 'PLANE') return null;
    return { x: planePos.x, z: planePos.z, yaw: planeYaw, startX: planeStart.x, startZ: planeStart.z, endX: planeEnd.x, endZ: planeEnd.z };
  }

  return {
    startMatch, enterPlane, ejectFromPlane, openParachute, update,
    clearAll() {
      phase = 'IDLE';
      clearVisuals(Render.scene);
      if (typeof VehiclesSys !== 'undefined') VehiclesSys.clearAll();
      if (typeof ChidoriSys !== 'undefined') ChidoriSys.clearAll();
      if (typeof CheatUI !== 'undefined') CheatUI.close();
    },
    get phase() { return phase; },
    get zones() { return { blue: blueZone, white: whiteZone }; },
    get redZone() { return redZone; },
    get airdropPos() { return airdrop ? { x: airdrop.x, z: airdrop.z } : null; },
    get planeInfo() { return getPlaneInfo(); }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// GAME — Main Lifecycle & Loop
// ════════════════════════════════════════════════════════════════════════════
const Game = (() => {
  let state = 'BOOT';
  let lastTime = performance.now();
  let accumulator = 0;
  let elapsed = 0;
  let orbitAngle = 0.4;
  let camMode = 'island'; // 'island' | 'studio'
  let camTargetOverride = null;
  let paused = false;

  async function boot() {
    Debug.init();
    const canvas = document.getElementById('gl-canvas');
    if (!Render.init(canvas)) return;

    Input.init(canvas, {
      onLockLost: () => {
        // Keep simulation running when pointer lock drops; banner prompts user to click to re-lock
      }
    });

    UI.init({
      onStartMatch: async (cfg) => {
        await startMatchFlow(cfg);
      },
      onCameraPreset: (mode) => {
        setCameraMode(mode);
      },
      onCloseModal: () => {
        paused = false;
      }
    });

    Render.applySettings(UI.settings);
    AudioSys.applySettings(UI.settings);

    document.getElementById('screen-menu').classList.add('hidden');
    UI.showLoading('Mensintesis library tekstur PBR procedural...', 4);
    await Util.nextFrame();

    const preset = CONFIG.quality[UI.settings.preset] || CONFIG.quality.medium;
    Assets.buildAll(preset, (name, idx, total) => {
      UI.showLoading(`Membuat material PBR: ${name} (${idx}/${total})...`, 4 + (idx / total) * 26);
    });

    await World.buildWorld(Render.scene, CONFIG.seedDefault, Render.csm, (stage, pct) => {
      UI.showLoading(stage, pct);
    });

    Ballistics.initFX(Render.scene, preset);
    Render.buildStudioShowcase();
    UI.showLoading('Siap bertugas di Pulau Rajawali!', 100);
    await Util.nextFrame();
    UI.hideLoading();

    state = 'MAIN_MENU';
    document.getElementById('screen-menu').classList.remove('hidden');

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (typeof CheatUI !== 'undefined' && CheatUI.isOpen) { CheatUI.close(); }
        else if (MapUI.isOpen) { MapUI.closeBigMap(); }
        else if (UI.hasModalOpen) { UI.closeModal(); paused = false; }
        else if (state === 'PRACTICE' || state === 'MATCH') triggerPause();
      } else if (e.code === (UI.settings.keybinds?.inventory || 'Tab')) {
        if (state === 'PRACTICE' || state === 'MATCH') {
          e.preventDefault();
          if (MapUI.isOpen) MapUI.closeBigMap();
          if (UI.hasModalOpen) UI.closeModal();
          else UI.showInventoryModal();
        }
      } else if (e.code === (UI.settings.keybinds?.map || 'KeyM')) {
        if (state === 'PRACTICE' || state === 'MATCH') {
          e.preventDefault();
          if (UI.hasModalOpen) UI.closeModal();
          MapUI.toggleBigMap();
        }
      } else if (e.code === 'KeyN') {
        if (state === 'PRACTICE' || state === 'MATCH') MapUI.cycleZoom();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) lastTime = performance.now();
    });

    const params = new URLSearchParams(location.search);
    if (params.has('test')) {
      window.__RAJAWALI_TEST__ = Debug.runSelfTest();
      Debug.log('selfTest', window.__RAJAWALI_TEST__);
    }
    if (params.get('view') === 'studio') setCameraMode('studio');

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function triggerPause() {
    paused = true;
    UI.showPauseModal(
      () => { paused = false; },
      () => { exitToMenu(); }
    );
  }

  function exitToMenu() {
    paused = false;
    state = 'MAIN_MENU';
    MatchSys.clearAll();
    Throwables.clearAll();
    if (typeof VehiclesSys !== 'undefined') VehiclesSys.clearAll();
    if (typeof ChidoriSys !== 'undefined') ChidoriSys.clearAll();
    if (typeof CheatUI !== 'undefined') CheatUI.close();
    AI.bots.length = 0;
    Input.setGameplayActive(false);
    Render.setViewmodelEnabled(false);
    document.getElementById('hud-layer').classList.add('hidden');
    document.getElementById('scope-overlay').classList.add('hidden');
    document.getElementById('screen-menu').classList.remove('hidden');
  }

  function setCameraMode(mode) {
    camMode = mode;
    camTargetOverride = null;
    Render.setStudioVisible(mode === 'studio');
  }

  function teleportCam(x, z) {
    if (state === 'PRACTICE' || state === 'MATCH') {
      Player.spawnAt(x, z, 0);
      return;
    }
    camMode = 'poi';
    const h = World.getHeight(x, z);
    camTargetOverride = { x, y: h + 18, z: z + 38, lx: x, ly: h + 4, lz: z };
  }

  async function startMatchFlow(cfg) {
    state = 'GENERATING_WORLD';
    document.getElementById('screen-menu').classList.add('hidden');
    Render.setStudioVisible(false);
    UI.showLoading('Menyiapkan atmosfer dan dunia pertandingan...', 15);
    await Util.nextFrame();

    Render.applyAtmosphere(cfg.tod, cfg.weather);
    AudioSys.updateAmbient(CONFIG.weather[cfg.weather].wind, CONFIG.weather[cfg.weather].rain);
    if (cfg.seed !== World.seed) {
      await World.buildWorld(Render.scene, cfg.seed, Render.csm, (stage, pct) => {
        UI.showLoading(stage, pct);
      });
    } else {
      UI.showLoading('Membangun Lapangan Tembak Sukamaju & Senjata...', 82);
      await Util.nextFrame();
    }

    Throwables.initScene(Render.scene);
    Player.buildRangeAndTargets(Render.scene);
    paused = false;

    UI.hideLoading();
    const isCity = cfg.mapArea === 'city';
    if (cfg.mode === 'br') {
      state = 'MATCH';
      MatchSys.startMatch(cfg);
      return;
    }

    MatchSys.clearAll();
    AI.bots.length = 0;
    AI.resetPlayerStats?.();
    const kl = document.getElementById('hud-kills');
    if (kl) kl.textContent = '0';
    const kf = document.getElementById('hud-kill-feed');
    if (kf) kf.innerHTML = '';
    Player.setPerspectiveMode(cfg.perspective || 'free');
    Player.initLoadoutForMode('practice');
    if (isCity) {
      Player.spawnAt(155.5, 118.5, 0.08, 0.04); // Urban Piccadilly Plaza view
      AI.spawnPracticeSkirmish(Render.scene, 4);
    } else {
      Player.spawnAt(-110, 315, 0, 0); // Looking straight toward 25..300m targets (-Z)
    }
    state = 'PRACTICE';
    Input.setGameplayActive(true);
    document.getElementById('hud-layer').classList.remove('hidden');
    document.getElementById('hud-poi-name').textContent = isCity ? 'Kota Piccadilly (Perkotaan)' : 'Arena Latihan Sukamaju';
    document.getElementById('hud-alive').textContent = isCity ? '5' : '1';
    const phEl = document.getElementById('hud-zone-phase');
    const ztEl = document.getElementById('hud-zone-timer');
    const zsEl = document.getElementById('hud-zone-dist');
    if (phEl) phEl.textContent = 'LATIHAN';
    if (ztEl) ztEl.textContent = '--:--';
    if (zsEl) zsEl.textContent = isCity ? 'Mode Kota' : 'Range';
    const hpEl = document.getElementById('hud-hit-popup');
    if (hpEl) { hpEl.style.opacity = '0'; hpEl.textContent = ''; }
    UI.showAlertBanner(
      isCity
        ? 'Kota Piccadilly: 4 Bot AI & Rak Senjata Urban siap! Tekan TAB untuk Senjata / Bintang START untuk Cheat'
        : 'Klik layar untuk mengunci bidikan • Tekan TAB untuk kustomisasi 11 senjata & attachment',
      5.0
    );
  }

  function updateCamera(dt) {
    const cam = Render.camera;
    if (camMode === 'studio') {
      orbitAngle += dt * 0.35;
      cam.position.set(Math.sin(orbitAngle) * 14, 65.5, Math.cos(orbitAngle) * 14);
      cam.lookAt(0, 62.6, 0);
    } else if (camMode === 'city') {
      orbitAngle += dt * 0.14;
      const ch = World.getHeight(160, 90);
      const swayX = Math.sin(orbitAngle) * 1.4;
      cam.position.set(155.5 + swayX, ch + 2.35, 118.5);
      cam.lookAt(159.2, ch + 6.4, 86.0);
    } else if (camMode === 'poi' && camTargetOverride) {
      cam.position.set(camTargetOverride.x, camTargetOverride.y, camTargetOverride.z);
      cam.lookAt(camTargetOverride.lx, camTargetOverride.ly, camTargetOverride.lz);
    } else {
      orbitAngle += dt * 0.055;
      const rad = 320;
      const px = Math.cos(orbitAngle) * rad;
      const pz = Math.sin(orbitAngle) * rad;
      const groundH = Math.max(0, World.getHeight(px, pz));
      cam.position.set(px, groundH + 62, pz);
      cam.lookAt(-40, 24, 60);
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const frameDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    const cap = UI.settings.fpsCap || 0;
    if (cap > 0 && now - lastTime < (1000 / cap) * 0.92) return;
    lastTime = now;

    try {
      if (paused) {
        Input.consumeFrame();
        const gpP = Input.pollGamepad();
        if (gpP && (gpP.startJust || gpP.crouchJust)) {
          UI.closeModal();
          paused = false;
        }
        Input.endFrame();
        Debug.update(frameDt, state);
        return;
      }

      elapsed += frameDt;
      if (state === 'PRACTICE') {
        const inp = Input.consumeFrame();
        if (typeof CheatUI !== 'undefined') CheatUI.update(frameDt);
        Player.update(frameDt, elapsed, inp);
        Throwables.updatePlayerThrow(frameDt, inp);
        if (typeof ChidoriSys !== 'undefined') ChidoriSys.update(frameDt);
        AI.update(frameDt, elapsed, Player.playerTarget, Throwables.smokes, null);
        Input.endFrame();
      } else if (state === 'MATCH') {
        const inp = Input.consumeFrame();
        if (typeof CheatUI !== 'undefined') CheatUI.update(frameDt);
        MatchSys.update(frameDt, elapsed, inp);
        if (typeof ChidoriSys !== 'undefined') ChidoriSys.update(frameDt);
        Input.endFrame();
      } else {
        accumulator += frameDt;
        let steps = 0;
        while (accumulator >= CONFIG.sim.fixedDt && steps < CONFIG.sim.maxSubsteps) {
          updateCamera(CONFIG.sim.fixedDt);
          accumulator -= CONFIG.sim.fixedDt;
          steps++;
        }
      }
      World.update(elapsed, Render.camera, CONFIG.weather[Render.weather], frameDt, Player.pos);
      Render.renderFrame(elapsed, frameDt);
    } catch (err) {
      console.error('[RAJAWALI LOOP ERROR]', err);
    }
    Debug.update(frameDt, state);
  }

  return {
    boot, exitToMenu, startMatchFlow,
    toggleStudioCamera() { setCameraMode(camMode === 'studio' ? 'island' : 'studio'); },
    teleportCam,
    get state() { return state; },
    get paused() { return paused; }
  };
})();

// Expose minimal test handle for Playwright automated verification
window.__RAJAWALI__ = { Game, World, WorldBuildings, WorldFlora, NavGrid, Loot, MapUI, CharacterRig, VerletRagdoll, AI, Throwables, MatchSys, Assets, Render, UI, AudioSys, Debug, CONFIG, Player, WEAPONS_DB, ATTACHMENTS_DB, Ballistics, Physics, Input, ChidoriSys, VehiclesSys, CheatUI };
Game.boot();
