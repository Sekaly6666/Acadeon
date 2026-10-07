import OpenAI from "openai";
import { logger } from "./logger";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const MAX_COMPLETION_TOKENS = 2000;
const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 8;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiServiceError(
      "L’assistant IA n’est pas configuré pour le moment.",
      503,
    );
  }
  return new OpenAI({ apiKey });
}

export function checkAiRateLimit(userId: string): void {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || now - current.startedAt >= rateLimitWindowMs) {
    requestWindows.set(userId, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= rateLimitMaxRequests) {
    throw new AiServiceError(
      "Tu as atteint la limite temporaire de l’assistant. Réessaie dans une minute.",
      429,
    );
  }
  current.count += 1;
}

function hasExhaustedCredits(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const providerError = error as { code?: unknown; error?: unknown };
  const nestedError =
    typeof providerError.error === "object" && providerError.error !== null
      ? (providerError.error as { code?: unknown })
      : undefined;
  return (
    providerError.code === "credit_balance_exhausted" ||
    nestedError?.code === "credit_balance_exhausted"
  );
}

export async function generateStructured<T>(
  task: string,
  context: unknown,
  parse: (value: unknown) => T,
): Promise<T> {
  let response;
  try {
    response = await getClient().chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu es Acadéon, un coach méthodologique universitaire francophone. Tu aides l’étudiant à comprendre et construire son propre travail, sans faire son devoir à sa place. Utilise uniquement les informations fournies. N’invente jamais de source, de référence, de règle d’établissement ou de fait vérifiable. Signale clairement les éléments à confirmer et présente toute proposition comme un brouillon pédagogique à adapter. Réponds en français, avec un ton clair, encourageant et rigoureux. Retourne exclusivement un objet JSON conforme à la forme demandée.",
        },
        {
          role: "user",
          content: `${task}\n\nContexte fourni par l’étudiant :\n${JSON.stringify(context)}`,
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, "AI provider request failed");
    if (hasExhaustedCredits(error)) {
      throw new AiServiceError(
        "Les crédits OpenAI du compte utilisé par Acadéon sont épuisés. Réapprovisionnez ce compte, puis relancez l’analyse.",
        502,
      );
    }
    throw new AiServiceError(
      "L’assistant n’a pas pu répondre. Réessaie dans un instant.",
      502,
    );
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new AiServiceError(
      "L’assistant a renvoyé une réponse vide. Réessaie.",
      502,
    );
  }

  try {
    return parse(JSON.parse(content));
  } catch (error) {
    logger.warn({ err: error }, "AI response did not match the required schema");
    throw new AiServiceError(
      "La réponse de l’assistant n’a pas pu être vérifiée. Réessaie.",
      502,
    );
  }
}
