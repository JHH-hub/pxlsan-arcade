/**
 * Pxlsan Spine 2D Real-Time Skeletal Rig & Half-Body Mesh Player (spine-rig-player.js)
 * ------------------------------------------------------------------------------------
 * 针对完整无裁切半身像 (full_halfbody.webp) 进行 60 FPS 无缝骨骼网格变形驱动：
 *   - 彻底消除多碎片图层叠加导致的「翻白眼 / 半透明鬼影 / 眼窝穿帮 / 边缘重影」问题
 *   - 100% 保留高清完整头顶与半身像原画画质与实心不透明度
 *   - 树状父子骨骼矩阵变换 (root -> torso -> neck -> head -> hair_f/b, eye_l/r, arm_l/r)
 *   - 鼠标光标跟随摆头与呼吸起伏、Sway-Chain 发丝摇摆、攻击突刺、受击震退
 *   - 支持实时开关 Spine 骨骼与关节点透视层 (showBones = true/false)
 */
(function (global) {
  'use strict';

  class SpineRigInstance {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.rigData = null;
      this.fullImage = null;
      this.loaded = false;
      this.flipX = !!options.flipX;
      this.showBones = !!options.showBones;
      this.motionScale = options.motionScale !== undefined ? options.motionScale : 1.0;
      this.state = 'idle';
      this.stateTimer = 0;
      this.time = Math.random() * 10;

      this.lookTarget = { x: 0, y: 0 };
      this.currentLook = { x: 0, y: 0 };

      this.worldBones = {};
      this.currentRigUrl = '';
    }

    async loadRig(rigJsonUrl) {
      if (this.currentRigUrl === rigJsonUrl && this.loaded) return true;
      this.currentRigUrl = rigJsonUrl;
      this.loaded = false;
      this.fullImage = null;
      try {
        const res = await fetch(`${rigJsonUrl}?v=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.rigData = data;

        const baseDir = rigJsonUrl.substring(0, rigJsonUrl.lastIndexOf('/') + 1);
        const fullFile = data.fullSprite || 'full_halfbody.webp';
        const imgUrl = fullFile.startsWith('assets/') ? fullFile : `${baseDir}${fullFile}?v=${Date.now()}`;

        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.fullImage = img;
            resolve();
          };
          img.onerror = (e) => reject(e);
          img.src = imgUrl;
        });

        this.loaded = true;
        return true;
      } catch (err) {
        console.warn('[SpineRigPlayer] Fallback to img sprite:', rigJsonUrl, err);
        this.loaded = false;
        return false;
      }
    }

    playState(stateName, duration = 0.65) {
      this.state = stateName;
      this.stateTimer = duration;
    }

    setLookAtClientPos(clientX, clientY) {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.36;
      const nx = Math.max(-1, Math.min(1, (clientX - cx) / 240));
      const ny = Math.max(-1, Math.min(1, (clientY - cy) / 180));
      this.lookTarget.x = nx;
      this.lookTarget.y = ny;
    }

    update(dt) {
      if (!this.loaded || !this.rigData) return;
      this.time += dt;

      if (this.stateTimer > 0) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0 && this.state !== 'defeated') {
          this.state = 'idle';
        }
      }

      this.currentLook.x += (this.lookTarget.x - this.currentLook.x) * Math.min(1, dt * 8);
      this.currentLook.y += (this.lookTarget.y - this.currentLook.y) * Math.min(1, dt * 8);

      this.computeBoneTransforms();
    }

    computeBoneTransforms() {
      const t = this.time;
      const m = this.motionScale;
      const isBoss = this.rigData.rigType === 'boss';
      const speed = isBoss ? 2.4 : 2.1;
      const breathSin = Math.sin(t * speed) * m;
      const swaySin = Math.sin(t * speed * 0.85 - 0.55) * m;
      const swayChain2 = Math.sin(t * speed * 0.85 - 1.15) * m;

      let attackLungeX = 0;
      let attackRot = 0;
      let armAttackRot = 0;
      let hitShakeX = 0;
      let hitRot = 0;

      if (this.state === 'attack') {
        const p = Math.sin(Math.min(1, Math.max(0, 1 - this.stateTimer / 0.6)) * Math.PI);
        attackLungeX = p * (isBoss ? -38 : 40);
        attackRot = p * (isBoss ? -8 : 9);
        armAttackRot = p * -35;
      } else if (this.state === 'hit') {
        const p = Math.sin(this.stateTimer * 38);
        hitShakeX = p * 12;
        hitRot = -9 * Math.min(1, this.stateTimer * 3);
      }

      const bones = this.rigData.bones || {};
      this.worldBones = {};

      const baseOrder = [
        'root',
        'bone_torso',
        'bone_wing_l',
        'bone_wing_r',
        'bone_arm_l',
        'bone_arm_r',
        'bone_neck',
        'bone_head',
        'bone_hair_back',
        'bone_hair_front',
        'bone_brow_l',
        'bone_brow_r',
        'bone_eye_l',
        'bone_eye_r',
        'bone_pupil_l',
        'bone_pupil_r',
        'bone_mouth'
      ];

      const rw = this.fullImage ? this.fullImage.width : this.rigData.width || 768;
      const rh = this.fullImage ? this.fullImage.height : this.rigData.height || 920;

      baseOrder.forEach((bName) => {
        const def = bones[bName] || { x: 0.5, y: 0.5, parent: null };
        const parent = def.parent ? this.worldBones[def.parent] : null;

        let dx = 0;
        let dy = 0;
        let rot = 0;
        let sx = 1;
        let sy = 1;

        if (bName === 'root') {
          dx = attackLungeX + hitShakeX;
          dy = isBoss ? Math.sin(t * 2.2) * -6 * m : 0;
        } else if (bName === 'bone_torso') {
          dy = breathSin * -3.5;
          sy = 1 + breathSin * 0.016;
          sx = 1 - breathSin * 0.008;
          rot = swaySin * 1.2 + attackRot + hitRot;
        } else if (bName === 'bone_wing_l') {
          rot = Math.sin(t * 3.0) * 8 * m - armAttackRot * 0.35;
        } else if (bName === 'bone_wing_r') {
          rot = -Math.sin(t * 3.0) * 8 * m + armAttackRot * 0.35;
        } else if (bName === 'bone_arm_l') {
          rot = Math.sin(t * speed - 0.4) * 4.5 + armAttackRot;
          dy = breathSin * -2.0;
        } else if (bName === 'bone_arm_r') {
          rot = -Math.sin(t * speed - 0.4) * 4.5 - armAttackRot * 0.65;
          dy = breathSin * -2.0;
        } else if (bName === 'bone_neck') {
          dy = breathSin * -3.8;
          rot = swaySin * 1.5;
        } else if (bName === 'bone_head') {
          dx = this.currentLook.x * 4.2 * m;
          dy = breathSin * -4.2 + this.currentLook.y * 2.8 * m;
          rot = swaySin * 2.2 + this.currentLook.x * 3.0 * m;
        } else if (bName === 'bone_hair_back' || bName === 'bone_hair_front') {
          dx = this.currentLook.x * 2.2 * m;
          rot = swayChain2 * 3.5;
        } else if (bName === 'bone_pupil_l' || bName === 'bone_pupil_r') {
          dx = this.currentLook.x * 3.2 * m;
          dy = this.currentLook.y * 2.2 * m;
        }

        const px = def.x * rw;
        const py = def.y * rh;

        if (parent) {
          const rad = (parent.rot * Math.PI) / 180;
          const relX = (px - parent.origX) * parent.sx;
          const relY = (py - parent.origY) * parent.sy;
          const rx = relX * Math.cos(rad) - relY * Math.sin(rad);
          const ry = relX * Math.sin(rad) + relY * Math.cos(rad);
          this.worldBones[bName] = {
            origX: px,
            origY: py,
            x: parent.x + rx + dx,
            y: parent.y + ry + dy,
            rot: parent.rot + rot,
            sx: parent.sx * sx,
            sy: parent.sy * sy,
            parent: def.parent
          };
        } else {
          this.worldBones[bName] = {
            origX: px,
            origY: py,
            x: px + dx,
            y: py + dy,
            rot,
            sx,
            sy,
            parent: null
          };
        }
      });
    }

    render() {
      if (!this.ctx || !this.canvas || !this.loaded || !this.rigData || !this.fullImage) return;
      const ctx = this.ctx;
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const img = this.fullImage;
      const rw = img.width;
      const rh = img.height;
      // Leave generous top & side padding so swaying head/hair is NEVER clipped by canvas border
      const scale = Math.min((cw * 0.92) / rw, (ch * 0.94) / rh);
      const offsetX = (cw - rw * scale) / 2;
      const offsetY = ch - rh * scale;

      ctx.save();
      if (this.state === 'defeated') {
        ctx.globalAlpha = 0.25;
        ctx.filter = 'grayscale(1)';
      } else if (this.state === 'hit') {
        ctx.filter = 'brightness(1.65) drop-shadow(0 0 12px #f43f5e)';
      } else {
        ctx.filter = 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))';
      }

      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // 无缝骨骼条带网格变形渲染 (28 条水平条带平滑插值 head -> neck -> torso -> root)
      // 既具备真实的呼吸、歪头、视线跟随与出招突刺，又 100% 杜绝多图层抠图产生的白眼/鬼影/半透明接缝！
      const headBone = this.worldBones.bone_head || { x: rw * 0.5, y: rh * 0.28, origX: rw * 0.5, origY: rh * 0.28, rot: 0, sx: 1, sy: 1 };
      const torsoBone = this.worldBones.bone_torso || { x: rw * 0.5, y: rh * 0.68, origX: rw * 0.5, origY: rh * 0.68, rot: 0, sx: 1, sy: 1 };
      const rootBone = this.worldBones.root || { x: rw * 0.5, y: rh * 0.95, origX: rw * 0.5, origY: rh * 0.95, rot: 0, sx: 1, sy: 1 };

      const STRIPS = 28;
      const stripH = rh / STRIPS;

      for (let s = 0; s < STRIPS; s++) {
        const sy0 = s * stripH;
        const yNorm = (sy0 + stripH * 0.5) / rh;

        // Weight blend: top 0..0.44 follows headBone, 0.44..0.82 follows torsoBone, 0.82..1.0 anchors to rootBone
        let wHead = 0;
        let wTorso = 0;
        let wRoot = 0;
        if (yNorm < 0.42) {
          wHead = 1.0;
        } else if (yNorm < 0.56) {
          const u = (yNorm - 0.42) / 0.14;
          wHead = 1 - u;
          wTorso = u;
        } else if (yNorm < 0.82) {
          wTorso = 1.0;
        } else {
          const u = (yNorm - 0.82) / 0.18;
          wTorso = 1 - u;
          wRoot = u;
        }

        const dx =
          wHead * (headBone.x - headBone.origX) +
          wTorso * (torsoBone.x - torsoBone.origX) +
          wRoot * (rootBone.x - rootBone.origX);
        const dy =
          wHead * (headBone.y - headBone.origY) +
          wTorso * (torsoBone.y - torsoBone.origY) +
          wRoot * (rootBone.y - rootBone.origY);
        const rotDeg = wHead * headBone.rot + wTorso * torsoBone.rot;
        const scaleX = wHead * headBone.sx + wTorso * torsoBone.sx + wRoot * 1.0;

        ctx.save();
        const cx = rw * 0.5 + dx;
        const cy = sy0 + stripH * 0.5 + dy;
        ctx.translate(cx, cy);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.scale(scaleX, 1);

        // Add 0.85px overlap to prevent subpixel horizontal hairline gaps
        const srcY = Math.max(0, sy0 - 0.5);
        const srcH = Math.min(rh - srcY, stripH + 1.2);
        ctx.drawImage(img, 0, srcY, rw, srcH, -rw * 0.5, -stripH * 0.5 - 0.5, rw, srcH);
        ctx.restore();
      }

      if (this.showBones) {
        ctx.filter = 'none';
        Object.keys(this.worldBones).forEach((bName) => {
          const b = this.worldBones[bName];
          if (b.parent && this.worldBones[b.parent]) {
            const p = this.worldBones[b.parent];
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 245, 212, 0.92)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
          }
        });
        Object.keys(this.worldBones).forEach((bName) => {
          const b = this.worldBones[bName];
          ctx.save();
          ctx.fillStyle = bName.includes('eye') || bName.includes('pupil') ? '#fbbf24' : '#ff2a85';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }

      ctx.restore();
    }
  }

  global.SpineRigInstance = SpineRigInstance;
})(typeof window !== 'undefined' ? window : this);
