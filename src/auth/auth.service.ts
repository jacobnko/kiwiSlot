import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload';

// Cost factor for bcrypt. Higher = slower = harder to brute-force. 12 is a good default.
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // Register a new Business together with its first OWNER user.
  async register(dto: RegisterDto) {
    // 1. Reject duplicate emails up front (email is the global login key).
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    // 2. Never store the raw password — hash it (bcrypt embeds a per-user salt).
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // 3. Create the Business and its first OWNER atomically: if the user insert
    //    fails, the business insert is rolled back too.
    const user = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: dto.businessName },
      });

      return tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.ownerName,
          role: Role.OWNER,
          businessId: business.id,
        },
      });
    });

    // 4. Issue a token so the client is logged in immediately after registering.
    return this.buildAuthResponse(user);
  }

  // Verify credentials and return a fresh token.
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Use the same generic message whether the email or the password is wrong,
    // so we don't reveal which emails exist.
    const passwordOk =
      user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  // Sign a JWT and shape the public response (never leak the password hash).
  private buildAuthResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      email: user.email,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
      },
    };
  }
}
