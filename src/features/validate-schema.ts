import { Validator } from "../types.js";

export function validateValue(
    value: any,
    validator: Validator | undefined
): { valid: boolean, error?: string } {
    if ( !validator ) return { valid: true };

    const result = validator.safeParse(value);

    if ( !result.success ) {
        // Zod (y validadores similares) devuelven un array de "issues" 
        // con mensajes específicos por campo 
        const issues = (result.error as any)?.issues;

        if ( Array.isArray(issues) && issues.length > 0 ) {
            return {
                valid: false,
                error: issues.map((issue: any) => issue.message).join(', ')
            };
        }

        return {
            valid: false,
            error: result.error?.message ?? 'Valor inválido'
        };
    }

    return { valid: true };
}