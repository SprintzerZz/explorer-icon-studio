"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FileFolderIconReplacerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  fileIconRef: "builtin:file",
  folderClosedIconRef: "builtin:folder",
  folderOpenIconRef: "builtin:folder-open",
  pickerColumns: "4",
  pickerDisplayMode: "icon-text",
  recentIcons: [],
  customIcons: [],
  fileRules: [],
  folderRules: [],
  filePathOverrides: [],
  folderPathOverrides: []
};
var DEFAULT_FALLBACK_CUSTOM_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M6 9c0-3 2.7-6 6-6s6 3 6 6c0 7-6 12-6 12S6 16 6 9Z"/><path d="M10 10c.6.6 1.4 1 2 1s1.4-.4 2-1"/></svg>';
var MAX_RECENT_ICONS = 12;
var ICON_CLASS = "file-folder-icon-replacer__icon";
var ITEM_ACTIVE_CLASS = "file-folder-icon-replacer--active";
var FILE_SELECTOR = ".nav-file-title";
var FOLDER_SELECTOR = ".nav-folder-title";
function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `icon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function normalizeBuiltinIconName(value) {
  return value.trim();
}
function normalizeExtension(value) {
  return value.trim().replace(/^\./, "").toLowerCase();
}
function normalizeFolderName(value) {
  return value.trim();
}
function parseIconRef(iconRef) {
  if (iconRef.startsWith("custom:")) {
    return { type: "custom", value: iconRef.slice("custom:".length) };
  }
  if (iconRef.startsWith("builtin:")) {
    return { type: "builtin", value: iconRef.slice("builtin:".length) };
  }
  return { type: "builtin", value: iconRef };
}
function makeBuiltinIconRef(iconName) {
  return `builtin:${normalizeBuiltinIconName(iconName)}`;
}
function makeCustomIconRef(iconId) {
  return `custom:${iconId}`;
}
function getBaseName(path) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}
function getFileExtension(path) {
  const baseName = getBaseName(path);
  const lastDotIndex = baseName.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === baseName.length - 1) {
    return "";
  }
  return baseName.slice(lastDotIndex + 1).toLowerCase();
}
function getFolderName(path) {
  return getBaseName(path);
}
function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
function extractSvgMarkup(svgText) {
  const trimmed = svgText.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.includes("</svg>")) {
    return null;
  }
  return trimmed;
}
function parseSvgElement(svgMarkup) {
  const parser = new DOMParser();
  const documentEl = parser.parseFromString(svgMarkup, "image/svg+xml");
  const svgEl = documentEl.documentElement;
  if (!svgEl.instanceOf(SVGSVGElement) || svgEl.tagName.toLowerCase() !== "svg") {
    return null;
  }
  if (svgEl.querySelector("parsererror")) {
    return null;
  }
  return svgEl.cloneNode(true);
}
function replaceWithSvgMarkup(containerEl, svgMarkup) {
  const svgEl = parseSvgElement(svgMarkup);
  if (!svgEl) {
    return false;
  }
  clearElement(containerEl);
  containerEl.appendChild(svgEl);
  return true;
}
function runAsync(callback) {
  return () => {
    void callback();
  };
}
function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function buildSvgFromStrokes(strokes) {
  const visibleStrokes = strokes.filter((stroke) => stroke.points.length > 0);
  if (visibleStrokes.length === 0) {
    return null;
  }
  const body = visibleStrokes.map((stroke) => {
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      if (!point) {
        return "";
      }
      return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${(stroke.width / 2).toFixed(2)}" fill="currentColor" />`;
    }
    const pathData = stroke.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    return `<path d="${escapeAttribute(pathData)}" fill="none" stroke="currentColor" stroke-width="${stroke.width.toFixed(
      2
    )}" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join("");
  return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
function moveItem(items, draggedId, targetId) {
  if (draggedId === targetId) {
    return items;
  }
  const nextItems = [...items];
  const fromIndex = nextItems.findIndex((item) => item.id === draggedId);
  const toIndex = nextItems.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || toIndex < 0) {
    return items;
  }
  const [movedItem] = nextItems.splice(fromIndex, 1);
  if (!movedItem) {
    return items;
  }
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}
function normalizePickerColumns(value) {
  switch (value) {
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
      return value;
    default:
      return "4";
  }
}
function normalizePickerDisplayMode(value) {
  switch (value) {
    case "icon-only":
    case "text-only":
      return value;
    default:
      return "icon-text";
  }
}
var FileFolderIconReplacerPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.observer = null;
    this.refreshTimer = null;
    this.validIcons = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.refreshValidIcons();
    this.addSettingTab(new IconReplacerSettingTab(this.app, this));
    this.addCommand({
      id: "refresh-file-explorer-icons",
      name: "Refresh file explorer icons",
      callback: () => {
        this.refreshValidIcons();
        this.refreshIcons();
        new import_obsidian.Notice("File explorer icons refreshed");
      }
    });
    this.app.workspace.onLayoutReady(() => {
      this.startObserver();
      this.refreshIcons();
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on("css-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        void this.handleRename(file, oldPath);
      })
    );
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      this.addPathOverrideMenuItems(menu, file);
    }));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => {
      if (files.length === 1) {
        const singleFile = files[0];
        if (singleFile) {
          this.addPathOverrideMenuItems(menu, singleFile);
        }
      }
    }));
  }
  onunload() {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.observer?.disconnect();
    this.observer = null;
    this.cleanupInjectedIcons();
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      fileIconRef: this.migrateLegacyIconRef(loaded?.fileIconRef, loaded?.fileIcon, DEFAULT_SETTINGS.fileIconRef),
      folderClosedIconRef: this.migrateLegacyIconRef(
        loaded?.folderClosedIconRef,
        loaded?.folderClosedIcon,
        DEFAULT_SETTINGS.folderClosedIconRef
      ),
      folderOpenIconRef: this.migrateLegacyIconRef(
        loaded?.folderOpenIconRef,
        loaded?.folderOpenIcon,
        DEFAULT_SETTINGS.folderOpenIconRef
      ),
      pickerColumns: normalizePickerColumns(loaded?.pickerColumns),
      pickerDisplayMode: normalizePickerDisplayMode(loaded?.pickerDisplayMode),
      recentIcons: this.normalizeRecentIcons(loaded?.recentIcons ?? []),
      customIcons: this.normalizeCustomIcons(loaded?.customIcons ?? []),
      fileRules: this.normalizeFileRules(loaded?.fileRules ?? []),
      folderRules: this.normalizeFolderRules(loaded?.folderRules ?? []),
      filePathOverrides: this.normalizeFilePathOverrides(loaded?.filePathOverrides ?? []),
      folderPathOverrides: this.normalizeFolderPathOverrides(loaded?.folderPathOverrides ?? [])
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  refreshValidIcons() {
    this.validIcons = new Set((0, import_obsidian.getIconIds)());
  }
  isIconRefKnown(iconRef) {
    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      return this.settings.customIcons.some((icon) => icon.id === parsed.value);
    }
    return this.validIcons.has(parsed.value);
  }
  describeIconRef(iconRef) {
    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      const icon = this.settings.customIcons.find((item) => item.id === parsed.value);
      return icon ? `${icon.name} (SVG)` : "Missing custom icon";
    }
    return parsed.value;
  }
  addRecentIcon(iconRef) {
    if (!this.isIconRefKnown(iconRef)) {
      return;
    }
    this.settings.recentIcons = [iconRef, ...this.settings.recentIcons.filter((item) => item !== iconRef)].slice(
      0,
      MAX_RECENT_ICONS
    );
  }
  getCustomIcon(iconId) {
    return this.settings.customIcons.find((icon) => icon.id === iconId) ?? null;
  }
  getFilePathOverride(path) {
    return this.settings.filePathOverrides.find((item) => item.path === path) ?? null;
  }
  getFolderPathOverride(path) {
    return this.settings.folderPathOverrides.find((item) => item.path === path) ?? null;
  }
  getPickerColumnsClass() {
    return `mod-columns-${this.settings.pickerColumns}`;
  }
  getPickerDisplayModeClass() {
    switch (this.settings.pickerDisplayMode) {
      case "icon-only":
        return "mod-display-icon-only";
      case "text-only":
        return "mod-display-text-only";
      default:
        return "mod-display-icon-text";
    }
  }
  scheduleRefresh() {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshIcons();
    }, 50);
  }
  async persistAndRefresh() {
    await this.saveSettings();
    this.refreshValidIcons();
    this.refreshIcons();
  }
  async handleRename(file, oldPath) {
    let didChange = false;
    if (file instanceof import_obsidian.TFile) {
      this.settings.filePathOverrides = this.settings.filePathOverrides.map((override) => {
        if (override.path !== oldPath) {
          return override;
        }
        didChange = true;
        return {
          ...override,
          path: file.path
        };
      });
    }
    if (file instanceof import_obsidian.TFolder) {
      const oldPrefix = `${oldPath}/`;
      const newPrefix = `${file.path}/`;
      this.settings.folderPathOverrides = this.settings.folderPathOverrides.map((override) => {
        if (override.path === oldPath) {
          didChange = true;
          return {
            ...override,
            path: file.path
          };
        }
        if (!override.path.startsWith(oldPrefix)) {
          return override;
        }
        didChange = true;
        return {
          ...override,
          path: `${newPrefix}${override.path.slice(oldPrefix.length)}`
        };
      });
      this.settings.filePathOverrides = this.settings.filePathOverrides.map((override) => {
        if (!override.path.startsWith(oldPrefix)) {
          return override;
        }
        didChange = true;
        return {
          ...override,
          path: `${newPrefix}${override.path.slice(oldPrefix.length)}`
        };
      });
    }
    if (didChange) {
      await this.saveSettings();
      this.refreshValidIcons();
    }
    this.scheduleRefresh();
  }
  refreshIcons() {
    const root = this.app.workspace.containerEl;
    if (!root.isConnected) {
      return;
    }
    root.querySelectorAll(FILE_SELECTOR).forEach((fileEl) => {
      fileEl.classList.add(ITEM_ACTIVE_CLASS);
      const contentEl = fileEl.querySelector(".nav-file-title-content");
      if (!contentEl) {
        return;
      }
      const path = fileEl.dataset.path ?? fileEl.getAttribute("data-path") ?? "";
      const iconRef = this.getFileIconRef(path);
      const iconEl = this.ensureIconElement(fileEl, contentEl);
      if (iconEl.dataset.fileFolderIconReplacerInjected === "true") {
        this.hideOriginalIcons(fileEl, contentEl, false);
      }
      this.renderIconRef(iconEl, iconRef, DEFAULT_SETTINGS.fileIconRef);
      iconEl.dataset.iconRole = "file";
      iconEl.dataset.iconSource = iconRef;
    });
    root.querySelectorAll(FOLDER_SELECTOR).forEach((folderTitleEl) => {
      folderTitleEl.classList.add(ITEM_ACTIVE_CLASS);
      const contentEl = folderTitleEl.querySelector(".nav-folder-title-content");
      if (!contentEl) {
        return;
      }
      const path = folderTitleEl.dataset.path ?? folderTitleEl.getAttribute("data-path") ?? "";
      const folderEl = folderTitleEl.closest(".nav-folder");
      const isCollapsed = folderEl?.classList.contains("is-collapsed") ?? false;
      const iconRef = this.getFolderIconRef(path, isCollapsed);
      const iconEl = this.ensureIconElement(folderTitleEl, contentEl);
      if (iconEl.dataset.fileFolderIconReplacerInjected === "true") {
        this.hideOriginalIcons(folderTitleEl, contentEl, true);
      }
      this.renderIconRef(
        iconEl,
        iconRef,
        isCollapsed ? DEFAULT_SETTINGS.folderClosedIconRef : DEFAULT_SETTINGS.folderOpenIconRef
      );
      iconEl.dataset.iconRole = isCollapsed ? "folder-closed" : "folder-open";
      iconEl.dataset.iconSource = iconRef;
    });
  }
  startObserver() {
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          this.scheduleRefresh();
          return;
        }
        if (mutation.type === "attributes" && mutation.target.instanceOf(HTMLElement) && (mutation.target.matches(".nav-folder") || mutation.target.matches(".nav-folder-title"))) {
          this.scheduleRefresh();
          return;
        }
      }
    });
    this.observer.observe(this.app.workspace.containerEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  ensureIconElement(parentEl, contentEl) {
    const existingIconEls = Array.from(
      parentEl.querySelectorAll("[data-file-folder-icon-replacer-icon='true']")
    );
    const [iconEl, ...duplicateIconEls] = existingIconEls;
    duplicateIconEls.forEach((element) => element.remove());
    if (iconEl) {
      return iconEl;
    }
    const reusableIconEl = this.findReusableIconElement(parentEl, contentEl);
    if (reusableIconEl) {
      if (!reusableIconEl.dataset.fileFolderIconReplacerOriginalMarkup) {
        reusableIconEl.dataset.fileFolderIconReplacerOriginalMarkup = reusableIconEl.innerHTML;
      }
      if (!reusableIconEl.dataset.fileFolderIconReplacerOriginalClass) {
        reusableIconEl.dataset.fileFolderIconReplacerOriginalClass = reusableIconEl.className;
      }
      reusableIconEl.classList.add(ICON_CLASS);
      reusableIconEl.dataset.fileFolderIconReplacerIcon = "true";
      reusableIconEl.dataset.fileFolderIconReplacerInjected = "false";
      return reusableIconEl;
    }
    const createdIconEl = createSpan();
    createdIconEl.className = ICON_CLASS;
    createdIconEl.dataset.fileFolderIconReplacerIcon = "true";
    createdIconEl.dataset.fileFolderIconReplacerInjected = "true";
    parentEl.insertBefore(createdIconEl, contentEl);
    return createdIconEl;
  }
  renderIconRef(iconEl, requestedIconRef, fallbackIconRef) {
    const resolvedIconRef = this.isIconRefKnown(requestedIconRef) ? requestedIconRef : fallbackIconRef;
    const parsed = parseIconRef(resolvedIconRef);
    clearElement(iconEl);
    iconEl.classList.remove("mod-custom-svg");
    if (parsed.type === "custom") {
      const customIcon = this.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (svgMarkup && replaceWithSvgMarkup(iconEl, svgMarkup)) {
        iconEl.classList.add("mod-custom-svg");
        iconEl.dataset.iconName = customIcon?.name ?? parsed.value;
        return;
      }
    }
    (0, import_obsidian.setIcon)(iconEl, parsed.value);
    iconEl.dataset.iconName = parsed.value;
  }
  getFileIconRef(path) {
    const pathOverride = this.getFilePathOverride(path);
    if (pathOverride) {
      return pathOverride.iconRef;
    }
    const extension = getFileExtension(path);
    const matchingRule = this.settings.fileRules.find((rule) => rule.extension === extension);
    return matchingRule?.iconRef ?? this.settings.fileIconRef;
  }
  getFolderIconRef(path, isCollapsed) {
    const pathOverride = this.getFolderPathOverride(path);
    if (pathOverride) {
      return isCollapsed ? pathOverride.closedIconRef : pathOverride.openIconRef;
    }
    const folderName = getFolderName(path);
    const matchingRule = this.settings.folderRules.find((rule) => rule.folderName === folderName);
    if (matchingRule) {
      return isCollapsed ? matchingRule.closedIconRef : matchingRule.openIconRef;
    }
    return isCollapsed ? this.settings.folderClosedIconRef : this.settings.folderOpenIconRef;
  }
  cleanupInjectedIcons() {
    this.restoreOriginalIcons();
    this.restoreReusedIconElements();
    this.app.workspace.containerEl.querySelectorAll(`.${ITEM_ACTIVE_CLASS}`).forEach((el) => {
      el.classList.remove(ITEM_ACTIVE_CLASS);
    });
    this.app.workspace.containerEl.querySelectorAll(`.${ICON_CLASS}`).forEach((el) => el.remove());
  }
  findReusableIconElement(parentEl, contentEl) {
    const directChildren = Array.from(parentEl.children);
    const contentIndex = directChildren.indexOf(contentEl);
    const candidates = directChildren.slice(0, contentIndex).filter((child) => child.instanceOf(HTMLElement));
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      if (!candidate || !candidate.instanceOf(HTMLElement)) {
        continue;
      }
      if (this.shouldKeepFolderIndicator(candidate)) {
        continue;
      }
      if (candidate.classList.contains(ICON_CLASS)) {
        return candidate;
      }
      return candidate;
    }
    return null;
  }
  hideOriginalIcons(parentEl, contentEl, isFolderTitle) {
    const directChildren = Array.from(parentEl.children);
    const contentIndex = directChildren.indexOf(contentEl);
    directChildren.forEach((child, index) => {
      if (!child.instanceOf(HTMLElement)) {
        return;
      }
      if (child.classList.contains(ICON_CLASS)) {
        return;
      }
      if (child === contentEl || index > contentIndex) {
        return;
      }
      if (isFolderTitle && this.shouldKeepFolderIndicator(child)) {
        return;
      }
      child.dataset.fileFolderIconReplacerHidden = "true";
    });
    parentEl.querySelectorAll(".svg-icon, .nav-file-title-icon, .nav-folder-title-icon").forEach((element) => {
      if (element.closest(`.${ICON_CLASS}`)) {
        return;
      }
      if (this.shouldKeepFolderIndicator(element)) {
        return;
      }
      const wrapper = element.closest(".nav-file-title-icon, .nav-folder-title-icon, .nav-file-icon, .nav-folder-icon");
      const targetEl = wrapper ?? element;
      if (targetEl === contentEl || contentEl.contains(targetEl)) {
        return;
      }
      targetEl.dataset.fileFolderIconReplacerHidden = "true";
    });
  }
  shouldKeepFolderIndicator(element) {
    return element.classList.contains("collapse-icon") || element.classList.contains("nav-folder-collapse-indicator") || element.classList.contains("tree-item-self-modifier") || element.classList.contains("tree-item-flair-outer") || element.closest(".collapse-icon") !== null || element.closest(".nav-folder-collapse-indicator") !== null;
  }
  restoreOriginalIcons() {
    this.app.workspace.containerEl.querySelectorAll("[data-file-folder-icon-replacer-hidden='true']").forEach((element) => {
      delete element.dataset.fileFolderIconReplacerHidden;
    });
  }
  restoreReusedIconElements() {
    this.app.workspace.containerEl.querySelectorAll(`.${ICON_CLASS}`).forEach((element) => {
      if (element.dataset.fileFolderIconReplacerInjected !== "false") {
        return;
      }
      const originalMarkup = element.dataset.fileFolderIconReplacerOriginalMarkup;
      const originalClass = element.dataset.fileFolderIconReplacerOriginalClass;
      if (typeof originalMarkup === "string") {
        clearElement(element);
        replaceWithSvgMarkup(element, originalMarkup);
      }
      if (typeof originalClass === "string") {
        element.className = originalClass;
      } else {
        element.classList.remove(ICON_CLASS);
      }
      delete element.dataset.fileFolderIconReplacerIcon;
      delete element.dataset.fileFolderIconReplacerInjected;
      delete element.dataset.fileFolderIconReplacerOriginalMarkup;
      delete element.dataset.fileFolderIconReplacerOriginalClass;
    });
  }
  migrateLegacyIconRef(nextValue, legacyValue, fallback) {
    if (nextValue && this.looksLikeIconRef(nextValue)) {
      return nextValue;
    }
    if (nextValue && nextValue.trim()) {
      return makeBuiltinIconRef(nextValue);
    }
    if (legacyValue && legacyValue.trim()) {
      return makeBuiltinIconRef(legacyValue);
    }
    return fallback;
  }
  looksLikeIconRef(value) {
    return value.startsWith("builtin:") || value.startsWith("custom:");
  }
  normalizeRecentIcons(values) {
    return values.filter((value) => typeof value === "string").slice(0, MAX_RECENT_ICONS);
  }
  normalizeCustomIcons(values) {
    return values.filter((value) => value && typeof value.id === "string" && typeof value.name === "string" && typeof value.svg === "string").map((value) => ({
      id: value.id,
      name: value.name.trim() || "Custom SVG",
      svg: value.svg.trim()
    }));
  }
  normalizeFileRules(values) {
    return values.filter((value) => value && typeof value.id === "string").map((value) => ({
      id: value.id,
      extension: normalizeExtension(value.extension ?? ""),
      iconRef: this.migrateLegacyIconRef(value.iconRef, void 0, DEFAULT_SETTINGS.fileIconRef)
    })).filter((value) => value.extension.length > 0);
  }
  normalizeFolderRules(values) {
    return values.filter((value) => value && typeof value.id === "string").map((value) => ({
      id: value.id,
      folderName: normalizeFolderName(value.folderName ?? ""),
      closedIconRef: this.migrateLegacyIconRef(value.closedIconRef, void 0, DEFAULT_SETTINGS.folderClosedIconRef),
      openIconRef: this.migrateLegacyIconRef(value.openIconRef, void 0, DEFAULT_SETTINGS.folderOpenIconRef)
    })).filter((value) => value.folderName.length > 0);
  }
  normalizeFilePathOverrides(values) {
    return values.filter((value) => value && typeof value.id === "string").map((value) => ({
      id: value.id,
      path: value.path?.trim() ?? "",
      iconRef: this.migrateLegacyIconRef(value.iconRef, void 0, DEFAULT_SETTINGS.fileIconRef)
    })).filter((value) => value.path.length > 0);
  }
  normalizeFolderPathOverrides(values) {
    return values.filter((value) => value && typeof value.id === "string").map((value) => ({
      id: value.id,
      path: value.path?.trim() ?? "",
      closedIconRef: this.migrateLegacyIconRef(value.closedIconRef, void 0, DEFAULT_SETTINGS.folderClosedIconRef),
      openIconRef: this.migrateLegacyIconRef(value.openIconRef, void 0, DEFAULT_SETTINGS.folderOpenIconRef)
    })).filter((value) => value.path.length > 0);
  }
  addPathOverrideMenuItems(menu, file) {
    if (file instanceof import_obsidian.TFolder) {
      menu.addItem((item) => {
        item.setTitle("Set folder icon for this folder").setIcon("paintbrush").onClick(() => {
          this.openFolderOverridePicker(file);
        });
      });
      if (this.getFolderPathOverride(file.path)) {
        menu.addItem((item) => {
          item.setTitle("Clear custom folder icon").setIcon("eraser").setWarning(true).onClick(runAsync(async () => {
            this.settings.folderPathOverrides = this.settings.folderPathOverrides.filter((entry) => entry.path !== file.path);
            await this.persistAndRefresh();
            new import_obsidian.Notice(`Cleared folder icon: ${file.path}`);
          }));
        });
      }
      return;
    }
    if (file instanceof import_obsidian.TFile) {
      menu.addItem((item) => {
        item.setTitle("Set file icon for this file").setIcon("paintbrush").onClick(() => {
          this.openFileOverridePicker(file);
        });
      });
      if (this.getFilePathOverride(file.path)) {
        menu.addItem((item) => {
          item.setTitle("Clear custom file icon").setIcon("eraser").setWarning(true).onClick(runAsync(async () => {
            this.settings.filePathOverrides = this.settings.filePathOverrides.filter((entry) => entry.path !== file.path);
            await this.persistAndRefresh();
            new import_obsidian.Notice(`Cleared file icon: ${file.path}`);
          }));
        });
      }
    }
  }
  openFileOverridePicker(file) {
    const existing = this.getFilePathOverride(file.path);
    new IconPickerModal(this.app, {
      plugin: this,
      selectedIconRef: existing?.iconRef ?? this.getFileIconRef(file.path),
      title: `File Icon - ${file.name}`,
      onChoose: async (iconRef) => {
        const nextOverride = existing ?? {
          id: createId(),
          path: file.path,
          iconRef
        };
        nextOverride.iconRef = iconRef;
        this.settings.filePathOverrides = [
          ...this.settings.filePathOverrides.filter((item) => item.path !== file.path),
          nextOverride
        ];
        this.addRecentIcon(iconRef);
        await this.persistAndRefresh();
        new import_obsidian.Notice(`Set file icon: ${file.path}`);
      }
    }).open();
  }
  openFolderOverridePicker(folder) {
    const existing = this.getFolderPathOverride(folder.path);
    new FolderOverridePickerModal(this.app, {
      plugin: this,
      folder,
      selectedClosedIconRef: existing?.closedIconRef ?? this.getFolderIconRef(folder.path, true),
      selectedOpenIconRef: existing?.openIconRef ?? this.getFolderIconRef(folder.path, false),
      onChoose: async (closedIconRef, openIconRef) => {
        const nextOverride = existing ?? {
          id: createId(),
          path: folder.path,
          closedIconRef,
          openIconRef
        };
        nextOverride.closedIconRef = closedIconRef;
        nextOverride.openIconRef = openIconRef;
        this.settings.folderPathOverrides = [
          ...this.settings.folderPathOverrides.filter((item) => item.path !== folder.path),
          nextOverride
        ];
        this.addRecentIcon(closedIconRef);
        this.addRecentIcon(openIconRef);
        await this.persistAndRefresh();
        new import_obsidian.Notice(`Set folder icon: ${folder.path}`);
      }
    }).open();
  }
};
var IconReplacerSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.draggedFileRuleId = null;
    this.draggedFolderRuleId = null;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("File Folder Icon Replacer").setHeading();
    containerEl.createEl("p", {
      text: "\u652F\u6301\u5168\u5C40\u56FE\u6807\u3001\u6700\u8FD1\u4F7F\u7528\u3001\u81EA\u5B9A\u4E49 SVG \u56FE\u6807\u3001\u6309\u6587\u4EF6\u540E\u7F00\u89C4\u5219\uFF0C\u4EE5\u53CA\u6309\u6587\u4EF6\u5939\u540D\u79F0\u89C4\u5219\u3002"
    });
    this.renderGlobalSection();
    this.renderRecentSection();
    this.renderCustomIconsSection();
    this.renderPathOverridesSection();
    this.renderFileRulesSection();
    this.renderFolderRulesSection();
  }
  renderGlobalSection() {
    new import_obsidian.Setting(this.containerEl).setName("\u5168\u5C40\u56FE\u6807").setHeading();
    this.addIconSetting(
      "\u6587\u4EF6\u56FE\u6807",
      "\u6240\u6709\u666E\u901A\u6587\u4EF6\u7684\u9ED8\u8BA4\u56FE\u6807\u3002",
      this.plugin.settings.fileIconRef,
      DEFAULT_SETTINGS.fileIconRef,
      async (iconRef) => {
        this.plugin.settings.fileIconRef = iconRef;
      }
    );
    this.addIconSetting(
      "\u6587\u4EF6\u5939\u6298\u53E0\u56FE\u6807",
      "\u672A\u5C55\u5F00\u6587\u4EF6\u5939\u7684\u9ED8\u8BA4\u56FE\u6807\u3002",
      this.plugin.settings.folderClosedIconRef,
      DEFAULT_SETTINGS.folderClosedIconRef,
      async (iconRef) => {
        this.plugin.settings.folderClosedIconRef = iconRef;
      }
    );
    this.addIconSetting(
      "\u6587\u4EF6\u5939\u5C55\u5F00\u56FE\u6807",
      "\u5C55\u5F00\u540E\u6587\u4EF6\u5939\u7684\u9ED8\u8BA4\u56FE\u6807\u3002",
      this.plugin.settings.folderOpenIconRef,
      DEFAULT_SETTINGS.folderOpenIconRef,
      async (iconRef) => {
        this.plugin.settings.folderOpenIconRef = iconRef;
      }
    );
  }
  renderRecentSection() {
    new import_obsidian.Setting(this.containerEl).setName("\u6700\u8FD1\u4F7F\u7528").setHeading();
    const helpEl = this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "\u8FD9\u91CC\u4F1A\u663E\u793A\u4F60\u6700\u8FD1\u9009\u62E9\u8FC7\u7684\u5185\u7F6E\u56FE\u6807\u548C\u81EA\u5B9A\u4E49 SVG \u56FE\u6807\u3002"
    });
    const gridEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__recent-grid" });
    if (this.plugin.settings.recentIcons.length === 0) {
      gridEl.createDiv({
        cls: "file-folder-icon-replacer__empty-state",
        text: "\u8FD8\u6CA1\u6709\u6700\u8FD1\u4F7F\u7528\u7684\u56FE\u6807\u3002"
      });
      return;
    }
    this.plugin.settings.recentIcons.forEach((iconRef) => {
      const itemEl = gridEl.createDiv({
        cls: "file-folder-icon-replacer__recent-item"
      });
      const previewEl = itemEl.createSpan({ cls: "file-folder-icon-replacer__recent-item-icon" });
      this.renderPreview(previewEl, iconRef);
      itemEl.createSpan({
        cls: "file-folder-icon-replacer__recent-item-label",
        text: this.plugin.describeIconRef(iconRef)
      });
      const deleteButton = itemEl.createEl("button", {
        cls: "file-folder-icon-replacer__recent-item-delete",
        text: "\u79FB\u9664",
        attr: { type: "button" }
      });
      deleteButton.addEventListener("click", runAsync(async () => {
        this.plugin.settings.recentIcons = this.plugin.settings.recentIcons.filter((item) => item !== iconRef);
        await this.plugin.saveSettings();
        this.display();
      }));
    });
    helpEl.insertAdjacentText("beforeend", " \u9009\u62E9\u5668\u4E2D\u4E5F\u4F1A\u4F18\u5148\u663E\u793A\u8FD9\u4E9B\u56FE\u6807\u3002");
  }
  renderCustomIconsSection() {
    new import_obsidian.Setting(this.containerEl).setName("\u81EA\u5B9A\u4E49 SVG \u56FE\u6807").setHeading();
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "\u53EF\u7C98\u8D34\u6216\u624B\u5199 SVG\uFF0C\u7528\u4F5C\u4F60\u7684\u624B\u7ED8\u56FE\u6807\u3002\u4FDD\u5B58\u540E\u4F1A\u51FA\u73B0\u5728\u9009\u62E9\u5668\u548C\u89C4\u5219\u9762\u677F\u91CC\u3002"
    });
    new import_obsidian.Setting(this.containerEl).setName("\u65B0\u589E\u81EA\u5B9A\u4E49\u56FE\u6807").setDesc("\u521B\u5EFA\u4E00\u4E2A\u53EF\u4EE5\u5728\u4EFB\u4F55\u89C4\u5219\u91CC\u590D\u7528\u7684 SVG \u56FE\u6807\u3002").addButton((button) => {
      button.setButtonText("\u65B0\u5EFA SVG").onClick(() => {
        new CustomIconEditorModal(this.app, {
          plugin: this.plugin,
          onSave: async (icon) => {
            this.plugin.settings.customIcons.push(icon);
            this.plugin.addRecentIcon(makeCustomIconRef(icon.id));
            await this.plugin.persistAndRefresh();
            this.display();
            new import_obsidian.Notice(`\u5DF2\u6DFB\u52A0\u81EA\u5B9A\u4E49\u56FE\u6807: ${icon.name}`);
          }
        }).open();
      });
    });
    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__custom-list" });
    if (this.plugin.settings.customIcons.length === 0) {
      listEl.createDiv({
        cls: "file-folder-icon-replacer__empty-state",
        text: "\u8FD8\u6CA1\u6709\u81EA\u5B9A\u4E49 SVG \u56FE\u6807\u3002"
      });
      return;
    }
    this.plugin.settings.customIcons.forEach((icon) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-header" });
      const previewEl = headerEl.createSpan({ cls: "file-folder-icon-replacer__rule-preview" });
      this.renderPreview(previewEl, makeCustomIconRef(icon.id));
      const titleWrapEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-title-wrap" });
      titleWrapEl.createEl("strong", { text: icon.name });
      titleWrapEl.createDiv({
        cls: "file-folder-icon-replacer__rule-meta",
        text: `ID: ${icon.id}`
      });
      const actionEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-actions" });
      const editButton = actionEl.createEl("button", { text: "\u7F16\u8F91", attr: { type: "button" } });
      editButton.addEventListener("click", () => {
        new CustomIconEditorModal(this.app, {
          plugin: this.plugin,
          icon,
          onSave: async (nextIcon) => {
            const index = this.plugin.settings.customIcons.findIndex((item) => item.id === nextIcon.id);
            if (index >= 0) {
              this.plugin.settings.customIcons[index] = nextIcon;
            }
            this.plugin.addRecentIcon(makeCustomIconRef(nextIcon.id));
            await this.plugin.persistAndRefresh();
            this.display();
            new import_obsidian.Notice(`\u5DF2\u66F4\u65B0\u81EA\u5B9A\u4E49\u56FE\u6807: ${nextIcon.name}`);
          }
        }).open();
      });
      const deleteButton = actionEl.createEl("button", {
        text: "\u5220\u9664",
        cls: "mod-warning",
        attr: { type: "button" }
      });
      deleteButton.addEventListener("click", runAsync(async () => {
        this.plugin.settings.customIcons = this.plugin.settings.customIcons.filter((item) => item.id !== icon.id);
        this.plugin.settings.recentIcons = this.plugin.settings.recentIcons.filter(
          (item) => item !== makeCustomIconRef(icon.id)
        );
        this.plugin.settings.fileRules = this.plugin.settings.fileRules.map((rule) => ({
          ...rule,
          iconRef: rule.iconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.fileIconRef : rule.iconRef
        }));
        this.plugin.settings.folderRules = this.plugin.settings.folderRules.map((rule) => ({
          ...rule,
          closedIconRef: rule.closedIconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.folderClosedIconRef : rule.closedIconRef,
          openIconRef: rule.openIconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.folderOpenIconRef : rule.openIconRef
        }));
        this.plugin.settings.filePathOverrides = this.plugin.settings.filePathOverrides.map((override) => ({
          ...override,
          iconRef: override.iconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.fileIconRef : override.iconRef
        }));
        this.plugin.settings.folderPathOverrides = this.plugin.settings.folderPathOverrides.map((override) => ({
          ...override,
          closedIconRef: override.closedIconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.folderClosedIconRef : override.closedIconRef,
          openIconRef: override.openIconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.folderOpenIconRef : override.openIconRef
        }));
        if (this.plugin.settings.fileIconRef === makeCustomIconRef(icon.id)) {
          this.plugin.settings.fileIconRef = DEFAULT_SETTINGS.fileIconRef;
        }
        if (this.plugin.settings.folderClosedIconRef === makeCustomIconRef(icon.id)) {
          this.plugin.settings.folderClosedIconRef = DEFAULT_SETTINGS.folderClosedIconRef;
        }
        if (this.plugin.settings.folderOpenIconRef === makeCustomIconRef(icon.id)) {
          this.plugin.settings.folderOpenIconRef = DEFAULT_SETTINGS.folderOpenIconRef;
        }
        await this.plugin.persistAndRefresh();
        this.display();
        new import_obsidian.Notice(`\u5DF2\u5220\u9664\u81EA\u5B9A\u4E49\u56FE\u6807: ${icon.name}`);
      }));
    });
  }
  renderPathOverridesSection() {
    new import_obsidian.Setting(this.containerEl).setName("\u5C40\u90E8\u56FE\u6807").setHeading();
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "\u8FD9\u91CC\u663E\u793A\u901A\u8FC7\u6587\u4EF6\u7BA1\u7406\u5668\u53F3\u952E\u83DC\u5355\u4E3A\u5177\u4F53\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u8BBE\u7F6E\u7684\u56FE\u6807\u3002\u5B83\u4EEC\u7684\u4F18\u5148\u7EA7\u9AD8\u4E8E\u540E\u7F00\u89C4\u5219\u548C\u540D\u79F0\u89C4\u5219\u3002"
    });
    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    const fileOverrides = this.plugin.settings.filePathOverrides;
    const folderOverrides = this.plugin.settings.folderPathOverrides;
    if (fileOverrides.length === 0 && folderOverrides.length === 0) {
      listEl.createDiv({
        cls: "file-folder-icon-replacer__empty-state",
        text: "\u8FD8\u6CA1\u6709\u5C40\u90E8\u56FE\u6807\u3002"
      });
      return;
    }
    fileOverrides.forEach((override) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-header" });
      const previewEl = headerEl.createSpan({ cls: "file-folder-icon-replacer__rule-preview" });
      this.renderPreview(previewEl, override.iconRef);
      const titleWrapEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-title-wrap" });
      titleWrapEl.createEl("strong", { text: getBaseName(override.path) });
      titleWrapEl.createDiv({
        cls: "file-folder-icon-replacer__rule-meta",
        text: override.path
      });
      const actionEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-actions" });
      const editButton = actionEl.createEl("button", { text: "\u6539\u56FE\u6807", attr: { type: "button" } });
      editButton.addEventListener("click", () => {
        new IconPickerModal(this.app, {
          plugin: this.plugin,
          selectedIconRef: override.iconRef,
          title: `File Icon - ${getBaseName(override.path)}`,
          onChoose: async (iconRef) => {
            override.iconRef = iconRef;
            this.plugin.addRecentIcon(iconRef);
            await this.plugin.persistAndRefresh();
            this.display();
          }
        }).open();
      });
      const deleteButton = actionEl.createEl("button", {
        text: "\u6E05\u9664",
        cls: "mod-warning",
        attr: { type: "button" }
      });
      deleteButton.addEventListener("click", runAsync(async () => {
        this.plugin.settings.filePathOverrides = this.plugin.settings.filePathOverrides.filter((item) => item.id !== override.id);
        await this.plugin.persistAndRefresh();
        this.display();
      }));
    });
    folderOverrides.forEach((override) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-header" });
      const previewWrapEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__override-preview-pair" });
      const closedPreviewEl = previewWrapEl.createSpan({ cls: "file-folder-icon-replacer__rule-preview" });
      const openPreviewEl = previewWrapEl.createSpan({ cls: "file-folder-icon-replacer__rule-preview" });
      this.renderPreview(closedPreviewEl, override.closedIconRef);
      this.renderPreview(openPreviewEl, override.openIconRef);
      const titleWrapEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-title-wrap" });
      titleWrapEl.createEl("strong", { text: getBaseName(override.path) });
      titleWrapEl.createDiv({
        cls: "file-folder-icon-replacer__rule-meta",
        text: override.path
      });
      const actionEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-actions" });
      const editButton = actionEl.createEl("button", { text: "\u6539\u56FE\u6807", attr: { type: "button" } });
      editButton.addEventListener("click", () => {
        const folder = this.app.vault.getAbstractFileByPath(override.path);
        if (!(folder instanceof import_obsidian.TFolder)) {
          new import_obsidian.Notice(`Folder not found: ${override.path}`);
          return;
        }
        this.plugin.openFolderOverridePicker(folder);
      });
      const deleteButton = actionEl.createEl("button", {
        text: "\u6E05\u9664",
        cls: "mod-warning",
        attr: { type: "button" }
      });
      deleteButton.addEventListener("click", runAsync(async () => {
        this.plugin.settings.folderPathOverrides = this.plugin.settings.folderPathOverrides.filter(
          (item) => item.id !== override.id
        );
        await this.plugin.persistAndRefresh();
        this.display();
      }));
    });
  }
  renderFileRulesSection() {
    new import_obsidian.Setting(this.containerEl).setName("\u6309\u6587\u4EF6\u540E\u7F00\u66FF\u6362").setHeading();
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "\u6309\u540E\u7F00\u7CBE\u786E\u5339\u914D\uFF0C\u4F8B\u5982 md\u3001png\u3001pdf\u3001ts\u3002\u89C4\u5219\u6309\u5217\u8868\u987A\u5E8F\u5339\u914D\uFF0C\u7B2C\u4E00\u4E2A\u547D\u4E2D\u7684\u89C4\u5219\u751F\u6548\u3002"
    });
    new import_obsidian.Setting(this.containerEl).setName("\u65B0\u589E\u6587\u4EF6\u89C4\u5219").setDesc("\u4E3A\u7279\u5B9A\u540E\u7F00\u8BBE\u7F6E\u56FE\u6807\u3002").addButton((button) => {
      button.setButtonText("\u6DFB\u52A0\u89C4\u5219").onClick(runAsync(async () => {
        this.plugin.settings.fileRules.push({
          id: createId(),
          extension: "md",
          iconRef: makeBuiltinIconRef("file-text")
        });
        await this.plugin.persistAndRefresh();
        this.display();
      }));
    });
    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    if (this.plugin.settings.fileRules.length === 0) {
      listEl.createDiv({
        cls: "file-folder-icon-replacer__empty-state",
        text: "\u8FD8\u6CA1\u6709\u6587\u4EF6\u540E\u7F00\u89C4\u5219\u3002"
      });
      return;
    }
    this.plugin.settings.fileRules.forEach((rule) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      this.attachRuleDragHandlers(cardEl, "file", rule.id);
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-order" });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__drag-handle",
        text: "\u22EE\u22EE \u62D6\u52A8\u6392\u5E8F"
      });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__rule-priority",
        text: `\u4F18\u5148\u7EA7 ${this.plugin.settings.fileRules.findIndex((item) => item.id === rule.id) + 1}`
      });
      const rowEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-grid file-folder-icon-replacer__rule-grid--file" });
      const extWrapEl = rowEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      extWrapEl.createEl("label", { text: "\u540E\u7F00" });
      const extInputEl = extWrapEl.createEl("input", {
        attr: { type: "text", placeholder: "\u4F8B\u5982 md" }
      });
      extInputEl.value = rule.extension;
      extInputEl.addEventListener("change", runAsync(async () => {
        rule.extension = normalizeExtension(extInputEl.value);
        extInputEl.value = rule.extension;
        await this.plugin.persistAndRefresh();
      }));
      const iconWrapEl = rowEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      iconWrapEl.createEl("label", { text: "\u56FE\u6807" });
      this.buildRuleIconPicker(
        iconWrapEl,
        rule.iconRef,
        DEFAULT_SETTINGS.fileIconRef,
        async (nextIconRef) => {
          rule.iconRef = nextIconRef;
        }
      );
      const actionEl = rowEl.createDiv({ cls: "file-folder-icon-replacer__rule-inline-actions" });
      const deleteButton = actionEl.createEl("button", { text: "\u5220\u9664", cls: "mod-warning", attr: { type: "button" } });
      deleteButton.addEventListener("click", runAsync(async () => {
        this.plugin.settings.fileRules = this.plugin.settings.fileRules.filter((item) => item.id !== rule.id);
        await this.plugin.persistAndRefresh();
        this.display();
      }));
    });
  }
  renderFolderRulesSection() {
    new import_obsidian.Setting(this.containerEl).setName("\u6309\u6587\u4EF6\u5939\u540D\u79F0\u66FF\u6362").setHeading();
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "\u6309\u6587\u4EF6\u5939\u540D\u79F0\u7CBE\u786E\u5339\u914D\uFF0C\u4F8B\u5982 Assets\u3001Templates\u3001Projects\u3002\u53EF\u5206\u522B\u8BBE\u7F6E\u6298\u53E0\u548C\u5C55\u5F00\u56FE\u6807\u3002"
    });
    new import_obsidian.Setting(this.containerEl).setName("\u65B0\u589E\u6587\u4EF6\u5939\u89C4\u5219").setDesc("\u4E3A\u7279\u5B9A\u6587\u4EF6\u5939\u540D\u79F0\u8BBE\u7F6E\u56FE\u6807\u3002").addButton((button) => {
      button.setButtonText("\u6DFB\u52A0\u89C4\u5219").onClick(runAsync(async () => {
        this.plugin.settings.folderRules.push({
          id: createId(),
          folderName: "Assets",
          closedIconRef: makeBuiltinIconRef("folder"),
          openIconRef: makeBuiltinIconRef("folder-open")
        });
        await this.plugin.persistAndRefresh();
        this.display();
      }));
    });
    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    if (this.plugin.settings.folderRules.length === 0) {
      listEl.createDiv({
        cls: "file-folder-icon-replacer__empty-state",
        text: "\u8FD8\u6CA1\u6709\u6587\u4EF6\u5939\u540D\u79F0\u89C4\u5219\u3002"
      });
      return;
    }
    this.plugin.settings.folderRules.forEach((rule) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      this.attachRuleDragHandlers(cardEl, "folder", rule.id);
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-order" });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__drag-handle",
        text: "\u22EE\u22EE \u62D6\u52A8\u6392\u5E8F"
      });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__rule-priority",
        text: `\u4F18\u5148\u7EA7 ${this.plugin.settings.folderRules.findIndex((item) => item.id === rule.id) + 1}`
      });
      const nameWrapEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      nameWrapEl.createEl("label", { text: "\u6587\u4EF6\u5939\u540D\u79F0" });
      const nameInputEl = nameWrapEl.createEl("input", {
        attr: { type: "text", placeholder: "\u4F8B\u5982 Assets" }
      });
      nameInputEl.value = rule.folderName;
      nameInputEl.addEventListener("change", runAsync(async () => {
        rule.folderName = normalizeFolderName(nameInputEl.value);
        nameInputEl.value = rule.folderName;
        await this.plugin.persistAndRefresh();
      }));
      const gridEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-grid file-folder-icon-replacer__rule-grid--folder" });
      const closedWrapEl = gridEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      closedWrapEl.createEl("label", { text: "\u6298\u53E0\u56FE\u6807" });
      this.buildRuleIconPicker(
        closedWrapEl,
        rule.closedIconRef,
        DEFAULT_SETTINGS.folderClosedIconRef,
        async (nextIconRef) => {
          rule.closedIconRef = nextIconRef;
        }
      );
      const openWrapEl = gridEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      openWrapEl.createEl("label", { text: "\u5C55\u5F00\u56FE\u6807" });
      this.buildRuleIconPicker(
        openWrapEl,
        rule.openIconRef,
        DEFAULT_SETTINGS.folderOpenIconRef,
        async (nextIconRef) => {
          rule.openIconRef = nextIconRef;
        }
      );
      const actionEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-inline-actions" });
      const deleteButton = actionEl.createEl("button", { text: "\u5220\u9664\u89C4\u5219", cls: "mod-warning", attr: { type: "button" } });
      deleteButton.addEventListener("click", runAsync(async () => {
        this.plugin.settings.folderRules = this.plugin.settings.folderRules.filter((item) => item.id !== rule.id);
        await this.plugin.persistAndRefresh();
        this.display();
      }));
    });
  }
  addIconSetting(name, desc, value, fallbackValue, onSave) {
    let currentValue = value;
    let previewEl = null;
    let labelEl = null;
    const setting = new import_obsidian.Setting(this.containerEl).setName(name).setDesc(desc).addButton((button) => {
      button.setButtonText("\u9009\u62E9\u56FE\u6807").onClick(() => {
        new IconPickerModal(this.app, {
          plugin: this.plugin,
          selectedIconRef: currentValue,
          title: name,
          onChoose: async (iconRef) => {
            currentValue = iconRef;
            await onSave(iconRef);
            this.plugin.addRecentIcon(iconRef);
            await this.plugin.persistAndRefresh();
            this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
          }
        }).open();
      });
    }).addExtraButton((button) => {
      button.setIcon("reset").setTooltip("\u6062\u590D\u9ED8\u8BA4\u56FE\u6807").onClick(async () => {
        currentValue = fallbackValue;
        await onSave(fallbackValue);
        this.plugin.addRecentIcon(fallbackValue);
        await this.plugin.persistAndRefresh();
        this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
      });
    });
    const controlEl = setting.controlEl;
    const pillEl = controlEl.createDiv({ cls: "file-folder-icon-replacer__selection-pill" });
    previewEl = pillEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    labelEl = pillEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
  }
  buildRuleIconPicker(containerEl, value, fallbackValue, onSave) {
    let currentValue = value;
    const pickerEl = containerEl.createDiv({ cls: "file-folder-icon-replacer__inline-picker" });
    const previewEl = pickerEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    const labelEl = pickerEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    const chooseButton = pickerEl.createEl("button", { text: "\u9009\u62E9", attr: { type: "button" } });
    const resetButton = pickerEl.createEl("button", { text: "\u9ED8\u8BA4", attr: { type: "button" } });
    this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
    chooseButton.addEventListener("click", () => {
      new IconPickerModal(this.app, {
        plugin: this.plugin,
        selectedIconRef: currentValue,
        title: "\u9009\u62E9\u89C4\u5219\u56FE\u6807",
        onChoose: async (iconRef) => {
          currentValue = iconRef;
          await onSave(iconRef);
          this.plugin.addRecentIcon(iconRef);
          await this.plugin.persistAndRefresh();
          this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
        }
      }).open();
    });
    resetButton.addEventListener("click", async () => {
      currentValue = fallbackValue;
      await onSave(fallbackValue);
      this.plugin.addRecentIcon(fallbackValue);
      await this.plugin.persistAndRefresh();
      this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
    });
  }
  updatePreviewAndLabel(previewEl, labelEl, iconRef) {
    if (previewEl) {
      this.renderPreview(previewEl, iconRef);
    }
    if (labelEl) {
      labelEl.textContent = this.plugin.describeIconRef(iconRef);
      labelEl.title = iconRef;
    }
  }
  renderPreview(previewEl, iconRef) {
    clearElement(previewEl);
    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      const customIcon = this.plugin.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (svgMarkup && replaceWithSvgMarkup(previewEl, svgMarkup)) {
        return;
      }
    }
    if (parsed.type === "builtin" && this.plugin.isIconRefKnown(iconRef)) {
      (0, import_obsidian.setIcon)(previewEl, parsed.value);
      return;
    }
    (0, import_obsidian.setIcon)(previewEl, "circle-help");
  }
  attachRuleDragHandlers(cardEl, type, ruleId) {
    cardEl.draggable = true;
    cardEl.dataset.ruleType = type;
    cardEl.dataset.ruleId = ruleId;
    cardEl.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) {
        return;
      }
      if (type === "file") {
        this.draggedFileRuleId = ruleId;
      } else {
        this.draggedFolderRuleId = ruleId;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", ruleId);
      cardEl.classList.add("is-dragging");
    });
    cardEl.addEventListener("dragend", () => {
      if (type === "file") {
        this.draggedFileRuleId = null;
      } else {
        this.draggedFolderRuleId = null;
      }
      this.containerEl.querySelectorAll(".file-folder-icon-replacer__rule-card").forEach((el) => {
        el.classList.remove("is-dragging", "is-drag-target");
      });
    });
    cardEl.addEventListener("dragover", (event) => {
      const draggedId = type === "file" ? this.draggedFileRuleId : this.draggedFolderRuleId;
      if (!draggedId || draggedId === ruleId) {
        return;
      }
      event.preventDefault();
      cardEl.classList.add("is-drag-target");
    });
    cardEl.addEventListener("dragleave", () => {
      cardEl.classList.remove("is-drag-target");
    });
    cardEl.addEventListener("drop", async (event) => {
      event.preventDefault();
      cardEl.classList.remove("is-drag-target");
      const draggedId = type === "file" ? this.draggedFileRuleId : this.draggedFolderRuleId;
      if (!draggedId || draggedId === ruleId) {
        return;
      }
      if (type === "file") {
        this.plugin.settings.fileRules = moveItem(this.plugin.settings.fileRules, draggedId, ruleId);
        this.draggedFileRuleId = null;
      } else {
        this.plugin.settings.folderRules = moveItem(this.plugin.settings.folderRules, draggedId, ruleId);
        this.draggedFolderRuleId = null;
      }
      await this.plugin.persistAndRefresh();
      this.display();
    });
  }
};
var IconPickerModal = class extends import_obsidian.Modal {
  constructor(app, options) {
    super(app);
    this.searchInputEl = null;
    this.currentSelectionEl = null;
    this.columnsSelectEl = null;
    this.displayModeSelectEl = null;
    this.recentGridEl = null;
    this.allGridEl = null;
    this.options = options;
    this.builtinIconNames = (0, import_obsidian.getIconIds)().slice().sort((a, b) => a.localeCompare(b));
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.classList.add("file-folder-icon-replacer__picker-modal");
    modalEl.classList.add(this.options.plugin.getPickerColumnsClass());
    modalEl.classList.add(this.options.plugin.getPickerDisplayModeClass());
    contentEl.empty();
    contentEl.createEl("h2", { text: `${this.options.title} - \u9009\u62E9\u56FE\u6807` });
    const toolbarEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__picker-toolbar" });
    toolbarEl.createEl("p", {
      cls: "file-folder-icon-replacer__picker-help",
      text: "\u5148\u770B\u6700\u8FD1\u4F7F\u7528\uFF0C\u518D\u4ECE\u5168\u90E8\u56FE\u6807\u91CC\u641C\u7D22\u3002\u5F53\u524D\u9009\u62E9\u4F1A\u56FA\u5B9A\u663E\u793A\u5728\u9876\u90E8\u3002"
    });
    const controlsEl = toolbarEl.createDiv({ cls: "file-folder-icon-replacer__picker-controls" });
    const columnsFieldEl = controlsEl.createDiv({ cls: "file-folder-icon-replacer__picker-control" });
    columnsFieldEl.createEl("label", { text: "\u5217\u6570" });
    this.columnsSelectEl = columnsFieldEl.createEl("select");
    [
      ["2", "2 \u5217"],
      ["3", "3 \u5217"],
      ["4", "4 \u5217"],
      ["5", "5 \u5217"],
      ["6", "6 \u5217"]
    ].forEach(([value, label]) => {
      this.columnsSelectEl?.createEl("option", {
        value,
        text: label
      });
    });
    this.columnsSelectEl.value = this.options.plugin.settings.pickerColumns;
    this.columnsSelectEl.addEventListener("change", async () => {
      this.options.plugin.settings.pickerColumns = normalizePickerColumns(this.columnsSelectEl?.value);
      await this.options.plugin.saveSettings();
      this.syncModalAppearanceClasses();
    });
    const modeFieldEl = controlsEl.createDiv({ cls: "file-folder-icon-replacer__picker-control" });
    modeFieldEl.createEl("label", { text: "\u663E\u793A" });
    this.displayModeSelectEl = modeFieldEl.createEl("select");
    [
      ["icon-text", "\u56FE\u6807 + \u6587\u5B57"],
      ["icon-only", "\u4EC5\u56FE\u6807"],
      ["text-only", "\u4EC5\u6587\u5B57"]
    ].forEach(([value, label]) => {
      this.displayModeSelectEl?.createEl("option", {
        value,
        text: label
      });
    });
    this.displayModeSelectEl.value = this.options.plugin.settings.pickerDisplayMode;
    this.displayModeSelectEl.addEventListener("change", async () => {
      this.options.plugin.settings.pickerDisplayMode = normalizePickerDisplayMode(this.displayModeSelectEl?.value);
      await this.options.plugin.saveSettings();
      this.syncModalAppearanceClasses();
    });
    this.currentSelectionEl = toolbarEl.createDiv({
      cls: "file-folder-icon-replacer__picker-current"
    });
    this.renderCurrentSelection();
    this.searchInputEl = toolbarEl.createEl("input", {
      cls: "file-folder-icon-replacer__picker-search",
      attr: {
        type: "search",
        placeholder: "\u641C\u7D22\u56FE\u6807\uFF0C\u4F8B\u5982 folder\u3001file\u3001image"
      }
    });
    this.searchInputEl.addEventListener("input", () => this.renderSections(this.searchInputEl?.value ?? ""));
    const recentSectionEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__picker-section" });
    recentSectionEl.createEl("h3", { text: "\u6700\u8FD1\u4F7F\u7528" });
    this.recentGridEl = recentSectionEl.createDiv({
      cls: "file-folder-icon-replacer__picker-grid file-folder-icon-replacer__picker-grid--recent"
    });
    const allSectionEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__picker-section" });
    allSectionEl.createEl("h3", { text: "\u5168\u90E8\u56FE\u6807" });
    this.allGridEl = allSectionEl.createDiv({
      cls: "file-folder-icon-replacer__picker-grid file-folder-icon-replacer__picker-grid--all"
    });
    this.renderSections("");
    window.setTimeout(() => this.searchInputEl?.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
  syncModalAppearanceClasses() {
    const { modalEl } = this;
    ["mod-columns-2", "mod-columns-3", "mod-columns-4", "mod-columns-5", "mod-columns-6"].forEach((className) => {
      modalEl.classList.remove(className);
    });
    ["mod-display-icon-text", "mod-display-icon-only", "mod-display-text-only"].forEach((className) => {
      modalEl.classList.remove(className);
    });
    modalEl.classList.add(this.options.plugin.getPickerColumnsClass());
    modalEl.classList.add(this.options.plugin.getPickerDisplayModeClass());
  }
  renderSections(query) {
    this.renderCurrentSelection();
    this.renderRecentSection(query);
    this.renderAllSection(query);
  }
  renderCurrentSelection() {
    if (!this.currentSelectionEl) {
      return;
    }
    clearElement(this.currentSelectionEl);
    const parsed = parseIconRef(this.options.selectedIconRef);
    const previewEl = this.currentSelectionEl.createSpan({
      cls: "file-folder-icon-replacer__picker-current-icon"
    });
    const labelWrapEl = this.currentSelectionEl.createDiv({
      cls: "file-folder-icon-replacer__picker-current-copy"
    });
    labelWrapEl.createDiv({
      cls: "file-folder-icon-replacer__picker-current-label",
      text: "\u5F53\u524D\u9009\u62E9"
    });
    labelWrapEl.createDiv({
      cls: "file-folder-icon-replacer__picker-current-name",
      text: this.options.plugin.describeIconRef(this.options.selectedIconRef)
    });
    if (parsed.type === "custom") {
      const customIcon = this.options.plugin.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (svgMarkup && replaceWithSvgMarkup(previewEl, svgMarkup)) {
        return;
      }
    }
    (0, import_obsidian.setIcon)(previewEl, parsed.type === "builtin" ? parsed.value : "circle-help");
  }
  renderRecentSection(query) {
    if (!this.recentGridEl) {
      return;
    }
    clearElement(this.recentGridEl);
    const normalizedQuery = query.trim().toLowerCase();
    const matches = this.options.plugin.settings.recentIcons.filter((iconRef) => {
      const label = this.options.plugin.describeIconRef(iconRef).toLowerCase();
      return !normalizedQuery || label.includes(normalizedQuery);
    });
    if (matches.length === 0) {
      this.recentGridEl.createDiv({
        cls: "file-folder-icon-replacer__picker-empty",
        text: "\u6CA1\u6709\u5339\u914D\u7684\u6700\u8FD1\u4F7F\u7528\u56FE\u6807\u3002"
      });
      return;
    }
    matches.forEach((iconRef) => this.renderPickerItem(this.recentGridEl, iconRef));
  }
  renderAllSection(query) {
    if (!this.allGridEl) {
      return;
    }
    clearElement(this.allGridEl);
    const normalizedQuery = query.trim().toLowerCase();
    const builtinRefs = this.builtinIconNames.filter((iconName) => !normalizedQuery || iconName.toLowerCase().includes(normalizedQuery)).map((iconName) => makeBuiltinIconRef(iconName));
    const customRefs = this.options.plugin.settings.customIcons.filter((icon) => !normalizedQuery || icon.name.toLowerCase().includes(normalizedQuery) || icon.id.toLowerCase().includes(normalizedQuery)).map((icon) => makeCustomIconRef(icon.id));
    const seen = /* @__PURE__ */ new Set();
    const merged = [...customRefs, ...builtinRefs].filter((iconRef) => {
      if (seen.has(iconRef)) {
        return false;
      }
      seen.add(iconRef);
      return true;
    });
    if (merged.length === 0) {
      this.allGridEl.createDiv({
        cls: "file-folder-icon-replacer__picker-empty",
        text: "\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u56FE\u6807\u3002"
      });
      return;
    }
    merged.slice(0, 240).forEach((iconRef) => this.renderPickerItem(this.allGridEl, iconRef));
  }
  renderPickerItem(containerEl, iconRef) {
    const itemEl = containerEl.createEl("button", {
      cls: "file-folder-icon-replacer__picker-item",
      attr: {
        type: "button",
        "aria-label": this.options.plugin.describeIconRef(iconRef)
      }
    });
    if (iconRef === this.options.selectedIconRef) {
      itemEl.classList.add("is-selected");
    }
    const iconEl = itemEl.createSpan({ cls: "file-folder-icon-replacer__picker-item-icon" });
    const labelEl = itemEl.createSpan({
      cls: "file-folder-icon-replacer__picker-item-label",
      text: this.options.plugin.describeIconRef(iconRef)
    });
    clearElement(iconEl);
    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      const customIcon = this.options.plugin.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (!svgMarkup || !replaceWithSvgMarkup(iconEl, svgMarkup)) {
        (0, import_obsidian.setIcon)(iconEl, "circle-help");
      }
    } else {
      (0, import_obsidian.setIcon)(iconEl, parsed.value);
    }
    itemEl.addEventListener("click", runAsync(async () => {
      await this.options.onChoose(iconRef);
      this.close();
      new import_obsidian.Notice(`\u5DF2\u9009\u62E9\u56FE\u6807: ${this.options.plugin.describeIconRef(iconRef)}`);
    }));
    labelEl.title = iconRef;
  }
};
var FolderOverridePickerModal = class extends import_obsidian.Modal {
  constructor(app, options) {
    super(app);
    this.closedPreviewEl = null;
    this.openPreviewEl = null;
    this.closedLabelEl = null;
    this.openLabelEl = null;
    this.options = options;
    this.closedIconRef = options.selectedClosedIconRef;
    this.openIconRef = options.selectedOpenIconRef;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Folder Icon - ${this.options.folder.name}` });
    contentEl.createEl("p", {
      cls: "file-folder-icon-replacer__picker-help",
      text: "\u4E3A\u8FD9\u4E2A\u5177\u4F53\u6587\u4EF6\u5939\u5206\u522B\u8BBE\u7F6E\u6298\u53E0\u548C\u5C55\u5F00\u56FE\u6807\u3002"
    });
    const listEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    const closedCardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
    closedCardEl.createEl("strong", { text: "\u6298\u53E0\u56FE\u6807" });
    const closedPickerEl = closedCardEl.createDiv({ cls: "file-folder-icon-replacer__inline-picker" });
    this.closedPreviewEl = closedPickerEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    this.closedLabelEl = closedPickerEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    const closedButton = closedPickerEl.createEl("button", { text: "\u9009\u62E9", attr: { type: "button" } });
    const closedResetButton = closedPickerEl.createEl("button", { text: "\u9ED8\u8BA4", attr: { type: "button" } });
    const openCardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
    openCardEl.createEl("strong", { text: "\u5C55\u5F00\u56FE\u6807" });
    const openPickerEl = openCardEl.createDiv({ cls: "file-folder-icon-replacer__inline-picker" });
    this.openPreviewEl = openPickerEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    this.openLabelEl = openPickerEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    const openButton = openPickerEl.createEl("button", { text: "\u9009\u62E9", attr: { type: "button" } });
    const openResetButton = openPickerEl.createEl("button", { text: "\u9ED8\u8BA4", attr: { type: "button" } });
    this.updatePreviewAndLabel(this.closedPreviewEl, this.closedLabelEl, this.closedIconRef);
    this.updatePreviewAndLabel(this.openPreviewEl, this.openLabelEl, this.openIconRef);
    closedButton.addEventListener("click", () => {
      new IconPickerModal(this.app, {
        plugin: this.options.plugin,
        selectedIconRef: this.closedIconRef,
        title: `Closed Folder Icon - ${this.options.folder.name}`,
        onChoose: async (iconRef) => {
          this.closedIconRef = iconRef;
          this.options.plugin.addRecentIcon(iconRef);
          this.updatePreviewAndLabel(this.closedPreviewEl, this.closedLabelEl, this.closedIconRef);
        }
      }).open();
    });
    openButton.addEventListener("click", () => {
      new IconPickerModal(this.app, {
        plugin: this.options.plugin,
        selectedIconRef: this.openIconRef,
        title: `Open Folder Icon - ${this.options.folder.name}`,
        onChoose: async (iconRef) => {
          this.openIconRef = iconRef;
          this.options.plugin.addRecentIcon(iconRef);
          this.updatePreviewAndLabel(this.openPreviewEl, this.openLabelEl, this.openIconRef);
        }
      }).open();
    });
    closedResetButton.addEventListener("click", () => {
      this.closedIconRef = DEFAULT_SETTINGS.folderClosedIconRef;
      this.updatePreviewAndLabel(this.closedPreviewEl, this.closedLabelEl, this.closedIconRef);
    });
    openResetButton.addEventListener("click", () => {
      this.openIconRef = DEFAULT_SETTINGS.folderOpenIconRef;
      this.updatePreviewAndLabel(this.openPreviewEl, this.openLabelEl, this.openIconRef);
    });
    const actionEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__modal-actions" });
    const saveButton = actionEl.createEl("button", {
      text: "\u4FDD\u5B58",
      cls: "mod-cta",
      attr: { type: "button" }
    });
    const cancelButton = actionEl.createEl("button", {
      text: "\u53D6\u6D88",
      attr: { type: "button" }
    });
    cancelButton.addEventListener("click", () => this.close());
    saveButton.addEventListener("click", runAsync(async () => {
      await this.options.onChoose(this.closedIconRef, this.openIconRef);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
  updatePreviewAndLabel(previewEl, labelEl, iconRef) {
    if (previewEl) {
      clearElement(previewEl);
      const parsed = parseIconRef(iconRef);
      if (parsed.type === "custom") {
        const customIcon = this.options.plugin.getCustomIcon(parsed.value);
        const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
        if (!svgMarkup || !replaceWithSvgMarkup(previewEl, svgMarkup)) {
          (0, import_obsidian.setIcon)(previewEl, "circle-help");
        }
      } else {
        (0, import_obsidian.setIcon)(previewEl, parsed.value);
      }
    }
    if (labelEl) {
      labelEl.textContent = this.options.plugin.describeIconRef(iconRef);
      labelEl.title = iconRef;
    }
  }
};
var CustomIconEditorModal = class extends import_obsidian.Modal {
  constructor(app, options) {
    super(app);
    this.nameInputEl = null;
    this.svgInputEl = null;
    this.previewEl = null;
    this.drawingCanvasEl = null;
    this.strokeWidthInputEl = null;
    this.drawHintEl = null;
    this.svgFileInputEl = null;
    this.drawStrokes = [];
    this.activeStroke = null;
    this.pointerId = null;
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", {
      text: this.options.icon ? "\u7F16\u8F91\u81EA\u5B9A\u4E49 SVG \u56FE\u6807" : "\u65B0\u589E\u81EA\u5B9A\u4E49 SVG \u56FE\u6807"
    });
    contentEl.createEl("p", {
      cls: "file-folder-icon-replacer__picker-help",
      text: "\u8FD9\u91CC\u53EF\u4EE5\u76F4\u63A5\u624B\u7ED8\u56FE\u6807\uFF0C\u6216\u7EE7\u7EED\u624B\u52A8\u7F16\u8F91 SVG\u3002\u4FDD\u5B58\u65F6\u4F1A\u4F18\u5148\u4F7F\u7528\u753B\u677F\u5185\u5BB9\u751F\u6210 SVG\u3002"
    });
    const nameFieldEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__field" });
    nameFieldEl.createEl("label", { text: "\u56FE\u6807\u540D\u79F0" });
    this.nameInputEl = nameFieldEl.createEl("input", {
      attr: {
        type: "text",
        placeholder: "\u4F8B\u5982 Hand Drawn Folder"
      }
    });
    this.nameInputEl.value = this.options.icon?.name ?? "";
    const drawFieldEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__field" });
    drawFieldEl.createEl("label", { text: "\u7B80\u6613\u753B\u677F" });
    const toolbarEl = drawFieldEl.createDiv({ cls: "file-folder-icon-replacer__draw-toolbar" });
    const widthLabelEl = toolbarEl.createEl("label", {
      cls: "file-folder-icon-replacer__draw-width-label",
      text: "\u7EBF\u5BBD"
    });
    this.strokeWidthInputEl = widthLabelEl.createEl("input", {
      attr: {
        type: "range",
        min: "1",
        max: "4",
        step: "0.5"
      }
    });
    this.strokeWidthInputEl.value = "2";
    const undoButton = toolbarEl.createEl("button", {
      text: "\u64A4\u9500\u4E00\u7B14",
      attr: { type: "button" }
    });
    const clearButton = toolbarEl.createEl("button", {
      text: "\u6E05\u7A7A\u753B\u677F",
      attr: { type: "button" }
    });
    const importButton = toolbarEl.createEl("button", {
      text: "\u5BFC\u5165 SVG",
      attr: { type: "button" }
    });
    const syncButton = toolbarEl.createEl("button", {
      text: "\u751F\u6210 SVG \u5230\u6587\u672C\u6846",
      cls: "mod-cta",
      attr: { type: "button" }
    });
    this.svgFileInputEl = drawFieldEl.createEl("input", {
      attr: {
        type: "file",
        accept: ".svg,image/svg+xml"
      }
    });
    this.svgFileInputEl.className = "file-folder-icon-replacer__hidden-input";
    this.svgFileInputEl.addEventListener("change", runAsync(async () => {
      const file = this.svgFileInputEl?.files?.[0];
      if (!file) {
        return;
      }
      const fileText = await file.text();
      const svgMarkup = extractSvgMarkup(fileText);
      if (!svgMarkup) {
        new import_obsidian.Notice("\u5BFC\u5165\u5931\u8D25\uFF1A\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 SVG\u3002");
        return;
      }
      if (this.svgInputEl) {
        this.svgInputEl.value = svgMarkup;
        this.renderPreview();
      }
      this.drawStrokes = [];
      this.activeStroke = null;
      this.redrawCanvas();
      if (this.svgFileInputEl) {
        this.svgFileInputEl.value = "";
      }
    }));
    this.drawingCanvasEl = drawFieldEl.createEl("canvas", {
      cls: "file-folder-icon-replacer__draw-canvas",
      attr: {
        width: "240",
        height: "240"
      }
    });
    this.drawHintEl = drawFieldEl.createDiv({
      cls: "file-folder-icon-replacer__draw-hint",
      text: "\u6309\u4F4F\u9F20\u6807\u6216\u624B\u6307\u5373\u53EF\u7ED8\u5236\u3002\u56FE\u6807\u4F1A\u6309 24x24 \u5750\u6807\u4FDD\u5B58\u4E3A SVG\u3002"
    });
    this.bindCanvasDrawing();
    this.redrawCanvas();
    const svgFieldEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__field" });
    svgFieldEl.createEl("label", { text: "SVG \u5185\u5BB9" });
    this.svgInputEl = svgFieldEl.createEl("textarea", {
      cls: "file-folder-icon-replacer__svg-editor"
    });
    this.svgInputEl.value = this.options.icon?.svg ?? DEFAULT_FALLBACK_CUSTOM_SVG;
    this.previewEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__svg-preview" });
    this.renderPreview();
    this.svgInputEl.addEventListener("input", () => this.renderPreview());
    undoButton.addEventListener("click", () => {
      this.drawStrokes.pop();
      this.redrawCanvas();
    });
    clearButton.addEventListener("click", () => {
      this.drawStrokes = [];
      this.activeStroke = null;
      this.redrawCanvas();
    });
    importButton.addEventListener("click", () => {
      this.svgFileInputEl?.click();
    });
    syncButton.addEventListener("click", () => {
      this.syncDrawingToSvgEditor();
    });
    const actionEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__modal-actions" });
    const saveButton = actionEl.createEl("button", {
      text: this.options.icon ? "\u4FDD\u5B58\u4FEE\u6539" : "\u521B\u5EFA\u56FE\u6807",
      cls: "mod-cta",
      attr: { type: "button" }
    });
    const cancelButton = actionEl.createEl("button", {
      text: "\u53D6\u6D88",
      attr: { type: "button" }
    });
    cancelButton.addEventListener("click", () => this.close());
    saveButton.addEventListener("click", runAsync(async () => {
      const name = this.nameInputEl?.value.trim() || "Custom SVG";
      this.syncDrawingToSvgEditor();
      const svg = this.svgInputEl?.value.trim() ?? "";
      const svgMarkup = extractSvgMarkup(svg);
      if (!svgMarkup) {
        new import_obsidian.Notice("SVG \u5185\u5BB9\u65E0\u6548\uFF0C\u8BF7\u786E\u8BA4\u5305\u542B\u5B8C\u6574\u7684 <svg>...</svg>\u3002");
        return;
      }
      await this.options.onSave({
        id: this.options.icon?.id ?? createId(),
        name,
        svg: svgMarkup
      });
      this.close();
    }));
  }
  onClose() {
    this.pointerId = null;
    this.activeStroke = null;
    this.contentEl.empty();
  }
  renderPreview() {
    if (!this.previewEl) {
      return;
    }
    clearElement(this.previewEl);
    const svgMarkup = extractSvgMarkup(this.svgInputEl?.value ?? "");
    if (!svgMarkup) {
      this.previewEl.createDiv({
        cls: "file-folder-icon-replacer__empty-state",
        text: "SVG \u9884\u89C8\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u5185\u5BB9\u683C\u5F0F\u3002"
      });
      return;
    }
    replaceWithSvgMarkup(this.previewEl, svgMarkup);
  }
  bindCanvasDrawing() {
    if (!this.drawingCanvasEl) {
      return;
    }
    this.drawingCanvasEl.addEventListener("pointerdown", (event) => {
      if (!this.drawingCanvasEl) {
        return;
      }
      event.preventDefault();
      this.pointerId = event.pointerId;
      this.drawingCanvasEl.setPointerCapture(event.pointerId);
      const point = this.getCanvasPoint(event);
      this.activeStroke = {
        points: [point],
        width: Number(this.strokeWidthInputEl?.value ?? "2")
      };
      if (this.drawStrokes.length === 0 && this.svgInputEl) {
        this.svgInputEl.value = "";
        this.renderPreview();
      }
      this.drawStrokes.push(this.activeStroke);
      this.redrawCanvas();
    });
    this.drawingCanvasEl.addEventListener("pointermove", (event) => {
      if (!this.activeStroke || this.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      this.appendPointToActiveStroke(this.getCanvasPoint(event));
      this.redrawCanvas();
    });
    const finishStroke = (event) => {
      if (!this.drawingCanvasEl || this.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      this.activeStroke = null;
      this.pointerId = null;
      this.drawingCanvasEl.releasePointerCapture(event.pointerId);
      this.redrawCanvas();
    };
    this.drawingCanvasEl.addEventListener("pointerup", finishStroke);
    this.drawingCanvasEl.addEventListener("pointercancel", finishStroke);
    this.drawingCanvasEl.addEventListener("pointerleave", finishStroke);
    this.drawingCanvasEl.addEventListener("lostpointercapture", () => {
      this.activeStroke = null;
      this.pointerId = null;
      this.redrawCanvas();
    });
  }
  getCanvasPoint(event) {
    const rect = this.drawingCanvasEl?.getBoundingClientRect();
    if (!rect || !this.drawingCanvasEl) {
      return { x: 12, y: 12 };
    }
    const scaleX = this.drawingCanvasEl.width / rect.width;
    const scaleY = this.drawingCanvasEl.height / rect.height;
    const rawX = (event.clientX - rect.left) * scaleX;
    const rawY = (event.clientY - rect.top) * scaleY;
    return {
      x: rawX / this.drawingCanvasEl.width * 24,
      y: rawY / this.drawingCanvasEl.height * 24
    };
  }
  redrawCanvas() {
    if (!this.drawingCanvasEl) {
      return;
    }
    const context = this.drawingCanvasEl.getContext("2d");
    if (!context) {
      return;
    }
    context.clearRect(0, 0, this.drawingCanvasEl.width, this.drawingCanvasEl.height);
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillRect(0, 0, this.drawingCanvasEl.width, this.drawingCanvasEl.height);
    context.strokeStyle = getComputedStyle(this.contentEl).getPropertyValue("--text-normal").trim() || "#111";
    context.fillStyle = context.strokeStyle;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of this.drawStrokes) {
      if (stroke.points.length === 0) {
        continue;
      }
      const scale = this.drawingCanvasEl.width / 24;
      context.lineWidth = stroke.width * scale;
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        if (!point) {
          continue;
        }
        context.beginPath();
        context.arc(point.x * scale, point.y * scale, stroke.width * scale / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * scale;
        const y = point.y * scale;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
    }
    if (this.drawHintEl) {
      this.drawHintEl.textContent = this.drawStrokes.length > 0 ? `\u5DF2\u7ED8\u5236 ${this.drawStrokes.length} \u7B14\u3002\u4FDD\u5B58\u65F6\u4F1A\u4F18\u5148\u4F7F\u7528\u753B\u677F\u5185\u5BB9\u3002` : "\u6309\u4F4F\u9F20\u6807\u6216\u624B\u6307\u5373\u53EF\u7ED8\u5236\u3002\u56FE\u6807\u4F1A\u6309 24x24 \u5750\u6807\u4FDD\u5B58\u4E3A SVG\u3002";
    }
  }
  appendPointToActiveStroke(point) {
    if (!this.activeStroke) {
      return;
    }
    const lastPoint = this.activeStroke.points[this.activeStroke.points.length - 1];
    if (!lastPoint) {
      this.activeStroke.points.push(point);
      return;
    }
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    if (distance < 0.08) {
      return;
    }
    this.activeStroke.points.push(point);
  }
  syncDrawingToSvgEditor() {
    if (!this.svgInputEl) {
      return;
    }
    const generatedSvg = buildSvgFromStrokes(this.drawStrokes);
    if (!generatedSvg) {
      return;
    }
    this.svgInputEl.value = generatedSvg;
    this.renderPreview();
  }
};
