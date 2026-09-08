紫藤庄园 · A Dark Room (Demon Slayer Edition)
=============================================
> 「醒来，头痛欲裂，视野模糊。去把火点起来。」

这是 [Michael Townsend 的 *A Dark Room*](https://github.com/doublespeakgames/adarkroom) 的「鬼灭之刃 / 鬼滅の刃」主题二次创作。
保留原作的渐进式放置 + 文字冒险骨架，将世界观重铸为：

| 原作 | 本作 | 说明 |
| --- | --- | --- |
| A Dark Room（生火间） | **紫藤庄园** | 炉火旁醒来，胡蝶忍前来协助重建栖身之所 |
| 沉寂的森林 | **鬼出没的山林** | 布陷阱、招幸存者、组建鬼杀队后方 |
| 崎岖的小径 | **崎岖的小径（漫漫尘途 / 远征）** | 世界地图遭遇森林鬼/爪鬼/血雾鬼，探索地标 |
| 飞船升空 / 太空层 | **无限城（坠落）** | 取代原作的"飞船逃离"，向无惨的居所一路下沉，逐层节点探索 |
| 太空最终决战 | **无惨决战** | 60000 血 / 5 阶段 / 5 分钟熬到天明即胜利；原作的"舰队护卫"机制在这里被改写为**柱辅助**——归阵符召集九柱驰援（回满血 + 药剂 + 归阵符 + 削 10000 血） |

> 素材/系统改造进度约 99%。房间/森林/远征/无限城主线均已完成鬼灭主题重铸；**筑造器（Fabricator）改名「日轮锻刀场」、刑吏副本（Executioner setpieces）改名「坠毁的无限列车」副本**，均已完成鬼灭主题改造（英文源码与 zh_cn 翻译键同步重命名）；唯一原版科幻残留是地图上 SHIP 地标的「Crashed Starship」标签（属无限城入口模块，待随后处理）。

当前版本：**v1.6.0** —— 详见 [CHANGELOG.md](./CHANGELOG.md)。
在线体验：[GitHub Pages](https://molingmiao.github.io/ABlackRoom_Kimetsu/)（推送到 `main` 时由 GitHub Actions 自动部署）。

本地最新调整：修复无限城成长与奖励、放缓后期敌人成长，并加入战斗流派、自定义补给配置和失败战报。见 [调整说明](doc/CASTLE_UPDATE.md)。无限城不提供暂停或续关；撤离与死亡都会结束本次探索。

---

## 主要特色

- **渐进式文字冒险**：从一簇微弱炉火开始，层层揭开紫藤庄园、鬼杀队后方、远征与无限城的主线，全程以文字与状态条推进。
- **远征与装备系统**：漫漫尘途的【装备】栏（护甲 / 负重 / 水 + 双手 / 副手 / 道具三类×2 槽），与【供应】栏左右并排；战斗/重铸/库存降至 0 时装备槽自动卸下。
- **回收系统**：所有有制作/购买成本的物品（武器、弹药、消耗品、炉火制品）均可一键回收，返还 30% 材料，并附带材料清单通知。
- **无限城（Roguelike 化）**：
  - 100 层深井、9 个楼层 BOSS + 第 100 层无惨；进入即带走背包，可随时离开。
  - 影中商人、7 种药水（增益 / 祸福相依 / 诅咒三类）、可赌博式神秘药水。
  - 战胜普通/精英后 3 选 1 的**鬼杀天赋**（硬体术 / 快刀术 / 铁壁 / 吸血术 / 巧手 / 风刃），每场 run 内 build。
  - 节点颜色分类（红=危险 / 绿=休整 / 紫=商人 / 橙=宝藏 / 金=BOSS / 蓝=柱之邂逅 / 红黑脉动=无惨）。
- **无惨决战**：60000 血、5 阶段倒计时，每 12 秒一位柱赶到，回满血 + 药剂/归阵符补给 + 削 10000 血，5 分钟熬到天明即胜利。
- **元进程（Meta Progression）**：跨 run 永久保留 —— 累计楼层奖励 (+HP/+伤害/+减伤)、起始天赋授予、治疗遗产、探索者赐福；无限城顶部【传承】栏实时显示。
- **键盘热键系统**：战斗无需纯鼠标 —— `Q W E R T Y` 对应攻击按钮，`1 2 3 4 5 6` 对应医疗/整顿，禁用/冷却/未持有按钮自动忽略，输入框聚焦时禁用热键。
- **通知分级着色**：金=成就 / 紫=永久增益 / 绿=获得奖励 / 青=远征结算 / 红=陨落失败 / 蓝=柱级 NPC 出场；夜间模式自适应。
- **夜间模式**：完整适配主界面/装备栏/分隔线/回收按钮等。

## 启动

```powershell
npm install
npm start
# 打开 http://localhost:8080
```

无需 Node 也能跑（纯静态托管）：

```powershell
npm run start:nodep   # 使用 tools/static-server.cjs
```

环境变量：
- `PORT` — 监听端口，默认 8080
- `HOST` — 监听地址，默认 0.0.0.0
- 浏览器地址栏加 `?analytics=1` 才会启用 Google Analytics（默认关闭，保护玩家隐私）

## 键盘操作

| 场景 | 按键 | 说明 |
| --- | --- | --- |
| 战斗攻击 | `Q W E R T Y` | 依次对应战斗中的攻击按钮（双手 → 副手 → 道具，按 DOM 顺序） |
| 战斗医疗 / 无限城整顿栏 | `1 2 3 4 5 6` | 对应医疗按钮（吃肉/药剂/藤花精油/丸药/护盾/召集柱）与整顿栏道具 |
| 焦点在文本输入框 | — | 热键自动禁用 |
| 标签页导航 | WASD / Tab | 已被 tab 导航占用，故战斗热键选 QWERTY 主排 |

按钮右上角的小角标即所绑热键（夜间模式自适应）。事件面板内的按钮优先触发，背后场景同键位按钮不会被误触发。

---

## 项目结构

```
.
├── index.html             # 入口，按顺序加载 lib / lang / script/*
├── dev-server.js          # Express 静态开发服务器（npm start）
├── lang/
│   ├── langs.js           # 语言清单
│   ├── adarkroom.pot      # Babel 提取的字符串模板
│   └── zh_cn/             # 简体中文（默认）：strings.js / strings.po / main.css
├── script/                # 游戏逻辑（原生 JS，无打包步骤）
│   ├── engine.js          # 主循环 / 热键派发 / 时间与状态
│   ├── state_manager.js   # $SM 存档管理（localStorage）
│   ├── Button.js          # 按钮组件（含 data-hotkey 绑定）
│   ├── header.js, notifications.js, achievements.js, localization.js
│   ├── room.js            # 紫藤庄园（生火 / 物品说明 / 配方）
│   ├── outside.js         # 沉寂的森林（陷阱 / 村民 / 自动化）
│   ├── world.js           # 世界地图（地标 / 战斗结算）
│   ├── path.js            # 漫漫尘途（背包 / 装备槽 / 出发）
│   ├── ship.js            # 无限城入口（坠落）
│   ├── space.js           # 无限城楼层 / 节点 / 无惨战
│   ├── fabricator.js      # 日轮锻刀场（Nichirin Forge，改造原版「筑造器」）
│   ├── prestige.js, scoring.js
│   └── events/            # 事件剧本（遭遇 / 设点 / 营销 / 刑吏→「坠毁的无限列车」副本 / 序章 …）
├── css/                   # main / room / outside / path / world / ship / space / fabricator / dark
├── audio/                 # flac 音效（火/脚步/遭遇/地标/武器 …）
├── img/, lib/             # 资源与第三方库（jQuery 3.7.1 本地回退等）
├── tools/                 # 构建与本地化脚本：sync-dist / build-exe / static-server / po2js / 批量汉化等
├── .github/workflows/deploy.yml   # 推 main 自动部署到 GitHub Pages
└── sea-config.json        # Node SEA 打包配置（生成 wisteria-hall.exe）
```

## 开发与构建

```powershell
npm run lint          # 检查 script/ 与 dev-server.js
npm run lint:fix      # 自动修复
npm run format        # Prettier 格式化（js/html/css）
npm run format:check  # 仅检查
npm run check         # node --check dev-server.js
npm run test:migrate  # 跑存档迁移测试
```

格式化约定见 `.prettierrc.json`（tab 缩进 / 单引号 / 120 列 / LF）。JS 风格另见 `.jshintrc`、`eslint.config.js`。

打包成单文件可执行：

```powershell
node tools/build-exe.cjs     # 基于 sea-config.json 生成 dist/wisteria-hall.exe
```

部署到 GitHub Pages：推送到 `main` 即自动触发 [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)，先 `node tools/sync-dist.cjs` 同步并裁剪测试 UI，再用 `actions/deploy-pages` 发布 `dist/`。

## 本地化

- 默认语言为**简体中文**（`lang/zh_cn/strings.js`）。
- 提取字符串到模板：

  ```powershell
  npm run update_pot   # pybabel extract -F lang/babel.cfg -c "TRANSLATORS" script -o lang/adarkroom.pot
  ```
- 将 `.po` 转为前端可用的 `strings.js`：见 `tools/po2js.py`、`tools/apply_translations.cjs`。
- 汉化迁移 / 批处理工具位于 `tools/`（`translations_batchN.cjs` / `gen_*` / `dump_*` / `find_untranslated.cjs` 等）。
- 如需贡献其他语言，可参考 `contributing.md` 与现有 `lang/zh_cn/` 目录结构。

## 致谢与许可

- 原作 © Michael Townsend, doublespeak games. 协议 **MPL-2.0** —— 本仓库继承此协议。
- 鬼灭之刃为吾峠呼世晴 / 集英社的作品；本项目为非商业的粉丝二创，所有「鬼灭」相关设定与角色名仅作叙事使用，著作权归原作者所有。
- 原作的在线版本仍可在 [adarkroom.doublespeakgames.com](http://adarkroom.doublespeakgames.com) 体验。

---

## 原作信息（保留）

[Click to play (原版)](http://adarkroom.doublespeakgames.com)

<table>
<tr><th colspan=4>Available Languages</tr>
<tr>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=zh_cn">Chinese (Simplified)</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=zh_tw">Chinese (Traditional)</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=en">English</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=fr">French</a></td>
</tr><tr>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=de">German</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=el">Greek</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=id">Indonesian</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=it">Italian</a></td>
</tr><tr>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=ja">Japanese</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=ko">Korean</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=nb">Norwegian</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=pl">Polish</a></td>
</tr><tr>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=pt">Portuguese</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=pt_br">Portuguese (Brazil)</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=ru">Russian</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=es">Spanish</a></td>
</tr><tr>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=sv">Swedish</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=th">Thai</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=tr">Turkish</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=uk">Ukrainian</a></td>
</tr><tr>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=vi">Vietnamese</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=lt_LT">Lithuanian</a></td>
	<td><a href="http://adarkroom.doublespeakgames.com/?lang=gl">Galician</a></td>
</tr>
</table>

or play the latest on [GitHub](http://doublespeakgames.github.io/adarkroom)

<a href="https://itunes.apple.com/us/app/a-dark-room/id736683061"><img src="http://i.imgur.com/DMdnDYq.png" height="50"></a>
<a href="https://play.google.com/store/apps/details?id=com.yourcompany.adarkroom"><img src="http://i.imgur.com/bLWWj4r.png" height="50"></a>
<a href="https://store.steampowered.com/app/2460660/A_Dark_Room/"><img src="https://i.imgur.com/yz6cnU0.png" height="50"></a>
