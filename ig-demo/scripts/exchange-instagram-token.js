import { exchangeForLongLivedToken } from "./instagram-token.js";

const token = await exchangeForLongLivedToken();
console.log(`Long-lived Instagram token stored; expires at ${token.expiresAt}.`);
