/**
 * 《次元小丑牌：魔王讨伐战 (Pxlsan Balatro: Boss Rush)》
 * 核心玩法：纯正 52 张扑克牌 (♠♥♣♦ A~K) + 国风改名固定点数牌型表 (紫气东来/四方已定/三才两合...) + Spine 2D 骨骼战斗
 * 存储键值：localStorage['pxlsan-game:arcade:alchemist']
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'pxlsan-game:arcade:alchemist';
  const HAND_SIZE = 8;
  const MAX_PLAY_CARDS = 5;
  const MAX_MODULES = 5;
  const MAX_HEARTS = 5;

  // =========================================================================
  // 1. WebAudio 零依赖合成器音效引擎 (支持升调连锁 pitch *= 1.08)
  // =========================================================================
  class CyberSynthAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.bgmMap = {
        table: 'assets/alchemist/bgm/alchemist_table.mp3',
        boss: 'assets/alchemist/bgm/alchemist_boss.mp3',
        shop: 'assets/alchemist/bgm/alchemist_shop.mp3',
      };
      this.bgmEl = null;
      this.bgmMode = null;
      this.pendingBgmMode = null;
      this.jackpotEl = null;
      if (typeof document !== 'undefined') {
        const unlock = () => {
          if (this.pendingBgmMode && this.enabled) {
            const m = this.pendingBgmMode;
            this.pendingBgmMode = null;
            this.playBgm(m);
          }
        };
        document.addEventListener('click', unlock, { once: true, capture: true, passive: true });
        document.addEventListener('touchstart', unlock, { once: true, capture: true, passive: true });
      }
    }

    playBgm(mode = 'table') {
      const url = this.bgmMap[mode] || this.bgmMap.table;
      this.bgmMode = mode;
      if (!this.enabled) {
        this.pendingBgmMode = mode;
        this.stopBgm();
        return;
      }
      if (this.bgmEl && this.bgmEl._mode === mode && !this.bgmEl.paused) return;
      this.stopBgm();
      try {
        const el = new Audio(url);
        el.loop = true;
        el.volume = mode === 'boss' ? 0.36 : 0.32;
        el._mode = mode;
        this.bgmEl = el;
        el.play().catch(() => {
          this.pendingBgmMode = mode;
        });
      } catch (_) {}
    }

    stopBgm() {
      if (this.bgmEl) {
        try {
          this.bgmEl.pause();
          this.bgmEl.currentTime = 0;
        } catch (_) {}
        this.bgmEl = null;
      }
    }

    syncEnabled(isEnabled) {
      this.enabled = Boolean(isEnabled);
      if (!this.enabled) {
        this.stopBgm();
      } else if (this.bgmMode || this.pendingBgmMode) {
        this.playBgm(this.bgmMode || this.pendingBgmMode);
      }
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

    playClick(selected = true) {
      if (selected) {
        this.tone(580, 0.06, 'triangle', 0.14, 880);
      } else {
        this.tone(460, 0.06, 'sine', 0.11, 310);
      }
    }

    playChainDing(step = 0, isXMult = false) {
      const pitch = Math.pow(1.08, step);
      const baseFreq = isXMult ? 523.25 : 440;
      const freq = baseFreq * pitch;
      this.tone(freq, 0.13, isXMult ? 'sawtooth' : 'triangle', 0.16, freq * 1.18);
      if (isXMult) {
        setTimeout(() => this.tone(freq * 1.5, 0.14, 'sine', 0.14), 35);
      }
    }

    playSsrChord() {
      if (!this.enabled) return;
      try {
        if (this.jackpotEl) {
          this.jackpotEl.pause();
          this.jackpotEl.currentTime = 0;
        }
        const el = new Audio('assets/alchemist/bgm/alchemist_jackpot.mp3');
        el.volume = 0.65;
        this.jackpotEl = el;
        el.play().catch(() => {
          const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
          notes.forEach((n, idx) => {
            setTimeout(() => {
              this.tone(n, 0.36, 'triangle', 0.14, n * 1.03);
            }, idx * 55);
          });
        });
        return;
      } catch (_) {}
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, idx) => {
        setTimeout(() => {
          this.tone(n, 0.36, 'triangle', 0.14, n * 1.03);
        }, idx * 55);
      });
    }

    playGlitchBuzz() {
      this.tone(155, 0.18, 'sawtooth', 0.16, 92);
    }

    playCash() {
      this.tone(784, 0.08, 'sine', 0.14, 1174);
      setTimeout(() => this.tone(1174, 0.15, 'triangle', 0.14, 1568), 65);
    }
  }

  const sfx = new CyberSynthAudio();

  // =========================================================================
  // 2. 出战看板娘先锋立绘库 (单局选定1位女主出战，配备专属【被动天赋】+ 4状态全身立绘；activeSkill* 字段为旧版遗留数据，当前不对玩家开放)
  // =========================================================================
  const HERO_VANGUARDS = [
    {
      key: 'takagi',
      shortName: '高木',
      name: '高木',
      avatar: 'assets/alchemist/avatars/avatar_takagi.webp',
      idleSprite: 'assets/alchemist/states/takagi_normal.webp',
      attackSprite: 'assets/alchemist/states/takagi_attack.webp',
      hitSprite: 'assets/alchemist/states/takagi_hit.webp',
      criticalSprite: 'assets/alchemist/states/takagi_critical.webp',
      passiveDesc: '打出对子 / 两对 / 三条 / 满堂红时，基础倍率 +2',
      activeSkillName: '点数 +1',
      activeSkillDesc: '将当前选中的扑克牌点数 +1（如 Q 变 K，方便凑顺子或四条）',
      attackQuote: '「哼哼，猜猜看我这一手会出什么牌？」',
      criticalQuote: '「呜……衣服被划破了……但下一手牌绝对不会输给你！」'
    },
    {
      key: 'nagatoro',
      shortName: '长瀞',
      name: '长瀞',
      avatar: 'assets/alchemist/avatars/avatar_takako.webp',
      idleSprite: 'assets/alchemist/states/nagatoro_normal.webp',
      attackSprite: 'assets/alchemist/states/nagatoro_attack.webp',
      hitSprite: 'assets/alchemist/states/nagatoro_hit.webp',
      criticalSprite: 'assets/alchemist/states/nagatoro_critical.webp',
      passiveDesc: '处于濒死战损状态时，伤害倍率加成提升至 ×1.65',
      activeSkillName: '蓄力重击',
      activeSkillDesc: '下一次出牌额外获得 +70 基础伤害与 +3 倍率',
      attackQuote: '「接招吧，吃我这一记重拳连击啦！！」',
      criticalQuote: '「啧……居然把人家的制服弄破了，我要认真揍飞你了！」'
    },
    {
      key: 'marin',
      shortName: '海梦',
      name: '海梦',
      avatar: 'assets/alchemist/avatars/avatar_marin.webp',
      idleSprite: 'assets/alchemist/states/marin_normal.webp',
      attackSprite: 'assets/alchemist/states/marin_attack.webp',
      hitSprite: 'assets/alchemist/states/marin_hit.webp',
      criticalSprite: 'assets/alchemist/states/marin_critical.webp',
      passiveDesc: '打出同花 / 同花顺时，基础倍率 +4',
      activeSkillName: '红心染色',
      activeSkillDesc: '将当前选中的所有手牌统一染为 ♥ 红心（选 5 张即可直接凑出同花）',
      attackQuote: '「闪耀全场吧！这可是我最拿手的一手牌！」',
      criticalQuote: '「呀啊！好不容易做好的礼服破掉了……绝对饶不了你！」'
    },
    {
      key: 'kaguya',
      shortName: '辉夜',
      name: '辉夜',
      avatar: 'assets/alchemist/avatars/avatar_kaguya.webp',
      idleSprite: 'assets/alchemist/states/kaguya_normal.webp',
      attackSprite: 'assets/alchemist/states/kaguya_attack.webp',
      hitSprite: 'assets/alchemist/states/kaguya_hit.webp',
      criticalSprite: 'assets/alchemist/states/kaguya_critical.webp',
      passiveDesc: '每打出一张 J / Q / K / A 人头牌，额外 +15 伤害与 +1 倍率',
      activeSkillName: '恢复与换牌',
      activeSkillDesc: '立即恢复 1 颗红心 ❤️，并获得 +2 次弃牌机会',
      attackQuote: '「真是可爱呢——这一手牌我已经算准了。」',
      criticalQuote: '「怎、怎么会如此狼狈……本小姐绝不允许在此倒下！」'
    },
    {
      key: 'kuroneko',
      shortName: '黑猫',
      name: '黑猫',
      avatar: 'assets/alchemist/avatars/avatar_kuroneko.webp',
      idleSprite: 'assets/alchemist/states/kuroneko_normal.webp',
      attackSprite: 'assets/alchemist/states/kuroneko_attack.webp',
      hitSprite: 'assets/alchemist/states/kuroneko_hit.webp',
      criticalSprite: 'assets/alchemist/states/kuroneko_critical.webp',
      passiveDesc: '打出四条 / 满堂红时，最终总倍率额外 ×1.35',
      activeSkillName: '复制手牌',
      activeSkillDesc: '将选中的第 1 张牌复制一张相同点数的牌加入手牌（方便凑三条/四条）',
      attackQuote: '「哼哼，听从号令吧，看我用这一手牌击败你！」',
      criticalQuote: '「咕呜……衣服破损了……但反击现在才开始！」'
    },
    {
      key: 'aili',
      shortName: '爱莉',
      name: '爱莉',
      avatar: 'assets/alchemist/avatars/avatar_aili.webp',
      idleSprite: 'assets/alchemist/states/aili_normal.webp',
      attackSprite: 'assets/alchemist/states/aili_attack.webp',
      hitSprite: 'assets/alchemist/states/aili_hit.webp',
      criticalSprite: 'assets/alchemist/states/aili_critical.webp',
      passiveDesc: '打出顺子 / 两对时，额外获得 +35 伤害与 +3 倍率',
      activeSkillName: '王牌升阶',
      activeSkillDesc: '将当前选中的扑克牌全部升阶为 A (14点，+11伤)',
      attackQuote: '「别小看人！看我用这一击把你彻底轰飞！」',
      criticalQuote: '「笨、笨蛋别往这边看啦！还不快点出牌反击！」'
    },
    {
      key: 'qianhe',
      shortName: '千鹤',
      name: '千鹤',
      avatar: 'assets/alchemist/avatars/avatar_qianhe.webp',
      idleSprite: 'assets/alchemist/states/qianhe_normal.webp',
      attackSprite: 'assets/alchemist/states/qianhe_attack.webp',
      hitSprite: 'assets/alchemist/states/qianhe_hit.webp',
      criticalSprite: 'assets/alchemist/states/qianhe_critical.webp',
      passiveDesc: '每剩余 1 次弃牌机会，出牌时额外提供 +25 基础伤害',
      activeSkillName: '赏金补给',
      activeSkillDesc: '立即获得 +3 铜钱与 +2 次弃牌机会',
      attackQuote: '「全力以赴的演出，现在才刚刚进入高潮！」',
      criticalQuote: '「呼、呼……就算只剩最后一口气，我也绝不会退缩！」'
    },
    {
      key: 'mai',
      shortName: '麻衣',
      name: '麻衣',
      avatar: 'assets/alchemist/avatars/avatar_mai.webp',
      idleSprite: 'assets/alchemist/states/mai_normal.webp',
      attackSprite: 'assets/alchemist/states/mai_attack.webp',
      hitSprite: 'assets/alchemist/states/mai_hit.webp',
      criticalSprite: 'assets/alchemist/states/mai_critical.webp',
      passiveDesc: '每打出一张 ♠ 黑桃或 ♣ 梅花牌，额外 +12 伤害与 +1 倍率',
      activeSkillName: '黑桃染色',
      activeSkillDesc: '将当前选中的所有手牌统一染为 ♠ 黑桃',
      attackQuote: '「看好了，这可是只为你一人准备的一手好牌。」',
      criticalQuote: '「真是的……让人家露出这种破损的样子，你要怎么补偿我？」'
    },
    {
      key: 'yukino',
      shortName: '雪乃',
      name: '雪乃',
      avatar: 'assets/alchemist/avatars/avatar_yukino.webp',
      idleSprite: 'assets/alchemist/states/yukino_normal.webp',
      attackSprite: 'assets/alchemist/states/yukino_attack.webp',
      hitSprite: 'assets/alchemist/states/yukino_hit.webp',
      criticalSprite: 'assets/alchemist/states/yukino_critical.webp',
      passiveDesc: '打出三条 / 四条 / 同花顺时，基础伤害 +45、倍率 +3',
      activeSkillName: '弱点破防',
      activeSkillDesc: '直接削减当前对手 20% 最大生命值',
      attackQuote: '「毫无破绽的一手牌——就此分出胜负吧。」',
      criticalQuote: '「咳……衣服破损算不上什么，冷静算牌，一举逆转它！」'
    }
  ];

  // =========================================================================
  // 3. 18 张角色 CG 图鉴库 (100% 独立本地资产)
  // =========================================================================
  const CG_GALLERY_DB = [
    {
      id: 'cg_takagi_qipao',
      title: '高木 · 旗袍特写 CG',
      rarity: 'SSR',
      charKey: 'takagi',
      path: 'assets/alchemist/ssr/ssr_01.webp',
      prompt: '高木收藏 CG · 01'
    },
    {
      id: 'cg_aili_catgirl',
      title: '爱莉 · 猫耳特写 CG',
      rarity: 'SSR',
      charKey: 'aili',
      path: 'assets/alchemist/ssr/ssr_02.webp',
      prompt: '爱莉收藏 CG · 02'
    },
    {
      id: 'cg_qianhe_santa',
      title: '千鹤 · 冬日盛装 CG',
      rarity: 'SSR',
      charKey: 'qianhe',
      path: 'assets/alchemist/ssr/ssr_03.webp',
      prompt: '千鹤收藏 CG · 03'
    },
    {
      id: 'cg_takako_jingyong',
      title: '长瀞 · 泳装特写 CG',
      rarity: 'SSR',
      charKey: 'nagatoro',
      path: 'assets/alchemist/ssr/ssr_04.webp',
      prompt: '长瀞收藏 CG · 04'
    },
    {
      id: 'cg_takako_qipao',
      title: '长瀞 · 晚礼服特写 CG',
      rarity: 'SSR',
      charKey: 'nagatoro',
      path: 'assets/alchemist/ssr/ssr_05.webp',
      prompt: '长瀞收藏 CG · 05'
    },
    {
      id: 'cg_takagi_school',
      title: '高木 · 放学教室 CG',
      rarity: 'SR',
      charKey: 'takagi',
      path: 'assets/alchemist/ssr/ssr_06.webp',
      prompt: '高木收藏 CG · 06'
    },
    {
      id: 'cg_shasha_stage',
      title: '莎夏 · 舞台特写 CG',
      rarity: 'SSR',
      charKey: 'shasha',
      path: 'assets/alchemist/ssr/ssr_07.webp',
      prompt: '莎夏收藏 CG · 07'
    },
    {
      id: 'cg_aili_morning',
      title: '爱莉 · 晨间花园 CG',
      rarity: 'SR',
      charKey: 'aili',
      path: 'assets/alchemist/ssr/ssr_08.webp',
      prompt: '爱莉收藏 CG · 08'
    },
    {
      id: 'cg_takagi_breeze',
      title: '高木 · 夏日微风 CG',
      rarity: 'SR',
      charKey: 'takagi',
      path: 'assets/alchemist/ssr/ssr_09.webp',
      prompt: '高木收藏 CG · 09'
    },
    {
      id: 'cg_takako_sunset',
      title: '长瀞 · 夕阳天台 CG',
      rarity: 'SR',
      charKey: 'nagatoro',
      path: 'assets/alchemist/ssr/ssr_10.webp',
      prompt: '长瀞收藏 CG · 10'
    },
    {
      id: 'cg_ch_1',
      title: '爱莉 · 街角邂逅 CG',
      rarity: 'SR',
      charKey: 'aili',
      path: 'assets/alchemist/ssr/ssr_11.webp',
      prompt: '爱莉收藏 CG · 11'
    },
    {
      id: 'cg_ch_11',
      title: '爱莉 · 午后甜点 CG',
      rarity: 'SR',
      charKey: 'aili',
      path: 'assets/alchemist/ssr/ssr_12.webp',
      prompt: '爱莉收藏 CG · 12'
    },
    {
      id: 'cg_ch_21',
      title: '长瀞 · 美术部写生 CG',
      rarity: 'SSR',
      charKey: 'nagatoro',
      path: 'assets/alchemist/ssr/ssr_13.webp',
      prompt: '长瀞收藏 CG · 13'
    },
    {
      id: 'cg_ch_30',
      title: '海梦 · 夏夜花火 CG',
      rarity: 'SSR',
      charKey: 'marin',
      path: 'assets/alchemist/ssr/ssr_14.webp',
      prompt: '海梦收藏 CG · 14'
    },
    {
      id: 'cg_ch_41',
      title: '麻衣 · 雨夜车站 CG',
      rarity: 'SSR',
      charKey: 'mai',
      path: 'assets/alchemist/ssr/ssr_15.webp',
      prompt: '麻衣收藏 CG · 15'
    },
    {
      id: 'cg_ch_51',
      title: '辉夜 · 学生会室 CG',
      rarity: 'SSR',
      charKey: 'kaguya',
      path: 'assets/alchemist/ssr/ssr_16.webp',
      prompt: '辉夜收藏 CG · 16'
    },
    {
      id: 'cg_ch_61',
      title: '黑猫 · 哥特礼服 CG',
      rarity: 'SSR',
      charKey: 'kuroneko',
      path: 'assets/alchemist/ssr/ssr_17.webp',
      prompt: '黑猫收藏 CG · 17'
    },
    {
      id: 'cg_ch_101',
      title: '千鹤 · 庆功晚宴 CG',
      rarity: 'SSR',
      charKey: 'qianhe',
      path: 'assets/alchemist/ssr/ssr_18.webp',
      prompt: '千鹤收藏 CG · 18'
    }
  ];

  // =========================================================================
  // 4. 9 种标准扑克牌型表 (干净直观的标准扑克牌型名称)
  // =========================================================================
  const PROMPT_SYNERGIES = [
    {
      id: 'straight_flush',
      tier: '等级1',
      shortTitle: '同花顺',
      pokerName: '5张同花顺',
      name: '同花顺',
      condDesc: '5 张同花色且点数连续的扑克牌',
      basePixels: 100,
      baseMult: 8
    },
    {
      id: 'four_bomb',
      tier: '等级1',
      shortTitle: '四条',
      pokerName: '炸弹',
      name: '四条 (炸弹)',
      condDesc: '4 张相同点数的扑克牌（炸弹）',
      basePixels: 60,
      baseMult: 7
    },
    {
      id: 'full_house',
      tier: '等级1',
      shortTitle: '满堂红',
      pokerName: '葫芦 / 三带二',
      name: '满堂红 (葫芦)',
      condDesc: '3 张同点数 + 2 张同点数（葫芦/三带二）',
      basePixels: 40,
      baseMult: 4
    },
    {
      id: 'flush_five',
      tier: '等级1',
      shortTitle: '同花',
      pokerName: '5张同花',
      name: '同花',
      condDesc: '5 张相同花色的扑克牌（♠/♥/♣/♦）',
      basePixels: 35,
      baseMult: 4
    },
    {
      id: 'straight_five',
      tier: '等级1',
      shortTitle: '顺子',
      pokerName: '5张连号',
      name: '顺子',
      condDesc: '5 张点数连续的扑克牌（如 10-J-Q-K-A 或 A-2-3-4-5）',
      basePixels: 30,
      baseMult: 4
    },
    {
      id: 'three_kind',
      tier: '等级1',
      shortTitle: '三条',
      pokerName: '3张同点',
      name: '三条',
      condDesc: '包含 3 张相同点数的扑克牌',
      basePixels: 30,
      baseMult: 3
    },
    {
      id: 'two_pair',
      tier: '等级1',
      shortTitle: '两对',
      pokerName: '双对子',
      name: '两对',
      condDesc: '包含 2 组不同点数的对子',
      basePixels: 20,
      baseMult: 2
    },
    {
      id: 'one_pair',
      tier: '等级1',
      shortTitle: '对子',
      pokerName: '2张同点',
      name: '对子',
      condDesc: '包含 2 张相同点数的扑克牌',
      basePixels: 10,
      baseMult: 2
    },
    {
      id: 'high_card',
      tier: '等级1',
      shortTitle: '高牌',
      pokerName: '单牌 / 散牌',
      name: '高牌',
      condDesc: '未凑成以上牌型的单牌或散牌',
      basePixels: 5,
      baseMult: 1
    }
  ];

  // =========================================================================
  // 5. 标准 52 张纯正扑克牌库生成器 (♠黑桃, ♥红心, ♣梅花, ♦方片 × A,2,3,4,5,6,7,8,9,10,J,Q,K)
  //    - 数字牌 (2~10)：米白牌面 + 右下角超大花色符号，固定点数 = 牌面数字 (2~10)
  //    - 人头牌 (J,Q,K,A)：暖色斜纹底 + 角色立绘插画，J/Q/K 固定点数 = 10，A 固定点数 = 11
  // =========================================================================
  const SUIT_CONFIGS = [
    {
      pokerSuit: 'spade',
      suitSymbol: '♠',
      suitLabel: '♠ 黑桃',
      colorClass: 'suit-spade',
      legacySuit: 'light',
      faceChars: { 11: 'mai', 12: 'kuroneko', 13: 'nagatoro', 14: 'qianhe' }
    },
    {
      pokerSuit: 'heart',
      suitSymbol: '♥',
      suitLabel: '♥ 红心',
      colorClass: 'suit-heart',
      legacySuit: 'char',
      faceChars: { 11: 'aili', 12: 'qianhe', 13: 'kaguya', 14: 'takagi' }
    },
    {
      pokerSuit: 'club',
      suitSymbol: '♣',
      suitLabel: '♣ 梅花',
      colorClass: 'suit-club',
      legacySuit: 'light',
      faceChars: { 11: 'kuroneko', 12: 'yukino', 13: 'mai', 14: 'marin' }
    },
    {
      pokerSuit: 'diamond',
      suitSymbol: '♦',
      suitLabel: '♦ 方片',
      colorClass: 'suit-diamond',
      legacySuit: 'expr',
      faceChars: { 11: 'aili', 12: 'marin', 13: 'nagatoro', 14: 'kaguya' }
    }
  ];

  const RANK_CONFIGS = [
    { rank: 14, label: 'A', chips: 11, isFace: true }, // A 计入人头牌 (与宝物/主角/魔物说明中的 J/Q/K/A 一致)
    { rank: 13, label: 'K', chips: 10, isFace: true },
    { rank: 12, label: 'Q', chips: 10, isFace: true },
    { rank: 11, label: 'J', chips: 10, isFace: true },
    { rank: 10, label: '10', chips: 10, isFace: false },
    { rank: 9, label: '9', chips: 9, isFace: false },
    { rank: 8, label: '8', chips: 8, isFace: false },
    { rank: 7, label: '7', chips: 7, isFace: false },
    { rank: 6, label: '6', chips: 6, isFace: false },
    { rank: 5, label: '5', chips: 5, isFace: false },
    { rank: 4, label: '4', chips: 4, isFace: false },
    { rank: 3, label: '3', chips: 3, isFace: false },
    { rank: 2, label: '2', chips: 2, isFace: false }
  ];

  function buildStandard52Deck() {
    const cards = [];
    SUIT_CONFIGS.forEach((sc) => {
      RANK_CONFIGS.forEach((rc) => {
        const charKey = sc.faceChars[rc.rank] || null;
        cards.push({
          id: `${sc.pokerSuit}_${rc.label}`,
          rank: rc.rank,
          rankLabel: rc.label,
          pokerSuit: sc.pokerSuit,
          suit: sc.legacySuit,
          suitSymbol: sc.suitSymbol,
          suitLabel: sc.suitLabel,
          colorClass: sc.colorClass,
          isFace: rc.isFace,
          zhName: `${sc.suitLabel}${rc.label}`,
          enTag: `${rc.label}${sc.suitSymbol}`,
          pixels: rc.chips,
          mult: 0,
          xMult: 1,
          charKey,
          note: `基础伤害 +${rc.chips}`
        });
      });
    });
    return cards;
  }

  const BASE_DECK_CARDS = buildStandard52Deck();

  // =========================================================================
  // 6. 12 件随身宝物道具库（白·普通 / 蓝·稀有 / 紫·史诗 / 红·传说 4 档品质，不同价格、权重与回收价）
  // =========================================================================
  const JOKER_MODULES_DB = [
    // ---------- ⚪ 白色品质（普通 · 出现概率最高 45% · 售价 4 · 出售 +2） ----------
    {
      id: 'mod_cfg_stabilizer',
      name: '星辰罗盘',
      rarity: 'white',
      rarityLabel: '普通',
      weight: 45,
      icon: 'assets/alchemist/jokers/mod_cfg_stabilizer.webp?v=27',
      cost: 4,
      sellPrice: 2,
      desc: '任何出牌无条件提供 +6 固定倍率',
      effectType: 'flat_mult',
      val: 6
    },
    {
      id: 'mod_dpm_karras',
      name: '圣光骑士剑',
      rarity: 'white',
      rarityLabel: '普通',
      weight: 45,
      icon: 'assets/alchemist/jokers/mod_dpm_karras.webp?v=27',
      cost: 4,
      sellPrice: 2,
      desc: '任何出牌无条件提供 +50 固定伤害',
      effectType: 'flat_pixels',
      val: 50
    },
    {
      id: 'mod_vram_miner',
      name: '招财金猫',
      rarity: 'white',
      rarityLabel: '普通',
      weight: 45,
      icon: 'assets/alchemist/jokers/mod_vram_miner.webp?v=27',
      cost: 4,
      sellPrice: 2,
      desc: '每过一关额外获得 +5 铜钱，且出牌时总倍率 +3',
      effectType: 'economy_mult',
      val: 3,
      bonusGold: 5
    },

    // ---------- 🔵 蓝色品质（稀有 · 出现概率 30% · 售价 6 · 出售 +3） ----------
    {
      id: 'mod_anima_core',
      name: '黄玉戒指',
      rarity: 'blue',
      rarityLabel: '稀有',
      weight: 30,
      icon: 'assets/alchemist/jokers/mod_anima_core.webp?v=27',
      cost: 6,
      sellPrice: 3,
      desc: '每打出一张 ♦ 方片牌，额外 +4 倍率',
      effectType: 'per_suit_mult',
      targetPokerSuit: 'diamond',
      val: 4
    },
    {
      id: 'mod_noobai_xl',
      name: '红宝石吊坠',
      rarity: 'blue',
      rarityLabel: '稀有',
      weight: 30,
      icon: 'assets/alchemist/jokers/mod_noobai_xl.webp?v=27',
      cost: 6,
      sellPrice: 3,
      desc: '每打出一张 ♥ 红心牌，额外 +30 伤害',
      effectType: 'per_suit_pixels',
      targetPokerSuit: 'heart',
      val: 30
    },
    {
      id: 'mod_ray_tracing',
      name: '黑曜石匕首',
      rarity: 'blue',
      rarityLabel: '稀有',
      weight: 30,
      icon: 'assets/alchemist/jokers/mod_ray_tracing.webp?v=27',
      cost: 6,
      sellPrice: 3,
      desc: '每打出一张 ♠ 黑桃或 ♣ 梅花牌，+18 伤害与 +2 倍率',
      effectType: 'per_black_suit_hybrid',
      valPixels: 18,
      valMult: 2
    },

    // ---------- 🟣 紫色品质（史诗 · 出现概率 18% · 售价 9 · 出售 +5） ----------
    {
      id: 'mod_adetailer',
      name: '黄金王冠',
      rarity: 'purple',
      rarityLabel: '史诗',
      weight: 18,
      icon: 'assets/alchemist/jokers/mod_adetailer.webp?v=27',
      cost: 9,
      sellPrice: 5,
      desc: '每打出一张 J / Q / K / A 人头牌，+25 伤害与 +4 倍率',
      effectType: 'face_card_boost',
      valPixels: 25,
      valMult: 4
    },
    {
      id: 'mod_controlnet_pose',
      name: '黄金怀表',
      rarity: 'purple',
      rarityLabel: '史诗',
      weight: 18,
      icon: 'assets/alchemist/jokers/mod_controlnet_pose.webp?v=27',
      cost: 9,
      sellPrice: 5,
      desc: '出牌基础伤害 +20，打出对子及以上牌型时总倍率 ×1.3',
      effectType: 'starter_abacus_boost',
      valPixels: 20,
      val: 1.3
    },
    {
      id: 'mod_vram_cooler',
      name: '冰晶沙漏',
      rarity: 'purple',
      rarityLabel: '史诗',
      weight: 18,
      icon: 'assets/alchemist/jokers/mod_vram_cooler.webp?v=27',
      cost: 9,
      sellPrice: 5,
      desc: '每剩余 1 次弃牌机会，出牌时总倍率 +4',
      effectType: 'reroll_scaling_mult',
      val: 4
    },

    // ---------- 🔴 红色品质（传说 · 出现概率最低 7% · 售价 13 · 出售 +7） ----------
    {
      id: 'mod_hires_fix',
      name: '翡翠羽扇',
      rarity: 'red',
      rarityLabel: '传说',
      weight: 7,
      icon: 'assets/alchemist/jokers/mod_hires_fix.webp?v=27',
      cost: 13,
      sellPrice: 7,
      desc: '打出顺子 / 同花 / 满堂红或 5 张牌时，总倍率 ×1.65',
      effectType: 'five_cards_xmult',
      val: 1.65
    },
    {
      id: 'mod_lazypos_v2',
      name: '绯红魔药',
      rarity: 'red',
      rarityLabel: '传说',
      weight: 7,
      icon: 'assets/alchemist/jokers/mod_lazypos_v2.webp?v=27',
      cost: 13,
      sellPrice: 7,
      desc: '每次出牌攻击时，总倍率无条件 ×1.5',
      effectType: 'global_xmult',
      val: 1.5
    },
    {
      id: 'mod_lora_stack',
      name: '蔷薇音乐盒',
      rarity: 'red',
      rarityLabel: '传说',
      weight: 7,
      icon: 'assets/alchemist/jokers/mod_lora_stack.webp?v=27',
      cost: 13,
      sellPrice: 7,
      desc: '打出对子 / 两对 / 三条 / 满堂红 / 四条时，总倍率 ×1.6',
      effectType: 'multi_char_xmult',
      val: 1.6
    }
  ];

  // =========================================================================
  // 7. 深渊魅惑魔城 · 9 大美少女反派军团 (魅魔小兵 -> 三大魔将 -> 终焉 NTR 魅惑魔王)
  // =========================================================================
  const BLIND_STAGES = [
    {
      stageIndex: 1,
      act: 1,
      type: '魔城先锋小兵',
      isBoss: false,
      title: '1-1 · 见习小恶魔魅魔 · 莉莉姆',
      bossSprite: 'assets/alchemist/monsters/boss_01_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_01_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_01_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_01_critical.webp',
      ruleDesc: '💋 敌方技能【甜腻偷心】：若单次出牌只是「高牌散牌」，会被莉莉姆偷走 1 枚铜钱！凑出对子以上痛击她！',
      targetScore: 300,
      rewardGold: 7,
      bossRule: 'steal_coin_on_highcard'
    },
    {
      stageIndex: 2,
      act: 1,
      type: '魔城精英小兵',
      isBoss: false,
      title: '1-2 · 暗夜血族女仆 · 薇薇安',
      bossSprite: 'assets/alchemist/monsters/boss_02_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_02_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_02_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_02_critical.webp',
      ruleDesc: '🍷 敌方技能【夜宴侍奉】：惧怕圣银寒光，所有【♠ 黑桃 / ♣ 梅花】扑克牌基础伤害额外 +10',
      targetScore: 520,
      rewardGold: 8,
      bossRule: 'light_bonus_pixels'
    },
    {
      stageIndex: 3,
      act: 1,
      type: '第一魔将 BOSS',
      isBoss: true,
      title: '1-3 · 【魔将】嫉妒魔将 · 塞拉菲娜',
      bossSprite: 'assets/alchemist/monsters/boss_03_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_03_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_03_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_03_critical.webp',
      ruleDesc: '⛓️ 魔将技能【嫉妒锁链】：封锁手牌上限，单次最多只能出 4 张牌！（4张连号即可触发顺子、4张同花即可触发同花）',
      targetScore: 850,
      rewardGold: 11,
      bossRule: 'max_4_cards'
    },
    {
      stageIndex: 4,
      act: 2,
      type: '欢愉回廊干部',
      isBoss: false,
      title: '2-1 · 幻惑九尾狐姬 · 玉藻',
      bossSprite: 'assets/alchemist/monsters/boss_04_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_04_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_04_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_04_critical.webp',
      ruleDesc: '🦊 敌方技能【狐火倾城】：与人头牌共鸣，所有【J / Q / K / A】人头牌额外提供 +15 伤害！',
      targetScore: 1250,
      rewardGold: 9,
      bossRule: 'face_bonus_pixels'
    },
    {
      stageIndex: 5,
      act: 2,
      type: '深渊圣堂干部',
      isBoss: false,
      title: '2-2 · 堕落黑纱修女 · 克拉拉',
      bossSprite: 'assets/alchemist/monsters/boss_05_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_05_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_05_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_05_critical.webp',
      ruleDesc: '✝️ 敌方技能【背德告解】：所有【♥ 红心 / ♦ 方片】扑克牌额外提供 +2 倍率',
      targetScore: 1750,
      rewardGold: 10,
      bossRule: 'char_bonus_mult'
    },
    {
      stageIndex: 6,
      act: 2,
      type: '第二魔将 BOSS',
      isBoss: true,
      title: '2-3 · 【魔将】催眠魔将 · 梦魔女王梅露',
      bossSprite: 'assets/alchemist/monsters/boss_06_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_06_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_06_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_06_critical.webp',
      ruleDesc: '⏱️ 魔将技能【催眠怀表】：精神暗示下，唯有打出【顺子 / 同花 / 满堂红 / 四条炸弹 / 同花顺】可破除催眠并额外 +4 倍率！',
      targetScore: 2500,
      rewardGold: 13,
      bossRule: 'triad_boost'
    },
    {
      stageIndex: 7,
      act: 3,
      type: '王座黑化禁卫',
      isBoss: false,
      title: '3-1 · 背德黑化圣女 · 贞德·Alter',
      bossSprite: 'assets/alchemist/monsters/boss_07_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_07_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_07_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_07_critical.webp',
      ruleDesc: '🩸 敌方技能【背德圣咏】：若单次出牌伤害低于 220，黑化圣女会吸收魔力回复 70 HP！打出高倍大招一举击穿她！',
      targetScore: 3400,
      rewardGold: 12,
      bossRule: 'boss_regen_low_hit'
    },
    {
      stageIndex: 8,
      act: 3,
      type: '第三魔将 BOSS',
      isBoss: true,
      title: '3-2 · 【魔将】支配魔将 · 龙角黑骑士姬',
      bossSprite: 'assets/alchemist/monsters/boss_08_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_08_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_08_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_08_critical.webp',
      ruleDesc: '🐉 魔将技能【龙威激流】：战场魔力沸腾，所有扑克牌基础伤害 +15，尽情打出高倍连击！',
      targetScore: 4600,
      rewardGold: 14,
      bossRule: 'all_pixels_25'
    },
    {
      stageIndex: 9,
      act: 3,
      type: '终焉 NTR 魔王',
      isBoss: true,
      title: '3-3 · 【最终BOSS】终焉魅惑魔王 · 阿斯莫德',
      bossSprite: 'assets/alchemist/monsters/boss_09_anim.webp',
      bossAttackSprite: 'assets/alchemist/monsters/boss_09_attack.webp',
      bossHitSprite: 'assets/alchemist/monsters/boss_09_hit.webp',
      bossCriticalSprite: 'assets/alchemist/monsters/boss_09_critical.webp',
      ruleDesc: '👑 魔王技能【掠夺契约项圈】：单牌散牌倍率被彻底压制！打出高牌时最终倍率固定为 1！唯有依靠主角被动天赋、圣遗物与高阶牌型斩断契约击败魔王！',
      targetScore: 6200,
      rewardGold: 20,
      bossRule: 'final_boss_audit'
    }
  ];

  // =========================================================================
  // 8. 持久化存档与本局状态管理
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
          soundEnabled: parsed.soundEnabled !== false,
          heroIndex: Number(parsed.heroIndex) || 0
        };
      }
    } catch (_) {}
    return {
      unlockedCgs: ['cg_takagi_school'],
      bestHandScore: 0,
      bestStageCleared: 0,
      totalRunsWon: 0,
      crtEnabled: true,
      soundEnabled: true,
      heroIndex: 0
    };
  }

  function saveArchive() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
    } catch (_) {}
  }

  const archive = loadArchive();

  const state = {
    stageIndex: 1,
    endlessWave: 0,
    currentScore: 0,
    targetScore: 300,
    rendersLeft: MAX_HEARTS,
    rerollsLeft: 3,
    credits: 10,
    isAnimating: false,
    deck: [],
    drawPile: [],
    hand: [],
    selectedInstanceIds: new Set(),
    modules: [],
    synergyLevels: {},
    handPlayCounts: {},
    shopModules: [],
    shopUpgrades: [],
    currentCg: CG_GALLERY_DB[5],
    runBestHand: 0,
    heroIndex: archive.heroIndex % HERO_VANGUARDS.length,
    activeBookTab: 'hands'
  };

  // =========================================================================
  // 9. DOM 引用缓存
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
    dom.heartsLifeRow = document.getElementById('heartsLifeRow');
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
    dom.btnSuggestBest = document.getElementById('btnSuggestBest');

    dom.monitorRarityBadge = document.getElementById('monitorRarityBadge');
    dom.crtScreenFrame = document.getElementById('crtScreenFrame');
    dom.monitorCgImage = document.getElementById('monitorCgImage');
    dom.ssrFlashBurst = document.getElementById('ssrFlashBurst');
    dom.monitorCgTitle = document.getElementById('monitorCgTitle');
    dom.monitorScoreChip = document.getElementById('monitorScoreChip');
    dom.monitorPromptText = document.getElementById('monitorPromptText');
    dom.synergyMiniList = document.getElementById('synergyMiniList');

    // 魔王讨伐舞台 DOM
    dom.arenaBossTitle = document.getElementById('arenaBossTitle');
    dom.arenaBossHpText = document.getElementById('arenaBossHpText');
    dom.arenaBossHpBar = document.getElementById('arenaBossHpBar');
    dom.heroCombatantBox = document.getElementById('heroCombatantBox');
    dom.bossCombatantBox = document.getElementById('bossCombatantBox');
    dom.arenaHeroSprite = document.getElementById('arenaHeroSprite');
    dom.arenaHeroNameTag = document.getElementById('arenaHeroNameTag');
    dom.arenaBossSprite = document.getElementById('arenaBossSprite');
    dom.arenaBossSubTag = document.getElementById('arenaBossSubTag');

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
    dom.fullDeckGrid = document.getElementById('fullDeckGrid');
    dom.remainDeckGrid = document.getElementById('remainDeckGrid');
    dom.bookPaneHands = document.getElementById('bookPaneHands');
    dom.bookPaneFull = document.getElementById('bookPaneFull');
    dom.bookPaneRemain = document.getElementById('bookPaneRemain');

    dom.runEndModal = document.getElementById('runEndModal');
    dom.runEndTag = document.getElementById('runEndTag');
    dom.runEndTitle = document.getElementById('runEndTitle');
    dom.runEndDesc = document.getElementById('runEndDesc');
    dom.runStatsGrid = document.getElementById('runStatsGrid');
    dom.btnEndlessMode = document.getElementById('btnEndlessMode');
  }

  // =========================================================================
  // 10. 标准扑克牌型识别引擎 (支持 2~14 全点数顺子、A-2-3-4-5 顺子、四花色同花)
  // =========================================================================
  function getStageConfig() {
    if (state.stageIndex <= BLIND_STAGES.length) {
      return BLIND_STAGES[state.stageIndex - 1];
    }
    const extra = state.stageIndex - BLIND_STAGES.length;
    const bossIdx = ((extra - 1) % 9) + 1;
    return {
      stageIndex: state.stageIndex,
      act: 4,
      type: '♾️ 无尽深渊',
      isBoss: extra % 2 === 0,
      title: `无尽深渊 Wave ${extra} · 觉醒魔神`,
      bossSprite: `assets/alchemist/monsters/boss_0${bossIdx}_anim.webp`,
      bossAttackSprite: `assets/alchemist/monsters/boss_0${bossIdx}_attack.webp`,
      ruleDesc: '🔥 深渊狂暴环境：魔王生命值飙升，利用顺势转、三才两合与四方已定极限突破！',
      targetScore: Math.round(6000 * Math.pow(1.4, extra)),
      rewardGold: 15,
      bossRule: 'triad_boost'
    };
  }

  function getMaxPlayableCards() {
    const cfg = getStageConfig();
    return cfg.bossRule === 'max_4_cards' ? 4 : MAX_PLAY_CARDS;
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

  // 判断一组点数是否能组成长度为 reqLen 的顺子 (支持 2..14 以及 A=1 的 A-2-3-4-5)
  function checkIsStraight(normalRanks, wildCount, totalSelected, reqLen) {
    if (totalSelected < reqLen) return false;
    const uniqueRanks = Array.from(new Set(normalRanks)).sort((a, b) => a - b);
    if (uniqueRanks.length + wildCount < reqLen) return false;
    if (uniqueRanks.length === 0) return totalSelected >= reqLen;

    // 1. 常规窗口 (start = 2 .. 15 - reqLen)
    for (let start = 2; start <= 15 - reqLen; start++) {
      const end = start + reqLen - 1;
      let inWindow = 0;
      for (const r of uniqueRanks) {
        if (r >= start && r <= end) inWindow++;
      }
      if (inWindow + wildCount >= reqLen && inWindow === uniqueRanks.length) {
        return true;
      }
    }

    // 2. A-2-3-4-5 低顺判定 (将 A=14 视作 1)
    if (uniqueRanks.includes(14)) {
      const lowAceRanks = uniqueRanks.map((r) => (r === 14 ? 1 : r)).sort((a, b) => a - b);
      let inWindow = 0;
      for (const r of lowAceRanks) {
        if (r >= 1 && r <= reqLen) inWindow++;
      }
      if (inWindow + wildCount >= reqLen && inWindow === lowAceRanks.length) {
        return true;
      }
    }
    return false;
  }

  // 核心扑克牌型评估函数 (对应参考图2的 9 种固定点数牌型)
  function evaluatePromptSynergy(selectedCards) {
    if (!selectedCards || selectedCards.length === 0) {
      return null;
    }

    const reqStraightFlushLen = getMaxPlayableCards() === 4 ? 4 : 5;
    let wildCount = 0;
    const rankCounts = {};
    const pokerSuitCounts = { spade: 0, heart: 0, club: 0, diamond: 0 };
    const normalRanks = [];

    selectedCards.forEach((c) => {
      if (c.isWild) {
        wildCount += 1;
      } else {
        const r = c.rank || 10;
        rankCounts[r] = (rankCounts[r] || 0) + 1;
        normalRanks.push(r);
      }
      if (c.pokerSuit) {
        pokerSuitCounts[c.pokerSuit] = (pokerSuitCounts[c.pokerSuit] || 0) + 1;
      }
    });

    const sortedFreqs = Object.values(rankCounts).sort((a, b) => b - a);
    const maxSameRank = (sortedFreqs[0] || 0) + wildCount;
    const secondSameRank = sortedFreqs[1] || 0;

    // 同花判定（5张同为 ♠/♥/♣/♦）
    const maxSuitCount = Math.max(
      pokerSuitCounts.spade,
      pokerSuitCounts.heart,
      pokerSuitCounts.club,
      pokerSuitCounts.diamond
    );
    const isFlush =
      selectedCards.length >= reqStraightFlushLen && maxSuitCount + wildCount >= reqStraightFlushLen;

    // 顺子判定
    const isStraight = checkIsStraight(normalRanks, wildCount, selectedCards.length, reqStraightFlushLen);

    // 葫芦判定 (3 + 2)
    const isFullHouse =
      selectedCards.length === 5 &&
      ((sortedFreqs[0] === 3 && sortedFreqs[1] === 2) ||
        (wildCount >= 1 && sortedFreqs[0] === 2 && sortedFreqs[1] === 2) ||
        (wildCount >= 1 && sortedFreqs[0] === 3 && sortedFreqs[1] === 1));

    let matched = PROMPT_SYNERGIES[8]; // 默认 high_card 初心 (高牌 5×1)

    if (isStraight && isFlush) {
      matched = PROMPT_SYNERGIES[0]; // 紫气东来 (同花顺 100×8)
    } else if (maxSameRank >= 4 && selectedCards.length >= 4) {
      matched = PROMPT_SYNERGIES[1]; // 四方已定 (四条 60×7)
    } else if (isFullHouse) {
      matched = PROMPT_SYNERGIES[2]; // 三才两合 (葫芦 40×4)
    } else if (isFlush) {
      matched = PROMPT_SYNERGIES[3]; // 同气连 (同花 35×4)
    } else if (isStraight) {
      matched = PROMPT_SYNERGIES[4]; // 顺势转 (顺子 30×4)
    } else if (maxSameRank >= 3 && selectedCards.length >= 3) {
      matched = PROMPT_SYNERGIES[5]; // 三星照 (三条 30×3)
    } else if (
      (sortedFreqs[0] >= 2 && secondSameRank >= 2) ||
      (wildCount >= 1 && sortedFreqs[0] >= 2 && selectedCards.length >= 4)
    ) {
      matched = PROMPT_SYNERGIES[6]; // 双喜 (两对 20×2)
    } else if (maxSameRank >= 2 && selectedCards.length >= 2) {
      matched = PROMPT_SYNERGIES[7]; // 知音 (对子 10×2)
    }

    const level = state.synergyLevels[matched.id] || 1;
    const cfg = getStageConfig();
    let bonusPixels = (level - 1) * 20;
    let bonusMult = (level - 1) * 2;

    if (
      cfg.bossRule === 'triad_boost' &&
      (matched.id === 'straight_flush' ||
        matched.id === 'four_bomb' ||
        matched.id === 'full_house' ||
        matched.id === 'flush_five' ||
        matched.id === 'straight_five')
    ) {
      bonusMult += 4;
    }

    const basePixels = matched.basePixels + bonusPixels;
    const baseMult = matched.baseMult + bonusMult;

    return {
      ...matched,
      level,
      tier: `等级${level}`,
      computedPixels: basePixels,
      computedMult: baseMult
    };
  }

  // 计算单张扑克牌在当前场地的实际伤害贡献
  function computeCardContribution(card) {
    const cfg = getStageConfig();
    const weightMult = card.weight || 1.0;

    let pix = Math.round(card.pixels * weightMult);
    let mult = Math.round((card.mult || 0) * weightMult);
    const xMult = card.xMult || 1;

    if (cfg.bossRule === 'light_bonus_pixels' && (card.pokerSuit === 'spade' || card.pokerSuit === 'club')) {
      pix += 10;
    }
    if (cfg.bossRule === 'face_bonus_pixels' && card.isFace) {
      pix += 15;
    }
    if (cfg.bossRule === 'all_pixels_25') {
      pix += 15;
    }
    if (cfg.bossRule === 'char_bonus_mult' && (card.pokerSuit === 'heart' || card.pokerSuit === 'diamond')) {
      mult += 2;
    }

    return { pixels: pix, mult, xMult, wasPurified: false };
  }

  // 统一出牌结算引擎：预览与实际出牌共用同一套计算，保证「预计伤害 == 实际伤害」
  // 返回最终 pixels/mult/total 以及逐步结算记录 steps（供出牌动画逐条播放）
  const round1 = (v) => Math.round(v * 10) / 10;

  function computeHandScore(selectedCards) {
    const syn = evaluatePromptSynergy(selectedCards);
    if (!syn) {
      return { pixels: 0, mult: 0, total: 0, synergy: null, steps: [] };
    }

    const steps = [];
    let pixels = syn.computedPixels;
    let mult = syn.computedMult;
    const pushStep = (step) => steps.push({ ...step, pixels, mult });

    // 1. 逐张扑克牌点数结算
    selectedCards.forEach((card) => {
      const c = computeCardContribution(card);
      pixels += c.pixels;
      mult += c.mult;
      if (c.xMult && c.xMult !== 1) {
        mult = round1(mult * c.xMult);
      }
      pushStep({ kind: 'card', card, addPixels: c.pixels, addMult: c.mult });
    });

    const pokerSuitCounts = { spade: 0, heart: 0, club: 0, diamond: 0 };
    let faceCount = 0;
    selectedCards.forEach((c) => {
      if (c.pokerSuit) pokerSuitCounts[c.pokerSuit] = (pokerSuitCounts[c.pokerSuit] || 0) + 1;
      if (c.isFace) faceCount += 1;
    });
    const blackCnt = pokerSuitCounts.spade + pokerSuitCounts.club;

    const isPairOrBetter = syn.id !== 'high_card';
    const isFiveCardCombo = ['straight_flush', 'full_house', 'flush_five', 'straight_five'].includes(syn.id);
    const hero = HERO_VANGUARDS[state.heroIndex] || HERO_VANGUARDS[0];

    // 2. 本回合临时增幅（旧版主动战技遗留字段，目前恒为 0）
    if (state.nextHandBonusPixels || state.nextHandBonusMult) {
      pixels += state.nextHandBonusPixels || 0;
      mult += state.nextHandBonusMult || 0;
      pushStep({ kind: 'bonus', text: `+${state.nextHandBonusPixels || 0}伤 +${state.nextHandBonusMult || 0}倍`, isX: false });
    }

    // 3. 主角专属被动天赋结算
    let heroText = null;
    let heroIsX = false;
    if (hero.key === 'takagi' && ['one_pair', 'two_pair', 'three_kind', 'full_house'].includes(syn.id)) {
      mult += 2;
      heroText = '+2 倍率';
    } else if (hero.key === 'marin' && ['flush_five', 'straight_flush'].includes(syn.id)) {
      mult += 4;
      heroText = '+4 倍率';
    } else if (hero.key === 'kaguya' && faceCount > 0) {
      pixels += faceCount * 15;
      mult += faceCount * 1;
      heroText = `+${faceCount * 15}伤 +${faceCount}倍`;
    } else if (hero.key === 'kuroneko' && ['four_bomb', 'full_house'].includes(syn.id)) {
      mult = round1(mult * 1.35);
      heroText = '×1.35 倍率!';
      heroIsX = true;
    } else if (hero.key === 'aili' && ['straight_five', 'straight_flush', 'two_pair'].includes(syn.id)) {
      pixels += 35;
      mult += 3;
      heroText = '+35伤 +3倍';
    } else if (hero.key === 'qianhe' && state.rerollsLeft > 0) {
      pixels += state.rerollsLeft * 25;
      heroText = `+${state.rerollsLeft * 25} 伤害`;
    } else if (hero.key === 'mai' && blackCnt > 0) {
      pixels += blackCnt * 12;
      mult += blackCnt * 1;
      heroText = `+${blackCnt * 12}伤 +${blackCnt}倍`;
    } else if (hero.key === 'yukino' && ['three_kind', 'four_bomb', 'straight_flush'].includes(syn.id)) {
      pixels += 45;
      mult += 3;
      heroText = '+45伤 +3倍';
    }
    if (heroText) {
      pushStep({ kind: 'hero', text: `🌟 ${hero.shortName}天赋 ${heroText}`, isX: heroIsX });
    }

    // 4. 依次触发道具栏宝物
    state.modules.forEach((mod, modIndex) => {
      let text = null;
      let isX = false;
      if (mod.effectType === 'per_suit_mult' && pokerSuitCounts[mod.targetPokerSuit] > 0) {
        const addM = pokerSuitCounts[mod.targetPokerSuit] * mod.val;
        mult += addM;
        text = `+${addM} 倍率`;
      } else if (mod.effectType === 'per_suit_pixels' && pokerSuitCounts[mod.targetPokerSuit] > 0) {
        const addP = pokerSuitCounts[mod.targetPokerSuit] * mod.val;
        pixels += addP;
        text = `+${addP} 伤害`;
      } else if (mod.effectType === 'face_card_boost' && faceCount > 0) {
        const addP = faceCount * mod.valPixels;
        const addM = faceCount * mod.valMult;
        pixels += addP;
        mult += addM;
        text = `+${addP}伤 +${addM}倍`;
      } else if (mod.effectType === 'per_black_suit_hybrid' && blackCnt > 0) {
        const addP = blackCnt * mod.valPixels;
        const addM = blackCnt * mod.valMult;
        pixels += addP;
        mult += addM;
        text = `+${addP}伤 +${addM}倍`;
      } else if (mod.effectType === 'starter_abacus_boost') {
        pixels += mod.valPixels;
        if (isPairOrBetter) {
          mult = round1(mult * mod.val);
          text = `+${mod.valPixels}伤 ×${mod.val}倍`;
          isX = true;
        } else {
          text = `+${mod.valPixels} 伤害`;
        }
      } else if (mod.effectType === 'flat_mult') {
        mult += mod.val;
        text = `+${mod.val} 倍率`;
      } else if (mod.effectType === 'flat_pixels') {
        pixels += mod.val;
        text = `+${mod.val} 伤害`;
      } else if (mod.effectType === 'reroll_scaling_mult' && state.rerollsLeft > 0) {
        const addM = state.rerollsLeft * mod.val;
        mult += addM;
        text = `+${addM} 倍率`;
      } else if (mod.effectType === 'economy_mult') {
        mult += mod.val;
        text = `+${mod.val} 倍率`;
      } else if (mod.effectType === 'global_xmult') {
        mult = round1(mult * mod.val);
        text = `×${mod.val} 倍率!`;
        isX = true;
      } else if (
        mod.effectType === 'five_cards_xmult' &&
        (selectedCards.length >= getMaxPlayableCards() || isFiveCardCombo)
      ) {
        mult = round1(mult * mod.val);
        text = `×${mod.val} 倍率!`;
        isX = true;
      } else if (mod.effectType === 'multi_char_xmult' && isPairOrBetter) {
        mult = round1(mult * mod.val);
        text = `×${mod.val} 倍率!`;
        isX = true;
      }
      if (text) {
        pushStep({ kind: 'module', modIndex, text, isX });
      }
    });

    // 5. 濒死战损觉醒加成 (倍率 ×1.25，长瀞被动提升至 ×1.65)
    if (isHeroInCriticalState()) {
      const critMult = hero.key === 'nagatoro' ? 1.65 : 1.25;
      mult = round1(mult * critMult);
      pushStep({ kind: 'critical', text: `💔 爆衣觉醒 ×${critMult}!`, isX: true });
    }

    // 6. 最终魔王【掠夺契约项圈】：单牌散牌（高牌）的倍率被彻底压制为 ×1
    const cfg = getStageConfig();
    if (cfg.bossRule === 'final_boss_audit' && syn.id === 'high_card' && mult !== 1) {
      mult = 1;
      pushStep({ kind: 'boss', text: '👑 契约项圈：散牌倍率被压制为 1!', isX: true });
    }

    const total = Math.round(pixels * mult);
    return {
      pixels: Math.round(pixels),
      mult: round1(mult),
      total,
      synergy: syn,
      steps
    };
  }

  function calculatePreviewScore(selectedCards) {
    return computeHandScore(selectedCards);
  }

  // 💡 智能选牌提示：仅在玩家按下「💡 提示」按钮时触发；
  //    穷举手牌中所有正面朝上的 1~maxPlay 张组合，找出总伤害最高的一手（盖住的盲牌视为未知，不参与搜索）
  function getHintableCards() {
    return state.hand.filter((c) => !c.isFaceDown);
  }

  function suggestBestHand() {
    if (state.isAnimating) return;
    const pool = getHintableCards();
    if (pool.length === 0) {
      sfx.playGlitchBuzz();
      return;
    }
    const maxPlay = getMaxPlayableCards();
    const n = pool.length;
    let bestCombo = [];
    let bestScore = -1;

    function dfs(startIdx, currentCombo) {
      if (currentCombo.length > 0 && currentCombo.length <= maxPlay) {
        const res = calculatePreviewScore(currentCombo);
        if (res.total > bestScore) {
          bestScore = res.total;
          bestCombo = currentCombo.slice();
        }
      }
      if (currentCombo.length === maxPlay) return;
      for (let i = startIdx; i < n; i++) {
        currentCombo.push(pool[i]);
        dfs(i + 1, currentCombo);
        currentCombo.pop();
      }
    }

    dfs(0, []);

    if (bestCombo.length > 0) {
      state.selectedInstanceIds.clear();
      bestCombo.forEach((c) => state.selectedInstanceIds.add(c.instanceId));
      sfx.playClick(true);
      renderAll();
    }
  }

  // =========================================================================
  // 11. 人头牌 (J/Q/K/A) 牌面映射：J/Q/K 使用经典上下对称双头宫廷插画，A 仅用皇家底图 + 大花色 + 4状态立绘与双特写插屏
  // =========================================================================
  function getFaceCardPortrait(card) {
    if (card.rank === 13) return 'assets/alchemist/cards/poker_court_K.webp';
    if (card.rank === 12) return 'assets/alchemist/cards/poker_court_Q.webp';
    if (card.rank === 11) return 'assets/alchemist/cards/poker_court_J.webp';
    return null; // A 没有宫廷插画，避免误显示 J 的立绘
  }

  let forceCriticalPreview = false;

  function isHeroInCriticalState() {
    return forceCriticalPreview || state.rendersLeft <= 2;
  }

  const arenaVfx = {
    canvas: null,
    ctx: null,
    particles: [],
    slashes: [],
    rings: [],
    lastTime: performance.now(),
    init() {
      this.canvas = document.getElementById('arenaVfxCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      const resize = () => {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = Math.max(480, rect.width);
        this.canvas.height = Math.max(200, rect.height);
      };
      resize();
      window.addEventListener('resize', resize);

      for (let i = 0; i < 24; i++) {
        this.particles.push(this.makeAmbientParticle());
      }
      const loop = (now) => {
        this.lastTime = now;
        this.updateAndDraw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    makeAmbientParticle() {
      const isLeftHero = Math.random() < 0.5;
      return {
        x: isLeftHero ? 80 + Math.random() * 180 : 380 + Math.random() * 220,
        y: 50 + Math.random() * 160,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.35 - Math.random() * 0.75,
        r: 1.6 + Math.random() * 2.4,
        alpha: 0.22 + Math.random() * 0.5,
        color: isLeftHero ? '#38bdf8' : '#f43f5e',
        ambient: true
      };
    },
    fireAttack(suit, isHeavy = false) {
      if (!this.canvas) return;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const targetX = w * 0.76 + (Math.random() * 34 - 17);
      const targetY = h * 0.54 + (Math.random() * 30 - 15);
      const colorMap = {
        char: '#fb7185',
        light: '#38bdf8',
        expr: '#fbbf24',
        glitch: '#e879f9'
      };
      const col = colorMap[suit] || '#fbbf24';

      this.slashes.push({
        x1: w * 0.24,
        y1: h * 0.56,
        x2: targetX,
        y2: targetY,
        angle: (Math.random() - 0.5) * 1.3,
        life: 1.0,
        color: col,
        width: isHeavy ? 8 : 5
      });

      this.rings.push({
        x: targetX,
        y: targetY,
        r: 8,
        maxR: isHeavy ? 105 : 64,
        life: 1.0,
        color: col
      });

      const count = isHeavy ? 28 : 14;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * (isHeavy ? 7 : 4.2);
        this.particles.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          r: 2 + Math.random() * 3.2,
          alpha: 1.0,
          color: col,
          ambient: false
        });
      }
    },
    fireBossCounter() {
      if (!this.canvas) return;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const heroX = w * 0.24;
      const heroY = h * 0.56;
      this.slashes.push({
        x1: w * 0.76,
        y1: h * 0.54,
        x2: heroX,
        y2: heroY,
        angle: -0.4,
        life: 1.0,
        color: '#f43f5e',
        width: 7
      });
      this.rings.push({
        x: heroX,
        y: heroY,
        r: 10,
        maxR: 80,
        life: 1.0,
        color: '#f43f5e'
      });
    },
    updateAndDraw() {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.ambient) {
          if (p.y < 15) {
            p.y = h - 18;
            p.x = Math.random() < 0.5 ? w * 0.14 + Math.random() * (w * 0.22) : w * 0.64 + Math.random() * (w * 0.24);
          }
        } else {
          p.alpha -= 0.04;
          if (p.alpha <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = this.slashes.length - 1; i >= 0; i--) {
        const s = this.slashes[i];
        s.life -= 0.07;
        if (s.life <= 0) {
          this.slashes.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = s.life;
        ctx.strokeStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 15;
        ctx.lineWidth = s.width * s.life;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.quadraticCurveTo((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 40 * s.angle, s.x2, s.y2);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = this.rings.length - 1; i >= 0; i--) {
        const rg = this.rings[i];
        rg.r += (rg.maxR - rg.r) * 0.22;
        rg.life -= 0.06;
        if (rg.life <= 0) {
          this.rings.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = rg.life;
        ctx.strokeStyle = rg.color;
        ctx.shadowColor = rg.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3.5 * rg.life;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  /**
   * 触发全屏斜切漫画分镜特写插屏 (Anime Cut-in)
   * @param {Object} hero 当前出战女主
   * @param {String} skillLabel 招式名或战损提示
   * @param {'attack'|'critical'} mode 'attack' = 攻击前必杀奥义插屏, 'critical' = 濒死爆衣破防插屏
   */
  let cutinTimer = null;
  let currentVoiceAudio = null;
  const bubbleTimers = {};

  function playVoiceAndBubble(voiceUrl, bubbleId, quoteText) {
    if (quoteText && bubbleId) {
      const bEl = document.getElementById(bubbleId);
      if (bEl) {
        bEl.textContent = quoteText;
        bEl.classList.remove('hidden');
        if (bubbleTimers[bubbleId]) clearTimeout(bubbleTimers[bubbleId]);
        bubbleTimers[bubbleId] = setTimeout(() => {
          bEl.classList.add('hidden');
        }, 3200);
      }
    }
    if (!sfx.enabled || !voiceUrl) return;
    try {
      if (currentVoiceAudio) {
        currentVoiceAudio.pause();
        currentVoiceAudio.currentTime = 0;
      }
      const audio = new Audio(voiceUrl);
      audio.volume = 0.88;
      currentVoiceAudio = audio;
      audio.play().catch(() => {});
    } catch (_) {}
  }

  function triggerArenaCutin(hero, skillLabel, mode = 'attack') {
    const banner = document.getElementById('arenaCutinBanner');
    const img = document.getElementById('arenaCutinImg');
    const badge = document.getElementById('arenaCutinBadge');
    const txt = document.getElementById('arenaCutinSkill');
    const quote = document.getElementById('arenaCutinQuote');
    if (!banner || !img || !txt) return;

    const sIdx = ((state.stageIndex - 1) % 9) + 1;
    const bossId = `boss_0${sIdx}`;

    banner.classList.remove('mode-critical', 'mode-boss');
    if (mode === 'critical') {
      banner.classList.add('mode-critical');
      img.src = hero.criticalSprite;
      if (badge) badge.textContent = '💔 战损特写 CG';
      txt.textContent = `${hero.shortName} · ${skillLabel}`;
      const q = hero.criticalQuote || '「就算衣服破损……也绝不会低头！」';
      if (quote) quote.textContent = q;
      playVoiceAndBubble(`assets/alchemist/voices/${hero.key}_critical.wav`, 'heroSpeechBubble', q);
    } else if (mode === 'boss-critical') {
      banner.classList.add('mode-critical');
      img.src = hero.bossCriticalSprite || hero.bossSprite;
      if (badge) badge.textContent = '💥 战损特写 CG';
      txt.textContent = skillLabel;
      const q = hero.bossQuote || '「咕呜……衣服居然被打破了……别得意忘形！」';
      if (quote) quote.textContent = q;
      playVoiceAndBubble(`assets/alchemist/voices/${bossId}_critical.wav`, 'bossSpeechBubble', q);
    } else if (mode === 'boss') {
      banner.classList.add('mode-boss');
      img.src = hero.bossAttackSprite || hero.bossSprite;
      if (badge) badge.textContent = '💋 对手技能 CG';
      txt.textContent = skillLabel;
      const q = hero.bossQuote || '「哼哼，把你的底牌乖乖翻过来吧~！」';
      if (quote) quote.textContent = q;
      playVoiceAndBubble(`assets/alchemist/voices/${bossId}_attack.wav`, 'bossSpeechBubble', q);
    } else {
      img.src = hero.attackSprite;
      if (badge) badge.textContent = '✨ 角色特写 CG';
      txt.textContent = `${hero.shortName} · ${skillLabel}`;
      const q = hero.attackQuote || '「接招吧！这一手牌定胜负！」';
      if (quote) quote.textContent = q;
      playVoiceAndBubble(`assets/alchemist/voices/${hero.key}_attack.wav`, 'heroSpeechBubble', q);
    }

    banner.classList.remove('hidden');
    // Force reflow so animation restarts cleanly
    void banner.offsetWidth;
    if (cutinTimer) clearTimeout(cutinTimer);
    cutinTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 1150);
  }

  function renderHeroRosterBar() {
    const bar = document.getElementById('heroRosterBar');
    if (!bar) return;
    bar.innerHTML = '';
    HERO_VANGUARDS.forEach((h, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `roster-avatar-btn${idx === state.heroIndex ? ' active' : ''}`;
      btn.innerHTML = `<img src="${h.avatar}" alt="${h.shortName}" /><span>${h.shortName}</span>`;
      btn.addEventListener('click', () => {
        if (state.isAnimating) return;
        state.heroIndex = idx;
        archive.heroIndex = idx;
        saveArchive();
        sfx.playClick(true);
        renderBossArena(getStageConfig());
        renderHeroRosterBar();
      });
      bar.appendChild(btn);
    });
  }

  function getSelectedCardsInOrder() {
    return state.hand.filter((c) => state.selectedInstanceIds.has(c.instanceId));
  }

  // =========================================================================
  // 12. 界面与纯正经典扑克牌渲染 (4状态半身像切换：正常/攻击/受击/濒死战损)
  // =========================================================================
  function isBossInCriticalState() {
    if (state.forceCriticalPreview) return true;
    const remainingHp = Math.max(0, state.targetScore - state.currentScore);
    return remainingHp > 0 && remainingHp <= state.targetScore * 0.45;
  }

  function renderBossArena(cfg) {
    const hero = HERO_VANGUARDS[state.heroIndex] || HERO_VANGUARDS[0];
    const inCritical = isHeroInCriticalState();
    const bossInCritical = isBossInCriticalState();

    if (dom.arenaHeroSprite && !state.isAnimating) {
      const targetSprite = inCritical ? hero.criticalSprite : hero.idleSprite;
      if (!dom.arenaHeroSprite.src.endsWith(targetSprite)) {
        dom.arenaHeroSprite.src = targetSprite;
      }
    }
    if (dom.heroCombatantBox) {
      dom.heroCombatantBox.classList.toggle('hero-critical', inCritical);
    }
    if (dom.arenaHeroNameTag) {
      const critLabel = hero.key === 'nagatoro' ? '×1.65' : '×1.25';
      dom.arenaHeroNameTag.textContent = inCritical ? `💔 ${hero.shortName} · 濒死爆衣(${critLabel})` : hero.name;
    }
    const passiveEl = document.getElementById('heroPassiveDesc');
    if (passiveEl) {
      passiveEl.textContent = hero.passiveDesc || '';
    }
    const activeNameEl = document.getElementById('heroActiveSkillName');
    if (activeNameEl) {
      activeNameEl.textContent = hero.activeSkillName || '主角战技';
    }
    const chargesEl = document.getElementById('heroSkillCharges');
    if (chargesEl) {
      chargesEl.textContent = `${state.heroSkillUsesLeft ?? 2}/2`;
    }
    const activeBtn = document.getElementById('btnHeroActiveSkill');
    if (activeBtn) {
      activeBtn.title = `${hero.activeSkillName}：${hero.activeSkillDesc}`;
      activeBtn.disabled = state.isAnimating || (state.heroSkillUsesLeft ?? 2) <= 0;
    }
    if (dom.arenaBossSprite && cfg.bossSprite && !state.isAnimating) {
      const targetBossSprite = bossInCritical && cfg.bossCriticalSprite ? cfg.bossCriticalSprite : cfg.bossSprite;
      if (!dom.arenaBossSprite.src.endsWith(targetBossSprite)) {
        dom.arenaBossSprite.src = targetBossSprite;
      }
    }
    if (dom.arenaBossTitle) {
      dom.arenaBossTitle.textContent = `👾 ${cfg.title}`;
    }

    const remainingHp = Math.max(0, state.targetScore - state.currentScore);
    const hpPct = Math.max(0, Math.min(100, Math.round((remainingHp / state.targetScore) * 100)));
    if (dom.arenaBossHpText) {
      dom.arenaBossHpText.textContent = `HP ${remainingHp.toLocaleString()} / ${state.targetScore.toLocaleString()}`;
    }
    if (dom.arenaBossHpBar) {
      dom.arenaBossHpBar.style.width = `${hpPct}%`;
    }
    if (dom.arenaBossSubTag) {
      dom.arenaBossSubTag.textContent = bossInCritical
        ? '💔 魔将战损破防 · 濒死爆衣'
        : cfg.type || (cfg.isBoss ? '👑 魔将/魔王' : '💋 魔城干部');
    }
    if (dom.bossCombatantBox) {
      dom.bossCombatantBox.classList.toggle('boss-critical', bossInCritical);
      dom.bossCombatantBox.classList.toggle('boss-defeated', remainingHp <= 0);
    }
  }

  // 渲染 5 颗红心生命条 (对应参考图1正下方的 ❤️ ❤️ ❤️ ❤️ ❤️)
  function renderHeartsRow() {
    if (!dom.heartsLifeRow) return;
    dom.heartsLifeRow.innerHTML = '';
    for (let i = 0; i < MAX_HEARTS; i++) {
      const span = document.createElement('span');
      const isLost = i >= state.rendersLeft;
      span.className = `heart-gem${isLost ? ' lost' : ''}`;
      span.textContent = '❤️';
      dom.heartsLifeRow.appendChild(span);
    }
  }

  function renderAll() {
    const cfg = getStageConfig();
    state.targetScore = cfg.targetScore;

    if (dom.actBadge) {
      dom.actBadge.textContent =
        state.stageIndex <= 9 ? `第 ${state.stageIndex} / 9 关` : `无尽 Wave ${state.stageIndex - 9}`;
    }
    if (dom.blindTypeBadge) dom.blindTypeBadge.textContent = cfg.type;
    if (dom.blindTitle) dom.blindTitle.textContent = cfg.title;
    if (dom.blindRuleDesc) dom.blindRuleDesc.textContent = cfg.ruleDesc;

    renderBossArena(cfg);
    renderHeartsRow();

    if (dom.rendersLeftDisplay) dom.rendersLeftDisplay.textContent = String(state.rendersLeft);
    if (dom.rerollsLeftDisplay) dom.rerollsLeftDisplay.textContent = String(state.rerollsLeft);
    if (dom.creditsDisplay) dom.creditsDisplay.textContent = String(state.credits);
    if (dom.deckCountDisplay) {
      dom.deckCountDisplay.textContent = `${state.drawPile.length}/${state.deck.length}`;
    }
    if (dom.galleryCountBadge) {
      dom.galleryCountBadge.textContent = `${archive.unlockedCgs.length}/${CG_GALLERY_DB.length}`;
    }

    renderJokerSlots();

    const selected = getSelectedCardsInOrder();
    const maxPlay = getMaxPlayableCards();

    // 选中牌里含盖住的盲牌时，预览不能按其真实点数泄露牌型与伤害
    const hasFaceDownSelected = selected.some((c) => c.isFaceDown);
    const preview = hasFaceDownSelected ? null : calculatePreviewScore(selected);
    if (!state.isAnimating) {
      if (hasFaceDownSelected) {
        dom.synergyTierBadge.textContent = '盲牌';
        dom.synergyNameDisplay.textContent = '??? (含盲牌)';
        dom.basePixelsDisplay.textContent = '?';
        dom.aestheticMultDisplay.textContent = '?';
        dom.previewTotalNumber.textContent = '???';
      } else if (preview.synergy) {
        dom.synergyTierBadge.textContent = preview.synergy.tier;
        dom.synergyNameDisplay.textContent = preview.synergy.name;
        dom.basePixelsDisplay.textContent = String(preview.pixels);
        dom.aestheticMultDisplay.textContent = String(preview.mult);
        dom.previewTotalNumber.textContent = preview.total.toLocaleString();
      } else {
        dom.synergyTierBadge.textContent = '等级1';
        dom.synergyNameDisplay.textContent = `请选择 1~${maxPlay} 张扑克牌`;
        dom.basePixelsDisplay.textContent = '0';
        dom.aestheticMultDisplay.textContent = '0';
        dom.previewTotalNumber.textContent = '0';
      }
    }

    // 每次渲染确保手牌按点数从大到小自动整理
    sortHandByRankDesc();
    renderHandCards();

    dom.btnPlayHand.disabled = state.isAnimating || selected.length === 0 || state.rendersLeft <= 0;
    dom.btnDiscard.disabled = state.isAnimating || selected.length === 0 || state.rerollsLeft <= 0;
    if (dom.btnSuggestBest) {
      dom.btnSuggestBest.disabled = state.isAnimating || getHintableCards().length === 0;
    }
  }

  // 触屏设备或窄屏 (≤720px) 下，悬浮说明卡片改为点按切换
  function isTapPopoverMode() {
    return !!(window.matchMedia && window.matchMedia('(hover: none), (max-width: 720px)').matches);
  }

  function closeTapPopovers() {
    document.querySelectorAll('.joker-chip-card.pop-open').forEach((el) => el.classList.remove('pop-open'));
    if (dom.heroCombatantBox) dom.heroCombatantBox.classList.remove('show-passive');
  }

  // 手牌正上方道具栏：展示白/蓝/紫/红品质光晕与纯图标，鼠标悬浮时弹出名称、品质、介绍与出售按钮
  function renderJokerSlots() {
    if (!dom.jokerSlotsRow) return;
    dom.jokerSlotsRow.innerHTML = '';

    for (let i = 0; i < MAX_MODULES; i++) {
      const mod = state.modules[i];
      const cell = document.createElement('div');
      if (mod) {
        const tier = mod.rarity || 'white';
        const tierLabel = mod.rarityLabel || '普通';
        const sellVal = mod.sellPrice || Math.max(2, Math.floor((mod.cost || 4) / 2));
        cell.className = `joker-chip-card icon-only-slot rarity-${tier}`;
        cell.dataset.modIndex = String(i);
        cell.innerHTML = `
          <img src="${mod.icon}" alt="${mod.name}" class="joker-only-icon" />
          <span class="slot-rarity-dot dot-${tier}"></span>
          <div class="joker-hover-pop">
            <div class="joker-pop-head">
              <div>
                <span class="rarity-pill pill-${tier}">${tierLabel}</span>
                <strong>${mod.name}</strong>
              </div>
              <button type="button" class="joker-sell-btn" data-sell-idx="${i}">出售 +🪙${sellVal}</button>
            </div>
            <p class="joker-pop-desc">${mod.desc}</p>
          </div>
        `;
      } else {
        cell.className = 'joker-chip-card empty-slot icon-only-slot';
        cell.title = `道具空槽 ${i + 1}`;
        cell.innerHTML = `<span class="empty-plus">＋</span>`;
      }
      dom.jokerSlotsRow.appendChild(cell);
    }

    // 触屏/窄屏无法悬浮：点击宝物图标切换显示说明与出售按钮
    dom.jokerSlotsRow.querySelectorAll('.joker-chip-card[data-mod-index]').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        if (!isTapPopoverMode() || e.target.closest('[data-sell-idx]')) return;
        const willOpen = !cell.classList.contains('pop-open');
        closeTapPopovers();
        cell.classList.toggle('pop-open', willOpen);
      });
    });

    dom.jokerSlotsRow.querySelectorAll('[data-sell-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.isAnimating) return;
        const idx = Number(btn.getAttribute('data-sell-idx'));
        const removed = state.modules.splice(idx, 1)[0];
        if (removed) {
          const sellVal = removed.sellPrice || Math.max(2, Math.floor((removed.cost || 4) / 2));
          state.credits += sellVal;
          sfx.playCash();
          renderAll();
        }
      });
    });
  }

  // 渲染 8 张实体纹理扑克牌 (正常正面 vs 被 BOSS 技能翻转背面朝上显示 card_back_abyss.webp)
  function renderHandCards() {
    if (!dom.holoHandRow) return;
    dom.holoHandRow.innerHTML = '';

    state.hand.forEach((card) => {
      const isSelected = state.selectedInstanceIds.has(card.instanceId);
      const contrib = computeCardContribution(card);
      const isFaceDown = !!card.isFaceDown;

      const cardEl = document.createElement('div');
      cardEl.className = [
        'classic-playing-card',
        card.colorClass || 'suit-spade',
        card.isFace ? 'is-face-card' : '',
        isFaceDown ? 'is-facedown' : '',
        isSelected ? 'selected' : ''
      ]
        .filter(Boolean)
        .join(' ');
      cardEl.dataset.instanceId = card.instanceId;

      if (isFaceDown) {
        cardEl.title = '被魔将技能【魅惑盖牌】翻转背面朝上！可盲猜打出翻开，或弃牌重抽。';
        cardEl.innerHTML = `
          <span class="facedown-seal-badge">🔮 魅惑盲牌</span>
        `;
      } else {
        const portrait = card.isFace ? getFaceCardPortrait(card) : null;
        const centerGraphicHtml = portrait
          ? `<img src="${portrait}?v=11" alt="${card.zhName}" class="poker-face-portrait" loading="lazy" />`
          : `<div class="poker-big-pip">${card.suitSymbol}</div>`;

        cardEl.innerHTML = `
          <div class="poker-corner-tl">
            <span class="poker-rank-num">${card.rankLabel}</span>
            <span class="poker-suit-small">${card.suitSymbol}</span>
          </div>
          ${centerGraphicHtml}
          <span class="poker-chip-tag">+${contrib.pixels}</span>
        `;
      }

      cardEl.addEventListener('click', () => {
        if (state.isAnimating) return;
        const maxPlay = getMaxPlayableCards();
        if (state.selectedInstanceIds.has(card.instanceId)) {
          state.selectedInstanceIds.delete(card.instanceId);
          sfx.playClick(false);
        } else {
          if (state.selectedInstanceIds.size >= maxPlay) {
            sfx.playGlitchBuzz();
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

  // BOSS 专属翻牌/盖牌技能：将手牌中的若干张牌翻转背面朝上 (显示深渊牌背 card_back_abyss.webp)
  function applyBossCardFlipSkill(cfg) {
    // 先将旧盖牌恢复正面，再根据当前 BOSS 技能盖住新牌
    state.hand.forEach((c) => {
      c.isFaceDown = false;
    });
    if (state.hand.length === 0) return 0;

    const flipCount = cfg.isBoss ? 3 : 2;
    const candidates = shuffleArray(state.hand.slice());
    let flipped = 0;

    if (cfg.stageIndex === 3 || cfg.stageIndex === 6) {
      // 魔将优先翻转人头牌 (J/Q/K/A)
      state.hand.forEach((c) => {
        if (c.isFace && flipped < flipCount) {
          c.isFaceDown = true;
          flipped++;
        }
      });
    } else if (cfg.stageIndex === 9) {
      // 最终 NTR 魔王：间隔位置盖牌 (第 2, 4, 6 张)
      [1, 3, 5].forEach((idx) => {
        if (state.hand[idx]) {
          state.hand[idx].isFaceDown = true;
          flipped++;
        }
      });
    }

    for (let i = 0; i < candidates.length && flipped < flipCount; i++) {
      if (!candidates[i].isFaceDown) {
        candidates[i].isFaceDown = true;
        flipped++;
      }
    }
    return flipped;
  }

  // =========================================================================
  // 13. 出牌连锁跳字结算 + 角色 Spine 挥砍与 BOSS 受击动画
  // =========================================================================
  function spawnFloatingPopup(text, typeClass, anchorEl) {
    if (!dom.floatingPopupsLayer) return;
    const chip = document.createElement('div');
    chip.className = `score-pop-chip ${typeClass}`;
    chip.textContent = text;

    let leftPct = 50 + (Math.random() * 24 - 12);
    let topPct = 48 + (Math.random() * 16 - 8);

    if (anchorEl && dom.crtScreenFrame) {
      const parentRect = dom.crtScreenFrame.getBoundingClientRect();
      const rect = anchorEl.getBoundingClientRect();
      if (parentRect.width > 0) {
        leftPct = ((rect.left + rect.width / 2 - parentRect.left) / parentRect.width) * 100;
      }
    }

    chip.style.left = `${Math.max(15, Math.min(85, leftPct))}%`;
    chip.style.top = `${topPct}%`;
    dom.floatingPopupsLayer.appendChild(chip);

    setTimeout(() => {
      chip.remove();
    }, 860);
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

  // 可解锁 CG 的牌型（对应图鉴提示「打出顺子、同花顺或四条炸弹击败魔物即可点亮」）
  const CG_UNLOCK_HAND_IDS = ['straight_five', 'straight_flush', 'four_bomb'];

  function selectMatchingCg(selectedCards, handScore, synergy) {
    const charCard = selectedCards.find((c) => c.charKey);
    const preferredChar = charCard ? charCard.charKey : null;
    const wantSsr =
      handScore >= 400 ||
      ['straight_flush', 'four_bomb', 'full_house', 'flush_five', 'straight_five'].includes(synergy.id);

    let pool = CG_GALLERY_DB.filter((cg) => {
      if (preferredChar && cg.charKey === preferredChar) return true;
      return false;
    });

    if (pool.length === 0) {
      pool = wantSsr ? CG_GALLERY_DB.filter((cg) => cg.rarity === 'SSR') : CG_GALLERY_DB;
    }

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
    // 出牌瞬间，被盖住的盲牌翻转回正面揭晓真实点数！
    let hadFaceDown = false;
    selected.forEach((c) => {
      if (c.isFaceDown) {
        c.isFaceDown = false;
        hadFaceDown = true;
      }
    });
    if (hadFaceDown) {
      renderHandCards();
    }

    // 与预览共用同一套结算引擎（computeHandScore），动画只负责逐步播放结算记录
    const score = computeHandScore(selected);
    const syn = score.synergy;
    // 记录本局该牌型出牌次数 (用于参考图2的「次数」列)
    state.handPlayCounts[syn.id] = (state.handPlayCounts[syn.id] || 0) + 1;

    let runningPixels = syn.computedPixels;
    let runningMult = syn.computedMult;

    dom.synergyTierBadge.textContent = syn.tier;
    dom.synergyNameDisplay.textContent = syn.name;
    dom.basePixelsDisplay.textContent = String(runningPixels);
    dom.aestheticMultDisplay.textContent = String(runningMult);

    const hero = HERO_VANGUARDS[state.heroIndex] || HERO_VANGUARDS[0];
    // 切换至【状态2：出招攻击半身像】
    if (dom.arenaHeroSprite) {
      dom.arenaHeroSprite.src = hero.attackSprite;
    }
    if (dom.heroCombatantBox) {
      dom.heroCombatantBox.classList.add('hero-attacking');
    }
    // 【插屏1：攻击前特写插屏】打出对子及以上牌型时触发特写插屏；高牌则直接播放语音与台词气泡
    if (syn.id !== 'high_card') {
      triggerArenaCutin(hero, syn.name, 'attack');
      await sleep(360);
    } else {
      playVoiceAndBubble(`assets/alchemist/voices/${hero.key}_attack.wav`, 'heroSpeechBubble', hero.attackQuote);
    }

    let chainStep = 0;

    for (const step of score.steps) {
      if (step.kind === 'card') {
        // 1. 依次结算选中的每张扑克牌点数 (+2 ~ +11)
        const card = step.card;
        const cardEl = dom.holoHandRow.querySelector(`[data-instance-id="${card.instanceId}"]`);
        if (cardEl) {
          cardEl.classList.add('scoring-pulse');
        }

        await sleep(125);

        runningPixels += step.addPixels;
        dom.basePixelsDisplay.textContent = String(Math.round(runningPixels));
        bumpWell(dom.pixelsWell);
        sfx.playChainDing(chainStep++, false);
        spawnFloatingPopup(`${card.suitSymbol}${card.rankLabel} +${step.addPixels}`, 'type-pixels', cardEl);

        arenaVfx.fireAttack(card.suit, syn.id === 'four_bomb' || syn.id === 'straight_flush');
        const hitCfg = getStageConfig();
        if (dom.arenaBossSprite && hitCfg.bossHitSprite) {
          dom.arenaBossSprite.src = hitCfg.bossHitSprite;
        }
        if (dom.bossCombatantBox) {
          dom.bossCombatantBox.classList.remove('boss-damaged');
          void dom.bossCombatantBox.offsetWidth;
          dom.bossCombatantBox.classList.add('boss-damaged');
        }

        triggerStageShake(false);
        await sleep(110);

        if (step.addMult !== 0) {
          dom.aestheticMultDisplay.textContent = String(round1(step.mult));
          bumpWell(dom.multWell);
          sfx.playChainDing(chainStep++, false);
          spawnFloatingPopup(`+${step.addMult} 倍率`, 'type-mult', cardEl);
          await sleep(105);
        }
        runningPixels = step.pixels;
        runningMult = step.mult;

        if (cardEl) {
          cardEl.classList.remove('scoring-pulse');
        }
        continue;
      }

      // 2. 主角被动天赋 / 道具栏宝物 / 濒死觉醒 / 魔王规则 依次触发
      const modEl =
        step.kind === 'module' ? dom.jokerSlotsRow.querySelector(`[data-mod-index="${step.modIndex}"]`) : null;
      const anchorEl = step.kind === 'hero' ? dom.heroCombatantBox : step.kind === 'boss' ? dom.bossCombatantBox : null;
      runningPixels = step.pixels;
      runningMult = step.mult;
      if (modEl) modEl.classList.add('triggered');
      dom.basePixelsDisplay.textContent = String(Math.round(runningPixels));
      dom.aestheticMultDisplay.textContent = String(round1(runningMult));
      bumpWell(step.isX ? dom.multWell : dom.pixelsWell);
      sfx.playChainDing(chainStep++, step.isX);
      spawnFloatingPopup(step.text, step.isX ? 'type-xmult' : 'type-mult', anchorEl);
      if (step.kind === 'module') triggerStageShake(step.isX);
      await sleep(step.kind === 'module' ? 150 : 140);
      if (modEl) modEl.classList.remove('triggered');
    }

    // 消耗本回合临时加成
    state.nextHandBonusPixels = 0;
    state.nextHandBonusMult = 0;

    // 3. 汇总本手最终伤害并扣减 BOSS 生命值（与预览完全一致）
    const wasBossInCritical = isBossInCriticalState();
    const handTotal = score.total;
    dom.previewTotalNumber.textContent = handTotal.toLocaleString();
    state.currentScore += handTotal;
    state.runBestHand = Math.max(state.runBestHand, handTotal);
    if (handTotal > archive.bestHandScore) {
      archive.bestHandScore = handTotal;
    }

    // BOSS 专属特殊技能判定
    const stageCfg = getStageConfig();
    if (stageCfg.bossRule === 'steal_coin_on_highcard' && syn.id === 'high_card' && state.credits > 0) {
      state.credits = Math.max(0, state.credits - 1);
      spawnFloatingPopup('💋 莉莉姆偷走 1 铜钱!', 'type-mult', dom.bossCombatantBox);
    } else if (stageCfg.bossRule === 'boss_regen_low_hit' && handTotal < 220 && state.currentScore < state.targetScore) {
      state.currentScore = Math.max(0, state.currentScore - 70);
      spawnFloatingPopup('🩸 背德圣咏 +70 HP!', 'type-mult', dom.bossCombatantBox);
    }

    // 若本击首次将 BOSS 打入濒死爆衣破防线 (HP <= 45%)，触发【BOSS 战损爆衣破防插屏】并切换为爆衣立绘！
    if (!wasBossInCritical && isBossInCriticalState()) {
      if (dom.arenaBossSprite && stageCfg.bossCriticalSprite) {
        dom.arenaBossSprite.src = stageCfg.bossCriticalSprite;
      }
      triggerArenaCutin(
        {
          bossCriticalSprite: stageCfg.bossCriticalSprite || stageCfg.bossSprite,
          bossSprite: stageCfg.bossSprite,
          bossQuote: '「咕呜……铠甲和衣服居然被你斩碎了……别得意忘形！！」'
        },
        `${stageCfg.title} · 战损爆衣!!`,
        'boss-critical'
      );
      await sleep(520);
    }

    // CG 解锁条件与图鉴文字一致：只有打出顺子、同花顺或四条炸弹时才揭晓并点亮一张 CG
    if (CG_UNLOCK_HAND_IDS.includes(syn.id)) {
      const revealedCg = selectMatchingCg(selected, handTotal, syn);
      state.currentCg = revealedCg;
      if (!archive.unlockedCgs.includes(revealedCg.id)) {
        archive.unlockedCgs.push(revealedCg.id);
      }
      if (dom.monitorCgImage) dom.monitorCgImage.src = revealedCg.path;
    }
    saveArchive();

    dom.ssrFlashBurst.classList.remove('active');
    void dom.ssrFlashBurst.offsetWidth;
    dom.ssrFlashBurst.classList.add('active');

    sfx.playSsrChord();
    triggerStageShake(true);
    spawnFloatingPopup(`💥 -${handTotal.toLocaleString()} HP!`, 'type-xmult', null);

    renderBossArena(getStageConfig());
    await sleep(300);

    if (dom.heroCombatantBox) {
      dom.heroCombatantBox.classList.remove('hero-attacking');
    }
    if (dom.bossCombatantBox) {
      dom.bossCombatantBox.classList.remove('boss-damaged');
    }

    // 4. 移除已打出的手牌并从 52 张牌盒补齐 8 张手牌，默认按点数从大到小排序
    state.hand = state.hand.filter((c) => !state.selectedInstanceIds.has(c.instanceId));
    state.selectedInstanceIds.clear();
    drawUpToHandSize();
    sortHandByRankDesc();

    // 5. 若 BOSS 尚未被击败，进入【BOSS 攻击与技能回合】：
    //    - BOSS 切换攻击立绘 + 触发敌方技能插屏
    //    - 攻击女主扣减 1 颗红心 ❤️
    //    - 发动【魅惑盲牌】把你手牌中的 2~3 张扑克牌翻转背面朝上（显示牌背）！
    const curCfg = getStageConfig();
    if (state.currentScore < state.targetScore) {
      const bossSkillLabels = {
        1: '魅惑飞吻 · 盲牌恶作剧',
        2: '鲜血夜宴 · 血雾盖牌',
        3: '嫉妒锁链 · 人头牌盲封',
        4: '九尾狐火 · 幻象盖牌',
        5: '深渊黑纱 · 禁欲盲牌',
        6: '催眠怀表 · 梦魇盖牌',
        7: '背德圣咏 · 暗焰盲牌',
        8: '支配龙威 · 强袭盖牌',
        9: '掠夺契约 · 魔王盲域'
      };
      const bossQuotes = {
        1: '「嘻嘻~ 猜猜看被人家翻过去的牌是什么点数呀？」',
        2: '「大小姐的命令，把你的底牌全部遮住~！」',
        3: '「嫉妒锁链！不许你看清手里的皇室人头牌！」',
        4: '「狐火迷障~ 凭直觉摸牌吧，小可爱~」',
        5: '「在黑纱的蒙蔽下，乖乖接受忏悔吧~」',
        6: '「看着这只怀表……你的手牌已经被我催眠反转了哦~」',
        7: '「在黑化圣火中沉沦吧，你连自己的牌都看不清！」',
        8: '「在龙角魔将面前，跪下盲出你的手牌吧！」',
        9: '「呵呵，连底牌都被本王夺走视野，还不快快臣服于我？」'
      };
      const sIdx = ((state.stageIndex - 1) % 9) + 1;
      triggerArenaCutin(
        {
          bossAttackSprite: curCfg.bossAttackSprite || curCfg.bossSprite,
          bossSprite: curCfg.bossSprite,
          bossQuote: bossQuotes[sIdx]
        },
        bossSkillLabels[sIdx] || '深渊盲牌冲击',
        'boss'
      );

      if (dom.arenaBossSprite && curCfg.bossAttackSprite) {
        dom.arenaBossSprite.src = curCfg.bossAttackSprite;
      }
      if (dom.bossCombatantBox) {
        dom.bossCombatantBox.classList.add('boss-attacking');
      }
      if (dom.arenaHeroSprite) {
        dom.arenaHeroSprite.src = hero.hitSprite;
      }
      if (dom.heroCombatantBox) {
        dom.heroCombatantBox.classList.add('hero-hit');
      }

      arenaVfx.fireBossCounter();
      sfx.playGlitchBuzz();

      // BOSS 攻击命中女主，扣减 1 颗红心 ❤️
      state.rendersLeft = Math.max(0, state.rendersLeft - 1);
      renderHeartsRow();
      spawnFloatingPopup('💔 受到魔将反击 -1❤️!', 'type-mult', dom.heroCombatantBox);

      // 发动 BOSS 翻牌技能，将新抽的手牌中 2~3 张翻成牌背朝上！
      const flippedCount = applyBossCardFlipSkill(curCfg);
      renderHandCards();
      if (flippedCount > 0) {
        spawnFloatingPopup(`🔮 ${flippedCount} 张手牌被翻成背面!`, 'type-xmult', dom.bossCombatantBox);
      }

      await sleep(750);
      if (dom.bossCombatantBox) {
        dom.bossCombatantBox.classList.remove('boss-attacking');
      }
      if (dom.heroCombatantBox) {
        dom.heroCombatantBox.classList.remove('hero-hit');
      }
      if (dom.arenaBossSprite && curCfg.bossSprite) {
        dom.arenaBossSprite.src = curCfg.bossSprite;
      }

      // 【插屏2：濒死战损爆衣插屏】当红心掉到 2 颗（首次进入濒死）时，弹出战损破防插屏并切换为爆衣立绘！
      if (state.rendersLeft === 2) {
        const critLabel = hero.key === 'nagatoro' ? '×1.65' : '×1.25';
        triggerArenaCutin(hero, `战损破防 · 绝境觉醒 (倍率${critLabel})`, 'critical');
        sfx.playSsrChord();
        await sleep(650);
      }
    }

    state.isAnimating = false;
    renderAll();

    checkBlindOutcome();
  }

  // =========================================================================
  // 14. 抽牌、排序、弃牌换牌与胜负判定
  // =========================================================================
  function sortHandByRankDesc() {
    const suitOrder = { spade: 1, heart: 2, club: 3, diamond: 4 };
    state.hand.sort((a, b) => {
      return (b.rank || 0) - (a.rank || 0) || (suitOrder[a.pokerSuit] || 9) - (suitOrder[b.pokerSuit] || 9);
    });
  }

  function drawUpToHandSize() {
    while (state.hand.length < HAND_SIZE) {
      if (state.drawPile.length === 0) {
        const inHandIds = new Set(state.hand.map((c) => c.instanceId));
        const refill = state.deck.filter((c) => !inHandIds.has(c.instanceId));
        if (refill.length === 0) break;
        // 洗回牌堆的牌一律恢复正面，避免盲牌状态残留
        refill.forEach((c) => {
          c.isFaceDown = false;
        });
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

    // 被弃掉的盲牌恢复正面，之后重新洗回牌堆时不会仍是背面
    selected.forEach((c) => {
      c.isFaceDown = false;
    });
    state.hand = state.hand.filter((c) => !state.selectedInstanceIds.has(c.instanceId));
    state.selectedInstanceIds.clear();
    drawUpToHandSize();
    sortHandByRankDesc();
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
    openRunEndModal(false);
  }

  // =========================================================================
  // 15. 猫耳老板娘莉莉娅的神秘道具屋 (大图标清晰宝物 + 老板娘互动解说与日语配音)
  // =========================================================================
  function setShopkeeperLine(text, voiceFile) {
    const el = document.getElementById('shopkeeperSpeechText');
    if (el) el.textContent = text;
    if (voiceFile && sfx.enabled) {
      playVoiceAndBubble(voiceFile, null, null);
    }
  }

  // 按白(45%)、蓝(30%)、紫(18%)、红(7%)权重无放回抽取商店宝物
  function pickWeightedModules(pool, count) {
    const remaining = pool.slice();
    const picked = [];
    while (picked.length < count && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, item) => sum + (item.weight || 20), 0);
      let r = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let i = 0; i < remaining.length; i++) {
        r -= remaining[i].weight || 20;
        if (r <= 0) {
          chosenIdx = i;
          break;
        }
      }
      picked.push(remaining.splice(chosenIdx, 1)[0]);
    }
    return picked;
  }

  function generateShopInventory() {
    const ownedIds = new Set(state.modules.map((m) => m.id));
    const availableMods = JOKER_MODULES_DB.filter((m) => !ownedIds.has(m.id));
    state.shopModules = pickWeightedModules(availableMods, 3).map((m) => ({ ...m, sold: false }));

    const randomSynergy = PROMPT_SYNERGIES[Math.floor(Math.random() * 6)];
    state.shopUpgrades = [
      {
        id: 'upg_synergy_lv',
        name: `${randomSynergy.shortTitle}秘籍`,
        rarity: 'blue',
        rarityLabel: '稀有',
        icon: 'assets/alchemist/jokers/mod_hires_fix.webp?v=27',
        desc: `【${randomSynergy.name}】升 1 级（伤害 +20，倍率 +2）`,
        cost: 4,
        sold: false,
        action: () => {
          state.synergyLevels[randomSynergy.id] = (state.synergyLevels[randomSynergy.id] || 1) + 1;
        }
      },
      {
        id: 'upg_weight_boost',
        name: '锻造圣锤',
        rarity: 'purple',
        rarityLabel: '史诗',
        icon: 'assets/alchemist/jokers/mod_dpm_karras.webp?v=27',
        desc: '牌组中 6 张人头牌 (J/Q/K/A) 伤害永久 +50%',
        cost: 6,
        sold: false,
        action: () => {
          const candidates = shuffleArray(state.deck.filter((c) => c.isFace)).slice(0, 6);
          candidates.forEach((c) => {
            c.weight = Math.round(((c.weight || 1.0) + 0.5) * 10) / 10;
          });
        }
      },
      {
        id: 'upg_all_hands_lv',
        name: '全牌秘传书',
        rarity: 'red',
        rarityLabel: '传说',
        icon: 'assets/alchemist/jokers/mod_cfg_stabilizer.webp?v=27',
        desc: '所有 9 种扑克牌型等级全部 +1',
        cost: 10,
        sold: false,
        action: () => {
          PROMPT_SYNERGIES.forEach((s) => {
            state.synergyLevels[s.id] = (state.synergyLevels[s.id] || 1) + 1;
          });
        }
      }
    ];
  }

  function openCheckpointShop(cfg, totalEarned, unusedRendersBonus, minerBonus) {
    state.shopOpenedMidStage = false;
    generateShopInventory();
    dom.shopRewardSummary.innerHTML = `
      ⚔️ <strong>${cfg.title}</strong> 讨伐成功！
      基础赏金 <strong>+${cfg.rewardGold}</strong> · 红心奖励 <strong>+${unusedRendersBonus}</strong>
      ${minerBonus > 0 ? ` · 招财金猫 <strong>+${minerBonus}</strong>` : ''}
      = 共获得 <strong>🪙 ${totalEarned}</strong> 铜钱！
    `;
    const btnLabel = document.getElementById('btnNextBlindLabel');
    if (btnLabel) btnLabel.textContent = '⚔️ 迎战下一关';
    renderShopModalContents();
    dom.shopModal.classList.remove('hidden');
    sfx.playBgm('shop');
    setShopkeeperLine(
      '「欢迎光临。这里全是我花了一千年收集来的珍贵魔法宝物哦，鼠标移到宝物上我来给你介绍吧。」',
      'assets/alchemist/voices/shopkeeper_welcome.wav?v=18'
    );
  }

  function openShopAnytime() {
    if (state.isAnimating) return;
    state.shopOpenedMidStage = true;
    if (!state.shopModules || state.shopModules.length === 0) {
      generateShopInventory();
    }
    dom.shopRewardSummary.innerHTML = `🧙‍♀️ 欢迎来到<strong>芙莉莲的魔法道具屋</strong>！可用持有的铜钱购买宝物与强化卷轴。`;
    const btnLabel = document.getElementById('btnNextBlindLabel');
    if (btnLabel) btnLabel.textContent = '⚔️ 返回战斗';
    renderShopModalContents();
    dom.shopModal.classList.remove('hidden');
    sfx.playBgm('shop');
    setShopkeeperLine(
      '「欢迎光临。想挑件趁手的魔导器吗？把鼠标移到宝物图片上，我来为你介绍。」',
      'assets/alchemist/voices/shopkeeper_welcome.wav?v=18'
    );
  }

  function renderShopModalContents() {
    dom.shopCreditsDisplay.textContent = `${state.credits}`;
    dom.shopModulesList.innerHTML = '';
    dom.shopUpgradesList.innerHTML = '';

    // 渲染已装备宝物栏（支持在商店内一键出售旧宝物回收铜钱）
    const ownedRow = document.getElementById('shopOwnedRelicsRow');
    if (ownedRow) {
      ownedRow.innerHTML = '';
      if (state.modules.length === 0) {
        ownedRow.innerHTML = `<span class="owned-empty-hint">暂无已装备宝物</span>`;
      } else {
        state.modules.forEach((m, idx) => {
          const tier = m.rarity || 'white';
          const sellVal = m.sellPrice || Math.max(2, Math.floor((m.cost || 4) / 2));
          const chip = document.createElement('div');
          chip.className = `shop-owned-chip rarity-${tier}`;
          chip.title = `${m.name}：${m.desc}`;
          chip.innerHTML = `
            <img src="${m.icon}" alt="${m.name}" />
            <span class="owned-chip-name">${m.name}</span>
            <button type="button" class="shop-sell-chip-btn" data-shop-sell="${idx}">出售 +🪙${sellVal}</button>
          `;
          ownedRow.appendChild(chip);
        });
        ownedRow.querySelectorAll('[data-shop-sell]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-shop-sell'));
            const removed = state.modules.splice(idx, 1)[0];
            if (removed) {
              const sellVal = removed.sellPrice || Math.max(2, Math.floor((removed.cost || 4) / 2));
              state.credits += sellVal;
              sfx.playCash();
              setShopkeeperLine(`「这件【${removed.name}】我按 🪙${sellVal} 铜钱替你回收啦，去挑件更稀有的宝物吧。」`);
              renderShopModalContents();
              renderAll();
            }
          });
        });
      }
    }

    state.shopModules.forEach((mod, idx) => {
      const canBuy = !mod.sold && state.credits >= mod.cost && state.modules.length < MAX_MODULES;
      const tier = mod.rarity || 'white';
      const tierLabel = mod.rarityLabel || '普通';
      const card = document.createElement('div');
      card.className = `shop-visual-card rarity-${tier}${mod.sold ? ' is-sold' : ''}`;
      card.innerHTML = `
        <div class="shop-card-icon-frame rarity-frame-${tier}">
          <span class="shop-rarity-tag pill-${tier}">${tierLabel}</span>
          <img src="${mod.icon}" alt="${mod.name}" class="shop-big-item-img" />
        </div>
        <h4 class="shop-item-short-name text-${tier}">${mod.name}</h4>
        <p class="shop-item-short-desc">${mod.desc}</p>
        <button type="button" class="buy-pill-btn" data-buy-mod="${idx}" ${canBuy ? '' : 'disabled'}>
          ${mod.sold ? '✓ 已装备' : state.modules.length >= MAX_MODULES ? '槽位已满' : `购买 🪙${mod.cost}`}
        </button>
      `;
      card.addEventListener('mouseenter', () => {
        setShopkeeperLine(`「【${tierLabel} · ${mod.name}】：${mod.desc}（售价 🪙${mod.cost}，出售可回收 🪙${mod.sellPrice}）。」`);
      });
      dom.shopModulesList.appendChild(card);
    });

    state.shopUpgrades.forEach((upg, idx) => {
      const canBuy = !upg.sold && state.credits >= upg.cost;
      const tier = upg.rarity || 'blue';
      const tierLabel = upg.rarityLabel || '稀有';
      const card = document.createElement('div');
      card.className = `shop-visual-card rarity-${tier}${upg.sold ? ' is-sold' : ''}`;
      card.innerHTML = `
        <div class="shop-card-icon-frame rarity-frame-${tier}">
          <span class="shop-rarity-tag pill-${tier}">${tierLabel}</span>
          <img src="${upg.icon}" alt="${upg.name}" class="shop-big-item-img" />
        </div>
        <h4 class="shop-item-short-name text-${tier}">${upg.name}</h4>
        <p class="shop-item-short-desc">${upg.desc}</p>
        <button type="button" class="buy-pill-btn" data-buy-upg="${idx}" ${canBuy ? '' : 'disabled'}>
          ${upg.sold ? '✓ 已生效' : `购买 🪙${upg.cost}`}
        </button>
      `;
      card.addEventListener('mouseenter', () => {
        setShopkeeperLine(`「【${tierLabel} · ${upg.name}】：${upg.desc}，买下立即生效哦。」`);
      });
      dom.shopUpgradesList.appendChild(card);
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
        setShopkeeperLine(
          `「呵呵，你的眼光很不错呢。【${mod.name}】已经为你放进手牌正上方的道具栏里了。」`,
          'assets/alchemist/voices/shopkeeper_buy.wav?v=18'
        );
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
        setShopkeeperLine(
          `「很实用的魔法吧？【${upg.name}】的力量已经注入你的牌组了哦。」`,
          'assets/alchemist/voices/shopkeeper_buy.wav?v=18'
        );
        renderShopModalContents();
        renderAll();
      });
    });
  }

  // =========================================================================
  // 16. 关卡推进与新周目初始化
  // =========================================================================
  function startBlindStage(stageIndex) {
    state.stageIndex = stageIndex;
    const cfg = getStageConfig();
    sfx.playBgm(cfg.isBoss ? 'boss' : 'table');

    state.currentScore = 0;
    state.targetScore = cfg.targetScore;
    state.rendersLeft = MAX_HEARTS;
    state.rerollsLeft = 3;
    state.heroSkillUsesLeft = 2;
    state.nextHandBonusPixels = 0;
    state.nextHandBonusMult = 0;
    state.selectedInstanceIds.clear();

    // 新关卡开始：清除整副牌上一关残留的盲牌（背面朝上）状态
    state.deck.forEach((c) => {
      c.isFaceDown = false;
    });
    state.drawPile = shuffleArray(state.deck);
    state.hand = [];
    drawUpToHandSize();
    sortHandByRankDesc();
    renderAll();
  }

  // 释放当前主角专属主动必杀战技 (每关可用 2 次)
  function useHeroActiveSkill() {
    if (state.isAnimating || (state.heroSkillUsesLeft ?? 2) <= 0) return;
    const hero = HERO_VANGUARDS[state.heroIndex] || HERO_VANGUARDS[0];
    const selected = getSelectedCardsInOrder();

    const rankLabels = {
      2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
      11: 'J', 12: 'Q', 13: 'K', 14: 'A'
    };

    if (hero.key === 'takagi') {
      const targets = selected.length > 0 ? selected : state.hand.slice(0, 2);
      targets.forEach((c) => {
        c.rank = c.rank >= 14 ? 14 : c.rank + 1;
        c.rankLabel = rankLabels[c.rank] || 'A';
        c.isFace = c.rank >= 11;
        c.pixels = c.rank === 14 ? 11 : c.rank >= 11 ? 10 : c.rank;
      });
      spawnFloatingPopup('✨ 绯红点化：选中牌点数+1!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'nagatoro') {
      state.nextHandBonusPixels = (state.nextHandBonusPixels || 0) + 70;
      state.nextHandBonusMult = (state.nextHandBonusMult || 0) + 3;
      spawnFloatingPopup('🥊 恶魔重拳：下击 +70伤 +3倍!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'marin') {
      const targets = selected.length > 0 ? selected : state.hand.slice(0, 5);
      targets.forEach((c) => {
        c.pokerSuit = 'heart';
        c.suitSymbol = '♥';
        c.suitLabel = '♥ 红心';
        c.colorClass = 'suit-heart';
      });
      spawnFloatingPopup('🌟 星光染色：已染为 ♥ 红心!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'kaguya') {
      state.rendersLeft = Math.min(MAX_HEARTS, state.rendersLeft + 1);
      state.rerollsLeft += 2;
      spawnFloatingPopup('🏹 赤月敕令：+1❤️ +2弃牌!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'kuroneko') {
      const target = selected[0] || state.hand[0];
      if (target) {
        const clone = { ...target, instanceId: `mirror_${Date.now()}_${Math.random()}` };
        state.hand.unshift(clone);
        state.selectedInstanceIds.add(clone.instanceId);
        spawnFloatingPopup(`🔮 深渊镜像：复制了 ${target.suitSymbol}${target.rankLabel}!`, 'type-xmult', dom.heroCombatantBox);
      }
    } else if (hero.key === 'aili') {
      const targets = selected.length > 0 ? selected.slice(0, 2) : state.hand.slice(-2);
      targets.forEach((c) => {
        c.rank = 14;
        c.rankLabel = 'A';
        c.isFace = true;
        c.pixels = 11;
        c.charKey = 'aili';
      });
      spawnFloatingPopup('⚡ 王牌升阶：直接升为 A!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'qianhe') {
      state.credits += 3;
      state.rerollsLeft += 2;
      spawnFloatingPopup('❄️ 华丽谢幕：+3铜钱 +2弃牌!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'mai') {
      const targets = selected.length > 0 ? selected : state.hand.slice(0, 5);
      targets.forEach((c) => {
        c.pokerSuit = 'spade';
        c.suitSymbol = '♠';
        c.suitLabel = '♠ 黑桃';
        c.colorClass = 'suit-spade';
      });
      spawnFloatingPopup('🌙 暗月染色：已染为 ♠ 黑桃!', 'type-xmult', dom.heroCombatantBox);
    } else if (hero.key === 'yukino') {
      const dmg = Math.round(state.targetScore * 0.2);
      state.currentScore += dmg;
      spawnFloatingPopup(`❄️ 冰华破甲：-${dmg} HP!`, 'type-xmult', dom.bossCombatantBox);
    }

    // 释放主角主动战技时，同时净化解封所有被 BOSS 翻成背面的盲牌！
    state.hand.forEach((c) => {
      c.isFaceDown = false;
    });
    state.heroSkillUsesLeft = (state.heroSkillUsesLeft ?? 2) - 1;
    triggerArenaCutin(hero, hero.activeSkillName, 'attack');
    sfx.playSsrChord();
    sortHandByRankDesc();
    renderAll();
    checkBlindOutcome();
  }

  function renderHeroSelectModal() {
    const grid = document.getElementById('heroSelectGrid');
    if (!grid) return;
    grid.innerHTML = '';
    HERO_VANGUARDS.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = `hero-select-card${idx === state.heroIndex ? ' selected-hero' : ''}`;
      card.innerHTML = `
        <img src="${h.idleSprite}" alt="${h.shortName}" class="hero-select-thumb" />
        <div class="hero-select-info">
          <h3>${h.name}</h3>
          <p class="hero-skill-line"><strong>🌟 被动技能：</strong>${h.passiveDesc}</p>
        </div>
      `;
      card.addEventListener('click', () => {
        // 出牌动画进行中禁止切换主角，否则未结束的结算会写入新开局
        if (state.isAnimating) {
          sfx.playGlitchBuzz();
          return;
        }
        if (isRunInProgress() && !window.confirm(`更换主角为「${h.name}」将放弃当前进度并重新开局，确定吗？`)) {
          return;
        }
        state.heroIndex = idx;
        archive.heroIndex = idx;
        saveArchive();
        sfx.playSsrChord();
        const modal = document.getElementById('heroSelectModal');
        if (modal) modal.classList.add('hidden');
        startNewRun();
      });
      grid.appendChild(card);
    });
  }

  // 当前是否有进行中的对局（已出牌/弃牌/过关/购物等），用于重新开局前的确认
  function isRunInProgress() {
    if (dom.runEndModal && !dom.runEndModal.classList.contains('hidden')) return false;
    return (
      state.stageIndex > 1 ||
      state.currentScore > 0 ||
      state.rendersLeft < MAX_HEARTS ||
      state.rerollsLeft < 3 ||
      state.credits > 0 ||
      state.modules.length !== 1
    );
  }

  function startNewRun() {
    state.deck = cloneDeckFromBase();
    state.modules = [
      // 默认赠送白色普通品质「星辰罗盘」
      { ...JOKER_MODULES_DB[0] }
    ];
    state.credits = 0;
    state.runBestHand = 0;
    state.synergyLevels = {};
    state.handPlayCounts = {};
    PROMPT_SYNERGIES.forEach((s) => {
      state.synergyLevels[s.id] = 1;
      state.handPlayCounts[s.id] = 0;
    });

    dom.shopModal.classList.add('hidden');
    dom.runEndModal.classList.add('hidden');
    startBlindStage(1);
  }

  function openRunEndModal(victory) {
    dom.runEndTag.textContent = victory ? 'ALL BOSSES DEFEATED · 传奇讨伐者' : 'PARTY WIPED · 讨伐受挫';
    dom.runEndTitle.textContent = victory
      ? '🏆 恭喜通关！9 大次元魔物与终焉魔王全部击破！'
      : `💥 讨伐受挫：止步于第 ${state.stageIndex} 关 (${getStageConfig().title})`;
    dom.runEndDesc.textContent = victory
      ? '你凭借精妙的顺子、同花、葫芦与四条炸弹击溃了终焉次元魔王！所有战利品 CG 已永久收录！'
      : '未能在 5 颗红心耗尽前清空魔物生命值。试试多利用「💡 提示」或弃掉散牌去凑对子、三条、顺子、同花与葫芦！';

    dom.btnEndlessMode.style.display = victory ? 'inline-flex' : 'none';

    dom.runStatsGrid.innerHTML = `
      <div class="run-stat-box">
        <span>本局最高单手伤害</span>
        <strong>${state.runBestHand.toLocaleString()}</strong>
      </div>
      <div class="run-stat-box">
        <span>历史最高单手纪录</span>
        <strong>${archive.bestHandScore.toLocaleString()}</strong>
      </div>
      <div class="run-stat-box">
        <span>战利品CG收集进度</span>
        <strong>${archive.unlockedCgs.length} / ${CG_GALLERY_DB.length}</strong>
      </div>
    `;

    dom.runEndModal.classList.remove('hidden');
  }

  // =========================================================================
  // 17. 三书签卷轴弹窗：「牌型 / 完整 / 剩余」 (1:1 复刻参考图2) + CG 图鉴
  // =========================================================================
  function renderScrollBookModal() {
    // 1. 渲染「牌型」页签 (等级 | 牌型名称 | 伤害(蓝底) | 倍率(红底) | 次数)
    if (dom.rulesSynergyTbody) {
      dom.rulesSynergyTbody.innerHTML = '';
      PROMPT_SYNERGIES.forEach((syn) => {
        const lv = state.synergyLevels[syn.id] || 1;
        const dmg = syn.basePixels + (lv - 1) * 20;
        const mult = syn.baseMult + (lv - 1) * 2;
        const count = state.handPlayCounts[syn.id] || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="col-lv">等级${lv}</td>
          <td class="col-name">${syn.shortTitle} <span class="hand-sub-hint">(${syn.pokerName})</span></td>
          <td><span class="table-brush-dmg">${dmg}</span></td>
          <td><span class="table-brush-mult">${mult}</span></td>
          <td class="col-count">${count}次</td>
        `;
        dom.rulesSynergyTbody.appendChild(tr);
      });
    }

    // 2. 渲染「完整 (52张)」与「剩余 (当前牌堆)」页签
    const remainSet = new Set(state.drawPile.map((c) => c.instanceId));

    const buildSuitRowsHtml = (checkRemain) => {
      return SUIT_CONFIGS.map((sc) => {
        const suitCards = state.deck
          .filter((c) => c.pokerSuit === sc.pokerSuit)
          .sort((a, b) => b.rank - a.rank);
        const remainCount = suitCards.filter((c) => remainSet.has(c.instanceId)).length;

        const cardsHtml = suitCards
          .map((c) => {
            const isRemaining = remainSet.has(c.instanceId);
            const dimClass = checkRemain && !isRemaining ? ' is-drawn' : '';
            return `
              <div class="mini-deck-card ${sc.colorClass}${dimClass}" title="${c.zhName} (基础伤害 +${c.pixels})">
                <span class="mc-rank">${c.rankLabel}</span>
                <span class="mc-suit">${sc.suitSymbol}</span>
              </div>
            `;
          })
          .join('');

        return `
          <div class="deck-suit-row">
            <div class="deck-suit-header">
              <span>${sc.suitLabel}</span>
              <span>${checkRemain ? `剩余 ${remainCount} / ${suitCards.length} 张` : `共 ${suitCards.length} 张`}</span>
            </div>
            <div class="deck-mini-cards">${cardsHtml}</div>
          </div>
        `;
      }).join('');
    };

    if (dom.fullDeckGrid) {
      dom.fullDeckGrid.innerHTML = buildSuitRowsHtml(false);
    }
    if (dom.remainDeckGrid) {
      dom.remainDeckGrid.innerHTML = buildSuitRowsHtml(true);
    }
  }

  function switchScrollBookTab(tabKey) {
    state.activeBookTab = tabKey;
    document.querySelectorAll('[data-book-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-book-tab') === tabKey);
    });
    if (dom.bookPaneHands) dom.bookPaneHands.classList.toggle('hidden', tabKey !== 'hands');
    if (dom.bookPaneFull) dom.bookPaneFull.classList.toggle('hidden', tabKey !== 'full');
    if (dom.bookPaneRemain) dom.bookPaneRemain.classList.toggle('hidden', tabKey !== 'remain');
  }

  function renderGalleryModal() {
    dom.galleryProgressText.textContent = `${archive.unlockedCgs.length} / ${CG_GALLERY_DB.length}`;
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
          <h4>${unlocked ? cg.title : '？？？ · 待讨伐解锁'}</h4>
          <p>${unlocked ? cg.prompt : '打出顺子、同花顺或四条炸弹击败魔物即可点亮'}</p>
        </div>
      `;

      tile.addEventListener('click', () => {
        openLightbox(cg, unlocked);
      });

      dom.galleryGrid.appendChild(tile);
    });
  }

  function openLightbox(cg, unlocked = true) {
    dom.lightboxRarityTag.textContent = `${cg.rarity} VICTORY TROPHY`;
    dom.lightboxTitle.textContent = unlocked ? cg.title : `${cg.title} (预览态)`;
    dom.lightboxImage.src = cg.path;
    dom.lightboxPromptCode.textContent = cg.prompt;
    dom.lightboxUnlockInfo.textContent = unlocked
      ? `✅ 已永久收录至本地图鉴 · 历史最高单手伤害：${archive.bestHandScore.toLocaleString()}`
      : '🔒 尚未正式解锁，在讨伐战中打出对应角色人头牌与高阶牌型即可永久点亮！';
    dom.cgLightboxModal.classList.remove('hidden');
  }

  // =========================================================================
  // 18. 事件监听绑定与启动入口
  // =========================================================================
  function bindEvents() {
    dom.btnPlayHand.addEventListener('click', () => {
      playSelectedHand();
    });

    dom.btnDiscard.addEventListener('click', () => {
      discardSelectedCards();
    });

    const btnSortSuit = document.getElementById('btnSortSuit');
    if (btnSortSuit) {
      btnSortSuit.addEventListener('click', () => {
        if (state.isAnimating) return;
        const order = { spade: 1, heart: 2, club: 3, diamond: 4 };
        state.hand.sort(
          (a, b) => (order[a.pokerSuit] || 9) - (order[b.pokerSuit] || 9) || (b.rank || 0) - (a.rank || 0)
        );
        sfx.playClick(true);
        renderHandCards();
      });
    }

    const btnSortPixels = document.getElementById('btnSortPixels');
    if (btnSortPixels) {
      btnSortPixels.addEventListener('click', () => {
        if (state.isAnimating) return;
        sortHandByRankDesc();
        sfx.playClick(true);
        renderHandCards();
      });
    }

    const btnSuggestBest = document.getElementById('btnSuggestBest');
    if (btnSuggestBest) {
      btnSuggestBest.addEventListener('click', () => {
        suggestBestHand();
      });
    }

    const btnClearSelect = document.getElementById('btnClearSelect');
    if (btnClearSelect) {
      btnClearSelect.addEventListener('click', () => {
        if (state.isAnimating) return;
        state.selectedInstanceIds.clear();
        sfx.playClick(false);
        renderAll();
      });
    }

    // 注：本作主角仅有被动天赋，旧版主动战技 useHeroActiveSkill() 不再绑定任何按钮（保留代码但不可触发）

    const btnOpenHeroSelect = document.getElementById('btnOpenHeroSelect');
    if (btnOpenHeroSelect) {
      btnOpenHeroSelect.addEventListener('click', () => {
        renderHeroSelectModal();
        const modal = document.getElementById('heroSelectModal');
        if (modal) modal.classList.remove('hidden');
        sfx.playClick(true);
      });
    }

    const btnPreviewCritical = document.getElementById('btnPreviewCritical');
    if (btnPreviewCritical) {
      btnPreviewCritical.addEventListener('click', () => {
        forceCriticalPreview = !forceCriticalPreview;
        btnPreviewCritical.classList.toggle('active', forceCriticalPreview);
        const hero = HERO_VANGUARDS[state.heroIndex] || HERO_VANGUARDS[0];
        if (forceCriticalPreview) {
          triggerArenaCutin(hero, '战损破防 · 绝境觉醒 (倍率×1.25)', 'critical');
          sfx.playSsrChord();
        } else {
          triggerArenaCutin(hero, '紫气东来 · 必杀奥义', 'attack');
          sfx.playClick(true);
        }
        renderAll();
      });
    }

    const btnToggleSound = document.getElementById('btnToggleSound');
    if (btnToggleSound) {
      const applySoundState = () => {
        sfx.syncEnabled(archive.soundEnabled);
        btnToggleSound.classList.toggle('active', archive.soundEnabled);
        btnToggleSound.textContent = archive.soundEnabled ? '🔊' : '🔇';
      };
      applySoundState();
      btnToggleSound.addEventListener('click', () => {
        archive.soundEnabled = !archive.soundEnabled;
        saveArchive();
        applySoundState();
        if (archive.soundEnabled) sfx.playClick(true);
      });
    }

    const btnOpenGallery = document.getElementById('btnOpenGallery');
    if (btnOpenGallery) {
      btnOpenGallery.addEventListener('click', () => {
        renderGalleryModal();
        dom.galleryModal.classList.remove('hidden');
      });
    }

    // 点击右下角 44/52 扑克牌盒，打开三标签卷轴弹窗 (牌型 / 完整 / 剩余)
    const btnOpenSynergy = document.getElementById('btnOpenSynergy');
    if (btnOpenSynergy) {
      btnOpenSynergy.addEventListener('click', () => {
        renderScrollBookModal();
        switchScrollBookTab('hands');
        dom.rulesModal.classList.remove('hidden');
        sfx.playClick(true);
      });
    }

    document.querySelectorAll('[data-book-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const tabKey = tabBtn.getAttribute('data-book-tab');
        renderScrollBookModal();
        switchScrollBookTab(tabKey);
        sfx.playClick(true);
      });
    });

    const btnNewRun = document.getElementById('btnNewRun');
    if (btnNewRun) {
      btnNewRun.addEventListener('click', () => {
        if (state.isAnimating) return;
        if (isRunInProgress() && !window.confirm('重新开局将放弃当前进度，确定吗？')) return;
        startNewRun();
      });
    }

    const btnRerollShop = document.getElementById('btnRerollShop');
    if (btnRerollShop) {
      btnRerollShop.addEventListener('click', () => {
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
    }

    const btnNextBlind = document.getElementById('btnNextBlind');
    if (btnNextBlind) {
      btnNextBlind.addEventListener('click', () => {
        dom.shopModal.classList.add('hidden');
        startBlindStage(state.stageIndex + 1);
      });
    }

    if (dom.btnEndlessMode) {
      dom.btnEndlessMode.addEventListener('click', () => {
        dom.runEndModal.classList.add('hidden');
        startBlindStage(state.stageIndex + 1);
      });
    }

    const btnRestartFromModal = document.getElementById('btnRestartFromModal');
    if (btnRestartFromModal) {
      btnRestartFromModal.addEventListener('click', () => {
        startNewRun();
      });
    }

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
    arenaVfx.init();
    renderHeroRosterBar();
    bindEvents();
    if (dom.heroCombatantBox) {
      dom.heroCombatantBox.addEventListener('click', () => {
        // 触屏/窄屏无法悬浮：点击主角切换显示被动天赋卡片
        if (isTapPopoverMode()) {
          const willOpen = !dom.heroCombatantBox.classList.contains('show-passive');
          closeTapPopovers();
          dom.heroCombatantBox.classList.toggle('show-passive', willOpen);
        }
        if (state.isAnimating) return;
        const hero = HERO_VANGUARDS[state.heroIndex] || HERO_VANGUARDS[0];
        triggerArenaCutin(hero, '整装待命 · 点击💡提示选牌出击！');
        sfx.playClick(true);
      });
    }
    // 点击空白处收起所有点按弹出的说明卡片
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.joker-chip-card, .combatant-box')) {
        closeTapPopovers();
      }
    });
    if (dom.bossCombatantBox) {
      dom.bossCombatantBox.addEventListener('click', () => {
        if (state.isAnimating) return;
        arenaVfx.fireAttack('char', true);
        sfx.playChainDing(2, true);
      });
    }
    startNewRun();
    if (window.location.hash === '#gallery') {
      renderGalleryModal();
      dom.galleryModal.classList.remove('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
