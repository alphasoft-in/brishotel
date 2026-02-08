import type { APIRoute } from "astro";
import { createSession } from "../../lib/auth";
import { supabase } from "../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    const jsonHeaders = { "Content-Type": "application/json" };

    try {
        const { user, password } = await request.json();

        if (!user || !password) {
            return new Response(JSON.stringify({ success: false, error: "Credenciales faltantes" }), { status: 400, headers: jsonHeaders });
        }

        // 🔐 Autenticación con Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: user, // Asumimos que el "usuario" es el email en Supabase
            password: password,
        });

        if (error || !data.user) {
            console.error("Login Auth Error:", error?.message);
            return new Response(JSON.stringify({ success: false, error: "Credenciales inválidas" }), { status: 401, headers: jsonHeaders });
        }

        // ✅ Crear sesión segura (usamos el ID del usuario de Supabase)
        const token = createSession(data.user.id);

        cookies.set("admin_session", token, {
            path: "/",
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: "strict",
            maxAge: 60 * 60 * 24 // 1 día
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });

    } catch (err: any) {
        console.error("Login Error:", err);
        return new Response(JSON.stringify({ success: false, error: "Error interno" }), { status: 500, headers: jsonHeaders });
    }
};
