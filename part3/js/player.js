// ════════════════════════════════════════════════════════════════════════════
// PRACTICE RANGE & PLAYER CONTROLLER (M3 Capsule, M4 Viewmodel, M5 Combat)
// ════════════════════════════════════════════════════════════════════════════
const Player = (() => {
  const pos = new THREE.Vector3(-110, 14, 315);
  const vel = new THREE.Vector3();
  let yaw = Math.PI, pitch = 0;
  let hp = 100, boost = 0, stance = 'stand';
  let curEyeH = 1.65, leanFactor = 0, freeLookYaw = 0, freeLookPitch = 0;
  let isTpp = false, tppShoulder = 1, perspectiveMode = 'free';
  let unlimitedAmmo = true, godMode = false;
  let padBHold = 0, padBProneUsed = false;
  let grounded = true, sprintSec = 0, stepDist = 0, fallStartY = 0;
  let flashlightOn = false, spotLight = null;
  let vmRoot = null, vmHands = null, vmWeaponHolder = null, vmFlashMesh = null;
  let vmBuildKey = '';
  let fireCd = 0, burstLeft = 0, reloadTimer = 0, reloadTargetDur = 0, boltTimer = 0, inspectTimer = 0, meleeTimer = 0;
  let recoilIdx = 0, recoilKickPitch = 0, recoilKickYaw = 0, recoilTimeSinceShot = 1;
  let adsLerp = 0, zeroDist = 100, scopeMagOverride = null;
  let activeSlot = 0; // 0:primary, 1:secondary, 2:pistol, 3:pan
  let helm = { level: 2, dur: 150 }, vest = { level: 2, dur: 220 }, bag = { level: 2, cap: 330 };
  let hitmarkerTimer = 0, dmgIndicatorTimer = 0;
  let alive = true, hudTickAcc = 0, killsStat = 0, dmgStat = 0;
  let activeZonesRef = null, playerRig = null, forceRigVisible = false;
  const combatTargetsBuf = [];
  const playerTarget = {
    isPlayer: true, name: 'Anda', pos, vel,
    get alive() { return alive; },
    rayHitTest(ro, rd, maxT) {
      if (!alive) return null;
      const eyeOff = stance === 'prone' ? 0.35 : stance === 'crouch' ? 1.1 : 1.62;
      const hy = pos.y + eyeOff + 0.08;
      const toHx = ro.x - pos.x, toHy = ro.y - hy, toHz = ro.z - pos.z;
      const bH = toHx * rd.x + toHy * rd.y + toHz * rd.z;
      const cH = toHx * toHx + toHy * toHy + toHz * toHz - 0.17 * 0.17;
      const dH = bH * bH - cH;
      if (dH >= 0) { const tH = -bH - Math.sqrt(dH); if (tH > 0 && tH < maxT) return { t: tH, zone: 'head' }; }
      const a = rd.x * rd.x + rd.z * rd.z;
      if (a > 1e-6) {
        const toCx = ro.x - pos.x, toCz = ro.z - pos.z;
        const b = 2 * (toCx * rd.x + toCz * rd.z);
        const c = toCx * toCx + toCz * toCz - 0.28 * 0.28;
        const d = b * b - 4 * a * c;
        if (d >= 0) {
          const t = (-b - Math.sqrt(d)) / (2 * a);
          if (t > 0 && t < maxT) {
            const hitY = ro.y + rd.y * t - pos.y;
            const maxH = stance === 'prone' ? 0.52 : stance === 'crouch' ? 1.25 : 1.6;
            if (hitY >= 0.04 && hitY <= maxH) {
              if (slots[3].id === 'pan' && hitY >= 0.72 && hitY <= 1.25) {
                const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
                if (rd.x * fwdX + rd.z * fwdZ > 0.45) return { t, zone: 'pan' };
              }
              return { t, zone: hitY > maxH * 0.62 ? 'chest' : hitY > maxH * 0.44 ? 'abdomen' : 'leg' };
            }
          }
        }
      }
      return null;
    }
  };

  const ammoReserve = { '556': 180, '762': 150, '45': 120, '9mm': 90, '12ga': 40, 'none': 0 };
  const meds = { medkit: 1, firstaid: 2, bandage: 5, drink: 2, painkiller: 1, adrenaline: 1 };
  const throwables = { frag: 2, smoke: 1, flashbang: 1 };
  const looseAtts = [];
  let castState = { active: false, key: '', label: '', timer: 0, total: 0 };

  const slots = [
    { id: 'm416', mag: 30, mode: 'auto', att: { optic: 'reddot', muzzle: 'comp', grip: 'vertgrip', mag: 'extmag', stock: 'tacstock' } },
    { id: 'kar98k', mag: 5, mode: 'single', att: { optic: 'scope4x', muzzle: 'suppressor', stock: 'cheekpad' } },
    { id: 'p92', mag: 15, mode: 'single', att: { optic: null, muzzle: 'suppressor', mag: null } },
    { id: 'pan', mag: 0, mode: 'melee', att: {} }
  ];

  // Range Targets & Bench Props (populated in Practice / Sukamaju Outpost)
  const targets = [];
  let rangeGroup = null;
  let interactPromptTarget = null;
  const rackPickups = [];

  function buildRangeAndTargets(scene) {
    if (rangeGroup) scene.remove(rangeGroup);
    targets.length = 0;
    rackPickups.length = 0;
    Physics.clearTag('range');
    rangeGroup = new THREE.Group();
    rangeGroup.name = 'SukamajuShootingRange';

    const cx = -110, cz = 280;
    const baseH = World.getHeight(cx, cz);

    // Concrete firing platform & shelter roof
    const pad = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 8), Assets.get('concrete'));
    pad.position.set(cx, baseH + 0.15, cz + 35);
    pad.receiveShadow = true;
    rangeGroup.add(pad);
    Physics.addCollider({ minX: cx - 14, maxX: cx + 14, minY: baseH - 1, maxY: baseH + 0.35, minZ: cz + 31, maxZ: cz + 39, mat: 'concrete', tag: 'range' });

    // Low concrete cover wall (vaultable height 1.05m for M3 Vault test!)
    const vaultWall = new THREE.Mesh(new THREE.BoxGeometry(8, 1.05, 0.5), Assets.get('brick'));
    vaultWall.position.set(cx - 5, baseH + 0.72, cz + 29);
    vaultWall.castShadow = true; vaultWall.receiveShadow = true;
    rangeGroup.add(vaultWall);
    Physics.addCollider({ minX: cx - 9, maxX: cx - 1, minY: baseH, maxY: baseH + 1.25, minZ: cz + 28.75, maxZ: cz + 29.25, mat: 'concrete', tag: 'range', isVaultWall: true });

    // Penetrable Wood Barrier & Metal Ricochet Plate at 25m
    const woodWall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.14), Assets.get('wood'));
    woodWall.position.set(cx + 6, baseH + 1.3, cz + 10);
    woodWall.castShadow = true; woodWall.receiveShadow = true;
    rangeGroup.add(woodWall);
    Physics.addCollider({ minX: cx + 4, maxX: cx + 8, minY: baseH, maxY: baseH + 2.4, minZ: cz + 9.9, maxZ: cz + 10.1, mat: 'wood', penetrable: true, tag: 'range' });

    const steelPlate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.12), Assets.get('gunmetal'));
    steelPlate.position.set(cx - 8, baseH + 1.3, cz + 10);
    steelPlate.castShadow = true;
    rangeGroup.add(steelPlate);
    Physics.addCollider({ minX: cx - 9.6, maxX: cx - 6.4, minY: baseH, maxY: baseH + 2.4, minZ: cz + 9.9, maxZ: cz + 10.1, mat: 'metal', tag: 'range' });

    // Arsenal Weapon Rack along Firing Line (All 11 Weapons + Attachments)
    const table = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 1.2), Assets.get('wood'));
    table.position.set(cx + 4, baseH + 0.65, cz + 37.5);
    table.castShadow = true; table.receiveShadow = true;
    rangeGroup.add(table);
    Physics.addCollider({ minX: cx - 4, maxX: cx + 12, minY: baseH, maxY: baseH + 1.1, minZ: cz + 36.9, maxZ: cz + 38.1, mat: 'wood', tag: 'range' });

    const wKeys = Object.keys(WEAPONS_DB);
    wKeys.forEach((wk, i) => {
      const rx = (cx - 3.2) + i * 1.4;
      const rz = cz + 37.5;
      const built = ModelBuilders.buildWeaponModel(wk, {});
      built.root.position.set(rx, baseH + 1.25, rz);
      built.root.rotation.y = Math.PI * 0.5;
      built.root.scale.setScalar(1.3);
      rangeGroup.add(built.root);
      rackPickups.push({ x: rx, y: baseH + 1.25, z: rz, weaponId: wk, label: `F — Ambil ${WEAPONS_DB[wk].name}` });
    });

    // Shooting Lanes Silhouette Targets at 25m, 50m, 100m, 200m, 300m
    const distances = [
      { d: 25, ox: -4, moving: false, label: '25m' },
      { d: 50, ox: 2,  moving: true,  label: '50m (Gerak)' },
      { d: 100, ox: -6, moving: false, label: '100m' },
      { d: 200, ox: 4, moving: false, label: '200m' },
      { d: 300, ox: 0, moving: false, label: '300m' }
    ];
    distances.forEach((cfg) => {
      const tx = cx + cfg.ox;
      const tz = cz + 35 - cfg.d;
      const th = World.getHeight(tx, tz);
      const tGrp = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.8, 0.14), Assets.get('wood'));
      post.position.y = 0.9;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.12), Assets.get('cloth'));
      torso.position.y = 1.25;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), Assets.get('rust'));
      head.position.y = 1.78;
      tGrp.add(post, torso, head);
      tGrp.position.set(tx, th, tz);
      tGrp.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      rangeGroup.add(tGrp);

      targets.push({
        alive: true, hp: 100, maxHp: 100, name: `Dummy ${cfg.label}`,
        baseX: tx, pos: new THREE.Vector3(tx, th, tz), moving: cfg.moving,
        mesh: tGrp, respawnTimer: 0, helm: { level: 1, dur: 80 }, vest: { level: 1, dur: 200 },
        rayHitTest(ro, rd, maxT) {
          // Head sphere check
          const hy = this.pos.y + 1.78;
          const toHx = ro.x - this.pos.x, toHy = ro.y - hy, toHz = ro.z - this.pos.z;
          const bH = toHx * rd.x + toHy * rd.y + toHz * rd.z;
          const cH = toHx * toHx + toHy * toHy + toHz * toHz - 0.18 * 0.18;
          const discH = bH * bH - cH;
          if (discH >= 0) {
            const tH = -bH - Math.sqrt(discH);
            if (tH > 0 && tH < maxT) return { t: tH, zone: 'head' };
          }
          // Torso / Legs cylinder proxy check
          const toCx = ro.x - this.pos.x, toCz = ro.z - this.pos.z;
          const a = rd.x * rd.x + rd.z * rd.z;
          if (a > 1e-6) {
            const b = 2 * (toCx * rd.x + toCz * rd.z);
            const c = toCx * toCx + toCz * toCz - 0.30 * 0.30;
            const d = b * b - 4 * a * c;
            if (d >= 0) {
              const t = (-b - Math.sqrt(d)) / (2 * a);
              if (t > 0 && t < maxT) {
                const hitY = ro.y + rd.y * t - this.pos.y;
                if (hitY >= 0.05 && hitY <= 1.65) {
                  return { t, zone: hitY > 1.05 ? 'chest' : hitY > 0.75 ? 'abdomen' : 'leg' };
                }
              }
            }
          }
          return null;
        }
      });
    });

    scene.add(rangeGroup);
  }

  function spawnAt(x, z, yawRad = Math.PI) {
    if (typeof VehiclesSys !== 'undefined') VehiclesSys.dismount(true);
    if (typeof ChidoriSys !== 'undefined') ChidoriSys.clearAll();
    const h = World.getHeight(x, z);
    pos.set(x, h + 0.05, z);
    vel.set(0, 0, 0);
    yaw = yawRad; pitch = 0; hp = 100; boost = 0; alive = true;
    stance = 'stand'; curEyeH = CONFIG.player.eye.stand;
    isTpp = perspectiveMode === 'tpp' ? true : perspectiveMode === 'fpp' ? false : !!UI.settings.defaultTpp;
    initViewmodel();
  }

  function setPerspectiveMode(mode) {
    perspectiveMode = mode === 'tpp' || mode === 'fpp' ? mode : 'free';
    isTpp = perspectiveMode === 'tpp' ? true : perspectiveMode === 'fpp' ? false : !!UI.settings.defaultTpp;
  }

  function initViewmodel() {
    if (!Render.vmScene) return;
    if (!vmRoot) {
      vmRoot = new THREE.Group();
      vmHands = ModelBuilders.buildViewmodelHands();
      vmWeaponHolder = new THREE.Group();
      vmFlashMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06, 0),
        new THREE.MeshBasicMaterial({ color: 0xFFCC55, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
      );
      vmFlashMesh.visible = false;
      vmWeaponHolder.add(vmFlashMesh);
    // Flip Procedural Arms so fingers reach forward (-Z) alongside rotated weapon (-Z)
    if (vmHands) {
      vmHands.rotation.y = Math.PI;
      vmRoot.add(vmHands, vmWeaponHolder);
    }
      Render.vmScene.add(vmRoot);
    }
    rebuildActiveWeaponMesh();
  }

  function rebuildActiveWeaponMesh() {
    if (!vmWeaponHolder) return;
    const sl = slots[activeSlot];
    const key = `${sl.id}:${JSON.stringify(sl.att)}`;
    if (key === vmBuildKey) return;
    vmBuildKey = key;
    while (vmWeaponHolder.children.length > 1) vmWeaponHolder.remove(vmWeaponHolder.children[1]);
    const built = ModelBuilders.buildWeaponModel(sl.id, sl.att);
    // Weapon geometry models are authored along +Z; rotate PI around Y so muzzle faces downrange (-Z)
    built.root.rotation.y = Math.PI;
    vmWeaponHolder.add(built.root);
    vmWeaponHolder.userData.sightY = built.sightY;
    const def = WEAPONS_DB[sl.id];
    const muz = def.sockets.muzzle || [0, 0.03, 0.4];
    vmFlashMesh.position.set(-muz[0], muz[1], -(muz[2] + 0.03));
    updateScopeReticleUI();
  }

  function getActiveWeapon() { return slots[activeSlot]; }
  function getMaxMag(slotObj) {
    const def = WEAPONS_DB[slotObj.id];
    const magAtt = slotObj.att.mag ? ATTACHMENTS_DB[slotObj.att.mag] : null;
    return magAtt?.extended ? def.magExt : def.mag;
  }

  function equipWeaponInSlot(weaponId, slotIdx = activeSlot) {
    const def = WEAPONS_DB[weaponId];
    if (!def) return;
    const targetSlot = def.class === 'Pistol' ? 2 : def.class === 'Melee' ? 3 : (slotIdx > 1 ? 0 : slotIdx);
    slots[targetSlot] = { id: weaponId, mag: def.mag, mode: def.modes[0], att: { ...slots[targetSlot].att } };
    activeSlot = targetSlot;
    reloadTimer = 0; boltTimer = 0; recoilIdx = 0;
    vmBuildKey = '';
    rebuildActiveWeaponMesh();
    AudioSys.playMechanical('reload_mag');
  }

  function setAttachment(slotType, attId) {
    const sl = slots[activeSlot];
    const def = WEAPONS_DB[sl.id];
    if (!def.slots[slotType]) return;
    sl.att[slotType] = attId || null;
    vmBuildKey = '';
    rebuildActiveWeaponMesh();
    AudioSys.playMechanical('reload_mag');
  }

  function getBagWeight() {
    let w = 0;
    w += (ammoReserve['556'] || 0) * 0.45 / 30 * 1.2 + (ammoReserve['762'] || 0) * 0.55 / 30 * 1.4;
    w += ((ammoReserve['9mm'] || 0) + (ammoReserve['45'] || 0)) * 0.4 / 30 * 1.1 + (ammoReserve['12ga'] || 0) * 0.7 / 10 * 1.5;
    w += meds.medkit * 20 + meds.firstaid * 10 + meds.bandage * 2 + meds.drink * 4 + meds.painkiller * 10 + meds.adrenaline * 20;
    w += throwables.frag * 12 + throwables.smoke * 10 + throwables.flashbang * 8;
    w += looseAtts.length * 4;
    return Math.round(w * 10) / 10;
  }

  function initLoadoutForMode(mode) {
    castState.active = false;
    if (mode === 'practice') {
      helm = { level: 2, dur: 150 }; vest = { level: 2, dur: 220 }; bag = { level: 2, cap: 330 };
      Object.assign(ammoReserve, { '556': 180, '762': 150, '45': 120, '9mm': 90, '12ga': 40, 'none': 0 });
      Object.assign(meds, { medkit: 1, firstaid: 2, bandage: 5, drink: 2, painkiller: 1, adrenaline: 1 });
      Object.assign(throwables, { frag: 2, smoke: 1, flashbang: 1 });
      looseAtts.length = 0;
      slots[0] = { id: 'm416', mag: 30, mode: 'auto', att: { optic: 'reddot', muzzle: 'comp', grip: 'vertgrip', mag: 'extmag', stock: 'tacstock' } };
      slots[1] = { id: 'kar98k', mag: 5, mode: 'single', att: { optic: 'scope4x', muzzle: 'suppressor', stock: 'cheekpad' } };
      slots[2] = { id: 'p92', mag: 15, mode: 'single', att: { optic: null, muzzle: 'suppressor', mag: null } };
      slots[3] = { id: 'pan', mag: 0, mode: 'melee', att: {} };
      activeSlot = 0;
    } else {
      helm = { level: 0, dur: 0 }; vest = { level: 0, dur: 0 }; bag = { level: 0, cap: 80 };
      Object.assign(ammoReserve, { '556': 0, '762': 0, '45': 0, '9mm': 0, '12ga': 0, 'none': 0 });
      Object.assign(meds, { medkit: 0, firstaid: 0, bandage: 0, drink: 0, painkiller: 0, adrenaline: 0 });
      Object.assign(throwables, { frag: 0, smoke: 0, flashbang: 0 });
      looseAtts.length = 0;
      slots[0] = { id: 'pan', mag: 0, mode: 'melee', att: {} };
      slots[1] = { id: 'pan', mag: 0, mode: 'melee', att: {} };
      slots[2] = { id: 'p92', mag: 0, mode: 'single', att: {} };
      slots[3] = { id: 'pan', mag: 0, mode: 'melee', att: {} };
      activeSlot = 3;
    }
    vmBuildKey = '';
    rebuildActiveWeaponMesh();
  }

  const CONSUMABLE_SPECS = {
    medkit:     { label: 'Menggunakan Medkit...',       dur: 8.0, needHeal: true },
    firstaid:   { label: 'Menggunakan Kotak P3K...',    dur: 6.0, needHeal: true, maxHp: 75 },
    bandage:    { label: 'Memasang Perban...',          dur: 4.0, needHeal: true, maxHp: 75 },
    drink:      { label: 'Meminum Minuman Energi...',   dur: 4.0 },
    painkiller: { label: 'Menelan Pereda Nyeri...',     dur: 6.0 },
    adrenaline: { label: 'Menyuntikkan Adrenalin...',   dur: 8.0 }
  };

  function useConsumable(medKey) {
    if (!alive || castState.active) return false;
    const key = medKey === 'boost'
      ? (meds.adrenaline > 0 ? 'adrenaline' : meds.painkiller > 0 ? 'painkiller' : meds.drink > 0 ? 'drink' : '')
      : medKey;
    if (!key || !meds[key] || meds[key] <= 0) return false;
    const spec = CONSUMABLE_SPECS[key];
    if (!spec) return false;
    if (spec.needHeal && hp >= (spec.maxHp || 100) - 0.1) return false;
    castState = { active: true, key, label: spec.label, timer: spec.dur, total: spec.dur };
    AudioSys.playUiTone('click');
    return true;
  }

  function cancelCast() {
    if (!castState.active) return;
    castState.active = false;
    document.getElementById('hud-cast-bar')?.classList.add('hidden');
  }

  function applyCastCompletion(key) {
    if (!meds[key] || meds[key] <= 0) return;
    meds[key]--;
    if (key === 'medkit') hp = 100;
    else if (key === 'firstaid') hp = Math.max(hp, 75);
    else if (key === 'bandage') hp = Math.min(75, hp + 10);
    else if (key === 'drink') boost = Math.min(100, boost + 40);
    else if (key === 'painkiller') boost = Math.min(100, boost + 60);
    else if (key === 'adrenaline') boost = 100;
    AudioSys.playUiTone('alert');
  }

  function pickupItem(it, fromCrate = null) {
    if (!it || it.taken) return false;
    const d = it.def || Loot.ITEMS[it.itemId];
    if (!d) return false;
    if (d.cat === 'weapon') {
      if (it.itemId === 'pan') {
        slots[3] = { id: 'pan', mag: 0, mode: 'melee', att: {} };
      } else if (it.itemId === 'p92') {
        slots[2] = { id: 'p92', mag: WEAPONS_DB.p92.mag, mode: 'single', att: {} };
        activeSlot = 2;
      } else {
        const dst = activeSlot <= 1 ? activeSlot : (slots[0].id === 'pan' ? 0 : slots[1].id === 'pan' ? 1 : 0);
        const prev = slots[dst];
        if (prev.id && prev.id !== 'pan') {
          Loot.spawnItemAt(prev.id, pos.x + 0.4, pos.y, pos.z + 0.4, 1);
        }
        const defW = WEAPONS_DB[it.itemId];
        slots[dst] = { id: it.itemId, mag: defW.mag, mode: defW.modes[0], att: {} };
        activeSlot = dst;
      }
      vmBuildKey = ''; rebuildActiveWeaponMesh();
    } else if (d.cat === 'helm') {
      if (d.level > helm.level || (d.level === helm.level && helm.dur < d.dur)) helm = { level: d.level, dur: d.dur };
      else return false;
    } else if (d.cat === 'vest') {
      if (d.level > vest.level || (d.level === vest.level && vest.dur < d.dur)) vest = { level: d.level, dur: d.dur };
      else return false;
    } else if (d.cat === 'bag') {
      if (d.level > bag.level) bag = { level: d.level, cap: 80 + d.cap };
      else return false;
    } else if (d.cat === 'ammo') {
      const ak = d.ammoKey === '45acp' ? '45' : d.ammoKey;
      const amt = (d.qty || 30) * (it.qty || 1);
      if (getBagWeight() + 8 > bag.cap) return false;
      ammoReserve[ak] = (ammoReserve[ak] || 0) + amt;
    } else if (d.cat === 'med') {
      if (getBagWeight() + d.wt > bag.cap) return false;
      meds[d.medKey] = (meds[d.medKey] || 0) + (it.qty || 1);
    } else if (d.cat === 'throw') {
      if (getBagWeight() + d.wt > bag.cap) return false;
      throwables[d.throwKey] = (throwables[d.throwKey] || 0) + (it.qty || 1);
    } else if (d.cat === 'att') {
      const sl = slots[activeSlot];
      const defW = WEAPONS_DB[sl.id];
      const aDef = ATTACHMENTS_DB[d.attId];
      if (defW?.slots?.[aDef.slot] && !sl.att[aDef.slot]) {
        sl.att[aDef.slot] = d.attId;
        vmBuildKey = ''; rebuildActiveWeaponMesh();
      } else {
        if (getBagWeight() + d.wt > bag.cap) return false;
        looseAtts.push(d.attId);
      }
    }

    if (fromCrate) {
      const idx = fromCrate.items.indexOf(it);
      if (idx >= 0) fromCrate.items.splice(idx, 1);
    } else {
      it.taken = true;
      Loot.markDirty();
    }
    AudioSys.playMechanical('reload_mag');
    return true;
  }

  function dropItem(cat, key, amt = 1) {
    if (cat === 'ammo' && ammoReserve[key] > 0) {
      const take = Math.min(ammoReserve[key], amt);
      ammoReserve[key] -= take;
      const mapId = { '556': 'ammo556', '762': 'ammo762', '9mm': 'ammo9mm', '45': 'ammo45', '12ga': 'ammo12' }[key];
      if (mapId) Loot.spawnItemAt(mapId, pos.x + 0.5, pos.y, pos.z + 0.5, 1);
    } else if (cat === 'med' && meds[key] > 0) {
      meds[key]--;
      Loot.spawnItemAt(key, pos.x + 0.4, pos.y, pos.z + 0.4, 1);
    } else if (cat === 'throw' && throwables[key] > 0) {
      throwables[key]--;
      Loot.spawnItemAt(key, pos.x + 0.4, pos.y, pos.z + 0.4, 1);
    } else if (cat === 'att') {
      const idx = looseAtts.indexOf(key);
      if (idx >= 0) { looseAtts.splice(idx, 1); Loot.spawnItemAt(key, pos.x + 0.4, pos.y, pos.z + 0.4, 1); }
    }
    Loot.markDirty();
  }

  function equipLooseAttachment(idx) {
    const attId = looseAtts[idx];
    const aDef = ATTACHMENTS_DB[attId];
    const sl = slots[activeSlot];
    const defW = WEAPONS_DB[sl.id];
    if (!aDef || !defW?.slots?.[aDef.slot]) return false;
    const old = sl.att[aDef.slot];
    sl.att[aDef.slot] = attId;
    looseAtts.splice(idx, 1);
    if (old) looseAtts.push(old);
    vmBuildKey = ''; rebuildActiveWeaponMesh();
    AudioSys.playMechanical('reload_mag');
    return true;
  }

  function detachAttachment(slotIdx, slotType) {
    const sl = slots[slotIdx];
    const attId = sl?.att?.[slotType];
    if (!attId) return false;
    sl.att[slotType] = null;
    looseAtts.push(attId);
    if (slotIdx === activeSlot) { vmBuildKey = ''; rebuildActiveWeaponMesh(); }
    AudioSys.playUiTone('click');
    return true;
  }

  function updateScopeReticleUI() {
    const ov = document.getElementById('scope-overlay');
    const sl = slots[activeSlot];
    const opt = sl.att.optic ? ATTACHMENTS_DB[sl.att.optic] : null;
    const isScoped = adsLerp > 0.72 && opt && opt.zoom >= 2.0 && !isTpp;
    ov.classList.toggle('hidden', !isScoped);
    document.getElementById('hud-crosshair').classList.toggle('hidden', isScoped);
    if (!isScoped) return;
    const mag = scopeMagOverride || opt.zoom;
    ov.innerHTML = `<svg viewBox="0 0 800 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <defs><radialGradient id="scRim"><stop offset="56%" stop-color="rgba(0,0,0,0)"/><stop offset="63%" stop-color="#050608"/><stop offset="100%" stop-color="#040507"/></radialGradient></defs>
      <rect width="800" height="800" fill="url(#scRim)"/>
      <circle cx="400" cy="400" r="245" fill="none" stroke="#111" stroke-width="5"/>
      <line x1="160" y1="400" x2="640" y2="400" stroke="#0C0E10" stroke-width="1.6"/>
      <line x1="400" y1="160" x2="400" y2="640" stroke="#0C0E10" stroke-width="1.6"/>
      ${[-40,-20,20,40,60,80].map(dy => `<line x1="393" y1="${400+dy}" x2="407" y2="${400+dy}" stroke="#0C0E10" stroke-width="1.6"/>`).join('')}
      <circle cx="400" cy="400" r="2.2" fill="#E5383B"/>
      <text x="530" y="392" fill="#F2B705" font-size="14" font-family="monospace">${mag.toFixed(1)}x | Z:${zeroDist}m</text>
    </svg>`;
  }

  function showHitFeedback(dmg, zone, dist, matHit = false) {
    if (UI.settings.hitMarkers) {
      const hm = document.getElementById('hitmarker-svg');
      const lines = hm.querySelectorAll('line');
      const col = zone === 'head' ? '#E5383B' : matHit ? '#5BA3E0' : '#FFFFFF';
      lines.forEach(l => l.setAttribute('stroke', col));
      hm.style.opacity = '1';
      hitmarkerTimer = 0.14;
    }
    const pop = document.getElementById('hud-hit-popup');
    pop.textContent = `${zone === 'head' ? 'HEADSHOT ' : ''}-${Math.round(dmg)} HP (${Math.round(dist)}m)`;
    pop.style.color = zone === 'head' ? '#E5383B' : '#F2B705';
    pop.style.opacity = '1';
    setTimeout(() => { if (hitmarkerTimer <= 0) pop.style.opacity = '0'; }, 900);
    AudioSys.playMechanical(zone === 'head' ? 'headshot' : 'hitmarker');
  }

  function triggerShot() {
    if (typeof Throwables !== 'undefined' && Throwables.inGrenadeMode) return;
    const sl = slots[activeSlot];
    const def = WEAPONS_DB[sl.id];
    if (def.class === 'Melee') {
      if (meleeTimer > 0) return;
      meleeTimer = 0.65;
      AudioSys.playGunshot('melee');
      const dir = new THREE.Vector3(); Render.camera.getWorldDirection(dir);
      for (let i = 0; i < targets.length; i++) {
        const res = targets[i].rayHitTest(Render.camera.position, dir, 2.3);
        if (res) { applyDamageToTarget(targets[i], def.damage, res.zone, res.t); AudioSys.playMechanical('pan'); break; }
      }
      return;
    }

    if (reloadTimer > 0 || boltTimer > 0) return;
    const maxMag = getMaxMag(sl);
    if (sl.mag <= 0) {
      if (unlimitedAmmo && maxMag > 0) {
        sl.mag = maxMag;
      } else {
        AudioSys.playMechanical('empty');
        fireCd = 0.25;
        return;
      }
    }

    sl.mag--;
    if (unlimitedAmmo && sl.mag <= 0 && maxMag > 0) sl.mag = maxMag;
    fireCd = 60 / def.rpm;
    if (def.boltAction) boltTimer = 60 / def.rpm;

    const muzAtt = sl.att.muzzle ? ATTACHMENTS_DB[sl.att.muzzle] : null;
    const gripAtt = sl.att.grip ? ATTACHMENTS_DB[sl.att.grip] : null;
    const stockAtt = sl.att.stock ? ATTACHMENTS_DB[sl.att.stock] : null;
    const recMult = (muzAtt?.recoilMult || 1) * (gripAtt?.pitchMult || 1) * (stockAtt?.pitchMult || 1) *
      (stance === 'prone' ? 0.55 : stance === 'crouch' ? 0.78 : 1.0) * (adsLerp > 0.5 ? 0.85 : 1.15);

    const pat = def.recoil.pattern[recoilIdx % def.recoil.pattern.length];
    recoilIdx++;
    recoilTimeSinceShot = 0;
    const kYaw = (pat[0] * (gripAtt?.yawMult || 1) + (Math.random() - 0.5) * 0.08) * recMult * 0.016;
    const kPitch = (pat[1] + (Math.random() - 0.5) * 0.05) * recMult * 0.018;
    yaw -= kYaw;
    pitch = Util.clamp(pitch + kPitch, -1.45, 1.45);
    recoilKickPitch += kPitch * 0.75;
    recoilKickYaw += kYaw * 0.5;

    // Bullet spawn from camera + zeroing pitch + ballistic spread
    const forward = new THREE.Vector3();
    Render.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const zeroAng = Ballistics.computeZeroPitch(def.muzzleVel, def.drag, zeroDist);
    const moveSpd = Math.hypot(vel.x, vel.z);
    let spDeg = Util.lerp(def.spread.base, def.spread.ads, adsLerp);
    if (!grounded) spDeg *= (def.spread.jump / Math.max(0.1, def.spread.base));
    else if (moveSpd > 1.2) spDeg += (def.spread.move * 0.35) * (1 - adsLerp * 0.65);
    spDeg *= stance === 'prone' ? def.spread.prone : stance === 'crouch' ? def.spread.crouch : 1.0;
    if (muzAtt?.spreadMult) spDeg *= muzAtt.spreadMult;
    if (gripAtt?.hipSpreadMult && adsLerp < 0.3) spDeg *= gripAtt.hipSpreadMult;

    const pellets = def.pellets || 1;
    const suppressed = !!muzAtt?.suppressed;
    const spawnPos = Render.camera.position.clone().addScaledVector(forward, 0.35);

    for (let p = 0; p < pellets; p++) {
      const angRad = THREE.MathUtils.degToRad(spDeg * (Math.random() + 0.15));
      const theta = Math.random() * Math.PI * 2;
      const bDir = forward.clone()
        .addScaledVector(up, zeroAng + Math.sin(theta) * angRad)
        .addScaledVector(right, Math.cos(theta) * angRad)
        .normalize();
      Ballistics.fireBullet(spawnPos, bDir, def, { owner: 'player', suppressed });
    }

    // Visual Muzzle Flash + PointLight + Brass Casing Eject
    if (!muzAtt?.hideFlash && !suppressed) {
      vmFlashMesh.visible = true;
      vmFlashMesh.rotation.z = Math.random() * Math.PI;
      setTimeout(() => { if (vmFlashMesh) vmFlashMesh.visible = false; }, 45);
      Render.spawnMuzzleLight(spawnPos);
    }
    const casingPos = Render.camera.position.clone().addScaledVector(forward, 0.45).addScaledVector(right, 0.12);
    const casingVel = right.clone().multiplyScalar(2.2 + Math.random()).addScaledVector(up, 1.4 + Math.random() * 0.6);
    Ballistics.spawnParticle(casingPos, casingVel, 0xD4AF37, 0.85, 0.85, 11);

    AudioSys.playGunshot(def.sound, null, suppressed, false, false);
  }

  function takeDamage(rawDmg, zone = 'chest', attackerPos = null, cause = 'Tembakan') {
    if (!alive) return;
    if ((typeof VehiclesSys !== 'undefined' && VehiclesSys.isDriving()) || godMode) {
      AudioSys.playImpact('metal', pos);
      for (let s = 0; s < 3; s++) {
        Ballistics.spawnParticle(
          new THREE.Vector3(pos.x, pos.y + 1.1, pos.z),
          new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6),
          0xFFCC44, 0.95, 0.22, 10
        );
      }
      return;
    }
    if (zone === 'pan') {
      AudioSys.playImpact('pan', pos);
      return;
    }
    let dmg = rawDmg;
    if ((zone === 'head' || zone === 'neck') && helm.level > 0 && helm.dur > 0) {
      const aSpec = CONFIG.armor.helm[helm.level - 1];
      const abs = dmg * aSpec.abs;
      helm.dur = Math.max(0, helm.dur - abs); dmg -= abs;
    } else if ((zone === 'chest' || zone === 'abdomen') && vest.level > 0 && vest.dur > 0) {
      const aSpec = CONFIG.armor.vest[vest.level - 1];
      const abs = dmg * aSpec.abs;
      vest.dur = Math.max(0, vest.dur - abs); dmg -= abs;
    }
    hp = Math.max(0, hp - dmg);
    if (dmg > 10 && castState.active) cancelCast();

    const dmgEl = document.getElementById('fx-overlay-damage');
    if (dmgEl) {
      dmgEl.style.opacity = '0.85';
      setTimeout(() => { if (dmgEl && hp > 20) dmgEl.style.opacity = '0'; }, 350);
    }
    if (attackerPos) {
      const ds = document.getElementById('damage-sectors');
      if (ds) {
        const ang = Math.atan2(-(attackerPos.x - pos.x), -(attackerPos.z - pos.z)) - yaw;
        const deg = THREE.MathUtils.radToDeg(-ang);
        ds.innerHTML = `<g transform="translate(130,130) rotate(${deg})"><path d="M-28,-110 A112,112 0 0,1 28,-110 L18,-92 A92,92 0 0,0 -18,-92 Z" fill="rgba(229,56,59,0.78)"/></g>`;
        dmgIndicatorTimer = 0.8;
      }
    }
    if (hp <= 0) {
      alive = false;
      Game.onPlayerEliminated?.(cause);
    }
  }

  function applyDamageToTarget(tgt, rawDmg, zone, dist, hitPos, hitDir, owner) {
    if (!tgt.alive) return;
    if (tgt.isBot) {
      AI.applyBotDamage(tgt, rawDmg, zone, dist, hitPos, hitDir, owner);
      return;
    }
    if (tgt.isPlayer) {
      takeDamage(rawDmg, zone, owner?.pos, owner?.name || 'Bot');
      return;
    }
    let dmg = rawDmg;
    // Apply armor mitigation L1-L3
    if ((zone === 'head' || zone === 'neck') && tgt.helm?.level > 0 && tgt.helm.dur > 0) {
      const aSpec = CONFIG.armor.helm[tgt.helm.level - 1];
      const abs = dmg * aSpec.abs;
      tgt.helm.dur = Math.max(0, tgt.helm.dur - abs);
      dmg -= abs;
    } else if ((zone === 'chest' || zone === 'abdomen') && tgt.vest?.level > 0 && tgt.vest.dur > 0) {
      const aSpec = CONFIG.armor.vest[tgt.vest.level - 1];
      const abs = dmg * aSpec.abs;
      tgt.vest.dur = Math.max(0, tgt.vest.dur - abs);
      dmg -= abs;
    }
    tgt.hp -= dmg;
    showHitFeedback(dmg, zone, dist, false);
    if (tgt.hp <= 0) {
      tgt.hp = 0;
      tgt.alive = false;
      tgt.respawnTimer = 2.5;
      tgt.mesh.rotation.x = -Math.PI / 2.2;
    }
  }

  function startReload() {
    const sl = slots[activeSlot];
    const def = WEAPONS_DB[sl.id];
    const maxMag = getMaxMag(sl);
    if (maxMag <= 0 || sl.mag >= maxMag || (!unlimitedAmmo && ammoReserve[def.ammo] <= 0) || reloadTimer > 0) return;
    const magAtt = sl.att.mag ? ATTACHMENTS_DB[sl.att.mag] : null;
    const baseT = sl.mag === 0 ? def.reload.empty : def.reload.tactical;
    reloadTargetDur = baseT * (magAtt?.reloadMult || 1.0);
    reloadTimer = reloadTargetDur;
    AudioSys.playMechanical('reload_mag');
  }

  function healFull() {
    hp = 100; boost = 100;
    helm = { level: 3, dur: CONFIG.armor.helm[2].dur };
    vest = { level: 3, dur: CONFIG.armor.vest[2].dur };
    bag = { level: 3, cap: 80 + (typeof Loot !== 'undefined' && Loot.ITEMS?.bag3?.cap ? Loot.ITEMS.bag3.cap : 350) };
    Object.assign(meds, { medkit: 3, firstaid: 5, bandage: 10, drink: 5, painkiller: 3, adrenaline: 3 });
    Object.assign(throwables, { frag: 5, smoke: 3, flashbang: 3 });
    AudioSys.playUiTone('alert');
  }

  function update(dt, elapsed, inp) {
    if (!alive) return;

    const gp = Input.pollGamepad();
    // Handle Vehicle Driving Mode cleanly (high-speed travel + bulletproof armor until dismount)
    if (typeof VehiclesSys !== 'undefined' && VehiclesSys.isDriving()) {
      const cheatPaused = typeof CheatUI !== 'undefined' && CheatUI.isOpen;
      if (!cheatPaused) {
        const invY = UI.settings.invertY ? -1 : 1;
        const sens = UI.settings.sensitivity * 0.0024;
        let dx = inp.dx, dy = inp.dy;
        if (gp) { dx += gp.lookX * 19 * (dt * 60); dy += gp.lookY * 14 * (dt * 60); }
        yaw -= dx * sens;
        pitch = Util.clamp(pitch - dy * sens * invY, -0.75, 0.95);
        if (Input.wasPressed('perspective') || gp?.perspJust) isTpp = !isTpp;
        if (Input.wasPressed('flashlight') || gp?.r3Just || gp?.dpadRightJust) Render.toggleFlashlight?.();
      }
      VehiclesSys.updatePlayerDriving(dt, gp, { yaw, pitch, isTpp });
      const activeV = VehiclesSys.activeVehicle;
      if (playerRig && activeV) {
        playerRig.root.visible = (activeV.kind === 'motor') && isTpp && alive;
        playerRig.root.position.copy(pos);
        playerRig.root.rotation.y = activeV.yaw;
        CharacterRig.setGear(playerRig, helm.level, vest.level, bag.level, slots[3].id === 'pan');
        CharacterRig.animateRig(playerRig, { speed: 0, stance: 'crouch', pitch: 0.1, ads: 0, chuteOpen: false }, dt);
      }
      combatTargetsBuf.length = 0;
      for (let i = 0; i < targets.length; i++) combatTargetsBuf.push(targets[i]);
      const aiBots = AI.bots;
      for (let i = 0; i < aiBots.length; i++) combatTargetsBuf.push(aiBots[i]);
      combatTargetsBuf.push(playerTarget);
      const fwdL = new THREE.Vector3(); Render.camera.getWorldDirection(fwdL);
      AudioSys.updateListener(Render.camera.position, fwdL, THREE.Object3D.DEFAULT_UP);
      Ballistics.step(dt, combatTargetsBuf, applyDamageToTarget);
      hudTickAcc += dt;
      if (hudTickAcc >= 0.05) { hudTickAcc = 0; updateHUD(0.4); }
      return;
    }

    // 1. Update mouse & gamepad look (works in both FPP and TPP without pointer lock for gamepad)
    const sens = UI.settings.sensitivity * 0.0022 * Util.lerp(1.0, UI.settings.adsSens / Math.max(1, getOpticZoom() * 0.45), adsLerp);
    const invY = UI.settings.invertY ? -1 : 1;
    let dx = inp.dx, dy = inp.dy;
    const cheatOpen = typeof CheatUI !== 'undefined' && CheatUI.isOpen;
    if (gp && !cheatOpen) {
      dx += gp.lookX * 19 * (dt * 60);
      dy += gp.lookY * 14 * (dt * 60);
    }

    if (Input.isCodeDown('AltLeft')) {
      freeLookYaw = Util.clamp(freeLookYaw - dx * sens, -1.6, 1.6);
      freeLookPitch = Util.clamp(freeLookPitch - dy * sens * invY, -0.8, 0.8);
    } else {
      yaw -= dx * sens;
      pitch = Util.clamp(pitch - dy * sens * invY, -1.48, 1.48);
      freeLookYaw = Util.damp(freeLookYaw, 0, 14, dt);
      freeLookPitch = Util.damp(freeLookPitch, 0, 14, dt);
    }

    // 2. Stance & Vault / Jump / Gamepad Shortcuts
    if (Input.wasPressed('crouch')) stance = stance === 'crouch' ? 'stand' : 'crouch';
    if (Input.wasPressed('prone')) stance = stance === 'prone' ? 'stand' : 'prone';
    if (gp && !cheatOpen) {
      if (gp.crouchHeld) {
        padBHold += dt;
        if (padBHold > 0.38 && !padBProneUsed) { stance = stance === 'prone' ? 'stand' : 'prone'; padBProneUsed = true; }
      } else {
        if (padBHold > 0.01 && !padBProneUsed) stance = stance === 'crouch' ? 'stand' : 'crouch';
        padBHold = 0; padBProneUsed = false;
      }
      if (gp.dpadLeftJust) {
        const sl = slots[activeSlot], def = WEAPONS_DB[sl.id];
        sl.mode = def.modes[(def.modes.indexOf(sl.mode) + 1) % def.modes.length];
        AudioSys.playUiTone('click');
      }
      if (gp.switchJust) {
        activeSlot = (activeSlot + 1) % 4;
        vmBuildKey = ''; rebuildActiveWeaponMesh(); reloadTimer = 0;
        AudioSys.playUiTone('click');
      }
      if (gp.dpadUpJust) {
        if (meds.medkit > 0 && hp < 100) useConsumable('medkit');
        else if (meds.firstaid > 0 && hp < 80) useConsumable('firstaid');
        else if (meds.bandage > 0 && hp < 80) useConsumable('bandage');
        else useConsumable('boost');
      }
    }
    if (Input.wasPressed('perspective') || (gp?.perspJust && !cheatOpen)) isTpp = !isTpp;
    if (Input.wasPressed('flashlight') || ((gp?.r3Just || gp?.dpadRightJust) && !cheatOpen)) Render.toggleFlashlight?.();
    if (Input.wasPressed('inspect')) inspectTimer = 1.6;
    if (Input.wasPressed('reload')) startReload();
    if (Input.wasPressed('fireMode')) {
      const sl = slots[activeSlot], def = WEAPONS_DB[sl.id];
      const nxt = (def.modes.indexOf(sl.mode) + 1) % def.modes.length;
      sl.mode = def.modes[nxt];
      AudioSys.playUiTone('click');
    }

    // Switch weapon slots 1..4
    if (Input.wasCodePressed('Digit1')) { activeSlot = 0; vmBuildKey = ''; rebuildActiveWeaponMesh(); reloadTimer = 0; }
    if (Input.wasCodePressed('Digit2')) { activeSlot = 1; vmBuildKey = ''; rebuildActiveWeaponMesh(); reloadTimer = 0; }
    if (Input.wasCodePressed('Digit3')) { activeSlot = 2; vmBuildKey = ''; rebuildActiveWeaponMesh(); reloadTimer = 0; }
    if (Input.wasCodePressed('Digit4') || Input.wasPressed('melee')) { activeSlot = 3; vmBuildKey = ''; rebuildActiveWeaponMesh(); reloadTimer = 0; }
    if (Input.wasPressed('zeroUp')) zeroDist = Math.min(800, zeroDist + 100);
    if (Input.wasPressed('zeroDown')) zeroDist = Math.max(100, zeroDist - 100);

    // Wheel switches variable zoom while ADS or weapon slot while hipfire
    if (inp.wheel !== 0) {
      const opt = slots[activeSlot].att.optic ? ATTACHMENTS_DB[slots[activeSlot].att.optic] : null;
      if (adsLerp > 0.5 && opt?.minZoom) {
        scopeMagOverride = Util.clamp((scopeMagOverride || opt.zoom) - inp.wheel * 0.5, opt.minZoom, opt.zoom);
      } else {
        activeSlot = (activeSlot + (inp.wheel > 0 ? 1 : 3)) % 4;
        vmBuildKey = ''; rebuildActiveWeaponMesh(); reloadTimer = 0;
      }
    }

    // 3. Movement vector
    let fwdIn = (Input.isDown('forward') ? 1 : 0) - (Input.isDown('backward') ? 1 : 0);
    let strIn = (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0);
    if (gp) { fwdIn -= gp.moveY; strIn += gp.moveX; }
    const inLen = Math.hypot(fwdIn, strIn);
    if (inLen > 1) { fwdIn /= inLen; strIn /= inLen; }

    const wantsSprint = (Input.isDown('sprint') || gp?.sprint || UI.settings.autoSprint) && fwdIn > 0.2 && adsLerp < 0.2 && stance === 'stand' && !castState.active;
    const curDef = WEAPONS_DB[slots[activeSlot].id];
    const groundY = World.getHeight(pos.x, pos.z);
    const waterDepth = Math.max(0, CONFIG.world.seaLevel - pos.y);
    let maxSpd = wantsSprint ? CONFIG.player.speed.sprint : Input.isDown('walk') ? CONFIG.player.speed.walk : CONFIG.player.speed.jog;
    if (stance === 'crouch') maxSpd = CONFIG.player.speed.crouch;
    else if (stance === 'prone') maxSpd = CONFIG.player.speed.prone;
    if (fwdIn < 0) maxSpd *= CONFIG.player.speed.backMult;
    else if (Math.abs(strIn) > 0.5 && Math.abs(fwdIn) < 0.2) maxSpd *= CONFIG.player.speed.strafeMult;
    if (adsLerp > 0.35) maxSpd *= CONFIG.player.speed.adsMult;
    if (curDef.heavy) maxSpd *= CONFIG.player.speed.heavyMult;
    if (boost > 90) maxSpd *= 1.062;
    else if (boost > 60) maxSpd *= 1.025;
    if (castState.active) maxSpd *= 0.45;
    if (waterDepth > 1.35) maxSpd = 2.6;
    else if (waterDepth > 0.55) maxSpd *= 0.62;
    else if (waterDepth > 0.15) maxSpd *= 0.85;

    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    const moveDirX = -sinY * fwdIn + cosY * strIn;
    const moveDirZ = -cosY * fwdIn - sinY * strIn;
    const accel = grounded ? 14 : 4;
    vel.x = Util.damp(vel.x, moveDirX * maxSpd, accel, dt);
    vel.z = Util.damp(vel.z, moveDirZ * maxSpd, accel, dt);

    // Jump & Vault Check
    if ((Input.wasPressed('jump') || (gp?.jumpJust && !cheatOpen)) && grounded && waterDepth < 1.1) {
      // Check low obstacle vault ray
      const vRay = Physics.raycast(pos.x, pos.y + 0.65, pos.z, -sinY, 0, -cosY, 1.35);
      if (vRay && vRay.collider?.maxY && (vRay.collider.maxY - pos.y) <= CONFIG.player.vaultMaxH) {
        vel.y = 6.2;
        pos.x += -sinY * 0.45; pos.z += -cosY * 0.45;
      } else {
        vel.y = CONFIG.player.jump;
      }
      grounded = false;
      fallStartY = pos.y;
    }

    vel.y -= (waterDepth > 1.35 ? 3.5 : CONFIG.player.gravity) * dt;
    if (waterDepth > 1.35 && pos.y < CONFIG.world.seaLevel - 1.2) vel.y = Math.max(vel.y, 1.8);

    pos.x = Util.clamp(pos.x + vel.x * dt, -CONFIG.world.halfSize + 10, CONFIG.world.halfSize - 10);
    pos.z = Util.clamp(pos.z + vel.z * dt, -CONFIG.world.halfSize + 10, CONFIG.world.halfSize - 10);
    pos.y += vel.y * dt;

    // Resolve XZ capsule colliders & step-up / floor height
    const floorH = Physics.resolveCapsuleXZ(pos, CONFIG.player.radius, CONFIG.player.height[stance]);
    if (pos.y <= floorH) {
      if (!grounded && vel.y < -6) {
        const drop = fallStartY - pos.y;
        if (drop > CONFIG.player.fallDamageStart) {
          hp = Math.max(1, hp - (drop - CONFIG.player.fallDamageStart) * CONFIG.player.fallDamagePerM);
        }
        AudioSys.playFootstep(waterDepth > 0.1 ? 'water' : 'concrete', 'stand', 6.5);
      }
      pos.y = floorH;
      vel.y = 0;
      grounded = true;
      fallStartY = pos.y;
    } else {
      grounded = false;
      if (pos.y > fallStartY) fallStartY = pos.y;
    }

    // Footstep cadence & sprint breath
    const hSpd = Math.hypot(vel.x, vel.z);
    if (grounded && hSpd > 0.6) {
      stepDist += hSpd * dt;
      const stepStride = stance === 'sprint' || hSpd > 5.5 ? 2.1 : stance === 'crouch' ? 1.2 : 1.65;
      if (stepDist >= stepStride) {
        stepDist = 0;
        AudioSys.playFootstep(waterDepth > 0.1 ? 'water' : 'concrete', stance, hSpd);
      }
    }
    if (wantsSprint && hSpd > 5.0) sprintSec += dt; else sprintSec = Math.max(0, sprintSec - dt * 1.5);

    // 4. Lean Q/E wall clamp
    const targetLean = (Input.isDown('leanRight') ? 1 : 0) - (Input.isDown('leanLeft') ? 1 : 0);
    leanFactor = Util.damp(leanFactor, targetLean, 14, dt);
    if (Math.abs(leanFactor) > 0.02) {
      const lRay = Physics.raycast(pos.x, pos.y + curEyeH, pos.z, cosY * Math.sign(leanFactor), 0, -sinY * Math.sign(leanFactor), 0.45);
      if (lRay && lRay.t < 0.35) leanFactor *= (lRay.t / 0.35);
    }

    const tgtEye = CONFIG.player.eye[stance];
    curEyeH = Util.damp(curEyeH, tgtEye, 14, dt);

    // 5. Firing, Reload, Bolt, ADS
    const sl = slots[activeSlot];
    const aiming = Input.rmbDown || (gp?.ads);
    const optAtt = sl.att.optic ? ATTACHMENTS_DB[sl.att.optic] : null;
    const adsRate = 1 / Math.max(0.08, curDef.ads.time / (optAtt?.adsSpeed || 1));
    adsLerp = Util.damp(adsLerp, aiming && reloadTimer <= 0 && !wantsSprint ? 1 : 0, adsRate * 1.8, dt);

    if (boltTimer > 0) {
      boltTimer = Math.max(0, boltTimer - dt);
      if (boltTimer < 0.3 && boltTimer > 0.25) AudioSys.playMechanical('bolt');
    }
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        if (unlimitedAmmo) {
          sl.mag = getMaxMag(sl);
        } else {
          const needed = getMaxMag(sl) - sl.mag;
          const loadAmt = Math.min(needed, ammoReserve[curDef.ammo]);
          sl.mag += loadAmt;
          ammoReserve[curDef.ammo] -= loadAmt;
        }
        AudioSys.playMechanical('bolt');
      }
    }
    if (fireCd > 0) fireCd -= dt;
    if (meleeTimer > 0) meleeTimer = Math.max(0, meleeTimer - dt);
    if (inspectTimer > 0) inspectTimer = Math.max(0, inspectTimer - dt);

    recoilTimeSinceShot += dt;
    if (recoilTimeSinceShot > 0.22) recoilIdx = Math.max(0, recoilIdx - 1);
    recoilKickPitch = Util.damp(recoilKickPitch, 0, 12, dt);
    recoilKickYaw = Util.damp(recoilKickYaw, 0, 12, dt);

    const mouseFire = Input.pointerLocked && (sl.mode === 'auto' ? Input.lmbDown : inp.lmbJust);
    const padFire = !cheatOpen && !!gp && (sl.mode === 'auto' ? gp.fire : gp.fireJust);
    if ((mouseFire || padFire) && fireCd <= 0) {
      if (castState.active) cancelCast();
      triggerShot();
    }

    // Cast bar tick & Heal quickslots (7/8/9/0)
    if (Input.wasPressed('healMedkit')) useConsumable('medkit');
    if (Input.wasPressed('healFirstAid')) useConsumable('firstaid');
    if (Input.wasPressed('healBandage')) useConsumable('bandage');
    if (Input.wasPressed('healBoost')) useConsumable('boost');

    if (castState.active) {
      if (Input.isDown('sprint') || !grounded) cancelCast();
      else {
        castState.timer -= dt;
        const cb = document.getElementById('hud-cast-bar');
        if (cb) {
          cb.classList.remove('hidden');
          document.getElementById('hud-cast-label').textContent = castState.label;
          document.getElementById('hud-cast-sec').textContent = `${Math.max(0, castState.timer).toFixed(1)}s`;
          const pct = Util.clamp(1 - castState.timer / castState.total, 0, 1) * 100;
          document.getElementById('hud-cast-fill').style.width = `${pct}%`;
        }
        if (castState.timer <= 0) {
          applyCastCompletion(castState.key);
          castState.active = false;
          document.getElementById('hud-cast-bar')?.classList.add('hidden');
        }
      }
    } else {
      document.getElementById('hud-cast-bar')?.classList.add('hidden');
    }

    // 4-Tier Boost Regeneration (PRD Sec 8: 1..4 ticks HP / 8s -> continuous equivalent)
    if (boost > 0) {
      boost = Math.max(0, boost - dt * 1.0);
      const regen = boost > 90 ? 0.5 : boost > 60 ? 0.375 : boost > 20 ? 0.25 : 0.125;
      hp = Math.min(100, hp + regen * dt);
    }

    // Shatter window glass on fast sprint / melee pan swing
    if ((wantsSprint && hSpd > 5.0) || meleeTimer > 0.45) {
      const panes = WorldBuildings.glassPanes;
      for (let gi = 0; gi < panes.length; gi++) {
        const gp2 = panes[gi];
        if (!gp2.shattered && Math.hypot(gp2.x - pos.x, gp2.z - pos.z) < 1.35 && Math.abs(gp2.y - (pos.y + 1.4)) < 1.3) {
          gp2.shatter();
        }
      }
    }

    // 6. Camera & Spring-Arm (FPP vs TPP) + Viewmodel Transform
    const cam = Render.camera;
    const eyeX = pos.x + cosY * (leanFactor * CONFIG.player.leanOffset);
    const eyeY = pos.y + curEyeH;
    const eyeZ = pos.z - sinY * (leanFactor * CONFIG.player.leanOffset);
    const totalYaw = yaw + freeLookYaw;
    const totalPitch = pitch + freeLookPitch;

    const eul = new THREE.Euler(totalPitch, totalYaw, -leanFactor * THREE.MathUtils.degToRad(CONFIG.player.leanAngle), 'YXZ');
    const lookQ = new THREE.Quaternion().setFromEuler(eul);

    if (!isTpp) {
      cam.position.set(eyeX, eyeY, eyeZ);
      cam.quaternion.copy(lookQ);
    } else {
      const [sx, sy, sb] = CONFIG.camera.tppOffset;
      const offset = new THREE.Vector3(sx * tppShoulder, sy, sb).applyQuaternion(lookQ);
      const rayDir = offset.clone().normalize();
      const hit = Physics.raycast(eyeX, eyeY, eyeZ, rayDir.x, rayDir.y, rayDir.z, offset.length());
      const camD = hit ? Math.max(0.4, hit.t - 0.15) : offset.length();
      cam.position.set(eyeX, eyeY, eyeZ).addScaledVector(rayDir, camD);
      cam.quaternion.copy(lookQ);
    }

    const baseFov = UI.settings.fov || CONFIG.camera.fov;
    const targetFov = adsLerp > 0.1 ? (baseFov / getOpticZoom()) : (wantsSprint && hSpd > 5.2 ? baseFov + 3.5 : baseFov);
    cam.fov = Util.damp(cam.fov, targetFov, 14, dt);
    cam.updateProjectionMatrix();

    // Update Viewmodel Weapon Pose (wall lowering + bob + ADS + reload + melee)
    Render.setViewmodelEnabled(!isTpp && adsLerp < 0.72);
    if (vmRoot) {
      const fVec = new THREE.Vector3(); cam.getWorldDirection(fVec);
      const wallRay = Physics.raycast(eyeX, eyeY, eyeZ, fVec.x, fVec.y, fVec.z, 0.9);
      const wallLower = wallRay ? Util.clamp((0.9 - wallRay.t) / 0.5, 0, 1) : 0;

      const bobAmp = grounded ? Math.min(1, hSpd / 5.0) * (1 - adsLerp * 0.75) : 0;
      const bobX = Math.sin(elapsed * 9.5) * 0.012 * bobAmp;
      const bobY = Math.abs(Math.cos(elapsed * 9.5)) * 0.010 * bobAmp + Math.sin(elapsed * 2.1) * 0.003 * (1 + (sprintSec > 6 ? 1.5 : 0));

      const hipX = 0.20, hipY = -0.19, hipZ = -0.44;
      const adsY = -(vmWeaponHolder?.userData.sightY || 0.09);
      const vx = Util.lerp(hipX, 0.0, adsLerp) + bobX - recoilKickYaw * 0.4;
      const vy = Util.lerp(hipY, adsY, adsLerp) + bobY - wallLower * 0.12 - (reloadTimer > 0 ? 0.09 : 0);
      const vz = Util.lerp(hipZ, -0.32, adsLerp) + recoilKickPitch * 0.25 + wallLower * 0.14;
      vmRoot.position.set(vx, vy, vz);

      let rX = recoilKickPitch * 0.9 - wallLower * 0.65 - (reloadTimer > 0 ? 0.35 : 0);
      let rY = -recoilKickYaw * 0.5 + (wantsSprint ? 0.45 : 0) + (inspectTimer > 0 ? Math.sin(inspectTimer * 3.5) * 0.5 : 0);
      let rZ = meleeTimer > 0 ? -Math.sin(meleeTimer * 9) * 1.1 : (wantsSprint ? 0.25 : 0);
      vmRoot.rotation.set(rX, rY, rZ);
    }

    // Range Target Respawn & Moving Rail Target
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.moving && t.alive) {
        t.pos.x = t.baseX + Math.sin(elapsed * 1.4) * 5.0;
        t.mesh.position.x = t.pos.x;
      }
      if (!t.alive) {
        t.respawnTimer -= dt;
        if (t.respawnTimer <= 0) {
          t.alive = true; t.hp = t.maxHp;
          t.helm.dur = 80; t.vest.dur = 200;
          t.mesh.rotation.x = 0;
        }
      }
    }

    // Prioritized F Interaction: 1. Practice Rack -> 2. Door -> 3. Death Crate -> 4. Ground Loot + Auto-Pickup
    interactPromptTarget = null;
    let bestD = 2.4;
    for (let i = 0; i < rackPickups.length; i++) {
      const rp = rackPickups[i];
      const d = Math.hypot(rp.x - pos.x, rp.z - pos.z);
      if (d < bestD) { bestD = d; interactPromptTarget = { kind: 'rack', label: rp.label, data: rp }; }
    }
    const nearDoor = WorldBuildings.findNearestDoor(pos, 2.5);
    const nearCrate = Loot.findNearbyCrate(pos.x, pos.y, pos.z, 2.7);
    const nearLoot = Loot.queryNearby(pos.x, pos.y, pos.z, 2.6);

    if (UI.settings.autoPickup && nearLoot.length) {
      for (let li = 0; li < nearLoot.length; li++) {
        const it = nearLoot[li];
        const c = it.def.cat;
        if (c === 'ammo' || c === 'med' || c === 'helm' || c === 'vest' || c === 'bag') {
          if (Math.hypot(it.x - pos.x, it.z - pos.z) < 2.1) pickupItem(it);
        }
      }
    }

    const nearVeh = typeof VehiclesSys !== 'undefined' ? VehiclesSys.findNearestVehicle(pos, 3.6) : null;
    if (!interactPromptTarget) {
      if (nearVeh) interactPromptTarget = { kind: 'vehicle', label: `F / □ — Naik ${nearVeh.label}`, data: nearVeh };
      else if (nearDoor) interactPromptTarget = { kind: 'door', label: nearDoor.isOpen ? 'F / □ — Tutup Pintu' : 'F / □ — Buka Pintu', data: nearDoor };
      else if (nearCrate) interactPromptTarget = { kind: 'crate', label: `F / □ — Geledah Peti (${nearCrate.items.length} item)`, data: nearCrate };
      else if (nearLoot.length) interactPromptTarget = { kind: 'loot', label: `F / □ — Ambil ${nearLoot[0].def.name}`, data: nearLoot[0] };
    }

    const intEl = document.getElementById('hud-interact');
    intEl.classList.toggle('hidden', !interactPromptTarget);
    const padSquare = !cheatOpen && !!gp?.reloadJust;
    if (interactPromptTarget) {
      document.getElementById('hud-interact-text').textContent = interactPromptTarget.label;
      if (Input.wasPressed('interact') || padSquare) {
        if (interactPromptTarget.kind === 'vehicle') VehiclesSys.boardVehicle(interactPromptTarget.data);
        else if (interactPromptTarget.kind === 'rack') equipWeaponInSlot(interactPromptTarget.data.weaponId);
        else if (interactPromptTarget.kind === 'door') interactPromptTarget.data.toggle(true);
        else if (interactPromptTarget.kind === 'crate') UI.showInventoryModal?.();
        else if (interactPromptTarget.kind === 'loot') pickupItem(interactPromptTarget.data);
      }
    } else if (padSquare) {
      startReload();
    }

    // Step 120Hz Ballistics + Player TPP Body Sync + Audio Listener
    if (!playerRig && Render.scene) {
      playerRig = CharacterRig.createRig(0, slots[activeSlot].id);
      Render.scene.add(playerRig.root);
    }
    if (playerRig) {
      playerRig.root.visible = (isTpp || forceRigVisible) && alive;
      playerRig.root.position.copy(pos);
      playerRig.root.rotation.y = yaw;
      CharacterRig.setWeapon(playerRig, slots[activeSlot].id);
      CharacterRig.setGear(playerRig, helm.level, vest.level, bag.level, slots[3].id === 'pan' && activeSlot !== 3);
      CharacterRig.animateRig(playerRig, { speed: hSpd, stance, pitch, ads: adsLerp, chuteOpen: forceRigVisible }, dt);
    }

    combatTargetsBuf.length = 0;
    for (let i = 0; i < targets.length; i++) combatTargetsBuf.push(targets[i]);
    const aiBots = AI.bots;
    for (let i = 0; i < aiBots.length; i++) combatTargetsBuf.push(aiBots[i]);
    combatTargetsBuf.push(playerTarget);

    const fwdL = new THREE.Vector3(); cam.getWorldDirection(fwdL);
    AudioSys.updateListener(cam.position, fwdL, THREE.Object3D.DEFAULT_UP);
    Ballistics.step(dt, combatTargetsBuf, applyDamageToTarget);

    // Hitmarker & damage sector decay
    if (dmgIndicatorTimer > 0) {
      dmgIndicatorTimer -= dt;
      if (dmgIndicatorTimer <= 0) document.getElementById('damage-sectors').innerHTML = '';
    }
    if (hitmarkerTimer > 0) {
      hitmarkerTimer -= dt;
      if (hitmarkerTimer <= 0) document.getElementById('hitmarker-svg').style.opacity = '0';
    }
    updateScopeReticleUI();
    hudTickAcc += dt;
    if (hudTickAcc >= 0.05) { hudTickAcc = 0; updateHUD(spDegEstimate()); }
  }

  function spDegEstimate() {
    const def = WEAPONS_DB[slots[activeSlot].id];
    const mv = Math.hypot(vel.x, vel.z);
    return Util.lerp(def.spread.base, def.spread.ads, adsLerp) + mv * 0.25;
  }

  function getOpticZoom() {
    const sl = slots[activeSlot];
    const opt = sl.att.optic ? ATTACHMENTS_DB[sl.att.optic] : null;
    if (!opt) return 1.15;
    return scopeMagOverride || opt.zoom;
  }

  function updateHUD(spreadVal) {
    const sl = slots[activeSlot];
    const def = WEAPONS_DB[sl.id];
    document.getElementById('hud-weapon-name').textContent = def.name;
    document.getElementById('hud-fire-mode').textContent = sl.mode.toUpperCase();
    document.getElementById('hud-ammo-mag').textContent = def.ammo === 'none' ? '—' : String(sl.mag);
    document.getElementById('hud-ammo-res').textContent = def.ammo === 'none' ? '—' : (unlimitedAmmo ? '∞' : String(ammoReserve[def.ammo] || 0));
    document.getElementById('hud-zeroing').textContent = `${zeroDist}m`;
    document.getElementById('hud-hp-num').textContent = String(Math.ceil(hp));
    const hpEl = document.getElementById('hud-hp-fill');
    hpEl.style.width = `${Util.clamp(hp, 0, 100)}%`;
    hpEl.classList.toggle('low', hp < 25);
    document.getElementById('hud-helm').textContent = `L${helm.level}`;
    document.getElementById('hud-vest').textContent = `L${vest.level}`;
    document.getElementById('hud-bag').textContent = `L${bag.level}`;
    document.getElementById('hud-stance').textContent = stance === 'prone' ? 'TIARAP' : stance === 'crouch' ? 'JONGKOK' : 'BERDIRI';
    document.getElementById('hud-poi-name').textContent = World.getClosestPoiName(pos.x, pos.z);
    for (let i = 0; i < 4; i++) document.getElementById(`ws-${i + 1}`).classList.toggle('active', activeSlot === i);
    document.getElementById('qs-medkit').textContent = String(meds.medkit);
    document.getElementById('qs-firstaid').textContent = String(meds.firstaid);
    document.getElementById('qs-bandage').textContent = String(meds.bandage);
    document.getElementById('qs-boost').textContent = String(meds.drink + meds.painkiller + meds.adrenaline);

    // 4-Segment Boost Gauge Fill
    const bSegs = [[0, 20], [20, 60], [60, 90], [90, 100]];
    for (let i = 0; i < 4; i++) {
      const [lo, hi] = bSegs[i];
      const f = Util.clamp((boost - lo) / (hi - lo), 0, 1) * 100;
      const bEl = document.getElementById(`boost-seg-${i + 1}`);
      if (bEl) bEl.style.width = `${f}%`;
    }
    MapUI.updateMinimap(pos.x, pos.z, yaw, activeZonesRef);

    // Dynamic crosshair gap from spread
    const gap = Math.round(Util.clamp(6 + spreadVal * 6, 4, 24));
    const chCol = UI.settings.crosshairColor || '#EDEFF1';
    document.getElementById('ch-dot').setAttribute('fill', chCol);
    const setL = (id, x1, y1, x2, y2) => {
      const el = document.getElementById(id);
      el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2);
      el.setAttribute('stroke', chCol);
    };
    setL('ch-top', 32, 32 - gap, 32, 32 - gap - 8);
    setL('ch-bot', 32, 32 + gap, 32, 32 + gap + 8);
    setL('ch-left', 32 - gap, 32, 32 - gap - 8, 32);
    setL('ch-right', 32 + gap, 32, 32 + gap + 8, 32);

    // Compass Canvas redraw
    const cc = document.getElementById('compass-canvas');
    if (cc) {
      const g = cc.getContext('2d');
      g.clearRect(0, 0, cc.width, cc.height);
      const deg = ((-THREE.MathUtils.radToDeg(yaw) % 360) + 360) % 360;
      g.font = 'bold 11px system-ui'; g.textAlign = 'center';
      const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      for (let d = -75; d <= 75; d += 5) {
        const markDeg = (Math.round((deg + d) / 5) * 5 + 360) % 360;
        const diff = ((markDeg - deg + 540) % 360) - 180;
        const px = cc.width * 0.5 + diff * 2.2;
        if (px < 8 || px > cc.width - 8) continue;
        const lbl = labels[markDeg];
        g.fillStyle = lbl ? '#F2B705' : 'rgba(237,239,241,0.5)';
        g.fillRect(px - 0.5, lbl ? 16 : 20, 1, lbl ? 8 : 5);
        if (lbl) g.fillText(lbl, px, 13);
      }
      if (MapUI.ping) {
        const angRad = Math.atan2(-(MapUI.ping.x - pos.x), -(MapUI.ping.z - pos.z));
        const pDeg = ((-THREE.MathUtils.radToDeg(angRad) % 360) + 360) % 360;
        const diffP = ((pDeg - deg + 540) % 360) - 180;
        const ppx = Util.clamp(cc.width * 0.5 + diffP * 2.2, 8, cc.width - 8);
        g.fillStyle = '#F2B705';
        g.beginPath(); g.moveTo(ppx, 4); g.lineTo(ppx + 5, 10); g.lineTo(ppx, 16); g.lineTo(ppx - 5, 10); g.closePath(); g.fill();
      }
    }
  }

  return {
    spawnAt, buildRangeAndTargets, update, equipWeaponInSlot, setAttachment, triggerShot,
    initLoadoutForMode, pickupItem, dropItem, useConsumable, equipLooseAttachment, detachAttachment, getBagWeight,
    showHitFeedback, takeDamage, playerTarget,
    setForceRigVisible(v) { forceRigVisible = v; },
    setPerspectiveMode,
    setTpp(v) { isTpp = !!v; },
    get isTpp() { return isTpp; },
    set isTpp(v) { isTpp = !!v; },
    get unlimitedAmmo() { return unlimitedAmmo; },
    setUnlimitedAmmo(v) { unlimitedAmmo = !!v; },
    get godMode() { return godMode; },
    setGodMode(v) { godMode = !!v; },
    healFull,
    setZonesRef(z) { activeZonesRef = z; },
    getInventoryData() { return { slots, activeSlot, helm, vest, bag, meds, ammoReserve, throwables, looseAtts, hp, boost, weight: getBagWeight() }; },
    get pos() { return pos; },
    get yaw() { return yaw; },
    set yaw(v) { yaw = Number(v) || 0; },
    get pitch() { return pitch; },
    set pitch(v) { pitch = Util.clamp(Number(v) || 0, -1.48, 1.48); },
    get activeWeapon() { return slots[activeSlot]; },
    get stance() { return stance; },
    get targets() { return targets; },
    get alive() { return alive; },
    get hp() { return hp; },
    set hp(v) { hp = Util.clamp(Number(v) || 0, 0, 100); },
    get castActive() { return castState.active; }
  };
})();

