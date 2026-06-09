import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a service owned by the caller's business.
  create(businessId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: { ...dto, businessId },
    });
  }

  // List all services in the caller's business (tenant-scoped).
  findAll(businessId: string) {
    return this.prisma.service.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Fetch one service, but only if it belongs to the caller's business.
  // Filtering by businessId means another tenant's id returns 404, not 403,
  // so we don't reveal that the row exists.
  async findOne(businessId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, businessId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  // Update only after confirming ownership.
  async update(businessId: string, id: string, dto: UpdateServiceDto) {
    await this.findOne(businessId, id); // throws 404 if not owned
    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  // Delete only after confirming ownership. Business rule: a service with active
  // (CONFIRMED) bookings cannot be deleted, so we don't silently cascade-delete live
  // appointments. Cancel or let them pass first.
  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id); // throws 404 if not owned

    const activeBookings = await this.prisma.booking.count({
      where: { serviceId: id, status: BookingStatus.CONFIRMED },
    });
    if (activeBookings > 0) {
      throw new ConflictException(
        'Cannot delete a service that has confirmed bookings',
      );
    }

    await this.prisma.service.delete({ where: { id } });
    return { id };
  }
}
