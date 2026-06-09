import { IsOptional, IsUUID, Matches } from 'class-validator';

// Optional query filters for GET /api/v1/bookings.
export class ListBookingsQueryDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  // A single day, YYYY-MM-DD. Matched against startTime using UTC day boundaries.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date?: string;
}
