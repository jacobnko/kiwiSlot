import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceDto } from './create-service.dto';

// Every field becomes optional, so PATCH can update a subset (validation rules carry over).
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
