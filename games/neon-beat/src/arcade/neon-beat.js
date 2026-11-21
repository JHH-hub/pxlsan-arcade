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
const CALIBRATION_STORAGE_KEY = 'pxlsan-game:arcade:neonbeat:calibMs';
const NOFAIL_STORAGE_KEY = 'pxlsan-game:arcade:neonbeat:noFail';
// 失败局的最佳进度（不计入高分榜，仅在选曲卡上提示）
const PROGRESS_STORAGE_KEY = 'pxlsan-game:arcade:neonbeat:bestProgress';
// 体力规则（下标 0 = 左侧难度 / 1 = 右侧难度）：MISS 扣血、撞齿轮扣血、命中回血
//   EASY：命中率 ≈ 77% 以上即可持平，连续漏掉约 20 个音符才会归零
//   HARD：命中率 ≈ 84% 以上才持平，连续漏掉约 17 个音符即失败
const HP_RULES = [
  { miss: 5, hazard: 7, heal: 1.5, healGood: 0.75 },
  { miss: 6, hazard: 8.5, heal: 1.15, healGood: 0.5 }
];
// 4K 下落轨道几何（Canvas 坐标系，绘制与触控命中共用）
const MANIA_HIGHWAY = { left: 450, laneWidth: 132, lanes: 4 };
// 双押重拍：两键必须在该时间窗内先后按下
const DOUBLE_PRESS_WINDOW_SEC = 0.08;

// 新手练习（首次进入双轨模式时在舞台内边玩边学）与 4K 首次一行提示
const TUTORIAL_DONE_KEY = 'pxlsan-game:arcade:neonbeat:tutorialDone';
const MANIA_HINT_KEY = 'pxlsan-game:arcade:neonbeat:maniaHintSeen';
const PRACTICE_BPM = 96;
const PRACTICE_SPEED_MULT = 0.8;
const PRACTICE_TRACK = {
  id: 'practice',
  isPractice: true,
  indexLabel: 'PRACTICE',
  icon: '🎓',
  title: '新手练习',
  enTitle: 'Practice',
  bpm: PRACTICE_BPM,
  beatOffsetSec: 0,
  durationSec: 3600, // 练习按段推进，不以时长结束
  defaultPartner: 'takagi',
  diffs: [{ name: '练习', stars: 1, density: 0.3, hazardRate: 0, doubleRate: 0, holdRate: 0 }],
  synthProfile: { metronome: true }
};
// 练习分段：每段一句话 + 按键提示；beats = 音符间隔（拍）；len = 长条/连打时长（拍）
//   keys：提示的轨道（'air' / 'gnd'）；kb / touch：键盘 / 触屏两套台词（≤ 12 字）
const PRACTICE_SECTIONS = [
  { id: 'air', type: 'TAP', lane2: 0, count: 3, beats: 2, keys: ['air'], kb: '上面的音符按 F', touch: '上面的音符点 AIR' },
  { id: 'gnd', type: 'TAP', lane2: 1, count: 3, beats: 2, keys: ['gnd'], kb: '下面的按 J', touch: '下面的点 GND' },
  { id: 'dbl', type: 'DOUBLE', lane2: 0, count: 2, beats: 3, keys: ['air', 'gnd'], kb: '两个一起按', touch: '两个一起按' },
  { id: 'hold', type: 'HOLD', lane2: 1, count: 2, beats: 7, len: 4, keys: ['gnd'], hold: true, kb: '长条按住别松', touch: '长条按住别松' },
  { id: 'mash', type: 'MASH', lane2: 1, count: 1, beats: 4, len: 4, target: 6, keys: ['air', 'gnd'], mash: true, kb: '狂按！', touch: '狂按！' },
  { id: 'hazard', type: 'HAZARD', lane2: 1, count: 2, beats: 3, keys: ['air'], jump: true, kb: '红色的别碰！按 F 跳', touch: '红色的别碰！点 AIR 跳' }
];

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch (_) {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, '1');
  } catch (_) {}
}

// 秒数 → 「m:ss」曲长显示
function formatSongLength(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
    chibiRun1: 'assets/neonbeat/chibi/takagi_run1.webp',
    chibiRun2: 'assets/neonbeat/chibi/takagi_run2.webp',
    chibiAir: 'assets/neonbeat/chibi/takagi_air.webp',
    chibiSmash: 'assets/neonbeat/chibi/takagi_smash.webp',
    chibiRunSheet: 'assets/neonbeat/chibi/takagi_run_sheet.webp',
    chibiActionSheet: 'assets/neonbeat/chibi/takagi_action_sheet.webp',
    accent: '#FF1493',
    hairColor: '#5C3327',
    eyeColor: '#A84B2B',
    outfitPrimary: '#FFFFFF',
    outfitSecondary: '#2C4C7E',
    weaponName: '柠檬苏打重锤',
    weaponColor: '#FFE600'
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
    chibiRun1: 'assets/neonbeat/chibi/nagatoro_run1.webp',
    chibiRun2: 'assets/neonbeat/chibi/nagatoro_run2.webp',
    chibiAir: 'assets/neonbeat/chibi/nagatoro_air.webp',
    chibiSmash: 'assets/neonbeat/chibi/nagatoro_smash.webp',
    chibiRunSheet: 'assets/neonbeat/chibi/nagatoro_run_sheet.webp',
    chibiActionSheet: 'assets/neonbeat/chibi/nagatoro_action_sheet.webp',
    accent: '#FFE600',
    hairColor: '#1E1A24',
    eyeColor: '#B5633A',
    outfitPrimary: '#F3E5AB',
    outfitSecondary: '#2A334B',
    weaponName: '小恶魔画笔巨锤',
    weaponColor: '#FF1493'
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
    chibiRun1: 'assets/neonbeat/chibi/marin_run1.webp',
    chibiRun2: 'assets/neonbeat/chibi/marin_run2.webp',
    chibiAir: 'assets/neonbeat/chibi/marin_air.webp',
    chibiSmash: 'assets/neonbeat/chibi/marin_smash.webp',
    chibiRunSheet: 'assets/neonbeat/chibi/marin_run_sheet.webp',
    chibiActionSheet: 'assets/neonbeat/chibi/marin_action_sheet.webp',
    accent: '#00F5D4',
    hairColor: '#FFE07D',
    eyeColor: '#FF2E7E',
    outfitPrimary: '#FF1493',
    outfitSecondary: '#1E1633',
    weaponName: '星光霓虹电吉他',
    weaponColor: '#00F5D4'
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
    chibiRun1: 'assets/neonbeat/chibi/kaguya_run1.webp',
    chibiRun2: 'assets/neonbeat/chibi/kaguya_run2.webp',
    chibiAir: 'assets/neonbeat/chibi/kaguya_air.webp',
    chibiSmash: 'assets/neonbeat/chibi/kaguya_smash.webp',
    chibiRunSheet: 'assets/neonbeat/chibi/kaguya_run_sheet.webp',
    chibiActionSheet: 'assets/neonbeat/chibi/kaguya_action_sheet.webp',
    accent: '#FF1493',
    hairColor: '#191522',
    eyeColor: '#D91E48',
    outfitPrimary: '#1A1A26',
    outfitSecondary: '#D91E48',
    weaponName: '学生会黄金折扇刃',
    weaponColor: '#FFE600'
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
    chibiRun1: 'assets/neonbeat/chibi/kuroneko_run1.webp',
    chibiRun2: 'assets/neonbeat/chibi/kuroneko_run2.webp',
    chibiAir: 'assets/neonbeat/chibi/kuroneko_air.webp',
    chibiSmash: 'assets/neonbeat/chibi/kuroneko_smash.webp',
    chibiRunSheet: 'assets/neonbeat/chibi/kuroneko_run_sheet.webp',
    chibiActionSheet: 'assets/neonbeat/chibi/kuroneko_action_sheet.webp',
    accent: '#00F5D4',
    hairColor: '#1F1B2C',
    eyeColor: '#B81D4E',
    outfitPrimary: '#1D152B',
    outfitSecondary: '#9B4DFF',
    weaponName: '堕天圣暗黑十字镰',
    weaponColor: '#00F5D4'
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
    beatOffsetSec: 0.015, // 离线 onset 分析：124 BPM，首拍相位 ≈ 15ms
    durationSec: 170.3, // 离线 RMS 分析：音乐真实结束时间（见 BUILTIN_CHART_MAPS）
    defaultPartner: 'takagi',
    sceneBg: 'assets/neonbeat/covers/track_01.webp',
    coverImg: 'assets/neonbeat/covers/track_01.webp',
    localBgm: 'assets/neonbeat/bgm/track_01_tease.mp3',
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
    bpm: 132, // 原标注 136；离线 onset/自相关分析实测 132.0 BPM（全曲相位稳定）
    beatOffsetSec: 0.0,
    durationSec: 162.4, // 离线 RMS 分析：音乐真实结束时间（见 BUILTIN_CHART_MAPS）
    defaultPartner: 'nagatoro',
    sceneBg: 'assets/neonbeat/covers/track_02.webp',
    coverImg: 'assets/neonbeat/covers/track_02.webp',
    localBgm: 'assets/neonbeat/bgm/track_02_lemon.mp3',
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
    beatOffsetSec: 0.0,
    durationSec: 176.2, // 离线 RMS 分析：音乐真实结束时间（见 BUILTIN_CHART_MAPS）
    defaultPartner: 'marin',
    sceneBg: 'assets/neonbeat/covers/track_03.webp',
    coverImg: 'assets/neonbeat/covers/track_03.webp',
    localBgm: 'assets/neonbeat/bgm/track_03_starlight.mp3',
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
    bpm: 150, // 原标注 158；离线分析实测 150 BPM（自相关峰 75/150，取 150）
    beatOffsetSec: 0.0,
    durationSec: 169.2, // 离线 RMS 分析：音乐真实结束时间（见 BUILTIN_CHART_MAPS）
    defaultPartner: 'kaguya',
    sceneBg: 'assets/neonbeat/covers/track_04.webp',
    coverImg: 'assets/neonbeat/covers/track_04.webp',
    localBgm: 'assets/neonbeat/bgm/track_04_lovewar.mp3',
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
    beatOffsetSec: 0.0,
    durationSec: 177.0, // 离线 RMS 分析：音乐真实结束时间（见 BUILTIN_CHART_MAPS）
    defaultPartner: 'kuroneko',
    sceneBg: 'assets/neonbeat/covers/track_05.webp',
    coverImg: 'assets/neonbeat/covers/track_05.webp',
    localBgm: 'assets/neonbeat/bgm/track_05_crimson.mp3',
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
    // 内置 BGM 以 AudioBuffer 方式解码缓存（按 URL），与 AudioContext 时钟采样级同步
    this.bgmBufferCache = new Map();
    this.musicGain = null;
    this.isPaused = false;
    this.isFadingOut = false;
  }

  // 拉取并解码内置 mp3 为 AudioBuffer（同一曲目只解码一次；失败时清除缓存以便重试）
  loadBgmBuffer(url) {
    this.ensureContext();
    if (!this.bgmBufferCache.has(url)) {
      const promise = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then(
          (arrayBuf) =>
            new Promise((resolve, reject) => {
              // 兼容旧版 Safari 的回调式 decodeAudioData
              const ret = this.ctx.decodeAudioData(arrayBuf, resolve, reject);
              if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
            })
        );
      promise.catch(() => this.bgmBufferCache.delete(url));
      this.bgmBufferCache.set(url, promise);
    }
    return this.bgmBufferCache.get(url);
  }

  // 暂停：冻结 AudioContext 时钟（歌曲时间随之冻结）
  pause() {
    this.isPaused = true;
    if (this.ctx && this.ctx.state === 'running') {
      return this.ctx.suspend();
    }
    return Promise.resolve();
  }

  resume() {
    this.isPaused = false;
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  // 谱面结束后音乐渐弱淡出（停止合成器继续排程）
  fadeOutMusic(durationSec = 2.0) {
    if (!this.ctx || this.isFadingOut) return;
    this.isFadingOut = true;
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.musicGain) {
      const now = this.ctx.currentTime;
      const g = this.musicGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + durationSec);
    }
  }

  // 失败演出：唱片「掉电」式减速 + 快速渐弱（之后由 stopSong 彻底停止）
  slowDownAndStop(durationSec = 1.4) {
    if (!this.ctx) return;
    this.fadeOutMusic(durationSec);
    const src = this.customBufferSource;
    if (src && src.playbackRate) {
      const now = this.ctx.currentTime;
      try {
        src.playbackRate.cancelScheduledValues(now);
        src.playbackRate.setValueAtTime(src.playbackRate.value || 1, now);
        src.playbackRate.exponentialRampToValueAtTime(0.25, now + durationSec);
      } catch (_) {}
    }
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
    // 暂停期间（ctx.suspend）不允许被打击音效等调用意外恢复时钟
    if (this.ctx.state === 'suspended' && !this.isPaused) {
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

  // 练习节拍器：短促柔和的「嘀」（走音乐总线，随练习结束淡出）
  triggerTick(time, accent = false) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    osc.connect(gain);
    gain.connect(this.musicGain || this.masterGain);
    osc.start(time);
    osc.stop(time + 0.08);
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

  // 音符打击清脆反馈音效 (Muse Dash 级：重低音 Sub 808 Punch + 架子鼓 Rimshot 脆响 + 糖果高频泛音)
  playHitSfx(type = 'PERFECT') {
    this.ensureContext();
    const now = this.ctx.currentTime;

    // 1. 底层重低音 Sub Punch（拳拳到肉的鼓点胸腔震动感）
    if (type !== 'MISS') {
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      const startFreq = type === 'DOUBLE' || type === 'BOSS_KO' ? 195 : 165;
      subOsc.frequency.setValueAtTime(startFreq, now);
      subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.085);
      subGain.gain.setValueAtTime(type === 'DOUBLE' || type === 'BOSS_KO' ? 0.68 : 0.48, now);
      subGain.gain.exponentialRampToValueAtTime(0.004, now + 0.095);
      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 0.1);
    }

    // 2. 架子鼓 Rimshot / 棒球棍清脆瞬态噪音声 (Crisp Transient Snap)
    if (this.noiseBuffer && type !== 'MISS') {
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(type === 'MASH' ? 3200 : 2450, now);
      bp.Q.value = 1.8;
      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(type === 'PERFECT' || type === 'DOUBLE' ? 0.42 : 0.28, now);
      snapGain.gain.exponentialRampToValueAtTime(0.005, now + 0.045);
      snap.connect(bp);
      bp.connect(snapGain);
      snapGain.connect(this.masterGain);
      snap.start(now);
      snap.stop(now + 0.05);
    }

    // 3. 糖果高频泛音旋律脆响
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'PERFECT') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1975.5, now + 0.06);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
    } else if (type === 'DOUBLE' || type === 'BOSS_KO') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.exponentialRampToValueAtTime(2349.3, now + 0.12);
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.14);
    } else if (type === 'MASH') {
      osc.type = 'square';
      const randomPitch = 880 + Math.random() * 520;
      osc.frequency.setValueAtTime(randomPitch, now);
      osc.frequency.exponentialRampToValueAtTime(randomPitch * 1.65, now + 0.05);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.055);
    } else if (type === 'DODGE') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.09);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.1);
    } else if (type === 'CUTIN') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(2093.0, now + 0.24);
      gain.gain.setValueAtTime(0.36, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
    } else if (type === 'MISS') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.linearRampToValueAtTime(88, now + 0.15);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(1240, now + 0.06);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.075);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  scheduleStep(stepIndex, time) {
    if (!this.activeTrack || !this.activeTrack.synthProfile) return;
    const prof = this.activeTrack.synthProfile;
    const stepDur = (60 / this.activeTrack.bpm) / 4; // 16分音符时长
    const s16 = stepIndex % 16;

    // 新手练习：只留轻柔节拍器（每拍一下，小节首拍略高），不抢注意力
    if (prof.metronome) {
      if (s16 % 4 === 0) {
        this.triggerTick(time, s16 === 0);
        if (typeof this.onBeatCallback === 'function') this.onBeatCallback(stepIndex / 4);
      }
      return;
    }
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

  /**
   * 开始播放：所有音频源都以 AudioContext 时钟 songStartContextTime 为零点
   * @param {object} track
   * @param {string} mode 'studio' | 'synth' | 'hybrid'
   * @param {AudioBuffer|null} bgmBuffer 已解码的内置 BGM（解码失败时为 null → 回退合成器）
   */
  startSong(track, mode = 'synth', bgmBuffer = null) {
    this.ensureContext();
    this.stopSong();
    this.activeTrack = track;
    this.audioSourceMode = mode;
    this.isPlaying = true;
    this.isFadingOut = false;
    this.currentStep = 0;
    this.pausedElapsedSec = 0;
    this.songStartContextTime = this.ctx.currentTime + 0.1;
    this.nextStepTime = this.songStartContextTime + (track.beatOffsetSec || 0);

    // 每首歌独立的音乐总线（用于谱面结束后的渐弱淡出，不影响打击音效）
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 1.0;
    this.musicGain.connect(this.masterGain);

    const playBuffer = (buffer, volume) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const vol = this.ctx.createGain();
      vol.gain.value = volume;
      src.connect(vol);
      vol.connect(this.musicGain);
      src.start(this.songStartContextTime);
      this.customBufferSource = src;
    };

    // 若为用户拖入的自定义 AudioBuffer，直接播放解码后的音频流
    if (track.isCustom && track.audioBuffer) {
      playBuffer(track.audioBuffer, 1.0);
      return;
    }

    // 优先使用 Flow Music 原创高清音游曲（AudioBufferSourceNode 精确对齐时钟，仅保留静音节拍时钟）
    if (mode === 'studio' && bgmBuffer) {
      playBuffer(bgmBuffer, 0.92);
      const beatDur = 60 / track.bpm;
      const beatClock = () => {
        if (!this.isPlaying || this.isFadingOut) return;
        while (this.nextStepTime < this.ctx.currentTime + 0.12) {
          if (typeof this.onBeatCallback === 'function') {
            this.onBeatCallback(this.currentStep);
          }
          this.nextStepTime += beatDur;
          this.currentStep += 1;
        }
        this.stepTimer = window.setTimeout(beatClock, 25);
      };
      beatClock();
      return;
    }

    // 若选择了混音伴奏模式 (hybrid)，叠加播放本地 BGM
    if (mode === 'hybrid' && bgmBuffer) {
      playBuffer(bgmBuffer, 0.36);
    }

    // 合成器（含 studio 模式 BGM 解码失败时的回退）
    const stepDur = (60 / track.bpm) / 4;
    const scheduler = () => {
      if (!this.isPlaying || this.isFadingOut) return;
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
    if (this.ctx && this.isPlaying) {
      this.pausedElapsedSec = this.getElapsedSec();
    }
    this.isPlaying = false;
    this.isFadingOut = false;
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
    if (this.musicGain) {
      try {
        this.musicGain.disconnect();
      } catch (_) {}
      this.musicGain = null;
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

/* 离线音频分析生成（ffmpeg + numpy：RMS 能量 / 频谱通量 onset，按实测 BPM 与首拍相位对齐）
 * endSec：音乐真实结束（平滑 RMS 跌破峰值 -35dB）；fadeSec：尾奏开始衰减（跌破 -8dB）
 * blocks：每行 = 4 小节（64 个 16 分音符格），前缀为段落标签
 *   I 前奏 / V 主歌(平稳) / B 铺垫(渐强) / C 副歌(高能) / K 间奏(Break) / O 尾奏
 *   后接每个 16 分格的 onset 强度 0–9（已吸附到 1/4 拍网格） */
const BUILTIN_CHART_MAPS = {
  'track-01-tease': {
    endSec: 170.3, fadeSec: 169.6, fileSec: 172.9,
    sections: 'ICCCKKVVKBCCCCKVVBCCCC',
    blocks: [
      'I:2150508526534061508182381181475050706094143240607232423050451551',
      'C:9100912234238161807192271070663040409062313290709027016000005443',
      'C:9030804433237040504191280060923090609064332390708041812561625350',
      'C:5040826534249160706051361060734050507054242280608108017112014243',
      'K:7010504312406020801340341280841080107053135071207018405310805410',
      'K:8010715413607220310340331180851030207044135070108013505310705010',
      'V:8020506312607050903250631290843080408074226070507027416310908520',
      'V:9030818312606050402240531080633090428073227080609032506210706230',
      'K:3020211021204020301220311111301100302110202140202111201131122111',
      'B:6141233120915030504230531040603030405140504050315109006100013000',
      'C:9030805434239050806191270192734060419053042293202211703050635440',
      'C:5060903223237040705191361090734070509063452370606027024102105442',
      'C:9130904424238060605091181080823020105032221510507030702540516340',
      'C:5060906425249050707091371190734060609064342470405109017023114000',
      'K:3100201110103110200040210010301050004006016141115002325000503330',
      'V:6020303410614040803130801061315060413145106130405035216100123111',
      'V:6030506322506060603150631062335060405064124162231030403160305240',
      'B:6020604222407040704350703060705050306042214132332002022000005000',
      'C:9050805323238060805191280281543130409052242420405122613250535440',
      'C:5060903213138040706191361070743060409064352360607026125103216432',
      'C:8130805423328051704171271060813030105032112290405030813350417340',
      'C:606090642533905070619138108064305040705324136040710712610000500',
    ]
  },
  'track-02-lemon': {
    endSec: 162.4, fadeSec: 162.0, fileSec: 164.9,
    sections: 'ICVBCCBCCCCVVVVVBCCCCOO',
    blocks: [
      'I:2144308183719065605422724553937370624071477391919090727549215511',
      'C:6026326154339061903731425644744291252030141031405409184011009000',
      'V:7001911273307130802073129040915090319231933097609024812180307240',
      'B:7010923394507150904194119050924060219050923094009090744601206310',
      'C:6110713292618141905072116061905060319151913174519042713260505130',
      'C:5120714192607161906092439070807060408260606053217061835610705240',
      'B:6011001111102021101121211221313220302131133150514050517457216310',
      'C:4004312113625140602711211563735041307150827140005004503260706317',
      'C:1030614161516141805081315350414120707052924161335050914160505152',
      'C:1050513162415140506071417150514240608142725264541050814340505121',
      'C:0330913141416041704081316240504130509241619425161041905161407352',
      'V:1140523143415132114060404150503312143421011053316100811373115120',
      'V:7020621180205130802082227321633171217212713042407010923294317250',
      'V:9120722181326130602291509120830150806325011161305010713181507131',
      'V:9040711170507150703182516241634180316121605041305020925183416161',
      'V:9060612280707161603092507170421040426246105052405102102110204031',
      'B:1020303111303132103030311131514110304121641261113036104121326261',
      'C:5044122111525131303152618171633020045131624493461050524061415131',
      'C:6050513251404131315082425351613230607231515051511040613191415150',
      'C:6060613151504132307091434282337310506133205043210363912151415131',
      'C:4050714171305141404091416143141511509153614062222030513142515132',
      'O:2040514030306234133438210668453310001001101111111010011101110100',
      'O:100111101435340240000',
    ]
  },
  'track-03-starlight': {
    endSec: 176.2, fadeSec: 175.2, fileSec: 178.8,
    sections: 'IIIIKBCCKBCCCCCCVVVBCCCCCCO',
    blocks: [
      'I:0091122111311210411322241231612071103471026108107115410810418222',
      'I:5021736120604530813283452250812061123106111021071040541001101121',
      'I:2050231320704520609334339091703080904525409044207073362060717120',
      'I:7051252440805430809334349091602081317223104062207170807402524210',
      'K:5110404021607040603072705090404060606070426070508050932060604040',
      'B:6070807041707060607092805090609080907080439070737190705120708020',
      'C:5050505032508040708161706091603080705070327070508080612080918040',
      'C:9060508141608050705161705081504072409161024091318071807000215021',
      'K:8012012021010030300200502002003061021020400210323010302121021010',
      'B:4101203040012020610110402102112061203140512061107061806303117000',
      'C:9142514242406341606083262160903160928091436092706071912460506121',
      'C:5052717133508231705360808150912150808116706170820622713411009001',
      'C:9163816134308332817083362270903160937072345062618081912580608121',
      'C:6162814143307021603540708170901140918034607091710643805500009101',
      'C:5000412020413120501150404050403060118030508160306002504060616040',
      'C:3110503030504020602081203050403040306021305051407261909200727240',
      'V:9115015020313041113260811141721072152160526160611221806221506110',
      'V:6202603030505160208091512080810061015010711061105109109101011000',
      'V:7031214051005001402050040240700040313250820080026060600550206001',
      'B:4052317024306031603230504030601020625103406060711712613311113100',
      'C:9163523133405132608162453260902170938151246042619081912570616131',
      'C:5093526033405122604431809160912130735125705070911472617510116000',
      'C:9051314121306121506092461260802160927080315053517071913460619111',
      'C:5164716154405121603340615041701130917005607090801924913310117000',
      'C:6111622211214111502081322330803140307452525043315141712441427110',
      'C:4111538310206140511250610320812061155371614080800530605410009000',
      'O:5020020201200300211121230320400061101312221013108060605320646413',
    ]
  },
  'track-04-lovewar': {
    endSec: 169.2, fadeSec: 168.6, fileSec: 171.8,
    sections: 'IICCCCVVVVVBCCCVBCCKBCCCCOO',
    blocks: [
      'I:1092005070703040810120031031223040721040506110406103412010422120',
      'I:9062012230203070705100116020321061011110311141114110110120009200',
      'C:7040715070708431805082507140616071307152806085305041707060307120',
      'C:9150916070709330805090409130616090204152806075207284242092304260',
      'C:7050716070607340305081604050415060506131514051304040505080505130',
      'C:3130515041305130404061304060514040405040521240804122244490309030',
      'V:9010901090108030901081309010611090209020904090902021904051308110',
      'V:9110911091209020901090309110711190309030904090920021202320909210',
      'V:6111105051201100812610708220114290202090723000109015006092211050',
      'V:9111105081201010601310406230213060311060631072014010034030200351',
      'V:6230414151106100902102207021023080308060802091109111011082210120',
      'B:8102601262009200702020202081062051124082111091009130413160606321',
      'C:6030905060506130705080406060733080409140703052608030514060306310',
      'C:7262315132204141704060505060653050508040304061507050522141315140',
      'C:5060614170405040513050506150525040405220404040507040506073126162',
      'V:5200700001107010501030406120404090306040403090408030604041406020',
      'B:6020604070206034502080305030902060209030604090307120904060307020',
      'C:5220811051247130302060504130806150519040405091506130916041507150',
      'C:7041814160405241411010506204105041212041522230424120103051221070',
      'K:2120214040503040400230121020202040612220707120209102302120202020',
      'B:6111222230203090621231225020400051002010211140203100000120008100',
      'C:4240415060608340505180406230434051327142606064406040716071306320',
      'C:8140715080607330805071507130524061313151604164308065142072203141',
      'C:7150615140605230306071505130414080404231515262213050504050505030',
      'C:4130705030505140405082414060515070415150631141624010012010200230',
      'O:4120302130104010712102305111023060308030702091108112011091120110',
      'O:8001710162007210610111000000',
    ]
  },
  'track-05-crimson': {
    endSec: 177.0, fadeSec: 169.5, fileSec: 177.0,
    sections: 'IIIICCCCKBCCCCKBCCCCKKKBCCCCKOOO',
    blocks: [
      'I:2130102020101020201030202010103020201020101010203010202030101020',
      'I:4120203020202020302050203021203040203010102010103100000000000100',
      'I:9000211020201010202020203010202040101010102010102031301030102021',
      'I:8011201020101021201030103010202040103011203010111000110110000000',
      'C:9011506000409050803090602050906080107050116090409030916010907061',
      'C:8010515010408140602090603150908060307070206091508061309070108060',
      'C:8010506001408130802061501030616050105060104080506020805010609060',
      'C:7010715020409150802090402040706070105050113071505000506020406062',
      'K:6110101020201010102040304010305030202010202010102030203030102020',
      'B:9101101010101111102030103011111030102010111011102210011232323210',
      'C:9010614060308120611080404040910060306030406091019020905050509010',
      'C:8120715040609110901090405060902070207030404080209000714060308101',
      'C:7010813060309030711090604050910090205040415091109010806040507110',
      'C:7011513040509110701091304050912070207120802071109010613071403120',
      'K:6000000100000100110000000000000040102020301020103020102020101010',
      'B:9010504070124040503060503030502070113130511030125100211123122100',
      'C:9010706030508050903091604040906090209080305091609020906020809061',
      'C:6040605022307130903080604140808070406080215080508161409061507151',
      'C:9020506040409040904090504040806061205090403070506040807050609060',
      'C:5040808041409050813161215121605040106050303080404110513061214450',
      'K:6100000010001010200010101010101020001020101020203010201020202010',
      'K:2010103020203010301020202021103030102020102020103000112111112110',
      'K:6001101110111010101010101010202010001020101020102010101010201010',
      'B:1010202010101010201010101011001020101020102020102010102011202100',
      'C:4000211240003120210000547160900090106040405091108010905030509101',
      'C:7200503030407110701091303040913060207040403090118010905070409101',
      'C:9010614040308110501090503030802070205040404081106010814050407110',
      'C:8010414030509110803080406050702060007110702061107010401050305111',
      'K:8000000000000000120000000000000040102010201010103020102010102111',
      'O:8010202040101010402020305130102090002040602131106001101012102310',
      'O:3101101000012000710000000000000000000000000000000000000000000000',
      'O:0000000000000000000000000000000000000000000000',
    ]
  },
};

/**
 * 为内置电音曲目生成兼具音乐感与打击爽感的谱面
 * 每个音符结构：{ id, time, type: 'TAP'|'DOUBLE'|'HOLD'|'HAZARD'|'MASH', lane2: 0|1, lane4: 0|1|2|3, endTime, hit, holding, missed }
 * 有离线段落图（BUILTIN_CHART_MAPS）的曲目：全曲长度 + 按段落变化密度/题型 + 音符吸附真实 onset；
 * 否则回退到旧的固定网格生成器。
 */
function generateBuiltinChart(track, diffIdx = 0) {
  const map = BUILTIN_CHART_MAPS[track.id];
  if (!map) return generateLegacyChart(track, diffIdx);
  return generateSectionChart(track, map, diffIdx);
}

const SECTION_LABELS = { I: '前奏', V: '主歌', B: '铺垫', C: '副歌', K: '间奏', O: '尾奏' };

// 段落谱面风格（数组下标 0 = 左侧难度 / 1 = 右侧难度）
//   nps：每秒目标音符数；grid：可落点网格（16 分格数）；gap：最小间隔（16 分格）
//   hold / dbl / hazard：长按 / 双押 / 齿轮 的转换概率；patterns：轮换使用的配键型
const SECTION_STYLES = {
  I: { nps: [0.8, 1.45], grid: [4, 2], gap: [4, 2], hold: [0.4, 0.32], dbl: [0, 0.03], hazard: [0, 0.04], patterns: ['sway', 'pairs'] },
  V: { nps: [1.3, 2.45], grid: [2, 2], gap: [2, 2], hold: [0.26, 0.2], dbl: [0.03, 0.07], hazard: [0.08, 0.12], patterns: ['pairs', 'sway', 'stairs'] },
  B: { nps: [1.6, 3.0], grid: [2, 1], gap: [2, 1], hold: [0.05, 0.04], dbl: [0.08, 0.14], hazard: [0.05, 0.08], patterns: ['stairs', 'trill'], ramp: true },
  C: { nps: [2.05, 3.85], grid: [2, 1], gap: [2, 1], hold: [0.05, 0.05], dbl: [0.16, 0.24], hazard: [0.1, 0.15], patterns: ['jumps', 'trill', 'stairs', 'jumps'] },
  K: { nps: [0.55, 0.95], grid: [4, 2], gap: [4, 2], hold: [0.55, 0.45], dbl: [0, 0], hazard: [0, 0.04], patterns: ['sway'] },
  O: { nps: [0.7, 1.15], grid: [4, 2], gap: [4, 2], hold: [0.45, 0.35], dbl: [0, 0.03], hazard: [0, 0], patterns: ['sway', 'pairs'] }
};

function makeChartNote(id, time, type, lane4, extra = {}) {
  const lane2 = lane4 < 2 ? 0 : 1;
  const base = { id, time, type, lane2, lane4, endTime: time, hit: false, missed: false };
  if (type === 'HOLD' || type === 'MASH') {
    Object.assign(base, { holding: false, holdCompleted: false, lastTickTime: time });
  }
  if (type === 'HAZARD') base.dodged = false;
  return Object.assign(base, extra);
}

function generateSectionChart(track, map, diffIdx) {
  const slot = diffIdx >= 1 ? 1 : 0;
  const diff = track.diffs[diffIdx] || track.diffs[0];
  const rng = createSeededRng(`${track.id}-sections-diff-${diffIdx}`);
  const beatSec = 60 / track.bpm;
  const q = beatSec / 4; // 1/4 拍（16 分音符）网格
  const off = track.beatOffsetSec || 0;
  const densScale = Math.max(0.8, Math.min(1.35, diff.density / (slot === 0 ? 0.62 : 1.0)));

  // 解析段落图：每 block = 4 小节 = 64 个 16 分格
  const blocks = map.blocks.map((row) => ({ label: row[0], s: row.slice(2) }));
  const strengthAt = (i) => {
    const b = blocks[Math.floor(i / 64)];
    if (!b) return 0;
    const ch = b.s.charCodeAt(i % 64) - 48;
    return ch >= 0 && ch <= 9 ? ch : 0;
  };
  const labelAt = (i) => (blocks[Math.floor(i / 64)] || { label: 'O' }).label;
  const timeOf = (i) => off + i * q;

  const startStep = Math.ceil((1.8 - off) / beatSec) * 4;
  // 谱面在尾奏衰减前收尾（突然结束的曲目留 0.8s 余韵）
  const chartEndSec = Math.min(map.fadeSec, map.endSec - 0.8);
  const lastStep = Math.floor((chartEndSec - off) / q);

  // 1. 逐 block 选取落点：得分 = onset 强度 + 节拍位置加成，按密度目标取前 K 个（满足最小间隔）
  const picks = [];
  const taken = new Uint8Array(lastStep + 8);
  // 越往后的副歌越密集（第 1 / 2 / 3+ 段副歌 ×1.0 / ×1.08 / ×1.15），铺垫同步加码
  let chorusRun = 0;
  blocks.forEach((blk, k) => {
    const style = SECTION_STYLES[blk.label] || SECTION_STYLES.V;
    if (blk.label === 'C' && (k === 0 || blocks[k - 1].label !== 'C')) chorusRun += 1;
    const i0 = Math.max(startStep, k * 64);
    const i1 = Math.min(lastStep, k * 64 + 63);
    if (i1 < i0) return;
    const span = (i1 - i0 + 1) * q;
    const runMul = blk.label === 'C' || blk.label === 'B' ? [1.0, 1.0, 1.08, 1.15][Math.min(3, chorusRun + (blk.label === 'B' ? 1 : 0))] : 1.0;
    const target = Math.round(style.nps[slot] * span * densScale * runMul);
    const grid = style.grid[slot];
    const gap = style.gap[slot];
    const cands = [];
    for (let i = i0; i <= i1; i++) {
      if (i % grid !== 0) continue;
      const p = i % 64;
      const s = strengthAt(i);
      // 16 分反拍只在 onset 很强时才落键（真实的鼓点/切分），否则保持 8 分网格
      if (i % 2 === 1 && s < 6) continue;
      const pos = p % 16 === 0 ? 4 : p % 8 === 0 ? 3 : p % 4 === 0 ? 2 : p % 2 === 0 ? 0.5 : 0;
      const ramp = style.ramp ? Math.floor(p / 16) * 1.1 : 0;
      cands.push({ i, s, score: s + pos + ramp + rng() * 0.6 });
    }
    cands.sort((a, b) => b.score - a.score);
    const chosen = [];
    for (const c of cands) {
      if (chosen.length >= target) break;
      let ok = true;
      for (let d = 1; d < Math.max(2, gap + 1); d++) {
        const nb = [c.i - d, c.i + d];
        for (const j of nb) {
          if (j < 0 || j >= taken.length || !taken[j]) continue;
          // 16 分相邻仅允许双方都是强 onset（真实连打）
          if (d === 1 && gap === 1 && c.s >= 6 && strengthAt(j) >= 6) continue;
          if (d < gap || d === 1) ok = false;
        }
      }
      if (!ok) continue;
      // 防止 16 分连打超过 4 连
      if (gap === 1) {
        let run = 1;
        for (let j = c.i - 1; j >= 0 && taken[j]; j--) run++;
        for (let j = c.i + 1; j < taken.length && taken[j]; j++) run++;
        if (run > 4) continue;
      }
      taken[c.i] = 1;
      chosen.push(c);
    }
    chosen.forEach((c) => picks.push({ i: c.i, s: c.s, label: blk.label, block: k }));
  });
  picks.sort((a, b) => a.i - b.i);

  // 2. Boss 冲锋连打（MASH）：放在「进入副歌」的第一拍，间隔 ≥ 24 秒
  const mashSteps = [];
  const mashLen = 14; // 3.5 拍
  let lastMashSec = -999;
  blocks.forEach((blk, k) => {
    const prev = k > 0 ? blocks[k - 1].label : 'I';
    const runStart = blk.label === 'C' && prev !== 'C';
    const longRun = blk.label === 'C' && k >= 2 && blocks[k - 1].label === 'C' && blocks[k - 2].label === 'C' && (blocks[k + 1] || {}).label === 'C';
    if (!runStart && !longRun) return;
    const i = k * 64;
    const t = timeOf(i);
    if (t < 10 || t - lastMashSec < 24 || timeOf(i + mashLen + 12) > chartEndSec) return;
    mashSteps.push(i);
    lastMashSec = t;
  });
  const inMash = (i) => mashSteps.some((m) => i >= m - 2 && i < m + mashLen + 4);
  const filtered = picks.filter((p) => !inMash(p.i));

  // 3. 题型 + 配键：按段落轮换配键型（同一副歌段内每 4 小节换一种），保证不是单调循环
  const notes = [];
  let noteId = 1;
  let laneSeq = 0;
  let prevLane4 = 1;
  let curBlock = -1;
  let pattern = 'sway';
  let trillPair = [1, 2];
  const TRILL_PAIRS = [[1, 2], [0, 3], [0, 2], [1, 3]];
  const STAIRS = [0, 1, 2, 3, 2, 1];
  const SWAY = [1, 1, 2, 2];
  const PAIRS = [0, 1, 3, 2];
  const pickLane = (pk) => {
    if (pk.block !== curBlock) {
      curBlock = pk.block;
      const style = SECTION_STYLES[pk.label] || SECTION_STYLES.V;
      pattern = style.patterns[(pk.block + diffIdx) % style.patterns.length];
      trillPair = TRILL_PAIRS[Math.floor(rng() * TRILL_PAIRS.length)];
      laneSeq = 0;
    }
    let lane;
    if (pattern === 'sway') lane = SWAY[laneSeq % 4] + (pk.block % 2 === 1 && laneSeq % 8 >= 4 ? (laneSeq % 2 ? 1 : -1) : 0);
    else if (pattern === 'pairs') lane = PAIRS[Math.floor(laneSeq / 2) % 4];
    else if (pattern === 'stairs') lane = STAIRS[laneSeq % STAIRS.length];
    else if (pattern === 'trill') lane = trillPair[laneSeq % 2];
    else {
      // jumps：强 onset 甩到外侧轨（2 轨模式 = 空中/地面大幅换轨）
      lane = pk.s >= 8 ? (rng() < 0.5 ? 0 : 3) : Math.floor(rng() * 4);
    }
    laneSeq += 1;
    lane = Math.max(0, Math.min(3, lane));
    return lane;
  };

  const entryStyleFor = (lane2) => {
    const r = rng();
    if (r < 0.16) return 'GHOST';
    return lane2 === 0 ? (r < 0.62 ? 'SWOOP' : 'WAVE') : r < 0.72 ? 'BOUNCE' : 'SNIPER';
  };

  let mi = 0;
  const pushMashUpTo = (i) => {
    while (mi < mashSteps.length && mashSteps[mi] <= i) {
      const m = mashSteps[mi++];
      const t = timeOf(m);
      notes.push(
        makeChartNote(noteId++, t, 'MASH', 1, {
          lane2: 1,
          endTime: t + mashLen * q,
          mashHits: 0,
          targetHits: slot === 0 ? 10 : 14,
          entryStyle: 'BOSS_CHARGE'
        })
      );
    }
  };

  for (let n = 0; n < filtered.length; n++) {
    const pk = filtered[n];
    pushMashUpTo(pk.i);
    const style = SECTION_STYLES[pk.label] || SECTION_STYLES.V;
    const prevGap = n > 0 ? pk.i - filtered[n - 1].i : 99;
    const nextMash = mashSteps.find((m) => m > pk.i);
    const nextGap = Math.min(n + 1 < filtered.length ? filtered[n + 1].i - pk.i : 99, nextMash != null ? nextMash - pk.i : 99);
    const nextLabel = n + 1 < filtered.length ? filtered[n + 1].label : 'O';
    const p = pk.i % 64;
    const t = timeOf(pk.i);
    let lane4 = pickLane(pk);
    // 4K：16 分相邻不出同轨「纵连」
    if (prevGap === 1 && lane4 === prevLane4) lane4 = (lane4 + 1) % 4;

    const isLast = n === filtered.length - 1;
    const buildClimax = pk.label === 'B' && nextLabel === 'C' && nextGap >= 2 && filtered[n + 1] && filtered[n + 1].block !== pk.block;
    const r = rng();

    // 长按：平稳段落、拍点上、后面留有空档
    if (!isLast && pk.i % 4 === 0 && nextGap >= 6 && r < style.hold[slot]) {
      const maxLen = 'KIO'.includes(pk.label) ? 8 : 6;
      const len = Math.max(4, Math.min(maxLen, nextGap - 2) & ~1);
      notes.push(makeChartNote(noteId++, t, 'HOLD', lane4, { endTime: t + len * q, entryStyle: 'WAVE' }));
      prevLane4 = lane4;
      continue;
    }

    // 双押：副歌/铺垫的强拍 + 铺垫段落最后一下 + 全曲最后一下
    const dblOk = prevGap >= 2 && nextGap >= 2;
    const strongDown = p % 8 === 0 && pk.s >= 5 && rng() < style.dbl[slot] * 2.2;
    if (dblOk && (isLast || buildClimax || strongDown)) {
      const pair = slot === 1 && rng() < 0.5 ? [0, 3] : rng() < 0.5 ? [1, 2] : [0, 2 + Math.floor(rng() * 2)];
      notes.push(makeChartNote(noteId++, t, 'DOUBLE', pair[0], { lane2: 0, lane4Pair: pair[1], entryStyle: 'SWOOP' }));
      prevLane4 = pair[0];
      continue;
    }

    // 尖刺齿轮：弱拍/反拍上的闪避题
    if ((pk.i % 4 !== 0 || p % 8 === 4) && dblOk && r > 1 - style.hazard[slot]) {
      const hazardLane2 = rng() < 0.55 ? 1 : 0;
      notes.push(makeChartNote(noteId++, t, 'HAZARD', hazardLane2 === 0 ? 0 : 3, { lane2: hazardLane2, entryStyle: 'SNIPER' }));
      continue;
    }

    const tap = makeChartNote(noteId++, t, 'TAP', lane4);
    tap.entryStyle = entryStyleFor(tap.lane2);
    notes.push(tap);
    prevLane4 = lane4;
  }
  pushMashUpTo(Infinity);

  return notes.sort((a, b) => a.time - b.time);
}

// 统计谱面各段落音符数（调试 / 验证用：window.neonBeatArcade.describeChart()）
function summarizeChartSections(track, notes) {
  const map = BUILTIN_CHART_MAPS[track.id];
  if (!map) return null;
  const blockSec = (60 / track.bpm) * 16;
  const off = track.beatOffsetSec || 0;
  return map.blocks.map((row, k) => {
    const t0 = off + k * blockSec;
    const t1 = t0 + blockSec;
    const inBlk = notes.filter((n) => n.time >= t0 - 1e-6 && n.time < t1 - 1e-6);
    const types = {};
    inBlk.forEach((n) => {
      types[n.type] = (types[n.type] || 0) + 1;
    });
    return { block: k, label: row[0], section: SECTION_LABELS[row[0]], t0: Number(t0.toFixed(1)), count: inBlk.length, nps: Number((inBlk.length / blockSec).toFixed(2)), types };
  });
}

function generateLegacyChart(track, diffIdx = 0) {
  const diff = track.diffs[diffIdx] || track.diffs[0];
  const rng = createSeededRng(`${track.id}-diff-${diffIdx}`);
  const beatSec = 60 / track.bpm;
  const subStepSec = beatSec / 2; // 8分音符主网格
  const notes = [];
  let noteId = 1;

  // 谱面网格对齐到实测首拍相位（原先固定 1.8s 起点不在拍点上，会导致整张谱面偏离节拍）
  const beatOffset = track.beatOffsetSec || 0;
  const startSec = beatOffset + Math.ceil((1.8 - beatOffset) / beatSec) * beatSec;
  const endSec = track.durationSec - 2.0;
  let nextAvailableTime = startSec;
  let nextBossMashTime = 14.5; // 每隔约 18 秒在副歌高潮处触发一次「Boss 冲锋狂按连打 (MASH!!)」

  for (let t = startSec; t < endSec; t += subStepSec) {
    if (t < nextAvailableTime - 0.02) continue;

    // 0. 副歌高潮 Boss 贴脸连打对决 (MASH Note · 对标喵斯快跑连打怪/Boss互殴)
    if (t >= nextBossMashTime && t + 2.2 < endSec) {
      const mashDur = beatSec * 3.5;
      notes.push({
        id: noteId++,
        time: t,
        type: 'MASH',
        lane2: 1,
        lane4: 1,
        endTime: t + mashDur,
        mashHits: 0,
        targetHits: 10,
        hit: false,
        holding: false,
        holdCompleted: false,
        lastTickTime: t,
        missed: false,
        entryStyle: 'BOSS_CHARGE'
      });
      nextAvailableTime = t + mashDur + beatSec * 1.0;
      nextBossMashTime = t + 18.5;
      continue;
    }

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
        missed: false,
        entryStyle: 'SWOOP'
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
        missed: false,
        entryStyle: 'WAVE'
      });
      nextAvailableTime = t + holdDuration + subStepSec * 0.5;
      continue;
    }

    // 3. 尖刺齿轮弹幕 (HAZARD)
    if (!isPhraseAccent && typeRoll >= diff.doubleRate + diff.holdRate && typeRoll < diff.doubleRate + diff.holdRate + diff.hazardRate) {
      const hazardLane2 = rng() < 0.55 ? 1 : 0;
      notes.push({
        id: noteId++,
        time: t,
        type: 'HAZARD',
        lane2: hazardLane2,
        lane4: hazardLane2 === 0 ? 0 : 3,
        endTime: t,
        hit: false,
        dodged: false,
        missed: false,
        entryStyle: 'SNIPER'
      });
      nextAvailableTime = t + subStepSec * 0.9;
      continue;
    }

    // 4. 常规空中飞翼怪 / 地面蹦跳音响怪 / 幽灵隐身怪 (TAP + 喵斯快跑风弧线/弹跳轨迹)
    const lane2 = rng() < 0.5 ? 0 : 1;
    const lane4 = lane2 === 0 ? (rng() < 0.5 ? 0 : 1) : (rng() < 0.5 ? 2 : 3);
    const styleRoll = rng();
    const entryStyle =
      styleRoll < 0.18
        ? 'GHOST'
        : lane2 === 0
        ? styleRoll < 0.62
          ? 'SWOOP'
          : 'WAVE'
        : styleRoll < 0.72
        ? 'BOUNCE'
        : 'SNIPER';

    notes.push({
      id: noteId++,
      time: t,
      type: 'TAP',
      lane2,
      lane4,
      endTime: t,
      hit: false,
      missed: false,
      entryStyle
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

    // 跑酷角色姿态与满配物理状态 (Muse Dash 风 Q 版跑酷引擎)
    this.runnerLane = 1; // 0 = 空中跃起 (AIR), 1 = 地面奔跑 (GROUND)
    this.runnerJumpTimer = 0;
    this.runnerAttackPoseTimer = 0;
    this.runnerAnimState = 'RUN'; // 'RUN' | 'AIR_SLASH' | 'GROUND_SMASH' | 'DOUBLE_BURST' | 'HURT'
    this.comboAttackStage = 0; // 0 = A段上挑斩, 1 = B段重锤下砸, 2 = C段旋风回旋击
    this.runnerBaseX = 215;
    this.runnerY = 375;
    this.runnerVy = 0;
    this.runnerLungeX = 0;
    this.runnerScaleX = 1.0;
    this.runnerScaleY = 1.0;
    this.runnerTilt = 0;
    this.runnerStepPhase = 0;
    this.lastStepIndex = -1;
    this.slashParity = 0;

    // 驻场巨型 Q 版魔王 Boss 状态 (右侧常驻巨体 + 16:9 魔王机甲王座大图阶段 + 副歌冲锋连打 MASH 互殴)
    this.bossHp = 100;
    this.bossHurtTimer = 0;
    this.bossKnockbackTimer = 0;
    this.bossSplashTimer = 0;
    this.activeMashNote = null;

    // 4 层高速视差卷轴偏移 & 镜头打击反馈
    this.parallaxOffsets = [0, 0, 0, 0];
    this.cameraZoom = 1.0;
    this.cameraPunchX = 0;
    this.cameraPunchY = 0;
    this.hitstopTimer = 0;

    // 刀光挥击弧线、Q 版残影、脚底星尘与被击飞怪物物理队列
    this.slashEffects = [];
    this.runnerAfterimages = [];
    this.knockedMonsters = [];
    this.footstepDust = [];

    this.beatPulseValue = 0;
    this.receptorBounce = [0, 0, 0, 0];
    this.keyDownLanes = [false, false, false, false];
    this.lastLanePressTime = [0, 0, 0, 0];

    // 本局会话快照（开局时锁定曲目/难度/模式/搭档，结算时据此存档）
    this.liveSession = null;
    this.songEnding = false;
    this.loadToken = 0;
    this.resumeCountdownTimer = null;
    this.canvasPointerLanes = new Map();
    this.calibrationMs = this.loadCalibrationMs();
    this.noFail = this.loadNoFail();
    this.failTimer = null;
    // 新手练习运行态（null = 未在练习）与 4K 首次提示计时器
    this.practice = null;
    this.maniaHintTimer = null;
    this.touchUi = false;
    // 本局谱面统计（Boss 血量 / FEVER 充能按总音符数缩放）
    this.chartStats = { hitNotes: 1, bossUnit: 1, feverPerHit: 4.5 };

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
      this.cameraZoom = Math.max(this.cameraZoom, 1.024);
      document.documentElement.style.setProperty('--beat-pulse', '1.035');
      setTimeout(() => {
        document.documentElement.style.setProperty('--beat-pulse', '1');
      }, 95);
    };

    requestAnimationFrame((ts) => this.loop(ts));
  }

  preloadAllImages() {
    const urls = new Set([
      'assets/neonbeat/stage/stage_bg_city.webp',
      'assets/neonbeat/stage/stage_bg_fever.webp',
      'assets/neonbeat/vfx/vfx_hazard_saw.webp',
      'assets/neonbeat/vfx/vfx_receptor_air.webp',
      'assets/neonbeat/vfx/vfx_receptor_gnd.webp',
      'assets/neonbeat/vfx/vfx_slash_arc.webp',
      'assets/neonbeat/monsters/monster_air_bat.webp',
      'assets/neonbeat/monsters/monster_gnd_slime.webp',
      'assets/neonbeat/monsters/monster_ghost.webp',
      'assets/neonbeat/monsters/boss_mecha_king.webp',
      'assets/neonbeat/monsters/boss_mecha_hurt.webp',
      'assets/neonbeat/monsters/boss_queen_cg.webp'
    ]);
    Object.values(PARTNERS).forEach((p) => {
      urls.add(p.avatar);
      urls.add(p.spriteNormal);
      urls.add(p.spriteAction);
      urls.add(p.spriteFever);
      urls.add(p.cutinCg);
      if (p.chibiRun1) urls.add(p.chibiRun1);
      if (p.chibiRun2) urls.add(p.chibiRun2);
      if (p.chibiAir) urls.add(p.chibiAir);
      if (p.chibiSmash) urls.add(p.chibiSmash);
      if (p.chibiRunSheet) urls.add(p.chibiRunSheet);
      if (p.chibiActionSheet) urls.add(p.chibiActionSheet);
    });
    this.tracks.forEach((t) => urls.add(t.sceneBg));

    urls.forEach((src) => {
      const img = new Image();
      img.src = `${src}?v=md4`;
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
    const progress = this.loadBestProgress();
    container.innerHTML = '';

    this.tracks.forEach((track) => {
      const isSelected = track.id === this.selectedTrackId;
      const partner = PARTNERS[track.defaultPartner] || PARTNERS.takagi;
      const recKey = this.getRecordKey(track.id, this.selectedDiffIdx, this.gameMode);
      const best = records[recKey];
      const bestPct = progress[recKey];
      const rankText = best
        ? `👑 ${escapeHtml(best.rank)} · ${escapeHtml(best.score)}`
        : bestPct
        ? `💔 最佳进度 ${escapeHtml(bestPct)}%`
        : 'NEW';

      const card = document.createElement('div');
      card.className = `track-card${isSelected ? ' active' : ''}`;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(isSelected));
      card.innerHTML = `
        <div class="track-card-left">
          <img class="track-avatar-mini" src="${escapeHtml(track.coverImg || partner.avatar)}" alt="${escapeHtml(track.title)}" />
          <div class="track-meta">
            <div class="track-title-row">
              <span class="track-idx">${escapeHtml(track.indexLabel)}</span>
              <span class="track-name">${escapeHtml(track.icon)} 《${escapeHtml(track.title)}》</span>
            </div>
            <div class="track-sub">${escapeHtml(track.enTitle)} · 搭档：${escapeHtml(partner.name)}</div>
          </div>
        </div>
        <div class="track-card-right">
          <span class="bpm-pill">BPM ${escapeHtml(track.bpm)} · ⏱ ${escapeHtml(formatSongLength(track.durationSec))}</span>
          <span class="rank-mini-badge">${rankText}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        if (this.areLiveControlsLocked()) {
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
      btn.disabled = this.areLiveControlsLocked();
      btn.innerHTML = `
        <img src="${p.avatar}?v=md3" alt="${p.name}" />
        <span>${p.name.replace('同学', '').replace('(黑猫)', '')}</span>
      `;
      btn.addEventListener('click', () => {
        if (this.areLiveControlsLocked()) return;
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

    // AudioContext 已创建（用户已交互）时预解码所选曲目 BGM，缩短开局加载
    if (this.synth.ctx && track.localBgm && !track.isCustom) {
      this.synth.loadBgmBuffer(track.localBgm).catch(() => {});
    }
  }

  selectPartner(partnerId) {
    if (!PARTNERS[partnerId]) return;
    this.selectedPartnerId = partnerId;
    const p = this.getActivePartner();

    document.getElementById('partnerCardImg').src = `${p.spriteAction}?v=md3`;
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
      `${track.indexLabel} · BPM ${track.bpm} · ⏱ ${formatSongLength(track.durationSec)} · ${diff.name}`;
    document.getElementById('startCardTitle').textContent = `${track.icon} 《${track.title}》`;
    document.getElementById('startCardSub').textContent =
      `${track.enTitle} · 出战搭档：${partner.name}（${partner.badge}）`;
    document.getElementById('hudNowPlayingTitle').textContent =
      `${track.icon} ${track.indexLabel} · 《${track.title}》 (${diff.name})`;

    // 开始卡上只留一行键位（不再放大段说明）；首次未练习时高亮「新手练习」
    const keysMini = document.getElementById('startKeysMini');
    if (keysMini) {
      keysMini.innerHTML =
        this.gameMode === 'RUN_2L'
          ? this.isTouchUi()
            ? '上轨点 AIR · 下轨点 GND'
            : '<kbd>F</kbd> 上 · <kbd>J</kbd> 下'
          : this.isTouchUi()
          ? '四个按键对应四条轨道'
          : '<kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>';
    }
    const btnPractice = document.getElementById('btnStartPractice');
    if (btnPractice) btnPractice.classList.toggle('is-new', !this.isTutorialDone());

    const bestTextEl = document.getElementById('startBestScoreText');
    if (best) {
      bestTextEl.textContent = `评级 ${best.rank} · ${best.score.toLocaleString()} 分 · MAX COMBO ${best.maxCombo} (${best.acc}%)`;
    } else {
      const bestPct = this.loadBestProgress()[this.getRecordKey(track.id, this.selectedDiffIdx, this.gameMode)];
      bestTextEl.textContent = bestPct
        ? `尚未通关 · 最佳进度 ${bestPct}%，再冲一次！`
        : '尚无纪录 · 等你首通摘取 S+ 桂冠！';
    }
  }

  /* ------------------------------------------------------------------------
     开始打歌、暂停与停止流程
     ------------------------------------------------------------------------ */
  isLiveState() {
    return this.state === 'PLAYING' || this.state === 'PAUSED';
  }

  // 判定用歌曲时间（叠加用户校准偏移：正值 = 判定整体后移，适合总是按晚/蓝牙耳机延迟）
  getJudgeTime() {
    return this.synth.getElapsedSec() - this.calibrationMs / 1000;
  }

  loadCalibrationMs() {
    try {
      const v = Number(localStorage.getItem(CALIBRATION_STORAGE_KEY));
      return Number.isFinite(v) ? Math.max(-200, Math.min(200, Math.round(v))) : 0;
    } catch (_) {
      return 0;
    }
  }

  setCalibrationMs(ms) {
    this.calibrationMs = Math.max(-200, Math.min(200, Math.round(Number(ms) || 0)));
    try {
      localStorage.setItem(CALIBRATION_STORAGE_KEY, String(this.calibrationMs));
    } catch (_) {}
    const range = document.getElementById('judgeOffsetRange');
    const text = document.getElementById('judgeOffsetText');
    if (range) range.value = String(this.calibrationMs);
    if (text) text.textContent = `${this.calibrationMs > 0 ? '+' : ''}${this.calibrationMs} ms`;
  }

  loadNoFail() {
    try {
      return localStorage.getItem(NOFAIL_STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  setNoFail(on) {
    this.noFail = !!on;
    try {
      if (this.noFail) localStorage.setItem(NOFAIL_STORAGE_KEY, '1');
      else localStorage.removeItem(NOFAIL_STORAGE_KEY);
    } catch (_) {}
    const btn = document.getElementById('btnToggleNoFail');
    if (btn) {
      btn.classList.toggle('active', this.noFail);
      btn.textContent = this.noFail ? '🛡️ 不死模式: ON' : '🛡️ 不死模式: OFF';
      btn.setAttribute('aria-pressed', String(this.noFail));
    }
    document.body.classList.toggle('nofail-on', this.noFail);
  }

  loadBestProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? JSON.parse(raw) || {} : {};
    } catch (_) {
      return {};
    }
  }

  saveBestProgress(key, pct) {
    const all = this.loadBestProgress();
    if ((all[key] || 0) >= pct) return false;
    all[key] = Number(pct.toFixed(1));
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(all));
    } catch (_) {}
    return true;
  }

  setAutoPlay(on) {
    this.autoPlay = !!on;
    const btnAuto = document.getElementById('btnToggleAutoPlay');
    if (btnAuto) {
      btnAuto.classList.toggle('active', this.autoPlay);
      btnAuto.textContent = this.autoPlay ? '🤖 AUTO: ON' : '🤖 AUTO: OFF';
    }
    if (this.autoPlay && this.liveSession && this.isLiveState()) {
      this.liveSession.autoUsed = true;
    }
  }

  // 打歌中（含暂停/加载）锁定难度、模式与搭档，避免中途篡改导致存档串档
  setLiveControlsLocked(locked) {
    document
      .querySelectorAll('.mode-btn, .diff-pill, .partner-tab-btn, #btnToggleNoFail')
      .forEach((btn) => {
        btn.disabled = locked;
      });
  }

  areLiveControlsLocked() {
    return this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'LOADING' || this.state === 'FAILING';
  }

  releaseAllLanes() {
    for (let i = 0; i < 4; i++) {
      if (this.keyDownLanes[i]) this.handleLaneInput(i, false);
    }
    this.canvasPointerLanes.clear();
  }

  showToast(message, durationMs = 3200) {
    let toast = document.getElementById('nbToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nbToast';
      toast.className = 'nb-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), durationMs);
  }

  setLoadingBadge(visible) {
    const badge = document.getElementById('stageLoadingBadge');
    if (badge) badge.hidden = !visible;
    ['btnStartSong', 'btnRetrySong', 'btnPreviewSynth'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = visible;
    });
  }

  ensurePlayfieldVisible() {
    const frame = this.stageFrame;
    if (!frame || typeof frame.scrollIntoView !== 'function') return;
    const rect = frame.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < 0 || rect.bottom > vh) {
      frame.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  /* ------------------------------------------------------------------------
     暂停 / 继续（AudioContext.suspend 冻结歌曲时钟）
     ------------------------------------------------------------------------ */
  pauseLive() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.synth.pause();
    this.releaseAllLanes();
    this.cancelResumeCountdown();
    const overlay = document.getElementById('stagePauseOverlay');
    if (overlay) overlay.hidden = false;
    this.updateBottomJudge('PAUSED', 0, false);
    document.getElementById('bottomOffsetText').textContent = 'Esc / P 继续';
  }

  cancelResumeCountdown() {
    if (this.resumeCountdownTimer) {
      clearTimeout(this.resumeCountdownTimer);
      this.resumeCountdownTimer = null;
    }
    const cd = document.getElementById('pauseCountdown');
    const actions = document.getElementById('pauseActions');
    if (cd) cd.hidden = true;
    if (actions) actions.hidden = false;
  }

  resumeLive() {
    if (this.state !== 'PAUSED' || this.resumeCountdownTimer) return;
    const cd = document.getElementById('pauseCountdown');
    const actions = document.getElementById('pauseActions');
    if (actions) actions.hidden = true;
    let n = 3;
    const tick = () => {
      if (this.state !== 'PAUSED') return;
      if (n <= 0) {
        this.resumeCountdownTimer = null;
        if (cd) cd.hidden = true;
        if (actions) actions.hidden = false;
        document.getElementById('stagePauseOverlay').hidden = true;
        this.state = 'PLAYING';
        this.synth.resume();
        this.updateBottomJudge('GO!!', 0, false);
        return;
      }
      if (cd) {
        cd.hidden = false;
        cd.textContent = String(n);
      }
      n -= 1;
      this.resumeCountdownTimer = setTimeout(tick, 520);
    };
    tick();
  }

  togglePause() {
    if (this.state === 'PLAYING') this.pauseLive();
    else if (this.state === 'PAUSED') {
      if (this.resumeCountdownTimer) this.cancelResumeCountdown();
      else this.resumeLive();
    }
  }

  resetPerSongState() {
    this.bossHp = 100;
    this.bossHurtTimer = 0;
    this.bossKnockbackTimer = 0;
    this.bossSplashTimer = 0;
    this.activeMashNote = null;
    this.hitstopTimer = 0;
    this.cameraZoom = 1.0;
    this.cameraPunchX = 0;
    this.cameraPunchY = 0;
    this.runnerJumpTimer = 0;
    this.runnerAttackPoseTimer = 0;
    this.comboAttackStage = 0;
    this.slashParity = 0;
    this.runnerStepPhase = 0;
    this.lastStepIndex = -1;
    this.beatPulseValue = 0;
    this.receptorBounce = [0, 0, 0, 0];
    this.lastLanePressTime = [0, 0, 0, 0];
    this.songEnding = false;
    // 清除上一局残留的 Cut-in 演出
    if (this.cutinHideTimer) {
      clearTimeout(this.cutinHideTimer);
      this.cutinHideTimer = null;
    }
    this.cutinActive = false;
    this.cutinBannerData = null;
    const cutinOverlay = document.getElementById('mangaCutinOverlay');
    if (cutinOverlay) cutinOverlay.classList.remove('active');
    this.stageFrame.classList.remove('shake-micro', 'shake-heavy');
    document.getElementById('hudSongProgress').style.width = '0%';
  }

  async startLive({ preview = false } = {}) {
    if (this.state === 'LOADING') return;
    if (this.practice) this.teardownPractice();
    // 首次在双轨模式开打：先进入「新手练习」，练完（或跳过）再自动开始所选曲目
    if (!preview && !this.autoPlay && this.gameMode === 'RUN_2L' && !this.isTutorialDone()) {
      this.startPractice({ thenStartSong: true });
      return;
    }
    const track = this.getActiveTrack();
    const audioMode = document.getElementById('audioSourceMode').value;

    // 退出暂停 / 上一局
    this.clearFailTimer();
    this.cancelResumeCountdown();
    const pauseOverlay = document.getElementById('stagePauseOverlay');
    if (pauseOverlay) pauseOverlay.hidden = true;
    this.synth.stopSong();
    this.synth.resume();

    // 内置曲目：先完整解码 mp3 → AudioBuffer，再以 AudioContext 时钟精确起播
    this.pendingPreview = !!preview;
    let bgmBuffer = null;
    if (!track.isCustom && track.localBgm && (audioMode === 'studio' || audioMode === 'hybrid')) {
      const token = ++this.loadToken;
      this.state = 'LOADING';
      this.setLiveControlsLocked(true);
      this.setLoadingBadge(true);
      try {
        bgmBuffer = await this.synth.loadBgmBuffer(track.localBgm);
      } catch (err) {
        bgmBuffer = null;
        this.showToast('⚠️ 音乐加载失败，已切换为合成器节拍伴奏');
      }
      if (token !== this.loadToken) return; // 加载期间被取消（返回选曲/切歌）
      this.setLoadingBadge(false);
    }

    this.beginLive(track, audioMode, bgmBuffer, preview);
  }

  beginLive(track, audioMode, bgmBuffer, preview) {
    const partner = this.getActivePartner();
    this.liveSession = {
      track,
      trackId: track.id,
      diffIdx: this.selectedDiffIdx,
      mode: this.gameMode,
      partnerId: partner.id,
      isPreview: !!preview,
      autoUsed: this.autoPlay,
      noFail: track.isPractice ? true : this.noFail,
      isPractice: !!track.isPractice,
      hpDepleted: false
    };
    this.resetPerSongState();
    this.notes = track.isPractice
      ? [] // 练习谱面由 updatePractice 按段即时排入
      : track.isCustom
      ? analyzeAudioBufferToChart(track.audioBuffer, this.selectedDiffIdx).notes
      : generateBuiltinChart(track, this.selectedDiffIdx);
    this.computeChartStats();

    this.particles = [];
    this.popups = [];
    this.slashEffects = [];
    this.runnerAfterimages = [];
    this.knockedMonsters = [];
    this.footstepDust = [];
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
    this.runnerY = 375;
    this.runnerVy = 0;
    this.runnerLungeX = 0;
    this.runnerScaleX = 1.0;
    this.runnerScaleY = 1.0;
    this.runnerTilt = 0;
    this.runnerAnimState = 'RUN';

    document.getElementById('stageStartOverlay').hidden = true;
    document.getElementById('stageResultOverlay').hidden = true;

    this.state = 'PLAYING';
    this.setLiveControlsLocked(true);
    this.synth.startSong(track, audioMode, bgmBuffer);
    this.updateHud();
    this.updateBottomJudge('READY TO ROCK!!', 0, false);
    this.ensurePlayfieldVisible();
    if (!track.isPractice && !preview && this.gameMode === 'MANIA_4K' && !readFlag(MANIA_HINT_KEY)) {
      this.showManiaHint();
    }
  }

  /* ------------------------------------------------------------------------
     新手练习（舞台内边玩边学）：一句话气泡 + 按键/打击垫动画提示，按段推进
       · 每段音符全部结算后：命中数 ≥ need 即进入下一段，否则温和地重来一遍
       · need = ceil(音符数 × 60%)；同一段失败 2 次后 need 再降 1（至少 1）
       · 体力冻结、无 FEVER / Cut-in、不记录成绩；可随时「跳过」
     ------------------------------------------------------------------------ */
  isTutorialDone() {
    return !!this.tutorialDoneMem || readFlag(TUTORIAL_DONE_KEY);
  }

  isTouchUi() {
    if (this.touchUi) return true;
    try {
      return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    } catch (_) {
      return false;
    }
  }

  setGameModeUi(mode) {
    this.gameMode = mode;
    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    this.updateStartOverlayInfo();
    this.renderTrackList();
  }

  startPractice({ thenStartSong = false } = {}) {
    const restore = this.practice
      ? this.practice.restore
      : { mode: this.gameMode, speed: this.noteSpeedMult };
    if (this.practice) {
      this.practice = null; // 重新练习：保留最初的模式/流速以便结束时还原
    }
    if (this.state !== 'IDLE') this.stopLiveToIdle();
    this.hideManiaHint();
    if (this.gameMode !== 'RUN_2L') this.setGameModeUi('RUN_2L');
    this.noteSpeedMult = PRACTICE_SPEED_MULT;
    this.setAutoPlay(false);
    document.getElementById('howToPlayModal').hidden = true;

    this.practice = {
      restore,
      thenStartSong: !!thenStartSong,
      idx: 0,
      attempt: 0,
      need: 1,
      phase: 'intro',
      nextAt: 0.5,
      curNotes: [],
      nextId: 9000
    };
    this.beginLive(PRACTICE_TRACK, 'synth', null, false);
    this.chartStats.bossUnit = 4;
    if (this.synth.musicGain) this.synth.musicGain.gain.value = 0.85;
    document.getElementById('hudNowPlayingTitle').textContent = '🎓 新手练习';
    document.getElementById('practiceLayer').hidden = false;
    this.setPracticeBubble('');
    this.setPracticeKeys(null);
    this.renderPracticeDots();
    this.updateBottomJudge('PRACTICE', 0, false);
  }

  // 练习结束 / 跳过 / 中途退出的公共清理（由 stopLiveToIdle 调用）
  teardownPractice({ markDone = true } = {}) {
    const p = this.practice;
    if (!p) return;
    this.practice = null;
    if (markDone) {
      this.tutorialDoneMem = true; // localStorage 不可用时也不会反复进入练习
      writeFlag(TUTORIAL_DONE_KEY);
    }
    this.notes = [];
    this.noteSpeedMult = p.restore.speed;
    const layer = document.getElementById('practiceLayer');
    if (layer) layer.hidden = true;
    this.setPracticeKeys(null);
    if (p.restore.mode !== this.gameMode) this.setGameModeUi(p.restore.mode);
    else this.updateStartOverlayInfo();
  }

  skipPractice() {
    const then = !!(this.practice && this.practice.thenStartSong);
    this.stopLiveToIdle();
    if (then) this.startLive();
  }

  finishPractice() {
    const then = !!(this.practice && this.practice.thenStartSong);
    this.stopLiveToIdle();
    if (then) this.startLive();
    else this.showToast('🎉 练习完成！选首歌开打吧', 2400);
  }

  setPracticeBubble(text, tone = '') {
    const el = document.getElementById('practiceBubble');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.className = `practice-bubble${tone ? ` is-${tone}` : ''}`;
    // 重新触发弹出动画
    void el.offsetWidth;
    el.classList.add('pop');
  }

  setPracticeKeys(sec) {
    const touch = this.isTouchUi();
    const lanes = { air: { key: 'F', pad: 1 }, gnd: { key: 'J', pad: 2 } };
    document.querySelectorAll('.arcade-pad-btn').forEach((b) => b.classList.remove('practice-pad-hint'));
    Object.keys(lanes).forEach((name) => {
      const el = document.getElementById(name === 'air' ? 'practiceKeyAir' : 'practiceKeyGnd');
      if (!el) return;
      const on = !!(sec && sec.keys.includes(name));
      el.hidden = !on;
      if (!on) return;
      el.className = `practice-key ${name}${sec.hold ? ' is-hold' : ''}${sec.mash ? ' is-mash' : ''}${touch ? ' is-touch' : ''}`;
      el.querySelector('kbd').textContent = touch ? (name === 'air' ? 'AIR' : 'GND') : lanes[name].key;
      el.querySelector('em').textContent = sec.hold ? '按住' : sec.mash ? '连打' : sec.jump ? '跳' : '';
      el.querySelector('.pk-finger').textContent = touch ? '👆' : '👇';
      if (touch) {
        const pad = document.querySelector(`.arcade-pad-btn[data-lane="${lanes[name].pad}"]`);
        if (pad) pad.classList.add('practice-pad-hint');
      }
    });
  }

  renderPracticeDots() {
    const wrap = document.getElementById('practiceDots');
    if (!wrap || !this.practice) return;
    wrap.innerHTML = PRACTICE_SECTIONS.map((s, i) => {
      const cls = i < this.practice.idx ? 'done' : i === this.practice.idx ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
  }

  isPracticeNoteResolved(n) {
    if (n.type === 'HOLD' || n.type === 'MASH') return n.missed || n.holdCompleted;
    if (n.type === 'HAZARD') return n.hit;
    return n.hit || n.missed;
  }

  isPracticeNoteSuccess(n) {
    if (n.type === 'HOLD') return n.hit && n.holdCompleted && !n.holdBroken && !n.missed;
    if (n.type === 'MASH') return (n.mashHits || 0) >= (n.targetHits || 6);
    if (n.type === 'HAZARD') return !!n.dodged;
    return n.hit && !n.missed;
  }

  startPracticeSection(songTime) {
    const p = this.practice;
    const sec = PRACTICE_SECTIONS[p.idx];
    const beat = 60 / PRACTICE_BPM;
    const firstT = Math.ceil((songTime + 2.3) / beat) * beat;
    const notes = [];
    for (let i = 0; i < sec.count; i++) {
      const t = firstT + i * sec.beats * beat;
      const id = p.nextId++;
      if (sec.type === 'TAP') {
        notes.push(makeChartNote(id, t, 'TAP', sec.lane2 === 0 ? 1 : 2, { lane2: sec.lane2, entryStyle: 'LINEAR' }));
      } else if (sec.type === 'DOUBLE') {
        notes.push(makeChartNote(id, t, 'DOUBLE', 1, { lane2: 0, lane4Pair: 2, entryStyle: 'LINEAR' }));
      } else if (sec.type === 'HOLD') {
        notes.push(makeChartNote(id, t, 'HOLD', 2, { lane2: 1, endTime: t + sec.len * beat, entryStyle: 'WAVE' }));
      } else if (sec.type === 'MASH') {
        notes.push(
          makeChartNote(id, t, 'MASH', 1, {
            lane2: 1,
            endTime: t + sec.len * beat,
            mashHits: 0,
            targetHits: sec.target,
            warningTriggered: true, // 练习不放 16:9 魔王巨图预警，直接冲脸
            entryStyle: 'BOSS_CHARGE'
          })
        );
      } else if (sec.type === 'HAZARD') {
        notes.push(makeChartNote(id, t, 'HAZARD', 3, { lane2: 1, entryStyle: 'SNIPER' }));
      }
    }
    this.notes = notes;
    p.curNotes = notes;
    p.lastEnd = Math.max(...notes.map((n) => n.endTime || n.time));
    const base = Math.max(1, Math.ceil(sec.count * 0.6));
    p.need = Math.max(1, base - (p.attempt >= 2 ? 1 : 0));
    p.phase = 'play';
    const touch = this.isTouchUi();
    this.setPracticeBubble(touch ? sec.touch : sec.kb);
    this.setPracticeKeys(sec);
    this.renderPracticeDots();
  }

  updatePractice(songTime) {
    const p = this.practice;
    if (!p) return;
    if (p.phase === 'play') {
      const allDone = p.curNotes.every((n) => this.isPracticeNoteResolved(n)) || songTime > p.lastEnd + 1.5;
      if (!allDone) return;
      const hits = p.curNotes.filter((n) => this.isPracticeNoteSuccess(n)).length;
      p.lastResult = { idx: p.idx, hits, need: p.need, total: p.curNotes.length };
      this.setPracticeKeys(null);
      if (hits >= p.need) {
        p.idx += 1;
        p.attempt = 0;
        this.synth.playHitSfx('DODGE');
        if (p.idx >= PRACTICE_SECTIONS.length) {
          p.phase = 'done';
          p.nextAt = songTime + 1.8;
          this.setPracticeBubble('完成！🎉', 'done');
          this.spawnPopup('PRACTICE CLEAR!!', '#FFE600', '', 540, 170);
        } else {
          p.phase = 'feedback';
          p.nextAt = songTime + 1.0;
          this.setPracticeBubble('👍 好！', 'good');
        }
        this.renderPracticeDots();
      } else {
        p.attempt += 1;
        p.phase = 'feedback';
        p.nextAt = songTime + 1.2;
        this.setPracticeBubble('再来一次～', 'retry');
      }
      return;
    }
    if (songTime < p.nextAt) return;
    if (p.phase === 'done') this.finishPractice();
    else this.startPracticeSection(songTime);
  }

  // 4K 首次开打：3 秒一行提示，四个键帽对准四条轨道（不打断歌曲）
  showManiaHint() {
    writeFlag(MANIA_HINT_KEY);
    const el = document.getElementById('maniaHint');
    if (!el) return;
    const touch = this.isTouchUi();
    document.getElementById('maniaHintText').textContent = touch ? '四个按键对应四条轨道' : 'D F J K 对应四条轨道';
    el.classList.toggle('is-touch', touch);
    el.hidden = false;
    if (touch) document.querySelectorAll('.arcade-pad-btn').forEach((b) => b.classList.add('practice-pad-hint'));
    if (this.maniaHintTimer) clearTimeout(this.maniaHintTimer);
    this.maniaHintTimer = setTimeout(() => this.hideManiaHint(), 3000);
  }

  hideManiaHint() {
    if (this.maniaHintTimer) {
      clearTimeout(this.maniaHintTimer);
      this.maniaHintTimer = null;
    }
    const el = document.getElementById('maniaHint');
    if (el && !el.hidden) {
      el.hidden = true;
      if (!this.practice) document.querySelectorAll('.arcade-pad-btn').forEach((b) => b.classList.remove('practice-pad-hint'));
    }
  }

  // 按全曲音符总量缩放 Boss 伤害与 FEVER 充能，保证 3 分钟长谱面的节奏感：
  //   Boss 血条贯穿全曲（全部命中时恰好在曲末被击破）；FEVER 约每 1/5.5 的音符量充满一次
  computeChartStats() {
    let weight = 0;
    let hitNotes = 0;
    for (const n of this.notes) {
      if (n.type === 'TAP' || n.type === 'HOLD') {
        weight += 1;
        hitNotes += 1;
      } else if (n.type === 'DOUBLE') {
        weight += 2;
        hitNotes += 1;
      } else if (n.type === 'MASH') {
        weight += n.targetHits || 10; // 连打：前 2×targetHits 下每下 0.5 份伤害
      }
    }
    const fillHits = Math.max(22, Math.min(120, Math.round(hitNotes / 5.5)));
    this.chartStats = {
      hitNotes,
      bossUnit: 100 / Math.max(1, weight),
      feverPerHit: 100 / fillHits,
      hpRule: HP_RULES[this.selectedDiffIdx >= 1 ? 1 : 0]
    };
  }

  // 调试 / 验证：输出所选曲目谱面各段落（4 小节一块）的音符数与题型
  describeChart(trackId = this.selectedTrackId, diffIdx = this.selectedDiffIdx) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track || track.isCustom) return null;
    const notes = generateBuiltinChart(track, diffIdx);
    return { total: notes.length, lastNoteSec: notes.length ? notes[notes.length - 1].time : 0, durationSec: track.durationSec, blocks: summarizeChartSections(track, notes) };
  }

  damageBoss(units) {
    this.bossHp = Math.max(0, this.bossHp - units * this.chartStats.bossUnit);
  }

  clearFailTimer() {
    if (this.failTimer) {
      clearTimeout(this.failTimer);
      this.failTimer = null;
    }
  }

  // 体力归零：音乐减速 + 渐弱 → FAILED 结算
  failSong() {
    if (this.state !== 'PLAYING') return;
    const track = this.liveSession ? this.liveSession.track : this.getActiveTrack();
    const songTime = this.synth.getElapsedSec();
    this.failProgressPct = Math.max(0, Math.min(99.9, (songTime / track.durationSec) * 100));
    this.state = 'FAILING';
    this.releaseAllLanes();
    this.isFever = false;
    document.body.classList.remove('fever-mode-active');
    this.synth.slowDownAndStop(1.4);
    this.runnerAnimState = 'HURT';
    this.triggerScreenShake(true);
    this.updateBottomJudge('STAGE FAILED...', 0, true);
    this.spawnPopup('STAGE FAILED...', '#FF2E4C', '体力耗尽！', 540, 200);
    this.clearFailTimer();
    this.failTimer = setTimeout(() => {
      this.failTimer = null;
      if (this.state === 'FAILING') this.finishSongToResult({ failed: true });
    }, 1700);
  }

  stopLiveToIdle() {
    if (this.practice) this.teardownPractice();
    this.hideManiaHint();
    this.clearFailTimer();
    this.loadToken += 1; // 取消进行中的加载
    this.setLoadingBadge(false);
    this.cancelResumeCountdown();
    const pauseOverlay = document.getElementById('stagePauseOverlay');
    if (pauseOverlay) pauseOverlay.hidden = true;
    this.synth.stopSong();
    this.synth.resume();
    this.releaseAllLanes();
    const wasPreview =
      (this.liveSession && this.liveSession.isPreview) || (this.state === 'LOADING' && this.pendingPreview);
    if (wasPreview) this.setAutoPlay(false);
    this.pendingPreview = false;
    this.liveSession = null;
    this.songEnding = false;
    this.state = 'IDLE';
    this.setLiveControlsLocked(false);
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
    const badgeText = customReason || `${this.combo} COMBO!! SKILL CUT-IN`;
    const randomLine = partner.cutinLines[Math.floor(Math.random() * partner.cutinLines.length)];
    badgeEl.textContent = badgeText;
    titleEl.textContent = partner.cutinTitle;
    lineEl.textContent = randomLine;

    this.cutinActive = true;
    this.cutinBannerData = {
      cgSrc: partner.cutinCg,
      badgeText,
      title: partner.cutinTitle,
      line: randomLine,
      accent: partner.accent
    };

    overlay.classList.add('active');
    this.synth.playHitSfx('CUTIN');
    this.triggerScreenShake(false);

    if (this.cutinHideTimer) clearTimeout(this.cutinHideTimer);
    this.cutinHideTimer = setTimeout(() => {
      overlay.classList.remove('active');
      this.cutinActive = false;
    }, 1750);
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
    // 暂停/加载中只记录按键状态，不触发判定与动作
    if (this.state === 'PAUSED' || this.state === 'LOADING' || this.state === 'FAILING') return;

    const nowTime = this.state === 'PLAYING' ? this.getJudgeTime() : performance.now() / 1000;
    this.lastLanePressTime[laneIdx] = nowTime;
    this.receptorBounce[laneIdx] = 1.0;

    // 跑酷模式下：lane 0/1 为跃起至上轨 (AIR)，lane 2/3 为落回下轨重击 (GROUND)
    const targetLane2 = laneIdx < 2 ? 0 : 1;
    this.triggerRunnerParkourAction(targetLane2, false);

    if (this.state !== 'PLAYING') {
      this.synth.playHitSfx('PERFECT');
      return;
    }

    this.evaluateNoteHit(laneIdx, targetLane2, nowTime);
  }

  // 触发 Q 版跑酷角色的 A/B/C 三段交替连招（上挑斩 / 重锤破地砸 / 旋风回旋连击）、武器残影与物理
  triggerRunnerParkourAction(targetLane2, isDouble = false) {
    const partner = this.getActivePartner();
    const upperY = 195;
    const lowerY = 375;
    const hitX = 330;

    this.runnerLane = targetLane2;
    this.runnerAttackPoseTimer = 0.26;
    this.slashParity = 1 - this.slashParity;
    this.comboAttackStage = (this.comboAttackStage + 1) % 3;

    const stageColors = ['#FF1493', '#FFE600', '#00F5D4'];
    const stageColor = stageColors[this.comboAttackStage] || partner.weaponColor || '#00F5D4';

    if (isDouble) {
      this.runnerAnimState = 'DOUBLE_BURST';
      this.runnerJumpTimer = 0.36;
      this.runnerLungeX = 48;
      this.runnerScaleX = 1.05;
      this.runnerScaleY = 1.05;
      this.runnerTilt = 0.12;
      this.spawnSlashEffect(hitX, upperY, '#FFE600', -1, true, 2);
      this.spawnSlashEffect(hitX, lowerY, '#00F5D4', 1, true, 2);
    } else if (targetLane2 === 0) {
      // 空中跃起 A/B/C 三段连招斩击（保持 1:1 等比缩放，禁止非等比拉伸变形）
      this.runnerAnimState = 'AIR_SLASH';
      this.runnerJumpTimer = 0.44;
      this.runnerVy = -1480;
      this.runnerLungeX = 34 + this.comboAttackStage * 6;
      this.runnerScaleX = 1.04;
      this.runnerScaleY = 1.04;
      this.runnerTilt = this.comboAttackStage === 0 ? -0.10 : this.comboAttackStage === 1 ? 0.10 : -0.06;
      this.spawnSlashEffect(hitX, upperY, stageColor, this.slashParity ? -1 : 1, false, this.comboAttackStage);
    } else {
      // 地面俯冲 A/B/C 三段连招重击（保持 1:1 等比缩放，禁止非等比拉伸变形）
      this.runnerAnimState = 'GROUND_SMASH';
      this.runnerJumpTimer = 0;
      if (this.runnerY < lowerY - 25) {
        this.runnerVy = 2650;
      }
      this.runnerLungeX = 36 + this.comboAttackStage * 6;
      this.runnerScaleX = 1.05;
      this.runnerScaleY = 1.05;
      this.runnerTilt = this.comboAttackStage === 0 ? -0.08 : 0.10;
      this.spawnSlashEffect(hitX, lowerY, stageColor, this.slashParity ? 1 : -1, false, this.comboAttackStage);
    }

    // 生成高速糖果霓虹残影
    this.spawnRunnerAfterimage();
  }

  spawnSlashEffect(x, y, color, dir = 1, isHeavy = false, comboStage = 0) {
    this.slashEffects.push({
      x,
      y,
      color,
      dir,
      isHeavy,
      comboStage,
      radius: isHeavy ? 92 : comboStage === 2 ? 82 : 70,
      life: 1.0,
      angleOffset: (Math.random() - 0.5) * 0.28
    });
  }

  spawnRunnerAfterimage() {
    const colors = ['#00F5D4', '#FF1493', '#FFE600'];
    this.runnerAfterimages.push({
      x: this.runnerBaseX + this.runnerLungeX * 0.5,
      y: this.runnerY,
      scaleX: this.runnerScaleX,
      scaleY: this.runnerScaleY,
      tilt: this.runnerTilt,
      state: this.runnerAnimState,
      stepPhase: this.runnerStepPhase,
      color: colors[this.runnerAfterimages.length % colors.length],
      life: 1.0
    });
  }

  spawnKnockedMonster(note, judge) {
    if (!note || this.gameMode !== 'RUN_2L') return;
    const hitX = 330;
    const upperY = 195;
    const lowerY = 375;
    const spawnLanes = note.type === 'DOUBLE' ? [0, 1] : [note.lane2];
    const words = ['POW!!', 'BAM!!', 'SMASH!!', 'CRIT!!', 'YEET!!', 'KO!!', 'WHAM!!'];

    spawnLanes.forEach((lane2, idx) => {
      const y = lane2 === 0 ? upperY : lowerY;
      const launchAngle = lane2 === 0
        ? -0.45 - Math.random() * 0.35
        : -0.28 - Math.random() * 0.42;
      const speed = (judge === 'PERFECT' ? 1220 : 940) + Math.random() * 340;
      this.knockedMonsters.push({
        x: hitX + 12,
        y,
        vx: Math.cos(launchAngle) * speed,
        vy: Math.sin(launchAngle) * speed - (idx * 120),
        rot: 0,
        vRot: (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 14),
        lane2,
        entryStyle: note.entryStyle || 'SWOOP',
        isDouble: note.type === 'DOUBLE',
        color: note.type === 'DOUBLE' ? '#FFE600' : lane2 === 0 ? '#FF1493' : '#00F5D4',
        comicWord: words[Math.floor(Math.random() * words.length)],
        flashTimer: 0.065,
        scale: 1.22,
        life: 1.0
      });
    });
  }

  // 处理副歌 Boss 贴脸连打对决 (MASH Note 连按暴揍 Boss)
  registerBossMashStrike(mashNote) {
    mashNote.mashHits = (mashNote.mashHits || 0) + 1;
    this.bossHurtTimer = 0.18;
    if (mashNote.mashHits <= (mashNote.targetHits || 10) * 2) this.damageBoss(0.5);
    this.hitstopTimer = 0.016;
    this.cameraZoom = 1.042;
    this.cameraPunchX = (Math.random() - 0.3) * 14;
    this.cameraPunchY = (Math.random() - 0.5) * 10;

    this.score += this.isFever ? 1200 : 800;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const hitX = 395 + (Math.random() - 0.5) * 35;
    const hitY = 285 + (Math.random() - 0.5) * 55;
    const mashWords = ['ORA!!', 'MASH!!', 'POW!!', 'SMASH!!', 'combo!!'];
    const word = mashWords[mashNote.mashHits % mashWords.length];
    this.spawnParticles(hitX, hitY, mashNote.mashHits % 2 === 0 ? '#FFE600' : '#FF1493', 12);
    this.spawnPopup(`${word} ×${mashNote.mashHits}`, '#FFE600', '⚡ BOSS 贴脸狂按连打！', hitX, hitY - 40);
    this.synth.playHitSfx('MASH');
    this.bounceComboBox();
    this.updateHud();
  }

  evaluateNoteHit(lane4Idx, lane2Idx, songTime) {
    // 0. 优先检测是否正处于「副歌 Boss 贴脸连打对决 (MASH Note)」阶段
    for (const note of this.notes) {
      if (note.type === 'MASH' && !note.holdCompleted && songTime >= note.time - 0.12 && songTime <= note.endTime + 0.08) {
        note.hit = true;
        note.holding = true;
        this.activeMashNote = note;
        this.registerBossMashStrike(note);
        return;
      }
    }

    const PERFECT_WIN = 0.045;
    const GREAT_WIN = 0.090;
    const GOOD_WIN = 0.135;

    // 查找当前判定窗口内最接近的未命中音符
    let candidate = null;
    let bestAbsDiff = Infinity;

    for (const note of this.notes) {
      if (note.hit || note.missed || note.type === 'HAZARD' || note.type === 'MASH') continue;
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

    // 双押重拍：必须两个对应键（2 轨：上轨+下轨；4K：lane4 + lane4Pair）在 80ms 内先后按下
    if (candidate.type === 'DOUBLE') {
      const isPartA = this.gameMode === 'RUN_2L' ? lane2Idx === 0 : lane4Idx === candidate.lane4;
      if (isPartA) candidate.dblPressA = songTime;
      else candidate.dblPressB = songTime;
      const a = candidate.dblPressA;
      const b = candidate.dblPressB;
      if (a == null || b == null || Math.abs(a - b) > DOUBLE_PRESS_WINDOW_SEC) {
        return; // 只按下一半：等待另一键
      }
      songTime = (a + b) / 2;
    }

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
      const rule = this.chartStats.hpRule || HP_RULES[0];
      const dmg = note && note.type === 'HAZARD' ? rule.hazard : rule.miss;
      // 新手练习：体力冻结（只显示 MISS 反馈，不扣血、不会失败）
      if (!(this.liveSession && this.liveSession.isPractice)) this.hp = Math.max(0, this.hp - dmg);
      this.synth.playHitSfx('MISS');
      this.spawnPopup('MISS...', '#FF2E4C', '');
      this.updateBottomJudge('MISS...', 0, true);
      this.updateHud();
      if (this.hp <= 0 && !this.autoPlay) {
        if (this.liveSession && this.liveSession.noFail) {
          if (!this.liveSession.hpDepleted) {
            this.liveSession.hpDepleted = true;
            this.spawnPopup('🛡️ NO FAIL!!', '#00F5D4', '不死模式：体力归零但继续演奏（不计排名）', 540, 200);
          }
        } else {
          this.failSong();
        }
      }
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

    // 命中回血（GOOD 回得少）
    const hpRule = this.chartStats.hpRule || HP_RULES[0];
    this.hp = Math.min(100, this.hp + (judge === 'GOOD' ? hpRule.healGood : hpRule.heal));

    // 长瀞同学技能：每 30 连击恢复生命并补充护盾
    if (partner.id === 'nagatoro' && this.combo > 0 && this.combo % 30 === 0) {
      this.hp = Math.min(100, this.hp + 18);
      this.shieldCount = Math.min(2, this.shieldCount + 1);
      this.spawnPopup('DEVIL SHIELD +HP!!', '#FFE600', '长瀞护盾充能！');
    }

    const inPractice = !!(this.liveSession && this.liveSession.isPractice);

    // FEVER 能量积累（喜多川海梦充能加速 +25%，持续时间 +50%）；练习中不触发 FEVER / Cut-in，避免遮挡教学
    if (!this.isFever && !inPractice) {
      const feverGain =
        this.chartStats.feverPerHit * (judge === 'PERFECT' ? 1.0 : 0.62) * (partner.id === 'marin' ? 1.25 : 1.0);
      this.feverGauge = Math.min(100, this.feverGauge + feverGain);
      if (this.feverGauge >= 100) {
        this.activateFever();
      }
    }

    // 达成 25 / 50 / 100 / 150 连击触发全屏斜切漫画 SKILL CUT-IN
    if (!inPractice && (this.combo === 25 || this.combo === 50 || this.combo === 150 || (this.combo > 0 && this.combo % 100 === 0))) {
      this.triggerMangaCutIn(`${this.combo} COMBO BURST!!`);
    }

    // 粒子、刀光挥击、怪物击飞物理与漫画爆炸字反馈
    const hitPos = this.getNoteReceptorCoords(note);
    const color =
      judge === 'PERFECT' ? '#FFE600' : judge === 'GREAT' ? '#00F5D4' : '#FF1493';
    this.spawnParticles(hitPos.x, hitPos.y, color, note?.type === 'DOUBLE' ? 28 : 18);

    // 击中音符时：把 Q 版节拍怪旋转击飞出去 + 24ms 打击微顿帧 (Hitstop) + 镜头前冲缩放
    this.damageBoss(note?.type === 'DOUBLE' ? 2 : 1);
    if (note && note.type !== 'HOLD' && note.type !== 'MASH') {
      this.spawnKnockedMonster(note, judge);
    }
    if (note && note.type === 'DOUBLE') {
      this.triggerRunnerParkourAction(0, true);
      this.hitstopTimer = 0.028;
      this.cameraZoom = 1.055;
      this.cameraPunchX = 12;
    } else {
      if (judge === 'PERFECT') {
        this.hitstopTimer = 0.022;
      }
      this.cameraZoom = Math.max(this.cameraZoom, judge === 'PERFECT' ? 1.034 : 1.018);
      this.cameraPunchX = 7;
    }

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
     4 层高速视差跑酷卷轴 & Q 版角色物理状态更新 (60FPS 恒定驱动)
     ------------------------------------------------------------------------ */
  updateParkourPhysics(dt) {
    // 24ms 街机打击微顿帧 (Hitstop)：定格角色与受击帧瞬间，释放拳拳到肉的打击张力
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.cameraZoom += (1.0 - this.cameraZoom) * Math.min(1, dt * 8);
      return;
    }

    if (this.bossHurtTimer > 0) {
      this.bossHurtTimer = Math.max(0, this.bossHurtTimer - dt);
    }
    if (this.bossKnockbackTimer > 0) {
      this.bossKnockbackTimer = Math.max(0, this.bossKnockbackTimer - dt);
    }
    if (this.bossSplashTimer > 0) {
      this.bossSplashTimer = Math.max(0, this.bossSplashTimer - dt);
    }

    const track = this.getActiveTrack();
    const bpm = track ? track.bpm : 132;
    const speedFactor =
      (this.state === 'PLAYING' ? 1.0 : 0.48) *
      this.noteSpeedMult *
      (this.isFever ? 1.35 : 1.0) *
      (bpm / 130);

    // 1. 4 层视差横版卷轴推进（远景星空都市 / 中景街机霓虹街区 / 高速跑酷公路 / 前景灯柱掠影）
    const layerSpeeds = [110, 390, 1180, 1960];
    for (let i = 0; i < 4; i++) {
      this.parallaxOffsets[i] = (this.parallaxOffsets[i] + layerSpeeds[i] * speedFactor * dt) % 4800;
    }

    // 2. 镜头打击缩放与前冲回弹
    this.cameraZoom += (1.0 - this.cameraZoom) * Math.min(1, dt * 14);
    this.cameraPunchX += (0 - this.cameraPunchX) * Math.min(1, dt * 16);
    this.cameraPunchY += (0 - this.cameraPunchY) * Math.min(1, dt * 16);

    // 3. Q 版角色迈腿跑步相位（与 BPM 严格同频：每拍迈 2 步 = 4 个关键帧姿态）
    const stepsPerSec = (bpm / 60) * 2.0 * (this.state === 'PLAYING' ? 1.0 : 0.65);
    this.runnerStepPhase += stepsPerSec * Math.PI * 2 * dt;
    const stepIndex = Math.floor(this.runnerStepPhase / Math.PI);

    const upperY = 195;
    const lowerY = 375;
    const targetY = this.runnerLane === 0 ? upperY : lowerY;

    // 4. Q 版角色垂直跳跃/滞空/急速俯冲弹簧物理
    const yDiff = targetY - this.runnerY;
    this.runnerVy += yDiff * 115 * dt;
    this.runnerVy *= Math.pow(0.0008, dt);
    this.runnerY += this.runnerVy * dt;

    // 落地瞬间产生踏地星尘（保持 1:1 等比，不压扁角色）
    if (this.runnerLane === 1 && Math.abs(this.runnerY - lowerY) < 8) {
      if (this.runnerVy > 380) {
        this.runnerScaleX = 1.03;
        this.runnerScaleY = 1.03;
        this.spawnFootstepDust(this.runnerBaseX - 10, lowerY + 42, 6, true);
      }
      this.runnerY = lowerY;
      this.runnerVy = 0;
    }

    // 地面奔跑每迈一步在脚底向后喷射糖果踏地烟尘
    if (stepIndex !== this.lastStepIndex) {
      this.lastStepIndex = stepIndex;
      if (this.runnerLane === 1 && Math.abs(this.runnerY - lowerY) < 18) {
        this.spawnFootstepDust(this.runnerBaseX - 14, lowerY + 42, 3, false);
      } else if (this.isFever) {
        this.spawnRunnerAfterimage();
      }
    }

    // 5. 角色前冲位移 (Lunge) 与挤压拉伸 (Squash & Stretch) 弹性回中
    this.runnerLungeX += (0 - this.runnerLungeX) * Math.min(1, dt * 15);
    this.runnerScaleX += (1.0 - this.runnerScaleX) * Math.min(1, dt * 14);
    this.runnerScaleY += (1.0 - this.runnerScaleY) * Math.min(1, dt * 14);
    this.runnerTilt += (0.06 - this.runnerTilt) * Math.min(1, dt * 12);

    if (this.runnerAttackPoseTimer <= 0 && this.runnerLane === 1 && Math.abs(this.runnerY - lowerY) < 16) {
      this.runnerAnimState = 'RUN';
    }

    // 6. 更新脚底向后飞驰的踏地星尘
    for (let i = this.footstepDust.length - 1; i >= 0; i--) {
      const d = this.footstepDust[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.size += 18 * dt;
      d.life -= dt * 2.6;
      if (d.life <= 0) this.footstepDust.splice(i, 1);
    }

    // 7. 更新 Q 版角色高速残影
    for (let i = this.runnerAfterimages.length - 1; i >= 0; i--) {
      const g = this.runnerAfterimages[i];
      g.x -= 520 * speedFactor * dt;
      g.life -= dt * 3.8;
      if (g.life <= 0) this.runnerAfterimages.splice(i, 1);
    }

    // 8. 更新巨型波普月牙刀光
    for (let i = this.slashEffects.length - 1; i >= 0; i--) {
      const s = this.slashEffects[i];
      s.life -= dt * 5.2;
      if (s.life <= 0) this.slashEffects.splice(i, 1);
    }

    // 9. 更新被一锤打飞旋转飞出屏幕的 Q 版节拍怪 (Ragdoll Knockback)
    for (let i = this.knockedMonsters.length - 1; i >= 0; i--) {
      const m = this.knockedMonsters[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vy += 1480 * dt; // 重力抛物线
      m.rot += m.vRot * dt;
      m.flashTimer = Math.max(0, m.flashTimer - dt);
      m.life -= dt * 1.35;
      if (m.life <= 0 || m.x > 1240 || m.y > 660) {
        this.knockedMonsters.splice(i, 1);
      }
    }
  }

  spawnFootstepDust(x, y, count = 3, isHeavy = false) {
    const colors = ['#FFFFFF', '#FFE600', '#00F5D4', '#FF1493'];
    for (let i = 0; i < count; i++) {
      this.footstepDust.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 6,
        vx: -(420 + Math.random() * 440) * (isHeavy ? 1.25 : 1.0),
        vy: -(25 + Math.random() * (isHeavy ? 130 : 70)),
        size: (isHeavy ? 9 : 6) + Math.random() * 6,
        color: colors[i % colors.length],
        life: 1.0
      });
    }
  }

  /* ------------------------------------------------------------------------
     主更新与结算循环
     ------------------------------------------------------------------------ */
  updateGameLogic(dt) {
    if (this.state !== 'PLAYING') return;

    const track = this.liveSession ? this.liveSession.track : this.getActiveTrack();
    const songTime = this.synth.getElapsedSec();
    const judgeTime = songTime - this.calibrationMs / 1000;

    // 进度条更新（练习：按段数显示）
    const pct = this.practice
      ? (this.practice.idx / PRACTICE_SECTIONS.length) * 100
      : Math.min(100, (songTime / track.durationSec) * 100);
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

    // 遍历音符处理：AI 自动演示 / 副歌 Boss 贴脸连打 (MASH) / 长按持续加分 / 尖刺齿轮闪避结算 / 超时 MISS
    this.activeMashNote = null;
    for (const note of this.notes) {
      if (this.state !== 'PLAYING') break; // 本帧内体力归零 → 进入失败演出
      if (note.missed || note.holdCompleted) continue;

      // 0. 副歌高潮 Boss 贴脸连打对决 (MASH Note · 提前 2.4 秒召唤 16:9 魔王机甲巨图预警！)
      if (note.type === 'MASH') {
        if (!note.warningTriggered && songTime >= note.time - 2.4 && songTime < note.time) {
          note.warningTriggered = true;
          this.bossSplashTimer = 4.6;
          this.synth.playHitSfx('CUTIN');
        }
        if (songTime >= note.time - 0.18 && songTime <= note.endTime) {
          this.activeMashNote = note;
          this.bossSplashTimer = Math.max(this.bossSplashTimer, 0.5);
          note.hit = true;
          note.holding = true;
          // AUTO PLAY 模式下自动以每秒 14 次鬼畜出拳暴揍 Boss
          if (this.autoPlay && songTime >= note.time && songTime - note.lastTickTime >= 0.075) {
            note.lastTickTime = songTime;
            this.triggerRunnerParkourAction(note.mashHits % 2, false);
            this.registerBossMashStrike(note);
          }
          continue;
        } else if (songTime > note.endTime && !note.holdCompleted) {
          note.holding = false;
          note.holdCompleted = true;
          this.bossKnockbackTimer = 0.85;
          this.score += 5000;
          this.synth.playHitSfx('BOSS_KO');
          this.triggerScreenShake(true);
          this.spawnParticles(420, 275, '#FFE600', 36);
          this.spawnPopup('BOSS BLASTED!! +5000', '#FFE600', `🔥 连打 ${note.mashHits || 1} HIT 把魔王轰飞啦！`, 520, 175);
          this.updateHud();
          continue;
        }
      }

      // 1. AUTO PLAY 自动演示模式
      if (this.autoPlay && !note.hit && songTime >= note.time - 0.008) {
        if (note.type === 'HAZARD') {
          // 自动跳到安全轨道躲避齿轮
          const safeLane = 1 - note.lane2;
          this.runnerLane = safeLane;
          this.runnerJumpTimer = safeLane === 0 ? 0.38 : 0;
          this.spawnRunnerAfterimage();
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
          this.triggerRunnerParkourAction(note.lane2, note.type === 'DOUBLE');
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

        if (isStillHolding && this.gameMode === 'RUN_2L') {
          this.runnerLane = note.lane2;
          if (note.lane2 === 0) this.runnerJumpTimer = Math.max(this.runnerJumpTimer, 0.15);
        }

        if (songTime - note.lastTickTime >= 0.12 && isStillHolding) {
          note.lastTickTime = songTime;
          this.score += 220;
          this.combo += 1;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;
          const pos = this.getNoteReceptorCoords(note);
          this.spawnParticles(pos.x, pos.y, '#00F5D4', 6);
          this.updateHud();
        }

        // 提前松手：长按中断，不发放 +500 完成奖励（末尾 80ms 宽限）
        if (!isStillHolding && songTime < note.endTime - 0.08) {
          note.holding = false;
          note.holdCompleted = true;
          note.holdBroken = true;
          const pos = this.getNoteReceptorCoords(note);
          this.spawnPopup('HOLD BREAK', '#FF2E4C', '长按提前松开…', pos.x, pos.y - 26);
          continue;
        }

        if (songTime >= note.endTime - 0.08) {
          note.holding = false;
          note.holdCompleted = true;
          this.score += 500;
          this.spawnKnockedMonster(note, 'PERFECT');
          this.updateHud();
        }
        continue;
      }

      // 3. 尖刺齿轮弹幕 (HAZARD) 到达判定线
      if (note.type === 'HAZARD' && !note.hit && judgeTime >= note.time) {
        note.hit = true;
        if (this.gameMode === 'MANIA_4K') {
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
          this.runnerAnimState = 'HURT';
          this.runnerScaleX = 0.78;
          this.runnerScaleY = 1.25;
          this.triggerScreenShake(true);
          this.registerJudgment('MISS', 0, note, false);
        }
        continue;
      }

      // 4. 普通音符超时未按 -> MISS
      if (!note.hit && judgeTime - note.time > 0.145) {
        note.missed = true;
        this.registerJudgment('MISS', 145, note, false);
      }
    }

    if (this.state !== 'PLAYING') return;

    if (this.practice) {
      this.updatePractice(songTime);
      return;
    }

    // 音乐真实结束（durationSec = 离线测得的曲尾）→ 收尾淡出 → 弹出街机结算画面
    if (songTime >= track.durationSec && !this.songEnding) {
      this.songEnding = true;
      this.synth.fadeOutMusic(1.0);
      if (this.bossHp <= 8) {
        this.bossKnockbackTimer = 0.85;
        this.bossHp = 0;
        this.synth.playHitSfx('BOSS_KO');
        this.triggerScreenShake(true);
        this.spawnPopup('DEMON QUEEN K.O.!!', '#FFE600', '👑 魔王女王被彻底击破！', 540, 175);
      }
    }
    if (songTime >= track.durationSec + 1.4) {
      this.finishSongToResult();
    }
  }

  finishSongToResult({ failed = false } = {}) {
    this.clearFailTimer();
    this.synth.stopSong();
    this.state = 'RESULT';
    this.isFever = false;
    this.songEnding = false;
    document.body.classList.remove('fever-mode-active');
    this.setLiveControlsLocked(false);

    // 以开局快照为准（防止中途切换难度/模式/搭档导致串档）
    const session = this.liveSession || {
      track: this.getActiveTrack(),
      trackId: this.selectedTrackId,
      diffIdx: this.selectedDiffIdx,
      mode: this.gameMode,
      partnerId: this.selectedPartnerId,
      isPreview: false,
      autoUsed: this.autoPlay,
      noFail: false,
      hpDepleted: false
    };
    const autoUsed = session.autoUsed || this.autoPlay;
    const noFailRun = !!session.noFail && !autoUsed;
    const track = session.track;
    const partner = PARTNERS[session.partnerId] || this.getActivePartner();
    const diff = track.diffs[session.diffIdx] || track.diffs[0];
    const acc = this.getAccuracyPercent();
    const progressPct = failed ? this.failProgressPct || 0 : 100;

    // 计算街机评级徽章：通关 S+ / S / A / B / C；失败（或不死模式下体力曾归零）一律 F
    let rank = 'C';
    let badgeText = '🍬 CLEAR STAGE';
    const isAllPerfect =
      this.counts.MISS === 0 &&
      this.counts.GOOD === 0 &&
      this.counts.GREAT === 0 &&
      this.counts.PERFECT > 0;
    const isFullCombo = this.counts.MISS === 0 && this.counts.PERFECT + this.counts.GREAT > 0;

    if (failed) {
      rank = 'F';
      badgeText = `💔 STAGE FAILED · 进度 ${progressPct.toFixed(1)}%`;
    } else if (noFailRun && session.hpDepleted) {
      rank = 'F';
      badgeText = '🛡️ 体力曾归零';
    } else if (isAllPerfect) {
      rank = 'S+';
      badgeText = '👑 ALL PERFECT!!';
    } else if (isFullCombo || acc >= 94.5) {
      rank = 'S';
      badgeText = isFullCombo ? '🌟 FULL COMBO!!' : '🌟 SUPER STAR!!';
    } else if (acc >= 84.0) {
      rank = 'A';
      badgeText = '🔥 GREAT RHYTHM!';
    } else if (acc >= 70.0) {
      rank = 'B';
      badgeText = '🍬 CLEAR STAGE';
    } else {
      badgeText = '🍭 勉强过关 CLEAR';
    }

    if (autoUsed) {
      badgeText = '🤖 AUTO PLAY · 不计入纪录';
    } else if (noFailRun) {
      badgeText = `${badgeText} · 不死模式不计排名`;
    }

    // 只有「正常模式下通关」才写入高分榜；失败局仅记录最佳进度；AUTO / 不死模式均不计入
    const recordKey = this.getRecordKey(session.trackId, session.diffIdx, session.mode);
    const ranked = !autoUsed && !noFailRun && !failed;
    const isNewRecord = ranked
      ? this.saveRecord(session.trackId, session.diffIdx, session.mode, {
          trackId: track.id,
          trackTitle: track.title,
          diffName: diff.name,
          mode: session.mode,
          partnerName: partner.name,
          score: this.score,
          maxCombo: this.maxCombo,
          acc: Number(acc.toFixed(2)),
          rank,
          badgeText
        })
      : false;
    let bestProgress = null;
    if (failed && !autoUsed && !noFailRun) {
      this.saveBestProgress(recordKey, progressPct);
      bestProgress = this.loadBestProgress()[recordKey] || progressPct;
    }

    const stampEl = document.getElementById('resultRankStamp');
    stampEl.classList.toggle('is-failed', rank === 'F' && !autoUsed);
    const progressLine = document.getElementById('resultProgressLine');
    if (progressLine) {
      progressLine.hidden = !failed;
      if (failed) {
        progressLine.textContent = `演奏进度 ${progressPct.toFixed(1)}%${
          bestProgress != null ? ` · 最佳进度 ${Number(bestProgress).toFixed(1)}%` : ''
        } · 体力耗尽，本局不计入高分榜`;
      }
    }
    document.getElementById('stageResultOverlay').classList.toggle('is-failed', failed);

    // 填充结算 DOM
    document.getElementById('resultHeroineCg').src = partner.cutinCg;
    document.getElementById('resultRankStamp').textContent = autoUsed ? 'AUTO' : rank;
    document.getElementById('resultRankStamp').classList.toggle('is-auto', autoUsed);
    const clearTag = document.getElementById('resultClearTag');
    if (clearTag) {
      clearTag.textContent = autoUsed
        ? 'AUTO PLAY DEMO'
        : failed
        ? 'STAGE FAILED...'
        : noFailRun
        ? '🛡️ NO FAIL CLEAR'
        : 'STAGE CLEAR!!';
      clearTag.classList.toggle('is-failed', failed);
    }
    document.getElementById('resultBadgeRibbon').textContent = badgeText;
    document.getElementById('resultSongTitle').textContent = `${track.icon} 《${track.title}》`;
    document.getElementById('resultModeAndDiff').textContent =
      `${session.mode === 'RUN_2L' ? '横版双轨跑酷' : '4K 下落街机'} · ${diff.name} · 搭档：${partner.name}`;

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
    document.getElementById('resPartnerComment').textContent = failed
      ? `${partner.name}：“差一点点！调整一下节奏再来一局，下次一定能打完全曲～”`
      : partner.clearLine;

    document.getElementById('stageResultOverlay').hidden = false;
    this.synth.playHitSfx('CUTIN');
    // 试听（预览）局结束后自动关闭 AUTO，避免下一局误开
    if (session.isPreview) this.setAutoPlay(false);
    this.liveSession = null;
    this.renderTrackList();
    this.updateStartOverlayInfo();
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
      const highwayLeft = MANIA_HIGHWAY.left;
      const laneWidth = MANIA_HIGHWAY.laneWidth;
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
    // 暂停时冻结所有逻辑/物理/粒子推进（dt = 0），画面停留在暂停瞬间
    const dt = this.state === 'PAUSED' ? 0 : Math.min(0.05, (timestamp - this.lastFrameTs) / 1000);
    this.lastFrameTs = timestamp;

    this.beatPulseValue = Math.max(0, this.beatPulseValue - dt * 3.8);
    for (let i = 0; i < 4; i++) {
      this.receptorBounce[i] = Math.max(0, this.receptorBounce[i] - dt * 6.0);
    }

    this.updateParkourPhysics(dt);
    this.updateGameLogic(dt);
    this.renderCanvas(dt);

    requestAnimationFrame((ts) => this.loop(ts));
  }

  renderCanvas(dt) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 2. 根据当前音游模式绘制核心舞台
    if (this.gameMode === 'RUN_2L') {
      this.drawRun2LStage(ctx, W, H, dt);
    } else {
      this.drawSpectrumBars(ctx, W, H);
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
     模式一：横版双轨跑酷闪避模式 (Muse Dash 风 4 层高速视差卷轴 + Q 版跑酷动作 + 刀光击飞)
     ------------------------------------------------------------------------ */
  drawRun2LStage(ctx, W, H, dt) {
    const songTime = this.isLiveState() ? this.synth.getElapsedSec() : performance.now() / 1000;
    const hitX = 330;
    const upperY = 195;
    const lowerY = 375;

    ctx.save();
    // 镜头节奏呼吸缩放与前冲震动 (Camera Beat Zoom & Punch)
    const cx = W * 0.42;
    const cy = H * 0.54;
    ctx.translate(cx + this.cameraPunchX, cy + this.cameraPunchY);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-cx, -cy);

    // 1. 绘制第 1～3 层高速横版视差卷轴世界 (远景低音摩天楼 / 中景霓虹街区 / 近景飞驰跑酷公路与空中滑轨)
    this.drawParallaxParkourWorld(ctx, W, H, upperY, lowerY, hitX, songTime);

    // 2. 绘制两个打击靶圈 (Receptor Targets) 与角色跟前引导光束
    this.drawParkourReceptors(ctx, hitX, upperY, lowerY, songTime);

    // 3. 绘制脚底踏地星尘与 Q 版角色高速霓虹残影
    this.drawFootstepDustAndAfterimages(ctx);

    // 4. 绘制 Q 版 2.5 头身侧身跑酷看板娘 + 动态挥舞武器
    this.drawChibiRunnerHeroine(ctx, upperY, lowerY, songTime);

    // 5. 绘制右侧驻场「巨型 Q 版糖果魔王 Boss」及副歌贴脸连打对决 (MASH Clash)
    this.drawStageBoss(ctx, W, H, hitX, upperY, lowerY, songTime);

    // 6. 绘制飞来的 Q 版空中俯冲飞翼恶魔、地面大跳音响怪、半途隐身幽灵怪、双押雷电双子怪、彩虹流光龙带与旋转电锯齿轮
    if (this.isLiveState()) {
      const basePxPerSec = 560 * this.noteSpeedMult;

      for (const note of this.notes) {
        if (note.missed || note.holdCompleted || note.type === 'MASH') continue;
        if (note.hit && note.type !== 'HOLD') continue;

        const timeRemain = note.time - songTime;
        const x = hitX + timeRemain * basePxPerSec;
        const endX = hitX + (note.endTime - songTime) * basePxPerSec;
        if (endX < 180 || x > W + 90) continue;

        const baseY = note.lane2 === 0 ? upperY : lowerY;

        if (note.type === 'HOLD') {
          this.drawRainbowHoldStream(ctx, note, x, endX, hitX, baseY, songTime);
        } else if (note.type === 'DOUBLE') {
          // 双押重拍：上下两轨高压雷电连接 + 双子机甲音符怪
          this.drawDoubleLightningBridge(ctx, x, upperY, lowerY, songTime);
          this.drawBeatMonsterNote(ctx, x, upperY, 0, true, songTime, note.id, 'SWOOP', 0);
          this.drawBeatMonsterNote(ctx, x, lowerY, 1, true, songTime, note.id + 99, 'BOUNCE', 0);
        } else if (note.type === 'HAZARD') {
          this.drawSpikedGear(ctx, x, baseY, songTime);
        } else {
          // 计算喵斯快跑风动态进场曲线轨迹（俯冲弧线 SWOOP / 正弦波浪 WAVE / 跑道大跳 BOUNCE / 幽灵隐身 GHOST）
          const traj = this.computeMonsterEntryTrajectory(note, timeRemain, baseY, songTime);
          this.drawBeatMonsterNote(
            ctx,
            x,
            traj.y,
            note.lane2,
            false,
            songTime,
            note.id,
            note.entryStyle || 'SWOOP',
            traj.alpha
          );
        }
      }
    }

    // 7. 绘制 A/B/C 三段连招巨型波普刀光挥击特效 & 被击飞旋转飞出屏幕的 Q 版小怪
    this.drawSlashEffectsAndKnockedMonsters(ctx);

    // 8. 绘制第 4 层极速前景掠影（赛博龙门架灯柱与波普漫画速度线）
    this.drawForegroundSpeedOverlay(ctx, W, H);

    ctx.restore();
  }

  // 计算喵斯快跑风怪物进场抛物线/大跳曲线/幽灵隐身透明度（在 timeRemain=0 到达判定靶心时精准收敛至 baseY！）
  computeMonsterEntryTrajectory(note, timeRemain, baseY, songTime) {
    const t = Math.max(0, timeRemain);
    const style = note.entryStyle || (note.lane2 === 0 ? 'SWOOP' : 'BOUNCE');
    let offsetY = 0;
    let alpha = 1.0;

    if (style === 'SWOOP') {
      // 从高空画抛物线俯冲切入靶心
      offsetY = -128 * Math.pow(Math.min(1.4, t), 1.55);
    } else if (style === 'WAVE') {
      // 空中波浪形正弦穿行，靠近判定点时收敛为 0
      offsetY = Math.sin(t * 9.5 + note.id) * 42 * Math.min(1, t * 1.4);
    } else if (style === 'BOUNCE') {
      // 地面怪踩着拍点一大跳一大跳地蹦向靶心
      const track = this.getActiveTrack();
      const bps = (track ? track.bpm : 130) / 60;
      offsetY = -Math.abs(Math.sin(t * bps * Math.PI)) * 54 * Math.min(1, t * 1.6);
    } else if (style === 'GHOST') {
      // 幽灵怪：中途 (0.16s < t < 0.72s) 隐身至 16% 透明度，接近靶心瞬间重新现形突袭！
      offsetY = Math.sin(t * 7 + note.id) * 24 * Math.min(1, t);
      if (t > 0.16 && t < 0.72) {
        alpha = 0.16 + Math.abs(Math.sin(songTime * 14)) * 0.12;
      }
    }

    return { y: baseY + offsetY, alpha };
  }

  /* ------------------------------------------------------------------------
     右侧驻场「巨型 Q 版糖果魔王女王 Boss (310×310 跨双轨巨体)」与副歌「MASH!! 贴脸连打对决」演出
     ------------------------------------------------------------------------ */
  drawStageBoss(ctx, W, H, hitX, upperY, lowerY, songTime) {
    const bossNormalImg = this.imageCache.get('assets/neonbeat/monsters/boss_mecha_king.webp');
    const bossHurtImg = this.imageCache.get('assets/neonbeat/monsters/boss_mecha_hurt.webp');
    const isMashing = Boolean(this.activeMashNote);
    const isHurt = this.bossHurtTimer > 0 || this.bossKnockbackTimer > 0;
    const isBossOverdrive = this.bossSplashTimer > 0 || isMashing;

    // 计算巨型 Boss 位置：常态驻守舞台右侧 (W - 155)，体型高达 310×310 横跨上下双轨！
    let bossX = W - 155;
    let bossY = 262 + Math.sin(songTime * 5.2) * 16 - this.beatPulseValue * 12;
    let bossRot = 0;

    if (isMashing) {
      const shakeX = (Math.random() - 0.5) * (isHurt ? 22 : 8);
      const shakeY = (Math.random() - 0.5) * (isHurt ? 18 : 8);
      bossX = hitX + 135 + shakeX;
      bossY = 272 + shakeY;
    } else if (this.bossKnockbackTimer > 0) {
      // 连打结束被一锤轰飞回右侧的过程
      const p = 1.0 - this.bossKnockbackTimer / 0.85;
      bossX = (hitX + 135) + (W - 155 - (hitX + 135)) * p;
      bossY = 255 - Math.sin(p * Math.PI) * 125;
      bossRot = p * Math.PI * 4;
    }

    ctx.save();
    ctx.translate(bossX, bossY);
    ctx.rotate(bossRot);

    // 巨型 Boss 身后旋转的恶魔电音魔法阵光环
    ctx.save();
    ctx.rotate(-songTime * 1.4);
    ctx.strokeStyle = isBossOverdrive ? 'rgba(255, 230, 0, 0.55)' : 'rgba(255, 20, 147, 0.35)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(0, -10, isBossOverdrive ? 152 : 134, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Boss 脚下巨型霓虹全息悬浮王座底座
    ctx.fillStyle = isBossOverdrive ? 'rgba(255, 20, 147, 0.48)' : 'rgba(0, 245, 212, 0.30)';
    ctx.strokeStyle = isBossOverdrive ? '#FFE600' : '#FF1493';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 118, 112, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const activeBossImg = isHurt && bossHurtImg && bossHurtImg.complete && bossHurtImg.naturalWidth > 0
      ? bossHurtImg
      : bossNormalImg;

    if (activeBossImg && activeBossImg.complete && activeBossImg.naturalWidth > 0) {
      ctx.shadowColor = isBossOverdrive ? '#FFE600' : '#FF1493';
      ctx.shadowBlur = isBossOverdrive ? 28 : 16;
      const scale = isHurt ? 1.12 : (isBossOverdrive ? 1.10 : 1.0) + this.beatPulseValue * 0.06;
      ctx.scale(scale, scale);
      // 346×346 巨型魔王尺寸（横跨上下双轨，PC 端视觉压迫感拉满！）
      ctx.drawImage(activeBossImg, -173, -184, 346, 346);
    }
    ctx.restore();

    // Boss 顶部悬浮血条与副歌「MASH!! 狂按连打」巨幅提示牌
    ctx.save();
    const barW = 186;
    const barX = Math.min(W - barW - 16, Math.max(260, bossX - barW * 0.5));
    const barY = Math.max(18, bossY - 178);

    ctx.fillStyle = '#190A28';
    ctx.strokeStyle = '#FFE600';
    ctx.lineWidth = 3.5;
    ctx.fillRect(barX, barY, barW, 24);
    ctx.strokeRect(barX, barY, barW, 24);

    ctx.fillStyle = isBossOverdrive ? '#FFE600' : '#FF1493';
    ctx.fillRect(barX + 3, barY + 3, ((barW - 6) * this.bossHp) / 100, 18);

    ctx.fillStyle = isBossOverdrive ? '#190A28' : '#FFFFFF';
    ctx.font = '900 12px Impact, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`👑 DEMON QUEEN DJ · HP ${Math.round(this.bossHp)}%`, barX + barW * 0.5, barY + 16);

    // 副歌 MASH 连打阶段：在女主与 Boss 之间拉出高压对决闪电与狂按计数牌
    if (isMashing && this.activeMashNote) {
      const hits = this.activeMashNote.mashHits || 0;
      ctx.font = '900 28px Impact, "Arial Black", "PingFang SC", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#190A28';
      ctx.fillStyle = '#FFE600';
      const promptText = `⚡ MASH F/J!! 连打暴揍魔王女王 ×${hits} HIT!! ⚡`;
      ctx.strokeText(promptText, hitX + 215, 112);
      ctx.fillText(promptText, hitX + 215, 112);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     4 层高速横版视差跑酷舞台 (Muse Dash 正统粗黑描边波普手绘卷轴舞台 + 双速分离式跑道)
     ------------------------------------------------------------------------ */
  drawParallaxParkourWorld(ctx, W, H, upperY, lowerY, hitX, songTime) {
    const fft = this.synth.sampleSpectrum();
    const bassEnergy = ((fft[1] || 0) + (fft[2] || 0)) / 510;
    const pulse = this.beatPulseValue;

    const stageKey = this.isFever
      ? 'assets/neonbeat/stage/stage_bg_fever.webp'
      : 'assets/neonbeat/stage/stage_bg_city.webp';
    const stageImg = this.imageCache.get(stageKey);
    const hasStageImg = stageImg && stageImg.complete && stageImg.naturalWidth > 0;

    const off1 = this.parallaxOffsets[0];
    const off2 = this.parallaxOffsets[1];
    const off3 = this.parallaxOffsets[2];

    const roadTop = lowerY + 34;

    if (hasStageImg) {
      const imgW = stageImg.naturalWidth;
      const imgH = stageImg.naturalHeight;
      // 源图上下分割线：上方 71% 为赛博糖果乐园夜景/摩天轮/猫耳巨型音响塔，下方 29% 为高速波普跑道
      const srcSplitY = Math.round(imgH * 0.71);

      // --- LAYER 1 & 2: 喵斯快跑风手绘波普舞台远中景无缝横版卷轴 (严格保持 1:1 原始像素宽高比，摩天轮与音响正圆零变形！) ---
      ctx.save();
      ctx.globalAlpha = this.cutinActive ? 0.36 : 0.94;
      const destSkyH = roadTop + 4;
      const skyScale = destSkyH / srcSplitY;
      const bgTileW = Math.max(256, Math.round(imgW * skyScale));
      const bgShift = Math.floor(off2 * 0.75) % bgTileW;

      for (let tx = -bgShift; tx < W + bgTileW; tx += bgTileW) {
        ctx.drawImage(
          stageImg,
          0,
          0,
          imgW,
          srcSplitY,
          tx,
          0,
          bgTileW + 1,
          destSkyH
        );
      }

      // 叠加一层微暗波普滤镜保证前景音符怪 100% 高对比度醒目
      ctx.fillStyle = this.isFever
        ? 'rgba(35, 6, 62, 0.22)'
        : 'rgba(18, 6, 36, 0.26)';
      ctx.fillRect(0, 0, W, roadTop);
      ctx.restore();

      // --- 巨型魔王女王 16:9 机甲王座大图背景演出 (严格保持 16:9 原始宽高比，裁剪于跑道上方绝不压扁！) ---
      if (this.bossSplashTimer > 0 || this.activeMashNote) {
        const bossCgImg = this.imageCache.get('assets/neonbeat/monsters/boss_queen_cg.webp');
        if (bossCgImg && bossCgImg.complete && bossCgImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, roadTop);
          ctx.clip();
          const alpha = Math.min(0.86, Math.max(0.48, this.bossSplashTimer * 0.5));
          ctx.globalAlpha = alpha;
          const zoom = 1.0 + pulse * 0.025;
          const cgW = W;
          const cgH = Math.round(W * (bossCgImg.naturalHeight / bossCgImg.naturalWidth));
          ctx.translate(W * 0.5, roadTop * 0.5);
          ctx.scale(zoom, zoom);
          ctx.drawImage(bossCgImg, -cgW * 0.5, -cgH * 0.45, cgW, cgH);
          ctx.restore();

          // 顶部魔王降临红黄警戒横幅
          ctx.save();
          ctx.fillStyle = '#FF1493';
          ctx.strokeStyle = '#190A28';
          ctx.lineWidth = 3;
          ctx.fillRect(0, 6, W, 28);
          ctx.strokeRect(0, 6, W, 28);
          ctx.fillStyle = '#FFE600';
          ctx.font = '900 14px Impact, "Arial Black", "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            '⚠️ WARNING!! DEMON QUEEN DJ · COLOSSAL SUBWOOFER THRONE OVERDRIVE!! ⚠️',
            W * 0.5,
            25
          );
          ctx.restore();
        }
      }

      // --- LAYER 3B: 喵斯快跑风手绘波普跑道甲板极速无缝卷轴 (严格保持 1:1 原始宽高比平铺！) ---
      ctx.save();
      const deckH = H - roadTop;
      const srcDeckH = imgH - srcSplitY;
      const deckScale = deckH / srcDeckH;
      const deckTileW = Math.max(256, Math.round(imgW * deckScale));
      const deckShift = Math.floor(off3) % deckTileW;
      for (let tx = -deckShift; tx < W + deckTileW; tx += deckTileW) {
        ctx.drawImage(
          stageImg,
          0,
          srcSplitY,
          imgW,
          srcDeckH,
          tx,
          roadTop,
          deckTileW + 1,
          deckH
        );
      }

      // 跑道顶沿粗黑描边分割线 + 动态霓虹流光边条
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, roadTop);
      ctx.lineTo(W, roadTop);
      ctx.stroke();

      ctx.strokeStyle = this.isFever ? '#FFE600' : '#FF1493';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, roadTop + 3);
      ctx.lineTo(W, roadTop + 3);
      ctx.stroke();

      // 底部实时 FFT 频谱能量光柱与手绘跑道融合
      this.drawSpectrumBars(ctx, W, H);
      ctx.restore();
    } else {
      // 贴图未加载完成时的几何兜底
      ctx.save();
      ctx.fillStyle = '#190A28';
      ctx.fillRect(0, 0, W, H);
      this.drawSpectrumBars(ctx, W, H);
      ctx.restore();
    }

    // --- LAYER 3A: 上轨「空中全息星光滑轨 (AIR SKY GRIND RAIL)」(Speed: 1180 px/s) ---
    ctx.save();
    const airGrad = ctx.createLinearGradient(0, upperY - 18, 0, upperY + 24);
    airGrad.addColorStop(0, 'rgba(255, 20, 147, 0.02)');
    airGrad.addColorStop(0.5, 'rgba(255, 20, 147, 0.22)');
    airGrad.addColorStop(1, 'rgba(0, 245, 212, 0.06)');
    ctx.fillStyle = airGrad;
    ctx.fillRect(0, upperY - 18, W, 42);

    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, upperY + 24);
    ctx.lineTo(W, upperY + 24);
    ctx.stroke();

    ctx.strokeStyle = this.isFever ? '#FFE600' : '#FF1493';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, upperY + 24);
    ctx.lineTo(W, upperY + 24);
    ctx.stroke();

    // 空中滑轨上急速向后飞掠的霓虹加速箭头 (<<<)
    const airTileW = 130;
    const airShift = off3 % airTileW;
    ctx.fillStyle = '#FFE600';
    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 2.5;
    for (let x = -airShift; x < W + airTileW; x += airTileW) {
      ctx.beginPath();
      ctx.moveTo(x + 26, upperY + 24);
      ctx.lineTo(x + 46, upperY + 15);
      ctx.lineTo(x + 40, upperY + 24);
      ctx.lineTo(x + 46, upperY + 33);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParkourReceptors(ctx, hitX, upperY, lowerY, songTime) {
    const lanes = [
      {
        y: upperY,
        tag: 'AIR [F/↑]',
        color: '#FF1493',
        sprite: 'assets/neonbeat/vfx/vfx_receptor_air.webp'
      },
      {
        y: lowerY,
        tag: 'GND [J/↓]',
        color: '#00F5D4',
        sprite: 'assets/neonbeat/vfx/vfx_receptor_gnd.webp'
      }
    ];

    // 上下判定靶点之间的节奏瞄准虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.42)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(hitX, upperY + 42);
    ctx.lineTo(hitX, lowerY - 42);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    lanes.forEach((lane, idx) => {
      const bounce = idx === 0
        ? Math.max(this.receptorBounce[0], this.receptorBounce[1])
        : Math.max(this.receptorBounce[2], this.receptorBounce[3]);
      const ringImg = this.imageCache.get(lane.sprite);
      const hasRingImg = ringImg && ringImg.complete && ringImg.naturalWidth > 0;
      const drawSize = 114 + bounce * 28 + this.beatPulseValue * 12;

      ctx.save();
      ctx.translate(hitX, lane.y);

      if (hasRingImg) {
        ctx.rotate(songTime * (idx === 0 ? 1.8 : -1.8) + bounce * 0.45);
        ctx.shadowColor = bounce > 0.1 ? '#FFE600' : lane.color;
        ctx.shadowBlur = bounce > 0.1 ? 22 : 12;
        ctx.drawImage(ringImg, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
      } else {
        const radius = 32 + bounce * 11 + this.beatPulseValue * 4;
        ctx.rotate(songTime * (idx === 0 ? 2.2 : -2.2));
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = bounce > 0.1 ? `${lane.color}88` : 'rgba(25, 10, 40, 0.55)';
        ctx.fill();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = bounce > 0.1 ? '#FFFFFF' : lane.color;
        ctx.stroke();
      }
      ctx.restore();

      // 靶圈键位波普角标
      ctx.save();
      ctx.font = '900 12px Impact, "Arial Black", sans-serif';
      ctx.fillStyle = '#FFE600';
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      ctx.strokeText(lane.tag, hitX, lane.y - drawSize * 0.48 - 4);
      ctx.fillText(lane.tag, hitX, lane.y - drawSize * 0.48 - 4);
      ctx.restore();
    });
  }

  drawFootstepDustAndAfterimages(ctx) {
    // 1. 脚底向后喷射的糖果踏地烟尘
    for (const d of this.footstepDust) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life * 0.85);
      ctx.fillStyle = d.color;
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size * d.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 2. Q 版角色高速霓虹残影 (Afterimage Ghosts)
    const partner = this.getActivePartner();
    const runSheetImg = partner.chibiRunSheet ? this.imageCache.get(partner.chibiRunSheet) : null;
    const hasRunSheet = runSheetImg && runSheetImg.complete && runSheetImg.naturalWidth >= 1024;

    for (const g of this.runnerAfterimages) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, g.life * 0.42);
      ctx.translate(g.x, g.y);
      ctx.rotate(g.tilt);
      ctx.scale(g.scaleX, g.scaleY);

      if (hasRunSheet && g.state === 'RUN') {
        const frameCount = Math.max(1, Math.round(runSheetImg.naturalWidth / 256));
        const normPhase = (((g.stepPhase / (Math.PI * 2)) % 1) + 1) % 1;
        const frameIdx = Math.floor(normPhase * frameCount) % frameCount;
        ctx.shadowColor = g.color;
        ctx.shadowBlur = 16;
        ctx.drawImage(runSheetImg, frameIdx * 256, 0, 256, 256, -120, -168, 240, 240);
      } else {
        const ghostSrc =
          g.state === 'AIR_SLASH'
            ? partner.chibiAir
            : g.state === 'GROUND_SMASH' || g.state === 'DOUBLE_BURST'
            ? partner.chibiSmash
            : partner.chibiRun1;
        const ghostImg = ghostSrc ? this.imageCache.get(ghostSrc) : null;

        if (ghostImg && ghostImg.complete && ghostImg.naturalWidth > 0) {
          ctx.shadowColor = g.color;
          ctx.shadowBlur = 16;
          ctx.drawImage(ghostImg, -112, -160, 224, 224);
        } else {
          this.drawProceduralChibiBody(ctx, partner, g.stepPhase, g.state, g.color);
        }
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------------
     Q 版 2.5 头身侧身跑酷看板娘渲染器 (优先使用 I2V 视频抽帧抠图 12 帧真跑步/跳跃精灵表)
     ------------------------------------------------------------------------ */
  drawChibiRunnerHeroine(ctx, upperY, lowerY, songTime) {
    const partner = this.getActivePartner();
    const runSheetImg = partner.chibiRunSheet ? this.imageCache.get(partner.chibiRunSheet) : null;
    const actionSheetImg = partner.chibiActionSheet ? this.imageCache.get(partner.chibiActionSheet) : null;
    const hasRunSheet = runSheetImg && runSheetImg.complete && runSheetImg.naturalWidth >= 1024;
    const hasActionSheet = actionSheetImg && actionSheetImg.complete && actionSheetImg.naturalWidth >= 1024;

    const x = this.runnerBaseX + this.runnerLungeX;
    const isAir = this.runnerY < lowerY - 28;
    // I2V 视频序列帧自身已带真实迈腿与身体起伏，仅叠加轻微节拍踏地反馈，消除机械抖动感
    const runBob = hasRunSheet
      ? isAir
        ? Math.sin(songTime * 10) * 3
        : -Math.abs(Math.sin(this.runnerStepPhase)) * 3.5
      : isAir
      ? Math.sin(songTime * 12) * 4
      : -Math.abs(Math.sin(this.runnerStepPhase)) * 13;
    const y = this.runnerY + runBob;

    // 1. 地面动态投影（角色跃起到空中时，地面影子缩小变淡）
    const heightRatio = Math.max(0, Math.min(1, (lowerY - this.runnerY) / (lowerY - upperY)));
    const shadowW = 54 * (1 - heightRatio * 0.48);
    const shadowH = 13 * (1 - heightRatio * 0.48);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 4, 28, 0.68)';
    ctx.strokeStyle = this.isFever ? '#FFE600' : '#00F5D4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, lowerY + 42, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. 绘制 Q 版跑酷女主本体
    ctx.save();
    ctx.translate(x, y);
    const dynamicRunLean = hasRunSheet ? 0 : isAir ? 0 : Math.sin(this.runnerStepPhase * 2) * 0.055;
    ctx.rotate(this.runnerTilt * (hasRunSheet ? 0.45 : 1.0) + dynamicRunLean);
    ctx.scale(this.runnerScaleX, this.runnerScaleY);

    if ((isAir || this.runnerAttackPoseTimer > 0) && hasActionSheet) {
      // 播放跳跃/挥击连续动作精灵表 (8 帧 × 256×256 · PC 端放大至 240×240 清晰醒目)
      const frameCount = Math.max(1, Math.round(actionSheetImg.naturalWidth / 256));
      const progress = this.runnerAttackPoseTimer > 0
        ? 1.0 - Math.min(1, this.runnerAttackPoseTimer / 0.25)
        : ((songTime * 12) % 1);
      const frameIdx = Math.min(frameCount - 1, Math.floor(progress * frameCount));
      ctx.save();
      ctx.shadowColor = this.isFever ? '#FFE600' : partner.accent;
      ctx.shadowBlur = 18;
      ctx.drawImage(actionSheetImg, frameIdx * 256, 0, 256, 256, -120, -168, 240, 240);
      ctx.restore();
    } else if (hasRunSheet && !isAir && this.runnerAttackPoseTimer <= 0) {
      // 播放 12 帧完整交替迈腿奔跑循环精灵表 (12 帧 × 256×256 · PC 端放大至 240×240 清晰醒目)
      const frameCount = Math.max(1, Math.round(runSheetImg.naturalWidth / 256));
      const normPhase = (((this.runnerStepPhase / (Math.PI * 2)) % 1) + 1) % 1;
      const frameIdx = Math.floor(normPhase * frameCount) % frameCount;
      ctx.save();
      ctx.shadowColor = this.isFever ? '#FFE600' : partner.accent;
      ctx.shadowBlur = 12;
      ctx.drawImage(runSheetImg, frameIdx * 256, 0, 256, 256, -120, -168, 240, 240);
      ctx.restore();
    } else {
      // 空中跃起/重击单帧或骨骼兜底
      const stepFrame = Math.floor(this.runnerStepPhase / Math.PI) % 2 === 0 ? partner.chibiRun1 : partner.chibiRun2;
      const targetChibiSrc =
        this.runnerAnimState === 'AIR_SLASH' || isAir
          ? partner.chibiAir
          : this.runnerAttackPoseTimer > 0
          ? partner.chibiSmash
          : stepFrame;
      const chibiImg = targetChibiSrc ? this.imageCache.get(targetChibiSrc) : null;

      if (chibiImg && chibiImg.complete && chibiImg.naturalWidth > 0) {
        ctx.save();
        ctx.shadowColor = this.isFever ? '#FFE600' : partner.accent;
        ctx.shadowBlur = this.runnerAttackPoseTimer > 0 ? 18 : 10;
        ctx.drawImage(chibiImg, -112, -160, 224, 224);
        ctx.restore();
      } else {
        this.drawProceduralChibiBody(ctx, partner, this.runnerStepPhase, this.runnerAnimState, null);
      }
    }

    // 3. 长瀞同学护盾光环
    if (this.shieldCount > 0) {
      ctx.strokeStyle = '#00F5D4';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, -16, 68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 4. 脚下悬浮波普漫画铭牌
    ctx.save();
    const tagY = lowerY + 62;
    ctx.fillStyle = '#190A28';
    ctx.strokeStyle = this.isFever ? '#FFE600' : partner.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - 78, tagY, 156, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFE600';
    ctx.font = '900 11px Impact, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isAir ? `⚡ ${partner.name} · 空中连击` : `🏃‍♀️ ${partner.name} · 极速跑酷`,
      x,
      tagY + 15
    );
    ctx.restore();
  }

  // 2.5 头身 Q 版糖果波普跑酷骨骼角色绘制（四肢迈步、发辫物理、巨型武器挥击、头像贴图融合）
  drawProceduralChibiBody(ctx, partner, stepPhase, animState, silhouetteColor = null) {
    const isAttacking = this.runnerAttackPoseTimer > 0 || animState === 'AIR_SLASH' || animState === 'GROUND_SMASH' || animState === 'DOUBLE_BURST';
    const legAngle = Math.sin(stepPhase) * 0.72;
    const armAngle = isAttacking ? -1.45 : -Math.sin(stepPhase) * 0.65;
    const hairWave = Math.sin(stepPhase - 0.8) * 9;

    const ink = '#190A28';
    const primary = silhouetteColor || partner.outfitPrimary || '#FF1493';
    const secondary = silhouetteColor || partner.outfitSecondary || '#2A334B';
    const hair = silhouetteColor || partner.hairColor || '#5C3327';
    const accent = silhouetteColor || partner.accent || '#FFE600';
    const weaponCol = silhouetteColor || partner.weaponColor || '#FFE600';

    // 1. 身后飘动的动态双马尾/长发披风与波普围巾
    ctx.save();
    ctx.fillStyle = hair;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-14, -36);
    ctx.quadraticCurveTo(-52, -44 + hairWave, -74, -22 + hairWave * 1.2);
    ctx.quadraticCurveTo(-48, -10 + hairWave, -12, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 霓虹糖果飘带围巾
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-8, -18);
    ctx.quadraticCurveTo(-46, -14 - hairWave * 0.7, -68, -2 - hairWave);
    ctx.lineTo(-60, 10 - hairWave);
    ctx.quadraticCurveTo(-36, -2, -6, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 2. 后腿 (Back Leg) 高速迈步
    ctx.save();
    ctx.translate(-4, 14);
    ctx.rotate(-legAngle);
    ctx.fillStyle = '#FFE4D6';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-7, 0, 14, 24, 7);
    ctx.fill();
    ctx.stroke();
    // Q版厚底跑酷运动鞋
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(-8, 17, 22, 13, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. 前腿 (Front Leg) 高速迈步
    ctx.save();
    ctx.translate(6, 14);
    ctx.rotate(legAngle);
    ctx.fillStyle = '#FFE4D6';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-7, 0, 14, 24, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-8, 17, 22, 13, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Q 版小巧躯干与百褶短裙 (Torso & Pleated Skirt)
    ctx.save();
    ctx.rotate(0.12); // 奔跑前倾角
    ctx.fillStyle = primary;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-15, -22);
    ctx.lineTo(15, -22);
    ctx.lineTo(20, 8);
    ctx.lineTo(-19, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 百褶裙边
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(-19, 4);
    ctx.lineTo(21, 4);
    ctx.lineTo(26, 19);
    ctx.lineTo(-24, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 胸前波普蝴蝶结
    ctx.fillStyle = '#FF1493';
    ctx.beginPath();
    ctx.arc(6, -12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 5. Q 版大头 (2.5头身比例：大圆脸 + 看板娘专属特征发饰)
    ctx.save();
    ctx.translate(4, -46);
    // 后脑头发外轮廓
    ctx.fillStyle = hair;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(-2, -2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Q版肉感脸颊 (朝右奔跑侧脸)
    ctx.fillStyle = silhouetteColor || '#FFE7D8';
    ctx.beginPath();
    ctx.arc(3, 1, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!silhouetteColor) {
      // 动感大眼睛（攻击时变成自信星芒眼，受伤时变成 >_<）
      if (animState === 'HURT') {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.lineTo(16, 1);
        ctx.lineTo(6, 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = partner.eyeColor || '#FF1493';
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(13, 1, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 眼神高光
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(15, -2, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 腮红与元气虎牙笑嘴
      ctx.fillStyle = 'rgba(255, 46, 126, 0.55)';
      ctx.beginPath();
      ctx.ellipse(15, 10, 5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FF2E7E';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(9, 12, isAttacking ? 5.5 : 3.8, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    // 额前刘海与角色专属头饰（长瀞发卡 / 辉夜红发带 / 黑猫猫耳 / 海梦挑染 / 高木呆毛）
    ctx.fillStyle = hair;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -7, 26, Math.PI * 1.05, Math.PI * 1.98);
    ctx.lineTo(18, 0);
    ctx.lineTo(8, -8);
    ctx.lineTo(-2, 1);
    ctx.lineTo(-12, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 专属萌点配饰
    if (partner.id === 'kuroneko') {
      // 黑猫哥特猫耳头饰
      ctx.fillStyle = silhouetteColor || '#190A28';
      ctx.beginPath();
      ctx.moveTo(-8, -28);
      ctx.lineTo(0, -46);
      ctx.lineTo(10, -28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (partner.id === 'kaguya') {
      // 辉夜红色蝴蝶结发带
      ctx.fillStyle = silhouetteColor || '#FF1448';
      ctx.beginPath();
      ctx.moveTo(-12, -26);
      ctx.lineTo(-24, -38);
      ctx.lineTo(-6, -34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (partner.id === 'nagatoro') {
      // 长瀞标志性双白发卡
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, -18, 12, 4);
      ctx.fillRect(4, -12, 12, 4);
    } else {
      // 星芒发饰与元气呆毛
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-8, -28, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 6. 前置手臂与专属巨型糖果武器挥击 (Oversized Pop Weapon Swing)
    ctx.save();
    ctx.translate(10, -12);
    const swingRot = isAttacking
      ? (this.slashParity ? -1.15 : 0.75) + (0.25 - this.runnerAttackPoseTimer) * 5.2
      : armAngle;
    ctx.rotate(swingRot);

    // 武器的握柄与锤头/吉他琴身
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, -4, 42, 8);
    ctx.strokeRect(0, -4, 42, 8);

    // 巨型糖果重锤 / 电吉他头部
    ctx.fillStyle = weaponCol;
    ctx.beginPath();
    ctx.roundRect(32, -24, 30, 48, 10);
    ctx.fill();
    ctx.stroke();

    // 武器上的波普星星徽记
    ctx.fillStyle = '#FF1493';
    ctx.beginPath();
    ctx.arc(47, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Q版小圆手握柄
    ctx.fillStyle = silhouetteColor || '#FFE4D6';
    ctx.beginPath();
    ctx.arc(8, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     Q 版节拍小怪（支持 AI 透明 Q 版恶魔/音响鲨/幽灵怪贴图 + 动态俯冲/弹跳/隐身）
     ------------------------------------------------------------------------ */
  drawBeatMonsterNote(ctx, x, y, lane2, isDouble, songTime, seedId = 1, entryStyle = 'SWOOP', alpha = 1.0) {
    const track = this.getActiveTrack();
    const beatPhase = songTime * ((track ? track.bpm : 130) / 60) * Math.PI * 2 + seedId;

    const spritePath =
      entryStyle === 'GHOST'
        ? 'assets/neonbeat/monsters/monster_ghost.webp'
        : lane2 === 0
        ? 'assets/neonbeat/monsters/monster_air_bat.webp'
        : 'assets/neonbeat/monsters/monster_gnd_slime.webp';
    const monImg = this.imageCache.get(spritePath);

    ctx.save();
    ctx.globalAlpha = Math.max(0.12, alpha);

    // 幽灵怪隐身阶段的虚线残影预警圈
    if (entryStyle === 'GHOST' && alpha < 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = '#00F5D4';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(x, y, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '900 11px Impact, sans-serif';
      ctx.fillStyle = '#FFE600';
      ctx.textAlign = 'center';
      ctx.fillText('👻 GHOST!', x, y - 38);
      ctx.restore();
    }

    if (monImg && monImg.complete && monImg.naturalWidth > 0) {
      const hop = Math.abs(Math.sin(beatPhase * 0.5));
      const tilt = lane2 === 0 ? Math.sin(songTime * 10 + seedId) * 0.10 : (hop - 0.5) * 0.12;
      const uniformScale = 1.0 + Math.sin(beatPhase) * 0.04;

      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.scale(uniformScale, uniformScale);

      // 双押重拍金光描边 / 普通怪霓虹光晕 (PC 端放大至 122×122 轻松看清)
      ctx.shadowColor = isDouble ? '#FFE600' : lane2 === 0 ? '#FF1493' : '#00F5D4';
      ctx.shadowBlur = isDouble ? 20 : 12;
      ctx.drawImage(monImg, -61, -61, 122, 122);
      ctx.restore();
      return;
    }

    if (lane2 === 0) {
      // 上轨兜底：Q版飞天小恶魔糖果怪
      const hoverY = Math.sin(beatPhase) * 8;
      const wingFlap = Math.sin(songTime * 22 + seedId) * 0.55;
      ctx.translate(x, y + hoverY);

      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.scale(side, 1);
        ctx.rotate(wingFlap);
        ctx.fillStyle = isDouble ? '#FFE600' : '#00F5D4';
        ctx.strokeStyle = '#190A28';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(16, -6);
        ctx.lineTo(44, -22);
        ctx.lineTo(38, 4);
        ctx.lineTo(22, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      ctx.fillStyle = isDouble ? '#FFE600' : '#FF1493';
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // 下轨兜底：Q版蹦跳低音炮史莱姆机甲怪
      const hop = Math.abs(Math.sin(beatPhase * 0.5));
      ctx.translate(x, y - hop * 18);
      ctx.fillStyle = isDouble ? '#FFE600' : '#00F5D4';
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.roundRect(-27, -25, 54, 50, 16);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDoubleLightningBridge(ctx, x, upperY, lowerY, songTime) {
    ctx.save();
    const jitter = Math.sin(songTime * 45) * 9;
    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(x, upperY);
    ctx.lineTo(x - 14 + jitter, (upperY + lowerY) * 0.38);
    ctx.lineTo(x + 14 - jitter, (upperY + lowerY) * 0.62);
    ctx.lineTo(x, lowerY);
    ctx.stroke();

    ctx.strokeStyle = '#FFE600';
    ctx.lineWidth = 5.5;
    ctx.stroke();
    ctx.restore();
  }

  drawRainbowHoldStream(ctx, note, x, endX, hitX, y, songTime) {
    const headX = note.holding ? hitX : Math.max(hitX, x);
    const tailW = Math.max(14, endX - headX);
    const wave = Math.sin(songTime * 16) * 6;

    ctx.save();
    const grad = ctx.createLinearGradient(headX, y, headX + tailW, y);
    grad.addColorStop(0, '#FF1493');
    grad.addColorStop(0.5, '#FFE600');
    grad.addColorStop(1, '#00F5D4');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.roundRect(headX, y - 20 + wave * 0.25, tailW, 40, 20);
    ctx.fill();
    ctx.stroke();

    // 糖带内部闪光音符节点
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let sx = headX + 36; sx < headX + tailW - 20; sx += 48) {
      ctx.beginPath();
      ctx.arc(sx, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 龙头音符怪
    this.drawBeatMonsterNote(ctx, headX, y, note.lane2, true, songTime, note.id, 'WAVE', 1.0);
  }

  /* ------------------------------------------------------------------------
     A/B/C 三段连招巨型波普刀光挥击 (Slash Arcs) & Q 版怪物受击旋转击飞演出 (Ragdoll Knockback)
     ------------------------------------------------------------------------ */
  drawSlashEffectsAndKnockedMonsters(ctx) {
    const slashImg = this.imageCache.get('assets/neonbeat/vfx/vfx_slash_arc.webp');
    const hasSlashImg = slashImg && slashImg.complete && slashImg.naturalWidth > 0;

    // 1. A/B/C 三段连招波普漫画刀光（0=上挑流星斩, 1=重锤破地砸, 2=360度旋风回旋斩）
    for (const s of this.slashEffects) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.translate(s.x - 10, s.y);
      ctx.rotate(s.angleOffset + (1 - s.life) * 0.55 * s.dir);

      const r = s.radius * (1.22 - s.life * 0.18);

      if (hasSlashImg) {
        const size = r * 2.35;
        ctx.save();
        if (s.dir < 0) ctx.scale(1, -1);
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 18;
        ctx.drawImage(slashImg, -size * 0.48, -size * 0.5, size, size);
        if (s.comboStage === 2) {
          // C 段旋风回旋斩：叠加反向第二道月牙形成 360° 雙刃风暴
          ctx.rotate(Math.PI);
          ctx.drawImage(slashImg, -size * 0.45, -size * 0.45, size * 0.9, size * 0.9);
        }
        ctx.restore();
      } else if (s.comboStage === 2) {
        // C 段连招兜底
        ctx.strokeStyle = '#190A28';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, 0, Math.PI * 1.65);
        ctx.stroke();

        ctx.strokeStyle = s.color;
        ctx.lineWidth = 6.5;
        ctx.stroke();
      } else {
        // A 段 / B 段连招兜底
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI * 0.48, Math.PI * 0.48);
        ctx.arc(-16, 0, r * 0.74, Math.PI * 0.42, -Math.PI * 0.42, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#190A28';
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. 被一锤子打飞旋转飞出屏幕的 Q 版节拍怪 (Ragdoll Knockback)
    for (const m of this.knockedMonsters) {
      ctx.save();
      ctx.translate(m.x, m.y);

      // 飞出轨迹上的漫画拟声词 (POW!! / SMASH!! / BAM!!)
      ctx.save();
      ctx.font = '900 18px Impact, "Arial Black", sans-serif';
      ctx.fillStyle = '#FFE600';
      ctx.strokeStyle = '#190A28';
      ctx.lineWidth = 4;
      ctx.strokeText(m.comicWord, -28, -42);
      ctx.fillText(m.comicWord, -28, -42);
      ctx.restore();

      ctx.rotate(m.rot);
      ctx.scale(m.scale, m.scale);

      const spritePath =
        m.entryStyle === 'GHOST'
          ? 'assets/neonbeat/monsters/monster_ghost.webp'
          : m.lane2 === 0
          ? 'assets/neonbeat/monsters/monster_air_bat.webp'
          : 'assets/neonbeat/monsters/monster_gnd_slime.webp';
      const monImg = this.imageCache.get(spritePath);

      if (monImg && monImg.complete && monImg.naturalWidth > 0 && m.flashTimer <= 0) {
        ctx.drawImage(monImg, -58, -58, 116, 116);
      } else {
        // 受击瞬间纯白闪光帧 (Hit Flash) 或几何兜底
        ctx.fillStyle = m.flashTimer > 0 ? '#FFFFFF' : m.color;
        ctx.strokeStyle = '#190A28';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (m.lane2 === 0) {
          ctx.arc(0, 0, 24, 0, Math.PI * 2);
        } else {
          ctx.roundRect(-24, -22, 48, 44, 14);
        }
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawForegroundSpeedOverlay(ctx, W, H) {
    // 第 4 层前景：极速掠过的赛博街机立柱黑影与 FEVER 漫画速度线 (Speed: 1960 px/s)
    const off4 = this.parallaxOffsets[3];
    const pillarSpan = 920;
    const pillarX = W - (off4 % pillarSpan);

    ctx.save();
    if (pillarX > -120 && pillarX < W + 120) {
      ctx.fillStyle = 'rgba(12, 3, 24, 0.42)';
      ctx.fillRect(pillarX, 0, 28, H);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.28)';
      ctx.fillRect(pillarX + 28, 0, 4, H);
    }

    // 高连击或 FEVER 时屏幕上下边缘飙出波普速度线
    if (this.isFever || this.combo >= 15) {
      ctx.strokeStyle = this.isFever ? 'rgba(255, 230, 0, 0.45)' : 'rgba(0, 245, 212, 0.26)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const lx = ((W - ((off4 * 1.4 + i * 210) % W)));
        const ly = i % 2 === 0 ? 18 + i * 7 : H - 18 - i * 7;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 115, ly);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawSpikedGear(ctx, x, y, songTime) {
    // 闪避激光预警线
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 46, 76, 0.58)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(330, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const sawImg = this.imageCache.get('assets/neonbeat/vfx/vfx_hazard_saw.webp');
    const hasSawImg = sawImg && sawImg.complete && sawImg.naturalWidth > 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-songTime * 11.5);

    if (hasSawImg) {
      ctx.shadowColor = '#FF1493';
      ctx.shadowBlur = 16;
      ctx.drawImage(sawImg, -61, -61, 122, 122);
    } else {
      const spikes = 10;
      const outerR = 34;
      const innerR = 21;
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
    }
    ctx.restore();

    // 闪避提示标语
    ctx.save();
    ctx.fillStyle = '#FFE600';
    ctx.strokeStyle = '#190A28';
    ctx.lineWidth = 3.5;
    ctx.font = '900 12px Impact, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('⚠️ DODGE!', x, y - 48);
    ctx.fillText('⚠️ DODGE!', x, y - 48);
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     模式二：经典 4 键下落式街机模式 (4K Mania 风 · MANIA_4K)
     ------------------------------------------------------------------------ */
  drawMania4KStage(ctx, W, H) {
    const songTime = this.isLiveState() ? this.synth.getElapsedSec() : 0;
    const highwayLeft = MANIA_HIGHWAY.left;
    const laneWidth = MANIA_HIGHWAY.laneWidth;
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
    if (!this.isLiveState()) return;
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
      ctx.rotate(-0.06);

      // 喵斯快跑风：判定字底衬波普漫画爆炸星芒贴纸 (Comic Burst Sticker Backing)
      const spikes = 12;
      const outerRx = Math.max(68, pop.text.length * 10.5);
      const outerRy = 26;
      ctx.beginPath();
      for (let s = 0; s < spikes * 2; s++) {
        const isTip = s % 2 === 0;
        const rx = isTip ? outerRx : outerRx * 0.76;
        const ry = isTip ? outerRy : outerRy * 0.68;
        const ang = (s * Math.PI) / spikes;
        const px = Math.cos(ang) * rx;
        const py = Math.sin(ang) * ry - 10;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#190A28';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = pop.color;
      ctx.stroke();

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
        ctx.strokeText(pop.subText, 0, 26);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(pop.subText, 0, 26);
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
          <td><strong>《${escapeHtml(r.trackTitle)}》</strong></td>
          <td>${r.mode === 'RUN_2L' ? '🏃‍♀️ 横版双轨' : '🎹 4K 街机'} · ${escapeHtml(r.diffName)}</td>
          <td>${escapeHtml(r.partnerName)}</td>
          <td><strong>${escapeHtml(r.rank)}</strong> (${escapeHtml(r.badgeText)})</td>
          <td>${escapeHtml(Number(r.score).toLocaleString())}</td>
          <td>${escapeHtml(r.maxCombo)}</td>
          <td>${escapeHtml(r.acc)}%</td>
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

      if (this.areLiveControlsLocked()) this.stopLiveToIdle();
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
        if (this.areLiveControlsLocked()) return;
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
        if (this.areLiveControlsLocked()) return;
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
      this.setAutoPlay(!this.autoPlay);
    });

    // 判定校准滑杆 (-200 ~ +200 ms，保存到 localStorage)
    const calibRange = document.getElementById('judgeOffsetRange');
    if (calibRange) {
      calibRange.addEventListener('input', (e) => this.setCalibrationMs(e.target.value));
    }
    const calibReset = document.getElementById('btnJudgeOffsetReset');
    if (calibReset) {
      calibReset.addEventListener('click', () => this.setCalibrationMs(0));
    }
    this.setCalibrationMs(this.calibrationMs);

    // 不死模式 (NO FAIL) 切换：体力归零也不会失败，但成绩不计入排名
    const btnNoFail = document.getElementById('btnToggleNoFail');
    if (btnNoFail) {
      btnNoFail.addEventListener('click', () => {
        if (this.areLiveControlsLocked()) return;
        this.setNoFail(!this.noFail);
      });
    }
    this.setNoFail(this.noFail);

    // 5. 立即预览看板娘 SKILL CUT-IN & 巨型魔王女王 16:9 机甲巨图阶段
    document.getElementById('btnTriggerCutInTest').addEventListener('click', () => {
      this.triggerMangaCutIn('⚡ SKILL CUT-IN PREVIEW!!');
    });
    const btnBossPhase = document.getElementById('btnTriggerBossPhaseTest');
    if (btnBossPhase) {
      btnBossPhase.addEventListener('click', () => {
        this.bossSplashTimer = 5.0;
        this.synth.playHitSfx('BOSS_KO');
        this.triggerScreenShake(true);
        this.spawnPopup('👑 DEMON QUEEN OVERDRIVE!!', '#FFE600', '巨型电音魔王女王 16:9 机甲王座降临！', 540, 145);
      });
    }

    // 6. 开始打歌 / 试听 / 重开 / 返回选曲
    document.getElementById('btnStartSong').addEventListener('click', () => this.startLive());
    document.getElementById('btnRetrySong').addEventListener('click', () => this.startLive());
    document.getElementById('btnBackToSelect').addEventListener('click', () => this.stopLiveToIdle());
    document.getElementById('btnStopLive').addEventListener('click', () => this.stopLiveToIdle());

    document.getElementById('btnPreviewSynth').addEventListener('click', () => {
      this.setAutoPlay(true);
      this.startLive({ preview: true });
    });

    document.getElementById('btnPauseResume').addEventListener('click', () => {
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        this.togglePause();
      } else if (this.state === 'IDLE') {
        this.startLive();
      }
    });

    // 暂停面板：继续 / 重来 / 退出
    document.getElementById('btnPauseContinue').addEventListener('click', () => this.resumeLive());
    document.getElementById('btnPauseRestart').addEventListener('click', () => {
      if (this.practice) {
        this.startPractice({ thenStartSong: this.practice.thenStartSong });
        return;
      }
      const preview = !!(this.liveSession && this.liveSession.isPreview);
      this.startLive({ preview });
    });
    document.getElementById('btnPauseExit').addEventListener('click', () => this.stopLiveToIdle());

    // 切到后台标签页时自动暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'PLAYING') this.pauseLive();
        else if (this.state === 'PAUSED') this.cancelResumeCountdown();
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
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
          e.preventDefault();
          this.togglePause();
        }
        return;
      }
      if (e.code in keyMap) {
        e.preventDefault();
        this.handleLaneInput(keyMap[e.code], true);
      } else if (e.code === 'Space' && this.state === 'PLAYING' && !this.practice) {
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
      const release = () => {
        if (this.keyDownLanes[laneIdx]) this.handleLaneInput(laneIdx, false);
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {}
        this.handleLaneInput(laneIdx, true);
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    // 9. 点击 Canvas 舞台直接交互（跑酷模式点上半屏=空中轨，下半屏=地面轨；4K模式按X坐标分轨）
    // 指针 → Canvas 坐标（1120×560），按实际绘制的轨道几何命中；4K 轨道外的点击忽略
    const laneFromPointer = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return -1;
      const cx = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
      const cy = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
      if (this.gameMode === 'RUN_2L') {
        return cy < this.canvas.height / 2 ? 1 : 2;
      }
      const rel = cx - MANIA_HIGHWAY.left;
      const total = MANIA_HIGHWAY.laneWidth * MANIA_HIGHWAY.lanes;
      if (rel < 0 || rel >= total) return -1;
      return Math.floor(rel / MANIA_HIGHWAY.laneWidth);
    };
    const releaseCanvasPointer = (e) => {
      if (!this.canvasPointerLanes.has(e.pointerId)) return;
      const lane = this.canvasPointerLanes.get(e.pointerId);
      this.canvasPointerLanes.delete(e.pointerId);
      const stillHeld = [...this.canvasPointerLanes.values()].includes(lane);
      if (!stillHeld) this.handleLaneInput(lane, false);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      const lane = laneFromPointer(e);
      if (lane < 0) return;
      e.preventDefault();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.canvasPointerLanes.set(e.pointerId, lane);
      this.handleLaneInput(lane, true);
    });
    this.canvas.addEventListener('pointerup', releaseCanvasPointer);
    this.canvas.addEventListener('pointercancel', releaseCanvasPointer);
    this.canvas.addEventListener('lostpointercapture', releaseCanvasPointer);

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

    // 新手练习 / 玩法说明 / 跳过
    document.getElementById('btnStartPractice').addEventListener('click', () => this.startPractice());
    document.getElementById('btnStartHowTo').addEventListener('click', () => {
      document.getElementById('howToPlayModal').hidden = false;
    });
    document.getElementById('btnHowToReplay').addEventListener('click', () => this.startPractice());
    document.getElementById('btnPracticeSkip').addEventListener('click', () => this.skipPractice());
    // 触屏操作过一次即切换为「打击垫」提示
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') this.touchUi = true;
      },
      { capture: true, passive: true }
    );

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
