import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Apply with @UseGuards(JwtAuthGuard) to require a valid JWT on a route.
// 'jwt' refers to the JwtStrategy registered in the AuthModule.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
