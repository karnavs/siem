process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://sentrygrid:sentrygrid@localhost:5432/sentrygrid_test';
