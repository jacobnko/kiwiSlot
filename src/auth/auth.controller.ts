import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
// Type-only import: AuthUser is used purely as a type in a decorated signature.
import type { AuthUser } from './types/jwt-payload';

@Controller('auth') // -> /api/v1/auth (global prefix applied)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) // Login is not a resource creation, so return 200 not 201.
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Protected route: proves the JWT round-trip works end to end.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
