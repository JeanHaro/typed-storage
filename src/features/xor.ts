function textToBytes ( text: string ): Uint8Array {
    return new TextEncoder().encode(text);
}

function bytesToText ( bytes: Uint8Array ): string {
    return new TextDecoder().decode(bytes);
}

function bytesToBinaryString ( bytes: Uint8Array ): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
}

function binaryStringToBytes ( binary: string ): Uint8Array {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function xorBytes ( bytes: Uint8Array, secret: string ): Uint8Array {
    const secretBytes = textToBytes(secret);
    const result = new Uint8Array(bytes.length);

    for (let i = 0; i < bytes.length; i++) {
        result[i] = bytes[i] ^ secretBytes[i % secretBytes.length];
    }

    return result;
}

export function xorEncrypt ( text: string, secret: string ): string {
    const bytes = textToBytes(text); // texto (cualquier Unicode) → bytes reales
    const xored = xorBytes(bytes, secret); // XOR byte a byte, siempre 0-255
    const binary = bytesToBinaryString(xored); // bytes → string Latin1-safe
    return btoa(binary); // ahora SIEMPRE es seguro para btoa
}

export function xorDecrypt ( text: string, secret: string ): string {
    const binary = atob(text); // Base64 → string Latin1
    const xored = binaryStringToBytes(binary); // string → bytes
    const bytes = xorBytes(xored, secret); // XOR revierte (es su propio inverso)
    return bytesToText(bytes); // bytes → texto Unicode original
}