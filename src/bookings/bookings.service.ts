import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a CONFIRMED booking, preventing double-booking under concurrency.
  //
  // Strategy: pessimistic lock. Inside one transaction we SELECT ... FOR UPDATE the
  // Service row, which serializes all concurrent booking attempts for that service —
  // a second request blocks until the first commits, then sees the new booking and is
  // rejected. The check-then-insert is therefore race-free.
  async create(businessId: string, dto: CreateBookingDto) {
    const startTime = new Date(dto.startTime);

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the service row. Scoping by businessId also blocks booking another
      //    tenant's service (a cross-tenant foreign key would otherwise leak here).
      const services = await tx.$queryRaw<
        Array<{ id: string; durationMinutes: number }>
      >`SELECT id, "durationMinutes" FROM "Service"
        WHERE id = ${dto.serviceId} AND "businessId" = ${businessId}
        FOR UPDATE`;
      const service = services[0];
      if (!service) {
        throw new NotFoundException('Service not found');
      }

      // 2. The customer must belong to the same business too.
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, businessId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // 3. The booking length equals the service's duration.
      const endTime = new Date(
        startTime.getTime() + service.durationMinutes * MS_PER_MINUTE,
      );

      // 4. Overlap test against CONFIRMED bookings for this service:
      //    two half-open intervals overlap iff startA < endB AND startB < endA.
      const conflict = await tx.booking.findFirst({
        where: {
          serviceId: dto.serviceId,
          status: BookingStatus.CONFIRMED,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflict) {
        throw new ConflictException(
          'This service is already booked for an overlapping time',
        );
      }

      // 5. Safe to insert — the lock is held until this transaction commits.
      return tx.booking.create({
        data: {
          businessId,
          serviceId: dto.serviceId,
          customerId: dto.customerId,
          startTime,
          endTime,
          status: BookingStatus.CONFIRMED,
        },
      });
    });
  }

  // List bookings in the caller's business, optionally filtered by service and/or day.
  findAll(businessId: string, query: ListBookingsQueryDto) {
    const where: Prisma.BookingWhereInput = { businessId };

    if (query.serviceId) {
      where.serviceId = query.serviceId;
    }
    if (query.date) {
      // UTC day window [date 00:00, next day 00:00).
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      where.startTime = {
        gte: dayStart,
        lt: new Date(dayStart.getTime() + MS_PER_DAY),
      };
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        service: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });
  }

  // Cancel a booking. Cancelling frees the slot, since only CONFIRMED bookings count
  // toward the overlap check. Idempotent: cancelling an already-cancelled booking is a no-op.
  async cancel(businessId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }
}
