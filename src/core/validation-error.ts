export class ValidationError extends Error {
    public readonly field: string;
    public readonly cleanMessage: string;

    constructor(field: string, cleanMessage: string) {
        super(`typed-storage: valor inválido para "${field}": ${cleanMessage}`);
        this.name = 'ValidationError';
        this.field = field;
        this.cleanMessage = cleanMessage;

        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}