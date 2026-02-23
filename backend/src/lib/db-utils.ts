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
	UpdateItemCommand,
	ConditionalCheckFailedException,
	ScanCommand,
	ScanCommandOutput,
	type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { fromEnv } from "@aws-sdk/credential-providers";
import type { DBUser, Message } from "./types";

const USERS_TABLE = "crypto-chat_users";
const HANDLES_TABLE = "crypto-chat_handles";
const USERS_CHATS_TABLE = "crypto-chat_users_chats";
const MESSAGES_TABLE = "crypto-chat_messages";

const dbClient = new DynamoDBClient({
	region: process.env.AWS_REGION!,
	credentials: fromEnv(),
});

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

/**
 * Returns userID if handle exists, empty string otherwise
 * @param handle
 */
export async function dbGetUserIDByHandle(handle: string): Promise<string> {
	const params: GetItemCommandInput = {
		TableName: HANDLES_TABLE,
		Key: { handle: { S: handle } },
		ProjectionExpression: "userID",
	};
	try {
		const response = await dbClient.send(new GetItemCommand(params));
		return response.Item?.userID?.S || "";
	} catch (err) {
		console.error(err);
		return "";
	}
}

/**
 * Function to search through existing user handles and find matches, we ignore the ones with the requesting
 * userID
 * @param requestingUserID
 * @param handle
 */
export async function dbGetMatchingUserHandles(
	requestingUserID: string,
	handle: string,
): Promise<{ userID: string; handle: string }[]> {
	let lastEvaluatedKey: ScanCommandOutput["LastEvaluatedKey"] = undefined;
	const matchingUsers: { userID: string; handle: string }[] = [];
	try {
		const response = await dbClient.send(
			new ScanCommand({
				TableName: HANDLES_TABLE,
				ExclusiveStartKey: lastEvaluatedKey,
			}),
		);
		if (response.Items) {
			matchingUsers.push(
				...response.Items.filter((item) => {
					if (item.userID?.S === requestingUserID) return false;
					const lowerCaseItem = item.handle?.S?.toLowerCase();
					return (
						!!lowerCaseItem &&
						(lowerCaseItem.includes(handle) ||
							handle.includes(lowerCaseItem))
					);
				}).map((item) => ({
					userID: item.userID?.S || "",
					handle: item.handle?.S || "",
				})),
			);
		}
	} catch (error) {
		console.error(error);
	} finally {
		return matchingUsers;
	}
}

/**
 * Store the handle inside DB.
 * @param handle
 */
export async function dbStoreHandle(handle: string, userID: string) {
	await dbClient.send(
		new PutItemCommand({
			TableName: HANDLES_TABLE,
			Item: {
				handle: { S: handle },
				userID: { S: userID },
			},
		}),
	);
}

/**
 * Return the other user in the chat.
 * @param userID
 * @param chatID
 */
export async function dbGetOtherUserInChat(
	userID: string,
	chatID: string,
): Promise<string | null> {
	const params: GetItemCommandInput = {
		TableName: USERS_CHATS_TABLE,
		Key: { userID: { S: userID }, chatID: { S: chatID } },
		ProjectionExpression: "otherUserID",
	};
	try {
		const response = await dbClient.send(new GetItemCommand(params));
		return response.Item?.otherUserID?.S || null;
	} catch (err) {
		console.error(err);
		return null;
	}
}

/**
 * Get a single user-chat id.
 * @param userID
 * @param chatID
 * @returns
 */
export async function dbGetChatID(
	userID: string,
	chatID: string,
): Promise<{
	otherUserID: string;
	otherUserHandle: string;
	isUserA: boolean;
	lastMessageTime: number;
	unseenMessages: number;
} | null> {
	const params: GetItemCommandInput = {
		TableName: USERS_CHATS_TABLE,
		Key: { userID: { S: userID }, chatID: { S: chatID } },
		ProjectionExpression:
			"otherUserID, otherUserHandle, isUserA, lastMessageTime, unseenMessages",
	};
	try {
		const response = await dbClient.send(new GetItemCommand(params));
		if (!response.Item) return null;
		return {
			otherUserID: response.Item.otherUserID?.S || "",
			otherUserHandle: response.Item.otherUserHandle?.S || "",
			isUserA: response.Item.isUserA?.BOOL || false,
			lastMessageTime: parseInt(response.Item.lastMessageTime?.N || "0"),
			unseenMessages: parseInt(response.Item.unseenMessages?.N || "0"),
		};
	} catch (error) {
		console.error(error);
		return null;
	}
}

/**
 * Get all chat ids for a user
 * @param userID
 * @returns
 */
export async function dbGetChatIDs(userID: string): Promise<
	{
		chatID: string;
		otherUserID: string;
		otherUserHandle: string;
		isUserA: boolean;
		lastMessageTime: number;
		unseenMessages: number;
	}[]
> {
	let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] = undefined;
	const chatIDs: {
		chatID: string;
		otherUserID: string;
		otherUserHandle: string;
		isUserA: boolean;
		lastMessageTime: number;
		unseenMessages: number;
	}[] = [];
	try {
		do {
			const params: QueryCommandInput = {
				TableName: USERS_CHATS_TABLE,
				KeyConditionExpression: "userID = :userID",
				ExpressionAttributeValues: {
					":userID": { S: userID },
				},
				ProjectionExpression:
					"chatID, otherUserID, otherUserHandle, isUserA, lastMessageTime, unseenMessages",
				Limit: 1000,
				ExclusiveStartKey: lastEvaluatedKey,
			};
			const response = await dbClient.send(new QueryCommand(params));
			if (response?.Items) {
				chatIDs.push(
					...response.Items.map((item) => ({
						chatID: item?.chatID?.S || "",
						isUserA: !!item?.isUserA?.BOOL,
						otherUserID: item?.otherUserID?.S || "",
						otherUserHandle: item?.otherUserHandle?.S || "",
						lastMessageTime: parseInt(
							item?.lastMessageTime?.N || "0",
						),
						unseenMessages: parseInt(
							item?.unseenMessages?.N || "0",
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
 * Store a new user-chat link inside the users_chats pivot table
 * @param userID
 * @param chatID
 * @param otherUserID
 * @param otherUserHandle
 * @param isUserA
 * @param lastMessageTime
 * @param unseenMessages
 */
export async function dbStoreUserChat(
	userID: string,
	chatID: string,
	otherUserID: string,
	otherUserHandle: string,
	isUserA: boolean,
	lastMessageTime: number,
	unseenMessages: number,
) {
	await dbClient.send(
		new PutItemCommand({
			TableName: USERS_CHATS_TABLE,
			Item: {
				userID: { S: userID },
				chatID: { S: chatID },
				otherUserID: { S: otherUserID },
				otherUserHandle: { S: otherUserHandle },
				isUserA: { BOOL: isUserA },
				lastMessageTime: { N: `${lastMessageTime}` },
				unseenMessages: { N: `${unseenMessages}` },
			},
		}),
	);
}

/**
 * Update user-chat link last message time and potentially unseen messages
 * @param userID
 * @param chatID
 * @param lastMessageTime
 * @param unseenMessages
 */
export async function dbUpdateLastMessageTime(
	userID: string,
	chatID: string,
	lastMessageTime: number,
	incomingMessages?: number,
) {
	const ExpressionAttributeValues: Record<string, AttributeValue> = {
		":lastMessageTime": { N: `${lastMessageTime}` },
	};
	if (incomingMessages) {
		ExpressionAttributeValues[":inc"] = { N: `${incomingMessages}` };
	}
	try {
		await dbClient.send(
			new UpdateItemCommand({
				TableName: USERS_CHATS_TABLE,
				Key: {
					userID: { S: userID },
					chatID: { S: chatID },
				},
				UpdateExpression: `SET lastMessageTime = :lastMessageTime${incomingMessages ? " ADD unseenMessages :inc" : ""}`,
				ExpressionAttributeValues,
			}),
		);
	} catch (error) {
		console.error(error);
	}
}

/**
 * Reset user-chat link unseenMessages
 * @param userID
 * @param chatID
 */
export async function dbResetUserChatUnseenMessages(
	userID: string,
	chatID: string,
) {
	try {
		await dbClient.send(
			new UpdateItemCommand({
				TableName: USERS_CHATS_TABLE,
				Key: {
					userID: { S: userID },
					chatID: { S: chatID },
				},
				UpdateExpression: "SET unseenMessages = :zero",
				ExpressionAttributeValues: {
					":zero": { N: "0" },
				},
			}),
		);
	} catch (error) {
		console.error(error);
	}
}

/**
 * Get all messages for a chat, automatically sorted in ascending order by time.
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
				KeyConditionExpression: "chatID = :chatID",
				ExpressionAttributeValues: {
					":chatID": { S: chatID },
				},
				ProjectionExpression: "messageText, isUserA, messageTime",
				Limit: 100,
				ExclusiveStartKey: lastEvaluatedKey,
			};
			const response = await dbClient.send(new QueryCommand(params));
			if (response?.Items) {
				messages.push(
					...response.Items.map((item) => ({
						messageText: item?.messageText?.S || "",
						isUserA: !!item?.isUserA?.BOOL,
						messageTime: parseInt(item?.messageTime?.N || "0"),
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
 * @param chatsInfo
 * @returns
 */
export async function dbGetLastMessages(
	chatsInfo: { chatID: string; messageTime: number }[],
): Promise<(Message & { chatID: string })[] | null> {
	const lastMessages: (Message & { chatID: string })[] = [];
	try {
		let count = 0;
		do {
			const params: BatchGetItemCommandInput = {
				RequestItems: {
					[MESSAGES_TABLE]: {
						Keys: chatsInfo
							.slice(count, (count += 100))
							.map(({ chatID, messageTime }) => ({
								chatID: { S: chatID },
								messageTime: { N: `${messageTime}` },
							})),
						ProjectionExpression:
							"chatID, messageText, messageTime, isUserA",
					},
				},
			};
			const response = await dbClient.send(
				new BatchGetItemCommand(params),
			);
			if (response.Responses?.[MESSAGES_TABLE]?.length)
				lastMessages.push(
					...response.Responses![MESSAGES_TABLE]!.map((item) => ({
						chatID: item?.chatID?.S || "",
						messageText: item?.messageText?.S || "",
						isUserA: !!item?.isUserA?.BOOL,
						messageTime: parseInt(item?.messageTime?.N || "0"),
					})),
				);
		} while (count < chatsInfo.length);
		return lastMessages;
	} catch (error) {
		console.error(error);
		return null;
	}
}

/**
 * Store a new message inside the database. If successful, return the messageTime.
 * Try maximum 2 times to avoid weird infinite loops.
 * If the function returns -1, something is really wrong and we should abort.
 * @param chatID
 * @param messageText
 * @param messageTime
 * @param isUserA
 * @param tries
 * @returns
 */
export async function dbStoreMessage(
	chatID: string,
	messageText: string,
	messageTime: number,
	isUserA: boolean,
	tries: number = 2,
): Promise<number> {
	if (tries === 0) return -1;
	try {
		await dbClient.send(
			new PutItemCommand({
				TableName: MESSAGES_TABLE,
				Item: {
					chatID: { S: chatID },
					messageText: { S: messageText },
					messageTime: { N: `${messageTime}` },
					isUserA: { BOOL: isUserA },
				},
				// NOTE: DynamoDB checks full key, even though we only mention chatID below
				ConditionExpression: "attribute_not_exists(chatID)",
			}),
		);
		return messageTime;
	} catch (error) {
		console.error(error);
		// If concurrency issue, try again with incremented time
		if (error instanceof ConditionalCheckFailedException) {
			return await dbStoreMessage(
				chatID,
				messageText,
				messageTime + 1,
				isUserA,
				tries - 1,
			);
		}
		return -1;
	}
}
