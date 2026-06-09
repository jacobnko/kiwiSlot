import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Body for POST /api/v1/auth/register — creates a Business and its first OWNER user.
export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  businessName: string;

  @IsEmail()
  email: string;

  // bcrypt only hashes the first 72 bytes, so cap the password length there.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName?: string;
}
