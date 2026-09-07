import MailboxState from "../../constants/mailboxStates";
import promiseFile from "../../helpers/promiseFile";

export default class FileManager {
    static type = "io";
    static needsScreenOn = true;

    // 32 KiB
    // Might be too much?
    static maxJChunkSize = 32768;

    constructor(mailbox) {
        this.mailbox = mailbox;

        this.streaming = false;
        this.fileSize = -1;
        this.chunkPath = "";
        this.chunkLimit = 30720; // 30 KiB default limit
        this.chunkPosition = 0;
        this.chunkSize = -1;

        this.chunkMeta = {};
        this.chunkMetaSent = false;
    }

    async handle(message) {
        const type = message?.args?.type;
        if (type === "getStream" || type === "chunk") {
            return await this.handleStreaming(message.args, type);
        }

        return await this.run(message.args);
    }

    async readChunk() {
        const chunk = await promiseFile.readBuffer(
            this.chunkPath, 
            this.chunkPosition, 
            this.chunkLimit
        );

        if (!chunk || chunk.length === 0) {
            return {
                type: FileManager.type,
                state: MailboxState.STREAM,
                res: null
            };
        }

        this.chunkPosition += chunk.length;

        const data = String.fromCharCode(...chunk);

        const result = {
            type: FileManager.type,
            state: MailboxState.STREAM,
            res: data,
        };

        if (!this.chunkMetaSent) {
            result.meta = this.chunkMeta;
            this.chunkMetaSent = true;
        }

        return result;
    }

    async nextChunk() {
        if (!this.streaming) {
            return {
                type: FileManager.type,
                state: MailboxState.ERROR,
                msg: "Not streaming"
            };
        }

        if (this.chunkSize <= this.chunkPosition) {
            const result = await this.mailbox.request(
                FileManager.type,
                { type: "chunk" },
                10000
            );

            const state = result.appState;
            if (state === MailboxState.ERROR) {
                return {
                    type: FileManager.type,
                    state: MailboxState.ERROR,
                    msg: result.res
                };
            } else if (state === MailboxState.DONE) {
                this.streaming = false;
                this.fileSize = -1;
                this.chunkSize = -1;
                this.chunkPosition = 0;

                return {
                    type: FileManager.type,
                    state: MailboxState.DONE,
                    res: result.res
                };
            }

            // Update new local chunk file info
            const chunkInfo = await promiseFile.getInfo(this.chunkPath);
            this.chunkSize = chunkInfo.length;
            this.chunkPosition = 0;
            this.chunkMeta = result.res;
            this.chunkMetaSent = false;
        }

        return await this.readChunk();
    }

    async handleStreaming(args, type) {
        if (type === "getStream") {
            if (this.streaming) {
                return {
                    type: FileManager.type,
                    state: MailboxState.ERROR,
                    msg: "Already streaming"
                };
            }

            const result = await this.mailbox.request(
                FileManager.type,
                args,
                10000
            );

            if (result.appState === MailboxState.ERROR) {
                return {
                    type: FileManager.type,
                    state: MailboxState.ERROR,
                    msg: result.res
                };
            }

            let jSize;
            if (result.jSize > FileManager.maxJChunkSize) {
                jSize = FileManager.maxJChunkSize;
            } else {
                jSize = result.jSize ?? 30 * 1024;
            }

            const res = result.res;
            this.fileSize = res.fileSize;
            this.chunkPath = res.path;
            this.chunkSize = jSize;
            this.chunkSize = 0;
            this.chunkPosition = 0;
            this.streaming = true;

            return {
                type: FileManager.type,
                state: MailboxState.DONE,
                res: res
            };

        } else if (type === "chunk") {
            return await this.nextChunk();

        } else if (type === "stop") {
            const result = await this.mailbox.request(
                FileManager.type,
                args,
                10000
            );

            this.streaming = false;
            this.fileSize = -1;
            this.chunkSize = -1;
            this.chunkPosition = 0;

            const res = {
                type: FileManager.type,
                state: result.appState,
            };
            if (result.appState == MailboxState.DONE) {
                res.res = result.res; // cursed lmao
            } else {
                res.msg = result.res;
            }
            
            return res;
        }
    }

    async run(args) {
        try {
            const result = await this.mailbox.request(
                FileManager.type,
                args,
                10000
            );

            return {
                type: FileManager.type,
                res: result.res,
                state: result.appState
            };
        } catch (e) {
            return {
                type: FileManager.type,
                state: MailboxState.ERROR,
                msg: e.msg,
                stack: e.stack
            };
        }
    }
}