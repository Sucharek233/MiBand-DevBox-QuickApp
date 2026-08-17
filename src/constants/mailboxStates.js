const MailboxState = Object.freeze({
    IDLE: "idle",
    PENDING: "pending",
    RUNNING: "running",
    DONE: "done",
    ERROR: "error",
    TIMEOUT: "timeout",
    STREAM: "stream"
});

export default MailboxState;