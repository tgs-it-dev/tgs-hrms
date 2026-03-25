declare module 'express-basic-auth' {
  import { RequestHandler } from 'express';

  interface Options {
    users: Record<string, string>;
    challenge?: boolean;
    realm?: string;
  }

  function basicAuth(options: Options): RequestHandler;
  export default basicAuth;
}
