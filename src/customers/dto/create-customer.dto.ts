import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Body for POST /api/v1/customers. businessId comes from the token, not the body.
export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
