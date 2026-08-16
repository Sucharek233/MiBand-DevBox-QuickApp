import interconnect from "@system.interconnect";
import app from "@system.app";

export default class InterconnectClient {

    constructor({ debug = false } = {}) {
        this.debug = debug;

        this.conn = null;

        this.connected = false;
        this.connecting = false;

        this.messageHandler = () => {};
        this.openHandler = () => {};
        this.closeHandler = () => {};
        this.errorHandler = () => {};
    }

    log(...args) {
        if (this.debug) {
            console.log("[Interconnect]", ...args);
        }
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
        if (this.connected) {
            this.log("Already connected.");
            return;
        }

        if (this.connecting) {
            throw new Error("Connection already in progress.");
        }

        if (!app.canIUse("@system.interconnect")) {
            throw new Error("Interconnect API unavailable.");
        }

        this.connecting = true;
        this.conn = interconnect.instance();

        this.installHandlers();

        await this.waitForConnection();

        this.connecting = false;
    }

    installHandlers() {
        this.conn.onopen = () => {
            this.connected = true;
            this.log("Connected.");
            this.openHandler();
        };

        this.conn.onclose = (data) => {
            this.connected = false;
            this.log("Disconnected.");
            this.closeHandler(data);
        };

        this.conn.onerror = (err) => {
            this.log("Error:", err);
            this.errorHandler(err);
        };

        this.conn.onmessage = (event) => {
            this.log("Received:", event.data);

            try {
                this.messageHandler(event.data);
            } catch (e) {
                console.error(e);
            }
        };
    }

    waitForConnection() {
        return new Promise((resolve, reject) => {
            this.conn.getReadyState({
                success: ({ status }) => {
                    switch (status) {
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
                            reject(
                                new Error(
                                    `Unknown state ${status}`
                                )
                            );
                    }
                },
                fail: (_, code) => {
                    this.connecting = false;
                    reject(
                        new Error(
                            `getReadyState failed (${code})`
                        )
                    );
                }
            });
        });
    }

    send(data) {
        if (!this.connected) {
            throw new Error("Not connected.");
        }

        return new Promise((resolve, reject) => {
            this.conn.send({
                data: data,
                
                success: resolve,
                fail: reject
            });
        });
    }

    disconnect() {
        if (!this.conn) {
            return;
        }

        this.conn.destroy?.();
        this.conn = null;
        this.connected = false;
        this.log("Destroyed.");
    }

    isConnected() {
        return this.connected;
    }
}