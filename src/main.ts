import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
  setIcon,
  getIconIds,
} from "obsidian";

type IconRef = string;

interface CustomIconDefinition {
  id: string;
  name: string;
  svg: string;
}

interface FileRule {
  id: string;
  extension: string;
  iconRef: IconRef;
}

interface FolderRule {
  id: string;
  folderName: string;
  closedIconRef: IconRef;
  openIconRef: IconRef;
}

interface FilePathOverride {
  id: string;
  path: string;
  iconRef: IconRef;
}

interface FolderPathOverride {
  id: string;
  path: string;
  closedIconRef: IconRef;
  openIconRef: IconRef;
}

interface IconReplacerSettings {
  fileIconRef: IconRef;
  folderClosedIconRef: IconRef;
  folderOpenIconRef: IconRef;
  pickerColumns: "2" | "3" | "4" | "5" | "6";
  pickerDisplayMode: "icon-text" | "icon-only" | "text-only";
  recentIcons: IconRef[];
  customIcons: CustomIconDefinition[];
  fileRules: FileRule[];
  folderRules: FolderRule[];
  filePathOverrides: FilePathOverride[];
  folderPathOverrides: FolderPathOverride[];
}

interface LegacySettingsShape {
  fileIcon?: string;
  folderClosedIcon?: string;
  folderOpenIcon?: string;
}

interface IconPickerModalOptions {
  plugin: FileFolderIconReplacerPlugin;
  selectedIconRef: IconRef;
  title: string;
  onChoose: (iconRef: IconRef) => Promise<void>;
}

interface CustomIconEditorOptions {
  plugin: FileFolderIconReplacerPlugin;
  icon?: CustomIconDefinition;
  onSave: (icon: CustomIconDefinition) => Promise<void>;
}

interface FolderOverridePickerModalOptions {
  plugin: FileFolderIconReplacerPlugin;
  folder: TFolder;
  selectedClosedIconRef: IconRef;
  selectedOpenIconRef: IconRef;
  onChoose: (closedIconRef: IconRef, openIconRef: IconRef) => Promise<void>;
}

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawStroke {
  points: DrawPoint[];
  width: number;
}

const DEFAULT_SETTINGS: IconReplacerSettings = {
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
  folderPathOverrides: [],
};

const DEFAULT_FALLBACK_CUSTOM_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M6 9c0-3 2.7-6 6-6s6 3 6 6c0 7-6 12-6 12S6 16 6 9Z"/><path d="M10 10c.6.6 1.4 1 2 1s1.4-.4 2-1"/></svg>';

const MAX_RECENT_ICONS = 12;
const ICON_CLASS = "file-folder-icon-replacer__icon";
const ITEM_ACTIVE_CLASS = "file-folder-icon-replacer--active";
const FILE_SELECTOR = ".nav-file-title";
const FOLDER_SELECTOR = ".nav-folder-title";

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `icon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBuiltinIconName(value: string): string {
  return value.trim();
}

function normalizeExtension(value: string): string {
  return value.trim().replace(/^\./, "").toLowerCase();
}

function normalizeFolderName(value: string): string {
  return value.trim();
}

function parseIconRef(iconRef: IconRef): { type: "builtin" | "custom"; value: string } {
  if (iconRef.startsWith("custom:")) {
    return { type: "custom", value: iconRef.slice("custom:".length) };
  }

  if (iconRef.startsWith("builtin:")) {
    return { type: "builtin", value: iconRef.slice("builtin:".length) };
  }

  return { type: "builtin", value: iconRef };
}

function makeBuiltinIconRef(iconName: string): IconRef {
  return `builtin:${normalizeBuiltinIconName(iconName)}`;
}

function makeCustomIconRef(iconId: string): IconRef {
  return `custom:${iconId}`;
}

function getBaseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function getFileExtension(path: string): string {
  const baseName = getBaseName(path);
  const lastDotIndex = baseName.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === baseName.length - 1) {
    return "";
  }

  return baseName.slice(lastDotIndex + 1).toLowerCase();
}

function getFolderName(path: string): string {
  return getBaseName(path);
}

function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function extractSvgMarkup(svgText: string): string | null {
  const trimmed = svgText.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.includes("</svg>")) {
    return null;
  }

  return trimmed;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildSvgFromStrokes(strokes: DrawStroke[]): string | null {
  const visibleStrokes = strokes.filter((stroke) => stroke.points.length > 0);
  if (visibleStrokes.length === 0) {
    return null;
  }

  const body = visibleStrokes
    .map((stroke) => {
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        if (!point) {
          return "";
        }

        return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${(
          stroke.width / 2
        ).toFixed(2)}" fill="currentColor" />`;
      }

      const pathData = stroke.points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");

      return `<path d="${escapeAttribute(pathData)}" fill="none" stroke="currentColor" stroke-width="${stroke.width.toFixed(
        2,
      )}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("");

  return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function moveItem<T extends { id: string }>(items: T[], draggedId: string, targetId: string): T[] {
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

function normalizePickerColumns(value: string | undefined): "2" | "3" | "4" | "5" | "6" {
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

function normalizePickerDisplayMode(value: string | undefined): "icon-text" | "icon-only" | "text-only" {
  switch (value) {
    case "icon-only":
    case "text-only":
      return value;
    default:
      return "icon-text";
  }
}

export default class FileFolderIconReplacerPlugin extends Plugin {
  settings: IconReplacerSettings = DEFAULT_SETTINGS;
  private observer: MutationObserver | null = null;
  private refreshTimer: number | null = null;
  private validIcons = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.refreshValidIcons();

    this.addSettingTab(new IconReplacerSettingTab(this.app, this));

    this.addCommand({
      id: "refresh-file-explorer-icons",
      name: "Refresh file explorer icons",
      callback: () => {
        this.refreshValidIcons();
        this.refreshIcons();
        new Notice("File explorer icons refreshed");
      },
    });

    this.app.workspace.onLayoutReady(() => {
      this.startObserver();
      this.refreshIcons();
    });

    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on("css-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
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

  onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.observer?.disconnect();
    this.observer = null;
    this.cleanupInjectedIcons();
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<IconReplacerSettings & LegacySettingsShape> | null;

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      fileIconRef: this.migrateLegacyIconRef(loaded?.fileIconRef, loaded?.fileIcon, DEFAULT_SETTINGS.fileIconRef),
      folderClosedIconRef: this.migrateLegacyIconRef(
        loaded?.folderClosedIconRef,
        loaded?.folderClosedIcon,
        DEFAULT_SETTINGS.folderClosedIconRef,
      ),
      folderOpenIconRef: this.migrateLegacyIconRef(
        loaded?.folderOpenIconRef,
        loaded?.folderOpenIcon,
        DEFAULT_SETTINGS.folderOpenIconRef,
      ),
      pickerColumns: normalizePickerColumns(loaded?.pickerColumns),
      pickerDisplayMode: normalizePickerDisplayMode(loaded?.pickerDisplayMode),
      recentIcons: this.normalizeRecentIcons(loaded?.recentIcons ?? []),
      customIcons: this.normalizeCustomIcons(loaded?.customIcons ?? []),
      fileRules: this.normalizeFileRules(loaded?.fileRules ?? []),
      folderRules: this.normalizeFolderRules(loaded?.folderRules ?? []),
      filePathOverrides: this.normalizeFilePathOverrides(loaded?.filePathOverrides ?? []),
      folderPathOverrides: this.normalizeFolderPathOverrides(loaded?.folderPathOverrides ?? []),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  refreshValidIcons(): void {
    this.validIcons = new Set(getIconIds());
  }

  isIconRefKnown(iconRef: IconRef): boolean {
    const parsed = parseIconRef(iconRef);

    if (parsed.type === "custom") {
      return this.settings.customIcons.some((icon) => icon.id === parsed.value);
    }

    return this.validIcons.has(parsed.value);
  }

  describeIconRef(iconRef: IconRef): string {
    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      const icon = this.settings.customIcons.find((item) => item.id === parsed.value);
      return icon ? `${icon.name} (SVG)` : "Missing custom icon";
    }

    return parsed.value;
  }

  addRecentIcon(iconRef: IconRef): void {
    if (!this.isIconRefKnown(iconRef)) {
      return;
    }

    this.settings.recentIcons = [iconRef, ...this.settings.recentIcons.filter((item) => item !== iconRef)].slice(
      0,
      MAX_RECENT_ICONS,
    );
  }

  getCustomIcon(iconId: string): CustomIconDefinition | null {
    return this.settings.customIcons.find((icon) => icon.id === iconId) ?? null;
  }

  getFilePathOverride(path: string): FilePathOverride | null {
    return this.settings.filePathOverrides.find((item) => item.path === path) ?? null;
  }

  getFolderPathOverride(path: string): FolderPathOverride | null {
    return this.settings.folderPathOverrides.find((item) => item.path === path) ?? null;
  }

  getPickerColumnsClass(): string {
    return `mod-columns-${this.settings.pickerColumns}`;
  }

  getPickerDisplayModeClass(): string {
    switch (this.settings.pickerDisplayMode) {
      case "icon-only":
        return "mod-display-icon-only";
      case "text-only":
        return "mod-display-text-only";
      default:
        return "mod-display-icon-text";
    }
  }

  scheduleRefresh(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshIcons();
    }, 50);
  }

  async persistAndRefresh(): Promise<void> {
    await this.saveSettings();
    this.refreshValidIcons();
    this.refreshIcons();
  }

  refreshIcons(): void {
    const root = this.app.workspace.containerEl;
    if (!root.isConnected) {
      return;
    }

    root.querySelectorAll<HTMLElement>(FILE_SELECTOR).forEach((fileEl) => {
      fileEl.classList.add(ITEM_ACTIVE_CLASS);
      const contentEl = fileEl.querySelector<HTMLElement>(".nav-file-title-content");
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

    root.querySelectorAll<HTMLElement>(FOLDER_SELECTOR).forEach((folderTitleEl) => {
      folderTitleEl.classList.add(ITEM_ACTIVE_CLASS);
      const contentEl = folderTitleEl.querySelector<HTMLElement>(".nav-folder-title-content");
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
        isCollapsed ? DEFAULT_SETTINGS.folderClosedIconRef : DEFAULT_SETTINGS.folderOpenIconRef,
      );
      iconEl.dataset.iconRole = isCollapsed ? "folder-closed" : "folder-open";
      iconEl.dataset.iconSource = iconRef;
    });
  }

  private startObserver(): void {
    this.observer?.disconnect();

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          this.scheduleRefresh();
          return;
        }

        if (
          mutation.type === "attributes" &&
          mutation.target instanceof HTMLElement &&
          (mutation.target.matches(".nav-folder") || mutation.target.matches(".nav-folder-title"))
        ) {
          this.scheduleRefresh();
          return;
        }
      }
    });

    this.observer.observe(this.app.workspace.containerEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  private ensureIconElement(parentEl: HTMLElement, contentEl: HTMLElement): HTMLSpanElement {
    const existingIconEls = Array.from(
      parentEl.querySelectorAll<HTMLSpanElement>("[data-file-folder-icon-replacer-icon='true']"),
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

    const createdIconEl = document.createElement("span");
    createdIconEl.className = ICON_CLASS;
    createdIconEl.dataset.fileFolderIconReplacerIcon = "true";
    createdIconEl.dataset.fileFolderIconReplacerInjected = "true";
    parentEl.insertBefore(createdIconEl, contentEl);
    return createdIconEl;
  }

  private renderIconRef(iconEl: HTMLElement, requestedIconRef: IconRef, fallbackIconRef: IconRef): void {
    const resolvedIconRef = this.isIconRefKnown(requestedIconRef) ? requestedIconRef : fallbackIconRef;
    const parsed = parseIconRef(resolvedIconRef);

    clearElement(iconEl);
    iconEl.classList.remove("mod-custom-svg");

    if (parsed.type === "custom") {
      const customIcon = this.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;

      if (svgMarkup) {
        iconEl.innerHTML = svgMarkup;
        iconEl.classList.add("mod-custom-svg");
        iconEl.dataset.iconName = customIcon?.name ?? parsed.value;
        return;
      }
    }

    setIcon(iconEl, parsed.value);
    iconEl.dataset.iconName = parsed.value;
  }

  private getFileIconRef(path: string): IconRef {
    const pathOverride = this.getFilePathOverride(path);
    if (pathOverride) {
      return pathOverride.iconRef;
    }

    const extension = getFileExtension(path);
    const matchingRule = this.settings.fileRules.find((rule) => rule.extension === extension);
    return matchingRule?.iconRef ?? this.settings.fileIconRef;
  }

  private getFolderIconRef(path: string, isCollapsed: boolean): IconRef {
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

  private cleanupInjectedIcons(): void {
    this.restoreOriginalIcons();
    this.restoreReusedIconElements();
    this.app.workspace.containerEl.querySelectorAll(`.${ITEM_ACTIVE_CLASS}`).forEach((el) => {
      el.classList.remove(ITEM_ACTIVE_CLASS);
    });
    this.app.workspace.containerEl.querySelectorAll(`.${ICON_CLASS}`).forEach((el) => el.remove());
  }

  private findReusableIconElement(parentEl: HTMLElement, contentEl: HTMLElement): HTMLSpanElement | null {
    const directChildren = Array.from(parentEl.children);
    const contentIndex = directChildren.indexOf(contentEl);
    const candidates = directChildren.slice(0, contentIndex).filter((child) => child instanceof HTMLElement);

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }

      if (this.shouldKeepFolderIndicator(candidate)) {
        continue;
      }

      if (candidate.classList.contains(ICON_CLASS)) {
        return candidate as HTMLSpanElement;
      }

      return candidate as HTMLSpanElement;
    }

    return null;
  }

  private hideOriginalIcons(parentEl: HTMLElement, contentEl: HTMLElement, isFolderTitle: boolean): void {
    const directChildren = Array.from(parentEl.children);
    const contentIndex = directChildren.indexOf(contentEl);

    directChildren.forEach((child, index) => {
      if (!(child instanceof HTMLElement)) {
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

      if (!child.dataset.fileFolderIconReplacerOriginalDisplay) {
        child.dataset.fileFolderIconReplacerOriginalDisplay = child.style.display || "__empty__";
      }

      child.style.display = "none";
      child.dataset.fileFolderIconReplacerHidden = "true";
    });

    parentEl.querySelectorAll<HTMLElement>(".svg-icon, .nav-file-title-icon, .nav-folder-title-icon").forEach((element) => {
      if (element.closest(`.${ICON_CLASS}`)) {
        return;
      }

      if (this.shouldKeepFolderIndicator(element)) {
        return;
      }

      const wrapper = element.closest<HTMLElement>(".nav-file-title-icon, .nav-folder-title-icon, .nav-file-icon, .nav-folder-icon");
      const targetEl = wrapper ?? element;
      if (targetEl === contentEl || contentEl.contains(targetEl)) {
        return;
      }

      if (!targetEl.dataset.fileFolderIconReplacerOriginalDisplay) {
        targetEl.dataset.fileFolderIconReplacerOriginalDisplay = targetEl.style.display || "__empty__";
      }

      targetEl.style.display = "none";
      targetEl.dataset.fileFolderIconReplacerHidden = "true";
    });
  }

  private shouldKeepFolderIndicator(element: HTMLElement): boolean {
    return (
      element.classList.contains("collapse-icon") ||
      element.classList.contains("nav-folder-collapse-indicator") ||
      element.classList.contains("tree-item-self-modifier") ||
      element.classList.contains("tree-item-flair-outer") ||
      element.closest(".collapse-icon") !== null ||
      element.closest(".nav-folder-collapse-indicator") !== null
    );
  }

  private restoreOriginalIcons(): void {
    this.app.workspace.containerEl
      .querySelectorAll<HTMLElement>("[data-file-folder-icon-replacer-hidden='true']")
      .forEach((element) => {
        const previousDisplay = element.dataset.fileFolderIconReplacerOriginalDisplay;
        element.style.display = previousDisplay && previousDisplay !== "__empty__" ? previousDisplay : "";
        delete element.dataset.fileFolderIconReplacerHidden;
        delete element.dataset.fileFolderIconReplacerOriginalDisplay;
      });
  }

  private restoreReusedIconElements(): void {
    this.app.workspace.containerEl.querySelectorAll<HTMLElement>(`.${ICON_CLASS}`).forEach((element) => {
      if (element.dataset.fileFolderIconReplacerInjected !== "false") {
        return;
      }

      const originalMarkup = element.dataset.fileFolderIconReplacerOriginalMarkup;
      const originalClass = element.dataset.fileFolderIconReplacerOriginalClass;
      if (typeof originalMarkup === "string") {
        element.innerHTML = originalMarkup;
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

  private migrateLegacyIconRef(nextValue: string | undefined, legacyValue: string | undefined, fallback: IconRef): IconRef {
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

  private looksLikeIconRef(value: string): boolean {
    return value.startsWith("builtin:") || value.startsWith("custom:");
  }

  private normalizeRecentIcons(values: IconRef[]): IconRef[] {
    return values.filter((value) => typeof value === "string").slice(0, MAX_RECENT_ICONS);
  }

  private normalizeCustomIcons(values: CustomIconDefinition[]): CustomIconDefinition[] {
    return values
      .filter((value) => value && typeof value.id === "string" && typeof value.name === "string" && typeof value.svg === "string")
      .map((value) => ({
        id: value.id,
        name: value.name.trim() || "Custom SVG",
        svg: value.svg.trim(),
      }));
  }

  private normalizeFileRules(values: FileRule[]): FileRule[] {
    return values
      .filter((value) => value && typeof value.id === "string")
      .map((value) => ({
        id: value.id,
        extension: normalizeExtension(value.extension ?? ""),
        iconRef: this.migrateLegacyIconRef(value.iconRef, undefined, DEFAULT_SETTINGS.fileIconRef),
      }))
      .filter((value) => value.extension.length > 0);
  }

  private normalizeFolderRules(values: FolderRule[]): FolderRule[] {
    return values
      .filter((value) => value && typeof value.id === "string")
      .map((value) => ({
        id: value.id,
        folderName: normalizeFolderName(value.folderName ?? ""),
        closedIconRef: this.migrateLegacyIconRef(value.closedIconRef, undefined, DEFAULT_SETTINGS.folderClosedIconRef),
        openIconRef: this.migrateLegacyIconRef(value.openIconRef, undefined, DEFAULT_SETTINGS.folderOpenIconRef),
      }))
      .filter((value) => value.folderName.length > 0);
  }

  private normalizeFilePathOverrides(values: FilePathOverride[]): FilePathOverride[] {
    return values
      .filter((value) => value && typeof value.id === "string")
      .map((value) => ({
        id: value.id,
        path: value.path?.trim() ?? "",
        iconRef: this.migrateLegacyIconRef(value.iconRef, undefined, DEFAULT_SETTINGS.fileIconRef),
      }))
      .filter((value) => value.path.length > 0);
  }

  private normalizeFolderPathOverrides(values: FolderPathOverride[]): FolderPathOverride[] {
    return values
      .filter((value) => value && typeof value.id === "string")
      .map((value) => ({
        id: value.id,
        path: value.path?.trim() ?? "",
        closedIconRef: this.migrateLegacyIconRef(value.closedIconRef, undefined, DEFAULT_SETTINGS.folderClosedIconRef),
        openIconRef: this.migrateLegacyIconRef(value.openIconRef, undefined, DEFAULT_SETTINGS.folderOpenIconRef),
      }))
      .filter((value) => value.path.length > 0);
  }

  private addPathOverrideMenuItems(menu: { addItem: (cb: (item: any) => any) => any }, file: TAbstractFile): void {
    if (file instanceof TFolder) {
      menu.addItem((item) => {
        item.setTitle("Set folder icon for this folder").setIcon("paintbrush").onClick(() => {
          this.openFolderOverridePicker(file);
        });
      });

      if (this.getFolderPathOverride(file.path)) {
        menu.addItem((item) => {
          item.setTitle("Clear custom folder icon").setIcon("eraser").setWarning(true).onClick(async () => {
            this.settings.folderPathOverrides = this.settings.folderPathOverrides.filter((entry) => entry.path !== file.path);
            await this.persistAndRefresh();
            new Notice(`Cleared folder icon: ${file.path}`);
          });
        });
      }

      return;
    }

    if (file instanceof TFile) {
      menu.addItem((item) => {
        item.setTitle("Set file icon for this file").setIcon("paintbrush").onClick(() => {
          this.openFileOverridePicker(file);
        });
      });

      if (this.getFilePathOverride(file.path)) {
        menu.addItem((item) => {
          item.setTitle("Clear custom file icon").setIcon("eraser").setWarning(true).onClick(async () => {
            this.settings.filePathOverrides = this.settings.filePathOverrides.filter((entry) => entry.path !== file.path);
            await this.persistAndRefresh();
            new Notice(`Cleared file icon: ${file.path}`);
          });
        });
      }
    }
  }

  openFileOverridePicker(file: TFile): void {
    const existing = this.getFilePathOverride(file.path);
    new IconPickerModal(this.app, {
      plugin: this,
      selectedIconRef: existing?.iconRef ?? this.getFileIconRef(file.path),
      title: `File Icon - ${file.name}`,
      onChoose: async (iconRef) => {
        const nextOverride: FilePathOverride = existing ?? {
          id: createId(),
          path: file.path,
          iconRef,
        };

        nextOverride.iconRef = iconRef;
        this.settings.filePathOverrides = [
          ...this.settings.filePathOverrides.filter((item) => item.path !== file.path),
          nextOverride,
        ];
        this.addRecentIcon(iconRef);
        await this.persistAndRefresh();
        new Notice(`Set file icon: ${file.path}`);
      },
    }).open();
  }

  openFolderOverridePicker(folder: TFolder): void {
    const existing = this.getFolderPathOverride(folder.path);
    new FolderOverridePickerModal(this.app, {
      plugin: this,
      folder,
      selectedClosedIconRef: existing?.closedIconRef ?? this.getFolderIconRef(folder.path, true),
      selectedOpenIconRef: existing?.openIconRef ?? this.getFolderIconRef(folder.path, false),
      onChoose: async (closedIconRef, openIconRef) => {
        const nextOverride: FolderPathOverride = existing ?? {
          id: createId(),
          path: folder.path,
          closedIconRef,
          openIconRef,
        };

        nextOverride.closedIconRef = closedIconRef;
        nextOverride.openIconRef = openIconRef;
        this.settings.folderPathOverrides = [
          ...this.settings.folderPathOverrides.filter((item) => item.path !== folder.path),
          nextOverride,
        ];
        this.addRecentIcon(closedIconRef);
        this.addRecentIcon(openIconRef);
        await this.persistAndRefresh();
        new Notice(`Set folder icon: ${folder.path}`);
      },
    }).open();
  }
}

class IconReplacerSettingTab extends PluginSettingTab {
  private draggedFileRuleId: string | null = null;
  private draggedFolderRuleId: string | null = null;

  constructor(app: App, private plugin: FileFolderIconReplacerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "File Folder Icon Replacer" });
    containerEl.createEl("p", {
      text: "支持全局图标、最近使用、自定义 SVG 图标、按文件后缀规则，以及按文件夹名称规则。",
    });

    this.renderGlobalSection();
    this.renderRecentSection();
    this.renderCustomIconsSection();
    this.renderPathOverridesSection();
    this.renderFileRulesSection();
    this.renderFolderRulesSection();
  }

  private renderGlobalSection(): void {
    this.containerEl.createEl("h3", { text: "全局图标" });

    this.addIconSetting(
      "文件图标",
      "所有普通文件的默认图标。",
      this.plugin.settings.fileIconRef,
      DEFAULT_SETTINGS.fileIconRef,
      async (iconRef) => {
        this.plugin.settings.fileIconRef = iconRef;
      },
    );

    this.addIconSetting(
      "文件夹折叠图标",
      "未展开文件夹的默认图标。",
      this.plugin.settings.folderClosedIconRef,
      DEFAULT_SETTINGS.folderClosedIconRef,
      async (iconRef) => {
        this.plugin.settings.folderClosedIconRef = iconRef;
      },
    );

    this.addIconSetting(
      "文件夹展开图标",
      "展开后文件夹的默认图标。",
      this.plugin.settings.folderOpenIconRef,
      DEFAULT_SETTINGS.folderOpenIconRef,
      async (iconRef) => {
        this.plugin.settings.folderOpenIconRef = iconRef;
      },
    );
  }

  private renderRecentSection(): void {
    this.containerEl.createEl("h3", { text: "最近使用" });
    const helpEl = this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "这里会显示你最近选择过的内置图标和自定义 SVG 图标。",
    });

    const gridEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__recent-grid" });
    if (this.plugin.settings.recentIcons.length === 0) {
      gridEl.createEl("div", {
        cls: "file-folder-icon-replacer__empty-state",
        text: "还没有最近使用的图标。",
      });
      return;
    }

    this.plugin.settings.recentIcons.forEach((iconRef) => {
      const itemEl = gridEl.createDiv({
        cls: "file-folder-icon-replacer__recent-item",
      });

      const previewEl = itemEl.createSpan({ cls: "file-folder-icon-replacer__recent-item-icon" });
      this.renderPreview(previewEl, iconRef);
      itemEl.createSpan({
        cls: "file-folder-icon-replacer__recent-item-label",
        text: this.plugin.describeIconRef(iconRef),
      });

      const deleteButton = itemEl.createEl("button", {
        cls: "file-folder-icon-replacer__recent-item-delete",
        text: "移除",
        attr: { type: "button" },
      });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.recentIcons = this.plugin.settings.recentIcons.filter((item) => item !== iconRef);
        await this.plugin.saveSettings();
        this.display();
      });
    });

    helpEl.insertAdjacentText("beforeend", " 选择器中也会优先显示这些图标。");
  }

  private renderCustomIconsSection(): void {
    this.containerEl.createEl("h3", { text: "自定义 SVG 图标" });
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "可粘贴或手写 SVG，用作你的手绘图标。保存后会出现在选择器和规则面板里。",
    });

    new Setting(this.containerEl)
      .setName("新增自定义图标")
      .setDesc("创建一个可以在任何规则里复用的 SVG 图标。")
      .addButton((button) => {
        button.setButtonText("新建 SVG").onClick(() => {
          new CustomIconEditorModal(this.app, {
            plugin: this.plugin,
            onSave: async (icon) => {
              this.plugin.settings.customIcons.push(icon);
              this.plugin.addRecentIcon(makeCustomIconRef(icon.id));
              await this.plugin.persistAndRefresh();
              this.display();
              new Notice(`已添加自定义图标: ${icon.name}`);
            },
          }).open();
        });
      });

    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__custom-list" });
    if (this.plugin.settings.customIcons.length === 0) {
      listEl.createEl("div", {
        cls: "file-folder-icon-replacer__empty-state",
        text: "还没有自定义 SVG 图标。",
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
      titleWrapEl.createEl("div", {
        cls: "file-folder-icon-replacer__rule-meta",
        text: `ID: ${icon.id}`,
      });

      const actionEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-actions" });
      const editButton = actionEl.createEl("button", { text: "编辑", attr: { type: "button" } });
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
            new Notice(`已更新自定义图标: ${nextIcon.name}`);
          },
        }).open();
      });

      const deleteButton = actionEl.createEl("button", {
        text: "删除",
        cls: "mod-warning",
        attr: { type: "button" },
      });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.customIcons = this.plugin.settings.customIcons.filter((item) => item.id !== icon.id);
        this.plugin.settings.recentIcons = this.plugin.settings.recentIcons.filter(
          (item) => item !== makeCustomIconRef(icon.id),
        );

        this.plugin.settings.fileRules = this.plugin.settings.fileRules.map((rule) => ({
          ...rule,
          iconRef: rule.iconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.fileIconRef : rule.iconRef,
        }));
        this.plugin.settings.folderRules = this.plugin.settings.folderRules.map((rule) => ({
          ...rule,
          closedIconRef:
            rule.closedIconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.folderClosedIconRef : rule.closedIconRef,
          openIconRef:
            rule.openIconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.folderOpenIconRef : rule.openIconRef,
        }));
        this.plugin.settings.filePathOverrides = this.plugin.settings.filePathOverrides.map((override) => ({
          ...override,
          iconRef: override.iconRef === makeCustomIconRef(icon.id) ? DEFAULT_SETTINGS.fileIconRef : override.iconRef,
        }));
        this.plugin.settings.folderPathOverrides = this.plugin.settings.folderPathOverrides.map((override) => ({
          ...override,
          closedIconRef:
            override.closedIconRef === makeCustomIconRef(icon.id)
              ? DEFAULT_SETTINGS.folderClosedIconRef
              : override.closedIconRef,
          openIconRef:
            override.openIconRef === makeCustomIconRef(icon.id)
              ? DEFAULT_SETTINGS.folderOpenIconRef
              : override.openIconRef,
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
        new Notice(`已删除自定义图标: ${icon.name}`);
      });
    });
  }

  private renderPathOverridesSection(): void {
    this.containerEl.createEl("h3", { text: "局部图标" });
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "这里显示通过文件管理器右键菜单为具体文件或文件夹设置的图标。它们的优先级高于后缀规则和名称规则。",
    });

    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    const fileOverrides = this.plugin.settings.filePathOverrides;
    const folderOverrides = this.plugin.settings.folderPathOverrides;

    if (fileOverrides.length === 0 && folderOverrides.length === 0) {
      listEl.createEl("div", {
        cls: "file-folder-icon-replacer__empty-state",
        text: "还没有局部图标。",
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
      titleWrapEl.createEl("div", {
        cls: "file-folder-icon-replacer__rule-meta",
        text: override.path,
      });

      const actionEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-actions" });
      const editButton = actionEl.createEl("button", { text: "改图标", attr: { type: "button" } });
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
          },
        }).open();
      });

      const deleteButton = actionEl.createEl("button", {
        text: "清除",
        cls: "mod-warning",
        attr: { type: "button" },
      });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.filePathOverrides = this.plugin.settings.filePathOverrides.filter((item) => item.id !== override.id);
        await this.plugin.persistAndRefresh();
        this.display();
      });
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
      titleWrapEl.createEl("div", {
        cls: "file-folder-icon-replacer__rule-meta",
        text: override.path,
      });

      const actionEl = headerEl.createDiv({ cls: "file-folder-icon-replacer__rule-actions" });
      const editButton = actionEl.createEl("button", { text: "改图标", attr: { type: "button" } });
      editButton.addEventListener("click", () => {
        const folder = this.app.vault.getAbstractFileByPath(override.path);
        if (!(folder instanceof TFolder)) {
          new Notice(`Folder not found: ${override.path}`);
          return;
        }

        this.plugin.openFolderOverridePicker(folder);
      });

      const deleteButton = actionEl.createEl("button", {
        text: "清除",
        cls: "mod-warning",
        attr: { type: "button" },
      });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.folderPathOverrides = this.plugin.settings.folderPathOverrides.filter(
          (item) => item.id !== override.id,
        );
        await this.plugin.persistAndRefresh();
        this.display();
      });
    });
  }

  private renderFileRulesSection(): void {
    this.containerEl.createEl("h3", { text: "按文件后缀替换" });
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "按后缀精确匹配，例如 md、png、pdf、ts。规则按列表顺序匹配，第一个命中的规则生效。",
    });

    new Setting(this.containerEl)
      .setName("新增文件规则")
      .setDesc("为特定后缀设置图标。")
      .addButton((button) => {
        button.setButtonText("添加规则").onClick(async () => {
          this.plugin.settings.fileRules.push({
            id: createId(),
            extension: "md",
            iconRef: makeBuiltinIconRef("file-text"),
          });
          await this.plugin.persistAndRefresh();
          this.display();
        });
      });

    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    if (this.plugin.settings.fileRules.length === 0) {
      listEl.createEl("div", {
        cls: "file-folder-icon-replacer__empty-state",
        text: "还没有文件后缀规则。",
      });
      return;
    }

    this.plugin.settings.fileRules.forEach((rule) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      this.attachRuleDragHandlers(cardEl, "file", rule.id);
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-order" });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__drag-handle",
        text: "⋮⋮ 拖动排序",
      });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__rule-priority",
        text: `优先级 ${this.plugin.settings.fileRules.findIndex((item) => item.id === rule.id) + 1}`,
      });

      const rowEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-grid file-folder-icon-replacer__rule-grid--file" });

      const extWrapEl = rowEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      extWrapEl.createEl("label", { text: "后缀" });
      const extInputEl = extWrapEl.createEl("input", {
        attr: { type: "text", placeholder: "例如 md" },
      });
      extInputEl.value = rule.extension;
      extInputEl.addEventListener("change", async () => {
        rule.extension = normalizeExtension(extInputEl.value);
        extInputEl.value = rule.extension;
        await this.plugin.persistAndRefresh();
      });

      const iconWrapEl = rowEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      iconWrapEl.createEl("label", { text: "图标" });
      this.buildRuleIconPicker(
        iconWrapEl,
        rule.iconRef,
        DEFAULT_SETTINGS.fileIconRef,
        async (nextIconRef) => {
          rule.iconRef = nextIconRef;
        },
      );

      const actionEl = rowEl.createDiv({ cls: "file-folder-icon-replacer__rule-inline-actions" });
      const deleteButton = actionEl.createEl("button", { text: "删除", cls: "mod-warning", attr: { type: "button" } });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.fileRules = this.plugin.settings.fileRules.filter((item) => item.id !== rule.id);
        await this.plugin.persistAndRefresh();
        this.display();
      });
    });
  }

  private renderFolderRulesSection(): void {
    this.containerEl.createEl("h3", { text: "按文件夹名称替换" });
    this.containerEl.createEl("p", {
      cls: "file-folder-icon-replacer__section-help",
      text: "按文件夹名称精确匹配，例如 Assets、Templates、Projects。可分别设置折叠和展开图标。",
    });

    new Setting(this.containerEl)
      .setName("新增文件夹规则")
      .setDesc("为特定文件夹名称设置图标。")
      .addButton((button) => {
        button.setButtonText("添加规则").onClick(async () => {
          this.plugin.settings.folderRules.push({
            id: createId(),
            folderName: "Assets",
            closedIconRef: makeBuiltinIconRef("folder"),
            openIconRef: makeBuiltinIconRef("folder-open"),
          });
          await this.plugin.persistAndRefresh();
          this.display();
        });
      });

    const listEl = this.containerEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });
    if (this.plugin.settings.folderRules.length === 0) {
      listEl.createEl("div", {
        cls: "file-folder-icon-replacer__empty-state",
        text: "还没有文件夹名称规则。",
      });
      return;
    }

    this.plugin.settings.folderRules.forEach((rule) => {
      const cardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
      this.attachRuleDragHandlers(cardEl, "folder", rule.id);
      const headerEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-order" });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__drag-handle",
        text: "⋮⋮ 拖动排序",
      });
      headerEl.createSpan({
        cls: "file-folder-icon-replacer__rule-priority",
        text: `优先级 ${this.plugin.settings.folderRules.findIndex((item) => item.id === rule.id) + 1}`,
      });

      const nameWrapEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      nameWrapEl.createEl("label", { text: "文件夹名称" });
      const nameInputEl = nameWrapEl.createEl("input", {
        attr: { type: "text", placeholder: "例如 Assets" },
      });
      nameInputEl.value = rule.folderName;
      nameInputEl.addEventListener("change", async () => {
        rule.folderName = normalizeFolderName(nameInputEl.value);
        nameInputEl.value = rule.folderName;
        await this.plugin.persistAndRefresh();
      });

      const gridEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-grid file-folder-icon-replacer__rule-grid--folder" });

      const closedWrapEl = gridEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      closedWrapEl.createEl("label", { text: "折叠图标" });
      this.buildRuleIconPicker(
        closedWrapEl,
        rule.closedIconRef,
        DEFAULT_SETTINGS.folderClosedIconRef,
        async (nextIconRef) => {
          rule.closedIconRef = nextIconRef;
        },
      );

      const openWrapEl = gridEl.createDiv({ cls: "file-folder-icon-replacer__field" });
      openWrapEl.createEl("label", { text: "展开图标" });
      this.buildRuleIconPicker(
        openWrapEl,
        rule.openIconRef,
        DEFAULT_SETTINGS.folderOpenIconRef,
        async (nextIconRef) => {
          rule.openIconRef = nextIconRef;
        },
      );

      const actionEl = cardEl.createDiv({ cls: "file-folder-icon-replacer__rule-inline-actions" });
      const deleteButton = actionEl.createEl("button", { text: "删除规则", cls: "mod-warning", attr: { type: "button" } });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.folderRules = this.plugin.settings.folderRules.filter((item) => item.id !== rule.id);
        await this.plugin.persistAndRefresh();
        this.display();
      });
    });
  }

  private addIconSetting(
    name: string,
    desc: string,
    value: IconRef,
    fallbackValue: IconRef,
    onSave: (iconRef: IconRef) => Promise<void>,
  ): void {
    let currentValue = value;
    let previewEl: HTMLSpanElement | null = null;
    let labelEl: HTMLSpanElement | null = null;

    const setting = new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addButton((button) => {
        button.setButtonText("选择图标").onClick(() => {
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
            },
          }).open();
        });
      })
      .addExtraButton((button) => {
        button
          .setIcon("reset")
          .setTooltip("恢复默认图标")
          .onClick(async () => {
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

  private buildRuleIconPicker(
    containerEl: HTMLElement,
    value: IconRef,
    fallbackValue: IconRef,
    onSave: (iconRef: IconRef) => Promise<void>,
  ): void {
    let currentValue = value;

    const pickerEl = containerEl.createDiv({ cls: "file-folder-icon-replacer__inline-picker" });
    const previewEl = pickerEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    const labelEl = pickerEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    const chooseButton = pickerEl.createEl("button", { text: "选择", attr: { type: "button" } });
    const resetButton = pickerEl.createEl("button", { text: "默认", attr: { type: "button" } });

    this.updatePreviewAndLabel(previewEl, labelEl, currentValue);

    chooseButton.addEventListener("click", () => {
      new IconPickerModal(this.app, {
        plugin: this.plugin,
        selectedIconRef: currentValue,
        title: "选择规则图标",
        onChoose: async (iconRef) => {
          currentValue = iconRef;
          await onSave(iconRef);
          this.plugin.addRecentIcon(iconRef);
          await this.plugin.persistAndRefresh();
          this.updatePreviewAndLabel(previewEl, labelEl, currentValue);
        },
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

  private updatePreviewAndLabel(
    previewEl: HTMLElement | null,
    labelEl: HTMLElement | null,
    iconRef: IconRef,
  ): void {
    if (previewEl) {
      this.renderPreview(previewEl, iconRef);
    }

    if (labelEl) {
      labelEl.textContent = this.plugin.describeIconRef(iconRef);
      labelEl.title = iconRef;
    }
  }

  private renderPreview(previewEl: HTMLElement, iconRef: IconRef): void {
    clearElement(previewEl);

    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      const customIcon = this.plugin.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (svgMarkup) {
        previewEl.innerHTML = svgMarkup;
        return;
      }
    }

    if (parsed.type === "builtin" && this.plugin.isIconRefKnown(iconRef)) {
      setIcon(previewEl, parsed.value);
      return;
    }

    setIcon(previewEl, "circle-help");
  }

  private attachRuleDragHandlers(cardEl: HTMLElement, type: "file" | "folder", ruleId: string): void {
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
}

class IconPickerModal extends Modal {
  private readonly options: IconPickerModalOptions;
  private searchInputEl: HTMLInputElement | null = null;
  private currentSelectionEl: HTMLDivElement | null = null;
  private columnsSelectEl: HTMLSelectElement | null = null;
  private displayModeSelectEl: HTMLSelectElement | null = null;
  private recentGridEl: HTMLDivElement | null = null;
  private allGridEl: HTMLDivElement | null = null;
  private readonly builtinIconNames: string[];

  constructor(app: App, options: IconPickerModalOptions) {
    super(app);
    this.options = options;
    this.builtinIconNames = getIconIds().slice().sort((a, b) => a.localeCompare(b));
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.classList.add("file-folder-icon-replacer__picker-modal");
    modalEl.classList.add(this.options.plugin.getPickerColumnsClass());
    modalEl.classList.add(this.options.plugin.getPickerDisplayModeClass());
    contentEl.empty();

    contentEl.createEl("h2", { text: `${this.options.title} - 选择图标` });

    const toolbarEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__picker-toolbar" });
    toolbarEl.createEl("p", {
      cls: "file-folder-icon-replacer__picker-help",
      text: "先看最近使用，再从全部图标里搜索。当前选择会固定显示在顶部。",
    });

    const controlsEl = toolbarEl.createDiv({ cls: "file-folder-icon-replacer__picker-controls" });
    const columnsFieldEl = controlsEl.createDiv({ cls: "file-folder-icon-replacer__picker-control" });
    columnsFieldEl.createEl("label", { text: "列数" });
    this.columnsSelectEl = columnsFieldEl.createEl("select");
    [
      ["2", "2 列"],
      ["3", "3 列"],
      ["4", "4 列"],
      ["5", "5 列"],
      ["6", "6 列"],
    ].forEach(([value, label]) => {
      this.columnsSelectEl?.createEl("option", {
        value,
        text: label,
      });
    });
    this.columnsSelectEl.value = this.options.plugin.settings.pickerColumns;
    this.columnsSelectEl.addEventListener("change", async () => {
      this.options.plugin.settings.pickerColumns = normalizePickerColumns(this.columnsSelectEl?.value);
      await this.options.plugin.saveSettings();
      this.syncModalAppearanceClasses();
    });

    const modeFieldEl = controlsEl.createDiv({ cls: "file-folder-icon-replacer__picker-control" });
    modeFieldEl.createEl("label", { text: "显示" });
    this.displayModeSelectEl = modeFieldEl.createEl("select");
    [
      ["icon-text", "图标 + 文字"],
      ["icon-only", "仅图标"],
      ["text-only", "仅文字"],
    ].forEach(([value, label]) => {
      this.displayModeSelectEl?.createEl("option", {
        value,
        text: label,
      });
    });
    this.displayModeSelectEl.value = this.options.plugin.settings.pickerDisplayMode;
    this.displayModeSelectEl.addEventListener("change", async () => {
      this.options.plugin.settings.pickerDisplayMode = normalizePickerDisplayMode(this.displayModeSelectEl?.value);
      await this.options.plugin.saveSettings();
      this.syncModalAppearanceClasses();
    });

    this.currentSelectionEl = toolbarEl.createDiv({
      cls: "file-folder-icon-replacer__picker-current",
    });
    this.renderCurrentSelection();

    this.searchInputEl = toolbarEl.createEl("input", {
      cls: "file-folder-icon-replacer__picker-search",
      attr: {
        type: "search",
        placeholder: "搜索图标，例如 folder、file、image",
      },
    });
    this.searchInputEl.addEventListener("input", () => this.renderSections(this.searchInputEl?.value ?? ""));

    const recentSectionEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__picker-section" });
    recentSectionEl.createEl("h3", { text: "最近使用" });
    this.recentGridEl = recentSectionEl.createDiv({
      cls: "file-folder-icon-replacer__picker-grid file-folder-icon-replacer__picker-grid--recent",
    });

    const allSectionEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__picker-section" });
    allSectionEl.createEl("h3", { text: "全部图标" });
    this.allGridEl = allSectionEl.createDiv({
      cls: "file-folder-icon-replacer__picker-grid file-folder-icon-replacer__picker-grid--all",
    });

    this.renderSections("");
    window.setTimeout(() => this.searchInputEl?.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private syncModalAppearanceClasses(): void {
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

  private renderSections(query: string): void {
    this.renderCurrentSelection();
    this.renderRecentSection(query);
    this.renderAllSection(query);
  }

  private renderCurrentSelection(): void {
    if (!this.currentSelectionEl) {
      return;
    }

    clearElement(this.currentSelectionEl);

    const parsed = parseIconRef(this.options.selectedIconRef);
    const previewEl = this.currentSelectionEl.createSpan({
      cls: "file-folder-icon-replacer__picker-current-icon",
    });
    const labelWrapEl = this.currentSelectionEl.createDiv({
      cls: "file-folder-icon-replacer__picker-current-copy",
    });
    labelWrapEl.createEl("div", {
      cls: "file-folder-icon-replacer__picker-current-label",
      text: "当前选择",
    });
    labelWrapEl.createEl("div", {
      cls: "file-folder-icon-replacer__picker-current-name",
      text: this.options.plugin.describeIconRef(this.options.selectedIconRef),
    });

    if (parsed.type === "custom") {
      const customIcon = this.options.plugin.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (svgMarkup) {
        previewEl.innerHTML = svgMarkup;
        return;
      }
    }

    setIcon(previewEl, parsed.type === "builtin" ? parsed.value : "circle-help");
  }

  private renderRecentSection(query: string): void {
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
      this.recentGridEl.createEl("div", {
        cls: "file-folder-icon-replacer__picker-empty",
        text: "没有匹配的最近使用图标。",
      });
      return;
    }

    matches.forEach((iconRef) => this.renderPickerItem(this.recentGridEl!, iconRef));
  }

  private renderAllSection(query: string): void {
    if (!this.allGridEl) {
      return;
    }

    clearElement(this.allGridEl);
    const normalizedQuery = query.trim().toLowerCase();

    const builtinRefs = this.builtinIconNames
      .filter((iconName) => !normalizedQuery || iconName.toLowerCase().includes(normalizedQuery))
      .map((iconName) => makeBuiltinIconRef(iconName));

    const customRefs = this.options.plugin.settings.customIcons
      .filter((icon) => !normalizedQuery || icon.name.toLowerCase().includes(normalizedQuery) || icon.id.toLowerCase().includes(normalizedQuery))
      .map((icon) => makeCustomIconRef(icon.id));

    const seen = new Set<string>();
    const merged = [...customRefs, ...builtinRefs].filter((iconRef) => {
      if (seen.has(iconRef)) {
        return false;
      }
      seen.add(iconRef);
      return true;
    });

    if (merged.length === 0) {
      this.allGridEl.createEl("div", {
        cls: "file-folder-icon-replacer__picker-empty",
        text: "没有找到匹配的图标。",
      });
      return;
    }

    merged.slice(0, 240).forEach((iconRef) => this.renderPickerItem(this.allGridEl!, iconRef));
  }

  private renderPickerItem(containerEl: HTMLElement, iconRef: IconRef): void {
    const itemEl = containerEl.createEl("button", {
      cls: "file-folder-icon-replacer__picker-item",
      attr: {
        type: "button",
        "aria-label": this.options.plugin.describeIconRef(iconRef),
      },
    });

    if (iconRef === this.options.selectedIconRef) {
      itemEl.classList.add("is-selected");
    }

    const iconEl = itemEl.createSpan({ cls: "file-folder-icon-replacer__picker-item-icon" });
    const labelEl = itemEl.createSpan({
      cls: "file-folder-icon-replacer__picker-item-label",
      text: this.options.plugin.describeIconRef(iconRef),
    });

    clearElement(iconEl);
    const parsed = parseIconRef(iconRef);
    if (parsed.type === "custom") {
      const customIcon = this.options.plugin.getCustomIcon(parsed.value);
      const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
      if (svgMarkup) {
        iconEl.innerHTML = svgMarkup;
      } else {
        setIcon(iconEl, "circle-help");
      }
    } else {
      setIcon(iconEl, parsed.value);
    }

    itemEl.addEventListener("click", async () => {
      await this.options.onChoose(iconRef);
      this.close();
      new Notice(`已选择图标: ${this.options.plugin.describeIconRef(iconRef)}`);
    });

    labelEl.title = iconRef;
  }
}

class FolderOverridePickerModal extends Modal {
  private readonly options: FolderOverridePickerModalOptions;
  private closedIconRef: IconRef;
  private openIconRef: IconRef;
  private closedPreviewEl: HTMLSpanElement | null = null;
  private openPreviewEl: HTMLSpanElement | null = null;
  private closedLabelEl: HTMLSpanElement | null = null;
  private openLabelEl: HTMLSpanElement | null = null;

  constructor(app: App, options: FolderOverridePickerModalOptions) {
    super(app);
    this.options = options;
    this.closedIconRef = options.selectedClosedIconRef;
    this.openIconRef = options.selectedOpenIconRef;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: `Folder Icon - ${this.options.folder.name}` });
    contentEl.createEl("p", {
      cls: "file-folder-icon-replacer__picker-help",
      text: "为这个具体文件夹分别设置折叠和展开图标。",
    });

    const listEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__rules-list" });

    const closedCardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
    closedCardEl.createEl("strong", { text: "折叠图标" });
    const closedPickerEl = closedCardEl.createDiv({ cls: "file-folder-icon-replacer__inline-picker" });
    this.closedPreviewEl = closedPickerEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    this.closedLabelEl = closedPickerEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    const closedButton = closedPickerEl.createEl("button", { text: "选择", attr: { type: "button" } });
    const closedResetButton = closedPickerEl.createEl("button", { text: "默认", attr: { type: "button" } });

    const openCardEl = listEl.createDiv({ cls: "file-folder-icon-replacer__rule-card" });
    openCardEl.createEl("strong", { text: "展开图标" });
    const openPickerEl = openCardEl.createDiv({ cls: "file-folder-icon-replacer__inline-picker" });
    this.openPreviewEl = openPickerEl.createSpan({ cls: "file-folder-icon-replacer__setting-preview" });
    this.openLabelEl = openPickerEl.createSpan({ cls: "file-folder-icon-replacer__selection-label" });
    const openButton = openPickerEl.createEl("button", { text: "选择", attr: { type: "button" } });
    const openResetButton = openPickerEl.createEl("button", { text: "默认", attr: { type: "button" } });

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
        },
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
        },
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
      text: "保存",
      cls: "mod-cta",
      attr: { type: "button" },
    });
    const cancelButton = actionEl.createEl("button", {
      text: "取消",
      attr: { type: "button" },
    });

    cancelButton.addEventListener("click", () => this.close());
    saveButton.addEventListener("click", async () => {
      await this.options.onChoose(this.closedIconRef, this.openIconRef);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private updatePreviewAndLabel(
    previewEl: HTMLElement | null,
    labelEl: HTMLElement | null,
    iconRef: IconRef,
  ): void {
    if (previewEl) {
      clearElement(previewEl);
      const parsed = parseIconRef(iconRef);
      if (parsed.type === "custom") {
        const customIcon = this.options.plugin.getCustomIcon(parsed.value);
        const svgMarkup = customIcon ? extractSvgMarkup(customIcon.svg) : null;
        if (svgMarkup) {
          previewEl.innerHTML = svgMarkup;
        } else {
          setIcon(previewEl, "circle-help");
        }
      } else {
        setIcon(previewEl, parsed.value);
      }
    }

    if (labelEl) {
      labelEl.textContent = this.options.plugin.describeIconRef(iconRef);
      labelEl.title = iconRef;
    }
  }
}

class CustomIconEditorModal extends Modal {
  private readonly options: CustomIconEditorOptions;
  private nameInputEl: HTMLInputElement | null = null;
  private svgInputEl: HTMLTextAreaElement | null = null;
  private previewEl: HTMLDivElement | null = null;
  private drawingCanvasEl: HTMLCanvasElement | null = null;
  private strokeWidthInputEl: HTMLInputElement | null = null;
  private drawHintEl: HTMLDivElement | null = null;
  private svgFileInputEl: HTMLInputElement | null = null;
  private drawStrokes: DrawStroke[] = [];
  private activeStroke: DrawStroke | null = null;
  private pointerId: number | null = null;

  constructor(app: App, options: CustomIconEditorOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", {
      text: this.options.icon ? "编辑自定义 SVG 图标" : "新增自定义 SVG 图标",
    });
    contentEl.createEl("p", {
      cls: "file-folder-icon-replacer__picker-help",
      text: "这里可以直接手绘图标，或继续手动编辑 SVG。保存时会优先使用画板内容生成 SVG。",
    });

    const nameFieldEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__field" });
    nameFieldEl.createEl("label", { text: "图标名称" });
    this.nameInputEl = nameFieldEl.createEl("input", {
      attr: {
        type: "text",
        placeholder: "例如 Hand Drawn Folder",
      },
    });
    this.nameInputEl.value = this.options.icon?.name ?? "";

    const drawFieldEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__field" });
    drawFieldEl.createEl("label", { text: "简易画板" });
    const toolbarEl = drawFieldEl.createDiv({ cls: "file-folder-icon-replacer__draw-toolbar" });
    const widthLabelEl = toolbarEl.createEl("label", {
      cls: "file-folder-icon-replacer__draw-width-label",
      text: "线宽",
    });
    this.strokeWidthInputEl = widthLabelEl.createEl("input", {
      attr: {
        type: "range",
        min: "1",
        max: "4",
        step: "0.5",
      },
    });
    this.strokeWidthInputEl.value = "2";

    const undoButton = toolbarEl.createEl("button", {
      text: "撤销一笔",
      attr: { type: "button" },
    });
    const clearButton = toolbarEl.createEl("button", {
      text: "清空画板",
      attr: { type: "button" },
    });
    const importButton = toolbarEl.createEl("button", {
      text: "导入 SVG",
      attr: { type: "button" },
    });
    const syncButton = toolbarEl.createEl("button", {
      text: "生成 SVG 到文本框",
      cls: "mod-cta",
      attr: { type: "button" },
    });

    this.svgFileInputEl = drawFieldEl.createEl("input", {
      attr: {
        type: "file",
        accept: ".svg,image/svg+xml",
      },
    });
    this.svgFileInputEl.className = "file-folder-icon-replacer__hidden-input";
    this.svgFileInputEl.addEventListener("change", async () => {
      const file = this.svgFileInputEl?.files?.[0];
      if (!file) {
        return;
      }

      const fileText = await file.text();
      const svgMarkup = extractSvgMarkup(fileText);
      if (!svgMarkup) {
        new Notice("导入失败：文件不是有效的 SVG。");
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
    });

    this.drawingCanvasEl = drawFieldEl.createEl("canvas", {
      cls: "file-folder-icon-replacer__draw-canvas",
      attr: {
        width: "240",
        height: "240",
      },
    });
    this.drawHintEl = drawFieldEl.createDiv({
      cls: "file-folder-icon-replacer__draw-hint",
      text: "按住鼠标或手指即可绘制。图标会按 24x24 坐标保存为 SVG。",
    });
    this.bindCanvasDrawing();
    this.redrawCanvas();

    const svgFieldEl = contentEl.createDiv({ cls: "file-folder-icon-replacer__field" });
    svgFieldEl.createEl("label", { text: "SVG 内容" });
    this.svgInputEl = svgFieldEl.createEl("textarea", {
      cls: "file-folder-icon-replacer__svg-editor",
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
      text: this.options.icon ? "保存修改" : "创建图标",
      cls: "mod-cta",
      attr: { type: "button" },
    });
    const cancelButton = actionEl.createEl("button", {
      text: "取消",
      attr: { type: "button" },
    });

    cancelButton.addEventListener("click", () => this.close());
    saveButton.addEventListener("click", async () => {
      const name = this.nameInputEl?.value.trim() || "Custom SVG";
      this.syncDrawingToSvgEditor();
      const svg = this.svgInputEl?.value.trim() ?? "";
      const svgMarkup = extractSvgMarkup(svg);

      if (!svgMarkup) {
        new Notice("SVG 内容无效，请确认包含完整的 <svg>...</svg>。");
        return;
      }

      await this.options.onSave({
        id: this.options.icon?.id ?? createId(),
        name,
        svg: svgMarkup,
      });

      this.close();
    });
  }

  onClose(): void {
    this.pointerId = null;
    this.activeStroke = null;
    this.contentEl.empty();
  }

  private renderPreview(): void {
    if (!this.previewEl) {
      return;
    }

    clearElement(this.previewEl);
    const svgMarkup = extractSvgMarkup(this.svgInputEl?.value ?? "");
    if (!svgMarkup) {
      this.previewEl.createEl("div", {
        cls: "file-folder-icon-replacer__empty-state",
        text: "SVG 预览不可用，请检查内容格式。",
      });
      return;
    }

    this.previewEl.innerHTML = svgMarkup;
  }

  private bindCanvasDrawing(): void {
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
        width: Number(this.strokeWidthInputEl?.value ?? "2"),
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

    const finishStroke = (event: PointerEvent) => {
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

  private getCanvasPoint(event: PointerEvent): DrawPoint {
    const rect = this.drawingCanvasEl?.getBoundingClientRect();
    if (!rect || !this.drawingCanvasEl) {
      return { x: 12, y: 12 };
    }

    const scaleX = this.drawingCanvasEl.width / rect.width;
    const scaleY = this.drawingCanvasEl.height / rect.height;
    const rawX = (event.clientX - rect.left) * scaleX;
    const rawY = (event.clientY - rect.top) * scaleY;

    return {
      x: (rawX / this.drawingCanvasEl.width) * 24,
      y: (rawY / this.drawingCanvasEl.height) * 24,
    };
  }

  private redrawCanvas(): void {
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
        context.arc(point.x * scale, point.y * scale, (stroke.width * scale) / 2, 0, Math.PI * 2);
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
      this.drawHintEl.textContent =
        this.drawStrokes.length > 0
          ? `已绘制 ${this.drawStrokes.length} 笔。保存时会优先使用画板内容。`
          : "按住鼠标或手指即可绘制。图标会按 24x24 坐标保存为 SVG。";
    }
  }

  private appendPointToActiveStroke(point: DrawPoint): void {
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

  private syncDrawingToSvgEditor(): void {
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
}
