import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const EMAIL_REGEX =
	/^([a-z\d_-]+)(((\.[a-z\d_-]+)|(-[a-z\d_-]+))+)?(\+[a-z\d_-]+)?@([a-z\d-]+)\.([a-z]{2,8})(\.[a-z]{2,8})?$/i;

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export const formatterUS = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "long",
	day: "numeric",
	hour: "numeric",
	minute: "numeric",
	second: "numeric",
});

/** CRYPTOGRAPHY STUFF */

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
	key: CryptoKey,
	iv: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> {
	const encoded = getMessageEncoding(message);
	// iv will be needed for decryption
	// const iv = window.crypto.getRandomValues(new Uint8Array(12));
	// console.log("iv as string", bytesToBase64(iv));
	// const iv = base64ToBytes(import.meta.env.VITE_BASIC_IV);
	return window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
}

async function basicEncrypt(
	message: string,
	iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
	// const rawKey = window.crypto.getRandomValues(new Uint8Array(16));
	// console.log("key is", bytesToBase64(rawKey));
	// const key = await window.crypto.subtle.importKey(
	// 	"raw",
	// 	rawKey,
	// 	"AES-GCM",
	// 	true,
	// 	["encrypt", "decrypt"],
	// );
	const key = await window.crypto.subtle.importKey(
		"raw",
		base64ToBytes(import.meta.env.VITE_BASIC_KEY),
		"AES-GCM",
		true,
		["encrypt", "decrypt"],
	);
	return bytesToBase64(
		new Uint8Array(await encryptMessage(message, key, iv)),
	);
}

export function getRandomIV(): Uint8Array<ArrayBuffer> {
	return window.crypto.getRandomValues(new Uint8Array(12));
}

export async function basicDecrypt(
	ciphertext: string,
	iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
	const key = await window.crypto.subtle.importKey(
		"raw",
		base64ToBytes(import.meta.env.VITE_BASIC_KEY),
		"AES-GCM",
		true,
		["encrypt", "decrypt"],
	);
	// The iv value is the same as that used for encryption
	return bytesToBase64(
		new Uint8Array(
			await window.crypto.subtle.decrypt(
				{ name: "AES-GCM", iv },
				key,
				base64ToBytes(ciphertext),
			),
		),
	);
}

/** This function assumes that each string of data is at most 99 characters */
export async function encryptData(
	data: string[],
	iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
	const newData = [];
	for (const word of data) {
		let l = `${word.length}`;
		while (l.length < 2) l = "0" + l;
		newData.push(`${l}${word}`);
	}
	return await basicEncrypt(newData.join(""), iv);
}
