# Explorer Icon Studio

一个用于 Obsidian 的文件管理器图标增强插件。  
An Obsidian plugin for customizing icons in the file explorer.

它可以替换左侧文件树中的文件和文件夹图标，支持全局默认图标、按规则替换、按单个路径覆盖，以及自定义 SVG / 手绘图标。  
It replaces file and folder icons in the left sidebar file tree, with support for global defaults, rule-based replacements, per-path overrides, and custom SVG / hand-drawn icons.

## 中文说明

### 功能特性

- 替换文件默认图标
- 分别替换文件夹折叠图标和展开图标
- 按文件后缀设置图标，例如 `md`、`png`、`pdf`
- 按文件夹名称设置图标
- 为单个文件或单个文件夹单独指定图标
- 文件规则和文件夹规则支持拖动排序，顺序即优先级
- 图标选择器支持搜索
- 图标选择器支持最近使用
- 支持自定义 SVG 图标
- 支持简易画板手绘图标并生成 SVG
- 支持导入已有 SVG 作为自定义图标
- 文件树变化后自动刷新图标

### 适合的使用场景

- 给不同类型的笔记设置更直观的图标
- 为项目目录、模板目录、资源目录设置专属文件夹图标
- 给重点文件或重点文件夹单独设置局部图标
- 制作手绘风格、品牌风格或个人风格的 Obsidian 文件树

### 安装

#### 手动安装

将以下文件放到你的 vault 插件目录：

- `main.js`
- `manifest.json`
- `styles.css`

目录示例：

```text
.obsidian/plugins/explorer-icon-studio/
```

然后在 Obsidian 的社区插件页面启用 `Explorer Icon Studio`。

### 使用方法

#### 1. 设置全局图标

在插件设置中可以设置：

- 文件默认图标
- 文件夹折叠图标
- 文件夹展开图标

如果没有命中任何局部覆盖或规则，就会使用这里的默认图标。

#### 2. 设置文件规则

你可以按文件后缀设置图标，例如：

- `md`
- `txt`
- `png`
- `excalidraw`

规则支持拖动排序，排在前面的优先级更高。

#### 3. 设置文件夹规则

你可以按文件夹名称设置图标，例如：

- `Assets`
- `Templates`
- `Projects`

文件夹规则同样支持拖动排序，并且可以分别设置：

- 折叠图标
- 展开图标

#### 4. 设置局部图标

插件支持给某一个具体文件或文件夹单独指定图标。

使用方式：

1. 在左侧文件树中右键文件或文件夹
2. 选择对应的图标设置菜单
3. 在图标选择器中选择图标

局部图标优先级高于全局图标、文件后缀规则和文件夹名称规则。

#### 5. 使用图标选择器

图标选择器支持：

- 搜索内置图标
- 查看最近使用图标
- 选择自定义 SVG 图标
- 选择局部图标时复用最近使用图标

#### 6. 新建自定义图标

在插件设置的“自定义 SVG 图标”区域，你可以：

- 直接粘贴 SVG
- 导入已有 SVG 文件
- 使用简易画板手绘图标
- 编辑已保存的自定义图标
- 删除不再需要的自定义图标

保存后，自定义图标可以在以下位置复用：

- 全局图标
- 文件规则
- 文件夹规则
- 局部文件图标
- 局部文件夹图标

### 图标优先级

图标生效顺序如下：

1. 局部图标覆盖
2. 文件规则 / 文件夹规则
3. 全局默认图标

如果规则列表中有多个规则命中，则以排序更靠前的规则为准。

### 开发

安装依赖：

```bash
npm install
```

开发构建：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

### 项目文件

- [src/main.ts](./src/main.ts): 插件主逻辑
- [styles.css](./styles.css): 插件样式
- [manifest.json](./manifest.json): Obsidian 插件清单

### 当前版本

- 插件名：`Explorer Icon Studio`
- 插件 ID：`explorer-icon-studio`
- 当前版本：`0.1.0`

### 说明

- 本插件主要作用于 Obsidian 左侧文件管理器
- 图标展示效果可能会受到主题或其他文件树增强插件影响
- 若文件树未即时刷新，可重新切换视图或使用插件刷新命令

## English

### Features

- Replace the default file icon
- Set separate icons for collapsed and expanded folders
- Assign icons by file extension such as `md`, `png`, or `pdf`
- Assign icons by folder name
- Set a custom icon for a specific file or folder
- Drag to reorder file rules and folder rules by priority
- Searchable icon picker
- Recently used icons
- Custom SVG icons
- Simple drawing board for hand-drawn icons that exports SVG
- Import existing SVG files as custom icons
- Automatically refresh icons when the file tree changes

### Good For

- Giving different note types more recognizable icons
- Setting dedicated icons for project, template, or asset folders
- Highlighting important files or folders with per-item overrides
- Building a hand-drawn, branded, or personal Obsidian file tree

### Installation

#### Manual Installation

Copy these files into your vault plugin folder:

- `main.js`
- `manifest.json`
- `styles.css`

Example path:

```text
.obsidian/plugins/explorer-icon-studio/
```

Then enable `Explorer Icon Studio` in Obsidian community plugins.

### Usage

#### 1. Set Global Icons

In plugin settings, you can configure:

- Default file icon
- Default collapsed folder icon
- Default expanded folder icon

These defaults are used when no override or rule matches.

#### 2. Create File Rules

You can assign icons by file extension, for example:

- `md`
- `txt`
- `png`
- `excalidraw`

Rules can be reordered by drag and drop, and earlier rules have higher priority.

#### 3. Create Folder Rules

You can assign icons by folder name, for example:

- `Assets`
- `Templates`
- `Projects`

Folder rules also support drag-and-drop ordering, and each rule can define:

- A collapsed icon
- An expanded icon

#### 4. Set Per-Path Icons

You can assign a custom icon to one specific file or folder.

How to use it:

1. Right-click a file or folder in the file tree
2. Choose the icon action from the context menu
3. Pick an icon in the icon picker

Per-path overrides take priority over global icons and rules.

#### 5. Use the Icon Picker

The icon picker supports:

- Searching built-in icons
- Viewing recently used icons
- Choosing custom SVG icons
- Reusing recent icons while setting per-path overrides

#### 6. Create Custom Icons

In the `Custom SVG Icons` section of plugin settings, you can:

- Paste SVG directly
- Import an existing SVG file
- Draw an icon on the built-in canvas
- Edit saved custom icons
- Delete icons you no longer need

Saved custom icons can be reused in:

- Global icons
- File rules
- Folder rules
- Per-file icons
- Per-folder icons

### Icon Priority

Icons are applied in this order:

1. Per-path overrides
2. File rules / folder rules
3. Global default icons

If multiple rules match, the earlier rule in the list wins.

### Development

Install dependencies:

```bash
npm install
```

Run development build:

```bash
npm run dev
```

Run production build:

```bash
npm run build
```

### Project Files

- [src/main.ts](./src/main.ts): Main plugin logic
- [styles.css](./styles.css): Plugin styles
- [manifest.json](./manifest.json): Obsidian plugin manifest

### Current Version

- Plugin name: `Explorer Icon Studio`
- Plugin ID: `explorer-icon-studio`
- Current version: `0.1.0`

### Notes

- This plugin mainly targets the Obsidian left sidebar file explorer
- Visual results may be affected by your theme or other file-tree-related plugins
- If icons do not refresh immediately, switch views or use the plugin refresh command

## License

MIT
