import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnalysisTrackerProvider } from "@/contexts/AnalysisTrackerContext";
import Home from "@/pages/Home";
import Analyze from "@/pages/Analyze";
import Analyses from "@/pages/Analyses";
import Leaderboard from "@/pages/Leaderboard";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/analyze/:id" component={Analyze} />
      <Route path="/analyses" component={Analyses} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/account" component={Account} />
      <Route path="/subscription/success" component={Pricing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AnalysisTrackerProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AnalysisTrackerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
