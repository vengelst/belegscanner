import { GoogleGenAI } from "@google/genai";
import type { AiProviderInterface, ExtractionResult, AiConfig } from "../types";
import { SYSTEM_PROMPT, parseProviderError } from "../types";

function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
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

export class GoogleProvider implements AiProviderInterface {
  private client: GoogleGenAI;
  private model: string;

  constructor(config: AiConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model;
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
                text: `${SYSTEM_PROMPT}\n\n${EXTRACTION_PROMPT}`,
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

      return this.parseResponse(text);
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
                text: `${SYSTEM_PROMPT}\n\nDer folgende Text wurde per OCR aus einem Beleg extrahiert.\n\n--- OCR-TEXT ---\n${rawText}\n--- ENDE ---\n\n${EXTRACTION_PROMPT}`,
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

      return this.parseResponse(text);
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
          maxOutputTokens: 10,
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
