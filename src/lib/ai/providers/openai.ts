import OpenAI from "openai";
import type { OrganizationIdentity } from "@/lib/organization";
import type { AiProviderInterface, ExtractionResult, AiConfig } from "../types";
import { EXTRACTION_JSON_SCHEMA, parseProviderError } from "../types";
import { buildSystemPrompt, normalizeExtractionResult } from "../organization-prompt";

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export class OpenAIProvider implements AiProviderInterface {
  private client: OpenAI;
  private model: string;
  private organization: OrganizationIdentity | null;

  constructor(config: AiConfig, organization: OrganizationIdentity | null = null) {
    this.client = new OpenAI({
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
      const documentInput: OpenAI.Responses.ResponseInputContent = mimeType === "application/pdf"
        ? {
            type: "input_file",
            filename: "document.pdf",
            file_data: toDataUrl(buffer, "application/pdf"),
          }
        : {
            type: "input_image",
            image_url: toDataUrl(buffer, mimeType),
            detail: "high",
          };

      const response = await this.client.responses.create({
        model: this.model,
        input: [
          { role: "system", content: buildSystemPrompt(this.organization) },
          {
            role: "user",
            content: [
              documentInput,
              {
                type: "input_text",
                text: "Lies den Beleg aus und gib nur die strukturierten Daten gemaess Schema zurueck.",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "receipt_extraction",
            schema: EXTRACTION_JSON_SCHEMA,
            strict: true,
          },
        },
      });

      const outputText = response.output
        .find((item) => item.type === "message")
        ?.content.find((content) => content.type === "output_text")
        ?.text;

      if (!outputText) {
        throw new Error("OpenAI hat keine strukturierte Antwort geliefert.");
      }

      return this.finalize(JSON.parse(outputText) as ExtractionResult);
    } catch (error) {
      throw parseProviderError(error, "openai");
    }
  }

  async analyzeText(rawText: string): Promise<ExtractionResult> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: [
          { role: "system", content: buildSystemPrompt(this.organization) },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Der folgende Text wurde per OCR aus einem Beleg extrahiert. Lies ihn aus und gib nur die strukturierten Daten gemaess Schema zurueck.\n\n--- OCR-TEXT ---\n${rawText}\n--- ENDE ---`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "receipt_extraction",
            schema: EXTRACTION_JSON_SCHEMA,
            strict: true,
          },
        },
      });

      const outputText = response.output
        .find((item) => item.type === "message")
        ?.content.find((content) => content.type === "output_text")
        ?.text;

      if (!outputText) {
        throw new Error("OpenAI hat keine strukturierte Antwort geliefert.");
      }

      return this.finalize(JSON.parse(outputText) as ExtractionResult);
    } catch (error) {
      throw parseProviderError(error, "openai");
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: [
          {
            role: "user",
            content: "Antworte nur mit dem Wort 'OK'.",
          },
        ],
        max_output_tokens: 32,
      });

      const outputText = response.output
        .find((item) => item.type === "message")
        ?.content.find((content) => content.type === "output_text")
        ?.text;

      if (outputText) {
        return { success: true, message: `Verbindung erfolgreich. Modell: ${this.model}` };
      }

      return { success: false, message: "Keine Antwort vom Modell erhalten." };
    } catch (error) {
      const aiError = parseProviderError(error, "openai");
      return { success: false, message: aiError.userMessage };
    }
  }
}
