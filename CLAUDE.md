# 独立新小游戏项目（`pxlsan-arcade`）与零成本 AI 美术管线交接文档（Handoff Guide）

> [!IMPORTANT]
> **新对话一键启动指令（可直接复制给新对话的 Agent）**：
> ```text
> 请先读取 C:\Users\Administrator\Documents\GitHub\pxlsan-arcade\HANDOFF_NEXT_SESSION.md。我们要在独立项目 C:\Users\Administrator\Documents\GitHub\pxlsan-arcade 中开发全新的独立小游戏（与旧的 pxlsan-game 完全解耦分离），并使用交接文档中的「Google Flow Nano Banana Pro（0点数）+ 本机 ComfyUI Anima 喵喵 1.4 / NoobAI」零成本生图管线为新游戏生成专属的独立美术资产（背景、卡牌、饮品道具、原创角色立绘与 CG）。
> ```

---

## 〇、 当前结构与上线流程（2026-11-21 更新，以本节为准）

- **代码位置**：三款游戏各自自包含在 `games/<game>/`（`index.html` + `src/arcade/*.js|css` + `assets/`）：
  - `games/tag-alchemist/` 次元小丑牌：魔王讨伐战
  - `games/midnight-cafe/` 放学以后的深夜咖啡馆
  - `games/neon-beat/` 次元节拍：糖果风暴
  - 下文第一节里的 `tag-alchemist.html`、根目录 `src/arcade/...` 路径是旧结构，已失效。
- **正式上线位置**：主站 `pxlsan-main` 的 `games/` 目录 → https://pxlsan.cn/game （国内镜像 pxlsan.tctec.com）。本仓库只是开发源，**不单独部署**（GitHub Pages 已关闭）。
- **上线步骤**：
  1. 在本仓库改好、本地测试（`python -m http.server` 打开 `games/<game>/index.html`），提交推送。
  2. 在 `pxlsan-main` 目录运行 `node scripts/sync-arcade-games.mjs`：整体替换 `games/<game>/`，把返回链接改成 `../../game.html`，并给 JS/CSS 生成内容哈希文件名（主站 CDN 会忽略 `?v=`）。
  3. 在 `pxlsan-main` 提交推送 `main`：Cloudflare 自动部署 pxlsan.cn，`Sync to Tencent COS` 工作流同步国内镜像（约 15–40 分钟）。
- **本仓库内的缓存**：改了 JS/CSS 记得同时调高 `index.html` 里的 `?v=`（本地/测试用；主站用哈希文件名）。

## 一、 项目定位与解耦现状（100% 独立于 `pxlsan-game`）

1. **独立仓库路径**：`C:\Users\Administrator\Documents\GitHub\pxlsan-arcade`
   - 已与旧的换装/小城项目 `pxlsan-game` **完全物理分离**（`pxlsan-game` 已恢复至纯净的第 2～4 章剧情扩充版 Commit `5b1aad4`，不包含任何街机耦合代码）。
2. **已落地的 3 款独立小游戏玩法代码骨架与美术风格实验室**：
   - 🕹️ **独立总入口**：[index.html](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/index.html) / [arcade.html](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/arcade.html)
   - 🎨 **美术风格动态样机实验室**：[art-style-lab.html](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/art-style-lab.html) 及 3 张 16:9 三联概念设计图（位于 `docs/concepts/`）
   - 🎴 **独立游戏 A：《Pxlsan 炼丹工坊：AI 画师模拟器 (Tag Alchemist)》**
     - 文件：[tag-alchemist.html](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/tag-alchemist.html)、[src/arcade/tag-alchemist.js](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/src/arcade/tag-alchemist.js)、[src/arcade/tag-alchemist.css](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/src/arcade/tag-alchemist.css)
     - **已锁定美术风格**：**【方案 A1 · 赛博 CRT 全息牌桌风】**（对标《Balatro 小丑牌》×《主播女孩重度依赖》，`#0D061A` 暗紫 CRT 扫描线桌面 + 3D 彩虹全息镭射闪卡 + 像素双框跳字爆分）。
   - ☕ **独立游戏 B：《深夜咖啡馆 (Midnight Cafe)》**
     - 文件：[midnight-cafe.html](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/midnight-cafe.html)、[src/arcade/midnight-cafe.js](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/src/arcade/midnight-cafe.js)、[src/arcade/midnight-cafe.css](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/src/arcade/midnight-cafe.css)
     - **已锁定美术风格**：**【方案 B2 · 暖调胡桃木 Lo-Fi 深夜咖啡馆风】**（对标《Coffee Talk》×《深夜食堂》，`#1E130C` 深胡桃木吧台 + `#D48C46` 焦糖拿铁暖光 + 窗玻璃真实雨滴滑落与热蒸汽 Canvas + 手绘咖啡拉花画布）。
   - 🎵 **独立游戏 C：《次元节拍：糖果风暴 (Neon Beat)》**
     - 文件：[neon-beat.html](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/neon-beat.html)、[src/arcade/neon-beat.js](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/src/arcade/neon-beat.js)、[src/arcade/neon-beat.css](file:///C:/Users/Administrator/Documents/GitHub/pxlsan-arcade/src/arcade/neon-beat.css)
     - **已锁定美术风格**：**【方案 C1 · 高饱和糖果波普漫改风】**（对标《Muse Dash 喵斯快跑》×《Hi-Fi RUSH》，电光粉 `#FF1493` + 柠檬黄 `#FFE600` + 薄荷青 `#00F5D4` 撞色 + 美漫波普网点 + 横版双轨/4K 下落双模式 + 全屏漫画斜切 Cut-in）。

> [!NOTE]
> **新对话的首要任务**：
> 目前 `pxlsan-arcade` 中的代码骨架仍有部分图片路径指向旧项目的占位图。在新对话中，应当使用下方的 **零成本双引擎 AI 生图管线（`Nano Banana Pro` 0 点数 + 本机 ComfyUI `Anima 喵喵 1.4` / `NoobAI`）**，为这 3 款独立游戏批量生成**全新的专属独立美术资产**（存放到 `pxlsan-arcade/assets/` 下），实现从代码到美术 100% 独立！

---

## 二、 零成本（0 点数）王炸双引擎生图与美术管线速查

### 1. 本机 ComfyUI（2D 关键帧、背景、卡牌、立绘生成主力 · 完全免费）
- **服务地址**：`http://127.0.0.1:8188`
- **16:9 横版场景 / 卡牌插画 / CG 模板（`Anima 喵喵 1.4`）**：
  - 模板 JSON：[anima-miaomiao-api.json](file:///C:/Users/Administrator/.gemini/config/skills/pxlsan-noobai-cg/assets/anima-miaomiao-api.json)
  - 权重文件：`Wan2.2\Anima\MiaoMiao Harem - Anima_1.4.safetensors`
- **全身/半身透明立绘（RGBA）管线（`NoobAI-XL-XIN v1.0`）**：
  - 底模：`NoobAI-XL-XIN v1.0` + 3 风格 LoRA（`Nyalia-PA 0.3 / saio_ga_ushi 0.3 / 高柳克也 0.2`）+ `4x_NMKD` 1.5x Hires（`denoise 0.03`）+ `rembg`（`isnet-anime` 自动抠图输出透明 `.webp`）。

### 2. Google Flow ULTRA 账号 `🍌 Nano Banana Pro`（0 点数免费无限生图/改图）+ 本机 `Anima 1.4` 精绘
- **Chrome Profile 与专属项目（严禁触碰其他项目）**：
  - 订阅账号位于 Chrome 的 **`Profile 1`**（`l1292078616@gmail.com`，剩余 **19,323 ULTRA 点数**）。
  - **专属固定项目名称**：**`pxlsan-游戏动画专用`**
  - **专属固定 URL**：`https://flow.google.com/project/f03ddae4-af71-4e7b-83ce-95fc6a393aae`
  - **安全铁律**：所有 Google Flow 的 `Nano Banana Pro` 0 点数生图/改图操作，**一律固定在 `pxlsan-游戏动画专用`（`f03ddae4-af71-4e7b-83ce-95fc6a393aae`）内进行**，绝不进入或删除账号下的其他项目（如朋友使用的项目）。
- **为什么用 `Nano Banana Pro` + 本机 `Anima 喵喵 1.4` 两步走？（0 成本 + 顶级画质）**：
  1. **阶段 1（`🍌 Nano Banana Pro` · 消耗 0 点数 · 精准控构图/UI元素/复杂手部/多角色互动）**：
     - `Nano Banana Pro` 在 Google Flow ULTRA 订阅下生成图片**完全免费（0 点数）**，且对复杂构图、手部拿道具（如捧咖啡杯、摇雪克杯、拿画笔、弹吉他）、双人互动、无文字纯净背景的理解力极强；但直出图偏扁平平涂。
  2. **阶段 2（本机 ComfyUI `Anima 喵喵 1.4` · `1536×864` · `denoise=0.58` · 5 秒刷回顶级二次元半厚涂光泽）**：
     - 将 `Nano Banana Pro` 生成的构图底稿缩放到 `1536×864`（或对应卡牌/立绘比例），送入本机 ComfyUI `Anima 喵喵 1.4` 图生图（`steps=30, cfg=4.8, denoise=0.58`，负面词加 `flat cel shading, flat 2d, vector art, simple shading, matte skin`）。
     - **效果**：既保留了 `Nano Banana Pro` 零崩手、零串色的完美构图骨架，又 100% 赋予了 `Anima 喵喵 1.4` 标志性的紫色发丝天使环高光、通透肤色与单反级景深！
- **启动/连接命令**：
  ```powershell
  Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList '--profile-directory="Profile 1"', 'https://flow.google.com/project/f03ddae4-af71-4e7b-83ce-95fc6a393aae'
  ```
- **持久 CDP 守护进程脚本**：[flow_daemon.py](file:///C:/Users/Administrator/.gemini/antigravity/brain/3a51e853-9281-4a6b-aa32-385fc8feb307/scratch/flow_daemon.py)（监听 `http://127.0.0.1:18923`）。

---

## 三、 新对话可执行的独立美术资产批量生产清单（`pxlsan-arcade/assets/`）

在新对话中，可按以下清单使用本机 ComfyUI / `Nano Banana Pro` 免费生成全套独立资产并替换进 3 款游戏中：

1. **🎴 游戏 A《炼丹工坊 (Tag Alchemist)》专属资产（`assets/alchemist/`）**：
   - **18 张原创 SSR 炼丹神图成果（`assets/alchemist/ssr/ssr_01.webp` ~ `ssr_18.webp`）**：涵盖赛博霓虹少女、黄昏丁达尔教室、暗黑哥特古堡、星光舞台偶像等主题，由玩家打出对应 Prompt 羁绊时在 CRT 监视器中揭晓。
   - **12 张显卡插件 / 炼丹炉图标（`assets/alchemist/jokers/`）** 与 **4 套全息卡背纹理**。
2. **☕ 游戏 B《深夜咖啡馆 (Midnight Cafe)》专属资产（`assets/cafe/`）**：
   - **3 张不同时段的胡桃木咖啡馆窗景底图（`assets/cafe/bg_sunset.webp`, `bg_rain_night.webp`, `bg_midnight.webp`）**。
   - **专属咖啡师看板娘与独立常客角色的半身透明立绘（`assets/cafe/characters/`）**：每角色含 `normal / smile / shy / blush / surprise` 5 种表情差分（使用本机 `NoobAI` + `rembg` 管线生成）。
   - **18 款秘密特调饮品高清特写图标（`assets/cafe/drinks/`）**（焦糖玛奇朵、宇治抹茶拿铁、翡翠奶油苏打、覆盆子热可可等）。
3. **🎵 游戏 C《次元节拍 (Neon Beat)》专属资产（`assets/neonbeat/`）**：
   - **5 张曲目专属糖果波普封面图（`assets/neonbeat/covers/track_01.webp` ~ `track_05.webp`）**。
   - **搭档角色动态奔跑/击打立绘与全屏斜切漫画 `SKILL CUT-IN` 横幅特写（`assets/neonbeat/cutins/`）**。

---

## 四、 二次元 AI 动态演出/短片避坑铁律（如需为新游戏制作动态 CG / Opening）

1. **绝不让单镜头硬撑 8 秒**：采用「每镜 `2.5s–3.5s` 黄金零崩坏区间 + `ffmpeg` 多机位真硬切」。
2. **严禁跨朝向首尾帧插值（`FL2V`）**：每个分镜只挂单张高精度 `开始帧（I2V）`，且含脸镜头第 `0.0s` 必须已有清晰面部锚点。
3. **服装一致性（`WARDROBE RULE`）**：提示词严禁写与首帧矛盾的穿脱状态。
4. **台词与视觉严格隔离**：开头固定加 `NO TEXT IN THE IMAGE...`，台词只放底部 `AUDIO:`。
5. **可调用的本地导演 Skills**：
   - [ai-director-seedance](file:///C:/Users/Administrator/.gemini/config/skills/ai-director-seedance/SKILL.md)
   - [anime-scene-keyframes](file:///C:/Users/Administrator/.gemini/config/skills/anime-scene-keyframes/SKILL.md)
   - [pxlsan-noobai-cg](file:///C:/Users/Administrator/.gemini/config/skills/pxlsan-noobai-cg/SKILL.md)
   - [google-flow-scripting](file:///C:/Users/Administrator/.gemini/config/skills/google-flow-scripting/SKILL.md)
