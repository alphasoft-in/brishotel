import type { APIRoute } from "astro";
import { db } from "../../lib/db";

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  const jsonHeaders = { "Content-Type": "application/json" };

  try {
    const requestUrl = new URL(request.url);
    const room = requestUrl.searchParams.get("room") || "Reserva";
    const price = requestUrl.searchParams.get("price") || "0";
    const email = requestUrl.searchParams.get("email") || "cliente@brishotel.com";
    const firstName = requestUrl.searchParams.get("firstName") || "Huésped";
    const lastName = requestUrl.searchParams.get("lastName") || "Bris Hotel";
    const dni = requestUrl.searchParams.get("dni") || "";
    const phone = requestUrl.searchParams.get("phone") || "";

    if (!price || price === "0") {
      return new Response(JSON.stringify({ success: false, error: "Precio no válido" }), { status: 400, headers: jsonHeaders });
    }

    // 🔐 Credenciales v4 Estándar
    const USER = import.meta.env.IZIPAY_USER;
    const MODE = import.meta.env.IZIPAY_MODE || "TEST";

    // Seleccionar contraseña según el modo
    const PASSWORD = MODE === "PRODUCTION"
      ? import.meta.env.IZIPAY_PASSWORD_PROD
      : import.meta.env.IZIPAY_PASSWORD;

    const API_URL = import.meta.env.IZIPAY_API_URL || "https://api.micuentaweb.pe";

    const auth = Buffer.from(`${USER}:${PASSWORD}`).toString("base64");
    const orderId = `RES-${Date.now()}`;
    const amountCents = Math.round(Number(price) * 100);

    const payload = {
      amount: amountCents,
      currency: "PEN",
      orderId: orderId,
      customer: {
        email: email,
        billingDetails: {
          firstName: firstName,
          lastName: lastName,
          phoneNumber: phone,
          identityCode: dni
        }
      },
      formAction: "PAYMENT",
      paymentConfig: "SINGLE",
      captureMode: "AUTOMATIC",
      mode: MODE,
    };

    console.log(`🚀 Izipay Request [${orderId}]:`, {
      url: `${API_URL}/api-payment/V4/Charge/CreatePayment`,
      mode: MODE,
      user: USER,
      payload
    });

    const izipayResponse = await fetch(`${API_URL}/api-payment/V4/Charge/CreatePayment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await izipayResponse.text();
    console.log(`📥 Izipay Response [${orderId}] (${izipayResponse.status}):`, responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: "Error en formato de respuesta de Izipay",
        detail: responseText.substring(0, 200)
      }), { status: 502, headers: jsonHeaders });
    }

    if (izipayResponse.ok && data?.status === "SUCCESS" && data?.answer?.formToken) {
      // 📝 Registrar en la DB local
      try {
        // Guardamos datos estructurados del cliente
        const clientData = JSON.stringify({
          firstName,
          lastName,
          email,
          dni,
          phone
        });

        await db.addTransaction({
          id: `tx-${Date.now()}`,
          orderId: orderId,
          roomName: room,
          amount: Number(price),
          customer: clientData,
          status: 'INICIADO', // Cambiado de PENDIENTE para no generar alerta prematura
          timestamp: new Date().toISOString()
        });

      } catch (dbErr) {
        console.error("❌ DB Error:", dbErr);
      }

      return new Response(JSON.stringify({
        success: true,
        formToken: data.answer.formToken,
        orderId: orderId
      }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({
      success: false,
      error: data?.webService || "Error de Izipay",
      detail: data
    }), { status: 400, headers: jsonHeaders });

  } catch (err: any) {
    console.error("❌ API Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
  }
};
