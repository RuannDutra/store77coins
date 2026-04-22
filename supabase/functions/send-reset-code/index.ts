import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cria código (RPC retorna nada se email não existe — mas respondemos sucesso por segurança)
    const { data, error } = await supabase.rpc("create_password_reset_code", { _email: email });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.code) {
      // Email não existe — retornamos erro específico para o frontend exibir mensagem
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Envia email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY não configurada");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a0a0a;color:#fff;border-radius:12px;">
        <h1 style="color:#facc15;margin:0 0 16px;">77 Coins</h1>
        <p style="color:#ddd;font-size:14px;">Você solicitou a redefinição da sua senha. Use o código abaixo:</p>
        <div style="font-size:42px;font-weight:bold;letter-spacing:12px;text-align:center;background:#1a1a1a;padding:24px;border-radius:8px;color:#facc15;margin:24px 0;">
          ${row.code}
        </div>
        <p style="color:#999;font-size:12px;">Este código expira em 15 minutos. Se você não solicitou, ignore este email.</p>
      </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "77 Coins <onboarding@resend.dev>",
        to: [email],
        subject: `Código de redefinição: ${row.code}`,
        html,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Resend error:", txt);
      throw new Error("Falha ao enviar email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message ?? "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
