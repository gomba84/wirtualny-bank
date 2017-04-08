// Model możliwych akcji w systemie

// Lista typów akcji
let actions = [
    "create_agent", "transfer"
];

// Definicje typów akcji
class action_create_agent {
    constructor(data) {
        this.action = "create_agent";
        this.timestamp = data.timestamp;
        this.number = data.number;
        this.name = data.name;
        this.amount = data.initialAmount;
    }
}

class action_transfer {
    constructor(data) {
        this.action = "transfer";
        this.timestamp = data.timestamp;
        this.origin = data.origin;
        this.target = data.target;
        this.amount = data.amount;
        this.title = data.title;
    }
}

exports.actions = actions;
exports.action_create_agent = action_create_agent;
exports.action_transfer = action_transfer;
