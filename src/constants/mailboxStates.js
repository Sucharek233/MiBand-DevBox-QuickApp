const MailboxState = Object.freeze({
    // DONE: "done",
    // IDLE: "idle",
    // PENDING: "pending",
    // RUNNING: "running",
    // ERROR: "error",
    // TIMEOUT: "timeout",
    // STREAM: "stream"
    
    DONE: 0,
    IDLE: 1,
    PENDING: 2,
    RUNNING: 3,
    ERROR: 4,
    TIMEOUT: 5,
    STREAM: 6
});

export default MailboxState;