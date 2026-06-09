import { IsEmail, IsString } from 'class-validator';

// Body for POST /api/v1/auth/login.
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
