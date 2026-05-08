import { Component, AssetManager, Asset, SpriteFrame, sp, Color } from 'cc';

/**
 * 引用计数缓存条目的最小约束
 */
interface RefCountEntry {
    refCount: number;
    lastAccessAt: number;
}
/**
 * 泛型引用计数缓存
 *
 * 提供：缓存命中自动 refCount++、请求去重（pending）、
 * 释放（refCount-- → 归零销毁）、空闲回收、强制释放等能力。
 *
 * 各 Manager 注入不同的 onDestroy 回调以控制实际销毁逻辑。
 */
declare class RefCountCache<TEntry extends RefCountEntry> {
    private _onDestroy;
    private _cache;
    private _pending;
    constructor(_onDestroy: (key: string, entry: TEntry) => void);
    /**
     * 获取缓存条目，命中则 refCount++ 并更新访问时间。
     * 若 isValid 返回 false，自动删除失效条目并返回 null。
     */
    get(key: string, isValid?: (entry: TEntry) => boolean): TEntry | null;
    set(key: string, entry: TEntry): void;
    delete(key: string): void;
    /**
     * 获取进行中的请求。命中则 callerCount++，返回 Promise；未命中返回 null。
     */
    getPending(key: string): Promise<TEntry> | null;
    setPending(key: string, promise: Promise<TEntry>): void;
    deletePending(key: string): void;
    /** refCount-- → 归零时调用 onDestroy */
    release(key: string): void;
    /** 直接销毁，忽略 refCount */
    forceRelease(key: string): void;
    /** 释放所有条目 */
    releaseAll(): void;
    /** 释放 refCount<=0 且空闲超过 maxIdleMs 的条目 */
    releaseIdle(maxIdleMs: number): void;
    has(key: string): boolean;
    getEntry(key: string): TEntry | undefined;
    getRefCount(key: string): number;
    get size(): number;
    forEach(fn: (entry: TEntry, key: string) => void): void;
}

/** Handle 最小约束：必须有 release 方法 */
interface Releasable {
    release: () => void;
}
/**
 * 资源加载组件基类
 *
 * 提取 4 个 Loader 组件共有的模式：
 * · _seq 竞态防护（快速切换时旧请求自动失效）
 * · _currentHandle 生命周期管理
 * · clear() / onDestroy() 自动清理
 *
 * 不加 @ccclass，只有子类加。
 */
declare abstract class BaseAssetLoader<THandle extends Releasable> extends Component {
    protected _currentHandle: THandle | null;
    protected _currentKey: string;
    protected _seq: number;
    protected _loading: boolean;
    /** 获取目标组件引用（Sprite / sp.Skeleton） */
    protected abstract onInit(): void;
    /** autoLoad 时触发的加载逻辑 */
    protected abstract doAutoLoad(): void;
    /** 将 Handle 应用到节点（设置 spriteFrame / skeletonData） */
    protected abstract applyHandle(handle: THandle): void;
    /** 清空节点显示（spriteFrame = null / skeletonData = null） */
    protected abstract clearVisual(): void;
    /** 释放 Handle 前的回调（Spine: 先断开 skeletonData 引用；Sprite: 先断开 spriteFrame 引用） */
    protected beforeRelease(): void;
    onLoad(): void;
    onDestroy(): void;
    get isLoading(): boolean;
    /**
     * 清空显示并释放资源
     */
    clear(): void;
    /**
     * 竞态安全的资源加载模板
     *
     * @param key           去重 key（path / url）
     * @param acquire       异步获取 Handle 的函数
     * @param releaseStale  加载完成但 seq 已过期时的释放函数
     * @param beforeAcquire 开始加载前的回调（如显示占位）
     */
    protected _loadTemplate(key: string, acquire: () => Promise<THandle>, releaseStale: (handle: THandle) => void, beforeAcquire?: () => void): Promise<boolean>;
    protected _releaseCurrent(): void;
}

declare class BundleManager {
    private static _inst;
    static get instance(): BundleManager;
    private _rc;
    private constructor();
    /**
     * 加载 Bundle（本地名称或远程 URL）
     *
     * - resources 始终可用，调用此方法会直接返回
     * - 已加载的 Bundle refCount++
     * - 同一 Bundle 并发请求自动去重
     */
    loadBundle(nameOrUrl: string): Promise<AssetManager.Bundle>;
    /**
     * 获取已加载的 Bundle（不增加引用计数）
     * resources 始终返回
     */
    getBundle(name: string): AssetManager.Bundle | null;
    /**
     * 释放 Bundle 引用（refCount-- → 归零调 removeBundle）
     * resources 不可释放
     */
    releaseBundle(name: string): void;
    /** 强制释放 Bundle（忽略引用计数） */
    forceReleaseBundle(name: string): void;
    /** 释放所有已加载的 Bundle（不含 resources） */
    releaseAll(): void;
    has(name: string): boolean;
    getRefCount(name: string): number;
    get bundleCount(): number;
    dump(): any[];
    private _doLoad;
}

declare class LocalResManager {
    private static _inst;
    static get instance(): LocalResManager;
    private _rc;
    private constructor();
    /**
     * 获取 Bundle 实例
     * - 不传或传 'resources' → 返回内置 resources
     * - 其他名称 → 从 BundleManager 获取（需先 loadBundle）
     */
    private _getBundle;
    /**
     * 加载资源
     *
     * @param path        相对于 Bundle 的路径，不含扩展名
     * @param type        资源类型，例: SpriteFrame, Texture2D, SpriteAtlas
     * @param bundleName  Bundle 名称，默认 'resources'
     *
     * 流程：
     *  缓存命中  → refCount++ 直接返回
     *  请求去重  → 复用进行中的 Promise
     *  新请求    → bundle.load + addRef + 写缓存
     */
    load<T extends Asset>(path: string, type: typeof Asset, bundleName?: string): Promise<T>;
    loadSpriteFrame(path: string, bundleName?: string): Promise<SpriteFrame>;
    loadFromAtlas(atlasPath: string, frameName: string, bundleName?: string): Promise<SpriteFrame>;
    loadSpriteFrames(paths: string[], onProgress?: (loaded: number, total: number) => void, bundleName?: string): Promise<SpriteFrame[]>;
    loadDir(dir: string, bundleName?: string): Promise<SpriteFrame[]>;
    preloadSpriteFrame(path: string, bundleName?: string): Promise<void>;
    loadSpineData(path: string, bundleName?: string): Promise<sp.SkeletonData>;
    releaseSpineData(path: string, bundleName?: string): void;
    preloadSpineData(path: string, bundleName?: string): Promise<void>;
    loadSpineDataBatch(paths: string[], onProgress?: (loaded: number, total: number) => void, bundleName?: string): Promise<sp.SkeletonData[]>;
    /**
     * 泛型批量加载
     *
     * @param paths       资源路径数组
     * @param type        资源类型
     * @param opts        可选项：bundleName、onProgress
     */
    loadBatch<T extends Asset>(paths: string[], type: typeof Asset, opts?: {
        bundleName?: string;
        onProgress?: (done: number, total: number) => void;
    }): Promise<T[]>;
    /** 批量释放 */
    releaseBatch(paths: string[], type: typeof Asset, bundleName?: string): void;
    release(path: string, type: typeof Asset, bundleName?: string): void;
    releaseSpriteFrame(path: string, bundleName?: string): void;
    releaseAtlasFrame(atlasPath: string, frameName: string, bundleName?: string): void;
    releaseAtlas(atlasPath: string, bundleName?: string): void;
    forceRelease(path: string, type: typeof Asset, bundleName?: string): void;
    releaseAll(): void;
    releaseIdle(maxIdleMs: number): void;
    has(path: string, type: typeof Asset, bundleName?: string): boolean;
    getRefCount(path: string, type: typeof Asset, bundleName?: string): number;
    get cacheCount(): number;
    dump(): any[];
    private _key;
    private _doLoad;
}

/** 本地 Sprite 句柄 */
interface LocalSpriteHandle extends Releasable {
    id: string;
    spriteFrame: SpriteFrame;
}
declare class LocalSpriteLoader extends BaseAssetLoader<LocalSpriteHandle> {
    initialPath: string;
    autoLoad: boolean;
    private _sprite;
    protected onInit(): void;
    protected doAutoLoad(): void;
    protected applyHandle(h: LocalSpriteHandle): void;
    protected clearVisual(): void;
    protected beforeRelease(): void;
    get currentId(): string;
    loadPath(path: string): Promise<boolean>;
    loadFromAtlas(atlasPath: string, frameName: string): Promise<boolean>;
}

/** 本地 Spine 句柄 */
interface LocalSpineHandle extends Releasable {
    path: string;
    skeletonData: sp.SkeletonData;
}
declare class LocalSpineLoader extends BaseAssetLoader<LocalSpineHandle> {
    initialPath: string;
    autoPlayAnimation: string;
    autoPlayLoop: boolean;
    autoLoad: boolean;
    private _skeleton;
    protected onInit(): void;
    protected doAutoLoad(): void;
    protected applyHandle(h: LocalSpineHandle): void;
    protected clearVisual(): void;
    protected beforeRelease(): void;
    get currentPath(): string;
    get skeleton(): sp.Skeleton | null;
    loadPath(path: string): Promise<boolean>;
    setAnimation(name: string, loop?: boolean, trackIndex?: number): void;
    addAnimation(name: string, loop?: boolean, delay?: number, trackIndex?: number): void;
    setSkin(skinName: string): void;
    getAnimationNames(): string[];
    getSkinNames(): string[];
    reload(): Promise<boolean>;
}

interface RetryPolicy {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}
interface LoadOptions$1 {
    type?: typeof Asset;
    retry?: Partial<RetryPolicy>;
    timeout?: number;
    ext?: string;
}
declare class RemoteAssetManager {
    private static _inst;
    static get instance(): RemoteAssetManager;
    private _rc;
    private _defaultRetry;
    private _defaultTimeout;
    private _maxCacheSize;
    private constructor();
    configure(opts: {
        retry?: Partial<RetryPolicy>;
        timeout?: number;
        maxCacheSize?: number;
    }): void;
    load<T extends Asset>(url: string, options?: LoadOptions$1): Promise<T>;
    addRef(url: string, options?: LoadOptions$1): boolean;
    release(url: string, options?: LoadOptions$1): void;
    forceRelease(url: string, options?: LoadOptions$1): void;
    releaseAll(): void;
    releaseIdle(maxIdleMs: number): void;
    /**
     * 批量加载远程资源（并行，单个失败不影响其他）
     */
    loadBatch<T extends Asset>(tasks: Array<{
        url: string;
        options?: LoadOptions$1;
    }>, onProgress?: (done: number, total: number) => void): Promise<Map<string, T>>;
    /** 批量释放 */
    releaseBatch(tasks: Array<{
        url: string;
        options?: LoadOptions$1;
    }>): void;
    has(url: string, opts?: LoadOptions$1): boolean;
    isLoading(url: string, opts?: LoadOptions$1): boolean;
    getRefCount(url: string, opts?: LoadOptions$1): number;
    get cacheCount(): number;
    dump(): any[];
    _key(url: string, opts?: LoadOptions$1): string;
    private _loadWithRetry;
    private _loadOnce;
    private _estimateSize;
    private _evictLRU;
}

/** acquire 返回给上层的句柄 */
interface SpriteHandle {
    url: string;
    spriteFrame: SpriteFrame;
    release: () => void;
}
declare class RemoteSpriteManager {
    private static _inst;
    static get instance(): RemoteSpriteManager;
    private _rc;
    private constructor();
    acquire(url: string, retry?: LoadOptions$1['retry']): Promise<SpriteHandle>;
    acquireBatch(urls: string[], onProgress?: (loaded: number, total: number) => void): Promise<SpriteHandle[]>;
    preload(url: string): Promise<void>;
    getTextureRefCount(url: string): number;
    get poolSize(): number;
    dump(): any[];
    purgeAll(): void;
    /**
     * 释放链路（由外到内）：
     *  1. SpriteFrame.destroy()       — 调用者独有
     *  2. 纹理池 refCount--
     *     → 归零则 Texture2D.destroy() — 释放 GPU 显存
     *  3. RemoteAssetManager.release() — ImageAsset refCount--
     */
    private _releaseOne;
    static _guessExt(url: string): string;
}

declare class RemoteSpriteLoader extends BaseAssetLoader<SpriteHandle> {
    initialUrl: string;
    placeholderColor: Color;
    autoLoad: boolean;
    fadeInDuration: number;
    private _sprite;
    protected onInit(): void;
    protected doAutoLoad(): void;
    protected applyHandle(h: SpriteHandle): void;
    protected clearVisual(): void;
    get currentUrl(): string;
    loadUrl(url: string): Promise<boolean>;
    reload(): Promise<boolean>;
    private _showPlaceholder;
    private _fadeIn;
}

/** Spine 加载配置 */
interface SpineLoadConfig {
    skelUrl: string;
    atlasUrl?: string;
    textureBaseUrl?: string;
    retry?: Partial<RetryPolicy>;
    timeout?: number;
}
/** acquire 返回给上层的句柄 */
interface SpineHandle {
    key: string;
    skeletonData: sp.SkeletonData;
    release: () => void;
}
declare class RemoteSpineManager {
    private static _inst;
    static get instance(): RemoteSpineManager;
    private _rc;
    private _defaultRetry;
    private _defaultTimeout;
    private constructor();
    acquire(config: SpineLoadConfig): Promise<SpineHandle>;
    preload(config: SpineLoadConfig): Promise<void>;
    getRefCount(config: SpineLoadConfig): number;
    get poolSize(): number;
    dump(): any[];
    purgeAll(): void;
    private _doLoad;
    private _wrapHandle;
    private _fetchJson;
    private _fetchText;
    private _fetchBinary;
    private _fetchWithRetry;
    private _xhrOnce;
    static _parseAtlasPages(atlasText: string): string[];
}

declare class RemoteSpineLoader extends BaseAssetLoader<SpineHandle> {
    initialSkelUrl: string;
    initialAtlasUrl: string;
    autoPlayAnimation: string;
    autoPlayLoop: boolean;
    autoLoad: boolean;
    private _skeleton;
    protected onInit(): void;
    protected doAutoLoad(): void;
    protected applyHandle(h: SpineHandle): void;
    protected clearVisual(): void;
    protected beforeRelease(): void;
    get currentKey(): string;
    get skeleton(): sp.Skeleton | null;
    loadSpine(config: SpineLoadConfig): Promise<boolean>;
    loadUrl(skelUrl: string, atlasUrl?: string): Promise<boolean>;
    setAnimation(name: string, loop?: boolean, trackIndex?: number): void;
    addAnimation(name: string, loop?: boolean, delay?: number, trackIndex?: number): void;
    setSkin(skinName: string): void;
    getAnimationNames(): string[];
    reload(): Promise<boolean>;
}

/**
 * 远程资源类型
 */
declare enum RemoteAssetType {
    JSON = "json",
    TEXT = "text",
    FONT = "font",
    IMAGE = "image",
    AUDIO = "audio"
}
/**
 * 加载选项
 */
interface LoadOptions {
    /** 强制指定资源类型（不指定则根据后缀自动推断） */
    type?: RemoteAssetType;
    /** 强制指定扩展名（用于 URL 无后缀的情况，如 CDN 鉴权链接） */
    ext?: string;
    /** 超时毫秒，默认 15000 */
    timeout?: number;
    /** 失败重试次数，默认 2 */
    retry?: number;
    /** 是否使用缓存，默认 true */
    useCache?: boolean;
    /** 进度回调（仅 batch 生效） */
    onProgress?: (finished: number, total: number) => void;
}
/**
 * 字体专用选项
 */
interface FontLoadOptions extends LoadOptions {
    /** 指定字体在 CSS/Canvas 中的 family 名称，不传则从 URL 推断 */
    fontFamily?: string;
}
/**
 * 批量加载任务
 */
interface LoadTask {
    url: string;
    options?: LoadOptions;
}
/**
 * 回调签名（与 cc.assetManager 保持一致：err 优先）
 */
type CompleteCallback<T = any> = (err: Error | null, data: T | null) => void;
/**
 * 批量加载完成回调
 */
type BatchCompleteCallback = (errors: Map<string, Error>, results: Map<string, any>) => void;
/**
 * 通用远程资源加载管理器
 *
 * 使用示例：
 *   const data = await RemoteLoader.instance.load<any>('https://xxx/config.json');
 *   const txt  = await RemoteLoader.instance.load<string>('https://xxx/dialog.txt');
 *   const fam  = await RemoteLoader.instance.loadFont('https://xxx/alibaba.ttf');
 *   label.fontFamily = fam; // Label 组件 useSystemFont = true 时生效
 */
declare class RemoteLoader {
    private static _instance;
    static get instance(): RemoteLoader;
    /** 已加载资源缓存 url -> asset */
    private _cache;
    /** 进行中的请求，用于去重 url -> promise */
    private _pending;
    /** 已注册的字体 family 集合 */
    private _loadedFonts;
    private _defaultTimeout;
    private _defaultRetry;
    /**
     * 加载单个远程资源
     *
     * 支持三种调用方式：
     *   1. Promise:   await load(url)
     *   2. Promise:   await load(url, options)
     *   3. Callback:  load(url, (err, data) => {})
     *   4. Callback:  load(url, options, (err, data) => {})
     */
    load<T = any>(url: string, callback: CompleteCallback<T>): void;
    load<T = any>(url: string, options: LoadOptions, callback: CompleteCallback<T>): void;
    load<T = any>(url: string, options?: LoadOptions): Promise<T>;
    /**
     * 真正的加载逻辑（内部使用，永远返回 Promise）
     */
    private _loadInternal;
    /**
     * 便捷方法：加载 JSON
     */
    loadJson<T = any>(url: string, callback: CompleteCallback<T>): void;
    loadJson<T = any>(url: string, options: LoadOptions, callback: CompleteCallback<T>): void;
    loadJson<T = any>(url: string, options?: LoadOptions): Promise<T>;
    /**
     * 便捷方法：加载文本
     */
    loadText(url: string, callback: CompleteCallback<string>): void;
    loadText(url: string, options: LoadOptions, callback: CompleteCallback<string>): void;
    loadText(url: string, options?: LoadOptions): Promise<string>;
    /**
     * 便捷方法：加载字体，返回可用于 Label 的 fontFamily 名称
     */
    loadFont(url: string, callback: CompleteCallback<string>): void;
    loadFont(url: string, options: FontLoadOptions, callback: CompleteCallback<string>): void;
    loadFont(url: string, options?: FontLoadOptions): Promise<string>;
    /**
     * 内部统一分发：把 type 合并进 options 后再转给 load()
     */
    private _invokeTyped;
    /**
     * 批量并行加载（任一失败不影响其他）
     *
     * 支持用法：
     *   1. await loadBatch(tasks)
     *   2. await loadBatch(tasks, onProgress)
     *   3. loadBatch(tasks, onProgress, onComplete)    // 回调模式：必须两个回调都传
     *
     * 说明：回调模式强制同时传 onProgress 和 onComplete，避免单函数参数在运行时无法区分。
     *      不需要进度时传 `() => {}` 即可。
     */
    loadBatch(tasks: LoadTask[], onProgress: (finished: number, total: number) => void, onComplete: BatchCompleteCallback): void;
    loadBatch(tasks: LoadTask[], onProgress?: (finished: number, total: number) => void): Promise<Map<string, any>>;
    private _loadBatchInternal;
    /**
     * 预加载，不关心返回值
     */
    preload(urls: string[], callback: (err: Error | null) => void): void;
    preload(urls: string[]): Promise<void>;
    /**
     * 清除缓存
     * @param url 不传则清除全部
     */
    clearCache(url?: string): void;
    /**
     * 释放单个资源（包括引擎层 release）
     */
    release(url: string): void;
    private _loadWithRetry;
    private _loadWithTimeout;
    private _dispatch;
    private _loadJson;
    private _loadText;
    private _loadImage;
    private _loadAudio;
    /**
     * 字体加载：
     * - Web/小游戏平台：使用 FontFace API 注册到 document.fonts
     * - Native：下载到本地 writablePath 后，通过 Label 的 fontFamily 引用
     * 返回值为可赋给 Label.fontFamily 的字符串
     */
    private _loadFont;
    private _loadFontWeb;
    private _loadFontNative;
    private _detectType;
    private _getExtFromUrl;
    private _getFontFamily;
}

export { BaseAssetLoader, BundleManager, LocalResManager, LocalSpineLoader, LocalSpriteLoader, RefCountCache, RemoteAssetManager, RemoteLoader, RemoteSpineLoader, RemoteSpineManager, RemoteSpriteLoader, RemoteSpriteManager };
export type { RefCountEntry, Releasable };
