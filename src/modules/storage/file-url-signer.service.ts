import { Injectable } from "@nestjs/common";
import { S3StorageService } from "./storage.service";
import {
  FILE_URL_FIELD_NAMES,
  DEFAULT_SIGNED_URL_EXPIRES_IN,
} from "./storage.constants";

const FILE_URL_FIELD_SET = new Set<string>(FILE_URL_FIELD_NAMES);

@Injectable()
export class FileUrlSignerService {
  constructor(private readonly storage: S3StorageService) {}

  async signResponseBody<T>(
    body: T,
    expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRES_IN,
  ): Promise<T> {
    if (body == null) return body;
    if (Array.isArray(body)) {
      return (await Promise.all(
        body.map((item) => this.signResponseBody(item, expiresInSeconds)),
      )) as T;
    }
    if (typeof body !== "object") return body;
    if (
      body instanceof Date ||
      body instanceof RegExp ||
      Buffer.isBuffer(body)
    ) {
      return body;
    }
    const keys = Object.keys(body);
    const isPlainObject = body.constructor?.name === "Object";
    const hasFileUrlField = keys.some((k) => FILE_URL_FIELD_SET.has(k));
    if (!isPlainObject && !hasFileUrlField) return body;

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (FILE_URL_FIELD_SET.has(key) && value != null) {
        if (Array.isArray(value)) {
          out[key] = await Promise.all(
            value.map((item) =>
              typeof item === "string"
                ? this.storage.getSignedUrlForStoredValue(
                    item,
                    expiresInSeconds,
                  )
                : item,
            ),
          );
        } else if (typeof value === "string") {
          out[key] = await this.storage.getSignedUrlForStoredValue(
            value,
            expiresInSeconds,
          );
        } else {
          out[key] = await this.signResponseBody(value, expiresInSeconds);
        }
      } else {
        out[key] = await this.signResponseBody(value, expiresInSeconds);
      }
    }
    return out as T;
  }
}
