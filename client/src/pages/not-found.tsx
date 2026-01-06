import { Link } from "wouter";
import { Button } from "@/components/Button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="glass-card p-8 md:p-12 rounded-2xl max-w-md w-full text-center border border-white/10">
        <div className="flex justify-center mb-6">
          <AlertCircle className="h-16 w-16 text-destructive animate-pulse" />
        </div>
        
        <h1 className="font-display text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-8">
          The requested coordinate lies outside the known network graph.
        </p>

        <Link href="/">
          <Button size="lg" className="w-full">
            Return to Base
          </Button>
        </Link>
      </div>
    </div>
  );
}
