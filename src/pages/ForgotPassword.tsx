import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const schema = z.object({ email: z.string().trim().email("بريد إلكتروني غير صالح").max(255) });

const ForgotPassword = () => {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("تم إرسال رابط إعادة التعيين إلى بريدك");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent via-background to-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo asLink={false} size="lg" />
          </div>
        </div>

        <div className="rounded-2xl border bg-surface p-6 shadow-elevated">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-bold">تحقق من بريدك</h1>
              <p className="text-sm text-muted-foreground">
                أرسلنا رابط إعادة تعيين كلمة المرور. افتح الرسالة واضغط على الرابط لتعيين كلمة مرور جديدة.
              </p>
              <p className="text-xs text-muted-foreground">
                لم تستلم الرسالة؟ تحقق من مجلد البريد المزعج (Spam).
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth"><ArrowLeft className="ms-2 h-4 w-4" /> العودة لتسجيل الدخول</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold">نسيت كلمة المرور؟</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                أدخل بريدك وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email">البريد الإلكتروني</Label>
                  <Input id="fp-email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال رابط الإعادة"}
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/auth">العودة لتسجيل الدخول</Link>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
