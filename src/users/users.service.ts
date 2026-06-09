import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { hashPassword } from '../common/security/password';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';

// Fields safe to return to clients — never the passwordHash.
const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // List every user in the caller's business. Tenant isolation = the where clause.
  listStaff(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId },
      select: publicUserSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Create a STAFF user. businessId is the caller's (from the token), so a new user
  // can only ever be added to the OWNER's own business.
  async createStaff(businessId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: Role.STAFF,
        businessId,
      },
      select: publicUserSelect,
    });
  }
}
