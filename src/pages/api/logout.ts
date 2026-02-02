import type { APIRoute } from "astro";

const jsonHeaders = { "Content-Type": "application/json" };

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
    cookies.delete("admin_session", { path: "/" });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
};
