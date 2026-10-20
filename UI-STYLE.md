# 玄武攻略 WIKI · UI 风格与前端交接手册

> 给接手的人：看完这一份就能改页面而不破坏整体观感。
> 规则背后的「为什么」在 `DESIGN.md`，实现全在 `css/wiki.css`。
> 本文写的是**现在线上真实的样子**，不是设想。

---

## 0. 三十秒看懂这个站

一个游戏资料 wiki（玄武江湖），**纯静态、无框架、无构建**：手写 HTML + 一份 CSS + 原生 JS。
视觉世界只有一句话：

> **宣纸为地，墨为字，青为脉，赭金为器，朱砂为印。**

整站只有 7 个颜色（纸 4 层 + 墨 3 层 + 青/赭/朱/靛/紫棠），衬线做标题、无衬线做正文，
方角小圆、暖调投影、纸纹颗粒。所有装饰都从**印、签、引线**这一套古籍语汇里来。

**不要**加新颜色、不要加圆角胶囊按钮、不要用 emoji 当图标、不要加彩色左边条。
这三条踩了立刻「不像这个站」。

---

## 1. 目录与页面地图

```
xuanwu_wiki/
├── index.html            首页（卷首 + 6 个栏目方块）
├── css/wiki.css          全站唯一样式表（约 7800 行，见 §2 结构）
├── js/                   无打包，各页按需 <script>
├── pages/                栏目页
│   └── compendium/       5 个图鉴页
├── articles/             6 篇长文攻略
├── assets/images/        仅 3 张图 + 两个子目录
└── scripts/              图片处理脚本（不参与运行）
```

### 页面清单

| 页面 | 内容由谁生成 | 备注 |
|---|---|---|
| `index.html` | 手写 HTML，`js/home-spotlight.js` 注入「最近更新」 | 唯一的门户 |
| `pages/guide-list.html` | `js/wiki-collab.js` 的 `STATIC_GUIDES` | 全站**唯一**攻略入口 |
| `pages/contributors.html` | `wiki-collab.js` 的 `renderStaticContributors()` | 只读榜 |
| `pages/compendium.html` | 手写（5 张入口卡） | 图鉴门户 |
| `pages/compendium/skills.html` | `martial-compendium-data.js` + `-render.js` | 武功 361 条 |
| `pages/compendium/internal.html` | `internal-compendium-*` | 内功 117 条 |
| `pages/compendium/equipment.html` | `equipment-compendium-*` | 装备 251 条，**按名称分组** |
| `pages/compendium/arts.html` | `skills-guide-data.js` + `skills-guide.js` | 技艺 |
| `pages/compendium/characters.html` | `characters-compendium-*` | 角色 |
| `pages/map.html` | `map-*` 系列（7 个副本 + 主线） | 世界地图 |
| `pages/panel-attack.html` | `panel-attack-data.js` + `-calc.js` | 计算器 |
| `articles/*.html` | 手写长文 | 6 篇 |
| `login / submit-guide / review / my-submissions / player-article` | 手写 | **已下线**的静态说明页 |
| `pages/characters.html` `pages/resources.html` `pages/player-guides.html` | — | 旧地址重定向，勿删 |

### 每页的脚本顺序（照抄，别调换）

```html
<script src="../js/search-index.js"></script>   <!-- 搜索索引，必须最先 -->
<script src="../js/wiki.js?v=…"></script>       <!-- 协作层开关 / 公共行为 -->
<script src="../js/site-nav.js"></script>       <!-- 生成侧栏导航 -->
<!-- 之后才是本页专属脚本 -->
```

`site-nav.js` 靠 `<nav id="wikiNav" data-active="…">` 决定高亮项，**新页面要在 `NAV` 表里注册**，
否则侧栏没有它。

---

## 2. CSS 的结构（重要）

`css/wiki.css` 是一份「**旧站骨架 + 新视觉世界层**」叠起来的文件，改动前必须知道这一点：

| 行段 | 内容 |
|---|---|
| 1 – 3467 | 令牌 + 基础骨架（含早期白/灰配色，**已被下面覆盖**） |
| 3468 – 5021 | 协作层、投稿、攻略清单、图鉴、地图、面板、贡献者等功能样式 |
| **5022 – 7797** | **视觉世界层**：把上面所有骨架重新画成宣纸质感 |
| 7547 – 7797 | 响应式收束（写在最后，专门用来盖掉旧站窄屏档位） |

推论，三条：

1. **新样式追加到文件末尾或对应功能区末尾**，不要回头改基础层。
   基础层里很多值（如 `.hero-banner{background:#fff}`、`.wiki-card h2{border-left:3px}`）是旧设计残留，
   **世界层用同样的选择器覆盖掉了**。你若改基础层，多半改不动，只会困惑。
2. 世界层**不改类名、不动 DOM 结构**，所以改视觉不会影响 JS 与测试。
3. 响应式规则必须留到最后，否则会被基础层的窄屏档位盖回去。

---

## 3. 布局骨架

所有页面共用同一套外壳，照这个抄：

```html
<body data-wiki-depth="1">            <!-- 0=首页，1=二级页；site-nav.js 靠它算链接的相对路径深度 -->
  <div class="wiki-shell">
    <header class="wiki-header">
      <button class="nav-toggle" id="navToggle">…</button>   <!-- 窄屏抽屉按钮 -->
      <a class="wiki-brand" href="../index.html"><span class="wiki-brand-text">玄武攻略 WIKI</span></a>
      <div class="wiki-search"><input type="search" id="globalSearch" /></div>
    </header>
    <div class="wiki-body">
      <aside class="wiki-sidebar" id="sidebar">
        <nav class="wiki-nav" id="wikiNav" data-active="guide-list"></nav>
      </aside>
      <main class="wiki-main"> … 页面内容 … </main>
    </div>
    <footer class="wiki-footer">…</footer>
  </div>
</body>
```

| 常量 | 值 | 说明 |
|---|---|---|
| `--header-h` | `56px` | 页头固定高，侧栏 `sticky` 的偏移基准 |
| `--sidebar-w` | `224px` | 侧栏宽 |
| `.wiki-body` 宽 | `1240px` | 全站上限，居中 |
| 阅读型页面 | `1020px` | `.wiki-body:has(.wiki-main > .article-body)` |
| 攻略大全 | `1000px` | `.wiki-body:has(.wiki-guide-cta)` |
| `.wiki-main` 内边距 | `26px 30px 64px` | 底部留白给页脚 |
| `--measure` | `42em` | 正文行宽（≈42 汉字，舒适区间 30–45） |

页头有 **3px 赭金顶线**（`border-top: 3px solid var(--ochre)`），这是全站唯一一处实心色边条，
属于「装订线」的隐喻，不要往卡片上照抄。

---

## 4. 颜色

### 令牌（`:root`，直接用，不要写死色值）

| 令牌 | 色值 | 用途 |
|---|---|---|
| `--bg` | `#f4efe4` | 宣纸底（页面背景） |
| `--bg-elevated` | `#ece5d6` | 凹层：侧栏、页脚 |
| `--bg-card` | `#fdfaf3` | 浮层：卡片、方块、输入框聚焦 |
| `--bg-deep` | `#e4dbca` | 更深：输入框默认底、标签底 |
| `--border` | `#dad0bd` | 发丝线（1px） |
| `--border-strong` | `#c5b9a1` | 点线引格、分隔 |
| `--text` | `#1d2422` | 正文墨色 |
| `--text-muted` | `#5f6a64` | 次级文字（4.9:1） |
| `--text-faint` | `#8b918a` | 时间戳、说明 |
| `--accent` | `#2f6b5e` | **青＝玄武**：链接、选中、主按钮 |
| `--accent-strong` | `#235247` | 主按钮 hover |
| `--accent-soft` | `rgba(47,107,94,.1)` | 选中底 |
| `--ochre` | `#b8862b` | 赭金：**只能填色**（页头顶线、菱形、榜章） |
| `--ochre-ink` | `#8a6314` | 赭金**文字**必须用这个（`--ochre` 对纸底仅 2.8:1） |
| `--cinnabar` | `#ab3d27` | **朱砂＝印**：栏目标题、警示、投稿 |
| `--indigo` / `--plum` | `#3c5a78` / `#6b5b8a` | 地图 / 图鉴区分色 |

栏目色沿用旧变量名，改一处全站跟随：
`--tag-guide`(朱砂) `--tag-res`(青) `--tag-dungeon`(赭金) `--tag-compendium`(紫棠)。

### 用色纪律

- **文字对比度 ≥ 4.5:1**（正文与次级文字都要）。白字只允许压在
  `--accent / --cinnabar / --ochre-ink / --plum / --indigo` 上，**绝不要压在 `--ochre` 上**。
- 一张卡片里同时出现超过 2 个强调色就过头了。青是主角，赭金是点题，朱砂是印章（少量、有语义）。
- 颜色不承担「装饰」职责 —— 本设计里带语义的地方才上色：链接/选中（青）、
  印章式提示（朱砂）、榜首与装订线（赭金）。

---

## 5. 字体与排版

| 角色 | 令牌 | 字体栈 |
|---|---|---|
| 显示（标题） | `--font-display` | Noto Serif SC → Source Han Serif → Songti SC → SimSun |
| 正文 | `--font-body` | Noto Sans SC → PingFang SC → 微软雅黑 |
| 数字 | `--font-mono` | 仅用于时间、版本号、需要对齐的数值 |

**衬线/无衬线的分工是这个站最强的识别点**：标题、栏目名、卡片名、方块名、站名、页脚站名
一律衬线；正文、按钮、说明一律无衬线。混用会立刻掉档。

### 字号阶梯（实际使用值）

| 位置 | 字号 | 字重 / 字距 |
|---|---|---|
| 卷首 `h1` | `clamp(2.1rem, 4.6vw, 3.1rem)` | 700 / `0.08em` / 行高 1.1 |
| 文章标题 `h1` | `clamp(1.75rem, 3.4vw, 2.4rem)` | 700 / `0.05em` / 1.28 |
| 栏目标题 `.home-section-title` | `1.32rem` | 700 / `0.08em` |
| 卡片标题 `.wiki-card h2` | `1.22rem` | 700 / `0.08em` |
| 站名 `.wiki-brand-text` | `17px` | 700 / `0.12em` |
| 正文 `body` | `15px` | 400 / 行高 1.7 |
| 次级 `.muted` / 说明 | `13–14px` | 400 / `--text-muted` |
| 微标（tag、计数、时间） | `11.5–12px` | `--text-faint` |

**中文标题要疏排**（`letter-spacing: 0.05–0.12em`），这是让衬线标题「站得住」的关键；
正文不要加字距。

段落别超 `--measure`（42em）。这是中文阅读的硬约束，超了立刻变「报表」。

---

## 6. 形状、投影、质感

```
--radius-sm: 2px   → 小标记、nav 项
--radius:    4px   → 卡片、按钮、输入框（默认）
--radius-lg:  8px  → 只有卷首这种大块
```

**圆角刻意偏方**。胶囊形（`999px`）**只允许**用在筛选 chip 上，按钮和方块都不要。

投影必须是**暖褐**、带位移的（纸压纸），不要零偏移的彩色光晕：

```
--lift-1: 0 1px 1px rgba(74,58,34,.05), 0 2px 6px rgba(74,58,34,.05)   卡片/按钮默认
--lift-2: 0 2px 4px …, 0 10px 26px …                                   卡片 hover、卷首
--lift-3: 0 4px 10px …, 0 20px 48px …                                  浮层、建议框
```

**纸纹**：`body / .wiki-header / .wiki-sidebar / .wiki-footer` 各铺一张 `--grain`
（内联 SVG 噪声，160px 平铺，不透明度 5.5%）。新增大面积色块时不要另造纹理，
复用 `background-image: var(--grain)` 即可；小控件不要铺，会显脏。

---

## 7. 组件的类名与规格

> **类名不可改、不可重命名**：协作层脚本、存档清洗白名单、18 个 jsdom 测试都按类名工作。
> 要改外观就在后面追加同名选择器覆盖。

### 外壳

| 类名 | 规格 |
|---|---|
| `.wiki-header` | 高 56px，纸底 + 纹理，3px 赭金顶线，发丝下边线，`sticky` + 轻投影 |
| `.wiki-brand-text` | 衬线 17px / 700 / 0.12em。**页头没有图标**（玄武小印已按用户要求删掉，别再恢复） |
| `.wiki-search input` | 纸上的凹槽：`--bg-deep` 底 + 发丝边；聚焦转 `--bg-card` + 青光环 |
| `.nav-toggle` | 仅窄屏出现的手绘 SVG 汉堡（三根 1.7px 圆头线），不用 emoji |
| `.wiki-sidebar` | 224px，`--bg-elevated` + 纹理，桌面 `sticky`，≤768px 变 `fixed` 抽屉 |
| `.wiki-nav .nav-section` | 分区标题：衬线 12px / 0.2em，前置 5px 赭金菱形 |
| `.wiki-nav .nav-link` | 左内边距 22px 给菱形让位；**选中态是「点亮的菱形」，不是左边色条** |
| `.wiki-footer` | 13px 居中，`--text-muted`，上方 1px 发丝线 |

### 首页

| 类名 | 规格 |
|---|---|
| `.hero-banner` | 双列 `1fr / 272px`，`--bg-card`，圆角 8px，`--lift-2`；**书框**：`::before` 内缩 8px 再压一道 1px 细线 |
| `.hero-banner h1` | 衬线，`clamp(2.1rem,4.6vw,3.1rem)`，0.08em |
| `.hero-lead` / `.meta-line` | 导语 1 行；`meta-line` 里是更新时间，等宽数字 |
| `.hero-actions` | 5 个按钮，`gap` 10px，窄屏换行 |
| `.hero-btn` | 直角小牌：1px `--border-strong` 边 + `--lift-1`；hover 上浮 1px 加影；active 下压 1px。主按钮填 `--accent`，`--weapons / --tools / --contributors` 只是着色变体 |
| `.hero-art img` | `assets/images/xuanwu-hero.webp`（去底，520 宽）。**全站唯一的大幅插画**，只出现在卷首右栏 |
| `.home-section-title` | 衬线 1.32rem + 菱形，右侧点线一路引到「更多」链接 |
| `.home-tile-grid` | `auto-fill / minmax(168px,1fr)`；`--row5` 变体固定 5 列（首页各栏统一一排 5 个，**不要退回 3–4 列**，否则 8 个副本会独占一排看着散） |
| `.home-tile` | 纸签：`--bg-card` + 发丝边 + `--lift-1`；hover 上浮 3px、边框转栏目色。变体 `--guide`(朱砂) `--map`(青) `--dungeon`(赭) `--compendium`(紫棠) 只改 `--sec` 变量 |
| `.home-tile-tag` | 角标：**菱形点 + 疏排小字**，不是实心色块 |
| `.home-tile-title` / `-desc` | 衬线名 + 11.5px 说明（最多两行） |

### 内容与长文

| 类名 | 规格 |
|---|---|
| `.wiki-card` | 纸签大号：`--bg-card`，1px 边，圆角 4，padding `20/22`，`--lift-1` |
| `.wiki-card h2` | 衬线 1.22rem，`::before` 是一枚 8px 青色菱形（**覆盖掉基础层的 3px 左色条**） |
| `.link-table` | 古籍目录：每行底 1px **点线**，最后一行不画 |
| `.tag` / `.tag-guide` `.tag-res` `.tag-dungeon` `.tag-compendium` | 印章式：2px 圆角、11.5px、0.08em 疏排、内嵌 1px 白描边（16% 透明度） |
| `.article-header` / `.article-body` | 标题区 + 正文纸面卡（padding `24/28`）；`h2` 用 `--accent` |
| `.guide-prose` | 长文正文，15px/1.72，`h2` 下方 1px 实线 |
| `.breadcrumb` | 11–12px `--text-faint` |
| `.guide-related` | 相关阅读，套 `.wiki-card` |
| `.muted` | 次级文字的唯一写法，不要自己调色 |

### 攻略大全（`guide-list.html`）

| 类名 | 规格 |
|---|---|
| `.wiki-lib-toolbar` | 筛选卡：搜索框 + 排序下拉 + 计数 + 两行 chip |
| `.wiki-lib-chip` | **唯一允许胶囊形的地方**；选中 `.is-active` 填青底白字 |
| `.wiki-lib-body` | 卡片容器，`≥1024px` 排两栏，手机单栏 |
| `.wiki-lib-card` | 14/16 padding，圆角 10，hover 微浮 |
| `.wiki-lib-card-title` | 衬线标题链接 |
| `.wiki-lib-empty` | 空态/错误态共用；含标题、说明、动作按钮 |

### 图鉴（类名由 JS 生成，不在 HTML 里）

| 类名 | 说明 |
|---|---|
| `.martial-skill-card` / `.internal-neigong-card` / `.equip-card` | 三张卡型，结构同族：名称 + 标签行 + 描述 + 属性 dl + 效果 |
| `.martial-stats` / `.equip-attr-dl` | 属性两列表（`dt` 用 `--text-faint`，`dd` 用 `--text`） |
| `.martial-obtain` / `.martial-obtain-blank` | 「获取」行；空态带 `is-empty` 与 1px 虚线，读作「这里还空着」 |
| `.compendium-toolbar` | 图鉴顶部搜索 + 分类 chip，规格同 `.wiki-lib-*` |

> 图鉴的**搜索、筛选、渲染全在 `*-compendium-render.js`** 里，改数据只动 `*-data.js`。
> 装备页**按名称分组**（同名不同品质共用一张卡），渲染时取值要走 `groupObtain()` 这类「取组内首个非空」的逻辑，
> 否则切换品质会丢值。

### 贡献者榜（`contributors.html`）

| 类名 | 规格 |
|---|---|
| `.wiki-contrib-stats` / `.wiki-contrib-stat` | 三张统计卡：数字用等宽 + 衬线，标签 12px |
| `.wiki-contrib-item` | 一行：名次章 + 昵称 + chip + 分摊比例条 + 时间 |
| `.wiki-contrib-rank` | **印式名次章**（小方印，前三名用朱砂/赭金分级） |
| `.wiki-contrib-chip` | 「攻略 N」「改动 N」，印章式 |
| `.wiki-contrib-meter` | **宽度必须封顶 200px**（撑满整行会看着像卡片下沿的一道色条，不是数据条）；色段＝朱砂(攻略)/青(改动) |
| `.wiki-contrib-note` | 归属说明，菱形引首，不用色条 |

---

## 8. 签名装置（这个站「像自己」的地方）

1. **菱形印** —— 全站统一的标记语汇：栏目标题、卡片标题、侧栏项、导航分区都有一枚 5–8px 的
   45° 旋转方块，颜色取所属栏目的色。**它替代了所有彩色左边条**，这条最容易被新人破坏。
2. **点线引格** —— 栏目名右侧点线延伸到「更多」，目录表行底 1px 点线，取自古籍目录排法。
3. **书框** —— 卷首外框内缩 8px 再压一道细线，像装裱。
4. **玄武插画** —— 只在卷首右栏出现一次，是全站唯一大图。

### 已被用户明确否决、禁止恢复

- 页头那枚 36px 玄武小印（`xuanwu-mark.webp`，太糊，看着像脏点）→ 页头现在只有站名。
- 卷首右上角 74×4px 赭金「鱼尾」（`.hero-banner::after`，像一道划痕）。
- 卡片上的 3px 彩色左边条（`.wiki-entry-note` 曾有一根青色，已改成菱形引首）。

---

## 9. 动效

- **全站只有一个「有意的瞬间」**：卷首文字逐条 `blur + 上浮` 入场（`wiki-rise`，按 `nth-child` 递延），
  玄武插画配 `xuanwu-settle`。其余一律不做「每段同款入场」。
- 交互只做微动：hover 上浮 1–3px + 影子加深，active 下压 1px，过渡 `0.16–0.24s`，
  缓动 `cubic-bezier(0.2, 0.7, 0.3, 1)`。**不要用 linear、不要用弹簧过冲**。
- 所有动画都要落在 `@media (prefers-reduced-motion: reduce)` 的保护里。

---

## 10. 别漏掉的浏览器表面

这些「没人画过的表面」也算设计的一部分：

- 选区：朱砂淡底（`rgba(171,61,39,.18)`）
- 光标（caret）：朱砂
- 滚动条：11px、细、暖色拇指
- `:focus-visible`：双环（纸色内圈 + 青外圈），不用默认蓝色 outline
- 链接：下划线偏移，不靠颜色单独区分
- 数字：统计、时间、表格用 `font-variant-numeric: tabular-nums`

---

## 11. 响应式档位

| 断点 | 发生什么 |
|---|---|
| `≤1080px` | 卷首右栏 272→220，padding 收紧 |
| `≤1024px` | 方块与栏目标题下调一档；攻略大全保持单栏（`≥1024` 才是两栏） |
| `≤900px` | 卷首改单栏，插画缩到 168px 并移到文字下方；书框内缩 6px |
| `≤860px` | 方块 padding/字号下调 |
| `≤768px` | **侧栏变 `fixed` 抽屉**（基础层改成了 `sticky`，这里要重新声明回来）、正文间距收紧 |
| `≤560px` | 卷首与方块尺寸再降一档 |

**窄屏下首页方块仍是 5 列**，是靠缩 padding 和字号撑住的，不要改成 3 列（原因见 §7 首页表格）。

---

## 12. 明确禁止清单

| 别做 | 为什么 |
|---|---|
| 新增主色 / 渐变 | 世界只有 7 色，多一个就散 |
| >1px 的左右彩色边条 | 已用菱形印替代，用户明确否决过 |
| 胶囊按钮 | 999px 只留给筛选 chip |
| 渐变文字、玻璃模糊 | 与纸质质感冲突 |
| emoji / Unicode 当图标 | 汉堡、投稿、纠错都已换手绘 SVG 或纯文字 |
| 无限旋转的 logo | 同上 |
| eyebrow / kicker 小字 | 这套世界没有这个语汇 |
| 零偏移彩色光晕 | 投影必须是暖褐 + 位移 |
| 正文行宽超 42em | 中文阅读舒适区 30–45 字 |
| 改类名 | 协作层、存档白名单、18 个测试都按类名工作 |
| `--ochre` 当文字色 | 对比度 2.8:1，不达标 |

---

## 13. 四个常见任务怎么做

### A. 新增一个普通页面

1. 复制 `pages/guide-list.html` 的外壳（页头/侧栏/页脚），改 `<title>` 和 `data-active`；
2. 正文用 `.wiki-main > h1 + p.muted + section.wiki-card` 起手；
3. 在 `js/site-nav.js` 的导航表里加一项（否则侧栏找不到它）；
4. 引入脚本（顺序见 §1）；
5. 升版本号（见 §14）。

### B. 新增/修改一篇「站内自带攻略」

**只改一处**：`js/wiki-collab.js` 里的 `STATIC_GUIDES` 常量（标题/摘要/分类/标签/作者/日期/路径）。
攻略大全与贡献者榜都读它，别去改 HTML。
`category` 必须落在 `GUIDE_CATEGORIES` 里，否则一筛选就被藏起来；`updatedAt` 同时是排序键。

### C. 改主色

改 `css/wiki.css` 的 `:root` 一个令牌即可全站跟随。
但**先回去看 `assets/images/xuanwu.png`** —— 配色是从那张插画里取的，别凭喜好另起一套。
改完检查：白字是否压在了新色上（对比度）、`--ochre` 有没有被当文字用。

### D. 加一个图鉴字段

1. 在对应 `*-compendium-render.js` 里输出一行 HTML，空值加 `is-empty` + `data-wiki-slot`；
2. 字段名加进搜索词；
3. 若要允许玩家补充，还得进 `COMPENDIUM_PAGES[...].fields`（当前站点已纯静态，此步只影响将来恢复）。

---

## 14. 改完必须做的三件事

1. **升版本号**（静态托管不下发 `Cache-Control`，不升版本用户会继续读旧文件）：
   `js/wiki.js` 的 `COLLAB_VER`、`js/wiki-collab.js` 的 `ASSET_VER`，
   以及所有 HTML 里 `css/wiki.css` / `js/wiki.js` / 各渲染脚本的 `?v=` 参数。当前 `20261018a`。
2. **`node --check`** 过一遍改动的 JS。
3. **跑全量 jsdom 测试**（18 个文件，在 `C:/Users/charlotte/.workbuddy/binaries/node/workspace`）。

### 两个容易踩的坑

- **首页有数据库存档**：`index.html` 里带 `data-wiki-edit` 的 5 个区块由后台内容覆盖，
  改文件不生效；但**卷首、页头、页脚不在存档内**，可以直接改 HTML。（当前站点已纯静态，存档不生效，但别据此删属性。）
- **不要在任何页面直接引 `js/wiki-cloud.js` 或 `js/wiki-collab.js`**：
  协作层只由 `js/wiki.js` 按需加载。直接引会绕过开关、把整站拖回云端依赖（`contributors.html` 踩过）。

### 看效果别看错文件

- 本地起服务：项目根目录 `python -m http.server 8000`，无构建步骤。
- 无头浏览器 `--screenshot` **不等 JS 执行完**，截图前用 `--virtual-time-budget=9000 --dump-dom` 才是真实结果。
- `--window-size=390` 的窄屏截图在 Windows 上会拍出假的「右侧被切」；
  要判断真溢出，用 iframe 包住页面读 `innerWidth` / `documentElement.scrollWidth`。

---

## 15. 交接前的自检清单

- [ ] 打开首页、图鉴、攻略大全、贡献者、任意一篇长文，五页观感一致
- [ ] 窄屏（真机或 iframe 探针）无横向滚动
- [ ] 新加的东西没有引入第 8 种颜色、没有胶囊按钮、没有彩色边条
- [ ] 所有新增文字都对得上 `--text / --text-muted` 两级，没有第三种灰
- [ ] 版本号三处都升了
- [ ] `node --check` 与全量测试通过

---

## 附：一句话记住这个站

**纸是底色，墨是字，青是脉络，赭金是器物，朱砂是印。**
所有装饰要么是「印」，要么是「引线」，要么是「书框」—— 三者之外，什么都不加。
