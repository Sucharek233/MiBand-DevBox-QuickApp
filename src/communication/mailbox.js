import PromiseFile from "../helpers/promiseFile";
import MailboxState from "../constants/mailboxStates";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default class Mailbox {
    constructor(path, pollInterval = 1000, debug = false) {
        this.path = path;
        this.pollInterval = pollInterval;
        this.retryPollInterval = 10;
        this.debug = debug;
        
        this.file = PromiseFile;
        
        this.currentId = 0;
        this.busy = false;

        this.retryAtt = 0;
        this.retryAttMax = 5;
    }

    log(...args) {
        if (this.debug) {
            console.log("[Mailbox]", ...args);
        }
    }

    async read() {
        const mailboxExists = await this.file.exists(this.path);
        if (!mailboxExists) {
            return {};
        }

        const text = await this.file.readText(this.path);
        if (!text || text == "") {
            if (this.retryAtt > this.retryAttMax - 1) {
                throw new Error("Mailbox empty");
            }
            this.retryAtt++;
            
            await sleep(this.retryPollInterval);
            const retryRead = await this.read();
            return retryRead;
        }

        const result = JSON.parse(String.raw`${text}`);
        this.retryAtt = 0;
        return result;
    }

    async write(data) {
        await this.file.writeText(
            this.path,
            JSON.stringify(data)
        );
    }

    async init() {
        const mailboxExists = await this.file.exists(this.path);
        if (mailboxExists) {
            const mailbox = await this.read();
            this.currentId = mailbox.id || 0;

            if (mailbox.state === MailboxState.RUNNING) {
                mailbox.state = MailboxState.ERROR;
                mailbox.error = "reset_after_restart";

                await this.write(mailbox);
            }
        } else {
            await this.write({
                version: 1,
                id: 0,
                state: MailboxState.IDLE
            });

            this.currentId = 0;
        }
    }

    async request(type, args = {}, timeout = 5000) {
        if (this.busy) {
            throw new Error("Mailbox busy");
        }

        this.busy = true;

        try {
            const mailbox = await this.read();
            if (
                mailbox.state === MailboxState.RUNNING ||
                mailbox.state === MailboxState.PENDING
            ) {
                throw new Error("Lua is busy");
            }

            const id = ++this.currentId;
            await this.write({
                version: 1,
                id,
                state: MailboxState.PENDING,
                type,
                args,
                timestamp: Date.now()
            });

            this.log("Request submitted:", id);

            return await this.wait(id, timeout);
        } finally {
            this.busy = false;
        }
    }

    async wait(id, timeout) {
        const start = Date.now();
        while (true) {
            const mailbox = await this.read();
            if (mailbox.id !== id) {
                await sleep(this.pollInterval);
                continue;
            }

            switch (mailbox.state) {
                case MailboxState.PENDING:
                case MailboxState.RUNNING:
                    break;

                case MailboxState.DONE:
                    this.log("Completed.");
                    return mailbox;

                case MailboxState.ERROR:
                    throw new Error(
                        mailbox.error || "Mailbox error"
                    );
            }

            if (Date.now() - start > timeout) {
                await this.write({
                    version: 1,
                    id,
                    state: MailboxState.TIMEOUT
                });
                throw new Error("Mailbox timeout");
            }

            await sleep(this.pollInterval);
        }
    }
}