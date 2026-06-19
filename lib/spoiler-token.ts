import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const secret =
  process.env.SPOILER_TOKEN_SECRET ??
  "paimon-demo-local-secret-change-me-in-production";

interface TokenPayload {
  questionHash: string;
  expiresAt: number;
  nonce: string;
}

function signature(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function hashQuestion(question: string) {
  return createHmac("sha256", secret)
    .update(question.trim().toLowerCase())
    .digest("base64url");
}

export function createSpoilerToken(question: string) {
  const payload: TokenPayload = {
    questionHash: hashQuestion(question),
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: randomBytes(8).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifySpoilerToken(token: string, question: string) {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return false;
  const expected = signature(encoded);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as TokenPayload;
    return (
      payload.expiresAt > Date.now() &&
      payload.questionHash === hashQuestion(question)
    );
  } catch {
    return false;
  }
}
