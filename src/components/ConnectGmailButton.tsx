import { Button } from "@/components/ui/button";
import { useGmailConnection } from "@/hooks/useGmailConnection";

export function ConnectGmailButton() {
  const { connectGmail, isConnecting } = useGmailConnection();

  return (
    <Button onClick={connectGmail} disabled={isConnecting}>
      {isConnecting ? "Verbinde..." : "Gmail verbinden"}
    </Button>
  );
}
