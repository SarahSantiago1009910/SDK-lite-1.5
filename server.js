import express from "express";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  ACCOUNT_CODE,
  createCheckoutSession,
  getPaymentMethods,
  createPayment,
  createPaymentLink,
  getNuPayPaymentConditions,
  CUSTOMER_ID,
} from "./yuno.js";
import path, { dirname } from "path";
import * as uuid from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server na raiz: __dirname = raiz do projeto
const rootDir = __dirname;
const indexPage = path.resolve(rootDir, "index.html");
const sdkLitePage = path.resolve(rootDir, "4.sdk lite 1.5", "sdk-lite.html");
const staticDirectory = path.resolve(rootDir, "2.images.png");

// Verificação na subida: garante que pastas/arquivos existem
const pathsOk = [
  [indexPage, "index.html"],
  [staticDirectory, "2.images.png (static)"],
].every(([p, label]) => {
  const ok = fs.existsSync(p);
  console.log(ok ? `[OK] ${label}` : `[FALTA] ${label} → ${p}`);
  return ok;
});
const sdkLiteOk = fs.existsSync(sdkLitePage);
if (sdkLiteOk) console.log("[OK] 4.sdk lite 1.5/sdk-lite.html"); else console.log("[FALTA] 4.sdk lite 1.5/sdk-lite.html");
if (!pathsOk) {
  console.error("Alguns caminhos não existem. Verifique index.html e 2.images.png na raiz.");
}
console.log("indexPage (GET /) =", indexPage);

const app = express();

app.use(express.json());

// ========================================
// MIDDLEWARE DE LOGGING - Mostra todos os requests e responses
// ========================================
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  
  // Log do REQUEST
  console.log('\n' + '='.repeat(60));
  console.log(`[${timestamp}] 📥 REQUEST`);
  console.log('='.repeat(60));
  console.log(`➡️  ${req.method} ${req.url}`);
  console.log(`📍 IP: ${req.ip || req.connection.remoteAddress}`);
  
  if (Object.keys(req.query).length > 0) {
    console.log(`🔎 Query Params:`, req.query);
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Capturar o response
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    console.log('\n' + '-'.repeat(60));
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] 📤 RESPONSE`);
    console.log('-'.repeat(60));
    console.log(`⬅️  Status: ${res.statusCode}`);
    console.log(`📦 Data:`, JSON.stringify(data, null, 2));
    console.log('='.repeat(60) + '\n');
    return originalJson(data);
  };
  
  next();
});

app.use("/static", express.static(staticDirectory));

app.get("/", (req, res, next) => {
  if (!fs.existsSync(indexPage)) {
    console.error("GET / → arquivo não existe:", indexPage);
    return next(new Error("index.html não encontrado em 1.html/index.html"));
  }
  res.sendFile(indexPage, (err) => {
    if (err) {
      console.error("GET / sendFile error:", err.message, "path:", indexPage);
      next(err);
    }
  });
});

app.get("/sdk-lite.html", (req, res, next) => {
  res.sendFile(sdkLitePage, (err) => {
    if (err) {
      console.error("GET /sdk-lite.html sendFile error:", err.message, "path:", sdkLitePage);
      next(err);
    }
  });
});

// Endpoint que cria a session de checkout (padrão: BR / BRL)
app.post("/checkout/sessions", async (req, res) => {
  const body = req.body || {};
  const country = body.country || "BR";
  const currency = body.currency || "BRL";
  const amountValue = body.amount != null ? body.amount : 2000; // BRL: centavos (2000 = R$ 20,00)

  const order = {
    account_id: ACCOUNT_CODE,
    merchant_order_id: `order-${Date.now()}`, // único por request (evita INVALID_CHECKOUT_SESSION)
    payment_description: "Pigeonz Street Wear - Checkout",
    country,
    amount: {
      value: amountValue,
      currency,
    },
  };
  if (CUSTOMER_ID) order.customer_id = CUSTOMER_ID;

  try {
    const response = await createCheckoutSession(order);
    const sessionId = response?.checkout_session ?? response?.data?.checkout_session ?? response?.id;
    if (!sessionId) {
      return res.status(400).json({
        error: "Sessão inválida",
        message: response?.messages?.[0] || response?.message || "Checkout session vazia ou inválida.",
        hint: "Verifique .env: ACCOUNT_CODE, CUSTOMER_ID, API_URL (sandbox), e se a conta Yuno está habilitada para BR/BRL.",
        ...response,
      });
    }
    res.json({
      checkout_session: sessionId,
      country: response.country ?? country,
      currency: response.amount?.currency ?? currency,
      ...response,
    });
  } catch (err) {
    const status = err.status >= 400 ? err.status : 502;
    const body = err.body || {};
    console.error("createCheckoutSession error:", err.message, body);
    res.status(status).json({
      error: "Erro ao criar sessão",
      message: err.message,
      code: err.code || body.code,
      messages: body.messages,
      hint: "Confira .env (ACCOUNT_CODE, CUSTOMER_ID, PUBLIC_API_KEY, PRIVATE_SECRET_KEY, API_URL) e Dashboard Yuno para BR/BRL.",
      ...body,
    });
  }
});

// Novo checkout session: BR / BRL (amount em centavos, ex: 2000 = R$ 20,00)
app.post("/checkout/sessions/br", async (req, res) => {
  const order = {
    account_id: ACCOUNT_CODE,
    merchant_order_id: "1655401222",
    payment_description: "Test BR checkout",
    country: "BR",
    customer_id: CUSTOMER_ID,
    amount: {
      value: 2000,
      currency: "BRL",
    },
  };

  try {
    const response = await createCheckoutSession(order);
    if (response?.checkout_session) {
      res.json(response);
    } else {
      res.status(400).json({ error: "Sessão BR rejeitada", message: response?.messages?.[0] || response?.message, ...response });
    }
  } catch (err) {
    console.error("createCheckoutSession US error:", err);
    res.status(502).json({ error: "Erro ao criar sessão BR", message: err.message });
  }
});

// Endpoint que cria o pagamento com a yuno (BR / BRL).
app.post("/payments", async (req, res) => {
  const country = "BR";
  const currency = "BRL";
  const amount = 2000; // centavos (R$ 20,00)
  const oneTimeToken = req.body.oneTimeToken;
  const checkoutSession = req.body.checkoutSession;
  const paymentMethodType = req.body.paymentMethodType || "CARD"; // Dynamic payment method
  const nuPayData = req.body.nuPayData; // NuPay specific data

  const documentNumber = (req.body.documentNumber || "35104075397").replace(/\D/g, "").slice(0, 11); // CPF

  const payment = {
    description: "Pigeonz Street Wear - Payment",
    account_id: ACCOUNT_CODE,
    merchant_order_id: "1655401222",
    country,
    amount: {
      currency,
      value: amount,
    },
    checkout: {
      session: checkoutSession,
    },
    customer_payer: {
      billing_address: {
        address_line_1: "123 Example St",
        address_line_2: "Apt 502",
        city: "New York",
        country,
        state: "NY",
        zip_code: "10001",
      },
      shipping_address: {
        address_line_1: "123 Example St",
        address_line_2: "Apt 502",
        city: "New York",
        country,
        state: "NY",
        zip_code: "10001",
      },
      document: {
        document_type: "CPF",
        document_number: documentNumber,
      },
      id: CUSTOMER_ID,
      nationality: "BR",
    },
    payment_method: {
      type: paymentMethodType,
      token: oneTimeToken,
      vaulted_token: null,
    },
  };

  // Add NuPay specific fields if present
  if (nuPayData && paymentMethodType === "NU_PAY") {
    payment.payment_method.detail = {
      nupay: {
        funding_source: nuPayData.fundingSource,
        installments: nuPayData.installments,
        authorization_type: nuPayData.authorizationType,
      },
    };
  }

  // Add installments for CARD payments if provided
  if (req.body.installments && paymentMethodType === "CARD") {
    payment.payment_method.detail = {
      card: {
        installments: req.body.installments,
        installments_type: req.body.installmentsType || "MERCHANT",
      },
    };
  }

  // Add metadata for CARD payments (BR)
  if (paymentMethodType === "CARD") {
    payment.metadata = [
      { key: "cpf", value: documentNumber || "13842438605" },
      { key: "type", value: "card" },
    ];
  }

  // PayPal Wallet (Yuno Payment type PAYPAL — workflow REDIRECT + callback_url)
  const isPayPal = paymentMethodType === "PAYPAL" || paymentMethodType === "PAYPAL_WALLET" || paymentMethodType === "PAY_PAL";
  if (isPayPal) {
    payment.payment_method.type = "PAYPAL";
    payment.payment_method.detail = { paypal: {} };
    payment.workflow = "REDIRECT";
    payment.callback_url = process.env.BASE_URL
      ? `${process.env.BASE_URL.replace(/\/$/, "")}/payment-success?provider=paypal`
      : `${req.protocol}://${req.get("host")}/payment-success?provider=paypal`;
    payment.metadata = [
      { key: "payment_method", value: "paypal" },
      { key: "type", value: "wallet" },
    ];
  }

  const idempotencyKey = uuid.v4();
  let response;
  try {
    response = await createPayment(idempotencyKey, payment);
  } catch (err) {
    console.error("Yuno createPayment error:", err);
    return res.status(502).json({
      error: "Erro ao chamar API Yuno",
      message: err.message,
      checkout_session_id: checkoutSession,
    });
  }

  if (response?.code || response?.error || response?.messages) {
    const yunoMessage = response?.messages?.[0] || response?.message || response?.error;
    console.error("Yuno payment rejected:", { checkout_session_id: checkoutSession, response });
    return res.status(400).json({
      error: "Pagamento rejeitado",
      message: yunoMessage,
      checkout_session_id: checkoutSession,
      yuno: response,
    });
  }

  // PayPal (wallet REDIRECT): expor redirect_url no top level para o front redirecionar
  if (isPayPal && !response.redirect_url) {
    const pm = response.payment_method ?? response.data?.payment_method;
    const detail = pm?.payment_method_detail ?? pm?.detail;
    const wallet = detail?.wallet ?? detail?.paypal;
    response.redirect_url =
      response.data?.redirect_url ||
      pm?.redirect_url ||
      detail?.redirect_url ||
      wallet?.redirect_url ||
      detail?.paypal?.redirect_url ||
      response.approval_url ||
      pm?.approval_url ||
      response.checkout_url;
  }

  res.json(response);
});

app.get("/payment-methods/:checkoutSession", async (req, res) => {
  const checkoutSession = req.params.checkoutSession;
  const paymentMethods = await getPaymentMethods(checkoutSession);
  res.json(paymentMethods);
});

// PayPal redirect: cria sessão + payment REDIRECT; retorna redirect_url (fallback: Payment Link)
app.post("/payments/paypal/redirect", async (req, res) => {
  const sendJson = (status, body) => {
    res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
  };
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/payment-success?provider=paypal`;
    const amount = req.body?.amount ?? 2000;
    const currency = req.body?.currency || "BRL";
    const merchantOrderId = `order-paypal-${Date.now()}`;

    const order = {
      account_id: ACCOUNT_CODE,
      merchant_order_id: merchantOrderId,
      payment_description: "Pagamento PayPal - Pigeonz Street Wear",
      country: "BR",
      customer_id: CUSTOMER_ID,
      amount: { value: amount, currency },
    };
    const sessionResponse = await createCheckoutSession(order);
    const checkoutSession =
      sessionResponse?.checkout_session ?? sessionResponse?.id ?? sessionResponse?.data?.checkout_session;
    if (!checkoutSession) {
      return sendJson(400, { success: false, error: "Falha ao criar checkout session", fullResponse: sessionResponse });
    }

    const payment = {
      description: "Pigeonz Street Wear - PayPal",
      account_id: ACCOUNT_CODE,
      merchant_order_id: merchantOrderId,
      country: "BR",
      amount: { currency, value: amount },
      checkout: { session: checkoutSession },
      payment_method: { type: "PAYPAL", detail: { paypal: {} } },
      callback_url: callbackUrl,
      workflow: "REDIRECT",
      customer_payer: {
        id: CUSTOMER_ID,
        document: { document_type: "CPF", document_number: "35104075397" },
        nationality: "BR",
      },
    };
    const idempotencyKey = uuid.v4();
    const paymentResponse = await createPayment(idempotencyKey, payment);

    if (paymentResponse?.code || paymentResponse?.error) {
      return sendJson(400, {
        success: false,
        error: paymentResponse?.messages || paymentResponse?.message || "Erro ao criar pagamento PayPal",
        fullResponse: paymentResponse,
      });
    }

    const pm = paymentResponse?.payment_method ?? paymentResponse?.data?.payment_method;
    const pmDetail = pm?.payment_method_detail ?? pm?.detail;
    const wallet = pmDetail?.wallet ?? pmDetail?.paypal;
    let redirectUrl =
      paymentResponse?.redirect_url ||
      paymentResponse?.data?.redirect_url ||
      pm?.redirect_url ||
      pmDetail?.redirect_url ||
      wallet?.redirect_url ||
      pmDetail?.paypal?.redirect_url ||
      paymentResponse?.approval_url ||
      pm?.approval_url ||
      paymentResponse?.checkout_url;

    if (!redirectUrl) {
      try {
        const amountValue = typeof amount === "number" && amount >= 100 ? amount / 100 : amount;
        const linkPayload = {
          account_id: ACCOUNT_CODE,
          merchant_order_id: `paypal-${Date.now()}`,
          description: "Pagamento PayPal - Pigeonz Street Wear",
          country: "BR",
          amount: { value: amountValue, currency },
          payment_method_types: ["PAYPAL"],
        };
        let linkResponse = await createPaymentLink(linkPayload);
        if (linkResponse?.code || linkResponse?.error) {
          linkResponse = await createPaymentLink({
            ...linkPayload,
            payment_method_types: ["CARD", "PIX", "BOLETO", "PAYPAL"],
            merchant_order_id: `paypal-${Date.now()}`,
          });
        }
        redirectUrl = linkResponse?.checkout_url || linkResponse?.payment_link || linkResponse?.url || linkResponse?.link;
      } catch (e) {
        console.error("PayPal fallback Payment Link error:", e);
      }
    }
    if (redirectUrl) {
      return sendJson(200, { success: true, redirect_url: redirectUrl });
    }
    return sendJson(500, { success: false, error: "Yuno não retornou redirect_url", fullResponse: paymentResponse });
  } catch (error) {
    console.error("PayPal redirect error:", error);
    return sendJson(500, { success: false, error: "Erro ao iniciar PayPal", details: error?.message || String(error) });
  }
});

// Payment Link Endpoint - Gera link de pagamento automaticamente (retorna checkout_url)
app.post("/payment-link", async (req, res) => {
  try {
    const productName = req.body.productName || "Urban Textures T-Shirt";
    const productAmount = req.body.amount != null ? Number(req.body.amount) : 20.00;
    const currency = req.body.currency || "BRL";
    const payment_method_types = Array.isArray(req.body.payment_method_types) && req.body.payment_method_types.length > 0
      ? req.body.payment_method_types
      : ["CARD", "PIX", "BOLETO"];

    const merchantOrderId = `ORDER-${Date.now()}`;

    const paymentLinkData = {
      account_id: ACCOUNT_CODE,
      merchant_order_id: merchantOrderId,
      description: `Payment ${productName} - Pigeonz Street Wear`,
      country: "BR",
      amount: { value: productAmount, currency },
      payment_method_types,
    };

    console.log("Creating Payment Link:", JSON.stringify(paymentLinkData, null, 2));

    let response = await createPaymentLink(paymentLinkData);

    console.log("Payment Link response:", JSON.stringify(response, null, 2));

    if (response.code || response.error) {
      return res.status(400).json({
        success: false,
        error: response.messages || response.message || "Erro ao criar link",
        fullResponse: response,
      });
    }

    // Retorna o link gerado
    res.json({
      success: true,
      paymentLink: response.checkout_url || response.payment_link || response.url || response.link,
      linkId: response.id,
      amount: productAmount,
      currency: currency,
      productName: productName,
      fullResponse: response,
    });
  } catch (error) {
    console.error("Payment Link error:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao gerar link de pagamento",
      details: error.message,
    });
  }
});

// Página de sucesso do pagamento
app.get("/payment-success", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pagamento Realizado</title>
      <style>
        body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .success { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .success h1 { color: #4CAF50; }
        .success a { color: #333; text-decoration: none; background: #f0f0f0; padding: 10px 20px; border-radius: 5px; display: inline-block; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="success">
        <h1>✓ Pagamento Realizado!</h1>
        <p>Obrigado pela sua compra.</p>
        <a href="/">Voltar para a loja</a>
      </div>
    </body>
    </html>
  `);
});

// NuPay Payment Conditions Endpoint
app.post("/nupay/payment-conditions", async (req, res) => {
  const { amount, document } = req.body;

  try {
    // Simulating NuPay Payment Conditions API call
    // In production, this would call SpinPay API
    const paymentConditions = await getNuPayPaymentConditions(amount, document);
    res.json(paymentConditions);
  } catch (error) {
    console.error("NuPay Payment Conditions error:", error);
    res.status(400).json({
      status: 400,
      message: "Payment options not available",
      details: {},
    });
  }
});

// Garante que erros não tratados retornem JSON (evita "resposta inválida" no front)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).setHeader("Content-Type", "application/json").end(
      JSON.stringify({
        success: false,
        error: "Erro interno do servidor",
        details: err?.message || String(err),
      })
    );
  }
});

// Roda minha API (Sobe o Web Server) — porta 8082; 0.0.0.0 para aceitar conexões de qualquer interface
const SERVER_PORT = Number(process.env.PORT) || 8082;
app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`Server is running at: http://localhost:${SERVER_PORT}`);
  console.log(`Também acessível em: http://127.0.0.1:${SERVER_PORT}`);
});
