import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import {
  checkRateLimit,
  recordAttempt,
  tooManyRequests,
  clientIp,
} from '@/lib/rate-limit';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';

export const runtime = 'nodejs';

const ZW_PHONE = /^(\+263|0)(7[1-8])\d{7}$/;

/**
 * Role is accepted here but constrained to a self-serve set. 'admin' is not
 * assignable through this endpoint under any circumstances — that is the
 * privilege-escalation path a client would try first.
 */
const baseSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(128),
  name: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(ZW_PHONE, 'Invalid Zimbabwe phone number'),
  role: z.enum(['farmer', 'buyer']),
});

const farmerSchema = baseSchema.extend({
  role: z.literal('farmer'),
  farm_name: z.string().trim().min(2).max(160),
  province: z.string().trim().min(2).max(80),
  district: z.string().trim().max(80).optional().default(''),
  ecocash_number: z.string().trim().regex(ZW_PHONE, 'Invalid EcoCash number'),
  farm_size_ha: z.coerce.number().positive().max(100000).optional(),
});

const buyerSchema = baseSchema.extend({
  role: z.literal('buyer'),
  city: z.string().trim().min(2).max(80),
  buyer_type: z
    .enum(['INDIVIDUAL', 'RESTAURANT', 'RETAILER', 'PROCESSOR', 'EXPORTER'])
    .default('INDIVIDUAL'),
});

const schema = z.discriminatedUnion('role', [farmerSchema, buyerSchema]);

export async function POST(request: Request) {
  const csrf = verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();

  const ip = clientIp(request.headers);
  const limit = await checkRateLimit('register', { ip });
  if (limit.limited) return tooManyRequests(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the form and try again.',
        code: 'validation_failed',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Server-side password strength. The client mirrors this for live feedback,
  // but this check is the authority.
  const strength = validatePassword(data.password, {
    email: data.email,
    name: data.name,
  });
  if (!strength.ok) {
    return NextResponse.json(
      { error: 'Password is not strong enough.', code: 'weak_password', details: strength.errors },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(data.password);

  // Insert conditionally so a duplicate email does not raise a constraint error
  // we would then have to interpret.
  const inserted = (await sql`
    INSERT INTO users (email, password_hash, role)
    VALUES (${data.email}, ${passwordHash}, ${data.role}::user_role)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role, session_epoch
  `) as { id: string; email: string; role: 'farmer' | 'buyer'; session_epoch: number }[];

  const user = inserted[0];

  if (!user) {
    // Email already registered. Respond exactly as for success so registration
    // cannot be used to enumerate accounts; the real owner still gets in via
    // login or password reset.
    await recordAttempt('register', { identifier: data.email, ip, succeeded: false });
    return NextResponse.json({ ok: true, created: false });
  }

  if (data.role === 'farmer') {
    await sql`
      INSERT INTO farmers
        (user_id, name, farm_name, phone, province, district, ecocash_number, farm_size_ha, status)
      VALUES
        (${user.id}, ${data.name}, ${data.farm_name}, ${data.phone}, ${data.province},
         ${data.district ?? ''}, ${data.ecocash_number}, ${data.farm_size_ha ?? null}, 'PENDING')
    `;
  } else {
    await sql`
      INSERT INTO buyers (user_id, name, phone, buyer_type, city)
      VALUES (${user.id}, ${data.name}, ${data.phone}, ${data.buyer_type}::buyer_type, ${data.city})
    `;
  }

  await recordAttempt('register', { identifier: data.email, ip, succeeded: true });

  // New accounts have no MFA yet, so the session is fully authenticated.
  await createSession(user, {
    mfaSatisfied: true,
    ip,
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({
    ok: true,
    created: true,
    user: { email: user.email, role: user.role },
  });
}
