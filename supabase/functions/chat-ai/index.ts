import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_USER_ID = "00000000-0000-0000-0000-00000000a1a1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ تأكد من المتغيرات
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return json({ error: "Missing Supabase env config" }, 500);
    }

    if (!LOVABLE_API_KEY) {
      return json({ error: "AI gateway not configured" }, 500);
    }

    // ✅ التحقق من المستخدم
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } =
      await userClient.auth.getUser();

    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;

    // ✅ قراءة البيانات
    const body = await req.json();
    const conversationId = body.conversation_id;
    const userMessage = (body.message ?? "").toString().trim();

    if (!conversationId || !userMessage) {
      return json({ error: "Invalid input" }, 400);
    }

    if (userMessage.length > 4000) {
      return json({ error: "Message too long" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ✅ الرد الثابت
    const FIXED_REPLY = `اسم رئيس الشركة: الأستاذ سيد أبوبكر عبدالله

رئيس المبرمجين: عبدالرحمن سيد أبوبكر عبدالله

📞 واتساب: 01121259071
📞 هاتف: 01007654158

📍 العنوان:
قرية القطوري - العياط - الجيزة`;

    const normalized = userMessage.toLowerCase();

    const KEYWORDS = [
      "تايبينج",
      "تايبنج",
      "من أنشأ",
      "مين عمل",
      "رقم",
      "العنوان",
      "contact",
      "address",
      "who created",
    ];

    const matched = KEYWORDS.some((k) =>
      normalized.includes(k.toLowerCase())
    );

    // ✅ تحقق من المحادثة
    const { data: conv } = await admin
      .from("conversations")
      .select("user1_id,user2_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv) {
      return json({ error: "Conversation not found" }, 404);
    }

    const members = [conv.user1_id, conv.user2_id];

    if (!members.includes(userId) || !members.includes(AI_USER_ID)) {
      return json({ error: "Not AI chat" }, 403);
    }

    // ✅ حفظ رسالة المستخدم (مع حماية)
    try {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: userMessage,
      });
    } catch (e) {
      console.log("Save user message failed:", e.message);
    }

    // ✅ الرد الثابت
    if (matched) {
      try {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: AI_USER_ID,
          content: FIXED_REPLY,
        });
      } catch (e) {
        console.log("Save fixed reply failed:", e.message);
      }

      return json({ reply: FIXED_REPLY }, 200);
    }

    // ✅ جلب الرسائل السابقة
    const { data: history } = await admin
      .from("messages")
      .select("sender_id,content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const chatMessages = (history ?? [])
      .reverse()
      .map((m) => ({
        role: m.sender_id === AI_USER_ID ? "assistant" : "user",
        content: m.content,
      }));

    // ✅ AI
    let reply = "⚠️ AI not available";

    try {
      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: chatMessages,
          }),
        }
      );

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        reply =
          aiData.choices?.[0]?.message?.content ??
          "No response from AI";
      }
    } catch (e) {
      console.log("AI error:", e.message);
    }

    // ✅ حفظ رد AI
    try {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: AI_USER_ID,
        content: reply,
      });
    } catch (e) {
      console.log("Save AI failed:", e.message);
    }

    return json({ reply }, 200);
  } catch (e) {
    console.error("ERROR:", e);
    return json({ error: e.message || "Server error" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
