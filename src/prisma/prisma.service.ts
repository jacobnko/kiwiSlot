import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Wraps the generated Prisma Client as an injectable Nest provider.
// Extending PrismaClient means we can call this.user, this.booking, etc. directly.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // Open the database connection once the module is initialized.
  async onModuleInit() {
    await this.$connect();
  }
}
