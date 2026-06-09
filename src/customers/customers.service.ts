import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a customer owned by the caller's business.
  create(businessId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { ...dto, businessId },
    });
  }

  // List all customers in the caller's business (tenant-scoped).
  findAll(businessId: string) {
    return this.prisma.customer.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
