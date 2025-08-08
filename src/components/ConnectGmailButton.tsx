import { Button } from "@/components/ui/button";
import { useGmailConnection } from "@/hooks/useGmailConnection";

export function ConnectGmailButton() {
  const { connectGmail, isConnecting, isGmailConnected } = useGmailConnection();

  if (isGmailConnected) {
    return (
      <Button variant="outline" disabled>
        ✅ Gmail verbunden
      </Button>
    );
  }

  return (
    <Button onClick={connectGmail} disabled={isConnecting}>
      {isConnecting ? "Verbinde..." : "Gmail verbinden"}
    </Button>
  );
}
