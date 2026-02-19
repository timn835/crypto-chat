import {
	DynamoDBClient,
	GetItemCommand,
	type GetItemCommandInput,
	QueryCommand,
	type QueryCommandInput,
	type QueryCommandOutput,
	BatchGetItemCommand,
	type BatchGetItemCommandInput,
	PutItemCommand,
	// BatchWriteItemCommand,
	// QueryCommand,
	// BatchGetItemCommand,
	// type BatchGetItemCommandInput,
	// type QueryCommandInput,
	// type QueryCommandOutput,
	// ScanCommand,
	// UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { fromEnv } from "@aws-sdk/credential-providers";
import type { DBUser, Message } from "./types";
// import { v4 as uuidv4 } from "uuid";

const USERS_TABLE = "crypto-chat_users";
const HANDLES_TABLE = "crypto-chat_handles";
const USERS_CHATS_TABLE = "crypto-chat_users_chats";
const MESSAGES_TABLE = "crypto-chat_messages";

const dbClient = new DynamoDBClient({
	region: process.env.AWS_REGION!,
	credentials: fromEnv(),
});

// Setters

/**
 * Queries a user by id, returns null if user does not exist.
 * @param userID
 * @returns
 */
export async function dbGetUser(userID: string): Promise<DBUser | null> {
	const params: GetItemCommandInput = {
		TableName: USERS_TABLE,
		Key: { id: { S: userID } },
	};

	try {
		const response = await dbClient.send(new GetItemCommand(params));
		if (!response.Item) return null;
		return {
			id: userID,
			handle: response.Item.handle?.S || "",
			hash: response.Item.hash?.S || "",
			email: response.Item.email?.S || "",
		};
	} catch (err) {
		console.error(err);
		return null;
	}
}

/**
 * Returns true if handle exists or if something goes wrong, false otherwise.
 * @param handle
 */
export async function dbInvalidHandle(handle: string): Promise<boolean> {
	const params: GetItemCommandInput = {
		TableName: HANDLES_TABLE,
		Key: { handle: { S: handle } },
	};
	try {
		const response = await dbClient.send(new GetItemCommand(params));
		return !!response.Item;
	} catch (err) {
		console.error(err);
		return true;
	}
}

/**
 * Get all chat ids for a user, along with whether user is userA and the lastMessageIndex.
 * @param userID
 * @returns
 */
export async function dbGetChatIDs(
	userID: string,
): Promise<{ chatID: string; isUserA: boolean; lastMessageIndex: number }[]> {
	let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] = undefined;
	const chatIDs: {
		chatID: string;
		isUserA: boolean;
		lastMessageIndex: number;
	}[] = [];
	try {
		do {
			const params: QueryCommandInput = {
				TableName: USERS_CHATS_TABLE,
				KeyConditionExpression: "userId = :userId",
				ExpressionAttributeValues: {
					":userId": { S: userID },
				},
				ProjectionExpression: "chatId, isUserA, lastMessageIndex",
				Limit: 1000,
				ExclusiveStartKey: lastEvaluatedKey,
			};
			const response = await dbClient.send(new QueryCommand(params));
			if (response?.Items) {
				chatIDs.push(
					...response.Items.map((item) => ({
						chatID: item?.chatId?.S || "",
						isUserA: !!item?.isUserA?.BOOL,
						lastMessageIndex: parseInt(
							item?.lastMessageIndex?.N || "0",
						),
					})),
				);
			}
			lastEvaluatedKey = response.LastEvaluatedKey;
		} while (lastEvaluatedKey);
	} catch (error) {
		console.error(error);
	} finally {
		return chatIDs;
	}
}

/**
 * Get all messages for a chat, automatically sorted in ascending order by messageIndex.
 * @param chatID
 * @returns
 */
export async function dbGetMessages(chatID: string): Promise<Message[]> {
	let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] = undefined;
	const messages: Message[] = [];
	try {
		do {
			const params: QueryCommandInput = {
				TableName: MESSAGES_TABLE,
				KeyConditionExpression: "chatId = :chatId",
				ExpressionAttributeValues: {
					":chatId": { S: chatID },
				},
				ProjectionExpression: "messageIndex, text, isUserA, time",
				Limit: 100,
				ExclusiveStartKey: lastEvaluatedKey,
			};
			const response = await dbClient.send(new QueryCommand(params));
			if (response?.Items) {
				messages.push(
					...response.Items.map((item) => ({
						text: item?.text?.S || "",
						isUserA: !!item?.isUserA?.BOOL,
						time: parseInt(item?.time?.N || "0"),
					})),
				);
			}
			lastEvaluatedKey = response.LastEvaluatedKey;
		} while (lastEvaluatedKey);
	} catch (error) {
		console.error(error);
	} finally {
		return messages;
	}
}

/**
 * Get the last messages of a list of conversations to construct chat headers.
 * We make batches of 100, which should be less than 16MB.
 * @param chatID
 * @returns
 */
export async function dbGetLastMessages(
	chatsInfo: { chatID: string; lastMessageIndex: number }[],
): Promise<Message[] | null> {
	const lastMessages: Message[] = [];
	try {
		let count = 0;
		do {
			const params: BatchGetItemCommandInput = {
				RequestItems: {
					[MESSAGES_TABLE]: {
						Keys: chatsInfo
							.slice(count, (count += 100))
							.map(({ chatID, lastMessageIndex }) => ({
								chatId: { S: chatID },
								messageIndex: { N: `${lastMessageIndex}` },
							})),
						ProjectionExpression: "text, time, isUserA",
					},
				},
			};
			const response = await dbClient.send(
				new BatchGetItemCommand(params),
			);
			if (response.Responses?.[MESSAGES_TABLE]?.length)
				lastMessages.push(
					...response.Responses![MESSAGES_TABLE]!.map((item) => ({
						text: item?.text?.S || "",
						isUserA: !!item?.isUserA?.BOOL,
						time: parseInt(item?.time?.N || "0"),
					})),
				);
		} while (count < chatsInfo.length);
		return lastMessages;
	} catch (error) {
		console.error(error);
		return null;
	}
}

// Mutators

/**
 * Store a new user inside the database.
 * @param id
 * @param handle
 * @param hash
 * @param email
 */
export async function dbStoreUser(
	id: string,
	handle: string,
	hash: string,
	email: string,
) {
	await dbClient.send(
		new PutItemCommand({
			TableName: USERS_TABLE,
			Item: {
				id: { S: id },
				handle: { S: handle },
				hash: { S: hash },
				email: { S: email },
			},
		}),
	);
}
