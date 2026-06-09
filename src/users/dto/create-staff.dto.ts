import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body for POST /api/v1/users — an OWNER creates a STAFF user in their business.
// Note: there is no businessId here; it always comes from the authenticated OWNER's token.
export class CreateStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
