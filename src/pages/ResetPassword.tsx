import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const schema = z
  .object({
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });

const ResetPassword = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Supabase v2 يضع توكن recovery في الـ hash ثم يسجل دخول مؤقت تلقائياً
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    // Fallback — لو الجلسة موجودة بالفعل
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    // لو مفيش hash recovery ولا جلسة بعد 1.5 ثانية، اعرض خطأ
    const t = setTimeout(() => {
      if (!ready) {
        const hash = window.location.hash;
        if (!hash.includes("type=recovery") && !hash.includes("access_token")) {
          setErrorMsg("الرابط غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.");
        }
      }
    }, 1500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ password: fd.get("password"), confirm: fd.get("confirm") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("تم تحديث كلمة المرور");
    setTimeout(() => navigate("/", { replace: true }), 1500);
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
          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-bold">تم تغيير كلمة المرور</h1>
              <p className="text-sm text-muted-foreground">جاري تحويلك...</p>
            </div>
          ) : errorMsg ? (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-bold">رابط غير صالح</h1>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">طلب رابط جديد</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold">تعيين كلمة مرور جديدة</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                أدخل كلمة المرور الجديدة لحسابك.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rp-pw">كلمة المرور الجديدة</Label>
                  <Input id="rp-pw" name="password" type="password" required minLength={6} autoComplete="new-password" disabled={!ready} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rp-pw2">تأكيد كلمة المرور</Label>
                  <Input id="rp-pw2" name="confirm" type="password" required minLength={6} autoComplete="new-password" disabled={!ready} />
                </div>
                <Button type="submit" disabled={busy || !ready} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ready ? "حفظ كلمة المرور" : "جارٍ التحقق من الرابط..."}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
