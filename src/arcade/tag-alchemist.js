/**
 * 《Pxlsan 炼丹工坊：AI 画师模拟器 (Tag Alchemist)》
 * 核心玩法：赛博 CRT 全息牌桌风 · 策略卡牌 Roguelike 构筑
 * 存储键值：localStorage['pxlsan-game:arcade:alchemist']
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'pxlsan-game:arcade:alchemist';
  const HAND_SIZE = 8;
  const MAX_PLAY_CARDS = 5;
  const MAX_MODULES = 5;

  // =========================================================================
  // 1. WebAudio 零依赖合成器音效引擎 (支持升调连锁 pitch *= 1.08)
  // =========================================================================
  class CyberSynthAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    tone(freq, duration = 0.09, type = 'triangle', gainVal = 0.14, slideFreq = null) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freq), now);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideFreq), now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    }

    // 选牌清脆咔哒声
    playClick(selected = true) {
      if (selected) {
        this.tone(580, 0.06, 'triangle', 0.14, 880);
      } else {
        this.tone(460, 0.06, 'sine', 0.11, 310);
      }
    }

    // 出牌连锁依次升调 (pitch *= 1.08^step) 的叮当声
    playChainDing(step = 0, isXMult = false) {
      const pitch = Math.pow(1.08, step);
      const baseFreq = isXMult ? 523.25 : 440;
      const freq = baseFreq * pitch;
      this.tone(freq, 0.13, isXMult ? 'sawtooth' : 'triangle', 0.16, freq * 1.18);
      if (isXMult) {
        setTimeout(() => this.tone(freq * 1.5, 0.14, 'sine', 0.14), 35);
      }
    }

    // SSR 暴击合成和弦
    playSsrChord() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, idx) => {
        setTimeout(() => {
          this.tone(n, 0.36, 'triangle', 0.14, n * 1.03);
        }, idx * 55);
      });
    }

    // 显卡过热 / 负向崩坏警报声
    playGlitchBuzz() {
      this.tone(155, 0.18, 'sawtooth', 0.16, 92);
    }

    // 商店购买清脆音效
    playCash() {
      this.tone(784, 0.08, 'sine', 0.14, 1174);
      setTimeout(() => this.tone(1174, 0.15, 'triangle', 0.14, 1568), 65);
    }
  }

  const sfx = new CyberSynthAudio();

  // =========================================================================
  // 2. 真实本地 .webp 高清二次元神图图鉴库 (18 张 100% 校验存在)
  // =========================================================================
  const CG_GALLERY_DB = [
    {
      id: 'cg_takagi_qipao',
      title: '高木 · 流光红旗袍贺岁',
      rarity: 'SSR',
      charKey: 'takagi',
      path: 'dressup/assets/gacha/up-ssr-takagi-qipao-wide.webp',
      prompt: '1girl, takagi, red satin qipao, golden lantern bokeh, teasing smirk, rim light, masterpiece'
    },
    {
      id: 'cg_aili_catgirl',
      title: '爱莉 · 霓虹猫耳女仆心动夜',
      rarity: 'SSR',
      charKey: 'aili',
      path: 'dressup/assets/gacha/up-ssr-aili-catgirl-wide.webp',
      prompt: '1girl, airi akizuki, blonde twintails, cyber catmaid outfit, neon bokeh, pov hand, ssr'
    },
    {
      id: 'cg_qianhe_santa',
      title: '千鹤 · 圣诞暖冬绒雪斗篷',
      rarity: 'SSR',
      charKey: 'qianhe',
      path: 'dressup/assets/gacha/up-ssr-qianhe-santa-wide.webp',
      prompt: '1girl, chizuru, santa velvet cloak, snowfall sparkle, warm candlelight, tender smile'
    },
    {
      id: 'cg_takako_jingyong',
      title: '贵子 · 盛夏竞泳水花特写',
      rarity: 'SSR',
      charKey: 'takako',
      path: 'dressup/assets/gacha/up-ssr-takako-jingyong-wide.webp',
      prompt: '1girl, takako, racing swimsuit, dappled sunlight, water droplets, dynamic dutch angle'
    },
    {
      id: 'cg_takako_qipao',
      title: '贵子 · 夜色丝绒东方旗袍',
      rarity: 'SSR',
      charKey: 'takako',
      path: 'dressup/assets/gacha/up-ssr-takako-qipao-wide.webp',
      prompt: '1girl, takako, darksilk qipao, chiaroscuro lighting, half-closed eyes, ultra detailed'
    },
    {
      id: 'cg_takagi_school',
      title: '高木 · 放学后的夕阳回眸',
      rarity: 'SR',
      charKey: 'takagi',
      path: 'dressup/assets/loading/loading_takagi_school.webp',
      prompt: '1girl, takagi, sailor serafuku, golden hour classroom, teasing smirk, tyndall light'
    },
    {
      id: 'cg_shasha_stage',
      title: '莎夏 · 星光街头涂鸦幻想',
      rarity: 'SSR',
      charKey: 'shasha',
      path: 'dressup/assets/loading/loading_shasha.webp',
      prompt: '1girl, shasha, street jacket, cyber neon glow, vibrant expressive, extreme close-up'
    },
    {
      id: 'cg_aili_morning',
      title: '爱莉 · 晨光洋装金发微风',
      rarity: 'SR',
      charKey: 'aili',
      path: 'dressup/assets/loading/loading_mobile_aili.webp',
      prompt: '1girl, airi akizuki, pastel dress, morning sunlight, tsundere blush, soft bokeh'
    },
    {
      id: 'cg_takagi_breeze',
      title: '高木 · 夏日单车树影斑驳',
      rarity: 'SR',
      charKey: 'takagi',
      path: 'dressup/assets/loading/loading_mobile_takagi.webp',
      prompt: '1girl, takagi, summer cardigan, dappled sunlight, gentle gaze, anime keyframe'
    },
    {
      id: 'cg_takako_sunset',
      title: '贵子 · 黄昏天台微醺晚风',
      rarity: 'SR',
      charKey: 'takako',
      path: 'dressup/assets/loading/loading_takako.webp',
      prompt: '1girl, takako, wind blowing hair, sunset rim light, cinematic composition'
    },
    {
      id: 'cg_ch_1',
      title: '序章神图 · 初遇星光十字路口',
      rarity: 'SR',
      charKey: 'aili',
      path: 'dressup/cg/chapters/ch_1.webp',
      prompt: '1girl, cinematic street twilight, tyndall effect, detailed eyes, emotional encounter'
    },
    {
      id: 'cg_ch_11',
      title: '第十一幕 · 咖啡馆午后甜点约会',
      rarity: 'SR',
      charKey: 'aili',
      path: 'dressup/cg/chapters/ch_11.webp',
      prompt: '1girl, cafe terrace, strawberry parfait, warm indoor bokeh, pov hand reaching out'
    },
    {
      id: 'cg_ch_21',
      title: '第二十一幕 · 美术室素描斜阳',
      rarity: 'SSR',
      charKey: 'nagatoro',
      path: 'dressup/cg/chapters/ch_21.webp',
      prompt: '1girl, art club room, sketchbook, golden hour window, playful smirk, rim light'
    },
    {
      id: 'cg_ch_30',
      title: '第三十幕 · 海滨烟火大会告白',
      rarity: 'SSR',
      charKey: 'marin',
      path: 'dressup/cg/chapters/ch_30.webp',
      prompt: '1girl, summer festival yukata, fireworks night sky, watery eyes, romantic lighting'
    },
    {
      id: 'cg_ch_41',
      title: '第四十一幕 · 雨夜霓虹伞下相拥',
      rarity: 'SSR',
      charKey: 'mai',
      path: 'dressup/cg/chapters/ch_41.webp',
      prompt: '1girl, cyber neon rain reflections, transparent umbrella, extreme close-up, blush'
    },
    {
      id: 'cg_ch_51',
      title: '第五十一幕 · 文化祭后夜祭舞台',
      rarity: 'SSR',
      charKey: 'kaguya',
      path: 'dressup/cg/chapters/ch_51.webp',
      prompt: '1girl, stage spotlight, idol frill dress, sparkling confetti, masterpiece 8k'
    },
    {
      id: 'cg_ch_61',
      title: '第六十一幕 · 伦勃朗月光天鹅绒',
      rarity: 'SSR',
      charKey: 'kuroneko',
      path: 'dressup/cg/chapters/ch_61.webp',
      prompt: '1girl, gothic lolita dress, chiaroscuro moonlight, rose petals, mysterious smile'
    },
    {
      id: 'cg_ch_101',
      title: '终章典藏 · 永恒誓约钻石星尘',
      rarity: 'SSR',
      charKey: 'qianhe',
      path: 'dressup/cg/chapters/ch_101.webp',
      prompt: 'masterpiece, best quality, wedding veil light, diamond bokeh, tears of joy, 8k'
    }
  ];

  // =========================================================================
  // 3. 8 种触发式「黄金构图羁绊 (Prompt Synergies / Poker Hands)」
  // =========================================================================
  const PROMPT_SYNERGIES = [
    {
      id: 'masterpiece_ssr',
      tier: 'SSR · 传说',
      name: '传奇神图配方 (Masterpiece SSR)',
      condDesc: '出满 5 张词条卡，同时包含【角色+光影+表情】且无未净化的崩坏卡',
      basePixels: 160,
      baseMult: 14
    },
    {
      id: 'glitch_alchemist',
      tier: 'EX · 逆转',
      name: '赛博故障艺术 (Glitch Transmute)',
      condDesc: '单次出牌包含至少 2 张【崩坏干扰卡】并搭配至少 1 张正向卡',
      basePixels: 125,
      baseMult: 11
    },
    {
      id: 'monochrome_pure',
      tier: 'UR · 纯享',
      name: '同色系纯享流 (Monochrome Aesthetic)',
      condDesc: '打出至少 4 张相同花色类别的词条卡',
      basePixels: 115,
      baseMult: 10
    },
    {
      id: 'dual_axis',
      tier: 'SR+ · 双核',
      name: '双核精修构图 (Dual-Axis Polish)',
      condDesc: '4~5 张牌中包含 2 张同类别 + 另外 2 张同类别（两对构图）',
      basePixels: 85,
      baseMult: 7
    },
    {
      id: 'golden_triad',
      tier: 'SR · 铁三角',
      name: '三维黄金铁三角 (Golden Triad)',
      condDesc: '同时包含【🎨角色穿搭 + ✨光影氛围 + 💖微表情机位】三大类词条',
      basePixels: 95,
      baseMult: 8
    },
    {
      id: 'triple_focus',
      tier: 'R+ · 聚焦',
      name: '三段权重聚焦 (Triple Tag Focus)',
      condDesc: '包含 3 张相同花色类别的词条卡',
      basePixels: 65,
      baseMult: 5
    },
    {
      id: 'tag_pair',
      tier: 'R · 双词',
      name: '双词谐振搭配 (Tag Resonance Pair)',
      condDesc: '包含 2 张相同花色类别的词条卡，或 2 张互补正向卡',
      basePixels: 35,
      baseMult: 3
    },
    {
      id: 'lo_res_sketch',
      tier: 'N · 草图',
      name: '单张散词草图 (Lo-Res Sketch)',
      condDesc: '任意单张散词或未凑成高阶配方的草稿组合',
      basePixels: 15,
      baseMult: 2
    }
  ];

  // =========================================================================
  // 4. 32 张丰富真实的二次元 AI 炼丹词条牌库（分 4 大花色类别）
  // =========================================================================
  const BASE_DECK_CARDS = [
    // 🎨 角色与穿搭卡 (Character & Outfit) - 10 张
    {
      id: 'char_takagi_sailor',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '放学水手服 (高木)',
      enTag: 'takagi, sailor_serafuku',
      pixels: 55,
      mult: 2,
      xMult: 1,
      charKey: 'takagi',
      note: '清纯学院风高像素基底'
    },
    {
      id: 'char_takagi_qipao',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '流光红旗袍 (高木)',
      enTag: 'takagi, red_silk_qipao',
      pixels: 75,
      mult: 4,
      xMult: 1,
      charKey: 'takagi',
      note: '丝绸高光反射 +4 倍率'
    },
    {
      id: 'char_nagatoro_gal',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '素描本与辣妹制服 (长瀞)',
      enTag: 'nagatoro, gyaru_uniform',
      pixels: 62,
      mult: 3,
      xMult: 1,
      charKey: 'nagatoro',
      note: '小麦色活力反差感'
    },
    {
      id: 'char_kaguya_maid',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '文化祭猫耳女仆 (辉夜)',
      enTag: 'kaguya, nekomimi_maid',
      pixels: 68,
      mult: 3,
      xMult: 1,
      charKey: 'kaguya',
      note: '蕾丝荷叶边精细度拉满'
    },
    {
      id: 'char_kuroneko_goth',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '小恶魔哥特礼服 (黑猫)',
      enTag: 'kuroneko, gothic_lolita',
      pixels: 64,
      mult: 4,
      xMult: 1,
      charKey: 'kuroneko',
      note: '暗黑蔷薇十字架细节'
    },
    {
      id: 'char_marin_idol',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '星光舞台打歌服 (海梦)',
      enTag: 'kitagawa_marin, idol_frills',
      pixels: 72,
      mult: 3,
      xMult: 1,
      charKey: 'marin',
      note: '闪片亮钻超高像素量'
    },
    {
      id: 'char_mai_bunny',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '兔女郎夜色丝袜 (麻衣)',
      enTag: 'sakurajima_mai, bunny_suit',
      pixels: 70,
      mult: 4,
      xMult: 1,
      charKey: 'mai',
      note: '黑丝材质次表面散射'
    },
    {
      id: 'char_qianhe_santa',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '圣诞暖冬斗篷 (千鹤)',
      enTag: 'chizuru, santa_velvet_cape',
      pixels: 74,
      mult: 4,
      xMult: 1,
      charKey: 'qianhe',
      note: '天鹅绒白毛领高贵质感'
    },
    {
      id: 'char_aili_twintail',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '金发双马尾洋装 (爱莉)',
      enTag: 'airi_akizuki, ribbon_dress',
      pixels: 66,
      mult: 4,
      xMult: 1,
      charKey: 'aili',
      note: 'Pxlsan 看板娘专属加成'
    },
    {
      id: 'char_shasha_cyber',
      suit: 'char',
      suitLabel: '🎨 角色穿搭',
      zhName: '机能荧光潮服 (莎夏)',
      enTag: 'shasha, cyber_techwear',
      pixels: 68,
      mult: 3,
      xMult: 1,
      charKey: 'shasha',
      note: 'NoobAI 赛博涂鸦特化'
    },

    // ✨ 光影与氛围卡 (Lighting & Mood) - 9 张
    {
      id: 'light_golden_hour',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Golden Hour 黄金夕阳',
      enTag: 'golden_hour, warm_sunset',
      pixels: 35,
      mult: 6,
      xMult: 1,
      charKey: 'takagi',
      note: '琥珀色暖调高倍率渲染'
    },
    {
      id: 'light_tyndall',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Tyndall 丁达尔体积光',
      enTag: 'tyndall_effect, god_rays',
      pixels: 42,
      mult: 6,
      xMult: 1,
      charKey: 'aili',
      note: '空气尘埃神圣光束'
    },
    {
      id: 'light_dappled',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Dappled Sunlight 树影斑驳',
      enTag: 'dappled_sunlight, leaf_shadow',
      pixels: 38,
      mult: 5,
      xMult: 1,
      charKey: 'takako',
      note: '夏日林荫清透光斑'
    },
    {
      id: 'light_cyber_neon',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Cyber Neon 雨夜霓虹',
      enTag: 'cyberpunk_neon, wet_reflections',
      pixels: 45,
      mult: 7,
      xMult: 1,
      charKey: 'mai',
      note: '青粉双色霓虹冷暖对撞'
    },
    {
      id: 'light_rim_glow',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Rim Light 发丝轮廓光',
      enTag: 'backlighting, glowing_hair_rim',
      pixels: 30,
      mult: 5,
      xMult: 1.2,
      charKey: 'qianhe',
      note: '自带 ×1.2 独立美学乘区'
    },
    {
      id: 'light_chiaroscuro',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Chiaroscuro 伦勃朗明暗',
      enTag: 'chiaroscuro, dramatic_shadows',
      pixels: 40,
      mult: 7,
      xMult: 1,
      charKey: 'kuroneko',
      note: '古典油画级戏剧立体感'
    },
    {
      id: 'light_bokeh',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Bokeh 焦外梦幻光斑',
      enTag: 'depth_of_field, hex_bokeh',
      pixels: 36,
      mult: 6,
      xMult: 1,
      charKey: 'marin',
      note: 'f/1.2 大光圈奶油虚化'
    },
    {
      id: 'light_subsurface',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'SSS 肌肤次表面透光',
      enTag: 'subsurface_scattering, soft_skin',
      pixels: 44,
      mult: 5,
      xMult: 1.15,
      charKey: 'takako',
      note: '耳廓指尖通透红润 ×1.15'
    },
    {
      id: 'light_starlight',
      suit: 'light',
      suitLabel: '✨ 光影氛围',
      zhName: 'Starlight 银河星尘微光',
      enTag: 'starry_sky, bioluminescence',
      pixels: 48,
      mult: 6,
      xMult: 1,
      charKey: 'shasha',
      note: '夜空粒子高密细节'
    },

    // 💖 微表情与机位卡 (Expression & Camera) - 8 张
    {
      id: 'expr_teasing_smirk',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Teasing Smirk 捉弄坏笑',
      enTag: 'teasing_smirk, smug_eyes',
      pixels: 30,
      mult: 7,
      xMult: 1.2,
      charKey: 'takagi',
      note: '高木灵魂神态 · ×1.2 倍率'
    },
    {
      id: 'expr_tsundere_blush',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Tsundere Blush 傲娇别过脸',
      enTag: 'looking_away, deep_blush',
      pixels: 32,
      mult: 7,
      xMult: 1,
      charKey: 'aili',
      note: '脸颊绯红心跳过载'
    },
    {
      id: 'expr_half_closed',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Half-closed Eyes 微醺温柔',
      enTag: 'half-closed_eyes, parted_lips',
      pixels: 28,
      mult: 6,
      xMult: 1.25,
      charKey: 'mai',
      note: '迷离眼神杀 · ×1.25 倍率'
    },
    {
      id: 'expr_pov_hand',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'POV Hand 伸手互动视角',
      enTag: 'pov_hands, reaching_towards_viewer',
      pixels: 45,
      mult: 6,
      xMult: 1.15,
      charKey: 'qianhe',
      note: '打破第四面墙沉浸构图'
    },
    {
      id: 'expr_dutch_angle',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Dutch Angle 戏剧斜角机位',
      enTag: 'dutch_angle, dynamic_perspective',
      pixels: 38,
      mult: 6,
      xMult: 1,
      charKey: 'nagatoro',
      note: '极具张力的动画分镜感'
    },
    {
      id: 'expr_extreme_closeup',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Extreme Close-up 眼眸特写',
      enTag: 'extreme_close-up, detailed_iris',
      pixels: 52,
      mult: 5,
      xMult: 1.2,
      charKey: 'kaguya',
      note: '星辰瞳孔反射高精细节'
    },
    {
      id: 'expr_low_angle',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Low Angle 仰视女王气场',
      enTag: 'from_below, dominant_gaze',
      pixels: 40,
      mult: 7,
      xMult: 1,
      charKey: 'kuroneko',
      note: '修长身形比例强化'
    },
    {
      id: 'expr_wink_peace',
      suit: 'expr',
      suitLabel: '💖 表情机位',
      zhName: 'Idol Wink 眨眼比耶营业',
      enTag: 'one_eye_closed, v_sign, joyful',
      pixels: 36,
      mult: 8,
      xMult: 1,
      charKey: 'marin',
      note: '漫展返图人气王动作'
    },

    // ⚠️ 负向崩坏干扰卡 (Glitch Cards) - 5 张
    {
      id: 'glitch_six_fingers',
      suit: 'glitch',
      suitLabel: '⚠️ 崩坏干扰',
      zhName: 'Six Fingers 六指恶魔',
      enTag: 'extra_fingers, mutated_hands',
      pixels: -50,
      mult: -2,
      xMult: 1,
      purifiedPixels: 65,
      purifiedMult: 8,
      purifiedXMult: 1.5,
      charKey: 'shasha',
      note: '默认 -50 像素；若带 ADetailer 或负面净化则 ×1.5 倍率！'
    },
    {
      id: 'glitch_overexposed',
      suit: 'glitch',
      suitLabel: '⚠️ 崩坏干扰',
      zhName: 'Overexposed 高光过曝',
      enTag: 'overexposed, blown_out_highlights',
      pixels: -35,
      mult: -3,
      xMult: 1,
      purifiedPixels: 55,
      purifiedMult: 9,
      purifiedXMult: 1.35,
      charKey: 'takako',
      note: '默认降分；净化后化作圣光过曝美学 ×1.35！'
    },
    {
      id: 'glitch_jpeg_artifacts',
      suit: 'glitch',
      suitLabel: '⚠️ 崩坏干扰',
      zhName: 'JPEG Artifacts 祖传电子包浆',
      enTag: 'jpeg_artifacts, compression_noise',
      pixels: -45,
      mult: -2,
      xMult: 1,
      purifiedPixels: 60,
      purifiedMult: 7,
      purifiedXMult: 1.4,
      charKey: 'nagatoro',
      note: '默认损毁画质；净化后触发复古千禧胶片感 ×1.4！'
    },
    {
      id: 'glitch_bad_anatomy',
      suit: 'glitch',
      suitLabel: '⚠️ 崩坏干扰',
      zhName: 'Bad Anatomy 关节扭曲漂移',
      enTag: 'bad_anatomy, twisted_limbs',
      pixels: -55,
      mult: -3,
      xMult: 1,
      purifiedPixels: 75,
      purifiedMult: 8,
      purifiedXMult: 1.45,
      charKey: 'kaguya',
      note: '默认扣减像素；搭配 ControlNet 或净化转为超现实张力！'
    },
    {
      id: 'glitch_watermark',
      suit: 'glitch',
      suitLabel: '⚠️ 崩坏干扰',
      zhName: 'AI Watermark 顽固乱码水印',
      enTag: 'garbled_text, ugly_signature',
      pixels: -30,
      mult: -2,
      xMult: 1,
      purifiedPixels: 50,
      purifiedMult: 6,
      purifiedXMult: 1.3,
      charKey: 'marin',
      note: '默认降分；净化后化作赛博杂志排版封面字！'
    }
  ];

  // =========================================================================
  // 5. 12 种显卡插件与 LoRA 模块库 (GPU & LoRA Modules / Jokers)
  // =========================================================================
  const JOKER_MODULES_DB = [
    {
      id: 'mod_anima_core',
      name: 'Anima 1.4 喵喵底模',
      cost: 6,
      desc: '每打出一张【💖表情机位卡】，额外触发 +5 美学倍率',
      effectType: 'per_suit_mult',
      targetSuit: 'expr',
      val: 5
    },
    {
      id: 'mod_noobai_xl',
      name: 'NoobAI XL 炼丹引擎',
      cost: 6,
      desc: '每打出一张【🎨角色穿搭卡】，额外注入 +65 基础像素值',
      effectType: 'per_suit_pixels',
      targetSuit: 'char',
      val: 65
    },
    {
      id: 'mod_adetailer',
      name: 'ADetailer 修手神器',
      cost: 7,
      desc: '自动净化所有【⚠️崩坏干扰卡】负面效果，并使每张崩坏卡额外提供 +25 倍率与 ×1.5 暴击！',
      effectType: 'purify_glitch',
      val: 25
    },
    {
      id: 'mod_hires_fix',
      name: 'Hires.fix 2x 高清放大',
      cost: 8,
      desc: '当单次出满 5 张词条卡时，最终总美学倍率额外 ×1.8',
      effectType: 'five_cards_xmult',
      val: 1.8
    },
    {
      id: 'mod_controlnet_pose',
      name: 'ControlNet 骨架锁定',
      cost: 7,
      desc: '不仅净化【⚠️崩坏卡】，且达成【三维黄金铁三角】或【SSR配方】时额外 ×1.5 倍率',
      effectType: 'triad_xmult_and_purify',
      val: 1.5
    },
    {
      id: 'mod_ray_tracing',
      name: 'RTX 光追全局照明',
      cost: 6,
      desc: '每打出一张【✨光影氛围卡】，额外 +45 像素值与 +4 美学倍率',
      effectType: 'per_light_hybrid',
      valPixels: 45,
      valMult: 4
    },
    {
      id: 'mod_cfg_stabilizer',
      name: 'CFG 7.0 黄金稳定器',
      cost: 5,
      desc: '任何出牌无条件提供 +12 固定美学倍率基底',
      effectType: 'flat_mult',
      val: 12
    },
    {
      id: 'mod_dpm_karras',
      name: 'DPM++ 2M Karras 采样器',
      cost: 5,
      desc: '任何出牌无条件提供 +110 固定基础像素值',
      effectType: 'flat_pixels',
      val: 110
    },
    {
      id: 'mod_lazypos_v2',
      name: 'LazyPos V2 质量词嵌入',
      cost: 7,
      desc: '打出的第一张词条卡结算后，总美学倍率立即 ×1.35',
      effectType: 'global_xmult',
      val: 1.35
    },
    {
      id: 'mod_vram_cooler',
      name: '液氮显存超频冷头',
      cost: 8,
      desc: '每剩余 1 次未使用的重抽弃牌 (Reroll)，结算时总倍率 +6',
      effectType: 'reroll_scaling_mult',
      val: 6
    },
    {
      id: 'mod_lora_stack',
      name: '多角色 LoRA 融合器',
      cost: 7,
      desc: '若单手打出 ≥2 张【🎨角色穿搭卡】，总美学倍率 ×1.6',
      effectType: 'multi_char_xmult',
      val: 1.6
    },
    {
      id: 'mod_vram_miner',
      name: '闲置算力挖矿脚本',
      cost: 5,
      desc: '每次通关结算时额外获得 +¥5 炼丹算力币，且结算倍率 +6',
      effectType: 'economy_mult',
      val: 6,
      bonusGold: 5
    }
  ];

  // =========================================================================
  // 6. 9 关递进委托盲注体系 (3 幕 × 每幕 3 关 + 无尽超频模式)
  // =========================================================================
  const BLIND_STAGES = [
    // 第一幕：同人社团起步
    {
      stageIndex: 1,
      act: 1,
      type: '普通委托',
      isBoss: false,
      title: '1-1 · 校园漫研社招新传单',
      ruleDesc: '标准显存环境：熟悉角色、光影与微表情词条搭配',
      targetScore: 550,
      rewardGold: 6,
      bossRule: null
    },
    {
      stageIndex: 2,
      act: 1,
      type: '进阶委托',
      isBoss: false,
      title: '1-2 · 轻小说插画试稿委托',
      ruleDesc: '甲方要求层次感：所有【✨光影氛围卡】基础像素额外 +20',
      targetScore: 950,
      rewardGold: 7,
      bossRule: 'light_bonus_pixels'
    },
    {
      stageIndex: 3,
      act: 1,
      type: 'BOSS 委托',
      isBoss: true,
      title: '1-3 · 【BOSS】4GB 显存捉襟见肘',
      ruleDesc: '⚠️ 显存限制：每手最多只能选择 4 张词条卡进行生成！',
      targetScore: 1500,
      rewardGold: 10,
      bossRule: 'max_4_cards'
    },

    // 第二幕：人气画师崛起
    {
      stageIndex: 4,
      act: 2,
      type: '普通委托',
      isBoss: false,
      title: '2-1 · 逆光夕阳特别企划',
      ruleDesc: '✨ 逆光特辑：所有【光影氛围卡】提供的美学倍率 ×1.5！',
      targetScore: 2400,
      rewardGold: 8,
      bossRule: 'light_mult_1_5'
    },
    {
      stageIndex: 5,
      act: 2,
      type: '进阶委托',
      isBoss: false,
      title: '2-2 · 看板娘冬日换装贺图',
      ruleDesc: '🎨 角色特写：所有【角色穿搭卡】额外提供 +4 美学倍率',
      targetScore: 3600,
      rewardGold: 9,
      bossRule: 'char_bonus_mult'
    },
    {
      stageIndex: 6,
      act: 2,
      type: 'BOSS 委托',
      isBoss: true,
      title: '2-3 · 【BOSS】六指恶魔的诅咒',
      ruleDesc: '⚠️ 算力污染：开局往牌堆额外混入 3 张【六指恶魔】崩坏卡（可用 ADetailer 逆转为暴击）！',
      targetScore: 5200,
      rewardGold: 12,
      bossRule: 'inject_glitches'
    },

    // 第三幕：コミケ传奇摊主
    {
      stageIndex: 7,
      act: 3,
      type: '高难委托',
      isBoss: false,
      title: '3-1 · 赛博霓虹痛车巨幅彩绘',
      ruleDesc: '💖 构图狂热：【三维黄金铁三角】与【SSR配方】基础倍率额外 +6',
      targetScore: 7800,
      rewardGold: 10,
      bossRule: 'triad_boost'
    },
    {
      stageIndex: 8,
      act: 3,
      type: '高难委托',
      isBoss: false,
      title: '3-2 · 旗舰画集金箔典藏封面',
      ruleDesc: '⚡ 高清严苛：所有词条卡基础像素 +25，但目标画质分大幅飙升',
      targetScore: 11500,
      rewardGold: 12,
      bossRule: 'all_pixels_25'
    },
    {
      stageIndex: 9,
      act: 3,
      type: '终极 BOSS',
      isBoss: true,
      title: '3-3 · 【终极BOSS】夏日漫展压轴神图审阅',
      ruleDesc: '🔥 甲方终审：单张散词草图倍率减半，必须依靠高阶羁绊与 LoRA 插件引爆算力！',
      targetScore: 17500,
      rewardGold: 18,
      bossRule: 'final_boss_audit'
    }
  ];

  // =========================================================================
  // 7. 持久化存档与本局状态管理
  // =========================================================================
  function loadArchive() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          unlockedCgs: Array.isArray(parsed.unlockedCgs) ? parsed.unlockedCgs : ['cg_takagi_school'],
          bestHandScore: Number(parsed.bestHandScore) || 0,
          bestStageCleared: Number(parsed.bestStageCleared) || 0,
          totalRunsWon: Number(parsed.totalRunsWon) || 0,
          crtEnabled: parsed.crtEnabled !== false,
          soundEnabled: parsed.soundEnabled !== false
        };
      }
    } catch (_) {}
    return {
      unlockedCgs: ['cg_takagi_school'],
      bestHandScore: 0,
      bestStageCleared: 0,
      totalRunsWon: 0,
      crtEnabled: true,
      soundEnabled: true
    };
  }

  function saveArchive() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
    } catch (_) {}
  }

  const archive = loadArchive();

  // 当前肉鸽周目状态
  const state = {
    stageIndex: 1, // 1..9, >9 为无尽模式
    endlessWave: 0,
    currentScore: 0,
    targetScore: 550,
    rendersLeft: 4,
    rerollsLeft: 3,
    credits: 10,
    isAnimating: false,
    deck: [],
    drawPile: [],
    hand: [],
    selectedInstanceIds: new Set(),
    modules: [],
    synergyLevels: {},
    shopModules: [],
    shopUpgrades: [],
    currentCg: CG_GALLERY_DB[5],
    runBestHand: 0
  };

  // =========================================================================
  // 8. DOM 引用缓存与初始化
  // =========================================================================
  const dom = {};

  function cacheDom() {
    dom.stage = document.getElementById('alchemistStage');
    dom.actBadge = document.getElementById('actBadge');
    dom.blindCard = document.getElementById('blindCard');
    dom.blindTypeBadge = document.getElementById('blindTypeBadge');
    dom.blindTitle = document.getElementById('blindTitle');
    dom.blindRuleDesc = document.getElementById('blindRuleDesc');
    dom.targetScoreDisplay = document.getElementById('targetScoreDisplay');
    dom.scoreProgressBar = document.getElementById('scoreProgressBar');
    dom.currentScoreDisplay = document.getElementById('currentScoreDisplay');

    dom.synergyTierBadge = document.getElementById('synergyTierBadge');
    dom.synergyNameDisplay = document.getElementById('synergyNameDisplay');
    dom.synergyLevelDisplay = document.getElementById('synergyLevelDisplay');
    dom.pixelsWell = document.getElementById('pixelsWell');
    dom.multWell = document.getElementById('multWell');
    dom.basePixelsDisplay = document.getElementById('basePixelsDisplay');
    dom.aestheticMultDisplay = document.getElementById('aestheticMultDisplay');
    dom.previewTotalNumber = document.getElementById('previewTotalNumber');

    dom.rendersLeftDisplay = document.getElementById('rendersLeftDisplay');
    dom.rerollsLeftDisplay = document.getElementById('rerollsLeftDisplay');
    dom.creditsDisplay = document.getElementById('creditsDisplay');
    dom.deckCountDisplay = document.getElementById('deckCountDisplay');
    dom.gpuTempText = document.getElementById('gpuTempText');
    dom.gpuTempFill = document.getElementById('gpuTempFill');
    dom.renderLog = document.getElementById('renderLog');

    dom.moduleSlotCount = document.getElementById('moduleSlotCount');
    dom.jokerSlotsRow = document.getElementById('jokerSlotsRow');
    dom.handLimitHint = document.getElementById('handLimitHint');
    dom.stagedCardsRow = document.getElementById('stagedCardsRow');
    dom.floatingPopupsLayer = document.getElementById('floatingPopupsLayer');

    dom.handCountText = document.getElementById('handCountText');
    dom.holoHandRow = document.getElementById('holoHandRow');
    dom.btnDiscard = document.getElementById('btnDiscard');
    dom.btnPlayHand = document.getElementById('btnPlayHand');

    dom.monitorRarityBadge = document.getElementById('monitorRarityBadge');
    dom.crtScreenFrame = document.getElementById('crtScreenFrame');
    dom.monitorCgImage = document.getElementById('monitorCgImage');
    dom.ssrFlashBurst = document.getElementById('ssrFlashBurst');
    dom.monitorCgTitle = document.getElementById('monitorCgTitle');
    dom.monitorScoreChip = document.getElementById('monitorScoreChip');
    dom.monitorPromptText = document.getElementById('monitorPromptText');
    dom.synergyMiniList = document.getElementById('synergyMiniList');

    dom.galleryCountBadge = document.getElementById('galleryCountBadge');
    dom.shopModal = document.getElementById('shopModal');
    dom.shopCreditsDisplay = document.getElementById('shopCreditsDisplay');
    dom.shopRewardSummary = document.getElementById('shopRewardSummary');
    dom.shopModulesList = document.getElementById('shopModulesList');
    dom.shopUpgradesList = document.getElementById('shopUpgradesList');

    dom.galleryModal = document.getElementById('galleryModal');
    dom.galleryProgressText = document.getElementById('galleryProgressText');
    dom.galleryGrid = document.getElementById('galleryGrid');

    dom.cgLightboxModal = document.getElementById('cgLightboxModal');
    dom.lightboxRarityTag = document.getElementById('lightboxRarityTag');
    dom.lightboxTitle = document.getElementById('lightboxTitle');
    dom.lightboxImage = document.getElementById('lightboxImage');
    dom.lightboxPromptCode = document.getElementById('lightboxPromptCode');
    dom.lightboxUnlockInfo = document.getElementById('lightboxUnlockInfo');

    dom.rulesModal = document.getElementById('rulesModal');
    dom.rulesSynergyTbody = document.getElementById('rulesSynergyTbody');

    dom.runEndModal = document.getElementById('runEndModal');
    dom.runEndTag = document.getElementById('runEndTag');
    dom.runEndTitle = document.getElementById('runEndTitle');
    dom.runEndDesc = document.getElementById('runEndDesc');
    dom.runStatsGrid = document.getElementById('runStatsGrid');
    dom.btnEndlessMode = document.getElementById('btnEndlessMode');
  }

  // =========================================================================
  // 9. 核心辅助函数与羁绊识别引擎
  // =========================================================================
  function getStageConfig() {
    if (state.stageIndex <= BLIND_STAGES.length) {
      return BLIND_STAGES[state.stageIndex - 1];
    }
    const extra = state.stageIndex - BLIND_STAGES.length;
    return {
      stageIndex: state.stageIndex,
      act: 4,
      type: '♾️ 无尽超频',
      isBoss: extra % 2 === 0,
      title: `无尽超频 Wave ${extra} · 算力极限压测`,
      ruleDesc: '🔥 显存超频环境：目标画质指数级攀升，检验终极炼丹构筑！',
      targetScore: Math.round(17500 * Math.pow(1.55, extra)),
      rewardGold: 14,
      bossRule: extra % 2 === 0 ? 'inject_glitches' : 'light_mult_1_5'
    };
  }

  function getMaxPlayableCards() {
    const cfg = getStageConfig();
    return cfg.bossRule === 'max_4_cards' ? 4 : MAX_PLAY_CARDS;
  }

  function hasGlitchPurifier() {
    return state.modules.some(
      (m) => m.effectType === 'purify_glitch' || m.effectType === 'triad_xmult_and_purify'
    );
  }

  function cloneDeckFromBase() {
    let uid = 1;
    return BASE_DECK_CARDS.map((card) => ({
      ...card,
      instanceId: `card_${uid++}_${card.id}`,
      weight: 1.0
    }));
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function appendLog(text, styleClass = '') {
    if (!dom.renderLog) return;
    const div = document.createElement('div');
    div.className = `log-entry ${styleClass}`.trim();
    div.textContent = text;
    dom.renderLog.prepend(div);
    while (dom.renderLog.children.length > 18) {
      dom.renderLog.removeChild(dom.renderLog.lastChild);
    }
  }

  // 评估所选卡牌触发的最高阶「黄金构图羁绊」
  function evaluatePromptSynergy(selectedCards) {
    if (!selectedCards || selectedCards.length === 0) {
      return null;
    }

    const suitCounts = { char: 0, light: 0, expr: 0, glitch: 0 };
    selectedCards.forEach((c) => {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    });

    const purified = hasGlitchPurifier();
    const hasUnpurifiedGlitch = suitCounts.glitch > 0 && !purified;
    const hasTriad = suitCounts.char >= 1 && suitCounts.light >= 1 && suitCounts.expr >= 1;
    const maxSameSuit = Math.max(suitCounts.char, suitCounts.light, suitCounts.expr, suitCounts.glitch);
    const pairCount = Object.values(suitCounts).filter((cnt) => cnt >= 2).length;

    let matched = PROMPT_SYNERGIES[PROMPT_SYNERGIES.length - 1]; // 默认草图

    if (selectedCards.length === 5 && hasTriad && !hasUnpurifiedGlitch) {
      matched = PROMPT_SYNERGIES[0]; // Masterpiece SSR
    } else if (suitCounts.glitch >= 2 && selectedCards.length >= 3) {
      matched = PROMPT_SYNERGIES[1]; // Glitch Transmute
    } else if (maxSameSuit >= 4) {
      matched = PROMPT_SYNERGIES[2]; // Monochrome Aesthetic
    } else if (hasTriad) {
      matched = PROMPT_SYNERGIES[4]; // Golden Triad
    } else if (pairCount >= 2) {
      matched = PROMPT_SYNERGIES[3]; // Dual-Axis Polish
    } else if (maxSameSuit === 3) {
      matched = PROMPT_SYNERGIES[5]; // Triple Tag Focus
    } else if (maxSameSuit === 2 || (selectedCards.length >= 2 && !hasUnpurifiedGlitch)) {
      matched = PROMPT_SYNERGIES[6]; // Tag Resonance Pair
    }

    const level = state.synergyLevels[matched.id] || 1;
    const cfg = getStageConfig();
    let bonusPixels = (level - 1) * 25;
    let bonusMult = (level - 1) * 2;

    if (cfg.bossRule === 'triad_boost' && (matched.id === 'golden_triad' || matched.id === 'masterpiece_ssr')) {
      bonusMult += 6;
    }

    let basePixels = matched.basePixels + bonusPixels;
    let baseMult = matched.baseMult + bonusMult;

    if (cfg.bossRule === 'final_boss_audit' && matched.id === 'lo_res_sketch') {
      baseMult = Math.max(1, Math.floor(baseMult / 2));
    }

    return {
      ...matched,
      level,
      computedPixels: basePixels,
      computedMult: baseMult
    };
  }

  // 计算单张卡在当前场地的实际贡献
  function computeCardContribution(card) {
    const cfg = getStageConfig();
    const purified = hasGlitchPurifier() || card.weight > 1.05;
    const weightMult = card.weight || 1.0;

    if (card.suit === 'glitch') {
      if (purified) {
        return {
          pixels: Math.round((card.purifiedPixels || 60) * weightMult),
          mult: Math.round((card.purifiedMult || 8) * weightMult),
          xMult: card.purifiedXMult || 1.4,
          wasPurified: true
        };
      }
      return {
        pixels: card.pixels,
        mult: card.mult,
        xMult: 1,
        wasPurified: false
      };
    }

    let pix = Math.round(card.pixels * weightMult);
    let mult = Math.round(card.mult * weightMult);
    let xMult = card.xMult || 1;

    if (cfg.bossRule === 'light_bonus_pixels' && card.suit === 'light') {
      pix += 20;
    }
    if (cfg.bossRule === 'all_pixels_25') {
      pix += 25;
    }
    if (cfg.bossRule === 'char_bonus_mult' && card.suit === 'char') {
      mult += 4;
    }
    if (cfg.bossRule === 'light_mult_1_5' && card.suit === 'light') {
      mult = Math.round(mult * 1.5);
    }

    return { pixels: pix, mult, xMult, wasPurified: false };
  }

  // 静态预览当前选中手牌的预计得分
  function calculatePreviewScore(selectedCards) {
    const syn = evaluatePromptSynergy(selectedCards);
    if (!syn) {
      return { pixels: 0, mult: 0, total: 0, synergy: null };
    }

    let pixels = syn.computedPixels;
    let mult = syn.computedMult;

    selectedCards.forEach((card) => {
      const c = computeCardContribution(card);
      pixels = Math.max(5, pixels + c.pixels);
      mult = Math.max(1, mult + c.mult);
      if (c.xMult && c.xMult !== 1) {
        mult = Math.round(mult * c.xMult * 10) / 10;
      }
    });

    // 插件加成预览
    const suitCounts = { char: 0, light: 0, expr: 0, glitch: 0 };
    selectedCards.forEach((c) => {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    });

    state.modules.forEach((mod) => {
      if (mod.effectType === 'per_suit_mult') {
        mult += (suitCounts[mod.targetSuit] || 0) * mod.val;
      } else if (mod.effectType === 'per_suit_pixels') {
        pixels += (suitCounts[mod.targetSuit] || 0) * mod.val;
      } else if (mod.effectType === 'purify_glitch' && suitCounts.glitch > 0) {
        mult += suitCounts.glitch * mod.val;
      } else if (mod.effectType === 'per_light_hybrid' && suitCounts.light > 0) {
        pixels += suitCounts.light * mod.valPixels;
        mult += suitCounts.light * mod.valMult;
      } else if (mod.effectType === 'flat_mult') {
        mult += mod.val;
      } else if (mod.effectType === 'flat_pixels') {
        pixels += mod.val;
      } else if (mod.effectType === 'reroll_scaling_mult') {
        mult += state.rerollsLeft * mod.val;
      } else if (mod.effectType === 'economy_mult') {
        mult += mod.val;
      } else if (mod.effectType === 'global_xmult') {
        mult = Math.round(mult * mod.val * 10) / 10;
      } else if (mod.effectType === 'five_cards_xmult' && selectedCards.length === 5) {
        mult = Math.round(mult * mod.val * 10) / 10;
      } else if (
        mod.effectType === 'triad_xmult_and_purify' &&
        (syn.id === 'golden_triad' || syn.id === 'masterpiece_ssr')
      ) {
        mult = Math.round(mult * mod.val * 10) / 10;
      } else if (mod.effectType === 'multi_char_xmult' && suitCounts.char >= 2) {
        mult = Math.round(mult * mod.val * 10) / 10;
      }
    });

    const total = Math.round(pixels * mult);
    return {
      pixels: Math.round(pixels),
      mult: Math.round(mult * 10) / 10,
      total,
      synergy: syn
    };
  }

  // =========================================================================
  // 10. 3D 全息镭射闪卡悬浮倾斜绑定 (rotateX / rotateY + 动态全息反光)
  // =========================================================================
  function bindHoloCardTilt(cardEl) {
    const handleMove = (clientX, clientY) => {
      const rect = cardEl.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const px = Math.max(0, Math.min(1, x / rect.width));
      const py = Math.max(0, Math.min(1, y / rect.height));

      const rotateY = (px - 0.5) * 22;
      const rotateX = (0.5 - py) * 20;

      cardEl.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`);
      cardEl.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`);
      cardEl.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
      cardEl.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
    };

    cardEl.addEventListener('pointermove', (e) => {
      handleMove(e.clientX, e.clientY);
    });

    cardEl.addEventListener('pointerleave', () => {
      cardEl.style.setProperty('--rx', '0deg');
      cardEl.style.setProperty('--ry', '0deg');
      cardEl.style.setProperty('--glare-x', '50%');
      cardEl.style.setProperty('--glare-y', '50%');
    });
  }

  // =========================================================================
  // 11. UI 渲染与联动刷新
  // =========================================================================
  function getSelectedCardsInOrder() {
    return state.hand.filter((c) => state.selectedInstanceIds.has(c.instanceId));
  }

  function renderAll() {
    const cfg = getStageConfig();
    state.targetScore = cfg.targetScore;

    // 盲注面板
    dom.actBadge.textContent =
      state.stageIndex <= 9 ? `ACT ${cfg.act} · 委托 ${state.stageIndex}/9` : `ENDLESS · WAVE ${state.stageIndex - 9}`;
    dom.blindTypeBadge.textContent = cfg.type;
    dom.blindCard.classList.toggle('boss-blind', !!cfg.isBoss);
    dom.blindTitle.textContent = cfg.title;
    dom.blindRuleDesc.textContent = cfg.ruleDesc;
    dom.targetScoreDisplay.textContent = state.targetScore.toLocaleString();
    dom.currentScoreDisplay.textContent = state.currentScore.toLocaleString();

    const pct = Math.min(100, Math.round((state.currentScore / state.targetScore) * 100));
    dom.scoreProgressBar.style.width = `${pct}%`;

    // 状态四宫格
    dom.rendersLeftDisplay.textContent = String(state.rendersLeft);
    dom.rerollsLeftDisplay.textContent = String(state.rerollsLeft);
    dom.creditsDisplay.textContent = `¥${state.credits}`;
    dom.deckCountDisplay.textContent = `${state.drawPile.length}/${state.deck.length}`;
    dom.galleryCountBadge.textContent = `${archive.unlockedCgs.length}/${CG_GALLERY_DB.length}`;

    // 顶部插件架
    renderJokerSlots();

    // 选中牌与羁绊算分预览
    const selected = getSelectedCardsInOrder();
    const maxPlay = getMaxPlayableCards();
    dom.handLimitHint.textContent = `已选 ${selected.length} / ${maxPlay} 张词条卡`;

    const preview = calculatePreviewScore(selected);
    if (!state.isAnimating) {
      if (preview.synergy) {
        dom.synergyTierBadge.textContent = preview.synergy.tier;
        dom.synergyNameDisplay.textContent = preview.synergy.name;
        dom.synergyLevelDisplay.textContent = `Lv.${preview.synergy.level}`;
        dom.basePixelsDisplay.textContent = String(preview.pixels);
        dom.aestheticMultDisplay.textContent = String(preview.mult);
        dom.previewTotalNumber.textContent = preview.total.toLocaleString();
      } else {
        dom.synergyTierBadge.textContent = 'READY';
        dom.synergyNameDisplay.textContent = `请选择 1~${maxPlay} 张词条卡`;
        dom.synergyLevelDisplay.textContent = 'Lv.1';
        dom.basePixelsDisplay.textContent = '0';
        dom.aestheticMultDisplay.textContent = '0';
        dom.previewTotalNumber.textContent = '0';
      }
      renderStagedCards(selected);
    }

    // 渲染手牌与羁绊速查表
    renderHandCards();
    renderSynergyQuickList(preview.synergy ? preview.synergy.id : null);

    // 按钮启停状态
    dom.btnPlayHand.disabled = state.isAnimating || selected.length === 0 || state.rendersLeft <= 0;
    dom.btnDiscard.disabled = state.isAnimating || selected.length === 0 || state.rerollsLeft <= 0;
  }

  function renderJokerSlots() {
    dom.moduleSlotCount.textContent = `${state.modules.length} / ${MAX_MODULES}`;
    dom.jokerSlotsRow.innerHTML = '';

    for (let i = 0; i < MAX_MODULES; i++) {
      const mod = state.modules[i];
      const cell = document.createElement('div');
      if (mod) {
        cell.className = 'joker-chip-card';
        cell.dataset.modIndex = String(i);
        cell.innerHTML = `
          <div class="joker-top-line">
            <span class="joker-name">${mod.name}</span>
            <button type="button" class="joker-sell-btn" data-sell-idx="${i}" title="卸载并回收 ¥3 算力币">卸载+¥3</button>
          </div>
          <p class="joker-desc">${mod.desc}</p>
        `;
      } else {
        cell.className = 'joker-chip-card empty-slot';
        cell.textContent = `[插槽 ${i + 1} · 空闲]`;
      }
      dom.jokerSlotsRow.appendChild(cell);
    }

    dom.jokerSlotsRow.querySelectorAll('[data-sell-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.isAnimating) return;
        const idx = Number(btn.getAttribute('data-sell-idx'));
        const removed = state.modules.splice(idx, 1)[0];
        if (removed) {
          state.credits += 3;
          sfx.playCash();
          appendLog(`[卸载] 已移除插件「${removed.name}」，回收 ¥3 算力币。`);
          renderAll();
        }
      });
    });
  }

  function renderStagedCards(selectedCards) {
    dom.stagedCardsRow.innerHTML = '';
    if (selectedCards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-stage-placeholder';
      empty.innerHTML = `
        <div class="placeholder-icon">✨</div>
        <p>从下方手牌点击选择 <strong>1 ~ ${getMaxPlayableCards()} 张 Prompt 词条卡</strong>，点击【⚡ 开始生成 (RENDER)】引爆连锁倍率！</p>
        <small>凑齐「🎨角色穿搭 + ✨光影氛围 + 💖微表情机位」即可激活【三维黄金铁三角】高倍暴击</small>
      `;
      dom.stagedCardsRow.appendChild(empty);
      return;
    }

    selectedCards.forEach((card) => {
      const contrib = computeCardContribution(card);
      const el = document.createElement('div');
      el.className = `staged-mini-card suit-${card.suit}`;
      el.dataset.stagedId = card.instanceId;
      const weightText = card.weight > 1.01 ? `(${card.enTag.split(',')[0]}:${card.weight.toFixed(1)})` : card.enTag;
      el.innerHTML = `
        <div class="card-top-meta">
          <span class="card-suit-badge">${card.suitLabel}</span>
          ${card.weight > 1.01 ? `<span class="card-weight-badge">:${card.weight.toFixed(1)}</span>` : ''}
        </div>
        <div class="card-center-body">
          <div class="card-zh-name">${card.zhName}</div>
          <span class="card-en-tag">${weightText}</span>
        </div>
        <div class="card-bottom-stats">
          <span class="stat-pix">${contrib.pixels >= 0 ? '+' : ''}${contrib.pixels}Px</span>
          <span class="stat-mult">${contrib.mult >= 0 ? '+' : ''}${contrib.mult}M</span>
          ${contrib.xMult > 1 ? `<span class="stat-xmult">×${contrib.xMult}</span>` : ''}
        </div>
      `;
      dom.stagedCardsRow.appendChild(el);
    });
  }

  function renderHandCards() {
    dom.handCountText.textContent = `${state.hand.length}/${HAND_SIZE}`;
    dom.holoHandRow.innerHTML = '';

    state.hand.forEach((card) => {
      const isSelected = state.selectedInstanceIds.has(card.instanceId);
      const contrib = computeCardContribution(card);

      const cardEl = document.createElement('div');
      cardEl.className = `holo-tag-card suit-${card.suit}${isSelected ? ' selected' : ''}`;
      cardEl.dataset.instanceId = card.instanceId;

      cardEl.innerHTML = `
        <div class="card-top-meta">
          <span class="card-suit-badge">${card.suitLabel}</span>
          <span class="card-weight-badge">${
            card.suit === 'glitch' && contrib.wasPurified
              ? '✨已净化'
              : `w:${(card.weight || 1.0).toFixed(1)}`
          }</span>
        </div>
        <div class="card-center-body">
          <div class="card-zh-name">${card.zhName}</div>
          <span class="card-en-tag">${card.enTag}</span>
          <p class="card-special-note">${card.note}</p>
        </div>
        <div class="card-bottom-stats">
          <span class="stat-pix">${contrib.pixels >= 0 ? '+' : ''}${contrib.pixels} Px</span>
          <span class="stat-mult">${contrib.mult >= 0 ? '+' : ''}${contrib.mult} Mult</span>
          ${contrib.xMult > 1 ? `<span class="stat-xmult">×${contrib.xMult}</span>` : ''}
        </div>
      `;

      bindHoloCardTilt(cardEl);

      cardEl.addEventListener('click', () => {
        if (state.isAnimating) return;
        const maxPlay = getMaxPlayableCards();
        if (state.selectedInstanceIds.has(card.instanceId)) {
          state.selectedInstanceIds.delete(card.instanceId);
          sfx.playClick(false);
        } else {
          if (state.selectedInstanceIds.size >= maxPlay) {
            sfx.playGlitchBuzz();
            appendLog(`[限制] 当前委托单次最多只能选择 ${maxPlay} 张词条卡！`, 'warn');
            return;
          }
          state.selectedInstanceIds.add(card.instanceId);
          sfx.playClick(true);
        }
        renderAll();
      });

      dom.holoHandRow.appendChild(cardEl);
    });
  }

  function renderSynergyQuickList(activeSynergyId) {
    dom.synergyMiniList.innerHTML = '';
    PROMPT_SYNERGIES.forEach((syn) => {
      const lv = state.synergyLevels[syn.id] || 1;
      const pix = syn.basePixels + (lv - 1) * 25;
      const mult = syn.baseMult + (lv - 1) * 2;
      const li = document.createElement('li');
      li.className = `synergy-mini-item${syn.id === activeSynergyId ? ' active-match' : ''}`;
      li.innerHTML = `
        <div class="syn-item-left">
          <span class="syn-item-title">${syn.name} <small style="color:#00f0ff">Lv.${lv}</small></span>
          <span class="syn-item-cond">${syn.condDesc}</span>
        </div>
        <span class="syn-item-formula">${pix} × ${mult}</span>
      `;
      dom.synergyMiniList.appendChild(li);
    });
  }

  // =========================================================================
  // 12. Balatro 式连锁跳字结算与 CRT 显像管神图揭晓
  // =========================================================================
  function spawnFloatingPopup(text, typeClass, anchorEl) {
    if (!dom.floatingPopupsLayer) return;
    const chip = document.createElement('div');
    chip.className = `score-pop-chip ${typeClass}`;
    chip.textContent = text;

    let leftPct = 50 + (Math.random() * 24 - 12);
    let topPct = 52 + (Math.random() * 16 - 8);

    if (anchorEl && dom.stagedCardsRow) {
      const parentRect = dom.stagedCardsRow.getBoundingClientRect();
      const rect = anchorEl.getBoundingClientRect();
      if (parentRect.width > 0) {
        leftPct = ((rect.left + rect.width / 2 - parentRect.left) / parentRect.width) * 100;
      }
    }

    chip.style.left = `${Math.max(12, Math.min(88, leftPct))}%`;
    chip.style.top = `${topPct}%`;
    dom.floatingPopupsLayer.appendChild(chip);

    setTimeout(() => {
      chip.remove();
    }, 880);
  }

  function triggerStageShake(heavy = false) {
    if (!dom.stage) return;
    const cls = heavy ? 'shake-heavy' : 'shake-light';
    dom.stage.classList.remove('shake-light', 'shake-heavy');
    void dom.stage.offsetWidth;
    dom.stage.classList.add(cls);
  }

  function bumpWell(wellEl) {
    if (!wellEl) return;
    wellEl.classList.remove('bump');
    void wellEl.offsetWidth;
    wellEl.classList.add('bump');
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 根据打出的角色词条与得分匹配最契合的本地 .webp 高清 CG
  function selectMatchingCg(selectedCards, handScore, synergy) {
    const charCard = selectedCards.find((c) => c.suit === 'char' && c.charKey);
    const preferredChar = charCard ? charCard.charKey : null;
    const wantSsr = handScore >= 1200 || synergy.id === 'masterpiece_ssr' || synergy.id === 'golden_triad';

    let pool = CG_GALLERY_DB.filter((cg) => {
      if (preferredChar && cg.charKey === preferredChar) return true;
      return false;
    });

    if (pool.length === 0) {
      pool = wantSsr ? CG_GALLERY_DB.filter((cg) => cg.rarity === 'SSR') : CG_GALLERY_DB;
    }

    // 优先挑选尚未解锁的 CG，助玩家爽快收集图鉴
    const lockedInPool = pool.filter((cg) => !archive.unlockedCgs.includes(cg.id));
    const chosen =
      lockedInPool.length > 0
        ? lockedInPool[Math.floor(Math.random() * lockedInPool.length)]
        : pool[Math.floor(Math.random() * pool.length)];

    return chosen || CG_GALLERY_DB[0];
  }

  async function playSelectedHand() {
    const selected = getSelectedCardsInOrder();
    if (state.isAnimating || selected.length === 0 || state.rendersLeft <= 0) return;

    state.isAnimating = true;
    state.rendersLeft -= 1;
    renderStagedCards(selected);

    const syn = evaluatePromptSynergy(selected);
    let runningPixels = syn.computedPixels;
    let runningMult = syn.computedMult;

    dom.synergyTierBadge.textContent = syn.tier;
    dom.synergyNameDisplay.textContent = syn.name;
    dom.synergyLevelDisplay.textContent = `Lv.${syn.level}`;
    dom.basePixelsDisplay.textContent = String(runningPixels);
    dom.aestheticMultDisplay.textContent = String(runningMult);

    // CRT 监视器进入显卡采样去噪扫描态
    dom.crtScreenFrame.classList.add('denoising');
    dom.gpuTempText.textContent = '79°C · 算力爆发中';
    dom.gpuTempFill.style.width = '88%';

    let chainStep = 0;

    // 1. 依次弹跳结算每张选中的 Prompt 词条卡
    for (let i = 0; i < selected.length; i++) {
      const card = selected[i];
      const contrib = computeCardContribution(card);
      const stagedEl = dom.stagedCardsRow.querySelector(`[data-staged-id="${card.instanceId}"]`);

      if (stagedEl) {
        stagedEl.classList.add('scoring-pulse');
      }

      await sleep(160);

      // 结算基础像素
      runningPixels = Math.max(5, runningPixels + contrib.pixels);
      dom.basePixelsDisplay.textContent = String(Math.round(runningPixels));
      bumpWell(dom.pixelsWell);

      if (card.suit === 'glitch' && !contrib.wasPurified) {
        sfx.playGlitchBuzz();
        spawnFloatingPopup(`${contrib.pixels} Px (崩坏!)`, 'type-mult', stagedEl);
      } else {
        sfx.playChainDing(chainStep++, false);
        spawnFloatingPopup(`+${contrib.pixels} Px`, 'type-pixels', stagedEl);
      }

      triggerStageShake(false);
      await sleep(150);

      // 结算倍率
      if (contrib.mult !== 0) {
        runningMult = Math.max(1, runningMult + contrib.mult);
        dom.aestheticMultDisplay.textContent = String(Math.round(runningMult * 10) / 10);
        bumpWell(dom.multWell);
        sfx.playChainDing(chainStep++, false);
        spawnFloatingPopup(`${contrib.mult >= 0 ? '+' : ''}${contrib.mult} Mult`, 'type-mult', stagedEl);
        await sleep(130);
      }

      // 结算独立乘区 xMult
      if (contrib.xMult && contrib.xMult !== 1) {
        runningMult = Math.round(runningMult * contrib.xMult * 10) / 10;
        dom.aestheticMultDisplay.textContent = String(runningMult);
        bumpWell(dom.multWell);
        sfx.playChainDing(chainStep++, true);
        spawnFloatingPopup(`×${contrib.xMult} MULT!`, 'type-xmult', stagedEl);
        triggerStageShake(true);
        await sleep(150);
      }

      if (stagedEl) {
        stagedEl.classList.remove('scoring-pulse');
      }
    }

    // 2. 依次触发顶部显卡插件槽 (Jokers)
    const suitCounts = { char: 0, light: 0, expr: 0, glitch: 0 };
    selected.forEach((c) => {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    });

    for (let mIdx = 0; mIdx < state.modules.length; mIdx++) {
      const mod = state.modules[mIdx];
      const modEl = dom.jokerSlotsRow.querySelector(`[data-mod-index="${mIdx}"]`);
      let triggeredText = null;
      let isX = false;

      if (mod.effectType === 'per_suit_mult' && suitCounts[mod.targetSuit] > 0) {
        const addM = suitCounts[mod.targetSuit] * mod.val;
        runningMult += addM;
        triggeredText = `+${addM} Mult (${mod.name})`;
      } else if (mod.effectType === 'per_suit_pixels' && suitCounts[mod.targetSuit] > 0) {
        const addP = suitCounts[mod.targetSuit] * mod.val;
        runningPixels += addP;
        triggeredText = `+${addP} Px (${mod.name})`;
      } else if (mod.effectType === 'purify_glitch' && suitCounts.glitch > 0) {
        const addM = suitCounts.glitch * mod.val;
        runningMult += addM;
        triggeredText = `修手净化 +${addM} Mult!`;
      } else if (mod.effectType === 'per_light_hybrid' && suitCounts.light > 0) {
        const addP = suitCounts.light * mod.valPixels;
        const addM = suitCounts.light * mod.valMult;
        runningPixels += addP;
        runningMult += addM;
        triggeredText = `+${addP}Px +${addM}M`;
      } else if (mod.effectType === 'flat_mult') {
        runningMult += mod.val;
        triggeredText = `+${mod.val} Mult`;
      } else if (mod.effectType === 'flat_pixels') {
        runningPixels += mod.val;
        triggeredText = `+${mod.val} Px`;
      } else if (mod.effectType === 'reroll_scaling_mult' && state.rerollsLeft > 0) {
        const addM = state.rerollsLeft * mod.val;
        runningMult += addM;
        triggeredText = `+${addM} Mult (余量超频)`;
      } else if (mod.effectType === 'economy_mult') {
        runningMult += mod.val;
        triggeredText = `+${mod.val} Mult`;
      } else if (mod.effectType === 'global_xmult') {
        runningMult = Math.round(runningMult * mod.val * 10) / 10;
        triggeredText = `×${mod.val} MULT!`;
        isX = true;
      } else if (mod.effectType === 'five_cards_xmult' && selected.length === 5) {
        runningMult = Math.round(runningMult * mod.val * 10) / 10;
        triggeredText = `Hires 2x · ×${mod.val}!`;
        isX = true;
      } else if (
        mod.effectType === 'triad_xmult_and_purify' &&
        (syn.id === 'golden_triad' || syn.id === 'masterpiece_ssr')
      ) {
        runningMult = Math.round(runningMult * mod.val * 10) / 10;
        triggeredText = `ControlNet ×${mod.val}!`;
        isX = true;
      } else if (mod.effectType === 'multi_char_xmult' && suitCounts.char >= 2) {
        runningMult = Math.round(runningMult * mod.val * 10) / 10;
        triggeredText = `双角色融合 ×${mod.val}!`;
        isX = true;
      }

      if (triggeredText) {
        if (modEl) modEl.classList.add('triggered');
        dom.basePixelsDisplay.textContent = String(Math.round(runningPixels));
        dom.aestheticMultDisplay.textContent = String(Math.round(runningMult * 10) / 10);
        bumpWell(isX ? dom.multWell : dom.pixelsWell);
        sfx.playChainDing(chainStep++, isX);
        spawnFloatingPopup(triggeredText, isX ? 'type-xmult' : 'type-mult', null);
        triggerStageShake(isX);
        await sleep(175);
        if (modEl) modEl.classList.remove('triggered');
      }
    }

    // 3. 汇总本手最终画质得分并揭晓本地高清二次元神图
    const handTotal = Math.round(runningPixels * runningMult);
    dom.previewTotalNumber.textContent = handTotal.toLocaleString();
    state.currentScore += handTotal;
    state.runBestHand = Math.max(state.runBestHand, handTotal);
    if (handTotal > archive.bestHandScore) {
      archive.bestHandScore = handTotal;
    }

    const revealedCg = selectMatchingCg(selected, handTotal, syn);
    state.currentCg = revealedCg;
    const isNewUnlock = !archive.unlockedCgs.includes(revealedCg.id);
    if (isNewUnlock) {
      archive.unlockedCgs.push(revealedCg.id);
    }
    saveArchive();

    // 合成 Prompt 字符串并在 CRT 监视器揭晓高清成图
    const promptLine = `masterpiece, 1girl, ${selected.map((c) => c.enTag).join(', ')}, best quality`;
    dom.monitorCgImage.src = revealedCg.path;
    dom.monitorCgTitle.textContent = revealedCg.title;
    dom.monitorRarityBadge.textContent = `${revealedCg.rarity} · ${syn.tier}`;
    dom.monitorScoreChip.textContent = `+${handTotal.toLocaleString()} 分`;
    dom.monitorPromptText.textContent = promptLine;

    dom.crtScreenFrame.classList.remove('denoising');
    dom.ssrFlashBurst.classList.remove('active');
    void dom.ssrFlashBurst.offsetWidth;
    dom.ssrFlashBurst.classList.add('active');

    sfx.playSsrChord();
    triggerStageShake(true);
    spawnFloatingPopup(`⚡ 出图完成 +${handTotal.toLocaleString()}!`, 'type-xmult', null);

    appendLog(
      `[出图] 触发「${syn.name}」产出 ${handTotal.toLocaleString()} 画质分 -> 揭晓《${revealedCg.title}》${
        isNewUnlock ? '【新图鉴解锁!】' : ''
      }`,
      'ssr'
    );

    await sleep(360);

    // 4. 移除已打出的手牌并补牌
    state.hand = state.hand.filter((c) => !state.selectedInstanceIds.has(c.instanceId));
    state.selectedInstanceIds.clear();
    drawUpToHandSize();

    dom.gpuTempText.textContent = '51°C · 稳定待机';
    dom.gpuTempFill.style.width = '36%';
    state.isAnimating = false;
    renderAll();

    // 5. 检查是否达成委托目标分或耗尽生成次数
    checkBlindOutcome();
  }

  // =========================================================================
  // 13. 抽牌、弃牌重抽与关卡胜负判定
  // =========================================================================
  function drawUpToHandSize() {
    while (state.hand.length < HAND_SIZE) {
      if (state.drawPile.length === 0) {
        // 如果抽牌堆耗尽，将不在手中的牌重新洗入抽牌堆
        const inHandIds = new Set(state.hand.map((c) => c.instanceId));
        const refill = state.deck.filter((c) => !inHandIds.has(c.instanceId));
        if (refill.length === 0) break;
        state.drawPile = shuffleArray(refill);
      }
      const nextCard = state.drawPile.pop();
      if (nextCard) {
        state.hand.push(nextCard);
      }
    }
  }

  function discardSelectedCards() {
    const selected = getSelectedCardsInOrder();
    if (state.isAnimating || selected.length === 0 || state.rerollsLeft <= 0) return;

    state.rerollsLeft -= 1;
    sfx.playClick(false);
    appendLog(`[重抽] 已弃置 ${selected.length} 张词条卡并重新采样补牌。`);

    state.hand = state.hand.filter((c) => !state.selectedInstanceIds.has(c.instanceId));
    state.selectedInstanceIds.clear();
    drawUpToHandSize();
    renderAll();
  }

  function checkBlindOutcome() {
    if (state.currentScore >= state.targetScore) {
      handleStageClear();
    } else if (state.rendersLeft <= 0) {
      handleRunFailed();
    }
  }

  function handleStageClear() {
    const cfg = getStageConfig();
    const unusedRendersBonus = state.rendersLeft * 2;
    const minerBonus = state.modules.reduce((acc, m) => acc + (m.bonusGold || 0), 0);
    const totalEarned = cfg.rewardGold + unusedRendersBonus + minerBonus;

    state.credits += totalEarned;
    archive.bestStageCleared = Math.max(archive.bestStageCleared, state.stageIndex);

    if (state.stageIndex === 9) {
      archive.totalRunsWon += 1;
      saveArchive();
      openRunEndModal(true);
      return;
    }

    saveArchive();
    openCheckpointShop(cfg, totalEarned, unusedRendersBonus, minerBonus);
  }

  function handleRunFailed() {
    sfx.playGlitchBuzz();
    appendLog(`[显存崩溃] 未能达到甲方委托目标分 ${state.targetScore.toLocaleString()}，本次炼丹周目终止。`, 'warn');
    openRunEndModal(false);
  }

  // =========================================================================
  // 14. 过关商店「模型集市 (Checkpoint Shop)」
  // =========================================================================
  function generateShopInventory() {
    const ownedIds = new Set(state.modules.map((m) => m.id));
    const availableMods = shuffleArray(JOKER_MODULES_DB.filter((m) => !ownedIds.has(m.id)));
    state.shopModules = availableMods.slice(0, 3).map((m) => ({ ...m, sold: false }));

    const randomSynergy = PROMPT_SYNERGIES[Math.floor(Math.random() * 5)];
    state.shopUpgrades = [
      {
        id: 'upg_weight_boost',
        name: '📈 词条权重精调 (Tag:1.3)',
        desc: '随机强化牌库中 4 张正向词条卡的权重 +0.3（像素与倍率永久提升 30%）',
        cost: 4,
        sold: false,
        action: () => {
          const candidates = shuffleArray(state.deck.filter((c) => c.suit !== 'glitch')).slice(0, 4);
          candidates.forEach((c) => {
            c.weight = Math.round(((c.weight || 1.0) + 0.3) * 10) / 10;
          });
          appendLog(`[强化] 已为 ${candidates.map((c) => c.zhName).join('、')} 注入 :1.3 权重！`, 'ssr');
        }
      },
      {
        id: 'upg_synergy_lv',
        name: `📐 升级羁绊【${randomSynergy.name}】`,
        desc: '该构图羁绊永久升 1 级（基础像素 +25，基础倍率 +2）',
        cost: 5,
        sold: false,
        action: () => {
          state.synergyLevels[randomSynergy.id] = (state.synergyLevels[randomSynergy.id] || 1) + 1;
          appendLog(`[升级] 构图羁绊「${randomSynergy.name}」升至 Lv.${state.synergyLevels[randomSynergy.id]}！`, 'ssr');
        }
      },
      {
        id: 'upg_purge_glitch',
        name: '🧹 Negative Prompt 废词撕毁',
        desc: '从牌库中永久撕毁移除 1 张【⚠️崩坏干扰卡】并净化其余崩坏卡权重',
        cost: 4,
        sold: false,
        action: () => {
          const idx = state.deck.findIndex((c) => c.suit === 'glitch');
          if (idx !== -1) {
            const removed = state.deck.splice(idx, 1)[0];
            appendLog(`[净化] 已从牌库永久撕毁「${removed.zhName}」！`);
          } else {
            state.deck.forEach((c) => {
              c.weight = Math.round(((c.weight || 1.0) + 0.1) * 10) / 10;
            });
            appendLog('[净化] 牌库已无崩坏卡，全体词条权重 +0.1！');
          }
        }
      }
    ];
  }

  function openCheckpointShop(cfg, totalEarned, unusedRendersBonus, minerBonus) {
    generateShopInventory();
    dom.shopRewardSummary.innerHTML = `
      ✅ <strong>${cfg.title}</strong> 顺利交稿！
      基础稿酬 <strong>+¥${cfg.rewardGold}</strong> · 剩余生成次数奖励 <strong>+¥${unusedRendersBonus}</strong>
      ${minerBonus > 0 ? ` · 挖矿插件分红 <strong>+¥${minerBonus}</strong>` : ''}
      = 本关共入账 <strong>¥${totalEarned}</strong> 算力币！
    `;
    renderShopModalContents();
    dom.shopModal.classList.remove('hidden');
  }

  function renderShopModalContents() {
    dom.shopCreditsDisplay.textContent = `¥${state.credits}`;
    dom.shopModulesList.innerHTML = '';
    dom.shopUpgradesList.innerHTML = '';

    state.shopModules.forEach((mod, idx) => {
      const canBuy = !mod.sold && state.credits >= mod.cost && state.modules.length < MAX_MODULES;
      const row = document.createElement('div');
      row.className = 'shop-item-row';
      row.innerHTML = `
        <div class="shop-item-info">
          <h4>${mod.name}</h4>
          <p>${mod.desc}</p>
        </div>
        <button type="button" class="buy-pill-btn" data-buy-mod="${idx}" ${canBuy ? '' : 'disabled'}>
          ${mod.sold ? '已挂载' : state.modules.length >= MAX_MODULES ? '槽位已满' : `挂载 ¥${mod.cost}`}
        </button>
      `;
      dom.shopModulesList.appendChild(row);
    });

    state.shopUpgrades.forEach((upg, idx) => {
      const canBuy = !upg.sold && state.credits >= upg.cost;
      const row = document.createElement('div');
      row.className = 'shop-item-row';
      row.innerHTML = `
        <div class="shop-item-info">
          <h4>${upg.name}</h4>
          <p>${upg.desc}</p>
        </div>
        <button type="button" class="buy-pill-btn" data-buy-upg="${idx}" ${canBuy ? '' : 'disabled'}>
          ${upg.sold ? '已完成' : `购买 ¥${upg.cost}`}
        </button>
      `;
      dom.shopUpgradesList.appendChild(row);
    });

    dom.shopModulesList.querySelectorAll('[data-buy-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-buy-mod'));
        const mod = state.shopModules[idx];
        if (!mod || mod.sold || state.credits < mod.cost || state.modules.length >= MAX_MODULES) return;
        state.credits -= mod.cost;
        mod.sold = true;
        state.modules.push({ ...mod });
        sfx.playCash();
        appendLog(`[采购] 成功挂载显卡插件「${mod.name}」！`, 'ssr');
        renderShopModalContents();
        renderAll();
      });
    });

    dom.shopUpgradesList.querySelectorAll('[data-buy-upg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-buy-upg'));
        const upg = state.shopUpgrades[idx];
        if (!upg || upg.sold || state.credits < upg.cost) return;
        state.credits -= upg.cost;
        upg.sold = true;
        upg.action();
        sfx.playCash();
        renderShopModalContents();
        renderAll();
      });
    });
  }

  // =========================================================================
  // 15. 关卡推进与新周目初始化
  // =========================================================================
  function startBlindStage(stageIndex) {
    state.stageIndex = stageIndex;
    const cfg = getStageConfig();

    state.currentScore = 0;
    state.targetScore = cfg.targetScore;
    state.rendersLeft = 4;
    state.rerollsLeft = 3;
    state.selectedInstanceIds.clear();

    // 若为 2-3 六指恶魔 BOSS 关，混入 3 张六指崩坏卡
    if (cfg.bossRule === 'inject_glitches') {
      const sixFingerTemplate = BASE_DECK_CARDS.find((c) => c.id === 'glitch_six_fingers');
      if (sixFingerTemplate) {
        for (let i = 0; i < 3; i++) {
          state.deck.push({
            ...sixFingerTemplate,
            instanceId: `boss_glitch_${Date.now()}_${i}`,
            weight: 1.0
          });
        }
        appendLog('⚠️ [BOSS 诅咒] 场地已向牌库混入 3 张「Six Fingers 六指恶魔」！', 'warn');
      }
    }

    state.drawPile = shuffleArray(state.deck);
    state.hand = [];
    drawUpToHandSize();
    renderAll();
  }

  function startNewRun() {
    state.deck = cloneDeckFromBase();
    state.modules = [
      // 默认开局赠送 1 个新手友好插件，让第一手就能体验插件连锁跳字
      { ...JOKER_MODULES_DB[0] }
    ];
    state.credits = 10;
    state.runBestHand = 0;
    state.synergyLevels = {};
    PROMPT_SYNERGIES.forEach((s) => {
      state.synergyLevels[s.id] = 1;
    });

    dom.shopModal.classList.add('hidden');
    dom.runEndModal.classList.add('hidden');
    appendLog('🚀 [新周目] 炼丹工作站已重置，默认挂载「Anima 1.4 喵喵底模」！');
    startBlindStage(1);
  }

  function openRunEndModal(victory) {
    dom.runEndTag.textContent = victory ? 'COMMISSION ALL CLEARED · 传奇画师' : 'VRAM OUT OF MEMORY · 显存过载';
    dom.runEndTitle.textContent = victory
      ? '🏆 恭喜通关！9 大漫展委托全部完美交稿！'
      : `💥 委托失败：止步于第 ${state.stageIndex} 关`;
    dom.runEndDesc.textContent = victory
      ? '你以惊人的 Prompt 构筑掌控了 Anima 1.4 与 NoobAI 引擎，所有解锁的本地高清 CG 已永久保存在神图图鉴中！'
      : '本关累计画质分未能达到甲方要求。你可以调整构筑思路，多利用【三维黄金铁三角】与 ADetailer 逆转崩坏卡！';

    dom.btnEndlessMode.style.display = victory ? 'inline-flex' : 'none';

    dom.runStatsGrid.innerHTML = `
      <div class="run-stat-box">
        <span>本局最高单次出图算力</span>
        <strong>${state.runBestHand.toLocaleString()}</strong>
      </div>
      <div class="run-stat-box">
        <span>历史最高单次纪录</span>
        <strong>${archive.bestHandScore.toLocaleString()}</strong>
      </div>
      <div class="run-stat-box">
        <span>神图图鉴收集进度</span>
        <strong>${archive.unlockedCgs.length} / ${CG_GALLERY_DB.length}</strong>
      </div>
    `;

    dom.runEndModal.classList.remove('hidden');
  }

  // =========================================================================
  // 16. 神图图鉴弹窗、大图检视器与规则弹窗
  // =========================================================================
  function renderGalleryModal() {
    dom.galleryProgressText.textContent = `已解锁本地高清神图：${archive.unlockedCgs.length} / ${CG_GALLERY_DB.length}`;
    dom.galleryGrid.innerHTML = '';

    CG_GALLERY_DB.forEach((cg) => {
      const unlocked = archive.unlockedCgs.includes(cg.id);
      const tile = document.createElement('div');
      tile.className = `gallery-cg-tile${unlocked ? '' : ' locked'}`;
      tile.innerHTML = `
        <div class="tile-thumb">
          <img src="${cg.path}" alt="${cg.title}" loading="lazy" />
          <span class="tile-rarity">${cg.rarity}</span>
        </div>
        <div class="tile-caption">
          <h4>${unlocked ? cg.title : '？？？ · 待炼丹解锁'}</h4>
          <p>${unlocked ? cg.prompt : '打出对应角色卡与高阶构图羁绊即可点亮'}</p>
        </div>
      `;

      tile.addEventListener('click', () => {
        openLightbox(cg, unlocked);
      });

      dom.galleryGrid.appendChild(tile);
    });
  }

  function openLightbox(cg, unlocked = true) {
    dom.lightboxRarityTag.textContent = `${cg.rarity} MASTERPIECE`;
    dom.lightboxTitle.textContent = unlocked ? cg.title : `${cg.title} (预览态)`;
    dom.lightboxImage.src = cg.path;
    dom.lightboxPromptCode.textContent = cg.prompt;
    dom.lightboxUnlockInfo.textContent = unlocked
      ? `✅ 已永久收录至 localStorage (${STORAGE_KEY}) · 历史最高单手算力：${archive.bestHandScore.toLocaleString()}`
      : '🔒 尚未在牌局中正式解锁，打出对应角色词条卡即可永久点亮！';
    dom.cgLightboxModal.classList.remove('hidden');
  }

  function renderRulesSynergyTable() {
    if (!dom.rulesSynergyTbody) return;
    dom.rulesSynergyTbody.innerHTML = '';
    PROMPT_SYNERGIES.forEach((syn) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#ffe600">${syn.tier}</strong></td>
        <td><strong>${syn.name}</strong></td>
        <td>${syn.condDesc}</td>
        <td style="font-family:var(--font-mono);color:#00f0ff">${syn.basePixels} Pixels × ${syn.baseMult} Mult</td>
      `;
      dom.rulesSynergyTbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 17. 事件监听绑定与启动入口
  // =========================================================================
  function bindEvents() {
    // 出牌与重抽
    dom.btnPlayHand.addEventListener('click', () => {
      playSelectedHand();
    });

    dom.btnDiscard.addEventListener('click', () => {
      discardSelectedCards();
    });

    // 手牌排序与取消选择
    document.getElementById('btnSortSuit').addEventListener('click', () => {
      if (state.isAnimating) return;
      const order = { char: 1, light: 2, expr: 3, glitch: 4 };
      state.hand.sort((a, b) => (order[a.suit] || 9) - (order[b.suit] || 9) || b.pixels - a.pixels);
      sfx.playClick(true);
      renderHandCards();
    });

    document.getElementById('btnSortPixels').addEventListener('click', () => {
      if (state.isAnimating) return;
      state.hand.sort((a, b) => b.pixels - a.pixels);
      sfx.playClick(true);
      renderHandCards();
    });

    document.getElementById('btnClearSelect').addEventListener('click', () => {
      if (state.isAnimating) return;
      state.selectedInstanceIds.clear();
      sfx.playClick(false);
      renderAll();
    });

    // 顶部开关与弹窗按钮
    const btnToggleCrt = document.getElementById('btnToggleCrt');
    const applyCrtState = () => {
      document.body.classList.toggle('crt-active', archive.crtEnabled);
      btnToggleCrt.classList.toggle('active', archive.crtEnabled);
      btnToggleCrt.innerHTML = `<span>📺 CRT: ${archive.crtEnabled ? 'ON' : 'OFF'}</span>`;
    };
    applyCrtState();
    btnToggleCrt.addEventListener('click', () => {
      archive.crtEnabled = !archive.crtEnabled;
      saveArchive();
      applyCrtState();
    });

    const btnToggleSound = document.getElementById('btnToggleSound');
    const applySoundState = () => {
      sfx.enabled = archive.soundEnabled;
      btnToggleSound.classList.toggle('active', archive.soundEnabled);
      btnToggleSound.innerHTML = `<span>🔊 音效: ${archive.soundEnabled ? 'ON' : 'OFF'}</span>`;
    };
    applySoundState();
    btnToggleSound.addEventListener('click', () => {
      archive.soundEnabled = !archive.soundEnabled;
      saveArchive();
      applySoundState();
      if (archive.soundEnabled) sfx.playClick(true);
    });

    document.getElementById('btnOpenGallery').addEventListener('click', () => {
      renderGalleryModal();
      dom.galleryModal.classList.remove('hidden');
    });

    document.getElementById('btnOpenRules').addEventListener('click', () => {
      dom.rulesModal.classList.remove('hidden');
    });

    document.getElementById('btnOpenSynergy').addEventListener('click', () => {
      dom.rulesModal.classList.remove('hidden');
    });

    document.getElementById('btnInspectCg').addEventListener('click', () => {
      openLightbox(state.currentCg, true);
    });

    document.getElementById('btnNewRun').addEventListener('click', () => {
      if (state.isAnimating) return;
      startNewRun();
    });

    // 商店刷新与下一关
    document.getElementById('btnRerollShop').addEventListener('click', () => {
      if (state.credits < 3) {
        sfx.playGlitchBuzz();
        return;
      }
      state.credits -= 3;
      sfx.playClick(true);
      generateShopInventory();
      renderShopModalContents();
      renderAll();
    });

    document.getElementById('btnNextBlind').addEventListener('click', () => {
      dom.shopModal.classList.add('hidden');
      startBlindStage(state.stageIndex + 1);
    });

    // 结算弹窗按钮
    dom.btnEndlessMode.addEventListener('click', () => {
      dom.runEndModal.classList.add('hidden');
      startBlindStage(state.stageIndex + 1);
    });

    document.getElementById('btnRestartFromModal').addEventListener('click', () => {
      startNewRun();
    });

    // 通用关闭弹窗
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close-modal');
        const modal = document.getElementById(targetId);
        if (modal) modal.classList.add('hidden');
      });
    });

    document.querySelectorAll('.cyber-modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && backdrop.id !== 'shopModal' && backdrop.id !== 'runEndModal') {
          backdrop.classList.add('hidden');
        }
      });
    });
  }

  function init() {
    cacheDom();
    renderRulesSynergyTable();
    bindEvents();
    startNewRun();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
