export function xorTransform ( text: string, secret: string ): string {
    return text.split('').map((char, i) => {
        const keyChar = secret[i % secret.length];
        return String.fromCharCode(
            char.charCodeAt(0) ^ keyChar.charCodeAt(0)
        );
    }).join('');
}

export function xorEncrypt ( text: string, secret: string ): string {
    const xored = xorTransform(text, secret);
    return btoa(xored);
}

export function xorDecrypt ( text: string, secret: string ): string {
    const xored = atob(text);
    return xorTransform(xored, secret);
}