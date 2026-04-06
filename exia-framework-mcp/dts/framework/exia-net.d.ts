/**
 * @Description: 网络请求接口
 */

interface IHttpRequest {
    /** 请求方法 */
    readonly method: HttpRequestMethod;
    /** 请求超时时间 (s) */
    readonly timeout: number;
    /** 响应类型 */
    readonly responseType: HttpResponseType;
}

/**
 * @Description: 网络响应接口
 */

interface IHttpResponse {
    /** 信息 */
    readonly message: string;
    /** 响应数据 */
    readonly data: HttpResponseDataType;
    /** http状态码 */
    readonly statusCode: number;
    /** 相应头 */
    readonly headers: any;
}

declare class HttpRequest implements IHttpRequest, IHttpResponse {
    /** 请求方法 */
    method: HttpRequestMethod;
    /** 请求超时时间 (s) */
    timeout: number;
    /** 响应类型 */
    responseType: HttpResponseType;
    /** 信息 */
    message: string;
    /** 响应数据 */
    data: HttpResponseDataType;
    /**
     * http相应状态码
     * @readonly
     * @type {number}
     */
    get statusCode(): number;
    /** 相应头 */
    get headers(): any;
    constructor();
    setNetCallback(callback: (result: "succeed" | "fail", response: IHttpResponse) => void): void;
    send(url: string, data: any, headers: any[]): void;
    /**
     * 终止Http请求
     * @param {boolean} [silent=false] 如果为true则不会回调错误信息
     */
    abort(silent?: boolean): void;
}

/**
 * @Description: 网络事件
 */

interface IHttpEvent {
    /** 名称 */
    name?: string;
    /** 自定义参数 */
    data?: any;
    /** 网络请求成功 */
    onComplete(response: IHttpResponse): void;
    /** 网络请求失败 */
    onError(response: IHttpResponse): void;
}

/**
 * @Description: 网络请求管理器
 */

/** http请求方法 */
type HttpRequestMethod = "GET" | "POST" | "HEAD" | "PUT";
/** http响应类型 */
type HttpResponseType = "text" | "json" | "arraybuffer";
/** http响应数据类型 */
type HttpResponseDataType = string | ArrayBuffer | object;
declare class HttpManager {
    static HttpEvent: string;
    /**
     * 发送post请求
     * @param {string} url 请求地址
     * @param {any} data 请求数据
     * @param {HttpResponseType} responseType 响应类型
     * @param {IHttpEvent} netEvent 网络事件
     * @param {any[]} headers 请求头 [key1, value1, key2, value2, ...] 形式
     * @param {number} timeout (单位s) 请求超时时间 默认0 (0表示不超时)
     */
    static post(url: string, data: any, responseType: HttpResponseType, netEvent: IHttpEvent, headers?: any[], timeout?: number): HttpRequest;
    /**
     * 发送get请求
     * @param {string} url 请求地址
     * @param {any} data 请求数据
     * @param {HttpResponseType} responseType 响应类型
     * @param {IHttpEvent} netEvent 网络事件
     * @param {any[]} headers 请求头 [key1, value1, key2, value2, ...] 形式
     * @param {number} timeout (单位s) 请求超时时间 默认0 (0表示不超时)
     */
    static get(url: string, data: any, responseType: HttpResponseType, netEvent: IHttpEvent, headers?: any[], timeout?: number): HttpRequest;
    /**
     * 发送put请求
     * @param {string} url 请求地址
     * @param {any} data 请求数据
     * @param {HttpResponseType} responseType 响应类型
     * @param {IHttpEvent} netEvent 网络事件
     * @param {any[]} headers 请求头 [key1, value1, key2, value2, ...] 形式
     * @param {number} timeout (单位s) 请求超时时间 默认0 (0表示不超时)
     */
    static put(url: string, data: any, responseType: HttpResponseType, netEvent: IHttpEvent, headers?: any[], timeout?: number): HttpRequest;
    /**
     * 发送head请求
     * @param {string} url 请求地址
     * @param {any} data 请求数据
     * @param {HttpResponseType} responseType 响应类型
     * @param {IHttpEvent} netEvent 网络事件
     * @param {any[]} headers 请求头 [key1, value1, key2, value2, ...] 形式
     * @param {number} timeout (单位s) 请求超时时间 默认0 (0表示不超时)
     */
    static head(url: string, data: any, responseType: HttpResponseType, netEvent: IHttpEvent, headers?: any[], timeout?: number): HttpRequest;
}

/**
 * @Description: 网络任务
 */

declare abstract class HttpTask implements IHttpEvent {
    /** 名称 */
    name: string;
    /** 自定义参数 */
    data?: any;
    /** 请求完成 */
    abstract onComplete(response: IHttpResponse): void;
    /** 请求错误 */
    abstract onError(response: IHttpResponse): void;
    /** 请求开始 */
    abstract start(): void;
}

/**
 * @Description: 网络socket
 */
type BinaryType = "blob" | "arraybuffer";
interface SocketOptions {
    /**
     * 给原生平台 和 web 用
     * 一个协议字符串或者一个包含协议字符串的数组。
     * 这些字符串用于指定子协议，这样单个服务器可以实现多个 WebSocket 子协议（
     * 例如，你可能希望一台服务器能够根据指定的协议（protocol）处理不同类型的交互。
     * 如果不指定协议字符串，则假定为空字符串。
     */
    protocols?: string[];
    /**
     * 使用 Blob 对象处理二进制数据。这是默认值
     * 使用 ArrayBuffer 对象处理二进制数据
     * @url https://developer.mozilla.org/docs/Web/API/WebSocket/binaryType
     */
    binaryType?: BinaryType;
    /** 超时时间 默认3000毫秒 */
    timeout?: number;
}
declare class Socket {
    /**
     * @param {string} url 要连接的 URL；这应该是 WebSocket 服务器将响应的 URL
     * @param {SocketOptions} options 可选参数 针对不同平台的一些特殊参数 详细信息见定义
     */
    constructor(url: string, options?: SocketOptions);
    /**
     * 发送文本数据
     * @param data - 文本数据
     */
    send(data: string): void;
    /**
     * 发送二进制数据
     * @param data - 二进制数据
     */
    sendBuffer(data: ArrayBuffer): void;
    /**
     * 客户端主动断开
     * @param code - 关闭代码: 如果没有传这个参数，默认使用1000, 客户端可使用的数字范围: [3001-3999]
     * @param reason - 关闭原因: 一个人类可读的字符串，它解释了连接关闭的原因。这个 UTF-8 编码的字符串不能超过 123 个字节
     */
    close(code?: number, reason?: string): void;
    /**
     * 获取socket示例
     * 在微信小游戏、支付宝小游戏、抖音小游戏 返回的是他们平台的socket实例类型
     */
    socket<T>(): T;
    /**
     * socket已准备好 open成功
     * 当前连接已经准备好发送和接受数据
     */
    onopen: () => void;
    /**
     * 接收到服务端发送的消息
     * @param data - 消息数据
     */
    onmessage: (data: string | ArrayBuffer) => void;
    /**
     * 监听可能发生的错误，一般用不到
     */
    onerror: () => void;
    /**
     * 关闭连接
     * @param code - 关闭代码
     * @param reason - 关闭原因
     */
    onclose: (code: number, reason: string) => void;
}

/**
 * @Description: 读取网络文件内容
 */
declare class ReadNetFile {
    constructor(res: {
        url: string;
        timeout: number;
        responseType: "text" | "json" | "arraybuffer";
        onComplete: (data: any) => void;
        onError: (code: number, message: string) => void;
    });
}

export { HttpManager, HttpTask, ReadNetFile, Socket };
export type { HttpRequestMethod, HttpResponseDataType, HttpResponseType, IHttpEvent, IHttpRequest, IHttpResponse };
