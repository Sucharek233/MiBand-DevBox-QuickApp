const MailboxState = Object.freeze({
    full: {
        DONE: "done",
        IDLE: "idle",
        PENDING: "pending",
        RUNNING: "running",
        ERROR: "error",
        TIMEOUT: "timeout",
        STREAM: "stream"
    },
    codes: {
        DONE: 0,
        IDLE: 1,
        PENDING: 2,
        RUNNING: 3,
        ERROR: 4,
        TIMEOUT: 5,
        
        // stream reserved as 9
        STREAM: 9
    }
});

export default MailboxState;