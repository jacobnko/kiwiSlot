import { IsDateString, IsUUID } from 'class-validator';

// Body for POST /api/v1/bookings.
// The booking length is derived from the service's durationMinutes, so the client
// only sends the start time. businessId comes from the token.
export class CreateBookingDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  customerId: string;

  // ISO 8601 timestamp, e.g. "2026-07-01T09:00:00.000Z".
  @IsDateString()
  startTime: string;
}
