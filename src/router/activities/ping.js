export default class Ping {
    static type = "ping";
    static needsLua = true;

    constructor(mailbox) {
        this.mailbox = mailbox;
        this.pinging = false;
    }
    
    async handle(_) {
        return await this.ping();
    }

    async ping() {
        if (this.pinging) return;

        this.pinging = true;
        try {
            const startTime = Date.now();
            const result = await this.mailbox.request(
                Ping.type,
                {},
                2500 // 2.5 second timeout
            );
            this.pinging = false;

            const endTime = Date.now();

            const luaAckTime = result.time;

            const ackTime = endTime - luaAckTime;
            const totalTime = endTime - startTime;

            return {
                type: Ping.type,
                state: "done",
                startTime: startTime,
                ackTime: ackTime,
                totalTime: totalTime
            };
        } catch (e) {
            this.pinging = false;
            if (e.message == "Mailbox timeout") {
                return {
                    type: Ping.type,
                    state: "timeout"
                }
            }
            return {
                type: Ping.type,
                state: "error",
                msg: e.message,
                stack: e.stack
            }
        }
    }
}