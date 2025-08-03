
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  const { planId, planName, amount, userId, userName, userEmail } = await request.json();

  if (!planId || !amount || !userId || !userEmail) {
    return NextResponse.json({ error: 'Dados do pedido ausentes ou inválidos.' }, { status: 400 });
  }

  const pagbankToken = process.env.PAGBANK_ACCESS_TOKEN;
  if (!pagbankToken) {
    console.error("PagBank token not configured.");
    return NextResponse.json({ error: 'Erro de configuração do servidor de pagamento.' }, { status: 500 });
  }

  // Use userEmail as a fallback for name to ensure it's never "N/A"
  const customerName = userName && userName.trim() !== "" && userName.trim().toLowerCase() !== 'n/a' ? userName : userEmail;


  const body = {
    customer: {
      name: customerName,
      email: userEmail,
      tax_id: "71143407105" // Placeholder - PagBank requires a tax_id
    },
    items: [
      {
        name: `Plano ${planName} - STUDIO PECC`,
        quantity: 1,
        unit_amount: Math.round(amount * 100) // Amount in cents
      }
    ],
    qr_codes: [
      {
        amount: {
          value: Math.round(amount * 100)
        },
      }
    ],
    notification_urls: [
      // TODO: Add a webhook URL to receive payment status updates from PagBank
      // e.g., `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/pagbank`
    ]
  };

  try {
    const response = await fetch("https://sandbox.api.pagseguro.com/orders", { // Using Sandbox URL for tests
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${pagbankToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("PagBank API Error:", errorData);
        // Return a more descriptive error based on PagBank's response
        const errorMessage = errorData.error_messages?.[0]?.description || 'Falha ao comunicar com o gateway de pagamento.';
        return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();

    if (!data.qr_codes || data.qr_codes.length === 0) {
        return NextResponse.json({ error: 'Não foi possível gerar o QR Code PIX.' }, { status: 500 });
    }

    const pixData = {
        qr_code_text: data.qr_codes[0].text,
        qr_code_url: data.qr_codes[0].links.find((link: any) => link.rel === 'QRCODE.PNG')?.href,
    };

    // You could also save the order ID `data.id` in your database
    // associated with the user to check the status later.

    return NextResponse.json(pixData);

  } catch (error: any) {
    console.error("Internal Server Error:", error);
    return NextResponse.json({ error: 'Ocorreu um erro inesperado.' }, { status: 500 });
  }
}
