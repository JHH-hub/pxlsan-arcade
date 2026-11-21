/**
 * 《放学以后的深夜咖啡馆 (Pxlsan Midnight Cafe)》
 * 游戏B 全栈核心逻辑：
 *  1. 双层动态窗景 Canvas：滑落窗玻璃雨滴与水痕 (Rain on Glass) + 街灯柔焦光斑 (Bokeh) + 吧台咖啡热蒸汽粒子 (Steam Particles)
 *  2. WebAudio Lo-Fi 电钢琴音乐盒（3首暖调循环和弦 + 黑胶微噪） & 7种吧台拟音（磨豆、蒸汽奶泡、冰块落杯、搅拌勺叮当、倾倒、拉花画笔、奉茶铜铃）
 *  3. 12位登场女主真实立绘接入、3个营业时段（17:30 黄昏放学档 / 20:00 雨夜自习档 / 22:30 打烊微醺档）、模糊心事点单与口味推理
 *  4. 三步交互式调饮工作台：
 *     - Step 1: 6款精选基底 + 7款风味辅料/顶料 + 冷热切换 + 实时杯身分层预览
 *     - Step 2: 胡桃木黄铜压力表黄金萃取（按住蓄力/点击锁定，黄金温区 +25% 风味加成）
 *     - Step 3: 真实可手绘圆形奶泡拉花画布 (Interactive Latte Art Canvas) + 5款一键辅助拉花模具（🐾猫爪/💛倾心/🌸樱吹雪/🌙弦月/🦢天鹅）+ 美观度自动评分
 *  5. ⭐⭐⭐/⭐⭐/⭐ 三档品鉴反馈、立绘表情切换、专属走心夜谈选项与 18款秘密特调手账持久化 (`pxlsan-game:arcade:cafe`)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'pxlsan-game:arcade:cafe';

  // ==================== 1. 营业时段配置 ====================
  const SHIFTS = {
    dusk: {
      id: 'dusk',
      name: '白天晴朗档',
      time: '11:30',
      sceneImg: 'assets/cafe/props/bg_pov_day.webp?v=6',
      tint: 'linear-gradient(180deg, rgba(255, 245, 220, 0.06) 0%, rgba(40, 24, 14, 0.14) 100%)',
      weatherIcon: '☀️',
      weatherText: '晴空暖阳 · 街角绿树微风 · 第一人称吧台视角',
      rainDensity: 0,
      bokehColors: ['rgba(255, 235, 160, 0.24)', 'rgba(255, 255, 220, 0.20)', 'rgba(180, 235, 255, 0.18)']
    },
    rain: {
      id: 'rain',
      name: '下午夕阳档',
      time: '17:30',
      sceneImg: 'assets/cafe/props/bg_pov_sunset.webp?v=6',
      tint: 'linear-gradient(180deg, rgba(255, 140, 60, 0.08) 0%, rgba(35, 18, 10, 0.18) 100%)',
      weatherIcon: '🌇',
      weatherText: '放学夕阳余晖 · 金色霞光洒满木吧台',
      rainDensity: 0,
      bokehColors: ['rgba(255, 179, 71, 0.28)', 'rgba(255, 115, 75, 0.24)', 'rgba(255, 215, 130, 0.22)']
    },
    late: {
      id: 'late',
      name: '晚上雨夜档',
      time: '21:30',
      sceneImg: 'assets/cafe/props/bg_first_person_counter.webp?v=6',
      tint: 'linear-gradient(180deg, rgba(16, 28, 38, 0.15) 0%, rgba(24, 13, 9, 0.25) 100%)',
      weatherIcon: '🌧️',
      weatherText: '窗外细雨淅沥 · 钨丝灯琥珀微醺 · 深夜吧台',
      rainDensity: 64,
      bokehColors: ['rgba(255, 179, 71, 0.30)', 'rgba(120, 200, 235, 0.22)', 'rgba(240, 160, 85, 0.25)']
    }
  };

  // ==================== 2. 精选基底 (6款实体手冲壶/茶碗 · 按 Lv.1~Lv.4 渐进解锁) & 辅料风味 (7款实体糖浆泵瓶/顶料罐) ====================
  const BASES = [
    {
      id: 'black_tea',
      name: '大吉岭红茶',
      nameEn: 'Black Tea',
      icon: '🫖',
      unlockLevel: 1,
      propImg: 'assets/cafe/props/prop_base_black_tea.webp',
      color: '#8C3B1E',
      cremaColor: '#C86D44',
      tags: ['茶香', '醇厚', '温润'],
      sfx: 'pour',
      desc: '带有麝香葡萄与木质尾韵的庄园红茶，清雅不腻'
    },
    {
      id: 'warm_milk',
      name: '北海道鲜牛乳',
      nameEn: 'Hokkaido Milk',
      icon: '🥛',
      unlockLevel: 1,
      propImg: 'assets/cafe/props/prop_base_warm_milk.webp',
      color: '#EBD8C0',
      cremaColor: '#FFF6EB',
      tags: ['奶香', '温柔', '安神'],
      sfx: 'steam',
      desc: '牧场直送生牛乳蒸汽打发，像夕阳一样暖洋洋'
    },
    {
      id: 'espresso',
      name: '深烘意式浓缩',
      nameEn: 'Espresso',
      icon: '☕',
      unlockLevel: 2,
      propImg: 'assets/cafe/props/prop_base_espresso.webp',
      color: '#3B1E0E',
      cremaColor: '#B87338',
      tags: ['浓郁', '苦韵', '提神'],
      sfx: 'grind',
      desc: '曼特宁与巴西拼配深烘，油脂丰厚、瞬间击穿困意'
    },
    {
      id: 'matcha',
      name: '宇治一番抹茶',
      nameEn: 'Matcha',
      icon: '🍵',
      unlockLevel: 2,
      propImg: 'assets/cafe/props/prop_base_matcha.webp',
      color: '#4A7C59',
      cremaColor: '#76A882',
      tags: ['茶香', '清雅', '回甘'],
      sfx: 'pour',
      desc: '石臼慢磨一番茶粉，茶竹茶筅打出细腻翡翠泡沫'
    },
    {
      id: 'cocoa',
      name: '法式可可',
      nameEn: 'French Cocoa',
      icon: '🍫',
      unlockLevel: 3,
      propImg: 'assets/cafe/props/prop_base_cocoa.webp',
      color: '#522B18',
      cremaColor: '#9E6240',
      tags: ['丝滑', '治愈', '浓醇'],
      sfx: 'pour',
      desc: '70%法芙娜黑巧融化于温热牛乳，丝绒般包裹味蕾'
    },
    {
      id: 'sparkling',
      name: '清爽气泡苏打',
      nameEn: 'Sparkling Soda',
      icon: '🫧',
      unlockLevel: 4,
      propImg: 'assets/cafe/props/prop_base_sparkling.webp',
      color: '#5BA4B8',
      cremaColor: '#A8DCE8',
      tags: ['清爽', '微泡', '解乏'],
      sfx: 'ice',
      desc: '山泉充入绵密气泡，碰撞杯壁发出沙沙微响'
    }
  ];

  const ADDONS = [
    {
      id: 'mint',
      name: '清凉薄荷',
      icon: '🌿',
      unlockLevel: 1,
      propImg: 'assets/cafe/props/prop_addon_mint.webp',
      color: '#58B08C',
      tags: ['清凉', '醒脑', '草本'],
      desc: '现摘留兰香嫩叶轻拍入杯，沁人心脾'
    },
    {
      id: 'cheese_foam',
      name: '海盐芝士奶盖',
      icon: '🧀',
      unlockLevel: 1,
      propImg: 'assets/cafe/props/prop_addon_cheese_foam.webp',
      color: '#F5E6D3',
      tags: ['咸甜', '醇厚', '绵密'],
      desc: '冲绳海盐配马斯卡彭芝士打发，咸甜交织'
    },
    {
      id: 'caramel',
      name: '焦糖糖浆',
      icon: '🍯',
      unlockLevel: 2,
      propImg: 'assets/cafe/props/prop_addon_caramel.webp',
      color: '#D48C46',
      tags: ['焦糖', '温柔', '甜香'],
      desc: '铜锅慢熬琥珀焦糖，带来温暖微甜的尾韵'
    },
    {
      id: 'honey',
      name: '野生蜂蜜',
      icon: '🐝',
      unlockLevel: 2,
      propImg: 'assets/cafe/props/prop_addon_honey.webp',
      color: '#F2B84B',
      tags: ['清甜', '润泽', '花香'],
      desc: '金合欢百花蜜，温润甘甜不刺喉'
    },
    {
      id: 'raspberry',
      name: '覆盆子果露',
      icon: '🍓',
      unlockLevel: 3,
      propImg: 'assets/cafe/props/prop_addon_raspberry.webp',
      color: '#D9536F',
      tags: ['莓果', '草莓', '酸甜'],
      desc: '树莓与红颜草莓慢熬果露，色泽绯红明艳'
    },
    {
      id: 'vanilla_cream',
      name: '香草奶油顶',
      icon: '🍦',
      unlockLevel: 3,
      propImg: 'assets/cafe/props/prop_addon_vanilla_cream.webp',
      color: '#FFF8EE',
      tags: ['奶油', '双倍甜蜜', '华丽'],
      desc: '马达加斯加香草籽鲜奶油雪顶，幸福感拉满'
    },
    {
      id: 'cinnamon',
      name: '肉桂粉',
      icon: '🍂',
      unlockLevel: 4,
      propImg: 'assets/cafe/props/prop_addon_cinnamon.webp',
      color: '#9C5227',
      tags: ['木质香', '暖身', '辛香'],
      desc: '斯里兰卡锡兰肉桂轻筛，雨夜的灵魂香气'
    }
  ];

  // ==================== 3. 18款秘密特调手账 (12位女主招牌 + 6款深夜馆藏) ====================
  const RECIPES = [
    {
      id: 'rec_kaguya',
      code: 'NO.01',
      name: '学生会长的雨夜静心茶',
      heroineId: 'kaguya',
      temp: 'hot',
      base: 'black_tea',
      addons: ['mint', 'cheese_foam'],
      stencil: 'moon',
      lore: '四宫辉夜钟爱的温热大吉岭红茶，佐以一抹清凉薄荷与咸香海盐奶盖，醇厚茶香中绝无甜腻。'
    },
    {
      id: 'rec_marin',
      code: 'NO.02',
      name: '外景收工！双倍草莓雪顶冰饮',
      heroineId: 'marin',
      temp: 'iced',
      base: 'sparkling',
      addons: ['raspberry', 'vanilla_cream', 'honey'],
      stencil: 'heart',
      lore: '喜多川海梦拍完外景后的能量补给，冰爽气泡碰撞覆盆子草莓果露与高耸的香草奶油顶。'
    },
    {
      id: 'rec_utaha',
      code: 'NO.03',
      name: '截稿日前夜的焦糖深烘',
      heroineId: 'utaha',
      temp: 'hot',
      base: 'espresso',
      addons: ['caramel', 'cinnamon'],
      stencil: 'swan',
      lore: '霞之丘诗羽赶稿时的灵药。苦度拉满的深烘意式浓缩，尾韵却藏着焦糖与肉桂的体贴温柔。'
    },
    {
      id: 'rec_takagi',
      code: 'NO.04',
      name: '夕阳余晖的焦糖蜂蜜热牛乳',
      heroineId: 'takagi',
      temp: 'hot',
      base: 'warm_milk',
      addons: ['caramel', 'honey'],
      stencil: 'paw',
      lore: '高木同学让你猜的夕阳特调，北海道热牛乳融化焦糖与蜂蜜，每一口都藏着笑意。'
    },
    {
      id: 'rec_takako',
      code: 'NO.05',
      name: '小恶魔的傲娇奶油热可可',
      heroineId: 'takako',
      temp: 'hot',
      base: 'cocoa',
      addons: ['vanilla_cream', 'raspberry'],
      stencil: 'paw',
      lore: '长瀞嘴上嫌弃太幼稚、身体却诚实喝光的热可可，顶上还要挤满香草奶油与酸甜莓果。'
    },
    {
      id: 'rec_yukino',
      code: 'NO.06',
      name: '侍奉部窗边的宇治初雪抹茶',
      heroineId: 'yukino',
      temp: 'hot',
      base: 'matcha',
      addons: ['cheese_foam', 'mint'],
      stencil: 'sakura',
      lore: '雪乃在雨夜读书时偏爱的宇治一番抹茶，顶层覆盖薄雪般绵密的海盐奶盖。'
    },
    {
      id: 'rec_yui',
      code: 'NO.07',
      name: '放学团子屋的蜜桃莓果红茶拿铁',
      heroineId: 'yui',
      temp: 'hot',
      base: 'black_tea',
      addons: ['honey', 'vanilla_cream'],
      stencil: 'heart',
      lore: '由比滨最喜欢的温柔甜香红茶，加了野生蜂蜜与香草奶油，暖融融得让人想靠近。'
    },
    {
      id: 'rec_qianhe',
      code: 'NO.08',
      name: '优等生班长的晚风蜂蜜洋甘菊奶',
      heroineId: 'qianhe',
      temp: 'hot',
      base: 'warm_milk',
      addons: ['honey', 'cinnamon'],
      stencil: 'sakura',
      lore: '千鹤批改完班级日志后的放松一杯，温润牛乳配野生蜂蜜与一丝暖胃肉桂。'
    },
    {
      id: 'rec_aili',
      code: 'NO.09',
      name: '金发双马尾的绯红莓果海盐可可',
      heroineId: 'aili',
      temp: 'iced',
      base: 'cocoa',
      addons: ['raspberry', 'cheese_foam'],
      stencil: 'heart',
      lore: '爱莉嘴硬说“顺路进来避雨”点的冰可可，覆盆子酸甜中和了海盐芝士的醇厚。'
    },
    {
      id: 'rec_momo',
      code: 'NO.10',
      name: '皇家温室的夜绽花蜜茶露',
      heroineId: 'momo',
      temp: 'hot',
      base: 'matcha',
      addons: ['honey', 'raspberry'],
      stencil: 'sakura',
      lore: '梦梦从温室花房带来的灵感，清雅抹茶交织百花蜜与绯红果露，香气撩人。'
    },
    {
      id: 'rec_mai',
      code: 'NO.11',
      name: '国民女演员的深夜海盐焦糖拿铁',
      heroineId: 'mai',
      temp: 'hot',
      base: 'espresso',
      addons: ['caramel', 'cheese_foam'],
      stencil: 'moon',
      lore: '樱岛麻衣结束夜戏通告后的秘密犒赏，深烘浓缩与海盐芝士焦糖平衡得恰到好处。'
    },
    {
      id: 'rec_kuroneko',
      code: 'NO.12',
      name: '堕天圣黑猫的暗夜深渊魔药',
      heroineId: 'kuroneko',
      temp: 'iced',
      base: 'espresso',
      addons: ['raspberry', 'mint', 'cinnamon'],
      stencil: 'moon',
      lore: '五更琉璃中二台词背后的特调，深渊黑咖啡混入血色覆盆子与清凉薄荷，出奇地好喝。'
    },
    {
      id: 'rec_house_1',
      code: 'NO.13',
      name: '胡桃木屋檐下的雨声拿铁',
      heroineId: null,
      temp: 'hot',
      base: 'espresso',
      addons: ['honey', 'vanilla_cream'],
      stencil: 'swan',
      lore: '小城咖啡馆招牌第一号，蜂蜜与鲜奶油柔化了浓缩的锋芒。'
    },
    {
      id: 'rec_house_2',
      code: 'NO.14',
      name: '翡翠森呼吸·薄荷冰抹茶苏打',
      heroineId: null,
      temp: 'iced',
      base: 'matcha',
      addons: ['mint', 'honey'],
      stencil: 'sakura',
      lore: '夏日与闷热雨夜的救星，宇治抹茶与清凉薄荷在冰块间起舞。'
    },
    {
      id: 'rec_house_3',
      code: 'NO.15',
      name: '琥珀壁炉·肉桂红茶欧蕾',
      heroineId: null,
      temp: 'hot',
      base: 'black_tea',
      addons: ['caramel', 'cinnamon', 'cheese_foam'],
      stencil: 'swan',
      lore: '锡兰肉桂与大吉岭红茶的经典冬夜协奏，暖意直达指尖。'
    },
    {
      id: 'rec_house_4',
      code: 'NO.16',
      name: '粉红晚霞·覆盆子气泡莫吉托',
      heroineId: null,
      temp: 'iced',
      base: 'sparkling',
      addons: ['raspberry', 'mint'],
      stencil: 'heart',
      lore: '无酒精的放学后微醺特调，粉紫渐层宛如小城河岸的晚霞。'
    },
    {
      id: 'rec_house_5',
      code: 'NO.17',
      name: '猫咪肉球·海盐焦糖热可可',
      heroineId: null,
      temp: 'hot',
      base: 'cocoa',
      addons: ['caramel', 'cheese_foam'],
      stencil: 'paw',
      lore: '绵密奶盖上印着可爱的猫爪拉花，咸甜可可治愈一切疲惫。'
    },
    {
      id: 'rec_house_6',
      code: 'NO.18',
      name: '好梦晚安·香草蜂蜜热牛乳',
      heroineId: null,
      temp: 'hot',
      base: 'warm_milk',
      addons: ['vanilla_cream', 'honey', 'mint'],
      stencil: 'moon',
      lore: '零咖啡因的打烊前最后一盏暖饮，祝今夜有个好梦。'
    }
  ];

  // ==================== 4. 12位登场女主完整档案与真实立绘路径 ====================
  const HEROINES = [
    {
      id: 'kaguya',
      name: '四宫辉夜',
      role: '秀知院学生会副会长',
      preferredShifts: ['rain', 'late'],
      avatar: 'assets/cafe/characters/avatar_kaguya.webp',
      expressions: {
        normal: 'assets/cafe/characters/kaguya_normal.webp',
        smile: 'assets/cafe/characters/kaguya_smile.webp',
        shy: 'assets/cafe/characters/kaguya_shy.webp',
        blush: 'assets/cafe/characters/kaguya_blush.webp',
        tease: 'assets/cafe/characters/kaguya_tease.webp',
        surprise: 'assets/cafe/characters/kaguya_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/kaguya_normal.webp',
        'assets/cafe/characters/kaguya_outfit2.webp',
        'assets/cafe/characters/kaguya_smile.webp',
        'assets/cafe/characters/kaguya_blush.webp'
      ],
      smallTalks: [
        '「店长，这家店居然没有设置VIP包厢……不过，坐在吧台听雨声，倒也不算太坏。」',
        '「真、真是巧呢！我只是让司机在路口等我，绝对不是特意绕路过来的！」',
        '「你磨咖啡豆时的专注神情……咳，稍微有那么一点点帅气呢。」'
      ],
      orders: [
        {
          title: '《学生会长的雨夜静心茶》',
          promptHtml: '「今天学生会的预算案真是让人头疼……请给我一杯<strong>温热的、基底醇厚、带着一抹清雅茶香但绝不甜腻</strong>的饮品吧。」',
          temp: 'hot',
          idealBases: ['black_tea', 'matcha'],
          idealAddons: ['mint', 'cheese_foam'],
          dislikedAddons: ['vanilla_cream'],
          favoriteStencil: 'moon',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🫖 基底：大吉岭红茶 / 宇治一番抹茶',
            '🌿 风味：清凉薄荷 + 海盐芝士奶盖（忌甜腻奶油）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「入口是大吉岭红茶的温润醇厚，紧接着薄荷的清凉与海盐奶盖把预算案的烦闷一扫而空……店长，你难道会读心术吗？」'
            },
            good: {
              expr: 'blush',
              quote: '「嗯……茶香很舒服，温度也刚刚好。看在你这么用心的份上，本小姐今晚就多坐十分钟吧。」'
            },
            try: {
              expr: 'surprise',
              quote: '「唔？！这个味道……和我想象的清雅茶饮不太一样呢，不过作为平民咖啡馆的创意，我也勉强收下了！」'
            }
          },
          nightTalk: [
            {
              text: '「其实在学生会里，大家都以为我什么都能轻松搞定……只有在你的吧台前，我才能稍微叹口气呢。」',
              reply: '四宫辉夜轻轻捧着茶杯，耳尖微红：「笨蛋店长……这么温柔的话，我会不想回家的。」',
              bonusAffection: 15
            },
            {
              text: '「下次如果预算案还这么繁琐，我提前给你留好角落的专座和热茶巾。」',
              reply: '四宫辉夜唇角扬起一抹骄傲又羞怯的弧度：「这可是你主动邀请我的哦！一言为定！」',
              bonusAffection: 18
            }
          ]
        }
      ],
      postcard: '“雨声很吵，但你递过来的茶杯很暖。下次学生会散会晚了，我还坐这个位置。” —— 四宫辉夜'
    },
    {
      id: 'marin',
      name: '喜多川海梦',
      role: '闪耀Cosplay搭档少女',
      preferredShifts: ['dusk', 'rain'],
      avatar: 'assets/cafe/characters/avatar_marin.webp',
      expressions: {
        normal: 'assets/cafe/characters/marin_normal.webp',
        smile: 'assets/cafe/characters/marin_smile.webp',
        shy: 'assets/cafe/characters/marin_shy.webp',
        blush: 'assets/cafe/characters/marin_blush.webp',
        tease: 'assets/cafe/characters/marin_tease.webp',
        surprise: 'assets/cafe/characters/marin_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/marin_normal.webp',
        'assets/cafe/characters/marin_outfit2.webp',
        'assets/cafe/characters/marin_smile.webp',
        'assets/cafe/characters/marin_blush.webp'
      ],
      smallTalks: [
        '「哇——店长你看！窗外的霓虹灯映在玻璃雨滴上，这个柔焦光斑拍进Cos正片里绝了！」',
        '「嘿嘿，刚试完新假发就跑过来了，店长觉得我今天的发梢卷度超可爱对吧？」',
        '「每次闻到你吧台里的焦糖香，我就觉得减肥计划可以明天再开始啦～」'
      ],
      orders: [
        {
          title: '《外景收工！双倍草莓雪顶冰饮》',
          promptHtml: '「刚拍完外景累瘫啦！店长，我要一杯<strong>冰爽的、双倍甜蜜、顶上还要加漂亮奶油与草莓</strong>的特调！」',
          temp: 'iced',
          idealBases: ['sparkling', 'warm_milk', 'cocoa'],
          idealAddons: ['raspberry', 'vanilla_cream', 'honey'],
          dislikedAddons: [],
          favoriteStencil: 'heart',
          clues: [
            '🌡️ 温度：🧊 冰饮 (Iced)',
            '🫧 基底：清爽气泡苏打 / 北海道鲜牛乳',
            '🍓 风味：覆盆子草莓果露 + 香草奶油顶 + 野生蜂蜜'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「呜哇——超、级、好、喝！！冰爽的气泡加上酸甜草莓果露和厚厚的香草奶油，店长你简直是神仙吧！快让我拍张照发动态！」'
            },
            good: {
              expr: 'blush',
              quote: '「嘿嘿，冰冰甜甜的好治愈！拍外景的疲惫一下子飞走啦，谢谢店长搭档～」'
            },
            try: {
              expr: 'surprise',
              quote: '「诶？！这杯是店长的新概念暗黑料理吗？哈哈不过只要是你调的，我全都能喝光光哦！」'
            }
          },
          nightTalk: [
            {
              text: '「把相机给我看看吧，今天拍的几百张底片，我们边喝边挑。」',
              reply: '喜多川海梦凑到吧台前，肩膀几乎贴着你的手臂：「嘿嘿，你看这一张——我对着镜头笑的时候，其实一直在看你哦！」',
              bonusAffection: 18
            },
            {
              text: '「嘴角沾到一点香草奶油了，给，用这张纸巾擦擦。」',
              reply: '海梦脸颊微烫地吐了吐舌头：「哇啊好丢脸！不过被你这么照顾的感觉……超级赖皮地让人心动诶！」',
              bonusAffection: 16
            }
          ]
        }
      ],
      postcard: '“最喜欢收工后冲进你的咖啡馆啦！奶油要双倍，见到你的开心也是双倍☆” —— 喜多川海梦'
    },
    {
      id: 'utaha',
      name: '霞之丘诗羽',
      role: '畅销轻小说家·霞诗子',
      preferredShifts: ['late', 'rain'],
      avatar: 'assets/cafe/characters/avatar_utaha.webp',
      expressions: {
        normal: 'assets/cafe/characters/utaha_normal.webp',
        smile: 'assets/cafe/characters/utaha_smile.webp',
        shy: 'assets/cafe/characters/utaha_shy.webp',
        blush: 'assets/cafe/characters/utaha_blush.webp',
        tease: 'assets/cafe/characters/utaha_tease.webp',
        surprise: 'assets/cafe/characters/utaha_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/utaha_normal.webp',
        'assets/cafe/characters/utaha_outfit2.webp',
        'assets/cafe/characters/utaha_blush.webp'
      ],
      smallTalks: [
        '「呵呵，店长君盯着我看的眼神……是想成为我下一卷恋爱小说里的男主角原型吗？」',
        '「编辑催稿的电话已经被我关机了。今晚打烊前，我可不会轻易离开这张高脚凳哦。」',
        '「雨夜、爵士电钢琴、还有沉默温柔的调酒师……真是绝佳的私奔取材地呢。」'
      ],
      orders: [
        {
          title: '《截稿日前夜的焦糖深烘》',
          promptHtml: '「截稿日前的凌晨……需要一杯<strong>苦度拉满、能瞬间击穿睡意，但尾韵有一点点焦糖温柔</strong>的深烘咖啡。」',
          temp: 'hot',
          idealBases: ['espresso'],
          idealAddons: ['caramel', 'cinnamon'],
          dislikedAddons: ['raspberry'],
          favoriteStencil: 'swan',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '☕ 基底：深烘意式浓缩 (Espresso)',
            '🍯 风味：焦糖糖浆 + 肉桂粉'
          ],
          reactions: {
            perfect: {
              expr: 'tease',
              quote: '「先是深烘浓缩毫不留情的苦涩，随后焦糖与肉桂的暖意在舌尖慢慢化开……呵呵，店长君，你比谁都懂怎么驯服一个挑剔的作家呢。」'
            },
            good: {
              expr: 'smile',
              quote: '「咖啡因浓度合格了，焦糖的分量也很克制。看来今晚最后三千字的后记，得把你的名字写进致谢栏了。」'
            },
            try: {
              expr: 'surprise',
              quote: '「哎呀，这杯饮品的剧情走向有点出乎意料呢……你是想用味觉冲击帮我激发大结局灵感吗？」'
            }
          },
          nightTalk: [
            {
              text: '「新刊的结局已经想好了吗？需要我留着这盏钨丝灯陪你写完吗？」',
              reply: '霞之丘诗羽单手托腮，酒红色的眼眸在暖光下微微眯起：「只要我的第一读者还在吧台对面守着，女主角就一定会迎来最幸福的终章哦。」',
              bonusAffection: 18
            },
            {
              text: '「熬夜太多伤身体，喝完这杯深烘，我再送你一杯热牛奶。」',
              reply: '诗羽学姐轻声笑了出来：「真是霸道的店长君呢……那我就乖乖听话一次吧。」',
              bonusAffection: 15
            }
          ]
        }
      ],
      postcard: '“在截稿日的漫长黑夜里，唯有你手冲的焦糖深烘与那盏琥珀灯，是我不肯合上稿纸的理由。” —— 霞之丘诗羽'
    },
    {
      id: 'takagi',
      name: '高木同学',
      role: '邻座的捉弄系少女',
      preferredShifts: ['dusk', 'rain'],
      avatar: 'assets/cafe/characters/avatar_takagi.webp',
      expressions: {
        normal: 'assets/cafe/characters/takagi_normal.webp',
        smile: 'assets/cafe/characters/takagi_smile.webp',
        shy: 'assets/cafe/characters/takagi_shy.webp',
        blush: 'assets/cafe/characters/takagi_blush.webp',
        tease: 'assets/cafe/characters/takagi_tease.webp',
        surprise: 'assets/cafe/characters/takagi_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/takagi_normal.webp',
        'assets/cafe/characters/takagi_outfit2.webp',
        'assets/cafe/characters/takagi_smile.webp',
        'assets/cafe/characters/takagi_blush.webp'
      ],
      smallTalks: [
        '「呵呵，你刚才系围裙的时候往门口看了三次哦——是在等我推门进来吗？」',
        '「外面下雨了呢，而且我刚好没带伞……嗯？我是不是故意的？你猜猜看呀～」',
        '「能在放学后独享店长一个人的手冲吧台，感觉今天的小比赛已经是我赢了呢。」'
      ],
      orders: [
        {
          title: '《夕阳余晖的焦糖蜂蜜热牛乳》',
          promptHtml: '「呐，店长猜猜看我今天想喝什么？提示是——<strong>像夕阳一样暖洋洋、甜甜的牛奶特调</strong>哦～」',
          temp: 'hot',
          idealBases: ['warm_milk', 'cocoa'],
          idealAddons: ['caramel', 'honey', 'vanilla_cream'],
          dislikedAddons: ['mint'],
          favoriteStencil: 'paw',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🥛 基底：北海道鲜牛乳 / 法式可可',
            '🍯 风味：焦糖糖浆 + 野生蜂蜜（猫爪拉花更佳）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「哇，全中！温热的北海道牛乳加上焦糖和蜂蜜，连拉花都这么可爱……看来你平时一直在悄悄观察我的口味呢，店长～」'
            },
            good: {
              expr: 'tease',
              quote: '「嗯～暖洋洋的好好喝！虽然差一点点就满分了，不过看在你这么认真的份上，今晚就不捉弄你啦。」'
            },
            try: {
              expr: 'surprise',
              quote: '「噗嗤……原来在你眼里，夕阳是这个味道呀？呵呵，这下我可记住你的独特品味咯！」'
            }
          },
          nightTalk: [
            {
              text: '「我才没有特意记你的口味，只是刚好觉得这杯适合今天的你。」',
              reply: '高木双手捧着温热的瓷杯，眉眼弯弯：「是是～耳朵都红了还嘴硬呢。不过……谢谢你，真的好暖和。」',
              bonusAffection: 18
            },
            {
              text: '「等会儿打烊之后，我撑伞送你回商店街路口吧。」',
              reply: '高木微微一怔，随即露出带着一丝羞怯的灿烂笑容：「嗯！那……伞可要往我这边多倾斜一点点哦？」',
              bonusAffection: 20
            }
          ]
        }
      ],
      postcard: '“猜心比赛第99回合：你端出热牛奶的那一刻，其实是我心动得先认输了哦。” —— 高木'
    },
    {
      id: 'takako',
      name: '长瀞同学',
      role: '美术社的小恶魔后辈',
      preferredShifts: ['dusk', 'rain'],
      avatar: 'assets/cafe/characters/avatar_takako.webp',
      expressions: {
        normal: 'assets/cafe/characters/takako_normal.webp',
        smile: 'assets/cafe/characters/takako_smile.webp',
        shy: 'assets/cafe/characters/takako_shy.webp',
        blush: 'assets/cafe/characters/takako_blush.webp',
        tease: 'assets/cafe/characters/takako_tease.webp',
        surprise: 'assets/cafe/characters/takako_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/takako_normal.webp',
        'assets/cafe/characters/takako_outfit2.webp',
        'assets/cafe/characters/takako_smile.webp',
        'assets/cafe/characters/takako_blush.webp'
      ],
      smallTalks: [
        '「哈～？前辈穿上咖啡师围裙的样子，意外地还挺人模人样的嘛～杂鱼店长♪」',
        '「我才不是专门来看你的！只是美术社写生完刚好路过躲个雨而已啦！」',
        '「喂喂，拉花要是画得太丑，本小姐可是会在黑板上给你画乌龟的哦～」'
      ],
      orders: [
        {
          title: '《小恶魔的傲娇奶油热可可》',
          promptHtml: '「哼，大人的苦咖啡什么的本小姐才不需要呢！快给我来一杯<strong>热乎乎的、浓郁巧克力香、还要挤上厚厚香草奶油和酸甜莓果</strong>的特调啦！」',
          temp: 'hot',
          idealBases: ['cocoa', 'warm_milk'],
          idealAddons: ['vanilla_cream', 'raspberry', 'caramel'],
          dislikedAddons: [],
          favoriteStencil: 'paw',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🍫 基底：法式可可 (French Cocoa)',
            '🍦 风味：香草奶油顶 + 覆盆子果露'
          ],
          reactions: {
            perfect: {
              expr: 'blush',
              quote: '「唔……！！这、这个热可可也太浓郁了吧！奶油和树莓果露搭配得犯规级好喝……切，才、才没有夸你手艺好呢笨蛋前辈！」'
            },
            good: {
              expr: 'smile',
              quote: '「哼哼，勉强给你打个85分吧！看在你把可可调得这么香的份上，允许你坐我对面歇会儿～」'
            },
            try: {
              expr: 'tease',
              quote: '「哈～？前辈你是不是手抖放错料啦？真是杂鱼店长呢～不过本小姐大发慈悲帮你喝完就是了！」'
            }
          },
          nightTalk: [
            {
              text: '「慢点喝，鼻尖上都沾到一圈白胡子奶油了。」',
              reply: '长瀞慌忙用手背擦了擦鼻尖，小麦色的脸颊瞬间通红：「呜哇！看、看到就早说啊！不许笑！」',
              bonusAffection: 18
            },
            {
              text: '「画袋里的速写本湿了吗？放到吧台暖灯旁边烘一下吧。」',
              reply: '长瀞紧紧按住速写本一角，眼神躲闪：「不行！里面画的都是前辈……啊不对，什么都没有啦！」',
              bonusAffection: 16
            }
          ]
        }
      ],
      postcard: '“哼，你的咖啡馆座椅还算舒服，热可可也勉强及格……明天放学我还会来突击检查的！” —— 长瀞'
    },
    {
      id: 'yukino',
      name: '雪之下雪乃',
      role: '侍奉部部长·清冷爱猫家',
      preferredShifts: ['rain', 'late'],
      avatar: 'assets/cafe/characters/avatar_yukino.webp',
      expressions: {
        normal: 'assets/cafe/characters/yukino_normal.webp',
        smile: 'assets/cafe/characters/yukino_smile.webp',
        shy: 'assets/cafe/characters/yukino_shy.webp',
        blush: 'assets/cafe/characters/yukino_blush.webp',
        tease: 'assets/cafe/characters/yukino_tease.webp',
        surprise: 'assets/cafe/characters/yukino_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/yukino_normal.webp',
        'assets/cafe/characters/yukino_outfit2.webp',
        'assets/cafe/characters/yukino_smile.webp',
        'assets/cafe/characters/yukino_blush.webp'
      ],
      smallTalks: [
        '「这家店的胡桃木书架与雨声很相衬……至少比吵闹的快餐店适合读完这本小说。」',
        '「店长，刚才窗台上好像有一只避雨的三花猫路过……你平时会在后门放猫粮吗？」',
        '「不用刻意找话题也没关系。听着你温杯和磨豆的声音，本身就很让人安心。」'
      ],
      orders: [
        {
          title: '《侍奉部窗边的宇治初雪抹茶》',
          promptHtml: '「雨夜容易让人精神松懈……请给我一杯<strong>温热的宇治一番抹茶，覆一层微咸绵密的海盐奶盖，如果能有猫咪或樱花的拉花</strong>就更好了。」',
          temp: 'hot',
          idealBases: ['matcha', 'black_tea'],
          idealAddons: ['cheese_foam', 'mint', 'honey'],
          dislikedAddons: [],
          favoriteStencil: 'paw',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🍵 基底：宇治一番抹茶 (Matcha)',
            '🧀 风味：海盐芝士奶盖 + 清凉薄荷（推荐🐾猫爪拉花）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「茶筅打出的抹茶泡沫细腻无颗粒，海盐奶盖更衬出茶汤的回甘……还有这个猫爪拉花，咳，非常可爱，谢谢你。」'
            },
            good: {
              expr: 'blush',
              quote: '「温度和水准都很稳定。能在雨夜喝到这样一杯抹茶，算是不虚此行了。」'
            },
            try: {
              expr: 'surprise',
              quote: '「颇具颠覆性的调配手法呢……虽然偏离了传统茶道，但我能感受到你的诚意。」'
            }
          },
          nightTalk: [
            {
              text: '「看到你盯着猫爪拉花舍不得喝的样子，这杯就当是店长特别招待吧。」',
              reply: '雪乃轻轻掩唇，眼底浮起柔和的微光：「被你看穿了吗……那下次我带锡兰茶饼来抵账吧。」',
              bonusAffection: 18
            },
            {
              text: '「我把吧台这一侧的阅读灯调亮了一点，慢慢看书就好。」',
              reply: '雪乃翻过一页书，声音轻柔：「谢谢。待在你的吧台前，时间总是过得格外快呢。」',
              bonusAffection: 16
            }
          ]
        }
      ],
      postcard: '“茶香澄澈，猫爪拉花也很精巧。这间雨夜里的木屋，是我愿意反复驻足的角落。” —— 雪乃'
    },
    {
      id: 'yui',
      name: '由比滨结衣',
      role: '元气暖心学姐',
      preferredShifts: ['dusk', 'rain'],
      avatar: 'assets/cafe/characters/avatar_yui.webp',
      expressions: {
        normal: 'assets/cafe/characters/yui_normal.webp',
        smile: 'assets/cafe/characters/yui_smile.webp',
        shy: 'assets/cafe/characters/yui_shy.webp',
        blush: 'assets/cafe/characters/yui_blush.webp',
        tease: 'assets/cafe/characters/yui_tease.webp',
        surprise: 'assets/cafe/characters/yui_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/yui_normal.webp',
        'assets/cafe/characters/yui_outfit2.webp',
        'assets/cafe/characters/yui_blush.webp'
      ],
      smallTalks: [
        '「呀哈喽～店长！一推门就闻到烤曲奇和红茶的香味，心一下子就静下来啦！」',
        '「其实我今天试着自己烤了蜂蜜饼干哦，等会儿配你的特调一起尝尝看嘛～」',
        '「坐在吧台最靠近你的位置，连窗外的冷雨都变得浪漫起来了呢。」'
      ],
      orders: [
        {
          title: '《放学团子屋的蜜香奶油红茶》',
          promptHtml: '「今天和大家逛完街有点冷呢……店长，我想喝一杯<strong>暖呼呼的大吉岭红茶，加一点野生蜂蜜和香草奶油，甜丝丝又温柔</strong>的那种！」',
          temp: 'hot',
          idealBases: ['black_tea', 'warm_milk'],
          idealAddons: ['honey', 'vanilla_cream', 'caramel'],
          dislikedAddons: [],
          favoriteStencil: 'heart',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🫖 基底：大吉岭红茶 (Black Tea)',
            '🐝 风味：野生蜂蜜 + 香草奶油顶（推荐💛倾心拉花）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「哇啊——就是这个味道！红茶里融化了蜂蜜和香草奶油，上面还有一颗爱心拉花……店长你这样会让我彻底宠坏的啦！」'
            },
            good: {
              expr: 'blush',
              quote: '「嗯～好暖和！手心贴着杯壁的时候，感觉整个人都被治愈了呢。」'
            },
            try: {
              expr: 'surprise',
              quote: '「诶嘿嘿，虽然和想象中不太一样，但有种奇妙的新鲜感呢！」'
            }
          },
          nightTalk: [
            {
              text: '「尝尝你带来的手作饼干吧，配这杯蜂蜜红茶刚好。」',
              reply: '由比滨眼睛一亮，连忙递过精致的包装袋：「真的吗？那……第一块我喂你吃好不好？嘿嘿～」',
              bonusAffection: 18
            },
            {
              text: '「不管什么时候累了，这个吧台永远给你留着热红茶。」',
              reply: '由比滨红着脸低下头，用手指轻轻勾住杯垫边缘：「嗯……那我以后每天放学都要来报到咯！」',
              bonusAffection: 16
            }
          ]
        }
      ],
      postcard: '“蜂蜜红茶的温度，还有你递杯子时指尖的触感，我都好好珍藏在日记里啦♡” —— 由比滨'
    },
    {
      id: 'qianhe',
      name: '椎名千鹤',
      role: '2年A班温柔班长',
      preferredShifts: ['dusk', 'late'],
      avatar: 'assets/cafe/characters/avatar_qianhe.webp',
      expressions: {
        normal: 'assets/cafe/characters/qianhe_normal.webp',
        smile: 'assets/cafe/characters/qianhe_smile.webp',
        shy: 'assets/cafe/characters/qianhe_shy.webp',
        blush: 'assets/cafe/characters/qianhe_blush.webp',
        tease: 'assets/cafe/characters/qianhe_tease.webp',
        surprise: 'assets/cafe/characters/qianhe_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/qianhe_normal.webp',
        'assets/cafe/characters/qianhe_outfit2.webp',
        'assets/cafe/characters/qianhe_smile.webp',
        'assets/cafe/characters/qianhe_blush.webp'
      ],
      smallTalks: [
        '「整理完班级日志已经这么晚了……推开咖啡馆木门看到你在，突然就松了一口气呢。」',
        '「我今天也带了咖啡师围裙哦，如果店长忙不过来，千鹤随时可以进吧台帮忙。」',
        '「在学校里必须时刻保持班长的端庄，只有在这里，才能卸下所有防备呢……」'
      ],
      orders: [
        {
          title: '《优等生班长的晚风蜂蜜肉桂热奶》',
          promptHtml: '「稍微有一点点疲惫呢……请给我一杯<strong>不含咖啡因、温润安神的北海道热牛乳，加一点野生蜂蜜与暖身的肉桂粉</strong>好吗？」',
          temp: 'hot',
          idealBases: ['warm_milk', 'cocoa'],
          idealAddons: ['honey', 'cinnamon', 'caramel'],
          dislikedAddons: [],
          favoriteStencil: 'sakura',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🥛 基底：北海道鲜牛乳 (Warm Milk)',
            '🐝 风味：野生蜂蜜 + 肉桂粉'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「好温柔的奶香……野生蜂蜜的清甜与肉桂的暖意顺着喉咙滑下去，连肩膀的酸痛都消失了。谢谢你，店长。」'
            },
            good: {
              expr: 'blush',
              quote: '「嗯，暖融融的很舒服……被你这样细心照顾，我会忍不住想向你撒娇的。」'
            },
            try: {
              expr: 'surprise',
              quote: '「啊……是很独特的风味呢！只要是你亲手调配的，千鹤都很喜欢。」'
            }
          },
          nightTalk: [
            {
              text: '「班长的工作不用一个人全扛着，在这里你只需要做你自己。」',
              reply: '千鹤眼眶微微温热，轻轻握住吧台边你的手指：「嗯……只有在你面前，我才敢说出“其实我也想被依靠”这样的话。」',
              bonusAffection: 19
            },
            {
              text: '「下次换上那套咖啡师围裙，我手把手教你拉天鹅奶泡吧。」',
              reply: '千鹤露出浅浅的羞涩笑意：「好呀，到时候请一定握着我的手慢慢教我哦。」',
              bonusAffection: 17
            }
          ]
        }
      ],
      postcard: '“放学后的胡桃木吧台，是我藏起所有秘密与心事的避风港。谢谢你一直都在。” —— 椎名千鹤'
    },
    {
      id: 'aili',
      name: '秋月爱莉',
      role: '嘴硬心软的金发少女',
      preferredShifts: ['dusk', 'rain'],
      avatar: 'assets/cafe/characters/avatar_aili.webp',
      expressions: {
        normal: 'assets/cafe/characters/aili_normal.webp',
        smile: 'assets/cafe/characters/aili_smile.webp',
        shy: 'assets/cafe/characters/aili_shy.webp',
        blush: 'assets/cafe/characters/aili_blush.webp',
        tease: 'assets/cafe/characters/aili_tease.webp',
        surprise: 'assets/cafe/characters/aili_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/aili_normal.webp',
        'assets/cafe/characters/aili_outfit2.webp',
        'assets/cafe/characters/aili_smile.webp',
        'assets/cafe/characters/aili_blush.webp'
      ],
      smallTalks: [
        '「哼！爱莉只是看雨下得太大，顺便进来监督你有没好好看店而已！」',
        '「吧台上的暖光灯还算有点品味啦……嘁，别用那种欣慰的眼神看着我！」',
        '「如果等会儿雨还不停，你可得负责把爱莉安全护送到家门口哦。」'
      ],
      orders: [
        {
          title: '《金发双马尾的绯红莓果海盐冰可可》',
          promptHtml: '「唔……走了好多路有点口渴。给我调一杯<strong>冰镇的法式可可，要加酸甜的覆盆子果露和咸甜的海盐芝士奶盖</strong>！不许偷工减料哦！」',
          temp: 'iced',
          idealBases: ['cocoa', 'sparkling'],
          idealAddons: ['raspberry', 'cheese_foam', 'vanilla_cream'],
          dislikedAddons: [],
          favoriteStencil: 'heart',
          clues: [
            '🌡️ 温度：🧊 冰饮 (Iced)',
            '🍫 基底：法式可可 (French Cocoa)',
            '🍓 风味：覆盆子果露 + 海盐芝士奶盖'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「唔嗯……！法式可可配覆盆子和海盐奶盖居然这么搭！哼，算你有点真本事啦，爱莉今天就给你打满分！」'
            },
            good: {
              expr: 'blush',
              quote: '「味道还行啦……看在你调得这么认真的份上，爱莉允许你摸一下头当奖励。」'
            },
            try: {
              expr: 'tease',
              quote: '「嘁，这是什么奇怪的配比呀笨蛋！算了，爱莉才不会浪费食物呢。」'
            }
          },
          nightTalk: [
            {
              text: '「给你热了一条干毛巾，先把淋湿的发梢擦干吧。」',
              reply: '爱莉接过温热的毛巾，小声嘟囔着红了耳根：「笨蛋……突然这么体贴的话，爱莉都不知道该怎么凶你了啦。」',
              bonusAffection: 18
            },
            {
              text: '「柜台里留了一块草莓千层，是专门给爱莉留的非卖品。」',
              reply: '爱莉眼睛瞬间亮晶晶的：「真、真的吗？！哼，那爱莉就勉为其难地全部吃掉咯！」',
              bonusAffection: 17
            }
          ]
        }
      ],
      postcard: '“虽然爱莉嘴上不说，但你调的树莓海盐可可真的是全世界第一好喝！不许给别人调一模一样的哦！” —— 爱莉'
    },
    {
      id: 'momo',
      name: '梦梦',
      role: '温室花房的王女殿下',
      preferredShifts: ['rain', 'late'],
      avatar: 'assets/cafe/characters/avatar_momo.webp',
      expressions: {
        normal: 'assets/cafe/characters/momo_normal.webp',
        smile: 'assets/cafe/characters/momo_smile.webp',
        shy: 'assets/cafe/characters/momo_shy.webp',
        blush: 'assets/cafe/characters/momo_blush.webp',
        tease: 'assets/cafe/characters/momo_tease.webp',
        surprise: 'assets/cafe/characters/momo_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/momo_normal.webp',
        'assets/cafe/characters/momo_outfit2.webp',
        'assets/cafe/characters/momo_blush.webp'
      ],
      smallTalks: [
        '「呵呵，窗台上的那盆蕨类植物长得很精神呢，看来店长也是个温柔细心的人。」',
        '「在打烊前的深夜和店长独处……总觉得像是开启了什么秘密计划一样令人期待呢～」',
        '「我从花房带了一小束夜来香放在吧台角，和你的咖啡香很配吧？」'
      ],
      orders: [
        {
          title: '《皇家温室的夜绽花蜜抹茶露》',
          promptHtml: '「今晚想喝一点带着植物芬芳的特调呢……请给我一杯<strong>温热的宇治一番抹茶，调入甘甜的野生蜂蜜与绯红覆盆子果露</strong>吧～」',
          temp: 'hot',
          idealBases: ['matcha', 'black_tea'],
          idealAddons: ['honey', 'raspberry', 'mint'],
          dislikedAddons: [],
          favoriteStencil: 'sakura',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '🍵 基底：宇治一番抹茶 (Matcha)',
            '🌸 风味：野生蜂蜜 + 覆盆子果露（推荐🌸樱吹雪拉花）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「多么迷人的层次感……抹茶的翠意里绽放出蜂蜜与覆盆子的果香，连樱花拉花都栩栩如生。店长，我越来越喜欢你这里了呢。」'
            },
            good: {
              expr: 'blush',
              quote: '「呵呵，草木与花蜜的气息很治愈呢。今晚的秘密计划，看来可以从这杯茶开始了～」'
            },
            try: {
              expr: 'surprise',
              quote: '「哎呀，这杯饮品就像未知的外星植物一样奇妙呢，不过我可不会讨厌你的创意哦。」'
            }
          },
          nightTalk: [
            {
              text: '「你总说秘密计划，到底是什么样的计划？」',
              reply: '梦梦笑吟吟地倾身越过半个吧台，压低声音：「当然是……让你今晚关店以后，眼里只有我一个人的计划呀～」',
              bonusAffection: 18
            },
            {
              text: '「谢谢你带来的夜来香，整个吧台都变得温柔起来了。」',
              reply: '梦梦指尖轻点唇瓣：「那作为回礼，下次请店长单独来我的温室花房喝下午茶吧？」',
              bonusAffection: 16
            }
          ]
        }
      ],
      postcard: '“花房里的夜露虽美，却不及你吧台前那盏琥珀灯下的茶香与凝视。” —— 梦梦'
    },
    {
      id: 'mai',
      name: '樱岛麻衣',
      role: '国民级人气女演员',
      preferredShifts: ['late', 'rain'],
      avatar: 'assets/cafe/characters/avatar_mai.webp',
      expressions: {
        normal: 'assets/cafe/characters/mai_normal.webp',
        smile: 'assets/cafe/characters/mai_smile.webp',
        shy: 'assets/cafe/characters/mai_shy.webp',
        blush: 'assets/cafe/characters/mai_blush.webp',
        tease: 'assets/cafe/characters/mai_tease.webp',
        surprise: 'assets/cafe/characters/mai_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/mai_normal.webp',
        'assets/cafe/characters/mai_outfit2.webp',
        'assets/cafe/characters/mai_smile.webp',
        'assets/cafe/characters/mai_blush.webp'
      ],
      smallTalks: [
        '「不用特意放低声音也没关系。在这间深夜咖啡馆里，我不是女演员，只是一直被你看见的普通客人。」',
        '「刚结束外景夜戏，手还有点凉……店长要借我温一下手吗？呵呵，开玩笑的。」',
        '「比起镁光灯下的宴会厅，还是你这里的胡桃木香气更让人安心。」'
      ],
      orders: [
        {
          title: '《国民女演员的深夜海盐焦糖拿铁》',
          promptHtml: '「拍完夜戏稍微有点犯困，但又不想太苦……请给我一杯<strong>温热的深烘意式浓缩，加上焦糖糖浆与微咸的海盐芝士奶盖</strong>吧。」',
          temp: 'hot',
          idealBases: ['espresso', 'black_tea'],
          idealAddons: ['caramel', 'cheese_foam', 'vanilla_cream'],
          dislikedAddons: [],
          favoriteStencil: 'moon',
          clues: [
            '🌡️ 温度：🔥 热饮 (Hot)',
            '☕ 基底：深烘意式浓缩 (Espresso)',
            '🧀 风味：焦糖糖浆 + 海盐芝士奶盖（推荐🌙弦月拉花）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「海盐芝士的微咸把焦糖拿铁的甜衬托得格外高级，弦月拉花也很有夜空的感觉……店长，今晚的特别演出奖颁给你了。」'
            },
            good: {
              expr: 'blush',
              quote: '「嗯，咖啡的醇厚和奶香平衡得很棒。喝完这一杯，明天早上的通告又有干劲了。」'
            },
            try: {
              expr: 'tease',
              quote: '「哦？店长是想用这种别出心裁的味道，让我在镜头前都忘不掉你吗？」'
            }
          },
          nightTalk: [
            {
              text: '「不管外面的世界喧嚣还是安静，只要你推开门，我永远第一眼看到你。」',
              reply: '樱岛麻衣怔了一瞬，眼眸中映着暖黄的钨丝灯光：「……真是犯规的台词呢。作为惩罚，今晚你要陪我聊到打烊为止哦。」',
              bonusAffection: 20
            },
            {
              text: '「夜戏辛苦了，我把Lo-Fi电钢琴调成最舒缓的夜曲吧。」',
              reply: '麻衣学姐轻轻托着腮，嘴角微扬：「有好听的曲子，还有懂我的咖啡师，今晚算是最棒的杀青宴了。」',
              bonusAffection: 16
            }
          ]
        }
      ],
      postcard: '“在漫长的夜戏收工后，唯有推开你这扇木门时的铃声，提醒着我被温柔注视的真实。” —— 樱岛麻衣'
    },
    {
      id: 'kuroneko',
      name: '五更琉璃',
      role: '夜魔女王·堕天圣黑猫',
      preferredShifts: ['late', 'rain'],
      avatar: 'assets/cafe/characters/avatar_kuroneko.webp',
      expressions: {
        normal: 'assets/cafe/characters/kuroneko_normal.webp',
        smile: 'assets/cafe/characters/kuroneko_smile.webp',
        shy: 'assets/cafe/characters/kuroneko_shy.webp',
        blush: 'assets/cafe/characters/kuroneko_blush.webp',
        tease: 'assets/cafe/characters/kuroneko_tease.webp',
        surprise: 'assets/cafe/characters/kuroneko_surprise.webp'
      },
      outfits: [
        'assets/cafe/characters/kuroneko_normal.webp',
        'assets/cafe/characters/kuroneko_outfit2.webp',
        'assets/cafe/characters/kuroneko_blush.webp'
      ],
      smallTalks: [
        '「哼哼……凡人，能在这座雨夜结界中接待夜魔女王，是你的荣幸……咳，今天的垫子还挺软的。」',
        '「我正在撰写《创世幻想谭》第七卷，需要充满魔力的暗夜圣水来补充魔力值！」',
        '「不、不要一直盯着我的猫耳发饰看啦！这是增幅咏唱灵感的魔导具而已！」'
      ],
      orders: [
        {
          title: '《堕天圣黑猫的暗夜深渊魔药》',
          promptHtml: '「契约者啊，为吾献上一杯<strong>冰镇的、漆黑如深渊的浓缩咖啡，再滴入绯红如血的覆盆子果露与觉醒灵魂的清凉薄荷</strong>吧！」',
          temp: 'iced',
          idealBases: ['espresso', 'sparkling'],
          idealAddons: ['raspberry', 'mint', 'cinnamon'],
          dislikedAddons: [],
          favoriteStencil: 'moon',
          clues: [
            '🌡️ 温度：🧊 冰饮 (Iced)',
            '☕ 基底：深烘意式浓缩 / 清爽气泡苏打',
            '🍓 风味：覆盆子果露 + 清凉薄荷（暗夜深渊莓果冰咖）'
          ],
          reactions: {
            perfect: {
              expr: 'smile',
              quote: '「库库库……深烘黑咖啡与绯红覆盆子、薄荷交织出的禁忌魔力，居然如此清爽惊艳！契约者……啊不对，店长，你太厉害了！」'
            },
            good: {
              expr: 'blush',
              quote: '「魔力值恢复了80%！那个……谢谢你听懂了我那些奇奇怪怪的点单台词。」'
            },
            try: {
              expr: 'surprise',
              quote: '「唔？！这杯混沌魔药的炼成阵似乎发生了变异……但作为契约的见证，吾会全部饮尽的！」'
            }
          },
          nightTalk: [
            {
              text: '「需要我用店长的炼金术，再给夜魔女王加一份月光拉花吗？」',
              reply: '五更琉璃瞬间羞红了脸，用设定集遮住半张脸：「笨、笨蛋！你配合得这么熟练，反而让我不好意思念台词了啦！」',
              bonusAffection: 18
            },
            {
              text: '「你的《创世幻想谭》写完这一章，可以让我当第一个读者吗？」',
              reply: '琉璃眼睛微微发亮，又故作矜持地轻咳一声：「既然契约者诚心请求……吾就特许你翻阅第一页吧。」',
              bonusAffection: 17
            }
          ]
        }
      ],
      postcard: '“以夜魔女王之名立下契约：今后每一个雨夜，此处的吧台王座皆归吾与汝共同守护。” —— 五更琉璃'
    }
  ];

  // ==================== 5. WebAudio Lo-Fi 电钢琴音乐盒 & 吧台拟音合成器 ====================
  class CafeAudioEngine {
    constructor() {
      this.ctx = null;
      this.musicEnabled = false;
      this.sfxEnabled = true;
      this.trackIndex = 0;
      this.loopTimer = null;
      this.bgmAudio = null;
      this.synthActive = false;
      this.pausedForHidden = false;
      this.chordStep = 0;
      this.tracks = [
        {
          name: '🎵 雨夜街角咖啡屋',
          url: 'assets/cafe/bgm/cafe_rain_night.mp3',
          tempoMs: 2100,
          // Dm9 -> G13 -> Cmaj9 -> A7alt 暖调 Lo-Fi 爵士和弦
          chords: [
            [293.66, 349.23, 440.00, 523.25, 659.25],
            [196.00, 349.23, 440.00, 493.88, 659.25],
            [261.63, 329.63, 392.00, 493.88, 587.33],
            [220.00, 329.63, 392.00, 466.16, 622.25]
          ]
        },
        {
          name: '🎵 放学后的黄昏拿铁',
          url: 'assets/cafe/bgm/cafe_sunset.mp3',
          tempoMs: 1950,
          // Fmaj7 -> Em7 -> Dm7 -> Cmaj9
          chords: [
            [174.61, 261.63, 329.63, 440.00, 523.25],
            [164.81, 246.94, 293.66, 392.00, 493.88],
            [146.83, 220.00, 293.66, 349.23, 440.00],
            [130.81, 261.63, 329.63, 392.00, 493.88]
          ]
        },
        {
          name: '🎵 打烊前的微醺慢板',
          url: 'assets/cafe/bgm/cafe_midnight.mp3',
          tempoMs: 2400,
          // Bbmaj7 -> Am7 -> Gm9 -> C9
          chords: [
            [233.08, 293.66, 349.23, 440.00, 587.33],
            [220.00, 261.63, 329.63, 392.00, 523.25],
            [196.00, 233.08, 293.66, 349.23, 440.00],
            [261.63, 329.63, 392.00, 466.16, 587.33]
          ]
        }
      ];
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    toggleMusic() {
      this.musicEnabled = !this.musicEnabled;
      if (this.musicEnabled) {
        this.startMusicLoop();
      } else {
        this.stopMusicLoop();
      }
      return this.musicEnabled;
    }

    nextTrack() {
      this.trackIndex = (this.trackIndex + 1) % this.tracks.length;
      this.chordStep = 0;
      if (this.musicEnabled) {
        this.stopMusicLoop();
        this.startMusicLoop();
      }
      return this.tracks[this.trackIndex];
    }

    startMusicLoop() {
      this.stopMusicLoop();
      const track = this.tracks[this.trackIndex];
      if (track && track.url) {
        try {
          const el = new Audio(track.url);
          el.loop = true;
          el.volume = 0.46;
          this.bgmAudio = el;
          const fallback = (err) => {
            // 切后台时 pause() 会让未完成的 play() 以 AbortError 拒绝，这不是加载失败
            if (err && err.name === 'AbortError') return;
            if (this.musicEnabled && this.bgmAudio === el) {
              this.bgmAudio = null;
              try {
                el.pause();
              } catch (_) {}
              this.startSynthFallbackLoop();
            }
          };
          el.addEventListener('error', () => fallback(), { once: true });
          // 404 / 解码失败：play() 拒绝或 audio 元素触发 error，均降级到合成器
          el.play().catch(fallback);
          return;
        } catch (_) {}
      }
      this.startSynthFallbackLoop();
    }

    startSynthFallbackLoop() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (this.loopTimer) {
        clearTimeout(this.loopTimer);
        this.loopTimer = null;
      }
      this.synthActive = true;
      const playStep = () => {
        if (!this.musicEnabled || this.pausedForHidden) return;
        const track = this.tracks[this.trackIndex];
        const chord = track.chords[this.chordStep % track.chords.length];
        this.playRhodesChord(chord, track.tempoMs / 1000);
        this.chordStep++;
        this.loopTimer = setTimeout(playStep, track.tempoMs);
      };
      playStep();
    }

    // 页面切到后台时暂停 BGM（mp3 与合成器），回到前台且 BGM 仍开启时恢复
    handleVisibilityChange(hidden) {
      if (hidden) {
        if (!this.musicEnabled || this.pausedForHidden) return;
        this.pausedForHidden = true;
        if (this.bgmAudio) {
          try {
            this.bgmAudio.pause();
          } catch (_) {}
        }
        if (this.loopTimer) {
          clearTimeout(this.loopTimer);
          this.loopTimer = null;
        }
        if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      } else {
        if (!this.pausedForHidden) return;
        this.pausedForHidden = false;
        if (!this.musicEnabled) return;
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        if (this.bgmAudio) {
          this.bgmAudio.play().catch(() => {});
        } else if (this.synthActive) {
          this.startSynthFallbackLoop();
        }
      }
    }

    stopMusicLoop() {
      this.synthActive = false;
      this.pausedForHidden = false;
      if (this.bgmAudio) {
        try {
          this.bgmAudio.pause();
          this.bgmAudio.currentTime = 0;
        } catch (_) {}
        this.bgmAudio = null;
      }
      if (this.loopTimer) {
        clearTimeout(this.loopTimer);
        this.loopTimer = null;
      }
    }

    // 温柔 Lo-Fi Rhodes 电钢琴和弦合成
    playRhodesChord(freqs, durationSec) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.setValueAtTime(1150, now);
      masterFilter.connect(ctx.destination);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        subOsc.type = 'triangle';
        // 轻微 Lo-Fi 磁带颤音偏移
        const detune = (Math.random() - 0.5) * 8;
        osc.frequency.setValueAtTime(f, now);
        osc.detune.setValueAtTime(detune, now);
        subOsc.frequency.setValueAtTime(f * 2, now);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.012, now);
        subOsc.connect(subGain);
        subGain.connect(gain);

        const noteDelay = idx * 0.045;
        const peakGain = idx === 0 ? 0.042 : 0.028;
        gain.gain.setValueAtTime(0.0001, now + noteDelay);
        gain.gain.linearRampToValueAtTime(peakGain, now + noteDelay + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec + 0.35);

        osc.connect(gain);
        gain.connect(masterFilter);

        osc.start(now + noteDelay);
        subOsc.start(now + noteDelay);
        osc.stop(now + durationSec + 0.4);
        subOsc.stop(now + durationSec + 0.4);
      });
    }

    // 拟音 1：磨豆声 (Grinder)
    playGrindSound() {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.42;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const mod = Math.sin(i * 0.045) * 0.6 + 0.4;
        data[i] = (Math.random() * 2 - 1) * mod;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(340, now);
      filter.Q.setValueAtTime(2.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.42);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    }

    // 拟音 2：蒸汽奶泡声 (Steam Wand)
    playSteamSound() {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.48;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1850, now);
      filter.Q.setValueAtTime(1.4, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.005, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    }

    // 拟音 3：冰块落杯清脆声 (Ice Clink)
    playIceClinkSound() {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [0, 0.09, 0.19].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const baseFreq = 1680 + i * 310;
        osc.frequency.setValueAtTime(baseFreq, now + offset);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.24, now + offset + 0.06);

        gain.gain.setValueAtTime(0.08, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
    }

    // 拟音 4：搅拌勺叮当声 (Spoon Stir Clink)
    playStirClinkSound() {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [2120, 2680].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = now + idx * 0.11;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.075, start);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.23);
      });
    }

    // 拟音 5：液体倾倒声 (Pouring Liquid)
    playPourSound() {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(690, now + 0.28);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    }

    // 拟音 6：奉茶黄铜铃声 (Serve Bell Ding!)
    playServeBellSound() {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const partials = [
        { freq: 1318.5, amp: 0.12, dur: 1.1 },
        { freq: 2637.0, amp: 0.06, dur: 0.8 },
        { freq: 3951.1, amp: 0.03, dur: 0.45 }
      ];
      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, now);
        gain.gain.setValueAtTime(p.amp, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + p.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + p.dur + 0.05);
      });
    }
  }

  const audio = new CafeAudioEngine();

  // ==================== 6. 游戏核心状态机 ====================
  const state = {
    shift: 'rain',
    night: 1,
    coins: 320,
    combo: 0, // 连续按时出餐连击数
    rushModeEnabled: true, // 多客耐心倒计时冲刺模式
    activeSeats: [], // 吧台当前排队的 1~3 位客人席位 [{ seatUid, heroineId, orderIdx, maxTime, timeLeft, status, reactionText, portraitOverride }]
    focusedSeatIdx: 0, // 当前瞄准制作的席位下标
    servedCount: 0, // 累计完成奉茶杯数，驱动 Lv.1 -> Lv.4 渐进解锁
    unlockAllProps: false, // 是否开启自由全解锁模式
    unlockedRecipes: ['rec_kaguya', 'rec_takagi'],
    heroineStats: {},
    currentHeroineId: 'kaguya',
    currentOrderIdx: 0,
    currentStep: 1,

    // 当前杯中调饮参数
    cup: {
      temp: 'hot',
      base: 'black_tea',
      addons: [], // 最多3项: [primary, secondary, topping]
      extractPos: 0,
      extractBonus: 0,
      extractGrade: '待冲泡',
      stencilUsed: null,
      latteStrokes: 0,
      latteBeautyScore: 0
    },

    // 萃取压力表动画状态
    brewingActive: false,
    brewAnimFrame: null,
    brewDir: 1
  };

  function getBaristaLevel() {
    if (state.unlockAllProps) return 4;
    if (state.servedCount >= 5) return 4;
    if (state.servedCount >= 3) return 3;
    if (state.servedCount >= 1) return 2;
    return 1;
  }

  function getUnlockedBases() {
    const lv = getBaristaLevel();
    return BASES.filter((b) => (b.unlockLevel || 1) <= lv);
  }

  function getUnlockedAddons() {
    const lv = getBaristaLevel();
    return ADDONS.filter((a) => (a.unlockLevel || 1) <= lv);
  }

  // 初始化12位女主统计
  function initHeroineStats() {
    HEROINES.forEach((h) => {
      if (!state.heroineStats[h.id]) {
        state.heroineStats[h.id] = {
          visits: h.id === 'kaguya' ? 1 : 0,
          affection: 35,
          unlockedPostcard: false,
          outfitIdx: 0
        };
      }
    });
  }

  function loadSavedState() {
    initHeroineStats();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
      if (isNum(parsed.night) && parsed.night >= 1) state.night = Math.floor(parsed.night);
      if (isNum(parsed.coins) && parsed.coins >= 0) state.coins = Math.floor(parsed.coins);
      if (isNum(parsed.servedCount) && parsed.servedCount >= 0) state.servedCount = Math.floor(parsed.servedCount);
      if (typeof parsed.unlockAllProps === 'boolean') state.unlockAllProps = parsed.unlockAllProps;
      if (Array.isArray(parsed.unlockedRecipes)) {
        const validIds = new Set(RECIPES.map((r) => r.id));
        state.unlockedRecipes = Array.from(
          new Set(['rec_kaguya', 'rec_takagi', ...parsed.unlockedRecipes])
        ).filter((id) => typeof id === 'string' && validIds.has(id));
      }
      if (parsed.heroineStats && typeof parsed.heroineStats === 'object') {
        Object.keys(parsed.heroineStats).forEach((k) => {
          const saved = parsed.heroineStats[k];
          if (!state.heroineStats[k] || !saved || typeof saved !== 'object') return;
          const cur = state.heroineStats[k];
          if (isNum(saved.visits) && saved.visits >= 0) cur.visits = Math.floor(saved.visits);
          if (isNum(saved.affection)) cur.affection = Math.max(0, Math.min(100, saved.affection));
          if (typeof saved.unlockedPostcard === 'boolean') cur.unlockedPostcard = saved.unlockedPostcard;
          if (isNum(saved.outfitIdx) && saved.outfitIdx >= 0) cur.outfitIdx = Math.floor(saved.outfitIdx);
        });
      }
      if (parsed.currentHeroineId && HEROINES.some((h) => h.id === parsed.currentHeroineId)) {
        state.currentHeroineId = parsed.currentHeroineId;
      }
    } catch (err) {
      console.warn('[MidnightCafe] 读取存档失败:', err);
    }
  }

  function saveState() {
    try {
      const payload = {
        night: state.night,
        coins: state.coins,
        servedCount: state.servedCount,
        unlockAllProps: state.unlockAllProps,
        unlockedRecipes: state.unlockedRecipes,
        heroineStats: state.heroineStats,
        currentHeroineId: state.currentHeroineId,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[MidnightCafe] 保存存档失败:', err);
    }
  }

  // ==================== 7. 双层动态窗景 Canvas (雨滴滑落 + 柔焦街灯 Bokeh + 吧台蒸汽粒子) ====================
  function initAmbientCanvases() {
    const rainCanvas = document.getElementById('window-rain-canvas');
    const steamCanvas = document.getElementById('steam-canvas');
    if (!rainCanvas || !steamCanvas) return;

    const rCtx = rainCanvas.getContext('2d');
    const sCtx = steamCanvas.getContext('2d');

    function resizeCanvases() {
      const rect = rainCanvas.parentElement.getBoundingClientRect();
      rainCanvas.width = rect.width || 480;
      rainCanvas.height = rect.height || 410;
      steamCanvas.width = rect.width || 480;
      steamCanvas.height = rect.height || 410;
    }
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    // 街灯柔焦光斑 (Bokeh Orbs)
    const bokehOrbs = Array.from({ length: 16 }, (_, i) => ({
      x: Math.random() * 480,
      y: 40 + Math.random() * 240,
      r: 18 + Math.random() * 34,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.12,
      phase: i * 0.7
    }));

    // 窗玻璃滑落雨滴与水痕 (Rain Streaks & Glass Droplets)
    const raindrops = Array.from({ length: 68 }, () => ({
      x: Math.random() * 480,
      y: Math.random() * 410,
      len: 12 + Math.random() * 20,
      speed: 1.4 + Math.random() * 2.4,
      thickness: 1 + Math.random() * 1.4,
      wiggle: Math.random() * Math.PI * 2
    }));

    // 吧台热咖啡蒸汽粒子 (Steam Particles)
    const steamParticles = Array.from({ length: 24 }, () => ({
      x: 380 + (Math.random() - 0.5) * 32,
      y: 345 - Math.random() * 90,
      r: 6 + Math.random() * 14,
      vy: 0.35 + Math.random() * 0.55,
      vx: (Math.random() - 0.5) * 0.3,
      alpha: 0.1 + Math.random() * 0.35
    }));

    function renderFrame(ts) {
      const shiftCfg = SHIFTS[state.shift] || SHIFTS.rain;
      const w = rainCanvas.width;
      const h = rainCanvas.height;

      rCtx.clearRect(0, 0, w, h);

      // 1. 绘制窗外街灯柔焦 Bokeh
      bokehOrbs.forEach((orb, idx) => {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -40) orb.x = w + 40;
        if (orb.x > w + 40) orb.x = -40;
        if (orb.y < 20) orb.y = 260;
        if (orb.y > 280) orb.y = 30;

        const pulse = 0.85 + 0.15 * Math.sin(ts * 0.0015 + orb.phase);
        const grad = rCtx.createRadialGradient(orb.x, orb.y, 2, orb.x, orb.y, orb.r * pulse);
        const color = shiftCfg.bokehColors[idx % shiftCfg.bokehColors.length];
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        rCtx.fillStyle = grad;
        rCtx.beginPath();
        rCtx.arc(orb.x, orb.y, orb.r * pulse, 0, Math.PI * 2);
        rCtx.fill();
      });

      // 2. 绘制滑落窗玻璃的晶莹雨滴与蜿蜒水痕
      const activeDrops = shiftCfg.rainDensity;
      rCtx.strokeStyle = 'rgba(245, 230, 211, 0.28)';
      rCtx.fillStyle = 'rgba(255, 240, 215, 0.48)';
      for (let i = 0; i < activeDrops; i++) {
        const d = raindrops[i];
        d.y += d.speed;
        d.x += Math.sin(ts * 0.003 + d.wiggle) * 0.35 - 0.25;
        if (d.y > h) {
          d.y = -20;
          d.x = Math.random() * w;
        }
        if (d.x < 0) d.x = w;

        rCtx.lineWidth = d.thickness;
        rCtx.beginPath();
        rCtx.moveTo(d.x, d.y);
        rCtx.lineTo(d.x + 1.8, d.y - d.len);
        rCtx.stroke();

        // 晶莹雨珠头部高光
        rCtx.beginPath();
        rCtx.arc(d.x, d.y, d.thickness * 1.15, 0, Math.PI * 2);
        rCtx.fill();
      }

      // 3. 绘制 Layer 2：吧台咖啡杯上方柔和升腾的蒸汽粒子
      sCtx.clearRect(0, 0, w, h);
      const isHot = state.cup.temp === 'hot';
      const baseSteamX = w - 68;
      const baseSteamY = h - 38;

      steamParticles.forEach((sp, idx) => {
        sp.y -= isHot ? sp.vy : sp.vy * 0.45;
        sp.x += Math.sin(ts * 0.002 + idx) * 0.28;
        sp.r += 0.04;
        sp.alpha -= 0.0022;

        if (sp.alpha <= 0.01 || sp.y < baseSteamY - 120) {
          sp.x = baseSteamX + (Math.random() - 0.5) * 24;
          sp.y = baseSteamY - Math.random() * 10;
          sp.r = 5 + Math.random() * 8;
          sp.alpha = isHot ? 0.32 : 0.18;
        }

        const sGrad = sCtx.createRadialGradient(sp.x, sp.y, 1, sp.x, sp.y, sp.r);
        if (isHot) {
          sGrad.addColorStop(0, `rgba(245, 230, 211, ${sp.alpha})`);
          sGrad.addColorStop(1, 'rgba(245, 230, 211, 0)');
        } else {
          sGrad.addColorStop(0, `rgba(168, 228, 240, ${sp.alpha})`);
          sGrad.addColorStop(1, 'rgba(168, 228, 240, 0)');
        }
        sCtx.fillStyle = sGrad;
        sCtx.beginPath();
        sCtx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        sCtx.fill();
      });

      requestAnimationFrame(renderFrame);
    }

    requestAnimationFrame(renderFrame);
  }

  // ==================== 8. Step 3 交互式圆形奶泡拉花画布 (Interactive Latte Art Canvas) ====================
  const latteArtController = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    brushColor: '#FFF8EE',
    brushMode: 'foam',
    brushSize: 8,
    lastX: 0,
    lastY: 0,

    init() {
      this.canvas = document.getElementById('latte-art-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.resetBaseCrema();
      this.bindEvents();
    },

    getBaseColor() {
      const baseObj = BASES.find((b) => b.id === state.cup.base) || BASES[0];
      return {
        outer: baseObj.color,
        inner: baseObj.cremaColor
      };
    },

    resetBaseCrema() {
      if (!this.ctx) return;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const colors = this.getBaseColor();

      this.ctx.clearRect(0, 0, w, h);

      // 圆形咖啡油脂底色 (Crema Base)
      const grad = this.ctx.createRadialGradient(cx, cy, 18, cx, cy, cx);
      grad.addColorStop(0, colors.inner);
      grad.addColorStop(0.72, colors.outer);
      grad.addColorStop(1, '#26140A');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
      this.ctx.clip();

      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);

      // 中央柔和奶泡底晕
      const foamCenter = this.ctx.createRadialGradient(cx, cy, 4, cx, cy, 48);
      foamCenter.addColorStop(0, 'rgba(245, 230, 211, 0.35)');
      foamCenter.addColorStop(1, 'rgba(245, 230, 211, 0)');
      this.ctx.fillStyle = foamCenter;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();

      state.cup.stencilUsed = null;
      state.cup.latteStrokes = 0;
      state.cup.latteBeautyScore = 60;
      this.updateLatteScoreUI();
    },

    bindEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: ((clientX - rect.left) / rect.width) * this.canvas.width,
          y: ((clientY - rect.top) / rect.height) * this.canvas.height
        };
      };

      const startDraw = (e) => {
        e.preventDefault();
        this.isDrawing = true;
        const pos = getPos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.drawSegment(pos.x, pos.y);
      };

      const moveDraw = (e) => {
        if (!this.isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        this.drawSegment(pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
      };

      const endDraw = () => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
      };

      this.canvas.addEventListener('mousedown', startDraw);
      this.canvas.addEventListener('mousemove', moveDraw);
      window.addEventListener('mouseup', endDraw);

      this.canvas.addEventListener('touchstart', startDraw, { passive: false });
      this.canvas.addEventListener('touchmove', moveDraw, { passive: false });
      window.addEventListener('touchend', endDraw);
    },

    drawSegment(x, y) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > cx - 8) return; // 限制在杯口圆内

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, cx - 4, 0, Math.PI * 2);
      this.ctx.clip();

      this.ctx.strokeStyle = this.brushColor;
      this.ctx.lineWidth = this.brushSize;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowColor = this.brushColor;
      this.ctx.shadowBlur = 4;

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.ctx.restore();

      state.cup.latteStrokes++;
      const strokeBonus = Math.min(36, Math.floor(state.cup.latteStrokes * 0.8));
      state.cup.latteBeautyScore = Math.max(state.cup.latteBeautyScore, 62 + strokeBonus);
      this.updateLatteScoreUI();
    },

    // 5款一键辅助拉花模具 (🐾 猫爪、💛 倾心、🌸 樱吹雪、🌙 弦月、🦢 天鹅)
    applyStencil(stencilId) {
      this.resetBaseCrema();
      const ctx = this.ctx;
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, cx - 4, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#FFF8EE';
      ctx.strokeStyle = '#FFF8EE';
      ctx.shadowColor = 'rgba(255, 248, 238, 0.55)';
      ctx.shadowBlur = 8;

      if (stencilId === 'paw') {
        // 🐾 猫爪肉球拉花
        ctx.beginPath();
        ctx.ellipse(cx, cy + 18, 34, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        const toes = [
          { x: cx - 38, y: cy - 16, r: 13 },
          { x: cx - 14, y: cy - 30, r: 14 },
          { x: cx + 14, y: cy - 30, r: 14 },
          { x: cx + 38, y: cy - 16, r: 13 }
        ];
        toes.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
          ctx.fill();
        });
        // 粉色小肉垫点缀
        ctx.fillStyle = '#F2A6B3';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 20, 18, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (stencilId === 'heart') {
        // 💛 倾心千层心拉花
        const drawHeart = (scale, color) => {
          ctx.save();
          ctx.translate(cx, cy + 6);
          ctx.scale(scale, scale);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, 32);
          ctx.bezierCurveTo(-48, 2, -52, -38, 0, -16);
          ctx.bezierCurveTo(52, -38, 48, 2, 0, 32);
          ctx.fill();
          ctx.restore();
        };
        drawHeart(1.25, '#FFF8EE');
        drawHeart(0.85, '#B87338');
        drawHeart(0.52, '#FFF8EE');
      } else if (stencilId === 'sakura') {
        // 🌸 樱吹雪五瓣樱花拉花
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI * 2) / 5);
          ctx.fillStyle = '#FFE6EC';
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.bezierCurveTo(-22, -28, -18, -62, -4, -56);
          ctx.lineTo(0, -48);
          ctx.lineTo(4, -56);
          ctx.bezierCurveTo(18, -62, 22, -28, 0, -8);
          ctx.fill();
          ctx.restore();
        }
        // 花蕊
        ctx.fillStyle = '#FFB347';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (stencilId === 'moon') {
        // 🌙 静夜弦月与星芒拉花
        ctx.fillStyle = '#FFF8EE';
        ctx.beginPath();
        ctx.arc(cx - 6, cy, 48, 0, Math.PI * 2);
        ctx.fill();

        const baseColors = this.getBaseColor();
        ctx.fillStyle = baseColors.inner;
        ctx.beginPath();
        ctx.arc(cx + 14, cy - 10, 40, 0, Math.PI * 2);
        ctx.fill();

        // 星芒点缀
        ctx.fillStyle = '#FFE3A0';
        [
          { x: cx + 28, y: cy - 26, r: 5 },
          { x: cx + 42, y: cy + 8, r: 3.5 },
          { x: cx + 16, y: cy + 28, r: 4 }
        ].forEach((star) => {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (stencilId === 'swan') {
        // 🦢 优雅天鹅拉花
        ctx.strokeStyle = '#FFF8EE';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        // 羽翼层叠
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(cx - 10, cy + 12, 42 - i * 8, Math.PI * 0.85, Math.PI * 1.75);
          ctx.stroke();
        }
        // 修长鹅颈
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy + 28);
        ctx.bezierCurveTo(cx + 36, cy + 8, cx + 32, cy - 38, cx + 6, cy - 42);
        ctx.bezierCurveTo(cx - 8, cy - 44, cx - 10, cy - 28, cx - 2, cy - 24);
        ctx.stroke();
      }

      ctx.restore();

      state.cup.stencilUsed = stencilId;
      state.cup.latteBeautyScore = 96;
      audio.playSteamSound();
      this.updateLatteScoreUI();
    },

    updateLatteScoreUI() {
      const score = state.cup.latteBeautyScore;
      const rank =
        score >= 92 ? 'S级 · 艺术品拉花' : score >= 78 ? 'A级 · 饱满美观' : 'B级 · 随性手绘';
      const numEl = document.getElementById('latte-beauty-num');
      const rankEl = document.getElementById('latte-beauty-rank');
      const chipEl = document.getElementById('chip-latte-score');
      if (numEl) numEl.textContent = String(score);
      if (rankEl) rankEl.textContent = rank;
      if (chipEl) chipEl.textContent = `🎨 拉花美观：${score}分 (${rank.split(' ')[0]})`;
    }
  };

  // ==================== 9. 多客排队倒计时系统、实时手把手引导与工作台交互 ====================
  function buildAdaptedOrder(heroine, orderIdx = 0) {
    const rawOrder = heroine.orders[orderIdx % heroine.orders.length];
    const lv = getBaristaLevel();
    const unlockedBases = getUnlockedBases();
    const unlockedAddons = getUnlockedAddons();

    const validBases = rawOrder.idealBases.filter((id) => unlockedBases.some((b) => b.id === id));
    // 用角色哈希让不同客人在同等级下点不同的已解锁茶底
    const fallbackBase = unlockedBases[(heroine.id.charCodeAt(0) + orderIdx) % unlockedBases.length] || unlockedBases[0];
    const finalBases = validBases.length ? validBases : [fallbackBase.id];

    const validAddons = rawOrder.idealAddons.filter((id) => unlockedAddons.some((a) => a.id === id));
    const maxAddonNeeded = lv === 1 ? 1 : 2;
    let finalAddons = validAddons.slice(0, maxAddonNeeded);
    if (finalAddons.length < maxAddonNeeded) {
      unlockedAddons.forEach((a) => {
        if (finalAddons.length < maxAddonNeeded && !finalAddons.includes(a.id)) {
          finalAddons.push(a.id);
        }
      });
    }

    const baseNames = finalBases.map((id) => BASES.find((b) => b.id === id)?.name).filter(Boolean).join(' / ');
    const addonNames = finalAddons.map((id) => ADDONS.find((a) => a.id === id)?.name).filter(Boolean).join(' + ');

    return {
      ...rawOrder,
      // Lv.1 时固定为热饮减少换杯复杂度，Lv.2+ 按原订单冷热
      temp: lv === 1 ? 'hot' : rawOrder.temp,
      idealBases: finalBases,
      idealAddons: finalAddons,
      requiredAddonCount: maxAddonNeeded,
      clues: [
        `🌡️ 温度：${(lv === 1 ? 'hot' : rawOrder.temp) === 'hot' ? '🔥 热饮陶瓷杯' : '🧊 冰饮玻璃杯'}`,
        `🫖 基底：${baseNames}`,
        `🌿 配料 (${maxAddonNeeded}项)：${addonNames}`
      ]
    };
  }

  function getTargetSeatCount() {
    const lv = getBaristaLevel();
    return lv === 1 ? 2 : 3; // 开局 2 位客人同台排队，Lv.2 起 3 位客人同台冲刺！
  }

  function createGuestSeat(preferredHeroineId = null, staggerSec = 0) {
    const activeIds = state.activeSeats.map((s) => s.heroineId);
    let heroine = preferredHeroineId ? HEROINES.find((h) => h.id === preferredHeroineId) : null;
    if (!heroine || activeIds.includes(heroine.id)) {
      const shiftPool = HEROINES.filter((h) => h.preferredShifts.includes(state.shift) && !activeIds.includes(h.id));
      const anyPool = HEROINES.filter((h) => !activeIds.includes(h.id));
      const pool = shiftPool.length ? shiftPool : anyPool;
      heroine = pool[Math.floor(Math.random() * pool.length)] || HEROINES[0];
    }
    const baseTime = getBaristaLevel() === 1 ? 65 : 52;
    const maxTime = baseTime + staggerSec;
    return {
      seatUid: `seat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      heroineId: heroine.id,
      orderIdx: 0,
      maxTime,
      timeLeft: maxTime,
      status: 'waiting', // 'waiting' | 'celebrating'
      celebrateBanner: '',
      quoteOverride: '',
      portraitOverride: ''
    };
  }

  function ensureCustomerSeats(forceAddOne = false) {
    const target = forceAddOne ? Math.min(3, state.activeSeats.length + 1) : getTargetSeatCount();
    while (state.activeSeats.length < target) {
      const idx = state.activeSeats.length;
      const preferred = idx === 0 ? state.currentHeroineId : null;
      state.activeSeats.push(createGuestSeat(preferred, idx * 9));
    }
    if (state.focusedSeatIdx >= state.activeSeats.length) {
      state.focusedSeatIdx = 0;
    }
    const focused = state.activeSeats[state.focusedSeatIdx];
    if (focused) {
      state.currentHeroineId = focused.heroineId;
    }
  }

  function getFocusedSeat() {
    ensureCustomerSeats();
    return state.activeSeats[state.focusedSeatIdx] || state.activeSeats[0];
  }

  function getCurrentHeroine() {
    const seat = getFocusedSeat();
    const hid = seat ? seat.heroineId : state.currentHeroineId;
    return HEROINES.find((h) => h.id === hid) || HEROINES[0];
  }

  function getCurrentOrder() {
    const seat = getFocusedSeat();
    const heroine = getCurrentHeroine();
    return buildAdaptedOrder(heroine, seat ? seat.orderIdx : 0);
  }

  function renderBaristaLevelHUD() {
    const lv = getBaristaLevel();
    const tagEl = document.getElementById('barista-lv-tag');
    const nextEl = document.getElementById('barista-lv-next');
    const toggleBtn = document.getElementById('btn-toggle-all-props');

    const levelTitles = {
      1: '🌱 Lv.1 见习吧台 (2客同台 · 2茶2料)',
      2: '☕ Lv.2 进阶茶咖 (3客同台 · 4茶4料)',
      3: '🍫 Lv.3 特调工坊 (3客同台 · 5茶6料)',
      4: '👑 Lv.4 深夜主理人 (3客同台 · 全器具满贯)'
    };
    const nextHints = {
      1: `再完成 ${Math.max(1, 1 - state.servedCount)} 杯 ➔ 解锁【意式浓缩 & 宇治抹茶 & 焦糖/蜂蜜】`,
      2: `再完成 ${Math.max(1, 3 - state.servedCount)} 杯 ➔ 解锁【法式可可 & 覆盆子果露/香草奶油】`,
      3: `再完成 ${Math.max(1, 5 - state.servedCount)} 杯 ➔ 解锁【气泡苏打 & 锡兰肉桂粉】`,
      4: `已解锁全部 6 款基底壶与 7 款配料瓶 (已服务 ${state.servedCount} 杯)`
    };

    if (tagEl) tagEl.textContent = levelTitles[lv] || levelTitles[1];
    if (nextEl) nextEl.textContent = state.unlockAllProps ? '自由全开模式 · 全部器具已摆上吧台' : nextHints[lv];
    if (toggleBtn) {
      toggleBtn.textContent = state.unlockAllProps ? '🌱 切回渐进解锁' : '🔓 解锁全部器具';
    }
  }

  function renderTopStats() {
    document.getElementById('stat-night').textContent = String(state.night);
    document.getElementById('stat-coins').textContent = String(state.coins);
    document.getElementById('stat-recipes').textContent = String(state.unlockedRecipes.length);
    const comboEl = document.getElementById('stat-combo');
    if (comboEl) comboEl.textContent = `${state.combo}x`;
    renderBaristaLevelHUD();
  }

  function renderShiftEnvironment() {
    const cfg = SHIFTS[state.shift] || SHIFTS.rain;
    const backdrop = document.getElementById('scene-backdrop-img');
    const tint = document.getElementById('window-tint-layer');
    const wIcon = document.getElementById('weather-icon');
    const wText = document.getElementById('weather-text');

    if (backdrop) backdrop.src = cfg.sceneImg;
    if (tint) tint.style.background = cfg.tint;
    if (wIcon) wIcon.textContent = cfg.weatherIcon;
    if (wText) wText.textContent = cfg.weatherText;

    document.querySelectorAll('.shift-pill').forEach((btn) => {
      const active = btn.dataset.shift === state.shift;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
  }

  // 渲染多席位吧台客人 (1~3位客人并排点单 + 实时倒计时进度条 + 图标配方单)
  function renderMultiCustomerStage() {
    ensureCustomerSeats();
    const container = document.getElementById('multi-customer-stage');
    if (!container) return;

    container.innerHTML = state.activeSeats
      .map((seat, idx) => {
        const heroine = HEROINES.find((h) => h.id === seat.heroineId) || HEROINES[0];
        const hStat = state.heroineStats[heroine.id] || { visits: 1, affection: 35, outfitIdx: 0 };
        const order = buildAdaptedOrder(heroine, seat.orderIdx);
        const isFocused = idx === state.focusedSeatIdx;

        const portraitSrc =
          seat.portraitOverride ||
          heroine.outfits[hStat.outfitIdx % heroine.outfits.length] ||
          heroine.expressions.normal;

        const pct = Math.max(0, Math.min(100, Math.round((seat.timeLeft / seat.maxTime) * 100)));
        const timerColorClass = pct > 50 ? 'timer-green' : pct > 24 ? 'timer-amber' : 'timer-red';

        // 检查当前杯中配料是否已经满足该客人的各项需求
        const tempDone = state.cup.temp === order.temp;
        const reqBaseObj = BASES.find((b) => b.id === order.idealBases[0]) || BASES[0];
        const baseDone = order.idealBases.includes(state.cup.base);

        const reqAddonChips = order.idealAddons
          .map((aid) => {
            const aObj = ADDONS.find((x) => x.id === aid);
            if (!aObj) return '';
            const done = state.cup.addons.includes(aid);
            return `
              <span class="ticket-formula-chip ${done ? 'is-done' : ''}">
                <img src="${aObj.propImg}" alt="${aObj.name}" />
                <span>${aObj.name}</span>
                ${done ? '<strong class="chip-check">✓</strong>' : ''}
              </span>
            `;
          })
          .join('');

        const isFullyMatched =
          tempDone &&
          baseDone &&
          order.idealAddons.every((aid) => state.cup.addons.includes(aid));

        return `
          <div
            class="customer-seat-card ${isFocused ? 'is-focused-seat' : ''} ${isFullyMatched ? 'is-ready-to-serve' : ''} ${seat.status === 'celebrating' ? 'is-celebrating' : ''}"
            data-seat-idx="${idx}"
          >
            ${
              seat.celebrateBanner
                ? `<div class="seat-celebrate-burst">${seat.celebrateBanner}</div>`
                : ''
            }
            <div class="seat-portrait-col" data-drop-seat="${idx}">
              <img class="seat-heroine-img" src="${portraitSrc}" alt="${heroine.name}" draggable="false" />
              <div class="seat-drop-serve-badge">🛎️ 松手递给 ${heroine.name}！</div>
            </div>

            <div class="seat-ticket-col">
              <div class="seat-ticket-top">
                <div class="seat-guest-name-wrap">
                  <span class="seat-focus-dot">${isFocused ? '🎯 制作中' : `#${idx + 1} 候餐`}</span>
                  <strong class="seat-guest-name">${heroine.name}</strong>
                </div>
                <div class="seat-timer-pill ${timerColorClass}" data-seat-timer-pill="${idx}">
                  <span>⏱️</span>
                  <strong data-seat-sec="${idx}">${state.rushModeEnabled ? `${Math.ceil(seat.timeLeft)}s` : '∞'}</strong>
                </div>
              </div>

              <!-- 耐心倒计时进度条 -->
              <div class="seat-patience-track">
                <div
                  class="seat-patience-fill ${timerColorClass}"
                  data-seat-bar="${idx}"
                  style="width: ${state.rushModeEnabled ? pct : 100}%;"
                ></div>
              </div>

              <!-- 一目了然的图标配方小票 -->
              <div class="seat-visual-formula">
                <span class="ticket-formula-chip ${tempDone ? 'is-done' : ''}">
                  <span>${order.temp === 'hot' ? '🔥热杯' : '🧊冰杯'}</span>
                  ${tempDone ? '<strong class="chip-check">✓</strong>' : ''}
                </span>
                <span class="ticket-formula-chip ${baseDone ? 'is-done' : ''}">
                  <img src="${reqBaseObj.propImg}" alt="${reqBaseObj.name}" />
                  <span>${reqBaseObj.name}</span>
                  ${baseDone ? '<strong class="chip-check">✓</strong>' : ''}
                </span>
                ${reqAddonChips}
              </div>

              <div class="seat-ticket-footer">
                <span class="seat-short-quote">${seat.quoteOverride || `「想要一杯${order.title}」`}</span>
                <button type="button" class="seat-quick-serve-btn ${isFullyMatched ? 'ready-pulse' : ''}" data-quick-serve="${idx}">
                  🛎️ 奉茶
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.customer-seat-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('[data-quick-serve]')) return;
        const idx = Number(card.dataset.seatIdx);
        if (!Number.isNaN(idx) && state.activeSeats[idx]) {
          state.focusedSeatIdx = idx;
          state.currentHeroineId = state.activeSeats[idx].heroineId;
          renderMultiCustomerStage();
          updateLiveStepGuide();
        }
      });
    });

    container.querySelectorAll('[data-quick-serve]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.quickServe);
        serveDrinkToSeat(idx);
      });
    });
  }

  function renderHeroineAndOrder() {
    renderMultiCustomerStage();
    updateLiveStepGuide();
  }

  // ==================== 实时手把手发光指引引擎 (告诉玩家下一步该拿哪个壶/咖啡机怎么用) ====================
  function updateLiveStepGuide() {
    const guideTextEl = document.getElementById('live-step-guide-text');
    const order = getCurrentOrder();
    const heroine = getCurrentHeroine();

    // 清除旧的桌面发光高亮与浮动手指徽章
    document.querySelectorAll('.guide-target-glow').forEach((el) => el.classList.remove('guide-target-glow'));
    document.querySelectorAll('.prop-step-pointer-tag').forEach((el) => el.remove());

    const addPointerBadge = (el, text) => {
      if (!el) return;
      el.classList.add('guide-target-glow');
      const badge = document.createElement('span');
      badge.className = 'prop-step-pointer-tag';
      badge.textContent = text;
      el.appendChild(badge);
    };

    if (!order) return;

    // Step 1: 检查冷热杯是否匹配
    if (state.cup.temp !== order.temp) {
      const targetBtn =
        order.temp === 'iced'
          ? document.getElementById('btn-ice-bucket-scoop')
          : document.getElementById('btn-temp-hot');
      addPointerBadge(targetBtn, order.temp === 'iced' ? '👆 第1步：按住铲冰' : '👆 第1步：换热瓷杯');
      if (guideTextEl) {
        guideTextEl.innerHTML =
          order.temp === 'iced'
            ? `<strong>${heroine.name}</strong> 想要冰饮：请按住左侧闪金光的<strong>【🥄 黄铜冰桶】</strong>移到中央杯子铲入冰块！`
            : `<strong>${heroine.name}</strong> 想要热饮：请点击左侧闪金光的<strong>【🔥 热饮陶瓷杯】</strong>！`;
      }
      return;
    }

    // Step 2: 检查基底茶/咖啡是否匹配
    if (!order.idealBases.includes(state.cup.base)) {
      const targetBaseId = order.idealBases[0];
      const baseObj = BASES.find((b) => b.id === targetBaseId) || BASES[0];
      const baseBtn = document.querySelector(`[data-base-id="${targetBaseId}"]`);
      addPointerBadge(baseBtn, '👆 按住拿我倒茶!');
      if (targetBaseId === 'espresso') {
        const machineWrap = document.getElementById('btn-brew-hold');
        addPointerBadge(machineWrap, '👆 或按住咖啡机直萃!');
      }
      if (guideTextEl) {
        guideTextEl.innerHTML = `第 1 步：按住闪金光的<strong>【${baseObj.icon} ${baseObj.name}】</strong>移到正中央杯子上方倾倒！`;
      }
      return;
    }

    // Step 3: 检查配料是否加齐
    const missingAddonId = order.idealAddons.find((aid) => !state.cup.addons.includes(aid));
    if (missingAddonId) {
      const addonObj = ADDONS.find((a) => a.id === missingAddonId);
      const addonBtn = document.querySelector(`[data-addon-id="${missingAddonId}"]`);
      addPointerBadge(addonBtn, '👆 按住拿我加料!');
      if (guideTextEl && addonObj) {
        guideTextEl.innerHTML = `第 2 步：按住右侧闪金光的<strong>【${addonObj.icon} ${addonObj.name}】</strong>移到中央杯子加入配料！`;
      }
      return;
    }

    // Step 4: 基底与配料已全部配齐！引导使用左侧咖啡机拿 +25% 黄金加压暴击，或直接把中央杯子拖给客人！
    const cupEl = document.getElementById('center-draggable-cup');
    const machineEl = document.getElementById('btn-brew-hold');
    if (state.cup.extractBonus === 0) {
      addPointerBadge(machineEl, '👆 按住停金色区 +25%!');
      addPointerBadge(cupEl, `👆 做好啦! 拖给${heroine.name}`);
      if (guideTextEl) {
        guideTextEl.innerHTML = `✅ 配方已齐！可<strong>按住左侧【咖啡机】等指针走到金色区松手拿 +25% 暴击</strong>，或直接<strong>按住【中央杯子】往上拖给 ${heroine.name}</strong>！`;
      }
    } else {
      addPointerBadge(cupEl, `👆 按住拖给${heroine.name}!`);
      if (guideTextEl) {
        guideTextEl.innerHTML = `🌟 完美黄金特调已就绪！<strong>按住正中央的【饮品杯】直接往上拖给 ${heroine.name}</strong> 奉茶领赏金！`;
      }
    }
  }

  // 第一人称实体道具倾倒与落冰动态特效
  let pourFxTimer = null;
  function triggerPourAnimation(propImg, liquidColor) {
    const flyBox = document.getElementById('flying-pour-prop');
    const flyImg = document.getElementById('flying-pour-img');
    const stream = document.getElementById('pour-liquid-stream');
    const vessel = document.getElementById('live-cup-vessel');
    if (!flyBox || !flyImg || !stream) return;

    if (pourFxTimer) clearTimeout(pourFxTimer);
    flyImg.src = propImg;
    stream.style.background = `linear-gradient(180deg, ${liquidColor} 0%, rgba(255,255,255,0.45) 50%, ${liquidColor} 100%)`;
    stream.style.boxShadow = `0 0 14px ${liquidColor}`;

    flyBox.classList.remove('hidden', 'pouring-now');
    stream.classList.remove('hidden', 'streaming-now');
    void flyBox.offsetWidth;
    flyBox.classList.add('pouring-now');
    stream.classList.add('streaming-now');

    if (vessel) {
      vessel.classList.remove('cup-splash-bounce');
      void vessel.offsetWidth;
      vessel.classList.add('cup-splash-bounce');
    }

    pourFxTimer = setTimeout(() => {
      flyBox.classList.add('hidden');
      flyBox.classList.remove('pouring-now');
      stream.classList.add('hidden');
      stream.classList.remove('streaming-now');
    }, 680);
  }

  let iceFxTimer = null;
  function triggerIceScoopAnimation() {
    const iceFx = document.getElementById('falling-ice-fx');
    const vessel = document.getElementById('live-cup-vessel');
    if (!iceFx) return;
    if (iceFxTimer) clearTimeout(iceFxTimer);
    iceFx.classList.remove('hidden', 'dropping-now');
    void iceFx.offsetWidth;
    iceFx.classList.add('dropping-now');
    if (vessel) {
      vessel.classList.remove('cup-splash-bounce');
      void vessel.offsetWidth;
      vessel.classList.add('cup-splash-bounce');
    }
    iceFxTimer = setTimeout(() => {
      iceFx.classList.add('hidden');
      iceFx.classList.remove('dropping-now');
    }, 650);
  }

  function applyBaseSelection(id) {
    const bObj = BASES.find((x) => x.id === id);
    if (!bObj) return;
    state.cup.base = id;
    if (bObj.sfx === 'grind') audio.playGrindSound();
    else if (bObj.sfx === 'steam') audio.playSteamSound();
    else if (bObj.sfx === 'ice') audio.playIceClinkSound();
    else audio.playPourSound();

    triggerPourAnimation(bObj.propImg, bObj.cremaColor || bObj.color);
    renderStep1Ingredients();
    updateLiveChalkboardPreview();
    latteArtController.resetBaseCrema();
  }

  function applyAddonSelection(id, forceAddOnly = false) {
    const aObj = ADDONS.find((x) => x.id === id);
    if (!aObj) return;
    const existingIdx = state.cup.addons.indexOf(id);
    if (existingIdx !== -1 && !forceAddOnly) {
      state.cup.addons.splice(existingIdx, 1);
      audio.playStirClinkSound();
    } else if (existingIdx === -1) {
      if (state.cup.addons.length >= 3) {
        showToast('🍯 杯中最多可加入 3 段辅料/顶料，再次点击已加辅料瓶可撤回');
        return;
      }
      state.cup.addons.push(id);
      audio.playPourSound();
      triggerPourAnimation(aObj.propImg, aObj.color);
    } else {
      audio.playPourSound();
      triggerPourAnimation(aObj.propImg, aObj.color);
    }
    renderStep1Ingredients();
    updateLiveChalkboardPreview();
  }

  // ==================== 第一人称「按住左键拿起道具」实时跟随与杯口悬停倾倒引擎 ====================
  let activeGrab = null;

  function isPointInsideRect(x, y, el, pad = 18) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  }

  function startPointerGrabProp(e, grabInfo) {
    if (e.button !== undefined && e.button !== 0) return;
    // 已经拿着一个道具（多指触摸等）时忽略第二次按下，避免监听器泄漏与状态错乱
    if (activeGrab) return;
    e.preventDefault();

    const follower = document.getElementById('hand-held-prop-follower');
    const followerImg = document.getElementById('hand-held-prop-img');
    const followerStream = document.getElementById('hand-held-pour-stream');
    const followerLabel = document.getElementById('hand-held-prop-label');
    const centerDropzone = document.getElementById('center-prep-dropzone');
    const heroineBox = document.getElementById('heroine-stage-box');

    if (!follower || !followerImg) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const sourceEl = grabInfo.sourceEl;
    if (sourceEl) sourceEl.classList.add('is-picked-up-ghost');

    followerImg.src = grabInfo.propImg;
    if (followerLabel) followerLabel.textContent = grabInfo.label || '';
    if (followerStream) {
      followerStream.style.background = `linear-gradient(180deg, ${grabInfo.color || '#D48C46'} 0%, rgba(255,255,255,0.5) 50%, ${grabInfo.color || '#D48C46'} 100%)`;
      followerStream.style.boxShadow = `0 0 14px ${grabInfo.color || '#D48C46'}`;
      followerStream.classList.add('hidden');
    }

    follower.style.left = `${startX}px`;
    follower.style.top = `${startY}px`;
    follower.classList.remove('hidden', 'pouring-in-hand');

    if (grabInfo.kind === 'serve-cup') {
      document.querySelectorAll('.customer-seat-card').forEach((c) => c.classList.add('awaiting-serve-drop'));
      if (heroineBox) heroineBox.classList.add('awaiting-serve-drop');
    } else if (centerDropzone) {
      centerDropzone.classList.add('awaiting-prop-drop');
    }

    activeGrab = {
      ...grabInfo,
      startX,
      startY,
      lastX: startX,
      lastY: startY,
      movedDist: 0,
      overTarget: false,
      targetSeatIdx: null,
      pouredWhileHovering: false,
      hoverTimer: null
    };

    const onPointerMove = (ev) => {
      if (!activeGrab) return;
      if (ev.pointerId !== undefined && e.pointerId !== undefined && ev.pointerId !== e.pointerId) return;
      const cx = ev.clientX;
      const cy = ev.clientY;
      const dx = cx - activeGrab.lastX;
      activeGrab.movedDist = Math.hypot(cx - activeGrab.startX, cy - activeGrab.startY);
      activeGrab.lastX = cx;
      activeGrab.lastY = cy;

      follower.style.left = `${cx}px`;
      follower.style.top = `${cy}px`;

      if (activeGrab.kind === 'serve-cup') {
        let hitSeatIdx = null;
        document.querySelectorAll('.customer-seat-card').forEach((card) => {
          const hit = isPointInsideRect(cx, cy, card, 14);
          card.classList.toggle('hover-serve-drop', hit);
          if (hit) hitSeatIdx = Number(card.dataset.seatIdx);
        });
        activeGrab.overTarget = hitSeatIdx !== null;
        activeGrab.targetSeatIdx = hitSeatIdx;
        const tilt = Math.max(-14, Math.min(14, dx * 0.65));
        follower.style.setProperty('--hand-tilt', `${tilt}deg`);
      } else {
        const overCup = isPointInsideRect(cx, cy, centerDropzone, 20);
        activeGrab.overTarget = overCup;
        if (centerDropzone) centerDropzone.classList.toggle('drag-over-cup', overCup);

        if (overCup && (activeGrab.kind === 'base' || activeGrab.kind === 'addon' || activeGrab.kind === 'ice')) {
          follower.classList.add('pouring-in-hand');
          if (followerStream && activeGrab.kind !== 'ice') {
            followerStream.classList.remove('hidden');
          }
          // 悬停在杯口上方 240ms 即自动倾倒进杯子，直观有手感！
          if (!activeGrab.pouredWhileHovering && !activeGrab.hoverTimer) {
            activeGrab.hoverTimer = setTimeout(() => {
              if (!activeGrab || !activeGrab.overTarget) return;
              activeGrab.pouredWhileHovering = true;
              executeGrabAction(activeGrab, true);
            }, 240);
          }
        } else {
          follower.classList.remove('pouring-in-hand');
          if (followerStream) followerStream.classList.add('hidden');
          if (activeGrab.hoverTimer) {
            clearTimeout(activeGrab.hoverTimer);
            activeGrab.hoverTimer = null;
          }
          const tilt = Math.max(-18, Math.min(18, -8 + dx * 0.7));
          follower.style.setProperty('--hand-tilt', `${tilt}deg`);
        }
      }
    };

    const pointerId = e.pointerId;
    const onPointerUp = (ev) => {
      // 多指触摸时只响应拿起道具的那根手指
      if (ev && pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== pointerId) return;
      const cancelled = !!ev && ev.type === 'pointercancel';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (!activeGrab) return;
      const g = activeGrab;
      activeGrab = null;

      if (g.hoverTimer) clearTimeout(g.hoverTimer);
      if (g.sourceEl) g.sourceEl.classList.remove('is-picked-up-ghost');

      follower.classList.add('hidden');
      follower.classList.remove('pouring-in-hand');
      if (followerStream) followerStream.classList.add('hidden');
      if (centerDropzone) centerDropzone.classList.remove('drag-over-cup', 'awaiting-prop-drop');
      if (heroineBox) heroineBox.classList.remove('awaiting-serve-drop', 'hover-serve-drop');
      document.querySelectorAll('.customer-seat-card').forEach((c) => {
        c.classList.remove('awaiting-serve-drop', 'hover-serve-drop');
      });

      // pointercancel（系统手势/滚动抢占触摸）：只清理拖拽状态，不执行任何动作
      if (cancelled) return;
      // 如果悬停时已经倒进去了则不重复触发；如果是松手投放在目标上或原地轻点 (<14px) 则执行动作
      if (!g.pouredWhileHovering) {
        if (g.overTarget) {
          executeGrabAction(g, true);
        } else if (g.movedDist < 14 && g.kind !== 'serve-cup') {
          executeGrabAction(g, false);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function executeGrabAction(g, fromDropOnTarget) {
    if (g.kind === 'base') {
      applyBaseSelection(g.id);
    } else if (g.kind === 'addon') {
      applyAddonSelection(g.id, fromDropOnTarget);
    } else if (g.kind === 'ice') {
      state.cup.temp = 'iced';
      audio.playIceClinkSound();
      triggerIceScoopAnimation();
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
      showToast('🥄 哗啦！从黄铜冰桶铲入晶莹冰块，饮品已冰镇！');
    } else if (g.kind === 'temp-hot') {
      state.cup.temp = 'hot';
      audio.playSteamSound();
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
      showToast('🔥 已换上手作暖白陶瓷热饮杯 (65°C)');
    } else if (g.kind === 'temp-iced') {
      state.cup.temp = 'iced';
      audio.playIceClinkSound();
      triggerIceScoopAnimation();
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
      showToast('🧊 已换上高透棱纹冰饮玻璃杯 (4°C)');
    } else if (g.kind === 'latte-pitcher') {
      const m = document.getElementById('modal-latte-loupe');
      if (m) m.classList.remove('hidden');
      audio.playSteamSound();
    } else if (g.kind === 'serve-cup' && fromDropOnTarget) {
      serveDrinkToSeat(g.targetSeatIdx !== null ? g.targetSeatIdx : state.focusedSeatIdx);
    }
  }

  // 渲染第一人称吧台上的基底壶与糖浆按压瓶/顶料罐实体道具（按 Lv.1 ~ Lv.4 渐进解锁）
  function renderStep1Ingredients() {
    const baseGrid = document.getElementById('base-grid');
    const addonGrid = document.getElementById('addon-grid');
    if (!baseGrid || !addonGrid) return;

    const lv = getBaristaLevel();
    const unlockedBases = getUnlockedBases();
    const lockedBases = BASES.filter((b) => (b.unlockLevel || 1) > lv);
    const unlockedAddons = getUnlockedAddons();
    const lockedAddons = ADDONS.filter((a) => (a.unlockLevel || 1) > lv);

    // 若当前选中的基底尚未解锁，自动切回第一款已解锁基底
    if (!unlockedBases.some((b) => b.id === state.cup.base) && unlockedBases[0]) {
      state.cup.base = unlockedBases[0].id;
    }

    baseGrid.dataset.unlockedCount = String(unlockedBases.length);
    addonGrid.dataset.unlockedCount = String(unlockedAddons.length);

    const nextLockedBaseHtml = lockedBases.length
      ? `
        <div class="ing-card pov-prop-item locked-prop-teaser" title="继续完成客人订单升级吧台即可解锁【${lockedBases[0].name}】">
          <div class="pov-prop-thumb-wrap">
            <img class="pov-prop-img locked-silhouette" src="${lockedBases[0].propImg}" alt="待解锁" draggable="false" />
            <span class="lock-overlay-badge">🔒 Lv.${lockedBases[0].unlockLevel}</span>
          </div>
          <div class="ing-meta">
            <span class="ing-name">待解锁茶壶</span>
            <span class="ing-tags">${lockedBases[0].name}</span>
          </div>
        </div>
      `
      : '';

    baseGrid.innerHTML =
      unlockedBases
        .map((b) => {
          const isSelected = state.cup.base === b.id;
          return `
            <button
              type="button"
              class="ing-card pov-prop-item ${isSelected ? 'selected' : ''}"
              data-base-id="${b.id}"
              title="按住左键拿起【${b.name}】移到杯口倾倒：${b.desc}"
            >
              <div class="pov-prop-thumb-wrap">
                <img class="pov-prop-img" src="${b.propImg}" alt="${b.name}" draggable="false" />
                <span class="prop-color-dot" style="background:${b.color};"></span>
              </div>
              <div class="ing-meta">
                <span class="ing-name">${b.name}</span>
                <span class="ing-tags">${b.tags.slice(0, 2).join('·')}</span>
              </div>
              ${isSelected ? '<span class="ing-slot-badge">当前基底</span>' : ''}
            </button>
          `;
        })
        .join('') + nextLockedBaseHtml;

    const slotNames = ['主调', '辅调', '顶料'];
    const nextLockedAddonHtml = lockedAddons.length
      ? `
        <div class="ing-card pov-prop-item locked-prop-teaser" title="继续完成客人订单升级吧台即可解锁【${lockedAddons[0].name}】">
          <div class="pov-prop-thumb-wrap">
            <img class="pov-prop-img locked-silhouette" src="${lockedAddons[0].propImg}" alt="待解锁" draggable="false" />
            <span class="lock-overlay-badge">🔒 Lv.${lockedAddons[0].unlockLevel}</span>
          </div>
          <div class="ing-meta">
            <span class="ing-name">待解锁配料</span>
            <span class="ing-tags">${lockedAddons[0].name}</span>
          </div>
        </div>
      `
      : '';

    addonGrid.innerHTML =
      unlockedAddons
        .map((a) => {
          const idx = state.cup.addons.indexOf(a.id);
          const isSelected = idx !== -1;
          return `
            <button
              type="button"
              class="ing-card pov-prop-item ${isSelected ? 'selected' : ''}"
              data-addon-id="${a.id}"
              title="按住左键拿起【${a.name}】移到杯口加入：${a.desc}"
            >
              <div class="pov-prop-thumb-wrap">
                <img class="pov-prop-img" src="${a.propImg}" alt="${a.name}" draggable="false" />
                <span class="prop-color-dot" style="background:${a.color};"></span>
              </div>
              <div class="ing-meta">
                <span class="ing-name">${a.name}</span>
                <span class="ing-tags">${a.tags.slice(0, 2).join('·')}</span>
              </div>
              ${isSelected ? `<span class="ing-slot-badge">${slotNames[idx]}</span>` : ''}
            </button>
          `;
        })
        .join('') + nextLockedAddonHtml;

    const counterHint = document.getElementById('addon-counter-hint');
    if (counterHint) counterHint.textContent = `已加 ${state.cup.addons.length} / 3 项 (按住左键拿起倾倒)`;

    document.getElementById('btn-temp-hot').classList.toggle('active', state.cup.temp === 'hot');
    document.getElementById('btn-temp-iced').classList.toggle('active', state.cup.temp === 'iced');

    baseGrid.querySelectorAll('[data-base-id]').forEach((btn) => {
      const bObj = BASES.find((x) => x.id === btn.dataset.baseId);
      if (!bObj) return;
      btn.addEventListener('pointerdown', (e) => {
        startPointerGrabProp(e, {
          kind: 'base',
          id: bObj.id,
          label: `倾倒：${bObj.name}`,
          propImg: bObj.propImg,
          color: bObj.cremaColor || bObj.color,
          sourceEl: btn
        });
      });
    });

    addonGrid.querySelectorAll('[data-addon-id]').forEach((btn) => {
      const aObj = ADDONS.find((x) => x.id === btn.dataset.addonId);
      if (!aObj) return;
      btn.addEventListener('pointerdown', (e) => {
        startPointerGrabProp(e, {
          kind: 'addon',
          id: aObj.id,
          label: `加入：${aObj.name}`,
          propImg: aObj.propImg,
          color: aObj.color,
          sourceEl: btn
        });
      });
    });
  }

  // 根据当前基底+辅料动态推断饮品诗意名称与黑板杯身预览
  function computeCurrentDrinkTitle() {
    // 优先匹配18款秘密特调手账
    const matchedRecipe = RECIPES.find((r) => {
      if (r.temp !== state.cup.temp || r.base !== state.cup.base) return false;
      const hitCount = r.addons.filter((a) => state.cup.addons.includes(a)).length;
      return hitCount >= 2;
    });
    if (matchedRecipe) return { title: matchedRecipe.name, recipe: matchedRecipe };

    const baseObj = BASES.find((b) => b.id === state.cup.base) || BASES[0];
    const addonObjs = state.cup.addons.map((id) => ADDONS.find((a) => a.id === id)).filter(Boolean);
    const tempPrefix = state.cup.temp === 'hot' ? '暖心' : '冰萃';
    const addonPrefix = addonObjs.length
      ? addonObjs.map((a) => a.name.slice(0, 2)).join('')
      : '纯享';
    return {
      title: `${tempPrefix}·${addonPrefix}${baseObj.name}`,
      recipe: null
    };
  }

  function updateLiveChalkboardPreview() {
    const baseObj = BASES.find((b) => b.id === state.cup.base) || BASES[0];
    const addonObjs = state.cup.addons.map((id) => ADDONS.find((a) => a.id === id)).filter(Boolean);
    const drinkInfo = computeCurrentDrinkTitle();

    document.getElementById('live-drink-name').textContent = drinkInfo.title;

    // 实时填充黑板4个槽位
    const setSlot = (elId, label, filled) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.classList.toggle('filled', filled);
      const valEl = el.querySelector('.slot-val');
      if (valEl) valEl.textContent = label;
    };
    setSlot('slot-display-base', `${baseObj.icon} ${baseObj.name}`, true);
    setSlot(
      'slot-display-primary',
      addonObjs[0] ? `${addonObjs[0].icon} ${addonObjs[0].name}` : '未添加',
      Boolean(addonObjs[0])
    );
    setSlot(
      'slot-display-secondary',
      addonObjs[1] ? `${addonObjs[1].icon} ${addonObjs[1].name}` : '未添加',
      Boolean(addonObjs[1])
    );
    setSlot(
      'slot-display-topping',
      addonObjs[2] ? `${addonObjs[2].icon} ${addonObjs[2].name}` : '未添加',
      Boolean(addonObjs[2])
    );

    // 实时渲染杯子旁边的竖向分层容量进度条颜色与高度
    const layerBase = document.getElementById('layer-base');
    const layerPrimary = document.getElementById('layer-primary');
    const layerSecondary = document.getElementById('layer-secondary');
    const layerTopping = document.getElementById('layer-topping');
    const capPctEl = document.getElementById('cup-capacity-pct');

    const baseH = addonObjs.length === 0 ? 55 : addonObjs.length === 1 ? 52 : addonObjs.length === 2 ? 48 : 44;
    const p1H = addonObjs[0] ? (addonObjs.length === 1 ? 30 : 20) : 0;
    const p2H = addonObjs[1] ? 20 : 0;
    const p3H = addonObjs[2] ? 16 : 0;
    const totalPct = Math.min(100, baseH + p1H + p2H + p3H);

    if (layerBase) {
      layerBase.style.height = `${baseH}%`;
      layerBase.style.background = baseObj.color;
    }
    if (layerPrimary) {
      layerPrimary.style.height = `${p1H}%`;
      layerPrimary.style.background = addonObjs[0] ? addonObjs[0].color : 'transparent';
    }
    if (layerSecondary) {
      layerSecondary.style.height = `${p2H}%`;
      layerSecondary.style.background = addonObjs[1] ? addonObjs[1].color : 'transparent';
    }
    if (layerTopping) {
      layerTopping.style.height = `${p3H}%`;
      layerTopping.style.background = addonObjs[2] ? addonObjs[2].color : 'transparent';
    }
    if (capPctEl) {
      capPctEl.textContent = `${totalPct}%`;
    }

    // 冰块、热气与杯具真实立绘显隐
    const isIced = state.cup.temp === 'iced';
    const cupPropBg = document.getElementById('live-cup-prop-bg');
    if (cupPropBg) {
      cupPropBg.src = isIced
        ? 'assets/cafe/props/prop_cup_iced.webp'
        : 'assets/cafe/props/prop_cup_hot.webp';
    }
    const liveVessel = document.getElementById('live-cup-vessel');
    if (liveVessel) liveVessel.dataset.temp = state.cup.temp;
    document.getElementById('vessel-ice-cubes').classList.toggle('hidden', !isIced);
    document.getElementById('vessel-steam-wisps').classList.toggle('hidden', isIced);
    document.getElementById('vessel-temp-tag').textContent = isIced
      ? '🧊 4°C 冰爽玻璃杯'
      : '🔥 65°C 暖心陶瓷杯';

    const stencilEmojiMap = { paw: '🐾', heart: '💛', sakura: '🌸', moon: '🌙', swan: '🦢' };
    const topArtEl = document.getElementById('served-cup-art');
    if (topArtEl) {
      topArtEl.textContent = stencilEmojiMap[state.cup.stencilUsed] || baseObj.icon;
    }

    // 实时预测与当前客人点单契合度
    const order = getCurrentOrder();
    let forecastText = '✨ 风味调配中';
    if (order) {
      const tempOk = state.cup.temp === order.temp;
      const baseOk = order.idealBases.includes(state.cup.base);
      const addonHits = state.cup.addons.filter((a) => order.idealAddons.includes(a)).length;
      const neededAddons = order.requiredAddonCount || 2;
      if (tempOk && baseOk && addonHits >= neededAddons) {
        forecastText = '⭐⭐⭐ 契合度极高（直击心事！）';
      } else if (tempOk && (baseOk || addonHits >= 1)) {
        forecastText = '⭐⭐ 契合度良好';
      } else {
        forecastText = '💡 建议参考上方点单小票';
      }
    }
    document.getElementById('match-forecast-badge').textContent = forecastText;

    const allTags = [
      state.cup.temp === 'hot' ? '温热' : '冰爽',
      ...baseObj.tags,
      ...addonObjs.flatMap((a) => a.tags)
    ];
    document.getElementById('flavor-profile-preview').textContent =
      `当前风味画像：【${Array.from(new Set(allTags)).slice(0, 6).join(' · ')}】`;

    // 实时同步上方多客点单打勾状态与下方发光下一步手指指引
    renderMultiCustomerStage();
    updateLiveStepGuide();
  }

  // ==================== 10. 第一人称意式咖啡机高压黄金萃取 / 蒸汽加压控制 ====================
  function startExtractionMeter() {
    if (state.brewingActive) return;
    state.brewingActive = true;

    // 若当前选中客人需要意式浓缩基底，按住咖啡机直接将杯中基底切换为意式浓缩！
    const order = getCurrentOrder();
    const unlockedBases = getUnlockedBases();
    if (
      order &&
      order.idealBases.includes('espresso') &&
      unlockedBases.some((b) => b.id === 'espresso') &&
      state.cup.base !== 'espresso'
    ) {
      state.cup.base = 'espresso';
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
    }

    const holdBtn = document.getElementById('btn-brew-hold');
    const streamEl = document.getElementById('machine-espresso-stream');
    const textEl = document.getElementById('brew-btn-text');
    if (holdBtn) holdBtn.classList.add('brewing');
    if (streamEl) streamEl.classList.add('active');
    if (textEl) textEl.textContent = '👉 指针到金色区(62~78%)松手！';
    audio.playSteamSound();

    const tick = () => {
      if (!state.brewingActive) return;
      state.cup.extractPos += state.brewDir * 1.45;
      if (state.cup.extractPos >= 98) {
        state.cup.extractPos = 98;
        state.brewDir = -1;
      } else if (state.cup.extractPos <= 4) {
        state.cup.extractPos = 4;
        state.brewDir = 1;
      }
      updateExtractionUI();
      state.brewAnimFrame = requestAnimationFrame(tick);
    };
    state.brewAnimFrame = requestAnimationFrame(tick);
  }

  function stopExtractionMeter() {
    if (!state.brewingActive) return;
    state.brewingActive = false;
    if (state.brewAnimFrame) cancelAnimationFrame(state.brewAnimFrame);
    const holdBtn = document.getElementById('btn-brew-hold');
    const streamEl = document.getElementById('machine-espresso-stream');
    const textEl = document.getElementById('brew-btn-text');
    if (holdBtn) holdBtn.classList.remove('brewing');
    if (streamEl) streamEl.classList.remove('active');
    if (textEl) textEl.textContent = '☕ 按住加压 (+25%小费)';

    const pos = Math.round(state.cup.extractPos);
    if (pos >= 62 && pos <= 78) {
      state.cup.extractBonus = 25;
      state.cup.extractGrade = '✨ 完美黄金萃取 (+25%)';
      audio.playStirClinkSound();
      showToast('✨ 命中 92°C 黄金温区！本杯饮品获得 +25% 完美风味与小费暴击！');
    } else if (pos >= 50 && pos <= 86) {
      state.cup.extractBonus = 15;
      state.cup.extractGrade = '👍 良好均衡萃取 (+15%)';
      audio.playPourSound();
      showToast('👍 良好蒸汽加压 (+15% 风味加成)');
    } else {
      state.cup.extractBonus = 5;
      state.cup.extractGrade = pos < 50 ? '❄️ 偏淡微萃 (+5%)' : '🔥 浓郁深萃 (+5%)';
      audio.playPourSound();
    }
    updateExtractionUI();
    updateLiveStepGuide();
  }

  function updateExtractionUI() {
    const pos = Math.round(state.cup.extractPos);
    const needle = document.getElementById('meter-needle');
    if (needle) needle.style.left = `${pos}%`;
    document.getElementById('extract-pos-val').textContent = `${pos}%`;
    document.getElementById('extract-grade-val').textContent = state.cup.extractGrade;
    document.getElementById('extract-bonus-val').textContent = `+${state.cup.extractBonus}%`;
    document.getElementById('chip-extract-bonus').textContent =
      `⏱️ 萃取加成：+${state.cup.extractBonus}% (${state.cup.extractGrade.split(' ')[0]})`;
  }

  // ==================== 11. 多客快节奏奉茶结算、连击 COMBO 与自动换客 ====================
  function serveDrinkToSeat(targetSeatIdx = null) {
    ensureCustomerSeats();
    const sIdx =
      targetSeatIdx !== null && state.activeSeats[targetSeatIdx]
        ? targetSeatIdx
        : state.focusedSeatIdx;
    const seat = state.activeSeats[sIdx];
    // 庆祝中（1.5秒换客动画）的席位不能再次奉茶
    if (seat && seat.status !== 'waiting') return;
    state.focusedSeatIdx = sIdx;
    if (seat) state.currentHeroineId = seat.heroineId;
    serveDrinkToHeroine(sIdx);
  }

  function serveDrinkToHeroine(seatIdxOverride = null) {
    const sIdx =
      seatIdxOverride !== null && state.activeSeats[seatIdxOverride]
        ? seatIdxOverride
        : state.focusedSeatIdx;
    const seat = state.activeSeats[sIdx];
    // 防重复结算：只有正在候餐的客人才能被奉茶（庆祝动画期间忽略按钮与拖杯）
    if (seat && seat.status !== 'waiting') return;
    // 空杯（没加任何配料）不允许出餐
    if (!state.cup.addons || state.cup.addons.length === 0) {
      showToast('☕ 杯子还是空的～先挑几样配料加进杯里再奉茶吧！');
      return;
    }
    audio.playServeBellSound();

    const heroine = seat
      ? HEROINES.find((h) => h.id === seat.heroineId) || getCurrentHeroine()
      : getCurrentHeroine();
    const order = seat ? buildAdaptedOrder(heroine, seat.orderIdx) : getCurrentOrder();
    const drinkInfo = computeCurrentDrinkTitle();

    // 评分算法：温度(20) + 基底(30) + 辅料匹配(25) + 萃取加成(up to 25) + 拉花美观加分(up to 15)
    let rawScore = 0;
    const tempMatched = state.cup.temp === order.temp;
    if (tempMatched) rawScore += 22;

    const baseMatched = order.idealBases.includes(state.cup.base);
    if (baseMatched) rawScore += 32;

    const idealHits = state.cup.addons.filter((a) => order.idealAddons.includes(a)).length;
    const neededAddons = order.requiredAddonCount || 2;
    const perAddonScore = neededAddons === 1 ? 28 : 14;
    rawScore += Math.min(28, idealHits * perAddonScore);

    const dislikedHits = state.cup.addons.filter((a) =>
      (order.dislikedAddons || []).includes(a)
    ).length;
    rawScore -= dislikedHits * 10;

    // 萃取加成（若玩家未按萃取按钮则默认给 +12% 基础值）
    const extractAdd = state.cup.extractBonus || 12;
    rawScore += extractAdd;

    // 拉花或模具加成
    const latteScore = state.cup.latteBeautyScore || 70;
    const stencilBonus = state.cup.stencilUsed === order.favoriteStencil ? 8 : 0;
    rawScore += Math.round((latteScore - 50) * 0.25) + stencilBonus;

    const finalMatchPct = Math.max(45, Math.min(100, rawScore));

    let stars = '⭐⭐⭐';
    let tierKey = 'perfect';
    let verdictTitle = '完美惊艳 · 直抵心扉的深夜特调';
    let coinReward = 150;
    let affectionGain = 25;

    if (finalMatchPct >= 82) {
      stars = '⭐⭐⭐';
      tierKey = 'perfect';
      verdictTitle = '完美惊艳 · 直抵心扉的深夜特调';
      coinReward = 160;
      affectionGain = 25;
    } else if (finalMatchPct >= 62) {
      stars = '⭐⭐';
      tierKey = 'good';
      verdictTitle = '心满意足 · 温暖妥帖的吧台手冲';
      coinReward = 110;
      affectionGain = 15;
    } else {
      stars = '⭐';
      tierKey = 'try';
      verdictTitle = '奇妙尝试 · 出人意料的灵感碰撞';
      coinReward = 75;
      affectionGain = 8;
    }

    const reaction = order.reactions[tierKey];
    const exprKey = reaction.expr || 'smile';
    const newPortraitSrc = heroine.expressions[exprKey] || heroine.expressions.smile;

    // 切换吧台女主立绘与吧台小杯子展示
    const stagePortrait = document.getElementById('heroine-portrait-img');
    if (stagePortrait) {
      stagePortrait.src = newPortraitSrc;
      stagePortrait.classList.remove('react-bounce');
      void stagePortrait.offsetWidth;
      stagePortrait.classList.add('react-bounce');
    }

    const emotionMap = {
      smile: '😊 展颜微笑 (Smile)',
      blush: '😳 脸红心动 (Blush)',
      tease: '😏 微醺浅笑 (Tease)',
      surprise: '😮 惊喜睁眼 (Surprise)'
    };
    document.getElementById('emotion-bubble').textContent = emotionMap[exprKey] || '😊 心满意足';

    // 更新吧台杯垫
    const baseObj = BASES.find((b) => b.id === state.cup.base) || BASES[0];
    document.getElementById('served-cup-liquid').style.background =
      `radial-gradient(circle, ${baseObj.cremaColor} 25%, ${baseObj.color} 100%)`;
    const stencilEmojiMap = { paw: '🐾', heart: '💛', sakura: '🌸', moon: '🌙', swan: '🦢' };
    document.getElementById('served-cup-art').textContent =
      stencilEmojiMap[state.cup.stencilUsed] || baseObj.icon;
    document.getElementById('coaster-caption').textContent = drinkInfo.title;

    // 解锁特调配方与纪念明信片
    let newlyUnlockedRecipe = null;
    if (drinkInfo.recipe && !state.unlockedRecipes.includes(drinkInfo.recipe.id)) {
      state.unlockedRecipes.push(drinkInfo.recipe.id);
      newlyUnlockedRecipe = drinkInfo.recipe;
    }
    const heroRecipe = RECIPES.find((r) => r.heroineId === heroine.id);
    if (tierKey === 'perfect' && heroRecipe && !state.unlockedRecipes.includes(heroRecipe.id)) {
      state.unlockedRecipes.push(heroRecipe.id);
      newlyUnlockedRecipe = heroRecipe;
    }

    // 更新存档数据、连击 COMBO 与吧台渐进升级判定
    const prevLv = getBaristaLevel();
    state.servedCount += 1;
    if (tierKey === 'perfect' || tierKey === 'good') {
      state.combo += 1;
    } else {
      // 1星出餐与客人离开一致：连击清零
      state.combo = 0;
    }
    const comboBonus = state.combo > 1 ? (state.combo - 1) * 25 : 0;
    const totalEarned = coinReward + comboBonus;
    state.coins += totalEarned;

    const hStat = state.heroineStats[heroine.id];
    hStat.visits += 1;
    hStat.affection = Math.min(100, hStat.affection + affectionGain);
    if (tierKey === 'perfect' || hStat.visits >= 2) {
      hStat.unlockedPostcard = true;
    }
    const newLv = getBaristaLevel();
    saveState();
    renderTopStats();
    if (newLv > prevLv) {
      ensureCustomerSeats();
      renderStep1Ingredients();
      const unlockMsgs = {
        2: '🎉 吧台升至 Lv.2！开启【3位客人同台排队】，新解锁【意式浓缩壶、宇治抹茶碗、焦糖瓶、蜂蜜罐】！',
        3: '🎉 吧台升至 Lv.3！新解锁【法式热可可铜壶、覆盆子果露瓶、香草奶油喷枪】！',
        4: '👑 吧台升至 Lv.4 满级！新解锁【清爽气泡苏打虹吸瓶、锡兰肉桂粉筛罐】，全器具满贯！'
      };
      setTimeout(() => {
        showToast(unlockMsgs[newLv] || `🎉 吧台升级到 Lv.${newLv}！新茶壶与配料已摆上吧台！`);
      }, 450);
    }

    // 填充品鉴结算弹窗 (供悠闲模式或点击查看)
    document.getElementById('tasting-stars').textContent = stars;
    document.getElementById('tasting-verdict-title').textContent = verdictTitle;
    document.getElementById('tasting-subtitle').textContent =
      `口味契合度 ${finalMatchPct}% · 萃取加成 +${extractAdd}% · 连击 ${state.combo}x`;
    document.getElementById('tasting-heroine-img').src = newPortraitSrc;
    document.getElementById('tasting-expr-tag').textContent = emotionMap[exprKey] || '😊 展颜微笑';

    const snapCanvas = document.getElementById('tasting-latte-snapshot');
    if (snapCanvas && latteArtController.canvas) {
      const sCtx = snapCanvas.getContext('2d');
      sCtx.clearRect(0, 0, snapCanvas.width, snapCanvas.height);
      sCtx.drawImage(latteArtController.canvas, 0, 0, snapCanvas.width, snapCanvas.height);
    }

    const addonNames = state.cup.addons
      .map((id) => ADDONS.find((a) => a.id === id)?.name)
      .filter(Boolean);
    document.getElementById('tasting-recipe-badge').textContent = newlyUnlockedRecipe
      ? `🎉 新解锁特调手账：${newlyUnlockedRecipe.code}`
      : '☕ 深夜吧台手冲出品';
    document.getElementById('tasting-drink-title').textContent = drinkInfo.title;
    document.getElementById('tasting-drink-components').textContent =
      `${state.cup.temp === 'hot' ? '热饮' : '冰饮'} · ${baseObj.name}` +
      (addonNames.length ? ` + ${addonNames.join(' + ')}` : '');

    document.getElementById('tasting-score-breakdown').innerHTML = `
      <span class="score-pill">🌡️ 温度：${tempMatched ? '完美契合' : '别致反差'}</span>
      <span class="score-pill">☕ 基底：${baseMatched ? '正中心意' : '创意替换'}</span>
      <span class="score-pill">⏱️ 加压：+${extractAdd}%</span>
      <span class="score-pill">🔥 连击：${state.combo}x (+¥${comboBonus})</span>
    `;

    document.getElementById('tasting-quote-box').textContent = reaction.quote;
    document.getElementById('tasting-postcard-text').textContent = heroine.postcard;
    document.getElementById('tasting-reward-summary').textContent =
      `🪙 营业收入 +¥${totalEarned} · ♥ 羁绊好感 +${affectionGain}`;

    document.getElementById('dialogue-text').textContent = reaction.quote;
    renderNightTalkChoices(heroine, order);

    // 立即清空重置中央杯子，准备做下一位客人的单！（温度与基底一并复位，避免下一杯直接继承得分）
    state.cup.addons = [];
    state.cup.temp = 'hot';
    state.cup.base = (getUnlockedBases()[0] || BASES[0]).id;
    state.cup.extractBonus = 0;
    state.cup.extractPos = 8;
    state.cup.extractGrade = '待冲泡';
    latteArtController.resetBaseCrema();
    updateExtractionUI();

    if (state.rushModeEnabled && seat) {
      // 快节奏冲刺模式：不弹大弹窗打断节奏，直接在客人头顶炸出星级与赏金特效，1.5秒后自动迎来新客人！
      seat.status = 'celebrating';
      seat.portraitOverride = newPortraitSrc;
      seat.quoteOverride = reaction.quote;
      seat.celebrateBanner = `${stars} +¥${totalEarned} ${state.combo > 1 ? `· 🔥${state.combo}连击!` : ''}`;
      showToast(
        `${stars} ${heroine.name}：「${reaction.quote.slice(0, 26)}…」 收入 +¥${totalEarned}${
          newlyUnlockedRecipe ? ` · 解锁配方 ${newlyUnlockedRecipe.code}!` : ''
        }`
      );
      renderStep1Ingredients();
      updateLiveChalkboardPreview();

      const oldUid = seat.seatUid;
      setTimeout(() => {
        const curIdx = state.activeSeats.findIndex((s) => s.seatUid === oldUid);
        if (curIdx !== -1) {
          state.activeSeats[curIdx] = createGuestSeat(null, 4);
          // 自动将焦点切换到当前剩余时间最短的候餐客人
          let urgentIdx = 0;
          let minT = Infinity;
          state.activeSeats.forEach((s, i) => {
            if (s.status === 'waiting' && s.timeLeft < minT) {
              minT = s.timeLeft;
              urgentIdx = i;
            }
          });
          state.focusedSeatIdx = urgentIdx;
          state.currentHeroineId = state.activeSeats[urgentIdx].heroineId;
        }
        ensureCustomerSeats();
        renderStep1Ingredients();
        updateLiveChalkboardPreview();
      }, 1500);
    } else {
      // 悠闲夜谈模式：弹出完整品鉴与明信片结算卡
      if (seat) {
        state.activeSeats[sIdx] = createGuestSeat(null, 4);
      }
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
      document.getElementById('modal-tasting-result').classList.remove('hidden');
    }
  }

  function renderNightTalkChoices(heroine, order) {
    const box = document.getElementById('night-talk-choices');
    const list = document.getElementById('choices-list');
    if (!box || !list || !order.nightTalk) return;

    box.classList.remove('hidden');
    list.innerHTML = order.nightTalk
      .map(
        (item, idx) => `
        <button class="talk-choice-btn" data-talk-idx="${idx}">
          💬 ${item.text}
        </button>
      `
      )
      .join('');

    list.querySelectorAll('.talk-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.talkIdx);
        const item = order.nightTalk[idx];
        if (!item) return;
        audio.playStirClinkSound();
        document.getElementById('dialogue-text').textContent = item.reply;
        state.heroineStats[heroine.id].affection = Math.min(
          100,
          state.heroineStats[heroine.id].affection + (item.bonusAffection || 12)
        );
        state.coins += 30;
        saveState();
        renderTopStats();
        box.classList.add('hidden');
        showToast(`♥ 与 ${heroine.name} 深夜交心，羁绊好感 +${item.bonusAffection}，收到打赏小费 ¥30！`);
      });
    });
  }

  // ==================== 12. 18款秘密特调手账 & 12位女主名册弹窗 ====================
  function renderRecipeBookModal() {
    const grid = document.getElementById('recipe-book-grid');
    if (!grid) return;

    grid.innerHTML = RECIPES.map((r) => {
      const unlocked = state.unlockedRecipes.includes(r.id);
      const baseObj = BASES.find((b) => b.id === r.base);
      const addonNames = r.addons.map((id) => ADDONS.find((a) => a.id === id)?.name).filter(Boolean);
      const heroine = HEROINES.find((h) => h.id === r.heroineId);

      return `
        <div class="recipe-card ${unlocked ? 'unlocked' : ''}">
          <div class="recipe-card-head">
            <span class="recipe-num-tag">${r.code} ${heroine ? `· ${heroine.name}专属` : '· 馆藏特调'}</span>
            <span class="recipe-status-pill ${unlocked ? 'is-unlocked' : 'is-locked'}">
              ${unlocked ? '✓ 已收录' : '🔒 可按方试调'}
            </span>
          </div>
          <div class="recipe-title-with-thumb">
            <img class="recipe-drink-thumb" src="assets/cafe/drinks/${r.id}.webp" alt="${r.name}" loading="lazy" />
            <div>
              <h4>${r.name}</h4>
              <div class="recipe-formula-line">
                ${r.temp === 'hot' ? '🔥 热饮' : '🧊 冰饮'} · ${baseObj ? baseObj.name : ''} + ${addonNames.join(' + ')}
              </div>
            </div>
          </div>
          <p class="recipe-lore-text">${r.lore}</p>
          <div class="recipe-card-foot">
            <span style="font-size:11px;color:#A7C4B0;">推荐模具：${r.stencil.toUpperCase()}</span>
            <button class="clue-autofill-btn" data-load-recipe="${r.id}">
              ✨ 一键按方备料
            </button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-load-recipe]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = RECIPES.find((x) => x.id === btn.dataset.loadRecipe);
        if (!rec) return;
        state.cup.temp = rec.temp;
        state.cup.base = rec.base;
        state.cup.addons = [...rec.addons];
        if (!state.unlockedRecipes.includes(rec.id)) {
          state.unlockedRecipes.push(rec.id);
          saveState();
          renderTopStats();
        }
        renderStep1Ingredients();
        updateLiveChalkboardPreview();
        latteArtController.applyStencil(rec.stencil);
        document.getElementById('modal-recipe-book').classList.add('hidden');
        switchWorkbenchStep(1);
        showToast(`📖 已载入《${rec.name}》配方与拉花模具！`);
      });
    });
  }

  function renderGuestBookModal() {
    const grid = document.getElementById('guest-book-grid');
    if (!grid) return;

    grid.innerHTML = HEROINES.map((h) => {
      const st = state.heroineStats[h.id] || { visits: 0, affection: 35, unlockedPostcard: false };
      const shiftLabels = h.preferredShifts.map((s) => SHIFTS[s]?.name).join(' / ');
      return `
        <div class="guest-card">
          <div class="guest-card-top">
            <img class="guest-card-avatar" src="${h.avatar}" alt="${h.name}" />
            <div>
              <h4 style="color:var(--amber-glow);font-size:15px;">${h.name}</h4>
              <div style="font-size:11px;color:var(--foam-muted);">${h.role}</div>
              <div style="font-size:11px;color:#FF8DA1;margin-top:2px;">
                羁绊好感：${st.affection}% · 到店 ${st.visits} 次
              </div>
            </div>
          </div>
          <div style="font-size:11px;color:#A7C4B0;">常来时段：${shiftLabels}</div>
          <div class="guest-card-note">
            ${st.unlockedPostcard ? `💌 ${h.postcard}` : `💭 心事线索：${h.orders[0].title}（奉茶后解锁手写寄语）`}
          </div>
          <div class="guest-card-foot">
            <span style="font-size:11px;color:var(--foam-muted);">含 ${h.outfits.length} 套立绘造型</span>
            <button class="wood-action-btn" data-invite-heroine="${h.id}">
              🛎️ 邀约入座
            </button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-invite-heroine]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.inviteHeroine;
        inviteHeroineToCounter(id);
        document.getElementById('modal-guest-book').classList.add('hidden');
      });
    });
  }

  function inviteHeroineToCounter(heroineId) {
    const heroine = HEROINES.find((h) => h.id === heroineId);
    if (!heroine) return;
    ensureCustomerSeats();
    state.currentHeroineId = heroine.id;
    state.currentOrderIdx = 0;
    state.activeSeats[state.focusedSeatIdx] = createGuestSeat(heroine.id, 0);
    audio.playServeBellSound();
    saveState();
    renderHeroineAndOrder();
    updateLiveChalkboardPreview();
    switchWorkbenchStep(1);
    showToast(`🛎️ 铜铃轻响，${heroine.name}推开木门坐上了吧台！`);
  }

  // 多客耐心倒计时循环引擎 (每 250ms 刷新一次倒计时条，不重建 DOM)
  function startRushPatienceTicker() {
    setInterval(() => {
      if (!state.rushModeEnabled) return;
      // 如果有弹窗打开，则暂停倒计时，不惩罚正在看手账或拉花的玩家
      const anyModalOpen = Array.from(document.querySelectorAll('.cafe-modal-backdrop')).some(
        (m) => !m.classList.contains('hidden')
      );
      if (anyModalOpen) return;

      let expiredSeatIdx = -1;
      state.activeSeats.forEach((seat, idx) => {
        if (seat.status !== 'waiting') return;
        seat.timeLeft = Math.max(0, seat.timeLeft - 0.25);
        const pct = Math.max(0, Math.min(100, Math.round((seat.timeLeft / seat.maxTime) * 100)));
        const colorCls = pct > 50 ? 'timer-green' : pct > 24 ? 'timer-amber' : 'timer-red';

        const barEl = document.querySelector(`[data-seat-bar="${idx}"]`);
        const secEl = document.querySelector(`[data-seat-sec="${idx}"]`);
        const pillEl = document.querySelector(`[data-seat-timer-pill="${idx}"]`);
        if (barEl) {
          barEl.style.width = `${pct}%`;
          barEl.className = `seat-patience-fill ${colorCls}`;
        }
        if (secEl) {
          secEl.textContent = `${Math.ceil(seat.timeLeft)}s`;
        }
        if (pillEl) {
          pillEl.className = `seat-timer-pill ${colorCls}`;
        }

        if (seat.timeLeft <= 0 && expiredSeatIdx === -1) {
          expiredSeatIdx = idx;
        }
      });

      if (expiredSeatIdx !== -1) {
        const expSeat = state.activeSeats[expiredSeatIdx];
        const expHeroine = HEROINES.find((h) => h.id === expSeat.heroineId);
        state.combo = 0;
        renderTopStats();
        showToast(`⏰ ${expHeroine ? expHeroine.name : '客人'}等太久先走啦，连击中断！新客人已入座～`);
        state.activeSeats[expiredSeatIdx] = createGuestSeat(null, 5);
        renderMultiCustomerStage();
        updateLiveStepGuide();
      }
    }, 250);
  }

  function switchWorkbenchStep(stepNum) {
    state.currentStep = stepNum;
    document.querySelectorAll('.step-tab').forEach((tab) => {
      tab.classList.toggle('active', Number(tab.dataset.step) === stepNum);
    });
    document.querySelectorAll('.workbench-step-pane').forEach((pane) => {
      pane.classList.toggle('active', Number(pane.dataset.stepPane) === stepNum);
    });
  }

  function showToast(msg) {
    const container = document.getElementById('cafe-toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'cafe-toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3100);
  }

  // ==================== 13. 事件绑定与初始化入口 ====================
  function bindGlobalEvents() {
    // 1. 营业时段切换
    document.querySelectorAll('.shift-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newShift = btn.dataset.shift;
        if (!SHIFTS[newShift]) return;
        // 已处于该时段：什么也不做（避免重复累加营业夜数）
        if (newShift === state.shift) return;
        const prevShift = state.shift;
        state.shift = newShift;
        // 仅在「晚上雨夜档 → 白天晴朗档」（打烊后迎来新的一天）时营业夜数 +1
        if (prevShift === 'late' && newShift === 'dusk') state.night += 1;
        renderShiftEnvironment();
        renderTopStats();
        saveState();
        // 不替换正在候餐的客人（避免借切换时段躲过倒计时）；之后新入座的客人会按新时段的熟客池挑选
        showToast(`🕰️ 已切换到${SHIFTS[newShift].name}，之后入座的客人会是这个时段的熟客～`);
      });
    });

    // 2. Lo-Fi 音乐盒与拟音开关
    const lofiToggleBtn = document.getElementById('btn-lofi-toggle');
    const lofiNextBtn = document.getElementById('btn-lofi-next');
    const sfxToggleBtn = document.getElementById('btn-sfx-toggle');
    const vinylDisc = document.getElementById('vinyl-disc');
    const trackNameEl = document.getElementById('lofi-track-name');

    if (lofiToggleBtn) {
      lofiToggleBtn.addEventListener('click', () => {
        const on = audio.toggleMusic();
        vinylDisc.classList.toggle('spinning', on);
        const curTrack = audio.tracks[audio.trackIndex];
        trackNameEl.textContent = on ? curTrack.name : '🔇 BGM 已静音';
        showToast(on ? `🎶 开始播放：${curTrack.name}` : '🔇 已暂停背景音乐');
      });
    }
    // 切到后台标签页时暂停 BGM（mp3 / 合成器），回来后若 BGM 仍开启则继续播放
    document.addEventListener('visibilitychange', () => {
      audio.handleVisibilityChange(document.hidden);
    });
    if (lofiNextBtn) {
      lofiNextBtn.addEventListener('click', () => {
        const next = audio.nextTrack();
        if (!audio.musicEnabled) {
          audio.toggleMusic();
          vinylDisc.classList.add('spinning');
        }
        trackNameEl.textContent = next.name;
        showToast(`⏭️ 切换曲目：${next.name}`);
      });
    }
    if (sfxToggleBtn) {
      sfxToggleBtn.addEventListener('click', () => {
        audio.sfxEnabled = !audio.sfxEnabled;
        sfxToggleBtn.textContent = audio.sfxEnabled ? '🔔' : '🔕';
        showToast(audio.sfxEnabled ? '🔔 吧台拟音特效已开启' : '🔕 吧台拟音特效已静音');
      });
    }

    // 3. 左上/右上女主互动与教程、多客冲刺控制工具栏
    const tutBtn = document.getElementById('btn-open-tutorial');
    if (tutBtn) {
      tutBtn.addEventListener('click', () => {
        const m = document.getElementById('modal-how-to-play');
        if (m) m.classList.remove('hidden');
      });
    }
    // 首次访问自动弹出一次玩法教程（localStorage 不可用时静默跳过）
    try {
      const TUTORIAL_SEEN_KEY = 'pxlsan-game:arcade:cafe:tutorialSeen';
      if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) {
        const m = document.getElementById('modal-how-to-play');
        if (m) m.classList.remove('hidden');
        localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
      }
    } catch (_) {}

    const rushToggleBtn = document.getElementById('btn-toggle-rush-mode');
    if (rushToggleBtn) {
      rushToggleBtn.addEventListener('click', () => {
        state.rushModeEnabled = !state.rushModeEnabled;
        rushToggleBtn.textContent = state.rushModeEnabled ? '⏱️ 倒计时冲刺: ON' : '🌙 悠闲无限时间';
        rushToggleBtn.classList.toggle('active-rush-pill', state.rushModeEnabled);
        renderMultiCustomerStage();
        showToast(
          state.rushModeEnabled
            ? '⚡ 已开启【多客倒计时冲刺模式】：按时连续出餐叠加 COMBO 连击奖金！'
            : '🌙 已切换【悠闲夜谈模式】：无限点单时间，奉茶后弹出详细品鉴与夜谈卡！'
        );
      });
    }

    const spawnExtraBtn = document.getElementById('btn-spawn-extra-guest');
    if (spawnExtraBtn) {
      spawnExtraBtn.addEventListener('click', () => {
        if (state.activeSeats.length >= 3) {
          showToast('🛎️ 吧台 3 个客席已满座！快先把手头的饮品递给客人吧～');
          return;
        }
        ensureCustomerSeats(true);
        audio.playServeBellSound();
        renderMultiCustomerStage();
        updateLiveStepGuide();
        showToast(`🛎️ 叮铃！新客人入座排队，当前共 ${state.activeSeats.length} 位客人同时候餐！`);
      });
    }

    document.getElementById('btn-invite-modal').addEventListener('click', () => {
      renderGuestBookModal();
      document.getElementById('modal-guest-book').classList.remove('hidden');
    });
    document.getElementById('btn-open-guests').addEventListener('click', () => {
      renderGuestBookModal();
      document.getElementById('modal-guest-book').classList.remove('hidden');
    });
    document.getElementById('btn-open-recipes').addEventListener('click', () => {
      renderRecipeBookModal();
      document.getElementById('modal-recipe-book').classList.remove('hidden');
    });

    document.getElementById('btn-next-random-guest').addEventListener('click', () => {
      const others = HEROINES.filter((h) => h.id !== state.currentHeroineId);
      const pick = others[Math.floor(Math.random() * others.length)] || HEROINES[0];
      inviteHeroineToCounter(pick.id);
    });

    document.getElementById('btn-switch-outfit').addEventListener('click', () => {
      const heroine = getCurrentHeroine();
      const hStat = state.heroineStats[heroine.id];
      hStat.outfitIdx = (hStat.outfitIdx + 1) % heroine.outfits.length;
      saveState();
      renderHeroineAndOrder();
      audio.playStirClinkSound();
      showToast(`👗 已为 ${heroine.name} 切换吧台穿搭造型 (${hStat.outfitIdx + 1}/${heroine.outfits.length})`);
    });

    // 点击立绘或吧台寒暄触发轻互动
    const triggerSmallTalk = () => {
      const heroine = getCurrentHeroine();
      const line = heroine.smallTalks[Math.floor(Math.random() * heroine.smallTalks.length)];
      document.getElementById('dialogue-text').textContent = line;
      const exprKeys = ['smile', 'blush', 'tease'];
      const rk = exprKeys[Math.floor(Math.random() * exprKeys.length)];
      const portraitImg = document.getElementById('heroine-portrait-img');
      if (portraitImg && heroine.expressions[rk]) {
        portraitImg.src = heroine.expressions[rk];
        portraitImg.classList.remove('react-bounce');
        void portraitImg.offsetWidth;
        portraitImg.classList.add('react-bounce');
      }
      audio.playStirClinkSound();
    };
    document.getElementById('heroine-stage-box').addEventListener('click', triggerSmallTalk);
    document.getElementById('btn-small-talk').addEventListener('click', triggerSmallTalk);

    document.getElementById('btn-toggle-clue').addEventListener('click', () => {
      const drawer = document.getElementById('order-clue-drawer');
      drawer.classList.toggle('hidden');
    });

    // 一键按推理备料
    document.getElementById('btn-autofill-order').addEventListener('click', () => {
      const order = getCurrentOrder();
      if (!order) return;
      state.cup.temp = order.temp;
      state.cup.base = order.idealBases[0];
      state.cup.addons = order.idealAddons.slice(0, 2);
      if (order.temp === 'iced') audio.playIceClinkSound();
      else audio.playPourSound();
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
      if (order.favoriteStencil) {
        latteArtController.applyStencil(order.favoriteStencil);
      }
      showToast('✨ 已根据店长心事推理自动备好基底、辅料与拉花模具！');
    });

    // 4. 步骤切换标签
    document.querySelectorAll('.step-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        switchWorkbenchStep(Number(tab.dataset.step));
      });
    });
    document.querySelectorAll('[data-goto-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchWorkbenchStep(Number(btn.dataset.gotoStep));
      });
    });
    document.getElementById('btn-to-step-2').addEventListener('click', () => switchWorkbenchStep(2));
    document.getElementById('btn-to-step-3').addEventListener('click', () => switchWorkbenchStep(3));

    // 5. 第一人称按住左键拿起杯具、黄铜冰桶、拉花缸与成品杯交互
    const toggleAllPropsBtn = document.getElementById('btn-toggle-all-props');
    if (toggleAllPropsBtn) {
      toggleAllPropsBtn.addEventListener('click', () => {
        state.unlockAllProps = !state.unlockAllProps;
        saveState();
        renderTopStats();
        renderHeroineAndOrder();
        renderStep1Ingredients();
        updateLiveChalkboardPreview();
        showToast(
          state.unlockAllProps
            ? '🔓 已开启【全器具自由模式】：全部 6 款基底壶与 7 款配料瓶已摆上桌面！'
            : '🌱 已切回【渐进解锁模式】：随完成订单杯数逐步解锁新茶壶与配料！'
        );
      });
    }

    const hotCupBtn = document.getElementById('btn-temp-hot');
    if (hotCupBtn) {
      hotCupBtn.addEventListener('pointerdown', (e) => {
        startPointerGrabProp(e, {
          kind: 'temp-hot',
          label: '换上：热饮陶瓷杯',
          propImg: 'assets/cafe/props/prop_cup_hot.webp',
          color: '#D48C46',
          sourceEl: hotCupBtn
        });
      });
    }

    const icedCupBtn = document.getElementById('btn-temp-iced');
    if (icedCupBtn) {
      icedCupBtn.addEventListener('pointerdown', (e) => {
        startPointerGrabProp(e, {
          kind: 'temp-iced',
          label: '换上：冰饮玻璃杯',
          propImg: 'assets/cafe/props/prop_cup_iced.webp',
          color: '#7CE8FF',
          sourceEl: icedCupBtn
        });
      });
    }

    const iceBucketBtn = document.getElementById('btn-ice-bucket-scoop');
    if (iceBucketBtn) {
      iceBucketBtn.addEventListener('pointerdown', (e) => {
        startPointerGrabProp(e, {
          kind: 'ice',
          label: '铲入：晶莹冰块',
          propImg: 'assets/cafe/props/prop_ice_bucket.webp',
          color: '#7CE8FF',
          sourceEl: iceBucketBtn
        });
      });
    }

    document.getElementById('btn-reset-ingredients').addEventListener('click', () => {
      state.cup.addons = [];
      state.cup.extractBonus = 0;
      state.cup.extractPos = 8;
      state.cup.extractGrade = '待冲泡';
      audio.playPourSound();
      renderStep1Ingredients();
      updateLiveChalkboardPreview();
      updateExtractionUI();
      latteArtController.resetBaseCrema();
      showToast('🗑️ 已将杯中液体倒进吧台水槽，拿取新杯重新调制');
    });

    // 按住左键拿起中央成品杯直接递给吧台对面的女主
    const draggableCup = document.getElementById('center-draggable-cup');
    if (draggableCup) {
      draggableCup.addEventListener('pointerdown', (e) => {
        if (e.target && e.target.closest && e.target.closest('#cup-top-latte-badge')) return;
        const isIced = state.cup.temp === 'iced';
        startPointerGrabProp(e, {
          kind: 'serve-cup',
          label: '递给吧台客人奉茶 🛎️',
          propImg: isIced ? 'assets/cafe/props/prop_cup_iced.webp' : 'assets/cafe/props/prop_cup_hot.webp',
          color: '#FFB347',
          sourceEl: draggableCup
        });
      });
    }

    // 俯视杯口拉花放大镜弹窗开关 (拉花钢杯也支持按住左键拿起来移向杯口！)
    const openLatteLoupe = () => {
      const m = document.getElementById('modal-latte-loupe');
      if (m) m.classList.remove('hidden');
      audio.playSteamSound();
    };
    const closeLatteLoupe = () => {
      const m = document.getElementById('modal-latte-loupe');
      if (m) m.classList.add('hidden');
      updateLiveChalkboardPreview();
    };
    const openLoupeBtn = document.getElementById('btn-open-latte-loupe');
    const topLatteBadge = document.getElementById('cup-top-latte-badge');
    const closeLoupeBtn = document.getElementById('btn-close-latte-loupe');
    const doneLatteBtn = document.getElementById('btn-done-latte-only');
    const serveFromLatteBtn = document.getElementById('btn-serve-from-latte');

    if (openLoupeBtn) {
      openLoupeBtn.addEventListener('pointerdown', (e) => {
        startPointerGrabProp(e, {
          kind: 'latte-pitcher',
          label: '拿起拉花钢杯绘制奶泡 🎨',
          propImg: 'assets/cafe/props/prop_latte_pitcher.webp',
          color: '#FFF8EE',
          sourceEl: openLoupeBtn
        });
      });
    }
    if (topLatteBadge) topLatteBadge.addEventListener('click', openLatteLoupe);
    if (closeLoupeBtn) closeLoupeBtn.addEventListener('click', closeLatteLoupe);
    if (doneLatteBtn) doneLatteBtn.addEventListener('click', closeLatteLoupe);
    if (serveFromLatteBtn) {
      serveFromLatteBtn.addEventListener('click', () => {
        closeLatteLoupe();
        serveDrinkToHeroine();
      });
    }

    // 6. Step 2 萃取按钮（同时支持按住松开 & 点击启动/点击停止）
    const brewHoldBtn = document.getElementById('btn-brew-hold');
    if (brewHoldBtn) {
      brewHoldBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (state.brewingActive) {
          stopExtractionMeter();
        } else {
          startExtractionMeter();
        }
      });
      window.addEventListener('mouseup', () => {
        if (state.brewingActive) {
          stopExtractionMeter();
        }
      });
      brewHoldBtn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          startExtractionMeter();
        },
        { passive: false }
      );
      window.addEventListener('touchend', () => {
        if (state.brewingActive) {
          stopExtractionMeter();
        }
      });
    }

    document.getElementById('btn-brew-retry').addEventListener('click', () => {
      state.cup.extractPos = 8;
      state.cup.extractBonus = 0;
      state.cup.extractGrade = '等待启动冲泡…';
      updateExtractionUI();
    });

    // 7. Step 3 拉花模具、画笔颜色、粗细与奉茶
    document.querySelectorAll('.stencil-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.stencil-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        latteArtController.applyStencil(btn.dataset.stencil);
      });
    });

    const colorMap = {
      foam: '#FFF8EE',
      caramel: '#7A3E18',
      matcha: '#4A7C59',
      berry: '#D9536F'
    };
    document.querySelectorAll('.brush-color-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.brush-color-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        latteArtController.brushColor = colorMap[btn.dataset.color] || '#FFF8EE';
      });
    });

    const sizeInput = document.getElementById('latte-brush-size');
    if (sizeInput) {
      sizeInput.addEventListener('input', () => {
        latteArtController.brushSize = Number(sizeInput.value) || 8;
      });
    }

    document.getElementById('btn-clear-latte').addEventListener('click', () => {
      document.querySelectorAll('.stencil-btn').forEach((b) => b.classList.remove('active'));
      latteArtController.resetBaseCrema();
      audio.playSteamSound();
    });

    document.getElementById('btn-serve-drink').addEventListener('click', () => {
      serveDrinkToHeroine();
    });

    // 8. 模态弹窗关闭
    document.getElementById('btn-close-tasting').addEventListener('click', () => {
      document.getElementById('modal-tasting-result').classList.add('hidden');
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.closeModal);
        if (target) target.classList.add('hidden');
      });
    });

    document.getElementById('btn-unlock-all-recipes').addEventListener('click', () => {
      state.unlockedRecipes = RECIPES.map((r) => r.id);
      saveState();
      renderTopStats();
      renderRecipeBookModal();
      audio.playServeBellSound();
      showToast('🔓 已点亮全部 18 款秘密特调配方手账！');
    });
  }

  // ==================== 启动初始化 ====================
  function bootstrap() {
    loadSavedState();
    ensureCustomerSeats();
    initAmbientCanvases();
    latteArtController.init();
    renderTopStats();
    renderShiftEnvironment();
    renderStep1Ingredients();
    renderHeroineAndOrder();
    updateLiveChalkboardPreview();
    updateExtractionUI();
    bindGlobalEvents();
    startRushPatienceTicker();
    startCafeLiveCharacterAnimation();
    if (window.location.hash === '#recipes') {
      renderRecipeBookModal();
      document.getElementById('modal-recipe-book').classList.remove('hidden');
    }
  }

  // Spine 2D / 2.5D 实时 60FPS 骨骼渲染 + 眼神鼠标追踪引擎
  let cafeSpineRig = null;
  let showCafeBones = false;

  function syncCafeSpineHeroine() {
    if (!cafeSpineRig) return;
    const heroine = getCurrentHeroine();
    const box = document.getElementById('heroine-stage-box');
    cafeSpineRig.loadRig(`assets/spine/${heroine.id}/rig.json`).then((ok) => {
      if (ok === null) return; // 已被更新的加载请求取代
      if (box) box.classList.toggle('spine-active', !!ok);
      if (ok) cafeSpineRig.playState('talk', 1.2);
    });
  }

  function startCafeLiveCharacterAnimation() {
    const spineCanvas = document.getElementById('cafeHeroineSpineCanvas');
    if (spineCanvas && window.SpineRigInstance) {
      cafeSpineRig = new window.SpineRigInstance(spineCanvas, { flipX: false, showBones: showCafeBones });
      syncCafeSpineHeroine();

      // 画布处于隐藏兼容节点中（offsetParent 为 null）或页面切到后台时，跳过渲染与眼神追踪
      const isSpineCanvasVisible = () => !document.hidden && spineCanvas.offsetParent !== null;
      let spineVisibleCache = isSpineCanvasVisible();

      window.addEventListener('pointermove', (e) => {
        if (!spineVisibleCache) return;
        if (cafeSpineRig) cafeSpineRig.setLookAtClientPos(e.clientX, e.clientY);
      });

      const bonesBtn = document.getElementById('btn-toggle-cafe-bones');
      if (bonesBtn) {
        bonesBtn.addEventListener('click', () => {
          showCafeBones = !showCafeBones;
          if (cafeSpineRig) cafeSpineRig.showBones = showCafeBones;
          bonesBtn.textContent = `🦴 骨骼: ${showCafeBones ? 'ON' : 'OFF'}`;
        });
      }

      const stageBox = document.getElementById('heroine-stage-box');
      if (stageBox) {
        stageBox.addEventListener('click', () => {
          if (cafeSpineRig) cafeSpineRig.playState('talk', 1.4);
        });
      }

      let lastT = performance.now();
      const loop = (now) => {
        spineVisibleCache = isSpineCanvasVisible();
        if (!spineVisibleCache) {
          // 不可见时不跑逐帧 rAF，每 500ms 低频检查一次是否重新显示
          setTimeout(() => {
            lastT = performance.now();
            requestAnimationFrame(loop);
          }, 500);
          return;
        }
        const dt = Math.min(0.05, Math.max(0.005, (now - lastT) / 1000));
        lastT = now;
        if (cafeSpineRig && cafeSpineRig.loaded) {
          cafeSpineRig.update(dt);
          cafeSpineRig.render();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // 换客或换装时自动同步 Spine 骨骼模型
    ['btn-next-random-guest', 'btn-switch-outfit'].forEach((btnId) => {
      const b = document.getElementById(btnId);
      if (b) {
        b.addEventListener('click', () => {
          setTimeout(syncCafeSpineHeroine, 60);
        });
      }
    });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-invite-heroine]')) {
        setTimeout(syncCafeSpineHeroine, 80);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
