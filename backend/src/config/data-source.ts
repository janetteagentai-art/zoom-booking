import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Professor, ZoomAccount, Booking } from '../entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'janette',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'zoom_booking',
  synchronize: process.env.NODE_ENV === 'development', // only dev!
  logging: process.env.NODE_ENV === 'development',
  entities: [Professor, ZoomAccount, Booking],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
