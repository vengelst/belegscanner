import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import type { OrganizationIdentity } from "@/lib/organization";
import type { AiProviderInterface, ExtractionResult, AiConfig } from "../types";
import { parseProviderError } from "../types";
import {
  buildExtractionUserPrompt,
  buildSystemPrompt,
  normalizeExtractionResult,
} from "../organization-prompt";

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

export class AnthropicProvider implements AiProviderInterface {
  private client: Anthropic;
  private model: string;
  private organization: OrganizationIdentity | null;

  constructor(config: AiConfig, organization: OrganizationIdentity | null = null) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
    this.model = config.model;
    this.organization = organization;
  }

  private finalize(raw: ExtractionResult): ExtractionResult {
    return normalizeExtractionResult(raw, this.organization);
  }

  async analyzeDocument(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    try {
      const extractionPrompt = buildExtractionUserPrompt(this.organization);

      if (mimeType === "application/pdf") {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: buildSystemPrompt(this.organization),
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
                  text: extractionPrompt,
                },
              ],
            },
          ],
        });

        const textContent = response.content.find(isTextBlock);
        if (!textContent) {
          throw new Error("Anthropic hat keine Textantwort geliefert.");
        }

        return this.finalize(this.parseResponse(textContent.text));
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: buildSystemPrompt(this.organization),
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
                text: extractionPrompt,
              },
            ],
          },
        ],
      });

      const textContent = response.content.find(isTextBlock);
      if (!textContent) {
        throw new Error("Anthropic hat keine Textantwort geliefert.");
      }

      return this.finalize(this.parseResponse(textContent.text));
    } catch (error) {
      throw parseProviderError(error, "anthropic");
    }
  }

  async analyzeText(rawText: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: buildSystemPrompt(this.organization),
        messages: [
          {
            role: "user",
            content: `Der folgende Text wurde per OCR aus einem Beleg extrahiert.\n\n--- OCR-TEXT ---\n${rawText}\n--- ENDE ---\n\n${buildExtractionUserPrompt(this.organization)}`,
          },
        ],
      });

      const textContent = response.content.find(isTextBlock);
      if (!textContent) {
        throw new Error("Anthropic hat keine Textantwort geliefert.");
      }

      return this.finalize(this.parseResponse(textContent.text));
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
        max_tokens: 32,
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
