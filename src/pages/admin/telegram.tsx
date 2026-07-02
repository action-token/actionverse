import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/utils/api";
import { Button } from "~/components/shadcn/ui/button";
import { Input } from "~/components/shadcn/ui/input";
import { Label } from "~/components/shadcn/ui/label";
import { Switch } from "~/components/shadcn/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/shadcn/ui/card";
import { Skeleton } from "~/components/shadcn/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/shadcn/ui/alert";
import AdminLayout from "~/components/layout/root/AdminLayout";
import { Loader2, Send, CheckCircle2, AlertTriangle, Eye, EyeOff, SendHorizonal } from "lucide-react";
import toast from "react-hot-toast";

const TelegramConfigSchema = z.object({
    // Optional — leave blank to keep the existing token on the server.
    botToken: z.string().optional(),
    chatId: z.string().min(1, "Chat id is required"),
    enabled: z.boolean(),
});

type TelegramConfigInput = z.infer<typeof TelegramConfigSchema>;

export default function TelegramAdminPage() {
    return (
        <AdminLayout>
            <Card className="w-full">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        <CardTitle>Telegram Broadcast</CardTitle>
                    </div>
                    <CardDescription>
                        Configure a Telegram bot to automatically announce newly-created bounties to a channel or group.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <TelegramConfigForm />
                </CardContent>
            </Card>
        </AdminLayout>
    );
}

function TelegramConfigForm() {
    const config = api.admin.telegram.get.useQuery();
    const upsert = api.admin.telegram.upsert.useMutation({
        onSuccess: () => toast.success("Telegram configuration saved"),
        onError: (err) => toast.error(err.message ?? "Failed to save"),
    });
    const sendTest = api.admin.telegram.test.useMutation({
        onSuccess: () => toast.success("Test message sent — check your Telegram channel"),
        onError: (err) => toast.error(err.message ?? "Failed to send test message"),
    });

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isDirty },
    } = useForm<TelegramConfigInput>({
        resolver: zodResolver(TelegramConfigSchema),
        defaultValues: { botToken: "", chatId: "", enabled: false },
    });

    // Populate form once the query resolves.
    React.useEffect(() => {
        if (config.data) {
            reset({
                botToken: "",
                chatId: config.data.chatId ?? "",
                enabled: config.data.enabled ?? false,
            });
        }
    }, [config.data, reset]);

    const enabled = watch("enabled");
    const chatId = watch("chatId");

    // Whether the form has everything needed to actually broadcast.
    // The token is "available" if either the admin already saved one OR they just typed one in.
    const hasUsableToken = Boolean(config.data?.hasToken) || (watch("botToken")?.trim().length ?? 0) > 0;
    const hasUsableChatId = (chatId?.trim().length ?? 0) > 0;
    const isFullyConfigured = hasUsableToken && hasUsableChatId;

    if (config.isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-24" />
            </div>
        );
    }

    const onSubmit = (data: TelegramConfigInput) => {
        upsert.mutate({
            botToken: data.botToken?.trim() ? data.botToken.trim() : undefined,
            chatId: data.chatId.trim(),
            enabled: data.enabled,
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Current status */}
            {config.data && (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Current status</AlertTitle>
                    <AlertDescription className="space-y-1">
                        {config.data.hasToken ? (
                            <p>
                                Bot token: <span className="font-mono">{config.data.botTokenMasked}</span>
                            </p>
                        ) : (
                            <p className="text-amber-600">No bot token configured yet.</p>
                        )}
                        <p>Broadcasting: {config.data.enabled ? "enabled" : "disabled"}</p>
                        {config.data.updatedAt && (
                            <p className="text-xs text-muted-foreground">
                                Last updated: {new Date(config.data.updatedAt).toLocaleString()}
                            </p>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* Bot token */}
            <BotTokenField register={register} hasExisting={config.data?.hasToken ?? false} error={errors.botToken?.message} />

            {/* Chat id */}
            <div className="space-y-2">
                <Label htmlFor="chatId">Chat ID</Label>
                <Input
                    id="chatId"
                    placeholder="-100xxxxxxxxxx"
                    {...register("chatId")}
                    className={errors.chatId ? "border-red-500" : ""}
                />
                <p className="text-xs text-muted-foreground">
                    Channel or group chat id. For channels, prefix with <code>-100</code>.
                </p>
                {errors.chatId && <p className="text-sm text-red-500">{errors.chatId.message}</p>}
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between rounded-md border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="enabled">Enable broadcasting</Label>
                    <p className="text-xs text-muted-foreground">
                        When enabled, new bounties will be posted to the configured chat automatically.
                    </p>
                </div>
                <Switch
                    id="enabled"
                    checked={enabled}
                    disabled={!isFullyConfigured}
                    onCheckedChange={(v) => setValue("enabled", v, { shouldDirty: true })}
                />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <Button
                    type="submit"
                    disabled={upsert.isLoading || !isDirty || !hasUsableChatId}
                    className="shadow-sm shadow-foreground"
                >
                    {upsert.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save configuration
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={sendTest.isLoading || !config.data?.hasToken}
                    onClick={() => sendTest.mutate(undefined)}
                    className="shadow-sm shadow-foreground"
                >
                    {sendTest.isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <SendHorizonal className="mr-2 h-4 w-4" />
                    )}
                    Send test message
                </Button>
            </div>

            {/* Contextual warnings — only show what's missing */}
            {!isFullyConfigured && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuration incomplete</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-5 space-y-1">
                            {!hasUsableToken && <li>Bot token is missing.</li>}
                            {!hasUsableChatId && <li>Chat id is missing.</li>}
                        </ul>
                        <p className="mt-2">
                            Fill in both fields to enable the toggle and start broadcasting bounties.
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            {isFullyConfigured && !enabled && (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Ready to broadcast</AlertTitle>
                    <AlertDescription>
                        Token and chat id are set. Flip <strong>Enable broadcasting</strong> on and save to start posting bounties.
                    </AlertDescription>
                </Alert>
            )}
        </form>
    );
}

function BotTokenField({
    register,
    hasExisting,
    error,
}: {
    register: ReturnType<typeof useForm<TelegramConfigInput>>["register"];
    hasExisting: boolean;
    error?: string;
}) {
    const [show, setShow] = React.useState(false);
    return (
        <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <div className="relative">
                <Input
                    id="botToken"
                    type={show ? "text" : "password"}
                    autoComplete="off"
                    placeholder={hasExisting ? "Leave blank to keep current token" : "123456:ABC... (from @BotFather)"}
                    {...register("botToken")}
                    className={error ? "border-red-500 pr-10" : "pr-10"}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShow((v) => !v)}
                >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">Toggle token visibility</span>
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Get this from <span className="font-mono">@BotFather</span> on Telegram via <span className="font-mono">/newbot</span>.
                {hasExisting && " Leave blank to keep the existing token."}
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
    );
}
