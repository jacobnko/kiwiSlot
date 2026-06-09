import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

// Unit tests for the booking-conflict logic. PrismaService is mocked, so these run
// without a database and focus purely on the service's decision-making.
describe('BookingsService (double-booking logic)', () => {
  let service: BookingsService;

  // The transaction client the service receives inside prisma.$transaction(cb).
  let tx: {
    $queryRaw: jest.Mock;
    customer: { findFirst: jest.Mock };
    booking: { findFirst: jest.Mock; create: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };

  const businessId = 'biz-1';
  const dto: CreateBookingDto = {
    serviceId: 'svc-1',
    customerId: 'cust-1',
    startTime: '2026-07-01T09:00:00.000Z',
  };
  const start = new Date('2026-07-01T09:00:00.000Z');
  const end = new Date('2026-07-01T09:30:00.000Z'); // 30-minute service

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn(),
      customer: { findFirst: jest.fn() },
      booking: { findFirst: jest.fn(), create: jest.fn() },
    };
    // $transaction just runs the callback with our fake tx client.
    prisma = {
      $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
    };
    service = new BookingsService(prisma as unknown as PrismaService);
  });

  it('creates a CONFIRMED booking and derives endTime from the service duration', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'svc-1', durationMinutes: 30 }]);
    tx.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    tx.booking.findFirst.mockResolvedValue(null); // no overlap
    tx.booking.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'bk-1', ...data }),
    );

    const result = await service.create(businessId, dto);

    expect(tx.booking.create).toHaveBeenCalledWith({
      data: {
        businessId,
        serviceId: 'svc-1',
        customerId: 'cust-1',
        startTime: start,
        endTime: end, // start + 30 min
        status: BookingStatus.CONFIRMED,
      },
    });
    expect(result).toMatchObject({ status: BookingStatus.CONFIRMED });
  });

  it('checks overlap with a half-open window (startTime < end AND endTime > start)', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'svc-1', durationMinutes: 30 }]);
    tx.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    tx.booking.findFirst.mockResolvedValue(null);
    tx.booking.create.mockResolvedValue({ id: 'bk-1' });

    await service.create(businessId, dto);

    expect(tx.booking.findFirst).toHaveBeenCalledWith({
      where: {
        serviceId: 'svc-1',
        status: BookingStatus.CONFIRMED,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
  });

  it('throws ConflictException when an overlapping CONFIRMED booking exists', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'svc-1', durationMinutes: 30 }]);
    tx.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    tx.booking.findFirst.mockResolvedValue({ id: 'existing-booking' }); // overlap!

    await expect(service.create(businessId, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the service is not in the caller business', async () => {
    tx.$queryRaw.mockResolvedValue([]); // FOR UPDATE matched nothing

    await expect(service.create(businessId, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the customer is not in the caller business', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'svc-1', durationMinutes: 30 }]);
    tx.customer.findFirst.mockResolvedValue(null);

    await expect(service.create(businessId, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.booking.create).not.toHaveBeenCalled();
  });
});
