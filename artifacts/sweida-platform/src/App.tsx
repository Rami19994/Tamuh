import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/public/Home";
import HowItWorks from "@/pages/public/HowItWorks";
import Privacy from "@/pages/public/Privacy";
import Report from "@/pages/public/Report";
import SubmitCase from "@/pages/public/SubmitCase";
import TrackCase from "@/pages/public/TrackCase";

import AdminLogin from "@/pages/admin/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminCaseDetail from "@/pages/admin/CaseDetail";
import AdminEmailLog from "@/pages/admin/EmailLog";
import AdminActivityLog from "@/pages/admin/ActivityLog";
import AdminUsers from "@/pages/admin/AdminUsers";
import AbuseReports from "@/pages/admin/AbuseReports";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/report" component={Report} />
      <Route path="/submit" component={SubmitCase} />
      <Route path="/track" component={TrackCase} />

      {/* Admin Routes */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/cases/:caseNumber" component={AdminCaseDetail} />
      <Route path="/admin/email-log" component={AdminEmailLog} />
      <Route path="/admin/activity-log" component={AdminActivityLog} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/abuse-reports" component={AbuseReports} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
