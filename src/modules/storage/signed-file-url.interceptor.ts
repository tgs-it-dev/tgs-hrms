import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, from } from "rxjs";
import { switchMap } from "rxjs/operators";
import { FileUrlSignerService } from "./file-url-signer.service";

/**
 * Replaces S3 file URL fields in the response body with signed URLs so the frontend can load files (avoids 403).
 */
@Injectable()
export class SignedFileUrlInterceptor implements NestInterceptor {
  constructor(private readonly fileUrlSigner: FileUrlSignerService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      switchMap((data) => from(this.fileUrlSigner.signResponseBody(data))),
    );
  }
}
