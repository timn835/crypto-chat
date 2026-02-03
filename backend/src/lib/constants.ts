export const COOKIE_NAME = "__crypto-chat-dev";
export const COOKIE_OPTIONS =
	process.env.ENV === "DEV"
		? {
				secure: false,
				sameSite: "lax" as boolean | "lax" | "none" | "strict",
			}
		: {
				secure: true,
				domains: ".insight-hawk.com",
				sameSite: "none" as boolean | "lax" | "none" | "strict",
				partitioned: true,
			};
export const STANDARD_COOKIE_OPTIONS = {
	path: "/",
	httpOnly: true,
	priority: "medium" as "medium" | "low" | "high",
	maxAge: 3122064000, // 60*60*24*365*99 = 99 years
};
