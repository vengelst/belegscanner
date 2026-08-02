import fs from "fs/promises";
import path from "path";

// Typen fuer Storage-Provider
export interface StorageProvider {
  upload(fileName: string, data: Buffer): Promise<void>;
  download(fileName: string): Promise<Buffer>;
  delete(fileName: string): Promise<void>;
  list(): Promise<string[]>;
  exists(fileName: string): Promise<boolean>;
}

export interface LocalStorageConfig {
  type: "local";
  localPath: string;
}

export interface S3StorageConfig {
  type: "s3";
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region?: string;
}

export type StorageConfig = LocalStorageConfig | S3StorageConfig;

// Lokaler Storage-Provider
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.localPath;
  }

  private getFullPath(fileName: string): string {
    return path.join(this.basePath, fileName);
  }

  async upload(fileName: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.writeFile(this.getFullPath(fileName), data);
  }

  async download(fileName: string): Promise<Buffer> {
    return fs.readFile(this.getFullPath(fileName));
  }

  async delete(fileName: string): Promise<void> {
    try {
      await fs.unlink(this.getFullPath(fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.basePath);
      // Nur Backup-Dateien zurueckgeben (*.tar.gz oder *.sql)
      return files.filter(
        (f) => f.endsWith(".tar.gz") || f.endsWith(".sql") || f.endsWith(".sql.gz")
      );
    } catch {
      return [];
    }
  }

  async exists(fileName: string): Promise<boolean> {
    try {
      await fs.access(this.getFullPath(fileName));
      return true;
    } catch {
      return false;
    }
  }
}

// Typen fuer S3 SDK (nur fuer TypeScript)
interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}

interface S3Response {
  Body?: AsyncIterable<Uint8Array>;
  Contents?: Array<{ Key?: string }>;
}

// Hilfsfunktion zum Laden des S3 SDK (optional)
async function loadS3Module(): Promise<{
  S3Client: new (config: unknown) => S3ClientLike;
  PutObjectCommand: new (params: unknown) => unknown;
  GetObjectCommand: new (params: unknown) => unknown;
  DeleteObjectCommand: new (params: unknown) => unknown;
  ListObjectsV2Command: new (params: unknown) => unknown;
  HeadObjectCommand: new (params: unknown) => unknown;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@aws-sdk/client-s3");
  } catch {
    throw new Error(
      "AWS SDK nicht installiert. Fuer S3-Support: npm install @aws-sdk/client-s3"
    );
  }
}

// S3-kompatibler Storage-Provider (MinIO, AWS S3, etc.)
// HINWEIS: @aws-sdk/client-s3 muss separat installiert werden fuer S3-Support:
// npm install @aws-sdk/client-s3
export class S3StorageProvider implements StorageProvider {
  private config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = config;
  }

  private async getClient(): Promise<S3ClientLike> {
    const { S3Client } = await loadS3Module();
    return new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region ?? "us-east-1",
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
      forcePathStyle: true, // Fuer MinIO und aehnliche
    });
  }

  async upload(fileName: string, data: Buffer): Promise<void> {
    try {
      const { PutObjectCommand } = await loadS3Module();
      const client = await this.getClient();
      
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: fileName,
          Body: data,
          ContentType: "application/gzip",
        })
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("AWS SDK")) {
        throw error;
      }
      throw new Error(`S3-Upload fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  }

  async download(fileName: string): Promise<Buffer> {
    try {
      const { GetObjectCommand } = await loadS3Module();
      const client = await this.getClient();
      
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: fileName,
        })
      ) as S3Response;
      
      if (!response.Body) {
        throw new Error(`Datei ${fileName} nicht gefunden.`);
      }
      
      // Body als Uint8Array lesen
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof Error && error.message.includes("AWS SDK")) {
        throw error;
      }
      throw new Error(`S3-Download fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  }

  async delete(fileName: string): Promise<void> {
    try {
      const { DeleteObjectCommand } = await loadS3Module();
      const client = await this.getClient();
      
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: fileName,
        })
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("AWS SDK")) {
        throw error;
      }
      throw new Error(`S3-Delete fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  }

  async list(): Promise<string[]> {
    try {
      const { ListObjectsV2Command } = await loadS3Module();
      const client = await this.getClient();
      
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
        })
      ) as S3Response;
      
      return (response.Contents ?? [])
        .map((obj) => obj.Key ?? "")
        .filter((key) => key.length > 0);
    } catch (error) {
      if (error instanceof Error && error.message.includes("AWS SDK")) {
        throw error;
      }
      throw new Error(`S3-List fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  }

  async exists(fileName: string): Promise<boolean> {
    try {
      const { HeadObjectCommand } = await loadS3Module();
      const client = await this.getClient();
      
      await client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: fileName,
        })
      );
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("AWS SDK")) {
        throw error;
      }
      return false;
    }
  }
}

// Factory-Funktion zum Erstellen des richtigen Storage-Providers
export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.type) {
    case "local":
      return new LocalStorageProvider(config);
    case "s3":
      return new S3StorageProvider(config);
    default:
      throw new Error(`Unbekannter Storage-Typ: ${(config as StorageConfig).type}`);
  }
}
