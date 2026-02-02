import type { APIRoute } from "astro";
import { createSession } from "../../lib/auth";
import { timingSafeEqual } from "node:crypto";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    const jsonHeaders = { "Content-Type": "application/json" };

    try {
        const { user, password } = await request.json();

        // 🔐 Credenciales Requeridas
        const expectedUser = import.meta.env.ADMIN_USER;
        const expectedPassword = import.meta.env.ADMIN_PASSWORD;

        if (!expectedUser || !expectedPassword) {
            console.error("❌ ERROR: ADMIN_USER or ADMIN_PASSWORD not set in environment");
            return new Response(JSON.stringify({ success: false, error: "Error de configuración servidor" }), { status: 500, headers: jsonHeaders });
        }

        // Comparación segura (timing attack resistant)
        const userBuffer = Buffer.from(user ?? "");
        const expectedUserBuffer = Buffer.from(expectedUser);
        const passBuffer = Buffer.from(password ?? "");
        const expectedPassBuffer = Buffer.from(expectedPassword);

        const userMatch = userBuffer.length === expectedUserBuffer.length && timingSafeEqual(userBuffer, expectedUserBuffer);
        const passMatch = passBuffer.length === expectedPassBuffer.length && timingSafeEqual(passBuffer, expectedPassBuffer);

        if (userMatch && passMatch) {
            // ✅ Crear sesión segura
            const token = createSession(expectedUser);

            cookies.set("admin_session", token, {
                path: "/",
                httpOnly: true,
                secure: import.meta.env.PROD, // Secure in calc
                sameSite: "strict",
                maxAge: 60 * 60 * 24 // 1 día
            });

            return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ success: false, error: "Credenciales inválidas" }), { status: 401, headers: jsonHeaders });

    } catch (err: any) {
        console.error("Login Error:", err);
        return new Response(JSON.stringify({ success: false, error: "Error interno" }), { status: 500, headers: jsonHeaders });
    }
};
