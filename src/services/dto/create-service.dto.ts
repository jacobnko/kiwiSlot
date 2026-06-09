import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Body for POST /api/v1/services. No businessId — it comes from the OWNER's token.
export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // Length of the appointment in minutes; used to derive a booking's end time.
  @IsInt()
  @Min(1)
  @Max(1440) // at most 24h
  durationMinutes: number;

  // Money: up to 2 decimal places, non-negative (0 allows a free service).
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;
}
