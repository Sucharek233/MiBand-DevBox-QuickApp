import MailboxState from "../../../constants/mailboxStates";
import promiseFile from "../../../helpers/promiseFile";
import ArgsValidator from "../../../helpers/argsValidator";

const handlers = {
    getStream: {
        required: {
            path: "string"
        },
        optional: {
            jSize: {
                type: "number",
                default: 30 * 1024
            },

            // lua specific
            lSize: {
                type: "number",
                default: 512 * 1024
            },
            b64: {
                type: "boolean",
                default: true
            }
        },

        run: async function(self, args) {
            return await self.startStream(args);
        }
    },

    chunk: {
        run: async function(self, _) {
            return await self.nextChunk();
        }
    },

    stop: {
        // args passed to pass type: "stop"
        run: async function(self, args) {
            return await self.stopStream(args);
        }
    }
};

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
        const args = message?.args || {};
        const type = args.type;
    
        const handler = handlers[type];
    
        if (handler) {
            const validation = ArgsValidator.validate(args, handler);
            if (!validation.valid) {
                return {
                    type: FileManager.type,
                    state: MailboxState.ERROR,
                    msg: validation.error
                };
            }
    
            try {
                return await handler.run(this, args);
            } catch (e) {
                return {
                    type: FileManager.type,
                    state: MailboxState.ERROR,
                    msg: e.message,
                    stack: e.stack
                };
            }
        }
    
        return await this.relay(args);
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

    async startStream(args) {
        // don't pass jSize to lua
        let jSize = args.jSize;
        delete args.jSize;

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

        if (jSize > FileManager.maxJChunkSize) {
            jSize = FileManager.maxJChunkSize;
        }

        const res = result.res;
        this.fileSize = res.fileSize;
        this.chunkPath = res.path;
        this.chunkLimit = jSize;
        this.chunkSize = 0;
        this.chunkPosition = 0;
        this.streaming = true;

        return {
            type: FileManager.type,
            state: MailboxState.DONE,
            res: res
        };
    }

    async stopStream(args) {
        const result = await this.mailbox.request(
            FileManager.type,
            args
        );

        this.streaming = false;
        this.fileSize = -1;
        this.chunkSize = -1;
        this.chunkPosition = 0;

        const res = {
            type: FileManager.type,
            state: result.appState,
        };
        if (result.appState === MailboxState.DONE) {
            res.res = result.res; // cursed lmao
        } else {
            res.msg = result.res;   
        }
        
        return res;
    }

    async relay(args) {
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
                msg: e.message,
                stack: e.stack
            };
        }
    }
}