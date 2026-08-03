import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import type { AiProviderInterface, ExtractionResult, AiConfig } from "../types";
import { SYSTEM_PROMPT, parseProviderError } from "../types";

function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === "text";
}

function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

function getMimeType(mimeType: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (supportedTypes.includes(mimeType)) {
    return mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }
  return "image/jpeg";
}

const EXTRACTION_PROMPT = `Extrahiere die Daten aus dem Beleg und gib sie als JSON zurueck. Das JSON muss exakt diesem Schema entsprechen:
{
  "supplier": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": string | null (YYYY-MM-DD),
  "dueDate": string | null (YYYY-MM-DD),
  "serviceDate": string | null (YYYY-MM-DD),
  "time": string | null,
  "currency": string | null (ISO 4217),
  "grossAmount": number | null,
  "netAmount": number | null,
  "taxAmount": number | null,
  "paymentMethod": "cash" | "visa" | "mastercard" | "credit_card" | "debit_card" | "paypal" | "sepa" | "bank_transfer" | "unknown" | null,
  "cardLastDigits": string | null,
  "location": string | null,
  "countryCode": string | null,
  "countryName": string | null,
  "documentType": "general" | "fuel" | "hospitality" | "lodging" | "parking" | "toll" | null,
  "lineItems": [{ "description": string, "quantity": number | null, "unit": string | null, "unitPrice": number | null, "totalPrice": number | null, "taxHint": string | null }],
  "warnings": string[]
}

Gib NUR das JSON zurueck, ohne Markdown-Formatierung oder zusaetzlichen Text.`;

export class AnthropicProvider implements AiProviderInterface {
  private client: Anthropic;
  private model: string;

  constructor(config: AiConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
    this.model = config.model;
  }

  async analyzeDocument(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    try {
      if (mimeType === "application/pdf") {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: toBase64(buffer),
                  },
                },
                {
                  type: "text",
                  text: EXTRACTION_PROMPT,
                },
              ],
            },
          ],
        });

        const textContent = response.content.find(isTextBlock);
        if (!textContent) {
          throw new Error("Anthropic hat keine Textantwort geliefert.");
        }

        return this.parseResponse(textContent.text);
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: getMimeType(mimeType),
                  data: toBase64(buffer),
                },
              },
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find(isTextBlock);
      if (!textContent) {
        throw new Error("Anthropic hat keine Textantwort geliefert.");
      }

      return this.parseResponse(textContent.text);
    } catch (error) {
      throw parseProviderError(error, "anthropic");
    }
  }

  async analyzeText(rawText: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Der folgende Text wurde per OCR aus einem Beleg extrahiert.\n\n--- OCR-TEXT ---\n${rawText}\n--- ENDE ---\n\n${EXTRACTION_PROMPT}`,
          },
        ],
      });

      const textContent = response.content.find(isTextBlock);
      if (!textContent) {
        throw new Error("Anthropic hat keine Textantwort geliefert.");
      }

      return this.parseResponse(textContent.text);
    } catch (error) {
      throw parseProviderError(error, "anthropic");
    }
  }

  private parseResponse(text: string): ExtractionResult {
    let jsonText = text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    return JSON.parse(jsonText) as ExtractionResult;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "Antworte nur mit dem Wort 'OK'.",
          },
        ],
      });

      const textContent = response.content.find(isTextBlock);
      if (textContent) {
        return { success: true, message: `Verbindung erfolgreich. Modell: ${this.model}` };
      }

      return { success: false, message: "Keine Antwort vom Modell erhalten." };
    } catch (error) {
      const aiError = parseProviderError(error, "anthropic");
      return { success: false, message: aiError.userMessage };
    }
  }
}
