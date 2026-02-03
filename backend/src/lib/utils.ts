import { webcrypto as crypto } from "node:crypto";

export const EMAIL_REGEX =
	/^([a-z\d_-]+)(((\.[a-z\d_-]+)|(-[a-z\d_-]+))+)?(\+[a-z\d_-]+)?@([a-z\d-]+)\.([a-z]{2,8})(\.[a-z]{2,8})?$/i;

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

function getMessageEncoding(message: string) {
	const enc = new TextEncoder();
	return enc.encode(message);
}

function encryptMessage(
	message: string,
	key: crypto.CryptoKey,
	iv: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> {
	const encoded = getMessageEncoding(message);
	return crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
}

async function basicEncrypt(
	message: string,
	iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		base64ToBytes(process.env.BASIC_KEY!),
		"AES-GCM",
		true,
		["encrypt", "decrypt"],
	);
	return bytesToBase64(
		new Uint8Array(await encryptMessage(message, key, iv)),
	);
}

export function getRandomIV(): Uint8Array<ArrayBuffer> {
	return crypto.getRandomValues(new Uint8Array(12));
}

export async function basicDecrypt(
	ciphertext: string,
	iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		base64ToBytes(process.env.BASIC_KEY!),
		"AES-GCM",
		true,
		["encrypt", "decrypt"],
	);
	// The iv value is the same as that used for encryption
	return bytesToBase64(
		new Uint8Array(
			await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv },
				key,
				base64ToBytes(ciphertext),
			),
		),
	);
}

/** This function assumes that each relevant substring of data is at most 99 characters */
export async function decryptData(data: string, iv: string): Promise<string[]> {
	const decryptedString = atob(await basicDecrypt(data, base64ToBytes(iv)));
	const newData = [];
	let idx = 0;

	while (idx < decryptedString.length) {
		const l = Number(
			`${decryptedString.charAt(idx)}${decryptedString.charAt(idx + 1)}`,
		);
		if (isNaN(l)) return [];
		let newIdx = idx + 2 + l;
		newData.push(decryptedString.slice(idx + 2, newIdx));
		idx = newIdx;
	}
	return newData;
}
