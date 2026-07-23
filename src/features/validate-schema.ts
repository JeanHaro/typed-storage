import { Validator } from "../types.js";


export function validateValue(
    value: any,
    validator: Validator | undefined
): { valid: boolean, error?: string } {
    if ( !validator ) return { valid: true };

    const result = validator.safeParse(value);

    if ( !result.success ) {
        return {
            valid: false,
            error: result.error?.message ?? 'Valor inválido'
        };
    }

    return { valid: true };
}