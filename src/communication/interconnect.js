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

        if (typeof app.canIUse === "function" && !app.canIUse("@system.interconnect")) {
            throw new Error("Interconnect API unavailable.");
        }

        if (typeof interconnect.instance !== "function") {
            throw new Error("Interconnect instance API unavailable.");
        }

        this.connecting = true;
        try {
            this.conn = interconnect.instance();
            if (!this.conn) {
                throw new Error("Interconnect returned no connection.");
            }

            this.installHandlers();
            if (typeof this.conn.getReadyState === "function") {
                this.waitForConnection();
            } else {
                this.log("Readiness query unavailable; waiting for connection events.");
            }
        } catch (error) {
            this.connecting = false;
            throw error;
        }
    }

    installHandlers() {
        this.conn.onopen = () => {
            this.connecting = false;
            this.connected = true;
            this.log("Connected.");
            this.openHandler();
        };

        this.conn.onclose = (data) => {
            this.connecting = false;
            this.connected = false;
            this.log("Disconnected.");
            this.closeHandler(data);
        };

        this.conn.onerror = (err) => {
            this.connecting = false;
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
        this.conn.getReadyState({
            success: ({ status }) => {
                this.connecting = false;
                if (status == 1) {
                    this.connected = true;
                    this.openHandler();
                } else if (status == 2) {
                    this.closeHandler();
                }
            },
            fail: ({ code }) => {
                this.connecting = false;
                if (code == 1006) {
                    this.connected = false;
                    this.closeHandler();
                }
            }
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
        this.connecting = false;
        this.connected = false;
        this.log("Destroyed.");
    }

    isConnected() {
        return this.connected;
    }
}
