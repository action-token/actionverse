import { Camera, Stamp, ShieldCheck, ChevronRight } from "lucide-react";
import { Button } from "~/components/shadcn/ui/button";

/**
 * Shown to participants who have joined a bounty with `requiresActionCam = true`
 * but have not yet submitted. Explains the 3-layer Action Cam flow and gives
 * them a single CTA to open the capture modal.
 *
 * No tooltips by design — the explanation is inline and self-contained.
 */

export interface ActionCamGuideCardProps {
  onOpenCapture: () => void;
}

interface StepProps {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function Step({ number, icon: Icon, title, description }: StepProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold tabular-nums">
        {number}
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <p className="text-sm font-semibold leading-snug">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ActionCamGuideCard({ onOpenCapture }: ActionCamGuideCardProps) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold">Action Cam submission</p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        This bounty requires Action Cam proof. Your submission will be
        captured live from your device camera and cryptographically sealed
        by our server.
      </p>

      <div className="space-y-3 pt-1">
        <Step
          number={1}
          icon={Camera}
          title="Live capture"
          description="The in-app camera opens. There's no upload button and no gallery — you capture the photo right now, in the moment, from your device."
        />
        <Step
          number={2}
          icon={Stamp}
          title="Stamped on the spot"
          description="The exact time, your location, and your wallet are burned into the image pixels. The context travels with the photo and survives screenshots or downloads."
        />
        <Step
          number={3}
          icon={ShieldCheck}
          title="Cryptographically sealed"
          description="Our server signs the photo at the moment of capture with a secret key. Any later edit breaks the seal and the proof is rejected."
        />
      </div>

      <Button
        onClick={onOpenCapture}
        className="w-full gap-2"
        size="lg"
      >
        <Camera className="h-4 w-4" />
        Open Action Cam
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
