import { GoogleGenAI } from "@google/genai";
import type { OrganizationIdentity } from "@/lib/organization";
import type { AiProviderInterface, ExtractionResult, AiConfig } from "../types";
import { parseProviderError } from "../types";
import {
  buildExtractionUserPrompt,
  buildSystemPrompt,
  normalizeExtractionResult,
} from "../organization-prompt";

function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export class GoogleProvider implements AiProviderInterface {
  private client: GoogleGenAI;
  private model: string;
  private organization: OrganizationIdentity | null;

  constructor(config: AiConfig, organization: OrganizationIdentity | null = null) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model;
    this.organization = organization;
  }

  private finalize(raw: ExtractionResult): ExtractionResult {
    return normalizeExtractionResult(raw, this.organization);
  }

  async analyzeDocument(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: toBase64(buffer),
                },
              },
              {
                text: `${buildSystemPrompt(this.organization)}\n\n${buildExtractionUserPrompt(this.organization)}`,
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 4096,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Google hat keine Textantwort geliefert.");
      }

      return this.finalize(this.parseResponse(text));
    } catch (error) {
      throw parseProviderError(error, "google");
    }
  }

  async analyzeText(rawText: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${buildSystemPrompt(this.organization)}\n\nDer folgende Text wurde per OCR aus einem Beleg extrahiert.\n\n--- OCR-TEXT ---\n${rawText}\n--- ENDE ---\n\n${buildExtractionUserPrompt(this.organization)}`,
              },
            ],
          },
        ],
        config: {
          maxOutputTokens: 4096,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Google hat keine Textantwort geliefert.");
      }

      return this.finalize(this.parseResponse(text));
    } catch (error) {
      throw parseProviderError(error, "google");
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
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [{ text: "Antworte nur mit dem Wort 'OK'." }],
          },
        ],
        config: {
          maxOutputTokens: 32,
        },
      });

      if (response.text) {
        return { success: true, message: `Verbindung erfolgreich. Modell: ${this.model}` };
      }

      return { success: false, message: "Keine Antwort vom Modell erhalten." };
    } catch (error) {
      const aiError = parseProviderError(error, "google");
      return { success: false, message: aiError.userMessage };
    }
  }
}
