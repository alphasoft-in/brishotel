import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    // 🔹 Leer datos enviados desde el front
    const { room, price } = await request.json();
    if (!room || !price) {
      return new Response(JSON.stringify({ success: false, error: "Faltan datos (room o price)" }), { status: 400 });
    }

    // 🔐 Credenciales de TEST
    const USER = "73731983";
    const PASSWORD = "testpassword_r6UvwcwsOAbnv2KplTdpDcCgvJVU1pdC7QytfmfYQ52g6";
    const AUTH = Buffer.from(`${USER}:${PASSWORD}`).toString("base64");

    // 🔹 Crear el pago en modo test
    const response = await fetch("https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${AUTH}`,
      },
      body: JSON.stringify({
        amount: price * 100, // Izipay usa centavos
        currency: "PEN",
        orderId: `reserva_${Date.now()}`,
        customer: {
          email: "cliente@prueba.com",
        },
        formAction: "PAYMENT",
        paymentConfig: "SINGLE",
        captureMode: "AUTOMATIC",
        mode: "TEST", // 👈 aseguramos modo test
      }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON de Izipay:", text);
      return new Response(JSON.stringify({ success: false, error: "Respuesta no JSON de Izipay", raw: text }), {
        status: 500,
      });
    }

    if (data?.answer?.formToken && data?.answer?.shopUrl) {
      return new Response(
        JSON.stringify({
          success: true,
          formToken: data.answer.formToken,
          paymentUrl: data.answer.shopUrl,
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Error en respuesta de Izipay", raw: data }), {
      status: 400,
    });
  } catch (error) {
    console.error("❌ Error general en /api/payment:", error);
    return new Response(JSON.stringify({ success: false, error: "Error en el servidor" }), { status: 500 });
  }
};
