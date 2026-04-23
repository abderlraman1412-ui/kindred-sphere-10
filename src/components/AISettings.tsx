import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const AISettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("ai_enabled,ai_daily_limit")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setEnabled((data as any).ai_enabled ?? true);
        setLimit((data as any).ai_daily_limit ?? 20);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({ ai_enabled: enabled, ai_daily_limit: Math.max(1, Math.min(1000, limit)) } as any)
      .eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("AI settings saved ✓");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> TAIPING AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enable AI assistant</p>
                <p className="text-xs text-muted-foreground">Allow users to chat with TAIPING AI</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-limit">Daily message limit per user</Label>
              <Input
                id="ai-limit"
                type="number"
                min={1}
                max={1000}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Each user can send up to this many AI messages per day.</p>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save AI settings"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
