import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info, context) {
    if (err || !user) {
      console.log('❌ JWT handleRequest error:', err || info);
      throw err || new UnauthorizedException('Invalid token');
    }
    return user;
  }

  getRequest(context) {
    const request = context.switchToHttp().getRequest();
    const token = request.query.token || ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    console.log('🛂 Extracted token:', token);

    if (token) {
      request.headers.authorization = `Bearer ${token}`;
    }
    return request;
  }
}