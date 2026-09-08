import PromiseFile from "../helpers/promiseFile";
import MailboxState from "../constants/mailboxStates";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default class Mailbox {
    constructor(path, statePath, pollInterval = 100, debug = false) {
        this.path = path;
        this.statePath = statePath;
        this.pollInterval = pollInterval;
        this.retryPollInterval = 10;
        this.debug = debug;
        
        this.file = PromiseFile;
        this.currentId = 0;
        this.busy = false;
    }

    log(...args) {
        if (this.debug) {
            console.log("[Mailbox]", ...args);
        }
    }

    // state helpers
    async readState() {
        try {
            const buffer = await this.file.readBuffer(this.statePath, 0, 1);
            if (!buffer || buffer.length === 0) {
                return MailboxState.IDLE;
            }
            return buffer[0];
        } catch {
            return MailboxState.ERROR;
        }
    }
    async writeState(stateByte) {
        const buffer = new Uint8Array([stateByte]);
        await this.file.writeBuffer(this.statePath, buffer);
    }

    // payload helpers
    async readJson() {
        const exists = await this.file.exists(this.path);
        if (!exists) return {};

        const text = await this.file.readText(this.path);
        if (!text) return {};

        return JSON.parse(text);
    }
    async writeJson(data) {
        await this.file.writeText(
            this.path,
            JSON.stringify(data)
        );
    }

    async init() {
        const exists = await this.file.exists(this.path);
        if (exists) {
            const mailbox = await this.readJson();
            this.currentId = mailbox.id || 0;
        } else {
            this.currentId = 0;
            await this.writeJson({ id: 0 });
        }

        await this.writeState(MailboxState.IDLE);
    }

    async request(type, args = {}, timeout = 5000) {
        if (this.busy) {
            throw new Error("Mailbox busy");
        }

        this.busy = true;

        try {
            const currentState = await this.readState();
            if (currentState === MailboxState.RUNNING || currentState === MailboxState.PENDING) {
                throw new Error("Lua is busy");
            }

            const id = ++this.currentId;

            await this.writeJson({
                id,
                type,
                args
            });

            await this.writeState(MailboxState.PENDING);

            this.log("Request submitted:", id);

            return await this.wait(timeout);
        } finally {
            this.busy = false;
        }
    }

    async wait(timeout) {
        const start = Date.now();

        while (true) {
            const state = await this.readState();

            switch (state) {
                case MailboxState.PENDING:
                case MailboxState.RUNNING:
                    break;

                // these states need the json file to be read
                case MailboxState.DONE:
                case MailboxState.STREAM:
                case MailboxState.ERROR: {
                    const payload = await this.readJson();

                    if (state === MailboxState.ERROR) {
                        throw new Error(payload.error || "Mailbox error");
                    }

                    this.log("Completed with ID:", payload.id);
                    return payload;
                }
            }

            if (Date.now() - start > timeout) {
                await this.writeState(MailboxState.TIMEOUT);
                throw new Error("Mailbox timeout");
            }

            await sleep(this.pollInterval);
        }
    }
}