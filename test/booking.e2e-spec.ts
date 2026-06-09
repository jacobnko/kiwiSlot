import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// End-to-end tests for the auth + booking flows against the real (Docker) database.
// Each run uses a unique owner email and deletes its own business afterwards.
describe('Auth + Booking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdBusinessIds: string[] = [];
  const ownerEmail = `owner_${Date.now()}@e2e.test`;
  const password = 'supersecret';

  let token: string;
  let serviceId: string;
  let customerId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the production bootstrap (src/main.ts) so routes + validation match.
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdBusinessIds.length > 0) {
      await prisma.business.deleteMany({
        where: { id: { in: createdBusinessIds } },
      });
    }
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('registers a business + owner and returns a JWT', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ businessName: 'E2E Biz', email: ownerEmail, password, ownerName: 'E2E' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('OWNER');
    token = res.body.accessToken;
    createdBusinessIds.push(res.body.user.businessId);
  });

  it('logs in with the same credentials', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects login with a wrong password', () =>
    http()
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: 'wrong-password' })
      .expect(401));

  it('creates a service and a customer (OWNER)', async () => {
    const svc = await http()
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Haircut', durationMinutes: 30, price: 25 })
      .expect(201);
    serviceId = svc.body.id;

    const cust = await http()
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe' })
      .expect(201);
    customerId = cust.body.id;
  });

  it('creates a booking (happy path)', () =>
    http()
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId, customerId, startTime: '2026-07-01T09:00:00.000Z' })
      .expect(201));

  it('rejects an overlapping booking with 409 (double-booking prevention)', () =>
    http()
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId, customerId, startTime: '2026-07-01T09:15:00.000Z' })
      .expect(409));

  it('allows an adjacent booking (half-open intervals)', () =>
    http()
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId, customerId, startTime: '2026-07-01T09:30:00.000Z' })
      .expect(201));

  it('prevents double-booking under concurrency (exactly one of N parallel wins)', async () => {
    // A fresh service isolates this from the bookings created above.
    const svc = await http()
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Massage', durationMinutes: 60, price: 80 })
      .expect(201);

    const payload = {
      serviceId: svc.body.id,
      customerId,
      startTime: '2026-08-01T14:00:00.000Z',
    };
    const parallel = 6;

    const statuses = await Promise.all(
      Array.from({ length: parallel }, () =>
        http()
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send(payload)
          .then((r) => r.status),
      ),
    );

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(parallel - 1);
  });
});
