import { SetMetadata } from '@nestjs/common';

export const BUILDING_KEY = 'requireBuilding';
export const RequireBuilding = () => SetMetadata(BUILDING_KEY, true);
