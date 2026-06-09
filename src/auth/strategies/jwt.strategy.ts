import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '../types/jwt-payload';

// Validates incoming JWTs on protected routes.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Read the token from the "Authorization: Bearer <token>" header.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Passport calls this after verifying the signature/expiry. Whatever we return
  // becomes request.user. We only trust claims that were signed into the token.
  validate(payload: JwtPayload): AuthUser {
    return {
      userId: payload.sub,
      businessId: payload.businessId,
      role: payload.role,
      email: payload.email,
    };
  }
}
