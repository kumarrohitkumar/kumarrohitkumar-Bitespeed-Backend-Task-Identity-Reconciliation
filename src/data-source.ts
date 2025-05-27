import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entity/User';
import dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // required for some cloud providers, remove if local
  synchronize: true,  // auto create tables, good for dev only
  logging: false,
  entities: [User],
  migrations: [],
  subscribers: [],
});
