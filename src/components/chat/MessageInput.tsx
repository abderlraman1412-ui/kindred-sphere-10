import { useRef, useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile, ImageIcon, Send, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const EMOJIS = ["😀","😂","😍","🥰","😎","😭","😡","👍","👏","🙏","🔥","❤️","💯","🎉","🤔","😴","✅","❌","💀","🥳","😇","🤝","👀","💪"];

interface Props {
  conversationId: string;
  onSend: (payload: { content?: string; image_url?: string }) => Promise<void>;
  onTyping: () => void;
  disableImage?: boolean;
  placeholder?: string;
  sending?: boolean;
}

export const MessageInput = ({ conversationId, onSend, onTyping, disableImage, placeholder, sending: externalSending }: Props) => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [internalSending, setInternalSending] = useState(false);
  const sending = externalSending || internalSending;
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed && !imageUrl) return;
    setInternalSending(true);
    try {
      await onSend({ content: trimmed || undefined, image_url: imageUrl || undefined });
      setText("");
      setImagePreview(null);
      setImageUrl(null);
    } finally {
      setInternalSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5 MB");
      return;
    }
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${conversationId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) {
      toast.error(error.message);
      setImagePreview(null);
    } else {
      const { data: signedData, error: signError } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signError || !signedData?.signedUrl) {
        toast.error("Failed to get image URL");
        setImagePreview(null);
      } else {
        setImageUrl(signedData.signedUrl);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const insertEmoji = (emoji: string) => setText((t) => t + emoji);

  return (
    <div className="border-t bg-surface p-2 sm:p-3">
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg border" />
          <button
            onClick={() => { setImagePreview(null); setImageUrl(null); }}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
          {uploading && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-primary" />}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        {!disableImage && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Attach image"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost" aria-label="Emoji">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => insertEmoji(e)}
                  className="rounded p-1 text-lg transition-colors hover:bg-muted"
                >{e}</button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); onTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type a message"}
          rows={1}
          className="min-h-10 max-h-32 resize-none"
          disabled={sending}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={sending || uploading || (!text.trim() && !imageUrl)}
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
