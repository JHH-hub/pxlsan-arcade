/**
 * 《次元节拍：糖果风暴 (Pxlsan Neon Beat)》
 * 全栈音游与弹幕闪避街机引擎 · 方案 C1 高饱和糖果波普漫改风 (Muse Dash × Hi-Fi RUSH)
 *
 * 核心模块：
 * 1. 5位搭档看板娘与专属被动技能系统 (高木 / 长瀞 / 海梦 / 辉夜 / 黑猫)
 * 2. WebAudio 实时多轨电音合成器 (Kick / Snare / HiHat / Acid Bass / Chiptune Lead / Chord Arp + FFT 频谱)
 * 3. 本地音频文件 (.mp3/.ogg/.wav) 拖入解码与多频段能量峰值自动谱面生成器
 * 4. 双模式高帧率渲染与判定引擎：
 *    - RUN_2L：横版双轨跑酷闪避模式（空中糖果 / 地面节拍怪 / 双押重拍 / 彩虹长按糖带 / 尖刺齿轮闪避）
 *    - MANIA_4K：经典 4 键下落式街机模式（D/F/J/K 四轨 + ±ms FAST/LATE 毫秒偏差标尺）
 * 5. 全屏斜切漫画分镜「看板娘 SKILL CUT-IN」与街机评级结算榜 (localStorage: pxlsan-game:arcade:neonbeat)
 */

const STORAGE_KEY = 'pxlsan-game:arcade:neonbeat';

/* ==========================================================================
   1. 5 位搭档看板娘配置（全部路径均指向仓库 100% 真实存在立绘与 CG）
   ========================================================================== */
const PARTNERS = {
  takagi: {
    id: 'takagi',
    name: '高木同学',
    badge: '捉弄暴击',
    shortRule: '🍬 捉弄暴击：PERFECT 得分 +25%',
    desc: 'PERFECT 判定得分额外 +25%，连击达到 25/50/100 时触发高木同学捉弄特写应援！',
    quote: '“猜猜看下一拍是空中糖果还是地面齿轮？输的人请喝柠檬苏打哦～”',
    cutinTitle: '高木同学 · 捉弄暴击全开！',
    cutinLines: [
      '“哼哼，这波节奏完全被我看穿了哦！全连拿下吧！”',
      '“刚才差点按快了对吧？你脸红的样子真好懂呢～”',
      '“PERFECT 暴击加倍！向着最高纪录冲刺吧！”'
    ],
    clearLine: '高木同学：“哇，节奏感超棒！看来今天的胜负是我输给你啦～”',
    avatar: 'assets/neonbeat/partners/avatar_takagi.webp',
    spriteNormal: 'assets/neonbeat/partners/takagi_normal.webp',
    spriteAction: 'assets/neonbeat/partners/takagi_action.webp',
    spriteFever: 'assets/neonbeat/partners/takagi_fever.webp',
    cutinCg: 'assets/neonbeat/cutins/cutin_takagi.webp',
    accent: '#FF1493'
  },
  nagatoro: {
    id: 'nagatoro',
    name: '长瀞同学',
    badge: '小恶魔护盾',
    shortRule: '🎨 小恶魔护盾：每 30 连击回血 + 护盾',
    desc: '开局自带 1 层小恶魔护盾抵消失误，且每达成 30 连击自动恢复 18% 生命并刷新护盾！',
    quote: '“前辈～这么慢的节拍要是还漏掉的话，今天可要留下来继续加练美术写生哦！”',
    cutinTitle: '长瀞同学 · 小恶魔护盾展开！',
    cutinLines: [
      '“前辈居然跟上我的高速节拍了？！明明平时那么笨拙的说！”',
      '“护盾给你充好电啦！不许被那种小齿轮撞到哦，前辈！”',
      '“嘿嘿，前辈认真打歌的样子，稍微有点帅嘛！”'
    ],
    clearLine: '长瀞同学：“哼哼，勉强给你打个满分吧！下次速度再加快也不许掉链子哦，前辈！”',
    avatar: 'assets/neonbeat/partners/avatar_nagatoro.webp',
    spriteNormal: 'assets/neonbeat/partners/nagatoro_normal.webp',
    spriteAction: 'assets/neonbeat/partners/nagatoro_action.webp',
    spriteFever: 'assets/neonbeat/partners/nagatoro_fever.webp',
    cutinCg: 'assets/neonbeat/cutins/cutin_nagatoro.webp',
    accent: '#FFE600'
  },
  marin: {
    id: 'marin',
    name: '喜多川海梦',
    badge: '星光加演',
    shortRule: '✨ 星光加演：FEVER 持续时间延长 50%',
    desc: 'FEVER 狂热持续时间延长 50%（长达 12 秒），且每次击中音符获得的 FEVER 能量提升 25%！',
    quote: '“哇——这首曲子的霓虹鼓点超级燃！快换上舞台装一起嗨翻全场吧！！”',
    cutinTitle: '喜多川海梦 · 星光舞台 FEVER！！',
    cutinLines: [
      '“超——级棒！！聚光灯全打过来了，FEVER 时间加倍延长！！”',
      '“最喜欢这个副歌 Drop 了！连击千万不要停下来呀！”',
      '“咔嚓！刚才那一跳简直帅呆了，完美舞台诞生！”'
    ],
    clearLine: '喜多川海梦：“太神啦！！刚才那场 Live 我鸡皮疙瘩都起来了，再来一首吧！”',
    avatar: 'assets/neonbeat/partners/avatar_marin.webp',
    spriteNormal: 'assets/neonbeat/partners/marin_normal.webp',
    spriteAction: 'assets/neonbeat/partners/marin_action.webp',
    spriteFever: 'assets/neonbeat/partners/marin_fever.webp',
    cutinCg: 'assets/neonbeat/cutins/cutin_marin.webp',
    accent: '#00F5D4'
  },
  kaguya: {
    id: 'kaguya',
    name: '四宫辉夜',
    badge: '会长严选校准',
    shortRule: '💘 严选校准：GREAT 自动升格为 PERFECT',
    desc: '学生会精密节拍校准：所有 GREAT 判定将 100% 自动升格为 PERFECT 满分判定！',
    quote: '“音游的胜负就如同恋爱头脑战，哪怕 10 毫秒的偏差本小姐也会替你完美修正！”',
    cutinTitle: '四宫辉夜 · 精密节拍绝对校准！',
    cutinLines: [
      '“お可愛いこと…这点程度的变速谱面，都在学生会的计算之中！”',
      '“GREAT 判定已全部校准为 PERFECT！请继续保持优雅的连击！”',
      '“完美无瑕的节奏控制，今天的头脑战是我们赢了！”'
    ],
    clearLine: '四宫辉夜：“呼…毫无破绽的 ALL PERFECT 演出，这正是配得上学生会的华丽战绩。”',
    avatar: 'assets/neonbeat/partners/avatar_kaguya.webp',
    spriteNormal: 'assets/neonbeat/partners/kaguya_normal.webp',
    spriteAction: 'assets/neonbeat/partners/kaguya_action.webp',
    spriteFever: 'assets/neonbeat/partners/kaguya_fever.webp',
    cutinCg: 'assets/neonbeat/cutins/cutin_kaguya.webp',
    accent: '#FF1493'
  },
  kuroneko: {
    id: 'kuroneko',
    name: '五更琉璃(黑猫)',
    badge: '暗黑圣典突破',
    shortRule: '🌙 圣典突破：连击倍率上限突破至 ×8',
    desc: '解放夜魔女王之力，连击得分倍率上限从常规 ×4 突破至最高 ×8.0，高连击得分爆炸！',
    quote: '“吾乃司掌终焉节拍的堕天圣黑猫…凡人，跟得上 172 BPM 的暗黑十字狂想吗？”',
    cutinTitle: '五更琉璃 · 终焉十字 ×8 倍率解放！',
    cutinLines: [
      '“哼哼哼…契约成立！暗黑连击倍率已突破至极限境地！”',
      '“听见夜魔女王的鼓点了吗？在这场弹幕风暴中献上最高连击吧！”',
      '“……干、干得漂亮！不愧是吾选中的命运搭档！”'
    ],
    clearLine: '五更琉璃：“哼，还算不赖嘛…这份破纪录的圣典乐章，我就勉为其难替你铭记下来了。”',
    avatar: 'assets/neonbeat/partners/avatar_kuroneko.webp',
    spriteNormal: 'assets/neonbeat/partners/kuroneko_normal.webp',
    spriteAction: 'assets/neonbeat/partners/kuroneko_action.webp',
    spriteFever: 'assets/neonbeat/partners/kuroneko_fever.webp',
    cutinCg: 'assets/neonbeat/cutins/cutin_kuroneko.webp',
    accent: '#00F5D4'
  }
};

/* ==========================================================================
   2. 5 首内置 WebAudio 实时多轨合成电音曲库配置
   ========================================================================== */
const BUILTIN_TRACKS = [
  {
    id: 'track-01-tease',
    indexLabel: 'TRACK 01',
    icon: '🍬',
    title: '放学后的捉弄节拍',
    enTitle: 'After-School Tease Beat',
    bpm: 124,
    durationSec: 54,
    defaultPartner: 'takagi',
    sceneBg: 'assets/neonbeat/covers/track_01.webp',
    coverImg: 'assets/neonbeat/covers/track_01.webp',
    localBgm: null,
    diffs: [
      { name: 'EASY ★★', stars: 2, density: 0.55, hazardRate: 0.12, doubleRate: 0.1, holdRate: 0.15 },
      { name: 'HARD ★★★★', stars: 4, density: 0.85, hazardRate: 0.22, doubleRate: 0.22, holdRate: 0.2 }
    ],
    synthProfile: {
      waveLead: 'square',
      waveBass: 'triangle',
      scaleMidi: [60, 62, 64, 67, 69, 72, 74, 76, 79], // C Major Pentatonic Bright Pop
      melodySteps: [4, 5, 7, 5, 4, 2, 0, 2, 4, 5, 7, 8, 7, 5, 4, 5],
      bassSteps:   [0, 0, 3, 3, 4, 4, 2, 3, 0, 0, 3, 3, 4, 5, 3, 0],
      kickMask:    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      snareMask:   [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hatMask:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
  },
  {
    id: 'track-02-lemon',
    indexLabel: 'TRACK 02',
    icon: '🎨',
    title: '美术室的柠檬苏打风暴',
    enTitle: 'Lemon Soda Blitz',
    bpm: 136,
    durationSec: 58,
    defaultPartner: 'nagatoro',
    sceneBg: 'assets/neonbeat/covers/track_02.webp',
    coverImg: 'assets/neonbeat/covers/track_02.webp',
    localBgm: null,
    diffs: [
      { name: 'NORMAL ★★★', stars: 3, density: 0.68, hazardRate: 0.18, doubleRate: 0.16, holdRate: 0.16 },
      { name: 'HARD ★★★★★', stars: 5, density: 0.94, hazardRate: 0.28, doubleRate: 0.26, holdRate: 0.22 }
    ],
    synthProfile: {
      waveLead: 'sawtooth',
      waveBass: 'sawtooth',
      scaleMidi: [62, 64, 66, 69, 71, 74, 76, 78, 81], // D Major Funky Electro
      melodySteps: [5, 7, 6, 4, 5, 3, 0, 2, 5, 7, 8, 7, 6, 4, 5, 5],
      bassSteps:   [0, 2, 0, 4, 3, 3, 1, 2, 0, 2, 0, 4, 5, 4, 2, 0],
      kickMask:    [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
      snareMask:   [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
      hatMask:     [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1]
    }
  },
  {
    id: 'track-03-starlight',
    indexLabel: 'TRACK 03',
    icon: '✨',
    title: '星光舞台 Cosplay 狂想',
    enTitle: 'Starlight Dress-Up',
    bpm: 148,
    durationSec: 60,
    defaultPartner: 'marin',
    sceneBg: 'assets/neonbeat/covers/track_03.webp',
    coverImg: 'assets/neonbeat/covers/track_03.webp',
    localBgm: null,
    diffs: [
      { name: 'NORMAL ★★★', stars: 3, density: 0.72, hazardRate: 0.18, doubleRate: 0.18, holdRate: 0.22 },
      { name: 'MASTER ★★★★★★', stars: 6, density: 1.05, hazardRate: 0.30, doubleRate: 0.30, holdRate: 0.26 }
    ],
    synthProfile: {
      waveLead: 'square',
      waveBass: 'sawtooth',
      scaleMidi: [64, 66, 68, 71, 73, 76, 78, 80, 83], // E Major Future Bass Idol
      melodySteps: [5, 6, 7, 8, 7, 5, 3, 5, 6, 7, 5, 3, 4, 5, 7, 8],
      bassSteps:   [0, 0, 4, 4, 5, 5, 3, 3, 2, 2, 4, 4, 5, 3, 4, 0],
      kickMask:    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1],
      snareMask:   [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hatMask:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
  },
  {
    id: 'track-04-lovewar',
    indexLabel: 'TRACK 04',
    icon: '💘',
    title: '学生会室的恋爱头脑战',
    enTitle: 'Love is War Step',
    bpm: 158,
    durationSec: 62,
    defaultPartner: 'kaguya',
    sceneBg: 'assets/neonbeat/covers/track_04.webp',
    coverImg: 'assets/neonbeat/covers/track_04.webp',
    localBgm: null,
    diffs: [
      { name: 'HARD ★★★★★', stars: 5, density: 0.88, hazardRate: 0.24, doubleRate: 0.24, holdRate: 0.2 },
      { name: 'MASTER ★★★★★★★', stars: 7, density: 1.18, hazardRate: 0.34, doubleRate: 0.34, holdRate: 0.24 }
    ],
    synthProfile: {
      waveLead: 'sawtooth',
      waveBass: 'square',
      scaleMidi: [57, 60, 62, 64, 65, 68, 69, 72, 76], // A Harmonic Minor Brass/Electro Swing
      melodySteps: [6, 5, 6, 7, 8, 7, 6, 4, 3, 4, 6, 5, 4, 3, 2, 0],
      bassSteps:   [0, 3, 0, 3, 4, 4, 5, 5, 0, 3, 0, 3, 5, 4, 3, 0],
      kickMask:    [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0],
      snareMask:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
      hatMask:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
  },
  {
    id: 'track-05-crimson',
    indexLabel: 'TRACK 05',
    icon: '🌙',
    title: '夜魔女王的终焉十字',
    enTitle: 'Crimson Fallen Angel',
    bpm: 172,
    durationSec: 64,
    defaultPartner: 'kuroneko',
    sceneBg: 'assets/neonbeat/covers/track_05.webp',
    coverImg: 'assets/neonbeat/covers/track_05.webp',
    localBgm: null,
    diffs: [
      { name: 'HARD ★★★★★', stars: 5, density: 0.96, hazardRate: 0.26, doubleRate: 0.26, holdRate: 0.22 },
      { name: 'CHAOS ★★★★★★★★', stars: 8, density: 1.32, hazardRate: 0.38, doubleRate: 0.38, holdRate: 0.28 }
    ],
    synthProfile: {
      waveLead: 'sawtooth',
      waveBass: 'sawtooth',
      scaleMidi: [58, 60, 61, 63, 65, 66, 69, 70, 73, 77], // Bb Gothic Artcore / Drum & Bass
      melodySteps: [7, 6, 4, 2, 4, 6, 7, 8, 9, 8, 7, 6, 4, 6, 7, 7],
      bassSteps:   [0, 0, 0, 4, 5, 5, 3, 3, 2, 2, 4, 4, 6, 5, 4, 0],
      kickMask:    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1],
      snareMask:   [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1],
      hatMask:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
  }
];

/* ==========================================================================
   3. WebAudio 实时多轨合成器 + 打击音效 + FFT 频谱引擎
   ========================================================================== */
class NeonSynthEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.fftData = new Uint8Array(64);
    this.stepTimer = null;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.isPlaying = false;
    this.activeTrack = null;
    this.audioSourceMode = 'synth';
    this.bgAudioEl = null;
    this.customAudioBuffer = null;
    this.customBufferSource = null;
    this.songStartContextTime = 0;
    this.pausedElapsedSec = 0;
    this.onBeatCallback = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.78;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.76;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.fftData = new Uint8Array(this.analyser.frequencyBinCount);
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // 合成 Kick 底鼓
  triggerKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.13);
    gain.gain.setValueAtTime(0.95, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.23);
  }

  // 合成 Snare 军鼓
  triggerSnare(time) {
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(650, time);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(time);
      noise.stop(time + 0.16);
    }
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, time);
    body.frequency.exponentialRampToValueAtTime(110, time + 0.08);
    bodyGain.gain.setValueAtTime(0.35, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, time + 0.09);
    body.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    body.start(time);
    body.stop(time + 0.1);
  }

  // 合成 Hi-Hat 踩镲
  triggerHat(time, open = false) {
    if (!this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5800, time);
    const gain = this.ctx.createGain();
    const dur = open ? 0.12 : 0.04;
    gain.gain.setValueAtTime(open ? 0.22 : 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  // 合成律动 Bass 线
  triggerBass(time, midi, dur, waveType = 'sawtooth') {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = waveType;
    osc.frequency.setValueAtTime(this.midiToFreq(midi - 12), time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(980, time);
    filter.frequency.exponentialRampToValueAtTime(240, time + dur * 0.85);
    filter.Q.value = 4.5;
    gain.gain.setValueAtTime(0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + dur * 0.92);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur);
  }

  // 合成 Chiptune / Supersaw 主旋律
  triggerLead(time, midi, dur, waveType = 'square') {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const freq = this.midiToFreq(midi);
    osc1.type = waveType;
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.004, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, time);
    filter.frequency.exponentialRampToValueAtTime(1200, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.008, time + dur * 0.95);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur);
    osc2.stop(time + dur);
  }

  // 音符打击清脆反馈音效 (Juice Hit SFX)
  playHitSfx(type = 'PERFECT') {
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'PERFECT') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.065);
      gain.gain.setValueAtTime(0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.085);
    } else if (type === 'DOUBLE') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(1980, now + 0.11);
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);
    } else if (type === 'DODGE') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1240, now + 0.09);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.1);
    } else if (type === 'CUTIN') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
    } else if (type === 'MISS') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.linearRampToValueAtTime(95, now + 0.14);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.15);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1120, now + 0.06);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.075);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  scheduleStep(stepIndex, time) {
    if (!this.activeTrack || !this.activeTrack.synthProfile) return;
    const prof = this.activeTrack.synthProfile;
    const stepDur = (60 / this.activeTrack.bpm) / 4; // 16分音符时长
    const s16 = stepIndex % 16;
    const barIdx = Math.floor(stepIndex / 16);

    if (prof.kickMask[s16]) {
      this.triggerKick(time);
    }
    if (prof.snareMask[s16]) {
      this.triggerSnare(time);
    }
    if (prof.hatMask[s16]) {
      this.triggerHat(time, s16 % 4 === 2);
    }

    // Bass 线
    if (s16 % 2 === 0 || prof.kickMask[s16]) {
      const bassDeg = prof.bassSteps[s16 % prof.bassSteps.length];
      const bassMidi = prof.scaleMidi[bassDeg % prof.scaleMidi.length];
      this.triggerBass(time, bassMidi, stepDur * 1.9, prof.waveBass);
    }

    // 主旋律（带乐句八度跃动变化）
    const melDeg = prof.melodySteps[s16 % prof.melodySteps.length];
    if (s16 % 2 === 0 || (barIdx % 2 === 1 && s16 % 3 === 0)) {
      const octaveShift = (barIdx % 4 === 2 && s16 >= 8) ? 12 : 0;
      const leadMidi = prof.scaleMidi[melDeg % prof.scaleMidi.length] + octaveShift;
      this.triggerLead(time, leadMidi, stepDur * 1.75, prof.waveLead);
    }

    if (s16 % 4 === 0 && typeof this.onBeatCallback === 'function') {
      this.onBeatCallback(stepIndex / 4);
    }
  }

  startSong(track, mode = 'synth') {
    this.ensureContext();
    this.stopSong();
    this.activeTrack = track;
    this.audioSourceMode = mode;
    this.isPlaying = true;
    this.currentStep = 0;
    this.pausedElapsedSec = 0;
    this.songStartContextTime = this.ctx.currentTime + 0.05;
    this.nextStepTime = this.songStartContextTime;

    // 若为用户拖入的自定义 AudioBuffer，直接播放解码后的音频流
    if (track.isCustom && track.audioBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = track.audioBuffer;
      src.connect(this.masterGain);
      src.start(this.songStartContextTime);
      this.customBufferSource = src;
      return;
    }

    // 若选择了混音伴奏模式 (hybrid)，叠加播放本地 BGM
    if (mode === 'hybrid' && track.localBgm) {
      try {
        this.bgAudioEl = new Audio(track.localBgm);
        this.bgAudioEl.volume = 0.36;
        this.bgAudioEl.currentTime = 0;
        this.bgAudioEl.play().catch(() => {});
      } catch (_) {}
    }

    const stepDur = (60 / track.bpm) / 4;
    const scheduler = () => {
      if (!this.isPlaying) return;
      while (this.nextStepTime < this.ctx.currentTime + 0.12) {
        this.scheduleStep(this.currentStep, this.nextStepTime);
        this.nextStepTime += stepDur;
        this.currentStep += 1;
      }
      this.stepTimer = window.setTimeout(scheduler, 25);
    };
    scheduler();
  }

  getElapsedSec() {
    if (!this.ctx || !this.isPlaying) return this.pausedElapsedSec;
    return Math.max(0, this.ctx.currentTime - this.songStartContextTime);
  }

  stopSong() {
    this.isPlaying = false;
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.customBufferSource) {
      try {
        this.customBufferSource.stop();
        this.customBufferSource.disconnect();
      } catch (_) {}
      this.customBufferSource = null;
    }
    if (this.bgAudioEl) {
      try {
        this.bgAudioEl.pause();
        this.bgAudioEl.currentTime = 0;
      } catch (_) {}
      this.bgAudioEl = null;
    }
  }

  sampleSpectrum() {
    if (!this.analyser || !this.isPlaying) {
      this.fftData.fill(0);
      return this.fftData;
    }
    this.analyser.getByteFrequencyData(this.fftData);
    return this.fftData;
  }
}

/* ==========================================================================
   4. 谱面生成器（支持内置曲目确定性生成 & 本地音频能量峰值自动建谱）
   ========================================================================== */
function createSeededRng(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function nextRand() {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 为内置电音曲目生成兼具音乐感与打击爽感的谱面
 * 每个音符结构：{ id, time, type: 'TAP'|'DOUBLE'|'HOLD'|'HAZARD', lane2: 0|1, lane4: 0|1|2|3, endTime, hit, holding, holdTicks, missed }
 */
function generateBuiltinChart(track, diffIdx = 0) {
  const diff = track.diffs[diffIdx] || track.diffs[0];
  const rng = createSeededRng(`${track.id}-diff-${diffIdx}`);
  const beatSec = 60 / track.bpm;
  const subStepSec = beatSec / 2; // 8分音符主网格
  const notes = [];
  let noteId = 1;

  const startSec = 1.8;
  const endSec = track.durationSec - 2.0;
  let nextAvailableTime = startSec;

  for (let t = startSec; t < endSec; t += subStepSec) {
    if (t < nextAvailableTime - 0.02) continue;

    const beatIndex = Math.round((t - startSec) / subStepSec);
    const isDownbeat = beatIndex % 2 === 0;
    const isPhraseAccent = beatIndex % 8 === 0;
    const roll = rng();

    const spawnThreshold = isDownbeat ? diff.density * 0.92 : diff.density * 0.52;
    if (roll > spawnThreshold && !isPhraseAccent) continue;

    const typeRoll = rng();

    // 1. 双押重拍 (DOUBLE)
    if (isDownbeat && typeRoll < diff.doubleRate) {
      notes.push({
        id: noteId++,
        time: t,
        type: 'DOUBLE',
        lane2: 0,
        lane4: 1,
        lane4Pair: 2,
        endTime: t,
        hit: false,
        missed: false
      });
      nextAvailableTime = t + subStepSec * 0.95;
      continue;
    }

    // 2. 长按彩虹糖带 (HOLD)
    if (isDownbeat && typeRoll >= diff.doubleRate && typeRoll < diff.doubleRate + diff.holdRate) {
      const lane2 = rng() < 0.5 ? 0 : 1;
      const lane4 = lane2 === 0 ? (rng() < 0.5 ? 0 : 1) : (rng() < 0.5 ? 2 : 3);
      const holdDuration = beatSec * (rng() < 0.65 ? 1.0 : 1.5);
      notes.push({
        id: noteId++,
        time: t,
        type: 'HOLD',
        lane2,
        lane4,
        endTime: t + holdDuration,
        hit: false,
        holding: false,
        holdCompleted: false,
        lastTickTime: t,
        missed: false
      });
      nextAvailableTime = t + holdDuration + subStepSec * 0.5;
      continue;
    }

    // 3. 尖刺齿轮弹幕 (HAZARD) — 仅在双轨跑酷模式下需要跳跃/俯身闪避，4K模式下转为高能重音单键
    if (!isPhraseAccent && typeRoll >= diff.doubleRate + diff.holdRate && typeRoll < diff.doubleRate + diff.holdRate + diff.hazardRate) {
      const hazardLane2 = rng() < 0.55 ? 1 : 0; // 1=地面齿轮(跳起躲), 0=高空齿轮(俯身躲)
      notes.push({
        id: noteId++,
        time: t,
        type: 'HAZARD',
        lane2: hazardLane2,
        lane4: hazardLane2 === 0 ? 0 : 3,
        endTime: t,
        hit: false,
        dodged: false,
        missed: false
      });
      nextAvailableTime = t + subStepSec * 0.9;
      continue;
    }

    // 4. 常规空中糖果 / 地面节拍怪 (TAP)
    const lane2 = rng() < 0.5 ? 0 : 1;
    const lane4 = lane2 === 0 ? (rng() < 0.5 ? 0 : 1) : (rng() < 0.5 ? 2 : 3);
    notes.push({
      id: noteId++,
      time: t,
      type: 'TAP',
      lane2,
      lane4,
      endTime: t,
      hit: false,
      missed: false
    });

    // 高难度偶发 16 分音符交互连打
    if (diff.stars >= 5 && isDownbeat && rng() < 0.25) {
      const streamTime = t + subStepSec * 0.5;
      const altLane2 = 1 - lane2;
      const altLane4 = (lane4 + 2) % 4;
      notes.push({
        id: noteId++,
        time: streamTime,
        type: 'TAP',
        lane2: altLane2,
        lane4: altLane4,
        endTime: streamTime,
        hit: false,
        missed: false
      });
      nextAvailableTime = streamTime + subStepSec * 0.5;
    }
  }

  return notes.sort((a, b) => a.time - b.time);
}

/**
 * 从用户拖入的本地音频 AudioBuffer 中通过能量瞬态检测自动生成双模式谱面
 */
function analyzeAudioBufferToChart(audioBuffer, diffIdx = 0) {
  const rawData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSec = 0.04; // 40ms 能量分析窗
  const windowSamples = Math.floor(sampleRate * windowSec);
  const energies = [];

  for (let i = 0; i + windowSamples < rawData.length; i += windowSamples) {
    let sumSq = 0;
    for (let j = 0; j < windowSamples; j++) {
      const sample = rawData[i + j];
      sumSq += sample * sample;
    }
    energies.push({
      time: i / sampleRate,
      rms: Math.sqrt(sumSq / windowSamples)
    });
  }

  // 计算局部滑动平均与峰值
  const notes = [];
  let noteId = 1;
  const minGap = diffIdx === 0 ? 0.26 : 0.16;
  let lastNoteTime = 1.0;
  const onsetTimes = [];

  for (let i = 6; i < energies.length - 6; i++) {
    const cur = energies[i];
    if (cur.time < 1.2 || cur.time > audioBuffer.duration - 1.5) continue;

    let localAvg = 0;
    for (let k = i - 6; k <= i + 6; k++) {
      localAvg += energies[k].rms;
    }
    localAvg /= 13;

    const threshold = localAvg * (diffIdx === 0 ? 1.38 : 1.22) + 0.015;
    if (
      cur.rms > threshold &&
      cur.rms >= energies[i - 1].rms &&
      cur.rms >= energies[i + 1].rms &&
      cur.time - lastNoteTime >= minGap
    ) {
      onsetTimes.push(cur.time);
      lastNoteTime = cur.time;

      const ratio = cur.rms / Math.max(0.01, localAvg);
      const idx = notes.length;
      if (ratio > 2.05 && idx % 4 === 0) {
        notes.push({
          id: noteId++,
          time: cur.time,
          type: 'DOUBLE',
          lane2: 0,
          lane4: 1,
          lane4Pair: 2,
          endTime: cur.time,
          hit: false,
          missed: false
        });
      } else if (ratio > 1.75 && idx % 6 === 2) {
        const lane2 = idx % 2;
        notes.push({
          id: noteId++,
          time: cur.time,
          type: 'HOLD',
          lane2,
          lane4: idx % 4,
          endTime: Math.min(audioBuffer.duration - 1, cur.time + 0.45),
          hit: false,
          holding: false,
          holdCompleted: false,
          lastTickTime: cur.time,
          missed: false
        });
        lastNoteTime = cur.time + 0.5;
      } else if (idx % 7 === 5) {
        const lane2 = idx % 2;
        notes.push({
          id: noteId++,
          time: cur.time,
          type: 'HAZARD',
          lane2,
          lane4: lane2 === 0 ? 0 : 3,
          endTime: cur.time,
          hit: false,
          dodged: false,
          missed: false
        });
      } else {
        const lane2 = idx % 2;
        notes.push({
          id: noteId++,
          time: cur.time,
          type: 'TAP',
          lane2,
          lane4: idx % 4,
          endTime: cur.time,
          hit: false,
          missed: false
        });
      }
    }
  }

  // 估算 BPM
  let estimatedBpm = 138;
  if (onsetTimes.length > 8) {
    const intervals = [];
    for (let i = 1; i < onsetTimes.length; i++) {
      const dt = onsetTimes[i] - onsetTimes[i - 1];
      if (dt >= 0.25 && dt <= 0.75) intervals.push(dt);
    }
    if (intervals.length > 0) {
      const avgDt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      estimatedBpm = Math.round(Math.min(185, Math.max(96, 60 / avgDt)));
    }
  }

  return { notes, estimatedBpm };
}

/* ==========================================================================
   5. 核心音游街机控制器 (NeonBeatArcade)
   ========================================================================== */
class NeonBeatArcade {
  constructor() {
    this.synth = new NeonSynthEngine();
    this.tracks = [...BUILTIN_TRACKS];
    this.selectedTrackId = this.tracks[0].id;
    this.selectedDiffIdx = 0;
    this.selectedPartnerId = this.tracks[0].defaultPartner;
    this.gameMode = 'RUN_2L'; // 'RUN_2L' | 'MANIA_4K'
    this.noteSpeedMult = 1.0;
    this.autoPlay = false;

    // 运行态
    this.state = 'IDLE'; // 'IDLE' | 'PLAYING' | 'PAUSED' | 'RESULT'
    this.notes = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hp = 100;
    this.shieldCount = 0;
    this.feverGauge = 0;
    this.isFever = false;
    this.feverEndTime = 0;

    // 判定统计
    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.fastCount = 0;
    this.lateCount = 0;
    this.offsetSumMs = 0;
    this.offsetSamples = 0;
    this.lastOffsetMs = 0;

    // 跑酷角色姿态状态
    this.runnerLane = 1; // 0 = 空中跃起 (AIR), 1 = 地面奔跑 (GROUND)
    this.runnerJumpTimer = 0;
    this.runnerAttackPoseTimer = 0;
    this.beatPulseValue = 0;
    this.receptorBounce = [0, 0, 0, 0];
    this.keyDownLanes = [false, false, false, false];
    this.lastLanePressTime = [0, 0, 0, 0];

    // 预加载角色与舞台贴图缓存
    this.imageCache = new Map();

    // DOM 引用
    this.canvas = document.getElementById('neonBeatCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.stageFrame = document.getElementById('canvasStageFrame');

    this.init();
  }

  init() {
    this.preloadAllImages();
    this.renderTrackList();
    this.renderPartnerTabs();
    this.selectTrack(this.selectedTrackId);
    this.bindEvents();

    // WebAudio 节拍呼吸回调
    this.synth.onBeatCallback = () => {
      this.beatPulseValue = 1.0;
      document.documentElement.style.setProperty('--beat-pulse', '1.035');
      setTimeout(() => {
        document.documentElement.style.setProperty('--beat-pulse', '1');
      }, 95);
    };

    requestAnimationFrame((ts) => this.loop(ts));
  }

  preloadAllImages() {
    const urls = new Set();
    Object.values(PARTNERS).forEach((p) => {
      urls.add(p.avatar);
      urls.add(p.spriteNormal);
      urls.add(p.spriteAction);
      urls.add(p.spriteFever);
      urls.add(p.cutinCg);
    });
    this.tracks.forEach((t) => urls.add(t.sceneBg));

    urls.forEach((src) => {
      const img = new Image();
      img.src = src;
      this.imageCache.set(src, img);
    });
  }

  getActiveTrack() {
    return this.tracks.find((t) => t.id === this.selectedTrackId) || this.tracks[0];
  }

  getActivePartner() {
    return PARTNERS[this.selectedPartnerId] || PARTNERS.takagi;
  }

  /* ------------------------------------------------------------------------
     本地存储高分榜 (localStorage: pxlsan-game:arcade:neonbeat)
     ------------------------------------------------------------------------ */
  loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  getRecordKey(trackId, diffIdx, mode) {
    return `${trackId}::d${diffIdx}::${mode}`;
  }

  saveRecord(trackId, diffIdx, mode, entry) {
    const records = this.loadRecords();
    const key = this.getRecordKey(trackId, diffIdx, mode);
    const prev = records[key];
    let isNewRecord = false;
    if (!prev || entry.score > prev.score) {
      records[key] = {
        ...entry,
        updatedAt: new Date().toISOString()
      };
      isNewRecord = true;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (_) {}
    }
    return isNewRecord;
  }

  /* ------------------------------------------------------------------------
     左栏 UI 渲染：曲库卡片 & 搭档看板娘切换
     ------------------------------------------------------------------------ */
  renderTrackList() {
    const container = document.getElementById('trackListContainer');
    const records = this.loadRecords();
    container.innerHTML = '';

    this.tracks.forEach((track) => {
      const isSelected = track.id === this.selectedTrackId;
      const partner = PARTNERS[track.defaultPartner] || PARTNERS.takagi;
      const recKey = this.getRecordKey(track.id, this.selectedDiffIdx, this.gameMode);
      const best = records[recKey];

      const card = document.createElement('div');
      card.className = `track-card${isSelected ? ' active' : ''}`;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(isSelected));
      card.innerHTML = `
        <div class="track-card-left">
          <img class="track-avatar-mini" src="${track.coverImg || partner.avatar}" alt="${track.title}" />
          <div class="track-meta">
            <div class="track-title-row">
              <span class="track-idx">${track.indexLabel}</span>
              <span class="track-name">${track.icon} 《${track.title}》</span>
            </div>
            <div class="track-sub">${track.enTitle} · 搭档：${partner.name}</div>
          </div>
        </div>
        <div class="track-card-right">
          <span class="bpm-pill">BPM ${track.bpm}</span>
          <span class="rank-mini-badge">${best ? `👑 ${best.rank} · ${best.score}` : 'NEW'}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        if (this.state === 'PLAYING') {
          this.stopLiveToIdle();
        }
        this.selectTrack(track.id);
      });
      container.appendChild(card);
    });
  }

  renderPartnerTabs() {
    const tabsContainer = document.getElementById('partnerTabs');
    tabsContainer.innerHTML = '';

    Object.values(PARTNERS).forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `partner-tab-btn${p.id === this.selectedPartnerId ? ' active' : ''}`;
      btn.innerHTML = `
        <img src="${p.avatar}" alt="${p.name}" />
        <span>${p.name.replace('同学', '').replace('(黑猫)', '')}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectPartner(p.id);
      });
      tabsContainer.appendChild(btn);
    });
  }

  selectTrack(trackId) {
    this.selectedTrackId = trackId;
    const track = this.getActiveTrack();
    this.selectPartner(track.defaultPartner);

    // 更新难度按钮文案
    const btnDiff0 = document.getElementById('btnDiff0');
    const btnDiff1 = document.getElementById('btnDiff1');
    btnDiff0.textContent = track.diffs[0].name;
    btnDiff1.textContent = track.diffs[1] ? track.diffs[1].name : track.diffs[0].name;

    // 切换舞台场景背景
    const sceneImg = document.getElementById('stageSceneBg');
    if (sceneImg && track.sceneBg) {
      sceneImg.src = track.sceneBg;
    }

    this.updateStartOverlayInfo();
    this.renderTrackList();
  }

  selectPartner(partnerId) {
    if (!PARTNERS[partnerId]) return;
    this.selectedPartnerId = partnerId;
    const p = this.getActivePartner();

    document.getElementById('partnerCardImg').src = p.spriteAction;
    document.getElementById('partnerNameDisplay').textContent = p.name;
    document.getElementById('partnerSkillName').textContent = p.badge;
    document.getElementById('partnerSkillDesc').textContent = p.desc;
    document.getElementById('partnerQuoteBubble').textContent = p.quote;
    document.getElementById('hudSkillActivePill').textContent = p.shortRule;

    this.renderPartnerTabs();
    this.updateStartOverlayInfo();
  }

  updateStartOverlayInfo() {
    const track = this.getActiveTrack();
    const partner = this.getActivePartner();
    const diff = track.diffs[this.selectedDiffIdx] || track.diffs[0];
    const records = this.loadRecords();
    const best = records[this.getRecordKey(track.id, this.selectedDiffIdx, this.gameMode)];

    document.getElementById('startCardTrackBadge').textContent =
      `${track.indexLabel} · BPM ${track.bpm} · ${diff.name}`;
    document.getElementById('startCardTitle').textContent = `${track.icon} 《${track.title}》`;
    document.getElementById('startCardSub').textContent =
      `${track.enTitle} · 出战搭档：${partner.name}（${partner.badge}）`;
    document.getElementById('hudNowPlayingTitle').textContent =
      `${track.icon} ${track.indexLabel} · 《${track.title}》 (${diff.name})`;

    const bestTextEl = document.getElementById('startBestScoreText');
    if (best) {
      bestTextEl.textContent = `评级 ${best.rank} · ${best.score.toLocaleString()} 分 · MAX COMBO ${best.maxCombo} (${best.acc}%)`;
    } else {
      bestTextEl.textContent = '尚无纪录 · 等你首通摘取 S+ 桂冠！';
    }
  }

  /* ------------------------------------------------------------------------
     开始打歌、暂停与停止流程
     ------------------------------------------------------------------------ */
  startLive() {
    const track = this.getActiveTrack();
    const partner = this.getActivePartner();
    this.notes = track.isCustom
      ? analyzeAudioBufferToChart(track.audioBuffer, this.selectedDiffIdx).notes
      : generateBuiltinChart(track, this.selectedDiffIdx);

    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hp = 100;
    this.shieldCount = partner.id === 'nagatoro' ? 1 : 0;
    this.feverGauge = 0;
    this.isFever = false;
    this.feverEndTime = 0;
    document.body.classList.remove('fever-mode-active');

    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.fastCount = 0;
    this.lateCount = 0;
    this.offsetSumMs = 0;
    this.offsetSamples = 0;
    this.lastOffsetMs = 0;
    this.runnerLane = 1;

    document.getElementById('stageStartOverlay').hidden = true;
    document.getElementById('stageResultOverlay').hidden = true;

    const audioMode = document.getElementById('audioSourceMode').value;
    this.state = 'PLAYING';
    this.synth.startSong(track, audioMode);
    this.updateHud();
  }

  stopLiveToIdle() {
    this.synth.stopSong();
    this.state = 'IDLE';
    this.isFever = false;
    document.body.classList.remove('fever-mode-active');
    document.getElementById('stageStartOverlay').hidden = false;
    document.getElementById('stageResultOverlay').hidden = true;
    this.updateStartOverlayInfo();
  }

  /* ------------------------------------------------------------------------
     全屏斜切漫画分镜「看板娘 SKILL CUT-IN」
     ------------------------------------------------------------------------ */
  triggerMangaCutIn(customReason = null) {
    const partner = this.getActivePartner();
    const overlay = document.getElementById('mangaCutinOverlay');
    const imgEl = document.getElementById('cutinHeroineImg');
    const badgeEl = document.getElementById('cutinComboBadge');
    const titleEl = document.getElementById('cutinSkillTitle');
    const lineEl = document.getElementById('cutinVoiceLine');

    imgEl.src = partner.cutinCg;
    badgeEl.textContent = customReason || `${this.combo} COMBO!! SKILL CUT-IN`;
    titleEl.textContent = partner.cutinTitle;
    const randomLine = partner.cutinLines[Math.floor(Math.random() * partner.cutinLines.length)];
    lineEl.textContent = randomLine;

    overlay.classList.add('active');
    this.synth.playHitSfx('CUTIN');
    this.triggerScreenShake(true);

    // 喷发全屏糖果星芒粒子
    for (let i = 0; i < 36; i++) {
      this.spawnParticles(
        260 + Math.random() * 680,
        140 + Math.random() * 280,
        i % 2 === 0 ? '#FFE600' : '#00F5D4',
        4
      );
    }

    if (this.cutinHideTimer) clearTimeout(this.cutinHideTimer);
    this.cutinHideTimer = setTimeout(() => {
      overlay.classList.remove('active');
    }, 1850);
  }

  triggerScreenShake(heavy = false) {
    const cls = heavy ? 'shake-heavy' : 'shake-micro';
    this.stageFrame.classList.remove('shake-micro', 'shake-heavy');
    void this.stageFrame.offsetWidth;
    this.stageFrame.classList.add(cls);
  }

  /* ------------------------------------------------------------------------
     按键与触控输入判定系统
     ------------------------------------------------------------------------ */
  handleLaneInput(laneIdx, isKeyDown = true) {
    this.keyDownLanes[laneIdx] = isKeyDown;
    const padBtn = document.querySelector(`.arcade-pad-btn[data-lane="${laneIdx}"]`);
    if (padBtn) {
      padBtn.classList.toggle('pressed', isKeyDown);
    }

    if (!isKeyDown) return;

    const nowTime = this.state === 'PLAYING' ? this.synth.getElapsedSec() : performance.now() / 1000;
    this.lastLanePressTime[laneIdx] = nowTime;
    this.receptorBounce[laneIdx] = 1.0;

    // 跑酷模式下：lane 0/1 为跃起至上轨 (AIR)，lane 2/3 为落回下轨重击 (GROUND)
    const targetLane2 = laneIdx < 2 ? 0 : 1;
    this.runnerLane = targetLane2;
    this.runnerJumpTimer = targetLane2 === 0 ? 0.42 : 0;
    this.runnerAttackPoseTimer = 0.22;

    if (this.state !== 'PLAYING') {
      this.synth.playHitSfx('PERFECT');
      return;
    }

    this.evaluateNoteHit(laneIdx, targetLane2, nowTime);
  }

  evaluateNoteHit(lane4Idx, lane2Idx, songTime) {
    const PERFECT_WIN = 0.045;
    const GREAT_WIN = 0.090;
    const GOOD_WIN = 0.135;

    // 查找当前判定窗口内最接近的未命中音符
    let candidate = null;
    let bestAbsDiff = Infinity;

    for (const note of this.notes) {
      if (note.hit || note.missed || note.type === 'HAZARD') continue;
      const diff = songTime - note.time;
      const absDiff = Math.abs(diff);
      if (absDiff > GOOD_WIN) continue;

      if (this.gameMode === 'RUN_2L') {
        if (note.type === 'DOUBLE') {
          // 双押重拍：允许同时按上+下轨，或 55ms 内双键齐按
          if (absDiff < bestAbsDiff) {
            bestAbsDiff = absDiff;
            candidate = note;
          }
        } else if (note.lane2 === lane2Idx && absDiff < bestAbsDiff) {
          bestAbsDiff = absDiff;
          candidate = note;
        }
      } else {
        // 4K 下落式模式
        const match4K =
          note.lane4 === lane4Idx ||
          (note.type === 'DOUBLE' && (note.lane4 === lane4Idx || note.lane4Pair === lane4Idx));
        if (match4K && absDiff < bestAbsDiff) {
          bestAbsDiff = absDiff;
          candidate = note;
        }
      }
    }

    if (!candidate) return;

    const offsetMs = (songTime - candidate.time) * 1000;
    const absSec = Math.abs(songTime - candidate.time);

    let judge = 'GOOD';
    if (absSec <= PERFECT_WIN) {
      judge = 'PERFECT';
    } else if (absSec <= GREAT_WIN) {
      judge = 'GREAT';
    }

    // 四宫辉夜专属技能：GREAT 自动校准为 PERFECT
    let calibrated = false;
    if (judge === 'GREAT' && this.selectedPartnerId === 'kaguya') {
      judge = 'PERFECT';
      calibrated = true;
    }

    if (candidate.type === 'HOLD') {
      candidate.hit = true;
      candidate.holding = true;
      candidate.lastTickTime = songTime;
    } else {
      candidate.hit = true;
    }

    this.registerJudgment(judge, offsetMs, candidate, calibrated);
  }

  registerJudgment(judge, offsetMs, note, calibrated = false) {
    const partner = this.getActivePartner();

    if (judge === 'MISS') {
      // 长瀞同学护盾抵消一次 MISS
      if (this.shieldCount > 0) {
        this.shieldCount -= 1;
        this.spawnPopup('SHIELD BLOCK!!', '#00F5D4', '长瀞小恶魔护盾抵消失误！');
        this.synth.playHitSfx('DODGE');
        return;
      }
      this.counts.MISS += 1;
      this.combo = 0;
      this.hp = Math.max(5, this.hp - 8);
      this.synth.playHitSfx('MISS');
      this.spawnPopup('MISS...', '#FF2E4C', '');
      this.updateBottomJudge('MISS...', 0, true);
      this.updateHud();
      return;
    }

    // 命中统计
    this.counts[judge] += 1;
    this.combo += 1;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // 毫秒级 FAST / LATE 偏差统计
    this.lastOffsetMs = offsetMs;
    this.offsetSumMs += Math.abs(offsetMs);
    this.offsetSamples += 1;
    if (offsetMs < -4) this.fastCount += 1;
    else if (offsetMs > 4) this.lateCount += 1;

    // 连击倍率计算（五更琉璃突破至 ×8，其余常规上限 ×4）
    const maxMult = partner.id === 'kuroneko' ? 8.0 : 4.0;
    const rawMult = 1.0 + Math.floor(this.combo / 10) * 0.5;
    const comboMult = Math.min(maxMult, rawMult);
    const feverMult = this.isFever ? 1.5 : 1.0;

    let baseScore = judge === 'PERFECT' ? 1000 : judge === 'GREAT' ? 700 : 400;
    if (note && note.type === 'DOUBLE') baseScore *= 1.6;

    // 高木同学技能：PERFECT 得分 +25%
    if (judge === 'PERFECT' && partner.id === 'takagi') {
      baseScore *= 1.25;
    }

    const gained = Math.round(baseScore * comboMult * feverMult);
    this.score += gained;

    // 长瀞同学技能：每 30 连击恢复生命并补充护盾
    if (partner.id === 'nagatoro' && this.combo > 0 && this.combo % 30 === 0) {
      this.hp = Math.min(100, this.hp + 18);
      this.shieldCount = Math.min(2, this.shieldCount + 1);
      this.spawnPopup('DEVIL SHIELD +HP!!', '#FFE600', '长瀞护盾充能！');
    }

    // FEVER 能量积累（喜多川海梦充能加速 +25%，持续时间 +50%）
    if (!this.isFever) {
      const feverGain = (judge === 'PERFECT' ? 4.5 : 2.8) * (partner.id === 'marin' ? 1.25 : 1.0);
      this.feverGauge = Math.min(100, this.feverGauge + feverGain);
      if (this.feverGauge >= 100) {
        this.activateFever();
      }
    }

    // 达成 25 / 50 / 100 / 150 连击触发全屏斜切漫画 SKILL CUT-IN
    if (this.combo === 25 || this.combo === 50 || this.combo === 100 || this.combo === 150) {
      this.triggerMangaCutIn(`${this.combo} COMBO BURST!!`);
    }

    // 粒子与漫画爆炸字反馈
    const hitPos = this.getNoteReceptorCoords(note);
    const color =
      judge === 'PERFECT' ? '#FFE600' : judge === 'GREAT' ? '#00F5D4' : '#FF1493';
    this.spawnParticles(hitPos.x, hitPos.y, color, note?.type === 'DOUBLE' ? 26 : 16);

    const subTag = calibrated
      ? '💘 会长校准 PERFECT!!'
      : `${offsetMs >= 0 ? '+' : ''}${offsetMs.toFixed(1)}ms ${offsetMs < -4 ? 'FAST' : offsetMs > 4 ? 'LATE' : 'EXACT'}`;
    const headline = note?.type === 'DOUBLE' ? `${judge}!! DOUBLE` : `${judge}!!`;
    this.spawnPopup(headline, color, subTag, hitPos.x, hitPos.y - 34);

    this.synth.playHitSfx(note?.type === 'DOUBLE' ? 'DOUBLE' : judge);
    if (judge === 'PERFECT') {
      this.triggerScreenShake(false);
    }

    this.updateBottomJudge(headline, offsetMs, false);
    this.bounceComboBox();
    this.updateHud();
  }

  activateFever() {
    const partner = this.getActivePartner();
    this.isFever = true;
    const duration = partner.id === 'marin' ? 12.0 : 8.0;
    this.feverEndTime = this.synth.getElapsedSec() + duration;
    document.body.classList.add('fever-mode-active');
    this.triggerMangaCutIn('★ FEVER RUSH ACTIVATED!! ★');
  }

  bounceComboBox() {
    const box = document.getElementById('hudComboBox');
    box.classList.remove('pop-bounce');
    void box.offsetWidth;
    box.classList.add('pop-bounce');
  }

  updateBottomJudge(text, offsetMs, isMiss) {
    const judgeEl = document.getElementById('bottomJudgeText');
    const offsetEl = document.getElementById('bottomOffsetText');
    judgeEl.textContent = text;
    judgeEl.style.color = isMiss ? '#FF2E4C' : '#FFE600';
    if (isMiss) {
      offsetEl.textContent = 'MISS';
    } else {
      const tag = offsetMs < -4 ? 'FAST' : offsetMs > 4 ? 'LATE' : 'SYNC';
      offsetEl.textContent = `${offsetMs >= 0 ? '+' : ''}${offsetMs.toFixed(1)} ms (${tag})`;
    }
  }

  getAccuracyPercent() {
    const total =
      this.counts.PERFECT + this.counts.GREAT + this.counts.GOOD + this.counts.MISS;
    if (total === 0) return 100.0;
    const weighted =
      this.counts.PERFECT * 1.0 + this.counts.GREAT * 0.75 + this.counts.GOOD * 0.4;
    return (weighted / total) * 100;
  }

  updateHud() {
    const partner = this.getActivePartner();
    const maxMult = partner.id === 'kuroneko' ? 8.0 : 4.0;
    const mult = Math.min(maxMult, 1.0 + Math.floor(this.combo / 10) * 0.5);

    document.getElementById('hudComboNum').textContent = String(this.combo);
    document.getElementById('hudMultiplierPill').textContent =
      `×${(mult * (this.isFever ? 1.5 : 1.0)).toFixed(1)}`;
    document.getElementById('hudScoreNum').textContent = String(this.score).padStart(7, '0');
    document.getElementById('hudAccText').textContent = `${this.getAccuracyPercent().toFixed(2)}%`;

    document.getElementById('hudHpFill').style.width = `${this.hp}%`;
    document.getElementById('hudHpText').textContent =
      this.shieldCount > 0 ? `${Math.round(this.hp)}%+🛡️` : `${Math.round(this.hp)}%`;

    document.getElementById('hudFeverFill').style.width = `${this.feverGauge}%`;
    document.getElementById('hudFeverText').textContent =
      this.isFever ? 'FEVER!!' : `${Math.round(this.feverGauge)}%`;
  }

  /* ------------------------------------------------------------------------
     主更新与结算循环
     ------------------------------------------------------------------------ */
  updateGameLogic(dt) {
    if (this.state !== 'PLAYING') return;

    const track = this.getActiveTrack();
    const songTime = this.synth.getElapsedSec();

    // 进度条更新
    const pct = Math.min(100, (songTime / track.durationSec) * 100);
    document.getElementById('hudSongProgress').style.width = `${pct.toFixed(1)}%`;

    // FEVER 持续倒计时
    if (this.isFever) {
      const remain = this.feverEndTime - songTime;
      if (remain <= 0) {
        this.isFever = false;
        this.feverGauge = 0;
        document.body.classList.remove('fever-mode-active');
      } else {
        const totalDur = this.selectedPartnerId === 'marin' ? 12.0 : 8.0;
        this.feverGauge = Math.max(0, (remain / totalDur) * 100);
      }
    }

    // 跑酷角色滞空计时衰减
    if (this.runnerJumpTimer > 0) {
      this.runnerJumpTimer = Math.max(0, this.runnerJumpTimer - dt);
      if (this.runnerJumpTimer === 0 && !this.keyDownLanes[0] && !this.keyDownLanes[1]) {
        this.runnerLane = 1;
      }
    }
    if (this.runnerAttackPoseTimer > 0) {
      this.runnerAttackPoseTimer = Math.max(0, this.runnerAttackPoseTimer - dt);
    }

    // 遍历音符处理：AI 自动演示 / 长按持续加分 / 尖刺齿轮闪避结算 / 超时 MISS
    for (const note of this.notes) {
      if (note.missed || note.holdCompleted) continue;

      // 1. AUTO PLAY 自动演示模式
      if (this.autoPlay && !note.hit && songTime >= note.time - 0.008) {
        if (note.type === 'HAZARD') {
          // 自动跳到安全轨道躲避齿轮
          this.runnerLane = 1 - note.lane2;
          this.runnerJumpTimer = this.runnerLane === 0 ? 0.38 : 0;
          note.hit = true;
          note.dodged = true;
          this.score += 500;
          this.synth.playHitSfx('DODGE');
          const pos = this.getNoteReceptorCoords(note);
          this.spawnPopup('DODGE PERFECT!! +500', '#00F5D4', '闪避成功！', pos.x, pos.y - 26);
          this.updateHud();
          continue;
        } else {
          const autoLane4 = note.lane4;
          this.runnerLane = note.lane2;
          this.runnerJumpTimer = note.lane2 === 0 ? 0.35 : 0;
          this.receptorBounce[autoLane4] = 1.0;
          if (note.type === 'HOLD') {
            note.hit = true;
            note.holding = true;
            note.lastTickTime = songTime;
          } else {
            note.hit = true;
          }
          this.registerJudgment('PERFECT', (Math.random() - 0.5) * 8, note, false);
          continue;
        }
      }

      // 2. 处理长按彩虹糖带 (HOLD Note)
      if (note.type === 'HOLD' && note.hit && note.holding) {
        const isStillHolding =
          this.autoPlay ||
          (this.gameMode === 'RUN_2L'
            ? note.lane2 === 0
              ? this.keyDownLanes[0] || this.keyDownLanes[1]
              : this.keyDownLanes[2] || this.keyDownLanes[3]
            : this.keyDownLanes[note.lane4]);

        if (songTime - note.lastTickTime >= 0.12 && isStillHolding) {
          note.lastTickTime = songTime;
          this.score += 220;
          this.combo += 1;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;
          const pos = this.getNoteReceptorCoords(note);
          this.spawnParticles(pos.x, pos.y, '#00F5D4', 5);
          this.updateHud();
        }

        if (songTime >= note.endTime) {
          note.holding = false;
          note.holdCompleted = true;
          this.score += 500;
          this.updateHud();
        }
        continue;
      }

      // 3. 尖刺齿轮弹幕 (HAZARD) 到达判定线
      if (note.type === 'HAZARD' && !note.hit && songTime >= note.time) {
        note.hit = true;
        if (this.gameMode === 'MANIA_4K') {
          // 4K 模式下齿轮视为自动闪避加分特效
          note.dodged = true;
          this.score += 300;
          continue;
        }
        const safeLane = 1 - note.lane2;
        if (this.runnerLane === safeLane) {
          note.dodged = true;
          this.score += 500;
          this.synth.playHitSfx('DODGE');
          const pos = this.getNoteReceptorCoords(note);
          this.spawnPopup('DODGE!! +500', '#00F5D4', '完美闪避尖刺齿轮！', pos.x, pos.y - 26);
          this.updateHud();
        } else {
          // 撞上尖刺齿轮
          this.triggerScreenShake(true);
          this.registerJudgment('MISS', 0, note, false);
        }
        continue;
      }

      // 4. 普通音符超时未按 -> MISS
      if (!note.hit && songTime - note.time > 0.145) {
        note.missed = true;
        this.registerJudgment('MISS', 145, note, false);
      }
    }

    // 曲目播放完毕 -> 弹出街机结算画面
    if (songTime >= track.durationSec) {
      this.finishSongToResult();
    }
  }

  finishSongToResult() {
    this.synth.stopSong();
    this.state = 'RESULT';
    this.isFever = false;
    document.body.classList.remove('fever-mode-active');

    const track = this.getActiveTrack();
    const partner = this.getActivePartner();
    const diff = track.diffs[this.selectedDiffIdx] || track.diffs[0];
    const acc = this.getAccuracyPercent();

    // 计算街机评级徽章：👑 S+ (ALL PERFECT) / 🌟 S (FULL COMBO 或 ACC >= 95%) / 🔥 A / 🍬 B
    let rank = 'B';
    let badgeText = '🍬 CLEAR STAGE';
    const isAllPerfect =
      this.counts.MISS === 0 &&
      this.counts.GOOD === 0 &&
      this.counts.GREAT === 0 &&
      this.counts.PERFECT > 0;
    const isFullCombo = this.counts.MISS === 0 && this.counts.PERFECT + this.counts.GREAT > 0;

    if (isAllPerfect) {
      rank = 'S+';
      badgeText = '👑 ALL PERFECT!!';
    } else if (isFullCombo || acc >= 94.5) {
      rank = 'S';
      badgeText = isFullCombo ? '🌟 FULL COMBO!!' : '🌟 SUPER STAR!!';
    } else if (acc >= 84.0) {
      rank = 'A';
      badgeText = '🔥 GREAT RHYTHM!';
    }

    const isNewRecord = this.saveRecord(track.id, this.selectedDiffIdx, this.gameMode, {
      trackId: track.id,
      trackTitle: track.title,
      diffName: diff.name,
      mode: this.gameMode,
      partnerName: partner.name,
      score: this.score,
      maxCombo: this.maxCombo,
      acc: Number(acc.toFixed(2)),
      rank,
      badgeText
    });

    // 填充结算 DOM
    document.getElementById('resultHeroineCg').src = partner.cutinCg;
    document.getElementById('resultRankStamp').textContent = rank;
    document.getElementById('resultBadgeRibbon').textContent = badgeText;
    document.getElementById('resultSongTitle').textContent = `${track.icon} 《${track.title}》`;
    document.getElementById('resultModeAndDiff').textContent =
      `${this.gameMode === 'RUN_2L' ? '横版双轨跑酷' : '4K 下落街机'} · ${diff.name} · 搭档：${partner.name}`;

    document.getElementById('resScoreVal').textContent = this.score.toLocaleString();
    document.getElementById('resNewRecordBadge').hidden = !isNewRecord;
    document.getElementById('resMaxComboVal').textContent = String(this.maxCombo);
    document.getElementById('resAccVal').textContent = `${acc.toFixed(2)}%`;

    document.getElementById('resPerfectCount').textContent = String(this.counts.PERFECT);
    document.getElementById('resGreatCount').textContent = String(this.counts.GREAT);
    document.getElementById('resGoodCount').textContent = String(this.counts.GOOD);
    document.getElementById('resMissCount').textContent = String(this.counts.MISS);

    const avgOffset =
      this.offsetSamples > 0 ? (this.offsetSumMs / this.offsetSamples).toFixed(1) : '0.0';
    document.getElementById('resTimingSummary').textContent =
      `FAST: ${this.fastCount} · LATE: ${this.lateCount} · 平均毫秒偏差: ±${avgOffset} ms`;
    document.getElementById('resPartnerComment').textContent = partner.clearLine;

    document.getElementById('stageResultOverlay').hidden = false;
    this.synth.playHitSfx('CUTIN');
    this.renderTrackList();
  }

  /* ------------------------------------------------------------------------
     高帧率 Canvas 渲染系统 (双模式：RUN_2L 跑酷闪避 & MANIA_4K 四键下落)
     ------------------------------------------------------------------------ */
  getNoteReceptorCoords(note) {
    if (this.gameMode === 'RUN_2L') {
      const hitX = 330;
      const laneY = note && note.lane2 === 0 ? 195 : 375;
      return { x: hitX, y: laneY };
    } else {
      const laneIdx = note ? note.lane4 : 1;
      const highwayLeft = 450;
      const laneWidth = 132;
      return {
        x: highwayLeft + laneIdx * laneWidth + laneWidth * 0.5,
        y: 472
      };
    }
  }

  spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const speed = 140 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 5 + Math.random() * 7,
        color: i % 3 === 0 ? '#FFFFFF' : color,
        life: 1.0,
        shape: i % 2 === 0 ? 'star' : 'circle'
      });
    }
  }

  spawnPopup(text, color, subText = '', x = 540, y = 155) {
    this.popups.push({
      text,
      subText,
      color,
      x,
      y,
      scale: 1.45,
      life: 1.0
    });
  }

  loop(timestamp) {
    if (!this.lastFrameTs) this.lastFrameTs = timestamp;
    const dt = Math.min(0.05, (timestamp - this.lastFrameTs) / 1000);
    this.lastFrameTs = timestamp;

    this.beatPulseValue = Math.max(0, this.beatPulseValue - dt * 3.8);
    for (let i = 0; i < 4; i++) {
      this.receptorBounce[i] = Math.max(0, this.receptorBounce[i] - dt * 6.0);
    }

    this.updateGameLogic(dt);
    this.renderCanvas(dt);

    requestAnimationFrame((ts) => this.loop(ts));
  }

  renderCanvas(dt) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. 绘制底部リアルタイム WebAudio FFT 频谱律动能量柱
    this.drawSpectrumBars(ctx, W, H);

    // 2. 根据当前音游模式绘制核心舞台
    if (this.gameMode === 'RUN_2L') {
      this.drawRun2LStage(ctx, W, H);
    } else {
      this.drawMania4KStage(ctx, W, H);
    }

    // 3. 更新并绘制粒子爆裂与漫画爆炸字
    this.drawParticlesAndPopups(ctx, dt);
  }

  drawSpectrumBars(ctx, W, H) {
    const fft = this.synth.sampleSpectrum();
    const barCount = 36;
    const barW = W / barCount;

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const val = fft[i] || 0;
      const barH = (val / 255) * 145 + (this.state === 'PLAYING' ? 8 : 3);
      const x = i * barW;
      const y = H - barH;

      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(255, 20, 147, 0.32)'
          : i % 3 === 1
          ? 'rgba(255, 230, 0, 0.28)'
          : 'rgba(0, 245, 212, 0.28)';
      ctx.fillRect(x + 2, y, barW - 4, barH);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     模式一：横版双轨跑酷闪避模式 (Muse Dash 风 · RUN_2L)
     ------------------------------------------------------------------------ */
  drawRun2LStage(ctx, W, H) {
    const songTime = this.state === 'PLAYING' ? this.synth.getElapsedSec() : 0;
    const hitX = 330;
    const upperY = 195;
    const lowerY = 375;

    // 1. 绘制上下两条高饱和糖果波普跑道
    const lanes = [
      { y: upperY, label: 'AIR SKY LANE [F / ↑]', color: '#FF1493', bg: 'rgba(255, 20, 147, 0.16)' },
      { y: lowerY, label: 'GROUND BEAT LANE [J / ↓]', color: '#00F5D4', bg: 'rgba(0, 245, 212, 0.16)' }
    ];

    lanes.forEach((lane, idx) => {
      ctx.save();
      ctx.fillStyle = lane.bg;
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 4;
      ctx.fillRect(250, lane.y - 54, W - 260, 108);
      ctx.strokeRect(250, lane.y - 54, W - 260, 108);

      // 漫画虚线引导轨
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 10]);
      ctx.beginPath();
      ctx.moveTo(hitX, lane.y);
      ctx.lineTo(W - 20, lane.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 轨道标签
      ctx.font = '900 13px Impact, "PingFang SC", sans-serif';
      ctx.fillStyle = lane.color;
      ctx.fillText(lane.label, W - 210, lane.y - 34);

      // 判定圈 (Receptor Ring)
      const bounce = idx === 0
        ? Math.max(this.receptorBounce[0], this.receptorBounce[1])
        : Math.max(this.receptorBounce[2], this.receptorBounce[3]);
      const radius = 34 + bounce * 9 + this.beatPulseValue * 4;

      ctx.beginPath();
      ctx.arc(hitX, lane.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = bounce > 0.1 ? lane.color : 'rgba(25, 10, 40, 0.78)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#FFE600';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hitX, lane.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    });

    // 2. 绘制左侧搭档看板娘动态奔跑与跃起闪避演出
    this.drawRunnerHeroine(ctx, upperY, lowerY);

    // 3. 绘制飞来的空中糖果音符、地面节拍怪、双押电光柱、彩虹长按糖带与尖刺齿轮
    if (this.state !== 'PLAYING') return;

    const basePxPerSec = 520 * this.noteSpeedMult;

    for (const note of this.notes) {
      if (note.missed || note.holdCompleted) continue;
      if (note.hit && note.type !== 'HOLD') continue;

      const x = hitX + (note.time - songTime) * basePxPerSec;
      const endX = hitX + (note.endTime - songTime) * basePxPerSec;
      if (endX < 220 || x > W + 80) continue;

      const y = note.lane2 === 0 ? upperY : lowerY;

      if (note.type === 'HOLD') {
        // 彩虹糖带长按音符
        const headX = note.holding ? hitX : Math.max(hitX, x);
        const tailW = Math.max(12, endX - headX);
        const grad = ctx.createLinearGradient(headX, y, headX + tailW, y);
        grad.addColorStop(0, '#FF1493');
        grad.addColorStop(0.5, '#FFE600');
        grad.addColorStop(1, '#00F5D4');

        ctx.save();
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#190A28';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(headX, y - 20, tailW, 40, 20);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        this.drawCandyNoteHead(ctx, headX, y, '#FFE600', 'HOLD');
      } else if (note.type === 'DOUBLE') {
        // 双押重拍：上下两轨连接闪电柱
        ctx.save();
        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x, upperY);
        ctx.lineTo(x - 10, (upperY + lowerY) * 0.5);
        ctx.lineTo(x + 10, (upperY + lowerY) * 0.5);
        ctx.lineTo(x, lowerY);
        ctx.stroke();
        ctx.restore();

        this.drawCandyNoteHead(ctx, x, upperY, '#FFE600', 'F+J');
        this.drawCandyNoteHead(ctx, x, lowerY, '#FFE600', 'F+J');
      } else if (note.type === 'HAZARD') {
        // 尖刺齿轮弹幕
        this.drawSpikedGear(ctx, x, y, songTime);
      } else {
        // 空中糖果 / 地面节拍怪
        const color = note.lane2 === 0 ? '#FF1493' : '#00F5D4';
        const label = note.lane2 === 0 ? '🍬' : '👾';
        this.drawCandyNoteHead(ctx, x, y, color, label);
      }
    }
  }

  drawRunnerHeroine(ctx, upperY, lowerY) {
    const partner = this.getActivePartner();
    const imgSrc = this.isFever
      ? partner.spriteFever
      : this.runnerAttackPoseTimer > 0
      ? partner.spriteAction
      : partner.spriteNormal;
    const img = this.imageCache.get(imgSrc);

    const targetY = this.runnerLane === 0 ? upperY : lowerY;
    const bobOffset = Math.sin(performance.now() / 110) * 6 - this.beatPulseValue * 8;
    const centerX = 135;
    const centerY = targetY + bobOffset;

    ctx.save();
    // 漫画斜切立绘底座框
    ctx.fillStyle = this.isFever ? '#FFE600' : '#FF1493';
    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(22, centerY - 92);
    ctx.lineTo(232, centerY - 104);
    ctx.lineTo(218, centerY + 92);
    ctx.lineTo(16, centerY + 84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, 20, centerY - 102, 210, 225);
      ctx.restore();
    }

    // 护盾光环展示（长瀞同学技能）
    if (this.shieldCount > 0) {
      ctx.strokeStyle = '#00F5D4';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 96, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 当前姿态标签
    ctx.fillStyle = '#190A28';
    ctx.fillRect(28, centerY + 60, 182, 26);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, centerY + 60, 182, 26);
    ctx.fillStyle = '#FFE600';
    ctx.font = '900 12px Impact, "PingFang SC", sans-serif';
    ctx.fillText(
      this.runnerLane === 0 ? `⚡ ${partner.name} · 空中闪避/连击` : `🏃‍♀️ ${partner.name} · 地面律动奔跑`,
      36,
      centerY + 78
    );
    ctx.restore();
  }

  drawCandyNoteHead(ctx, x, y, fillColor, labelText) {
    ctx.save();
    ctx.translate(x, y);

    // 外圈深紫墨水描边糖果球
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#190A28';
    ctx.stroke();

    // 高光弧与文字
    ctx.beginPath();
    ctx.arc(-7, -7, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

    ctx.fillStyle = '#190A28';
    ctx.font = '900 13px Impact, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, 0, 1);
    ctx.restore();
  }

  drawSpikedGear(ctx, x, y, songTime) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(songTime * 8);

    const spikes = 10;
    const outerR = 32;
    const innerR = 20;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#FF2E4C';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFE600';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#190A28';
    ctx.fill();
    ctx.restore();

    // 闪避提示标语
    ctx.save();
    ctx.fillStyle = '#FFE600';
    ctx.font = '900 11px Impact, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ DODGE!', x, y - 38);
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     模式二：经典 4 键下落式街机模式 (4K Mania 风 · MANIA_4K)
     ------------------------------------------------------------------------ */
  drawMania4KStage(ctx, W, H) {
    const songTime = this.state === 'PLAYING' ? this.synth.getElapsedSec() : 0;
    const highwayLeft = 450;
    const laneWidth = 132;
    const highwayWidth = laneWidth * 4;
    const receptorY = 472;
    const laneColors = ['#FF1493', '#00F5D4', '#FFE600', '#FF1493'];
    const laneKeys = ['D', 'F', 'J', 'K'];

    // 1. 左侧绘制搭档看板娘 DJ 舞台应援大卡与实时毫秒偏差标尺
    this.drawManiaPartnerPanel(ctx);

    // 2. 绘制 4K 霓虹轨道面板
    ctx.save();
    ctx.fillStyle = 'rgba(15, 5, 26, 0.88)';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.fillRect(highwayLeft, 24, highwayWidth, H - 44);
    ctx.strokeRect(highwayLeft, 24, highwayWidth, H - 44);

    for (let i = 0; i < 4; i++) {
      const lx = highwayLeft + i * laneWidth;

      // 按键激光束高亮
      if (this.keyDownLanes[i] || this.receptorBounce[i] > 0.15) {
        const grad = ctx.createLinearGradient(lx, 40, lx, receptorY);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, `${laneColors[i]}55`);
        ctx.fillStyle = grad;
        ctx.fillRect(lx + 3, 28, laneWidth - 6, receptorY - 28);
      }

      // 分轨线
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, 24);
        ctx.lineTo(lx, H - 20);
        ctx.stroke();
      }

      // 底部判定框与键位提示
      const rx = lx + laneWidth * 0.5;
      const bounce = this.receptorBounce[i] * 8;
      ctx.fillStyle = this.keyDownLanes[i] ? laneColors[i] : '#190A28';
      ctx.strokeStyle = laneColors[i];
      ctx.lineWidth = 4;
      ctx.fillRect(lx + 12 - bounce * 0.5, receptorY - 14 - bounce * 0.5, laneWidth - 24 + bounce, 28 + bounce);
      ctx.strokeRect(lx + 12 - bounce * 0.5, receptorY - 14 - bounce * 0.5, laneWidth - 24 + bounce, 28 + bounce);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 18px Impact, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(laneKeys[i], rx, receptorY + 34);
    }
    ctx.restore();

    // 3. 绘制下落的 4K 音符
    if (this.state !== 'PLAYING') return;
    const fallSpeedPx = 540 * this.noteSpeedMult;

    for (const note of this.notes) {
      if (note.missed || note.holdCompleted || note.type === 'HAZARD') continue;
      if (note.hit && note.type !== 'HOLD') continue;

      const y = receptorY - (note.time - songTime) * fallSpeedPx;
      const tailY = receptorY - (note.endTime - songTime) * fallSpeedPx;
      if (y < -40 && tailY < -40) continue;
      if (tailY > H + 40) continue;

      const drawSingleBar = (laneIdx, barY, color, isDouble = false) => {
        const lx = highwayLeft + laneIdx * laneWidth;
        ctx.save();
        ctx.fillStyle = isDouble ? '#FFE600' : color;
        ctx.strokeStyle = '#190A28';
        ctx.lineWidth = 3.5;
        ctx.fillRect(lx + 12, barY - 13, laneWidth - 24, 26);
        ctx.strokeRect(lx + 12, barY - 13, laneWidth - 24, 26);
        ctx.restore();
      };

      if (note.type === 'HOLD') {
        const lx = highwayLeft + note.lane4 * laneWidth;
        const headY = note.holding ? receptorY : Math.min(receptorY, y);
        const barH = Math.max(12, headY - tailY);
        ctx.save();
        ctx.fillStyle = `${laneColors[note.lane4]}BB`;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.fillRect(lx + 24, tailY, laneWidth - 48, barH);
        ctx.strokeRect(lx + 24, tailY, laneWidth - 48, barH);
        ctx.restore();
        drawSingleBar(note.lane4, headY, laneColors[note.lane4], false);
      } else if (note.type === 'DOUBLE') {
        const l1 = note.lane4;
        const l2 = note.lane4Pair ?? ((l1 + 1) % 4);
        const x1 = highwayLeft + l1 * laneWidth + laneWidth * 0.5;
        const x2 = highwayLeft + l2 * laneWidth + laneWidth * 0.5;
        ctx.save();
        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.restore();
        drawSingleBar(l1, y, '#FFE600', true);
        drawSingleBar(l2, y, '#FFE600', true);
      } else {
        drawSingleBar(note.lane4, y, laneColors[note.lane4], false);
      }
    }
  }

  drawManiaPartnerPanel(ctx) {
    const partner = this.getActivePartner();
    const imgSrc = this.isFever ? partner.spriteFever : partner.spriteAction;
    const img = this.imageCache.get(imgSrc);

    ctx.save();
    // 漫画白框看板娘展示卡
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 5;
    ctx.fillRect(36, 36, 360, 350);
    ctx.strokeRect(36, 36, 360, 350);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 44, 44, 344, 286);
    }

    ctx.fillStyle = '#190A28';
    ctx.fillRect(44, 332, 344, 48);
    ctx.fillStyle = '#FFE600';
    ctx.font = '900 16px Impact, "PingFang SC", sans-serif';
    ctx.fillText(`🎹 4K MANIA · 搭档：${partner.name} (${partner.badge})`, 56, 362);

    // 毫秒偏差校准标尺 (±ms FAST / LATE Meter)
    const meterX = 216;
    const meterY = 445;
    ctx.fillStyle = '#190A28';
    ctx.strokeStyle = '#00F5D4';
    ctx.lineWidth = 3;
    ctx.fillRect(44, meterY - 22, 344, 54);
    ctx.strokeRect(44, meterY - 22, 344, 54);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FAST (-ms)          0ms SYNC          LATE (+ms)', meterX, meterY - 5);

    ctx.strokeStyle = '#FFE600';
    ctx.beginPath();
    ctx.moveTo(meterX, meterY + 4);
    ctx.lineTo(meterX, meterY + 26);
    ctx.stroke();

    const clampedOffset = Math.max(-90, Math.min(90, this.lastOffsetMs));
    const needleX = meterX + (clampedOffset / 90) * 145;
    ctx.fillStyle = Math.abs(clampedOffset) < 35 ? '#FFE600' : '#FF1493';
    ctx.fillRect(needleX - 5, meterY + 5, 10, 20);
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     粒子爆裂与粗黑描边漫画爆炸字渲染
     ------------------------------------------------------------------------ */
  drawParticlesAndPopups(ctx, dt) {
    // 粒子更新与绘制
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= dt * 2.1;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 漫画爆炸字更新与绘制
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 42 * dt;
      pop.scale += (1.0 - pop.scale) * Math.min(1, dt * 14);
      pop.life -= dt * 1.65;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life * 1.4);
      ctx.translate(pop.x, pop.y);
      ctx.scale(pop.scale, pop.scale);
      ctx.rotate(-0.05);

      ctx.font = '900 32px Impact, "Arial Black", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#190A28';
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);

      if (pop.subText) {
        ctx.font = '900 14px "PingFang SC", monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#190A28';
        ctx.strokeText(pop.subText, 0, 22);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(pop.subText, 0, 22);
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------------
     渲染本地高分榜弹窗表格
     ------------------------------------------------------------------------ */
  renderLeaderboardModal() {
    const wrap = document.getElementById('leaderboardTableWrap');
    const records = Object.values(this.loadRecords()).sort((a, b) => b.score - a.score);

    if (records.length === 0) {
      wrap.innerHTML = `<p style="padding:14px;font-weight:900;">暂无街机通关纪录，快点击【⚡ START LIVE! 开始打歌】创造你的首个 S+ 纪录吧！</p>`;
      return;
    }

    const rows = records
      .map(
        (r, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td><strong>《${r.trackTitle}》</strong></td>
          <td>${r.mode === 'RUN_2L' ? '🏃‍♀️ 横版双轨' : '🎹 4K 街机'} · ${r.diffName}</td>
          <td>${r.partnerName}</td>
          <td><strong>${r.rank}</strong> (${r.badgeText})</td>
          <td>${r.score.toLocaleString()}</td>
          <td>${r.maxCombo}</td>
          <td>${r.acc}%</td>
        </tr>
      `
      )
      .join('');

    wrap.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>曲目</th>
            <th>模式与难度</th>
            <th>搭档</th>
            <th>评级徽章</th>
            <th>最高分</th>
            <th>最大连击</th>
            <th>精准度</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* ------------------------------------------------------------------------
     拖入或选择本地音频文件 (.mp3/.ogg/.wav) 自动生成谱面
     ------------------------------------------------------------------------ */
  async handleCustomAudioFile(file) {
    if (!file) return;
    this.synth.ensureContext();
    try {
      const arrayBuf = await file.arrayBuffer();
      const audioBuffer = await this.synth.ctx.decodeAudioData(arrayBuf);
      const analysis = analyzeAudioBufferToChart(audioBuffer, 0);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const customId = `custom-${Date.now()}`;

      const customTrack = {
        id: customId,
        indexLabel: 'CUSTOM',
        icon: '💿',
        title: cleanName,
        enTitle: 'Custom Audio Auto-Chart',
        bpm: analysis.estimatedBpm,
        durationSec: Math.min(180, Math.floor(audioBuffer.duration)),
        defaultPartner: this.selectedPartnerId,
        sceneBg: 'assets/neonbeat/covers/track_03.webp',
        coverImg: 'assets/neonbeat/covers/track_03.webp',
        isCustom: true,
        audioBuffer,
        diffs: [
          { name: 'AUTO NORMAL ★★★', stars: 3 },
          { name: 'AUTO MASTER ★★★★★★', stars: 6 }
        ]
      };

      this.tracks.unshift(customTrack);
      this.selectTrack(customId);
      this.startLive();
    } catch (err) {
      alert(`音频解码失败，请确认文件为有效的 .mp3 / .ogg / .wav 格式：${err.message}`);
    }
  }

  /* ------------------------------------------------------------------------
     绑定所有键盘、鼠标、触控与 UI 按钮事件
     ------------------------------------------------------------------------ */
  bindEvents() {
    // 1. 双模式切换按钮
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.gameMode = btn.getAttribute('data-mode');
        this.updateStartOverlayInfo();
        this.renderTrackList();
      });
    });

    // 2. 难度切换按钮
    document.querySelectorAll('.diff-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDiffIdx = Number(btn.getAttribute('data-diff')) || 0;
        this.updateStartOverlayInfo();
        this.renderTrackList();
      });
    });

    // 3. 流速下拉选择
    document.getElementById('noteSpeedSelect').addEventListener('change', (e) => {
      this.noteSpeedMult = parseFloat(e.target.value) || 1.0;
    });

    // 4. AUTO PLAY 切换
    const btnAuto = document.getElementById('btnToggleAutoPlay');
    btnAuto.addEventListener('click', () => {
      this.autoPlay = !this.autoPlay;
      btnAuto.classList.toggle('active', this.autoPlay);
      btnAuto.textContent = this.autoPlay ? '🤖 AUTO: ON' : '🤖 AUTO: OFF';
    });

    // 5. 立即预览看板娘 SKILL CUT-IN
    document.getElementById('btnTriggerCutInTest').addEventListener('click', () => {
      this.triggerMangaCutIn('⚡ SKILL CUT-IN PREVIEW!!');
    });

    // 6. 开始打歌 / 试听 / 重开 / 返回选曲
    document.getElementById('btnStartSong').addEventListener('click', () => this.startLive());
    document.getElementById('btnRetrySong').addEventListener('click', () => this.startLive());
    document.getElementById('btnBackToSelect').addEventListener('click', () => this.stopLiveToIdle());
    document.getElementById('btnStopLive').addEventListener('click', () => this.stopLiveToIdle());

    document.getElementById('btnPreviewSynth').addEventListener('click', () => {
      this.autoPlay = true;
      btnAuto.classList.add('active');
      btnAuto.textContent = '🤖 AUTO: ON';
      this.startLive();
    });

    document.getElementById('btnPauseResume').addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        this.stopLiveToIdle();
      } else if (this.state === 'IDLE') {
        this.startLive();
      }
    });

    // 7. 键盘打歌绑定 (D / F / J / K + 方向键 ↑ / ↓ + 空格触发 Cut-in)
    const keyMap = {
      KeyD: 0,
      KeyF: 1,
      ArrowUp: 1,
      KeyW: 1,
      KeyJ: 2,
      ArrowDown: 2,
      KeyS: 2,
      KeyK: 3
    };

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code in keyMap) {
        e.preventDefault();
        this.handleLaneInput(keyMap[e.code], true);
      } else if (e.code === 'Space' && this.state === 'PLAYING') {
        e.preventDefault();
        this.triggerMangaCutIn('⚡ MANUAL FEVER CUT-IN!!');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code in keyMap) {
        this.handleLaneInput(keyMap[e.code], false);
      }
    });

    // 8. 底部街机打击垫鼠标/触屏事件
    document.querySelectorAll('.arcade-pad-btn').forEach((btn) => {
      const laneIdx = Number(btn.getAttribute('data-lane'));
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handleLaneInput(laneIdx, true);
      });
      btn.addEventListener('pointerup', () => this.handleLaneInput(laneIdx, false));
      btn.addEventListener('pointerleave', () => this.handleLaneInput(laneIdx, false));
    });

    // 9. 点击 Canvas 舞台直接交互（跑酷模式点上半屏=空中轨，下半屏=地面轨；4K模式按X坐标分轨）
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      if (this.gameMode === 'RUN_2L') {
        const lane = relY < 0.5 ? 1 : 2;
        this.handleLaneInput(lane, true);
        setTimeout(() => this.handleLaneInput(lane, false), 110);
      } else {
        const lane = Math.min(3, Math.max(0, Math.floor(relX * 4)));
        this.handleLaneInput(lane, true);
        setTimeout(() => this.handleLaneInput(lane, false), 110);
      }
    });

    // 10. 本地音乐文件选择与拖拽自生成谱面
    const dropzone = document.getElementById('audioDropzone');
    const fileInput = document.getElementById('customAudioInput');
    document.getElementById('btnPickAudioFile').addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleCustomAudioFile(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleCustomAudioFile(e.dataTransfer.files[0]);
      }
    });

    // 11. 高分榜与街机说明弹窗控制
    document.getElementById('btnOpenLeaderboard').addEventListener('click', () => {
      this.renderLeaderboardModal();
      document.getElementById('leaderboardModal').hidden = false;
    });
    document.getElementById('btnOpenHowToPlay').addEventListener('click', () => {
      document.getElementById('howToPlayModal').hidden = false;
    });
    document.getElementById('btnClearRecords').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      this.renderLeaderboardModal();
      this.renderTrackList();
      this.updateStartOverlayInfo();
    });
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        document.getElementById(modalId).hidden = true;
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.neonBeatArcade = new NeonBeatArcade();
});
