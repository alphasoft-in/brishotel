import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET_KEY = import.meta.env.SECRET_KEY || "default_unsafe_secret_CHANGE_ME_IN_PROD";
const SESSION_DURATION = 60 * 60 * 24 * 1000; // 24 hours

export interface SessionPayload {
    user: string;
    exp: number;
}

export function createSession(user: string): string {
    const payload: SessionPayload = {
        user,
        exp: Date.now() + SESSION_DURATION
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', SECRET_KEY).update(data).digest('base64url');

    return `${data}.${signature}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
    if (!token) return null;

    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSignature = createHmac('sha256', SECRET_KEY).update(data).digest('base64url');

    if (signature !== expectedSignature) return null;

    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;

        if (Date.now() > payload.exp) {
            return null; // Expired
        }

        return payload;
    } catch (e) {
        return null;
    }
}
