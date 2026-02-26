import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// Variaveis de Ambiente
const API_URL = process.env.API_URL;
export const ACCOUNT_CODE = process.env.ACCOUNT_CODE;
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY;
const PRIVATE_SECRET_KEY = process.env.PRIVATE_SECRET_KEY;
// export const CUSTOMER_ID = "0f255b41-c076-455e-8c96-8702fe7d51f6";
export const CUSTOMER_ID = "7ab03456-833c-4c8d-8a83-833b777363c6";

// ========================================
// FUNÇÃO DE LOG - Mostra request/response da API Yuno
// ========================================
function logYunoApi(name, method, url, requestBody, response, responseData) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log('\n' + '🌐'.repeat(30));
  console.log(`[${timestamp}] 🌐 YUNO API - ${name}`);
  console.log('🌐'.repeat(30));
  console.log(`📍 ${method} ${url}`);
  if (requestBody) {
    console.log('📤 REQUEST:', JSON.stringify(requestBody, null, 2));
  }
  console.log('📥 STATUS:', response.status, response.statusText);
  console.log('📥 RESPONSE:', JSON.stringify(responseData, null, 2));
  console.log('🌐'.repeat(30) + '\n');
}

// ========================================
// CREATE CUSTOMER
// ========================================
async function createCustomer(customer) {
  const url = `${API_URL}/v1/customers`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "public-api-key": PUBLIC_API_KEY,
      "private-secret-key": PRIVATE_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(customer),
  });
  
  const responseData = await response.json();
  logYunoApi('CREATE CUSTOMER', 'POST', url, customer, response, responseData);
  
  return responseData;
}

// ========================================
// CREATE CHECKOUT SESSION
// ========================================
export async function createCheckoutSession(order) {
  const url = `${API_URL}/v1/checkout/sessions`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "public-api-key": PUBLIC_API_KEY,
      "private-secret-key": PRIVATE_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  const responseData = await response.json();
  logYunoApi('CREATE CHECKOUT SESSION', 'POST', url, order, response, responseData);

  if (!response.ok) {
    const err = new Error(responseData?.messages?.[0] || responseData?.message || response.statusText);
    err.status = response.status;
    err.code = responseData?.code;
    err.body = responseData;
    throw err;
  }

  return responseData;
}

// ========================================
// CREATE PAYMENT
// ========================================
export async function createPayment(idempotencyKey, payment) {
  const url = `${API_URL}/v1/payments`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "public-api-key": PUBLIC_API_KEY,
      "private-secret-key": PRIVATE_SECRET_KEY,
      "X-idempotency-key": idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payment),
  });

  const responseData = await response.json();
  logYunoApi('CREATE PAYMENT', 'POST', url, { idempotencyKey, ...payment }, response, responseData);
  
  return responseData;
}

// ========================================
// GET PAYMENT METHODS
// ========================================
export async function getPaymentMethods(checkoutSession) {
  const url = `${API_URL}/v1/checkout/sessions/${checkoutSession}/payment-methods`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "public-api-key": PUBLIC_API_KEY,
      "private-secret-key": PRIVATE_SECRET_KEY,
      "Content-Type": "application/json",
    },
  });
  
  const responseData = await response.json();
  logYunoApi('GET PAYMENT METHODS', 'GET', url, null, response, responseData);
  
  return responseData;
}

// ========================================
// CREATE PAYMENT LINK
// ========================================
export async function createPaymentLink(paymentLinkData) {
  const url = `${API_URL}/v1/payment-links`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "public-api-key": PUBLIC_API_KEY,
      "private-secret-key": PRIVATE_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentLinkData),
  });

  const responseData = await response.json();
  logYunoApi('CREATE PAYMENT LINK', 'POST', url, paymentLinkData, response, responseData);
  
  return responseData;
}

// NuPay Payment Conditions - Mock implementation
// In production, this would integrate with SpinPay API
export async function getNuPayPaymentConditions(amount, document) {
  // Mock response simulating NuPay Payment Conditions API
  return [
    {
      type: "debit",
      installmentPlans: [
        {
          amount: amount,
          number: 1
        }
      ]
    },
    {
      type: "credit",
      installmentPlans: [
        {
          amount: amount,
          number: 1
        },
        {
          amount: amount / 2,
          number: 2
        },
        {
          amount: amount / 3,
          number: 3,
          interest: 0.05,
          interestAmount: amount * 0.05,
          iof: amount * 0.008,
          iofPercentage: 0.008,
          totalAmount: amount * 1.08,
          cet: 0.88
        }
      ]
    },
    {
      type: "credit_with_additional_limit",
      amount: amount,
      additionalLimitMessage: "Não consome o limite do cartão",
      installmentPlans: [
        {
          amount: amount * 1.01,
          interestAmount: amount * 0.02,
          number: 1,
          interest: 0.0499,
          iof: amount * 0.0038,
          iofPercentage: 0.0055,
          cet: 0.939,
          totalAmount: amount * 1.039
        }
      ]
    }
  ];
}
