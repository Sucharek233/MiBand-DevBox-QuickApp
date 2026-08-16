export default function(global, globalThis, window, $app_exports$, $app_evaluate$) {
    var org_app_require = $app_require$;
    (function(global, globalThis, window, $app_exports$, $app_evaluate$) {
        var setTimeout = global.setTimeout;
        var setInterval = global.setInterval;
        var clearTimeout = global.clearTimeout;
        var clearInterval = global.clearInterval;
        var $app_require$1 = global.$app_require$ || org_app_require;
        var createPageHandler = function() {
            return (()=>{
                var __webpack_modules__ = {
                    "./src/communication/interconnect.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        var _system = _interopRequireDefault($app_require$1("@app-module/system.interconnect"));
                        var _system2 = _interopRequireDefault($app_require$1("@app-module/system.app"));
                        function _interopRequireDefault(e) {
                            return e && e.__esModule ? e : {
                                default: e
                            };
                        }
                        class InterconnectClient {
                            constructor({ debug = false } = {}){
                                this.debug = debug;
                                this.conn = null;
                                this.connected = false;
                                this.connecting = false;
                                this.messageHandler = ()=>{};
                                this.openHandler = ()=>{};
                                this.closeHandler = ()=>{};
                                this.errorHandler = ()=>{};
                            }
                            log(...args) {
                                if (this.debug) console.log("[Interconnect]", ...args);
                            }
                            onMessage(handler) {
                                this.messageHandler = handler;
                            }
                            onOpen(handler) {
                                this.openHandler = handler;
                            }
                            onClose(handler) {
                                this.closeHandler = handler;
                            }
                            onError(handler) {
                                this.errorHandler = handler;
                            }
                            async connect() {
                                if (this.connected) return void this.log("Already connected.");
                                if (this.connecting) throw new Error("Connection already in progress.");
                                if (!_system2.default.canIUse("@system.interconnect")) throw new Error("Interconnect API unavailable.");
                                this.connecting = true;
                                this.conn = _system.default.instance();
                                this.installHandlers();
                                await this.waitForConnection();
                                this.connecting = false;
                            }
                            installHandlers() {
                                this.conn.onopen = ()=>{
                                    this.connected = true;
                                    this.log("Connected.");
                                    this.openHandler();
                                };
                                this.conn.onclose = (data)=>{
                                    this.connected = false;
                                    this.log("Disconnected.");
                                    this.closeHandler(data);
                                };
                                this.conn.onerror = (err)=>{
                                    this.log("Error:", err);
                                    this.errorHandler(err);
                                };
                                this.conn.onmessage = (event)=>{
                                    this.log("Received:", event.data);
                                    try {
                                        this.messageHandler(event.data);
                                    } catch (e) {
                                        console.error(e);
                                    }
                                };
                            }
                            waitForConnection() {
                                return new Promise((resolve, reject)=>{
                                    this.conn.getReadyState({
                                        success: ({ status })=>{
                                            switch(status){
                                                case 0:
                                                    this.log("Connecting...");
                                                    break;
                                                case 1:
                                                    this.log("Ready.");
                                                    resolve();
                                                    break;
                                                case 2:
                                                    reject(new Error("Connection failed."));
                                                    this.connecting = false;
                                                    break;
                                                default:
                                                    this.connecting = false;
                                                    reject(new Error(`Unknown state ${status}`));
                                            }
                                        },
                                        fail: (_, code)=>{
                                            this.connecting = false;
                                            reject(new Error(`getReadyState failed (${code})`));
                                        }
                                    });
                                });
                            }
                            send(data) {
                                if (!this.connected) throw new Error("Not connected.");
                                return new Promise((resolve, reject)=>{
                                    this.conn.send({
                                        data,
                                        success: resolve,
                                        fail: reject
                                    });
                                });
                            }
                            disconnect() {
                                var _this$conn$destroy, _this$conn;
                                if (!this.conn) return;
                                null == (_this$conn$destroy = (_this$conn = this.conn).destroy) || _this$conn$destroy.call(_this$conn);
                                this.conn = null;
                                this.connected = false;
                                this.log("Destroyed.");
                            }
                            isConnected() {
                                return this.connected;
                            }
                        }
                        exports["default"] = InterconnectClient;
                    },
                    "./src/communication/mailbox.js" (__unused_rspack_module, exports, __webpack_require__) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        var _promiseFile = _interopRequireDefault(__webpack_require__("./src/helpers/promiseFile.js"));
                        var _mailboxStates = _interopRequireDefault(__webpack_require__("./src/constants/mailboxStates.js"));
                        function _interopRequireDefault(e) {
                            return e && e.__esModule ? e : {
                                default: e
                            };
                        }
                        function sleep(ms) {
                            return new Promise((resolve)=>setTimeout(resolve, ms));
                        }
                        class Mailbox {
                            constructor(path, pollInterval = 1000, debug = false){
                                this.path = path;
                                this.pollInterval = pollInterval;
                                this.retryPollInterval = 10;
                                this.debug = debug;
                                this.file = _promiseFile.default;
                                this.currentId = 0;
                                this.busy = false;
                                this.retryAtt = 0;
                                this.retryAttMax = 5;
                            }
                            log(...args) {
                                if (this.debug) console.log("[Mailbox]", ...args);
                            }
                            async read() {
                                const mailboxExists = await this.file.exists(this.path);
                                if (!mailboxExists) return {};
                                const text = await this.file.readText(this.path);
                                if (!text || "" == text) {
                                    if (this.retryAtt > this.retryAttMax - 1) throw new Error("Mailbox empty");
                                    this.retryAtt++;
                                    await sleep(this.retryPollInterval);
                                    const retryRead = await this.read();
                                    return retryRead;
                                }
                                const result = JSON.parse(text);
                                this.retryAtt = 0;
                                return result;
                            }
                            async write(data) {
                                await this.file.writeText(this.path, JSON.stringify(data));
                            }
                            async init() {
                                try {
                                    const mailbox = await this.read();
                                    this.currentId = mailbox.id || 0;
                                    if (mailbox.state === _mailboxStates.default.RUNNING) {
                                        mailbox.state = _mailboxStates.default.ERROR;
                                        mailbox.error = "reset_after_restart";
                                        await this.write(mailbox);
                                    }
                                } catch (_unused) {
                                    await this.write({
                                        version: 1,
                                        id: 0,
                                        state: _mailboxStates.default.IDLE
                                    });
                                    this.currentId = 0;
                                }
                            }
                            async request(type, args = {}, timeout = 30000) {
                                if (this.busy) throw new Error("Mailbox busy");
                                this.busy = true;
                                try {
                                    const mailbox = await this.read();
                                    if (mailbox.state === _mailboxStates.default.RUNNING || mailbox.state === _mailboxStates.default.PENDING) throw new Error("Lua is busy");
                                    const id = ++this.currentId;
                                    await this.write({
                                        version: 1,
                                        id,
                                        state: _mailboxStates.default.PENDING,
                                        type,
                                        args,
                                        timestamp: Date.now()
                                    });
                                    this.log("Request submitted:", id);
                                    return await this.wait(id, timeout);
                                } finally{
                                    this.busy = false;
                                }
                            }
                            async wait(id, timeout) {
                                const start = Date.now();
                                while(true){
                                    const mailbox = await this.read();
                                    if (mailbox.id !== id) {
                                        await sleep(this.pollInterval);
                                        continue;
                                    }
                                    switch(mailbox.state){
                                        case _mailboxStates.default.PENDING:
                                        case _mailboxStates.default.RUNNING:
                                            break;
                                        case _mailboxStates.default.DONE:
                                            this.log("Completed.");
                                            return mailbox;
                                        case _mailboxStates.default.ERROR:
                                            throw new Error(mailbox.error || "Mailbox error");
                                    }
                                    if (Date.now() - start > timeout) throw new Error("Mailbox timeout");
                                    await sleep(this.pollInterval);
                                }
                            }
                        }
                        exports["default"] = Mailbox;
                    },
                    "./src/constants/activities.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        const Activities = Object.freeze({
                            terminal: "cmd",
                            io: "io",
                            sensors: "sensors",
                            lua: "lua",
                            qjs: "qjs"
                        });
                        var _default = exports["default"] = Activities;
                    },
                    "./src/constants/mailboxStates.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        const MailboxState = Object.freeze({
                            IDLE: "idle",
                            PENDING: "pending",
                            RUNNING: "running",
                            DONE: "done",
                            ERROR: "error"
                        });
                        var _default = exports["default"] = MailboxState;
                    },
                    "./src/constants/paths.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        const Paths = Object.freeze({
                            mailbox: "internal://files/mailbox.json",
                            default_cmdout: "internal://files/term/cmd_out"
                        });
                        var _default = exports["default"] = Paths;
                    },
                    "./src/helpers/promiseFile.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        var _system = _interopRequireDefault($app_require$1("@app-module/system.file"));
                        function _interopRequireDefault(e) {
                            return e && e.__esModule ? e : {
                                default: e
                            };
                        }
                        class PromiseFile {
                            listFiles(uri) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.list({
                                        uri: uri,
                                        success: ({ fileList })=>resolve(fileList),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            writeText(uri, text, encoding = 'UTF-8') {
                                return new Promise((resolve, reject)=>{
                                    _system.default.writeText({
                                        uri: uri,
                                        text: text,
                                        encoding: encoding,
                                        success: ()=>resolve(),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            readText(uri, encoding = 'UTF-8') {
                                return new Promise((resolve, reject)=>{
                                    _system.default.readText({
                                        uri: uri,
                                        encoding: encoding,
                                        success: ({ text })=>resolve(text),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            writeBuffer(uri, buffer) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.writeBuffer({
                                        uri: uri,
                                        buffer: buffer,
                                        success: ()=>resolve(),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            readBuffer(uri) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.readBuffer({
                                        uri: uri,
                                        success: ({ buffer })=>resolve(buffer),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            copy(srcUri, dstUri) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.copy({
                                        srcUri: srcUri,
                                        dstUri: dstUri,
                                        success: (data)=>resolve(data.uri),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            move(srcUri, dstUri) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.move({
                                        srcUri: srcUri,
                                        dstUri: dstUri,
                                        success: (data)=>resolve(data.uri),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            delete(uri) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.delete({
                                        uri: uri,
                                        success: ()=>resolve(),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            exists(uri) {
                                return new Promise((resolve)=>{
                                    _system.default.access({
                                        uri: uri,
                                        success: ()=>resolve(true),
                                        fail: ()=>resolve(false)
                                    });
                                });
                            }
                            mkdir(uri, recursive = true) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.mkdir({
                                        uri: uri,
                                        recursive: recursive,
                                        success: ()=>resolve(),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            rmdir(uri, recursive = true) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.rmdir({
                                        uri: uri,
                                        recursive: recursive,
                                        success: ()=>resolve(),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                            getInfo(uri) {
                                return new Promise((resolve, reject)=>{
                                    _system.default.get({
                                        uri: uri,
                                        success: (meta)=>resolve(meta),
                                        fail: (data, code)=>reject(new Error(code))
                                    });
                                });
                            }
                        }
                        var _default = exports["default"] = new PromiseFile();
                    },
                    "./src/router/activities/quickjs.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        function _defineProperty(e, r, t) {
                            return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
                                value: t,
                                enumerable: !0,
                                configurable: !0,
                                writable: !0
                            }) : e[r] = t, e;
                        }
                        function _toPropertyKey(t) {
                            var i = _toPrimitive(t, "string");
                            return "symbol" == typeof i ? i : i + "";
                        }
                        function _toPrimitive(t, r) {
                            if ("object" != typeof t || !t) return t;
                            var e = t[Symbol.toPrimitive];
                            if (void 0 !== e) {
                                var i = e.call(t, r || "default");
                                if ("object" != typeof i) return i;
                                throw new TypeError("@@toPrimitive must return a primitive value.");
                            }
                            return ("string" === r ? String : Number)(t);
                        }
                        class QJSShell {
                            constructor(appCtx, global){
                                this.context = appCtx;
                                this.global = global;
                                this.maxString = 1024;
                            }
                            async handle(message) {
                                return await this.execute(message.args.code);
                            }
                            safeStringify(value) {
                                const seen = new Map();
                                const convert = (val, path = "root")=>{
                                    if ("function" == typeof val) return {
                                        $: "fn"
                                    };
                                    if (void 0 === val) return {
                                        $: "undef"
                                    };
                                    if ("number" == typeof val) {
                                        if (Number.isNaN(val)) return {
                                            $: "nan"
                                        };
                                        if (val === 1 / 0) return {
                                            $: "inf"
                                        };
                                        if (val === -1 / 0) return {
                                            $: "ninf"
                                        };
                                        return val;
                                    }
                                    if ("string" == typeof val) {
                                        if (val.length > this.maxString) return val.substring(0, this.maxString) + "...";
                                        return val;
                                    }
                                    if (null === val) return null;
                                    if ("object" == typeof val) {
                                        if (seen.has(val)) return {
                                            $: "ref",
                                            to: seen.get(val)
                                        };
                                        seen.set(val, path);
                                        const out = Array.isArray(val) ? [] : {};
                                        for (const key of Reflect.ownKeys(val)){
                                            try {
                                                out[String(key)] = convert(val[key], `${path}.${String(key)}`);
                                            } catch (e) {
                                                out[String(key)] = {
                                                    $: "err",
                                                    message: String(e)
                                                };
                                            }
                                        }
                                        return out;
                                    }
                                    return val;
                                };
                                return JSON.stringify(convert(value));
                            }
                            async execute(code) {
                                const result = await new Function(`
            return (async () => {
                ${code}
            })();
        `)();
                                const safeResult = this.safeStringify(result);
                                console.log(JSON.parse(safeResult));
                                return {
                                    type: QJSShell.type,
                                    res: safeResult,
                                    state: "done"
                                };
                            }
                        }
                        exports["default"] = QJSShell;
                        _defineProperty(QJSShell, "type", "qjs");
                    },
                    "./src/router/activities/terminal.js" (__unused_rspack_module, exports, __webpack_require__) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        var _promiseFile = _interopRequireDefault(__webpack_require__("./src/helpers/promiseFile.js"));
                        function _interopRequireDefault(e) {
                            return e && e.__esModule ? e : {
                                default: e
                            };
                        }
                        function _defineProperty(e, r, t) {
                            return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
                                value: t,
                                enumerable: !0,
                                configurable: !0,
                                writable: !0
                            }) : e[r] = t, e;
                        }
                        function _toPropertyKey(t) {
                            var i = _toPrimitive(t, "string");
                            return "symbol" == typeof i ? i : i + "";
                        }
                        function _toPrimitive(t, r) {
                            if ("object" != typeof t || !t) return t;
                            var e = t[Symbol.toPrimitive];
                            if (void 0 !== e) {
                                var i = e.call(t, r || "default");
                                if ("object" != typeof i) return i;
                                throw new TypeError("@@toPrimitive must return a primitive value.");
                            }
                            return ("string" === r ? String : Number)(t);
                        }
                        class Terminal {
                            constructor(mailbox){
                                this.mailbox = mailbox;
                            }
                            async handle(msgObj) {
                                return await this.run(msgObj.args);
                            }
                            handleCmdFail(err) {
                                let errMsg = err;
                                if ("object" == typeof err) errMsg = `${err.message}\n${err.stack}`;
                                return {
                                    type: Terminal.type,
                                    state: "error",
                                    error: errMsg
                                };
                            }
                            async run(args) {
                                const command = args.cmd;
                                try {
                                    const result = await this.mailbox.request(Terminal.type, {
                                        cmd: command
                                    });
                                    console.log(result);
                                    const exitCode = result.code;
                                    const outputFile = result.out;
                                    const checkCmdOut = await _promiseFile.default.exists(outputFile);
                                    if (!checkCmdOut) return this.handleCmdFail("Output file doesn't exist");
                                    const cmdOut = await _promiseFile.default.readText(outputFile);
                                    console.log(cmdOut);
                                    return {
                                        type: Terminal.type,
                                        state: "done",
                                        out: cmdOut,
                                        code: exitCode
                                    };
                                } catch (e) {
                                    return this.handleCmdFail(e);
                                }
                            }
                        }
                        exports["default"] = Terminal;
                        _defineProperty(Terminal, "type", "cmd");
                    },
                    "./src/router/router.js" (__unused_rspack_module, exports) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports["default"] = void 0;
                        class Router {
                            constructor(){
                                this.routes = {};
                            }
                            register(type, handler) {
                                this.routes[type] = handler;
                            }
                            async handle(message) {
                                const handler = this.routes[message.type];
                                if (!handler) throw new Error(`Unknown message type: ${message.type}`);
                                return handler(message);
                            }
                        }
                        exports["default"] = Router;
                    }
                };
                var __webpack_module_cache__ = {};
                function __webpack_require__(moduleId) {
                    var cachedModule = __webpack_module_cache__[moduleId];
                    if (void 0 !== cachedModule) return cachedModule.exports;
                    var module = __webpack_module_cache__[moduleId] = {
                        exports: {}
                    };
                    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
                    return module.exports;
                }
                $app_require$1.e = __webpack_require__;
                (()=>{
                    __webpack_require__.g = (()=>{
                        if ('object' == typeof globalThis) return globalThis;
                        try {
                            return this || new Function('return this')();
                        } catch (e) {
                            if ('object' == typeof window) return window;
                        }
                    })();
                })();
                (()=>{
                    __webpack_require__.rv = ()=>"1.7.11";
                })();
                (()=>{
                    __webpack_require__.ruid = "bundler=rspack@1.7.11";
                })();
                var __webpack_exports__ = {};
                (()=>{
                    var $app_style$ = [
                        [
                            [
                                [
                                    0,
                                    "page"
                                ]
                            ],
                            {
                                display: "flex",
                                flexDirection: "column",
                                width: "100%",
                                height: "100%",
                                backgroundColor: "#000000",
                                paddingLeft: "25px",
                                paddingRight: "25px",
                                paddingTop: "50px",
                                paddingBottom: "100px"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "header"
                                ]
                            ],
                            {
                                fontWeight: "bold",
                                fontSize: "38px",
                                color: "#ffffff",
                                textAlign: "center",
                                marginBottom: "8%"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "group"
                                ]
                            ],
                            {
                                display: "flex",
                                flexDirection: "column",
                                width: "100%"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "btn"
                                ]
                            ],
                            {
                                width: "80%",
                                height: "75px",
                                textAlign: "center",
                                borderRadius: "35px",
                                marginBottom: "6%",
                                fontSize: "24px",
                                fontWeight: "bold"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "btnGroup"
                                ]
                            ],
                            {
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "btn-primary"
                                ]
                            ],
                            {
                                backgroundColor: "#0faeff",
                                color: "#ffffff"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "btn-secondary"
                                ]
                            ],
                            {
                                backgroundColor: "#222222",
                                color: "#0faeff",
                                borderTopColor: "#0faeff",
                                borderRightColor: "#0faeff",
                                borderBottomColor: "#0faeff",
                                borderLeftColor: "#0faeff",
                                borderStyle: "solid",
                                borderTopWidth: "1.5px",
                                borderRightWidth: "1.5px",
                                borderBottomWidth: "1.5px",
                                borderLeftWidth: "1.5px"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "log-container"
                                ]
                            ],
                            {
                                flex: 1,
                                width: "100%",
                                backgroundColor: "#111111",
                                borderRadius: "16px",
                                paddingLeft: "6%",
                                paddingRight: "6%",
                                paddingTop: "4%",
                                paddingBottom: "4%",
                                marginTop: "4%"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "log-item"
                                ]
                            ],
                            {
                                width: "100%",
                                marginBottom: "4px",
                                height: "40px"
                            }
                        ],
                        [
                            [
                                [
                                    0,
                                    "log-text"
                                ]
                            ],
                            {
                                fontSize: "28px",
                                color: "#e0e0e0"
                            }
                        ]
                    ];
                    var $app_script$ = function __scriptModule__(module, exports, $app_require$1) {
                        "use strict";
                        Object.defineProperty(exports, "__esModule", {
                            value: true
                        });
                        exports.default = void 0;
                        var _interconnect = _interopRequireDefault(__webpack_require__("./src/communication/interconnect.js"));
                        var _promiseFile = _interopRequireDefault(__webpack_require__("./src/helpers/promiseFile.js"));
                        var _system = _interopRequireDefault($app_require$1("@app-module/system.file"));
                        var _system2 = _interopRequireDefault($app_require$1("@app-module/system.app"));
                        var _mailbox = _interopRequireDefault(__webpack_require__("./src/communication/mailbox.js"));
                        var _paths = _interopRequireDefault(__webpack_require__("./src/constants/paths.js"));
                        var _activities = _interopRequireDefault(__webpack_require__("./src/constants/activities.js"));
                        var _router = _interopRequireDefault(__webpack_require__("./src/router/router.js"));
                        var _terminal = _interopRequireDefault(__webpack_require__("./src/router/activities/terminal.js"));
                        var _quickjs = _interopRequireDefault(__webpack_require__("./src/router/activities/quickjs.js"));
                        function _interopRequireDefault(e) {
                            return e && e.__esModule ? e : {
                                default: e
                            };
                        }
                        var _default = exports.default = {
                            private: {
                                logStream: [
                                    "log"
                                ],
                                maxLogLines: 20,
                                client: null,
                                app: _system2.default,
                                file: _system.default,
                                hFile: _promiseFile.default,
                                activities: _activities.default,
                                router: new _router.default(),
                                mailbox: new _mailbox.default(_paths.default.mailbox, 1000, true)
                            },
                            async onInit () {
                                aiot.appCtx = this;
                                this.client = new _interconnect.default({
                                    debug: true
                                });
                                this.client.onOpen(()=>{
                                    console.log("Connected!");
                                    this.appendLog("Connected");
                                });
                                this.client.onClose(()=>{
                                    console.log("Disconnected");
                                    this.appendLog("Disconnected");
                                });
                                this.client.onError(console.error);
                                this.client.onMessage((msg)=>{
                                    this.messageReceived(msg);
                                    this.appendLog(msg);
                                });
                                await this.mailbox.init();
                                this.setupRouter();
                            },
                            setupRouter () {
                                const terminal = new _terminal.default(this.mailbox);
                                this.router.register(_terminal.default.type, terminal.handle.bind(terminal));
                                const qjs = new _quickjs.default(this, __webpack_require__.g);
                                this.router.register(_quickjs.default.type, qjs.handle.bind(qjs));
                            },
                            async connect () {
                                try {
                                    await this.client.connect();
                                } catch (e) {
                                    console.log(e);
                                    this.appendLog(`${e.message}\n${e.stack}`);
                                }
                            },
                            async checkLuaService () {},
                            async messageReceived (msg) {
                                const msgObj = JSON.parse(msg);
                                const type = null == msgObj ? void 0 : msgObj.type;
                                console.log(msgObj);
                                if (!type) return void console.log("No type specified!");
                                if (!Object.values(_activities.default).includes(type)) return void console.log(`Unknown type: ${type}`);
                                try {
                                    const result = await this.router.routes[type](msgObj);
                                    console.log("Res", JSON.parse(JSON.stringify(result)));
                                    await this.client.send(result);
                                } catch (e) {
                                    console.log(e.message, e.stack);
                                    await this.client.send({
                                        type: "interconnect",
                                        state: "error",
                                        error: `${e.message}\n${e.stack}`
                                    });
                                }
                            },
                            appendLog (message) {
                                this.logStream.push(message);
                                while(this.logStream.length > this.maxLogLines)this.logStream.shift();
                                setTimeout(()=>{
                                    const listElement = this.$element('logList');
                                    if (listElement && 'function' == typeof listElement.scrollTo) listElement.scrollTo({
                                        index: this.logStream.length - 1
                                    });
                                }, 50);
                            }
                        };
                        const moduleOwn = exports.default || module.exports;
                        const accessors = [
                            'public',
                            'protected',
                            'private'
                        ];
                        if (moduleOwn.data && accessors.some(function(acc) {
                            return moduleOwn[acc];
                        })) throw new Error('页面VM对象中的属性data不可与"' + accessors.join(',') + '"同时存在，请使用private替换data名称');
                        if (!moduleOwn.data) {
                            moduleOwn.data = {};
                            moduleOwn._descriptor = {};
                            accessors.forEach(function(acc) {
                                const accType = typeof moduleOwn[acc];
                                if ('object' === accType) {
                                    moduleOwn.data = Object.assign(moduleOwn.data, moduleOwn[acc]);
                                    for(const name in moduleOwn[acc])moduleOwn._descriptor[name] = {
                                        access: acc
                                    };
                                } else if ('function' === accType) console.warn('页面VM对象中的属性' + acc + '的值不能是函数，请使用对象');
                            });
                        }
                    };
                    var $app_template$ = function(vm) {
                        const _vm_ = vm || this;
                        return aiot.__ce__("div", {
                            __vm__: _vm_,
                            __opts__: {
                                classList: [
                                    "page"
                                ]
                            }
                        }, [
                            aiot.__ce__("text", {
                                __vm__: _vm_,
                                __opts__: {
                                    classList: [
                                        "header"
                                    ],
                                    value: "inter"
                                }
                            }, []),
                            aiot.__ce__("div", {
                                __vm__: _vm_,
                                __opts__: {
                                    id: "btns",
                                    classList: [
                                        "group",
                                        "btnGroup"
                                    ]
                                }
                            }, [
                                aiot.__ce__("input", {
                                    __vm__: _vm_,
                                    __opts__: {
                                        type: "button",
                                        classList: [
                                            "btn",
                                            "btn-primary"
                                        ],
                                        events: {
                                            click: function(evt) {
                                                return _vm_.connect(evt);
                                            }
                                        },
                                        value: "Connect"
                                    }
                                }, []),
                                aiot.__ce__("input", {
                                    __vm__: _vm_,
                                    __opts__: {
                                        type: "button",
                                        classList: [
                                            "btn",
                                            "btn-secondary"
                                        ],
                                        events: {
                                            click: function(evt) {
                                                return _vm_.checkLuaService(evt);
                                            }
                                        },
                                        value: "Check Lua"
                                    }
                                }, [])
                            ]),
                            aiot.__ce__("list", {
                                __vm__: _vm_,
                                __opts__: {
                                    classList: [
                                        "log-container"
                                    ],
                                    id: "logList"
                                }
                            }, [
                                aiot.__cf__({
                                    __vm__: _vm_,
                                    __opts__: {
                                        exp: function() {
                                            return _vm_.logStream;
                                        },
                                        key: "$idx",
                                        value: "$item"
                                    }
                                }, function($idx, $item) {
                                    return [
                                        aiot.__ce__("list-item", {
                                            __vm__: _vm_,
                                            __opts__: {
                                                type: "log",
                                                classList: [
                                                    "log-item"
                                                ]
                                            }
                                        }, [
                                            aiot.__ce__("text", {
                                                __vm__: _vm_,
                                                __opts__: {
                                                    classList: [
                                                        "log-text"
                                                    ],
                                                    value: function() {
                                                        return $item;
                                                    }
                                                }
                                            }, [])
                                        ])
                                    ];
                                })
                            ])
                        ]);
                    };
                    $app_exports$['entry'] = function($app_exports$) {
                        $app_script$({}, $app_exports$, $app_require$1);
                        $app_exports$.default.template = $app_template$;
                        $app_exports$.default.style = $app_style$;
                    };
                })();
            })();
        };
        return createPageHandler();
    })(global, globalThis, window, $app_exports$, $app_evaluate$);
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZXNcXGluZGV4XFxpbmRleC5qcyIsInNvdXJjZXMiOlsid2VicGFjazovL2ludGVyY29ubmVjdC1kZW1vL3NyYy9jb21tdW5pY2F0aW9uL2ludGVyY29ubmVjdC5qcyIsIndlYnBhY2s6Ly9pbnRlcmNvbm5lY3QtZGVtby9zcmMvY29tbXVuaWNhdGlvbi9tYWlsYm94LmpzIiwid2VicGFjazovL2ludGVyY29ubmVjdC1kZW1vL3NyYy9jb25zdGFudHMvYWN0aXZpdGllcy5qcyIsIndlYnBhY2s6Ly9pbnRlcmNvbm5lY3QtZGVtby9zcmMvY29uc3RhbnRzL21haWxib3hTdGF0ZXMuanMiLCJ3ZWJwYWNrOi8vaW50ZXJjb25uZWN0LWRlbW8vc3JjL2NvbnN0YW50cy9wYXRocy5qcyIsIndlYnBhY2s6Ly9pbnRlcmNvbm5lY3QtZGVtby9zcmMvaGVscGVycy9wcm9taXNlRmlsZS5qcyIsIndlYnBhY2s6Ly9pbnRlcmNvbm5lY3QtZGVtby9zcmMvcm91dGVyL2FjdGl2aXRpZXMvcXVpY2tqcy5qcyIsIndlYnBhY2s6Ly9pbnRlcmNvbm5lY3QtZGVtby9zcmMvcm91dGVyL2FjdGl2aXRpZXMvdGVybWluYWwuanMiLCJ3ZWJwYWNrOi8vaW50ZXJjb25uZWN0LWRlbW8vc3JjL3JvdXRlci9yb3V0ZXIuanMiLCJ3ZWJwYWNrOi8vaW50ZXJjb25uZWN0LWRlbW8vd2VicGFjay9ydW50aW1lL2dsb2JhbCIsIndlYnBhY2s6Ly9pbnRlcmNvbm5lY3QtZGVtby93ZWJwYWNrL3J1bnRpbWUvcnNwYWNrX3ZlcnNpb24iLCJ3ZWJwYWNrOi8vaW50ZXJjb25uZWN0LWRlbW8vd2VicGFjay9ydW50aW1lL3JzcGFja191bmlxdWVfaWQiLCJ3ZWJwYWNrOi8vaW50ZXJjb25uZWN0LWRlbW8vc3JjL3BhZ2VzL2luZGV4L2luZGV4LnV4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBpbnRlcmNvbm5lY3QgZnJvbSBcIkBzeXN0ZW0uaW50ZXJjb25uZWN0XCI7XHJcbmltcG9ydCBhcHAgZnJvbSBcIkBzeXN0ZW0uYXBwXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnRlcmNvbm5lY3RDbGllbnQge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHsgZGVidWcgPSBmYWxzZSB9ID0ge30pIHtcclxuICAgICAgICB0aGlzLmRlYnVnID0gZGVidWc7XHJcblxyXG4gICAgICAgIHRoaXMuY29ubiA9IG51bGw7XHJcblxyXG4gICAgICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5jb25uZWN0aW5nID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHRoaXMubWVzc2FnZUhhbmRsZXIgPSAoKSA9PiB7fTtcclxuICAgICAgICB0aGlzLm9wZW5IYW5kbGVyID0gKCkgPT4ge307XHJcbiAgICAgICAgdGhpcy5jbG9zZUhhbmRsZXIgPSAoKSA9PiB7fTtcclxuICAgICAgICB0aGlzLmVycm9ySGFuZGxlciA9ICgpID0+IHt9O1xyXG4gICAgfVxyXG5cclxuICAgIGxvZyguLi5hcmdzKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZGVidWcpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbSW50ZXJjb25uZWN0XVwiLCAuLi5hcmdzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgb25NZXNzYWdlKGhhbmRsZXIpIHtcclxuICAgICAgICB0aGlzLm1lc3NhZ2VIYW5kbGVyID0gaGFuZGxlcjtcclxuICAgIH1cclxuXHJcbiAgICBvbk9wZW4oaGFuZGxlcikge1xyXG4gICAgICAgIHRoaXMub3BlbkhhbmRsZXIgPSBoYW5kbGVyO1xyXG4gICAgfVxyXG5cclxuICAgIG9uQ2xvc2UoaGFuZGxlcikge1xyXG4gICAgICAgIHRoaXMuY2xvc2VIYW5kbGVyID0gaGFuZGxlcjtcclxuICAgIH1cclxuXHJcbiAgICBvbkVycm9yKGhhbmRsZXIpIHtcclxuICAgICAgICB0aGlzLmVycm9ySGFuZGxlciA9IGhhbmRsZXI7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgY29ubmVjdCgpIHtcclxuICAgICAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5sb2coXCJBbHJlYWR5IGNvbm5lY3RlZC5cIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3RpbmcpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ29ubmVjdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzLlwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghYXBwLmNhbklVc2UoXCJAc3lzdGVtLmludGVyY29ubmVjdFwiKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnRlcmNvbm5lY3QgQVBJIHVuYXZhaWxhYmxlLlwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY29ubmVjdGluZyA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5jb25uID0gaW50ZXJjb25uZWN0Lmluc3RhbmNlKCk7XHJcblxyXG4gICAgICAgIHRoaXMuaW5zdGFsbEhhbmRsZXJzKCk7XHJcblxyXG4gICAgICAgIGF3YWl0IHRoaXMud2FpdEZvckNvbm5lY3Rpb24oKTtcclxuXHJcbiAgICAgICAgdGhpcy5jb25uZWN0aW5nID0gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgaW5zdGFsbEhhbmRsZXJzKCkge1xyXG4gICAgICAgIHRoaXMuY29ubi5vbm9wZW4gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgdGhpcy5sb2coXCJDb25uZWN0ZWQuXCIpO1xyXG4gICAgICAgICAgICB0aGlzLm9wZW5IYW5kbGVyKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jb25uLm9uY2xvc2UgPSAoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB0aGlzLmxvZyhcIkRpc2Nvbm5lY3RlZC5cIik7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2VIYW5kbGVyKGRhdGEpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY29ubi5vbmVycm9yID0gKGVycikgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmxvZyhcIkVycm9yOlwiLCBlcnIpO1xyXG4gICAgICAgICAgICB0aGlzLmVycm9ySGFuZGxlcihlcnIpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuY29ubi5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5sb2coXCJSZWNlaXZlZDpcIiwgZXZlbnQuZGF0YSk7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdlSGFuZGxlcihldmVudC5kYXRhKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgd2FpdEZvckNvbm5lY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5jb25uLmdldFJlYWR5U3RhdGUoe1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKHsgc3RhdHVzIH0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHN0YXR1cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxvZyhcIkNvbm5lY3RpbmcuLi5cIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9nKFwiUmVhZHkuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKFwiQ29ubmVjdGlvbiBmYWlsZWQuXCIpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29ubmVjdGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25uZWN0aW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgVW5rbm93biBzdGF0ZSAke3N0YXR1c31gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZmFpbDogKF8sIGNvZGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3RpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBFcnJvcihcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBnZXRSZWFkeVN0YXRlIGZhaWxlZCAoJHtjb2RlfSlgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBzZW5kKGRhdGEpIHtcclxuICAgICAgICBpZiAoIXRoaXMuY29ubmVjdGVkKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBjb25uZWN0ZWQuXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5jb25uLnNlbmQoe1xyXG4gICAgICAgICAgICAgICAgZGF0YSxcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHJlc29sdmUsXHJcbiAgICAgICAgICAgICAgICBmYWlsOiByZWplY3RcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZGlzY29ubmVjdCgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuY29ubikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmNvbm4uZGVzdHJveT8uKCk7XHJcbiAgICAgICAgdGhpcy5jb25uID0gbnVsbDtcclxuICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMubG9nKFwiRGVzdHJveWVkLlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBpc0Nvbm5lY3RlZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb25uZWN0ZWQ7XHJcbiAgICB9XHJcbn0iLCJpbXBvcnQgUHJvbWlzZUZpbGUgZnJvbSBcIi4uL2hlbHBlcnMvcHJvbWlzZUZpbGVcIjtcbmltcG9ydCBNYWlsYm94U3RhdGUgZnJvbSBcIi4uL2NvbnN0YW50cy9tYWlsYm94U3RhdGVzXCI7XG5cbmZ1bmN0aW9uIHNsZWVwKG1zKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYWlsYm94IHtcbiAgICBjb25zdHJ1Y3RvcihwYXRoLCBwb2xsSW50ZXJ2YWwgPSAxMDAwLCBkZWJ1ZyA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucGF0aCA9IHBhdGg7XG4gICAgICAgIHRoaXMucG9sbEludGVydmFsID0gcG9sbEludGVydmFsO1xuICAgICAgICB0aGlzLnJldHJ5UG9sbEludGVydmFsID0gMTA7XG4gICAgICAgIHRoaXMuZGVidWcgPSBkZWJ1ZztcbiAgICAgICAgXG4gICAgICAgIHRoaXMuZmlsZSA9IFByb21pc2VGaWxlO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5jdXJyZW50SWQgPSAwO1xuICAgICAgICB0aGlzLmJ1c3kgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLnJldHJ5QXR0ID0gMDtcbiAgICAgICAgdGhpcy5yZXRyeUF0dE1heCA9IDU7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVidWcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW01haWxib3hdXCIsIC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgcmVhZCgpIHtcbiAgICAgICAgY29uc3QgbWFpbGJveEV4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZS5leGlzdHModGhpcy5wYXRoKTtcbiAgICAgICAgaWYgKCFtYWlsYm94RXhpc3RzKSB7XG4gICAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgdGhpcy5maWxlLnJlYWRUZXh0KHRoaXMucGF0aCk7XG4gICAgICAgIGlmICghdGV4dCB8fCB0ZXh0ID09IFwiXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJldHJ5QXR0ID4gdGhpcy5yZXRyeUF0dE1heCAtIDEpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNYWlsYm94IGVtcHR5XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXRyeUF0dCsrO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBzbGVlcCh0aGlzLnJldHJ5UG9sbEludGVydmFsKTtcbiAgICAgICAgICAgIGNvbnN0IHJldHJ5UmVhZCA9IGF3YWl0IHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJldHJ5UmVhZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgIHRoaXMucmV0cnlBdHQgPSAwO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGFzeW5jIHdyaXRlKGRhdGEpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5maWxlLndyaXRlVGV4dChcbiAgICAgICAgICAgIHRoaXMucGF0aCxcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGRhdGEpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgYXN5bmMgaW5pdCgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG1haWxib3ggPSBhd2FpdCB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudElkID0gbWFpbGJveC5pZCB8fCAwO1xuXG4gICAgICAgICAgICBpZiAobWFpbGJveC5zdGF0ZSA9PT0gTWFpbGJveFN0YXRlLlJVTk5JTkcpIHtcbiAgICAgICAgICAgICAgICBtYWlsYm94LnN0YXRlID0gTWFpbGJveFN0YXRlLkVSUk9SO1xuICAgICAgICAgICAgICAgIG1haWxib3guZXJyb3IgPSBcInJlc2V0X2FmdGVyX3Jlc3RhcnRcIjtcblxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMud3JpdGUobWFpbGJveCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy53cml0ZSh7XG4gICAgICAgICAgICAgICAgdmVyc2lvbjogMSxcbiAgICAgICAgICAgICAgICBpZDogMCxcbiAgICAgICAgICAgICAgICBzdGF0ZTogTWFpbGJveFN0YXRlLklETEVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRJZCA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyByZXF1ZXN0KHR5cGUsIGFyZ3MgPSB7fSwgdGltZW91dCA9IDMwMDAwKSB7XG4gICAgICAgIGlmICh0aGlzLmJ1c3kpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1haWxib3ggYnVzeVwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYnVzeSA9IHRydWU7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG1haWxib3ggPSBhd2FpdCB0aGlzLnJlYWQoKTtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBtYWlsYm94LnN0YXRlID09PSBNYWlsYm94U3RhdGUuUlVOTklORyB8fFxuICAgICAgICAgICAgICAgIG1haWxib3guc3RhdGUgPT09IE1haWxib3hTdGF0ZS5QRU5ESU5HXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMdWEgaXMgYnVzeVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaWQgPSArK3RoaXMuY3VycmVudElkO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy53cml0ZSh7XG4gICAgICAgICAgICAgICAgdmVyc2lvbjogMSxcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBzdGF0ZTogTWFpbGJveFN0YXRlLlBFTkRJTkcsXG4gICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICBhcmdzLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMubG9nKFwiUmVxdWVzdCBzdWJtaXR0ZWQ6XCIsIGlkKTtcblxuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMud2FpdChpZCwgdGltZW91dCk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0aGlzLmJ1c3kgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHdhaXQoaWQsIHRpbWVvdXQpIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgY29uc3QgbWFpbGJveCA9IGF3YWl0IHRoaXMucmVhZCgpO1xuICAgICAgICAgICAgaWYgKG1haWxib3guaWQgIT09IGlkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2xlZXAodGhpcy5wb2xsSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzd2l0Y2ggKG1haWxib3guc3RhdGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIE1haWxib3hTdGF0ZS5QRU5ESU5HOlxuICAgICAgICAgICAgICAgIGNhc2UgTWFpbGJveFN0YXRlLlJVTk5JTkc6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBNYWlsYm94U3RhdGUuRE9ORTpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2coXCJDb21wbGV0ZWQuXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWFpbGJveDtcblxuICAgICAgICAgICAgICAgIGNhc2UgTWFpbGJveFN0YXRlLkVSUk9SOlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBtYWlsYm94LmVycm9yIHx8IFwiTWFpbGJveCBlcnJvclwiXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChEYXRlLm5vdygpIC0gc3RhcnQgPiB0aW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWFpbGJveCB0aW1lb3V0XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBzbGVlcCh0aGlzLnBvbGxJbnRlcnZhbCk7XG4gICAgICAgIH1cbiAgICB9XG59IiwiY29uc3QgQWN0aXZpdGllcyA9IE9iamVjdC5mcmVlemUoe1xuICAgIHRlcm1pbmFsOiBcImNtZFwiLFxuICAgIGlvOiBcImlvXCIsXG4gICAgc2Vuc29yczogXCJzZW5zb3JzXCIsXG4gICAgbHVhOiBcImx1YVwiLFxuICAgIHFqczogXCJxanNcIixcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBBY3Rpdml0aWVzOyIsImNvbnN0IE1haWxib3hTdGF0ZSA9IE9iamVjdC5mcmVlemUoe1xuICAgIElETEU6IFwiaWRsZVwiLFxuICAgIFBFTkRJTkc6IFwicGVuZGluZ1wiLFxuICAgIFJVTk5JTkc6IFwicnVubmluZ1wiLFxuICAgIERPTkU6IFwiZG9uZVwiLFxuICAgIEVSUk9SOiBcImVycm9yXCJcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBNYWlsYm94U3RhdGU7IiwiY29uc3QgUGF0aHMgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYWlsYm94OiBcImludGVybmFsOi8vZmlsZXMvbWFpbGJveC5qc29uXCIsXG5cbiAgICBkZWZhdWx0X2NtZG91dDogXCJpbnRlcm5hbDovL2ZpbGVzL3Rlcm0vY21kX291dFwiXG59KTtcblxuZXhwb3J0IGRlZmF1bHQgUGF0aHM7IiwiaW1wb3J0IGZpbGUgZnJvbSAnQHN5c3RlbS5maWxlJztcblxuLy8gT2ZmaWNpYWwgZG9jczpcbi8vIGh0dHBzOi8vaW90Lm1pLmNvbS92ZWxhL3F1aWNrYXBwL2VuL2ZlYXR1cmVzL2RhdGEvZmlsZS5odG1sXG5cbi8vIFZlcnkgdXNlZnVsIGJ0dzpcbi8vIGh0dHBzOi8vaW90Lm1pLmNvbS92ZWxhL3F1aWNrYXBwL2VuL2d1aWRlL2ZyYW1ld29yay9wcm9qZWN0LXN0cnVjdHVyZS5odG1sI3VyaVxuXG5jbGFzcyBQcm9taXNlRmlsZSB7XG4gICAgbGlzdEZpbGVzKHVyaSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS5saXN0KHtcbiAgICAgICAgICAgICAgICB1cmk6IHVyaSxcblxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6ICh7IGZpbGVMaXN0IH0pID0+IHJlc29sdmUoZmlsZUxpc3QpLFxuICAgICAgICAgICAgICAgIGZhaWw6IChkYXRhLCBjb2RlKSA9PiByZWplY3QobmV3IEVycm9yKGNvZGUpKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHdyaXRlVGV4dCh1cmksIHRleHQsIGVuY29kaW5nID0gJ1VURi04Jykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS53cml0ZVRleHQoe1xuICAgICAgICAgICAgICAgIHVyaTogdXJpLFxuICAgICAgICAgICAgICAgIHRleHQ6IHRleHQsXG4gICAgICAgICAgICAgICAgZW5jb2Rpbmc6IGVuY29kaW5nLFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6ICgpID0+IHJlc29sdmUoKSxcbiAgICAgICAgICAgICAgICBmYWlsOiAoZGF0YSwgY29kZSkgPT4gcmVqZWN0KG5ldyBFcnJvcihjb2RlKSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZWFkVGV4dCh1cmksIGVuY29kaW5nID0gJ1VURi04Jykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS5yZWFkVGV4dCh7XG4gICAgICAgICAgICAgICAgdXJpOiB1cmksXG4gICAgICAgICAgICAgICAgZW5jb2Rpbmc6IGVuY29kaW5nLFxuXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKHsgdGV4dCB9KSA9PiByZXNvbHZlKHRleHQpLFxuICAgICAgICAgICAgICAgIGZhaWw6IChkYXRhLCBjb2RlKSA9PiByZWplY3QobmV3IEVycm9yKGNvZGUpKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHdyaXRlQnVmZmVyKHVyaSwgYnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBmaWxlLndyaXRlQnVmZmVyKHtcbiAgICAgICAgICAgICAgICB1cmk6IHVyaSxcbiAgICAgICAgICAgICAgICBidWZmZXI6IGJ1ZmZlcixcblxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6ICgpID0+IHJlc29sdmUoKSxcbiAgICAgICAgICAgICAgICBmYWlsOiAoZGF0YSwgY29kZSkgPT4gcmVqZWN0KG5ldyBFcnJvcihjb2RlKSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZWFkQnVmZmVyKHVyaSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS5yZWFkQnVmZmVyKHtcbiAgICAgICAgICAgICAgICB1cmk6IHVyaSxcblxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6ICh7IGJ1ZmZlciB9KSA9PiByZXNvbHZlKGJ1ZmZlciksXG4gICAgICAgICAgICAgICAgZmFpbDogKGRhdGEsIGNvZGUpID0+IHJlamVjdChuZXcgRXJyb3IoY29kZSkpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29weShzcmNVcmksIGRzdFVyaSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS5jb3B5KHtcbiAgICAgICAgICAgICAgICBzcmNVcmk6IHNyY1VyaSxcbiAgICAgICAgICAgICAgICBkc3RVcmk6IGRzdFVyaSxcblxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhKSA9PiByZXNvbHZlKGRhdGEudXJpKSxcbiAgICAgICAgICAgICAgICBmYWlsOiAoZGF0YSwgY29kZSkgPT4gcmVqZWN0KG5ldyBFcnJvcihjb2RlKSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBtb3ZlKHNyY1VyaSwgZHN0VXJpKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBmaWxlLm1vdmUoe1xuICAgICAgICAgICAgICAgIHNyY1VyaTogc3JjVXJpLFxuICAgICAgICAgICAgICAgIGRzdFVyaTogZHN0VXJpLFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhKSA9PiByZXNvbHZlKGRhdGEudXJpKSxcbiAgICAgICAgICAgICAgICBmYWlsOiAoZGF0YSwgY29kZSkgPT4gcmVqZWN0KG5ldyBFcnJvcihjb2RlKSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBkZWxldGUodXJpKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBmaWxlLmRlbGV0ZSh7XG4gICAgICAgICAgICAgICAgdXJpOiB1cmksXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKCkgPT4gcmVzb2x2ZSgpLFxuICAgICAgICAgICAgICAgIGZhaWw6IChkYXRhLCBjb2RlKSA9PiByZWplY3QobmV3IEVycm9yKGNvZGUpKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENoZWNrcyBpZiBhIGZpbGUgb3IgZm9sZGVyIGV4aXN0c1xuICAgIGV4aXN0cyh1cmkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBmaWxlLmFjY2Vzcyh7XG4gICAgICAgICAgICAgICAgdXJpOiB1cmksXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKCkgPT4gcmVzb2x2ZSh0cnVlKSxcbiAgICAgICAgICAgICAgICBmYWlsOiAoKSA9PiByZXNvbHZlKGZhbHNlKSBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBta2Rpcih1cmksIHJlY3Vyc2l2ZSA9IHRydWUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGZpbGUubWtkaXIoe1xuICAgICAgICAgICAgICAgIHVyaTogdXJpLFxuICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZTogcmVjdXJzaXZlLFxuXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKCkgPT4gcmVzb2x2ZSgpLFxuICAgICAgICAgICAgICAgIGZhaWw6IChkYXRhLCBjb2RlKSA9PiByZWplY3QobmV3IEVycm9yKGNvZGUpKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJtZGlyKHVyaSwgcmVjdXJzaXZlID0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS5ybWRpcih7XG4gICAgICAgICAgICAgICAgdXJpOiB1cmksXG4gICAgICAgICAgICAgICAgcmVjdXJzaXZlOiByZWN1cnNpdmUsXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKCkgPT4gcmVzb2x2ZSgpLFxuICAgICAgICAgICAgICAgIGZhaWw6IChkYXRhLCBjb2RlKSA9PiByZWplY3QobmV3IEVycm9yKGNvZGUpKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgLy8gUmV0dXJucyBpbmZvIGFib3V0IGEgZmlsZSBvciBmb2xkZXJcbiAgICBnZXRJbmZvKHVyaSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgZmlsZS5nZXQoe1xuICAgICAgICAgICAgICAgIHVyaTogdXJpLFxuXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKG1ldGEpID0+IHJlc29sdmUobWV0YSksXG4gICAgICAgICAgICAgICAgZmFpbDogKGRhdGEsIGNvZGUpID0+IHJlamVjdChuZXcgRXJyb3IoY29kZSkpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgUHJvbWlzZUZpbGUoKTsiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBRSlNTaGVsbCB7XHJcbiAgICBzdGF0aWMgdHlwZSA9IFwicWpzXCI7XHJcblxyXG4gICAgY29uc3RydWN0b3IoYXBwQ3R4LCBnbG9iYWwpIHtcclxuICAgICAgICB0aGlzLmNvbnRleHQgPSBhcHBDdHg7XHJcbiAgICAgICAgdGhpcy5nbG9iYWwgPSBnbG9iYWw7XHJcblxyXG4gICAgICAgIHRoaXMubWF4U3RyaW5nID0gMTAyNFxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGhhbmRsZShtZXNzYWdlKSB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZXhlY3V0ZShtZXNzYWdlLmFyZ3MuY29kZSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2FmZVN0cmluZ2lmeSh2YWx1ZSkge1xyXG4gICAgICAgIGNvbnN0IHNlZW4gPSBuZXcgTWFwKCk7XHJcbiAgICBcclxuICAgICAgICBjb25zdCBjb252ZXJ0ID0gKHZhbCwgcGF0aCA9IFwicm9vdFwiKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIGZ1bmN0aW9uc1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgICQ6IFwiZm5cIlxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIC8vIHVuZGVmaW5lZFxyXG4gICAgICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgJDogXCJ1bmRlZlwiXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgLy8gbnVtYmVyc1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gXCJudW1iZXJcIikge1xyXG4gICAgICAgICAgICAgICAgaWYgKE51bWJlci5pc05hTih2YWwpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJDogXCJuYW5cIlxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGlmICh2YWwgPT09IEluZmluaXR5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJDogXCJpbmZcIlxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGlmICh2YWwgPT09IC1JbmZpbml0eSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICQ6IFwibmluZlwiXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIC8vIHN0cmluZ3NcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmICh2YWwubGVuZ3RoID4gdGhpcy5tYXhTdHJpbmcpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsLnN1YnN0cmluZygwLCB0aGlzLm1heFN0cmluZykgKyBcIi4uLlwiO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgLy8gbnVsbFxyXG4gICAgICAgICAgICBpZiAodmFsID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgIC8vIG9iamVjdHNcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09IFwib2JqZWN0XCIpIHtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHNlZW4uaGFzKHZhbCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkOiBcInJlZlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0bzogc2Vlbi5nZXQodmFsKVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIHNlZW4uc2V0KHZhbCwgcGF0aCk7XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IG91dCA9IEFycmF5LmlzQXJyYXkodmFsKVxyXG4gICAgICAgICAgICAgICAgICAgID8gW11cclxuICAgICAgICAgICAgICAgICAgICA6IHt9O1xyXG4gICAgXHJcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBSZWZsZWN0Lm93bktleXModmFsKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dFtTdHJpbmcoa2V5KV0gPVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udmVydChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxba2V5XSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHtwYXRofS4ke1N0cmluZyhrZXkpfWBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dFtTdHJpbmcoa2V5KV0gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkOiBcImVyclwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogU3RyaW5nKGUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gb3V0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHZhbDtcclxuICAgICAgICB9O1xyXG4gICAgXHJcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KFxyXG4gICAgICAgICAgICBjb252ZXJ0KHZhbHVlKVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZXhlY3V0ZShjb2RlKSB7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgKG5ldyBGdW5jdGlvbihgXHJcbiAgICAgICAgICAgIHJldHVybiAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgJHtjb2RlfVxyXG4gICAgICAgICAgICB9KSgpO1xyXG4gICAgICAgIGApKSgpO1xyXG4gICAgICAgIGNvbnN0IHNhZmVSZXN1bHQgPSB0aGlzLnNhZmVTdHJpbmdpZnkocmVzdWx0KTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coSlNPTi5wYXJzZShzYWZlUmVzdWx0KSk7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdHlwZTogUUpTU2hlbGwudHlwZSxcclxuICAgICAgICAgICAgcmVzOiBzYWZlUmVzdWx0LFxyXG4gICAgICAgICAgICBzdGF0ZTogXCJkb25lXCJcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iLCJpbXBvcnQgUHJvbWlzZUZpbGUgZnJvbSBcIi4uLy4uL2hlbHBlcnMvcHJvbWlzZUZpbGVcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUZXJtaW5hbCB7XG4gICAgc3RhdGljIHR5cGUgPSBcImNtZFwiO1xuXG4gICAgY29uc3RydWN0b3IobWFpbGJveCkge1xuICAgICAgICB0aGlzLm1haWxib3ggPSBtYWlsYm94O1xuICAgIH1cbiAgICBcbiAgICBhc3luYyBoYW5kbGUobXNnT2JqKSB7XG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJ1bihtc2dPYmouYXJncyk7XG4gICAgfVxuXG4gICAgaGFuZGxlQ21kRmFpbChlcnIpIHtcbiAgICAgICAgbGV0IGVyck1zZyA9IGVycjtcbiAgICAgICAgaWYgKHR5cGVvZihlcnIpID09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgIGVyck1zZyA9IGAke2Vyci5tZXNzYWdlfVxcbiR7ZXJyLnN0YWNrfWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogVGVybWluYWwudHlwZSxcbiAgICAgICAgICAgIHN0YXRlOiBcImVycm9yXCIsXG4gICAgICAgICAgICBlcnJvcjogZXJyTXNnXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBydW4oYXJncykge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYXJncy5jbWQ7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubWFpbGJveC5yZXF1ZXN0KFxuICAgICAgICAgICAgICAgIFRlcm1pbmFsLnR5cGUsXG4gICAgICAgICAgICAgICAge2NtZDogY29tbWFuZH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXN1bHQpO1xuXG4gICAgICAgICAgICBjb25zdCBleGl0Q29kZSA9IHJlc3VsdC5jb2RlO1xuICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZSA9IHJlc3VsdC5vdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNoZWNrQ21kT3V0ID0gYXdhaXQgUHJvbWlzZUZpbGUuZXhpc3RzKG91dHB1dEZpbGUpO1xuICAgICAgICAgICAgaWYgKCFjaGVja0NtZE91dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZUNtZEZhaWwoXCJPdXRwdXQgZmlsZSBkb2Vzbid0IGV4aXN0XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsYXRlciByZWFkIGJ1ZmZlciBhbmQgc2VuZCB0aGF0IHRvIHRoZSBwaG9uZVxuICAgICAgICAgICAgLy8gc3BsaXR0aW5nIGFuZCBjaGVja3N1bXMgd2lsbCBtb3N0IGxpa2VseSBiZSBuZWVkZWRcbiAgICAgICAgICAgIGNvbnN0IGNtZE91dCA9IGF3YWl0IFByb21pc2VGaWxlLnJlYWRUZXh0KG91dHB1dEZpbGUpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coY21kT3V0KTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBUZXJtaW5hbC50eXBlLFxuICAgICAgICAgICAgICAgIHN0YXRlOiBcImRvbmVcIixcbiAgICAgICAgICAgICAgICBvdXQ6IGNtZE91dCxcbiAgICAgICAgICAgICAgICBjb2RlOiBleGl0Q29kZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVDbWRGYWlsKGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgIH1cbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvdXRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMucm91dGVzID0ge307XG4gICAgfVxuXG4gICAgcmVnaXN0ZXIodHlwZSwgaGFuZGxlcikge1xuICAgICAgICB0aGlzLnJvdXRlc1t0eXBlXSA9IGhhbmRsZXI7XG4gICAgfVxuXG4gICAgYXN5bmMgaGFuZGxlKG1lc3NhZ2UpIHtcbiAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXMucm91dGVzW21lc3NhZ2UudHlwZV07XG4gICAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGBVbmtub3duIG1lc3NhZ2UgdHlwZTogJHttZXNzYWdlLnR5cGV9YFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFuZGxlcihtZXNzYWdlKTtcbiAgICB9XG59IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5nID0gKCgpID0+IHtcblx0aWYgKHR5cGVvZiBnbG9iYWxUaGlzID09PSAnb2JqZWN0JykgcmV0dXJuIGdsb2JhbFRoaXM7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIHRoaXMgfHwgbmV3IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcpIHJldHVybiB3aW5kb3c7XG5cdH1cbn0pKCk7IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5ydiA9ICgpID0+IChcIjEuNy4xMVwiKSIsIl9fd2VicGFja19yZXF1aXJlX18ucnVpZCA9IFwiYnVuZGxlcj1yc3BhY2tAMS43LjExXCI7IiwiPHRlbXBsYXRlPlxuICAgIDxkaXYgY2xhc3M9XCJwYWdlXCI+XG4gICAgICAgIDx0ZXh0IGNsYXNzPVwiaGVhZGVyXCI+aW50ZXI8L3RleHQ+XG4gICAgICAgIFxuICAgICAgICA8ZGl2IGlkPVwiYnRuc1wiIGNsYXNzPVwiZ3JvdXAgYnRuR3JvdXBcIj5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4gYnRuLXByaW1hcnlcIiBAY2xpY2s9XCJjb25uZWN0XCIgdmFsdWU9XCJDb25uZWN0XCIgLz5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4gYnRuLXNlY29uZGFyeVwiIEBjbGljaz1cImNoZWNrTHVhU2VydmljZVwiIHZhbHVlPVwiQ2hlY2sgTHVhXCIgLz5cbiAgICAgICAgICAgIDwhLS0gPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ0biBidG4tc2Vjb25kYXJ5XCIgQGNsaWNrPVwiY2hlY2tTZW5kTXNnXCIgdmFsdWU9XCJTZW5kIG1zZ1wiIC8+IC0tPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgXG4gICAgICAgIDxsaXN0IGNsYXNzPVwibG9nLWNvbnRhaW5lclwiIGlkPVwibG9nTGlzdFwiPlxuICAgICAgICAgICAgPGxpc3QtaXRlbSB0eXBlPVwibG9nXCIgY2xhc3M9XCJsb2ctaXRlbVwiIGZvcj1cInt7bG9nU3RyZWFtfX1cIj5cbiAgICAgICAgICAgICAgICA8dGV4dCBjbGFzcz1cImxvZy10ZXh0XCI+e3skaXRlbX19PC90ZXh0PlxuICAgICAgICAgICAgPC9saXN0LWl0ZW0+XG4gICAgICAgIDwvbGlzdD5cbiAgICA8L2Rpdj5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQ+XG4gICAgaW1wb3J0IEludGVyY29ubmVjdENsaWVudCBmcm9tIFwiLi4vLi4vY29tbXVuaWNhdGlvbi9pbnRlcmNvbm5lY3RcIjtcbiAgICBpbXBvcnQgUHJvbWlzZUZpbGUgZnJvbSBcIi4uLy4uL2hlbHBlcnMvcHJvbWlzZUZpbGVcIjtcbiAgICBpbXBvcnQgZmlsZSBmcm9tIFwiQHN5c3RlbS5maWxlXCI7XG4gICAgaW1wb3J0IGFwcCBmcm9tIFwiQHN5c3RlbS5hcHBcIjtcblxuICAgIGltcG9ydCBNYWlsYm94IGZyb20gXCIuLi8uLi9jb21tdW5pY2F0aW9uL21haWxib3hcIlxuICAgIGltcG9ydCBQYXRocyBmcm9tIFwiLi4vLi4vY29uc3RhbnRzL3BhdGhzXCJcblxuICAgIGltcG9ydCBBY3Rpdml0aWVzIGZyb20gXCIuLi8uLi9jb25zdGFudHMvYWN0aXZpdGllc1wiO1xuICAgIGltcG9ydCBSb3V0ZXIgZnJvbSBcIi4uLy4uL3JvdXRlci9yb3V0ZXJcIjtcbiAgICAvLyBBY3Rpdml0aWVzXG4gICAgaW1wb3J0IFRlcm1pbmFsIGZyb20gXCIuLi8uLi9yb3V0ZXIvYWN0aXZpdGllcy90ZXJtaW5hbFwiXG4gICAgaW1wb3J0IFFKU1NoZWxsIGZyb20gXCIuLi8uLi9yb3V0ZXIvYWN0aXZpdGllcy9xdWlja2pzXCJcblxuICAgIGV4cG9ydCBkZWZhdWx0IHtcbiAgICAgICAgcHJpdmF0ZToge1xuICAgICAgICAgICAgbG9nU3RyZWFtOiBbXG4gICAgICAgICAgICAgICAgXCJsb2dcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIG1heExvZ0xpbmVzOiAyMCxcblxuICAgICAgICAgICAgY2xpZW50OiBudWxsLFxuICAgICAgICAgICAgYXBwOiBhcHAsXG4gICAgICAgICAgICBmaWxlOiBmaWxlLFxuICAgICAgICAgICAgaEZpbGU6IFByb21pc2VGaWxlLFxuICAgICAgICAgICAgYWN0aXZpdGllczogQWN0aXZpdGllcyxcblxuICAgICAgICAgICAgcm91dGVyOiBuZXcgUm91dGVyKCksXG4gICAgICAgICAgICBtYWlsYm94OiBuZXcgTWFpbGJveChQYXRocy5tYWlsYm94LCAxMDAwLCB0cnVlKSxcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBvbkluaXQoKSB7XG4gICAgICAgICAgICBhaW90LmFwcEN0eCA9IHRoaXM7XG5cbiAgICAgICAgICAgIHRoaXMuY2xpZW50ID0gbmV3IEludGVyY29ubmVjdENsaWVudCh7XG4gICAgICAgICAgICAgICAgZGVidWc6IHRydWVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmNsaWVudC5vbk9wZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiQ29ubmVjdGVkIVwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhcIkNvbm5lY3RlZFwiKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmNsaWVudC5vbkNsb3NlKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkRpc2Nvbm5lY3RlZFwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhcIkRpc2Nvbm5lY3RlZFwiKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmNsaWVudC5vbkVycm9yKGNvbnNvbGUuZXJyb3IpO1xuXG4gICAgICAgICAgICB0aGlzLmNsaWVudC5vbk1lc3NhZ2UoKG1zZykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnZVJlY2VpdmVkKG1zZyk7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2cobXNnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLm1haWxib3guaW5pdCgpO1xuICAgICAgICAgICAgdGhpcy5zZXR1cFJvdXRlcigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldHVwUm91dGVyKCkge1xuICAgICAgICAgICAgY29uc3QgdGVybWluYWwgPSBuZXcgVGVybWluYWwodGhpcy5tYWlsYm94KTtcbiAgICAgICAgICAgIHRoaXMucm91dGVyLnJlZ2lzdGVyKFxuICAgICAgICAgICAgICAgIFRlcm1pbmFsLnR5cGUsXG4gICAgICAgICAgICAgICAgdGVybWluYWwuaGFuZGxlLmJpbmQodGVybWluYWwpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCBxanMgPSBuZXcgUUpTU2hlbGwodGhpcywgZ2xvYmFsKTtcbiAgICAgICAgICAgIHRoaXMucm91dGVyLnJlZ2lzdGVyKFxuICAgICAgICAgICAgICAgIFFKU1NoZWxsLnR5cGUsXG4gICAgICAgICAgICAgICAgcWpzLmhhbmRsZS5iaW5kKHFqcylcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgY29ubmVjdCgpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jbGllbnQuY29ubmVjdCgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGAke2UubWVzc2FnZX1cXG4ke2Uuc3RhY2t9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgY2hlY2tMdWFTZXJ2aWNlKCkge1xuICAgICAgICAgICAgLy8gdHJ5IHtcbiAgICAgICAgICAgIC8vICAgICBjb25zb2xlLmxvZyhhd2FpdCB0aGlzLmhGaWxlLmV4aXN0cyhcIi9Db21tb24vbG9nby5iaW5cIikpO1xuICAgICAgICAgICAgLy8gfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIG1lc3NhZ2VSZWNlaXZlZChtc2cpIHtcbiAgICAgICAgICAgIGNvbnN0IG1zZ09iaiA9IEpTT04ucGFyc2UobXNnKTtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBtc2dPYmo/LnR5cGU7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhtc2dPYmopO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIk5vIHR5cGUgc3BlY2lmaWVkIVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgICAgICFPYmplY3QudmFsdWVzKEFjdGl2aXRpZXMpLmluY2x1ZGVzKHR5cGUpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgVW5rbm93biB0eXBlOiAke3R5cGV9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucm91dGVyLnJvdXRlc1t0eXBlXShtc2dPYmopO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVzXCIsIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSkpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuY2xpZW50LnNlbmQocmVzdWx0KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlLm1lc3NhZ2UsIGUuc3RhY2spO1xuXG4gICAgICAgICAgICAgICAgLy8gbGFzdCByZXNvcnRcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNsaWVudC5zZW5kKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJpbnRlcmNvbm5lY3RcIixcbiAgICAgICAgICAgICAgICAgICAgc3RhdGU6IFwiZXJyb3JcIixcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGAke2UubWVzc2FnZX1cXG4ke2Uuc3RhY2t9YFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFwcGVuZExvZyhtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aGlzLmxvZ1N0cmVhbS5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgd2hpbGUgKHRoaXMubG9nU3RyZWFtLmxlbmd0aCA+IHRoaXMubWF4TG9nTGluZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZ1N0cmVhbS5zaGlmdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlzdEVsZW1lbnQgPSB0aGlzLiRlbGVtZW50KCdsb2dMaXN0Jyk7XG4gICAgICAgICAgICAgICAgaWYgKGxpc3RFbGVtZW50ICYmIHR5cGVvZiBsaXN0RWxlbWVudC5zY3JvbGxUbyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBsaXN0RWxlbWVudC5zY3JvbGxUbyh7IGluZGV4OiB0aGlzLmxvZ1N0cmVhbS5sZW5ndGggLSAxIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgfVxuICAgIH1cbjwvc2NyaXB0PlxuXG48c3R5bGU+XG4gICAgQGltcG9ydCAnLi9jc3Mvc3R5bGUuY3NzJztcbjwvc3R5bGU+Il0sIm5hbWVzIjpbIl9zeXN0ZW0iLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiJGFwcF9yZXF1aXJlJCIsIl9zeXN0ZW0yIiwiZSIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiSW50ZXJjb25uZWN0Q2xpZW50IiwiY29uc3RydWN0b3IiLCJkZWJ1ZyIsImNvbm4iLCJjb25uZWN0ZWQiLCJjb25uZWN0aW5nIiwibWVzc2FnZUhhbmRsZXIiLCJvcGVuSGFuZGxlciIsImNsb3NlSGFuZGxlciIsImVycm9ySGFuZGxlciIsImxvZyIsImFyZ3MiLCJjb25zb2xlIiwib25NZXNzYWdlIiwiaGFuZGxlciIsIm9uT3BlbiIsIm9uQ2xvc2UiLCJvbkVycm9yIiwiY29ubmVjdCIsIkVycm9yIiwiY2FuSVVzZSIsImluc3RhbmNlIiwiaW5zdGFsbEhhbmRsZXJzIiwid2FpdEZvckNvbm5lY3Rpb24iLCJvbm9wZW4iLCJvbmNsb3NlIiwiZGF0YSIsIm9uZXJyb3IiLCJlcnIiLCJvbm1lc3NhZ2UiLCJldmVudCIsImVycm9yIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJnZXRSZWFkeVN0YXRlIiwic3VjY2VzcyIsInN0YXR1cyIsImZhaWwiLCJfIiwiY29kZSIsInNlbmQiLCJkaXNjb25uZWN0IiwiX3RoaXMkY29ubiRkZXN0cm95IiwiX3RoaXMkY29ubiIsImRlc3Ryb3kiLCJjYWxsIiwiaXNDb25uZWN0ZWQiLCJleHBvcnRzIiwiX3Byb21pc2VGaWxlIiwicmVxdWlyZSIsIl9tYWlsYm94U3RhdGVzIiwic2xlZXAiLCJtcyIsInNldFRpbWVvdXQiLCJNYWlsYm94IiwicGF0aCIsInBvbGxJbnRlcnZhbCIsInJldHJ5UG9sbEludGVydmFsIiwiZmlsZSIsImN1cnJlbnRJZCIsImJ1c3kiLCJyZXRyeUF0dCIsInJldHJ5QXR0TWF4IiwicmVhZCIsIm1haWxib3hFeGlzdHMiLCJleGlzdHMiLCJ0ZXh0IiwicmVhZFRleHQiLCJyZXRyeVJlYWQiLCJyZXN1bHQiLCJKU09OIiwicGFyc2UiLCJ3cml0ZSIsIndyaXRlVGV4dCIsInN0cmluZ2lmeSIsImluaXQiLCJtYWlsYm94IiwiaWQiLCJzdGF0ZSIsIlJVTk5JTkciLCJFUlJPUiIsIl91bnVzZWQiLCJ2ZXJzaW9uIiwiSURMRSIsInJlcXVlc3QiLCJ0eXBlIiwidGltZW91dCIsIlBFTkRJTkciLCJ0aW1lc3RhbXAiLCJEYXRlIiwibm93Iiwid2FpdCIsInN0YXJ0IiwiRE9ORSIsIkFjdGl2aXRpZXMiLCJPYmplY3QiLCJmcmVlemUiLCJ0ZXJtaW5hbCIsImlvIiwic2Vuc29ycyIsImx1YSIsInFqcyIsIl9kZWZhdWx0IiwiTWFpbGJveFN0YXRlIiwiUGF0aHMiLCJkZWZhdWx0X2NtZG91dCIsIlByb21pc2VGaWxlIiwibGlzdEZpbGVzIiwidXJpIiwibGlzdCIsImZpbGVMaXN0IiwiZW5jb2RpbmciLCJ3cml0ZUJ1ZmZlciIsImJ1ZmZlciIsInJlYWRCdWZmZXIiLCJjb3B5Iiwic3JjVXJpIiwiZHN0VXJpIiwibW92ZSIsImRlbGV0ZSIsImFjY2VzcyIsIm1rZGlyIiwicmVjdXJzaXZlIiwicm1kaXIiLCJnZXRJbmZvIiwiZ2V0IiwibWV0YSIsIlFKU1NoZWxsIiwiYXBwQ3R4IiwiZ2xvYmFsIiwiY29udGV4dCIsIm1heFN0cmluZyIsImhhbmRsZSIsIm1lc3NhZ2UiLCJleGVjdXRlIiwic2FmZVN0cmluZ2lmeSIsInZhbHVlIiwic2VlbiIsIk1hcCIsImNvbnZlcnQiLCJ2YWwiLCIkIiwidW5kZWZpbmVkIiwiTnVtYmVyIiwiaXNOYU4iLCJJbmZpbml0eSIsImxlbmd0aCIsInN1YnN0cmluZyIsImhhcyIsInRvIiwic2V0Iiwib3V0IiwiQXJyYXkiLCJpc0FycmF5Iiwia2V5IiwiUmVmbGVjdCIsIm93bktleXMiLCJTdHJpbmciLCJGdW5jdGlvbiIsInNhZmVSZXN1bHQiLCJyZXMiLCJfZGVmaW5lUHJvcGVydHkiLCJyIiwidCIsIl90b1Byb3BlcnR5S2V5IiwiZGVmaW5lUHJvcGVydHkiLCJlbnVtZXJhYmxlIiwiY29uZmlndXJhYmxlIiwid3JpdGFibGUiLCJpIiwiX3RvUHJpbWl0aXZlIiwiU3ltYm9sIiwidG9QcmltaXRpdmUiLCJUeXBlRXJyb3IiLCJUZXJtaW5hbCIsIm1zZ09iaiIsInJ1biIsImhhbmRsZUNtZEZhaWwiLCJlcnJNc2ciLCJzdGFjayIsImNvbW1hbmQiLCJjbWQiLCJleGl0Q29kZSIsIm91dHB1dEZpbGUiLCJjaGVja0NtZE91dCIsImNtZE91dCIsIlJvdXRlciIsInJvdXRlcyIsInJlZ2lzdGVyIiwiX193ZWJwYWNrX3JlcXVpcmVfXyIsImdsb2JhbFRoaXMiLCJ3aW5kb3ciLCJfaW50ZXJjb25uZWN0IiwiX21haWxib3giLCJfcGF0aHMiLCJfYWN0aXZpdGllcyIsIl9yb3V0ZXIiLCJfdGVybWluYWwiLCJfcXVpY2tqcyIsInByaXZhdGUiLCJsb2dTdHJlYW0iLCJtYXhMb2dMaW5lcyIsImNsaWVudCIsImFwcCIsImhGaWxlIiwiYWN0aXZpdGllcyIsInJvdXRlciIsIm9uSW5pdCIsImFpb3QiLCJhcHBlbmRMb2ciLCJtc2ciLCJtZXNzYWdlUmVjZWl2ZWQiLCJzZXR1cFJvdXRlciIsImJpbmQiLCJjaGVja0x1YVNlcnZpY2UiLCJ2YWx1ZXMiLCJpbmNsdWRlcyIsInB1c2giLCJzaGlmdCIsImxpc3RFbGVtZW50IiwiJGVsZW1lbnQiLCJzY3JvbGxUbyIsImluZGV4Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozt3QkFBQSxJQUFBQSxVQUFBQyx1QkFBQUMsZUFBQTt3QkFDQSxJQUFBQyxXQUFBRix1QkFBQUMsZUFBQTt3QkFBOEIsU0FBQUQsdUJBQUFHLENBQUE7NEJBQUEsT0FBQUEsS0FBQUEsRUFBQUMsVUFBQSxHQUFBRCxJQUFBO2dDQUFBRSxTQUFBRjs0QkFBQTt3QkFBQTt3QkFFZixNQUFNRzs0QkFFakJDLFlBQVksRUFBRUMsUUFBUSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBRTtnQ0FDaEMsSUFBSSxDQUFDQSxLQUFLLEdBQUdBO2dDQUViLElBQUksQ0FBQ0MsSUFBSSxHQUFHO2dDQUVaLElBQUksQ0FBQ0MsU0FBUyxHQUFHO2dDQUNqQixJQUFJLENBQUNDLFVBQVUsR0FBRztnQ0FFbEIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsS0FBTztnQ0FDN0IsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBTztnQ0FDMUIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBTztnQ0FDM0IsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBTzs0QkFDL0I7NEJBRUFDLElBQUksR0FBR0MsSUFBSSxFQUFFO2dDQUNULElBQUksSUFBSSxDQUFDVCxLQUFLLEVBQ1ZVLFFBQVFGLEdBQUcsQ0FBQyxxQkFBcUJDOzRCQUV6Qzs0QkFFQUUsVUFBVUMs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