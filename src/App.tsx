import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AppErrorBoundary, ProtectedRoute } from "@/components/ProtectedRoute";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { SessionAnomalyAlert } from "@/components/SessionAnomalyAlert";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const FarmerProfilePage = lazy(() => import("./pages/FarmerProfilePage"));
const MarketPricesPage = lazy(() => import("./pages/MarketPricesPage"));
const FarmerRegisterPage = lazy(() => import("./pages/FarmerRegisterPage"));
const BuyerRegisterPage = lazy(() => import("./pages/BuyerRegisterPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const FarmerDashboard = lazy(() => import("./pages/FarmerDashboard"));
const BuyerDashboard = lazy(() => import("./pages/BuyerDashboard"));
const CartPage = lazy(() => import("./pages/CartPage"));
const MyListingsPage = lazy(() => import("./pages/MyListingsPage"));
const NewListingPage = lazy(() => import("./pages/NewListingPage"));
const FarmerOrdersPage = lazy(() => import("./pages/FarmerOrdersPage"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));
const FarmerProfileEditPage = lazy(() => import("./pages/FarmerProfileEditPage"));
const BuyerOrdersPage = lazy(() => import("./pages/BuyerOrdersPage"));
const BuyerProfilePage = lazy(() => import("./pages/BuyerProfilePage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

// FIX: Properly configured QueryClient — no retry on auth errors, 5 min stale time
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* FIX: Persistent demo mode banner visible across all pages */}
          <DemoModeBanner />
          {/* Surfaces session anomalies (privilege escalation, impossible
              travel, bulk record access) as soon as they are detected. */}
          <SessionAnomalyAlert />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/listing/:id" element={<ListingDetailPage />} />
              <Route path="/farmer/:id" element={<FarmerProfilePage />} />
              <Route path="/prices" element={<MarketPricesPage />} />
              <Route path="/farmer/register" element={<FarmerRegisterPage />} />
              <Route path="/buyer/register" element={<BuyerRegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              {/* FIX: Admin login is now a separate, unlisted route */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {/* Legacy login redirects */}
              <Route path="/farmer/login" element={<LoginPage />} />
              <Route path="/buyer/login" element={<LoginPage />} />
              {/* Protected — farmer. Guards live here so every route is covered
                  by construction, rather than depending on each page to guard itself. */}
              <Route path="/farm/dashboard" element={<ProtectedRoute role="farmer"><FarmerDashboard /></ProtectedRoute>} />
              <Route path="/farm/listings" element={<ProtectedRoute role="farmer"><MyListingsPage /></ProtectedRoute>} />
              <Route path="/farm/listings/new" element={<ProtectedRoute role="farmer"><NewListingPage /></ProtectedRoute>} />
              <Route path="/farm/orders" element={<ProtectedRoute role="farmer"><FarmerOrdersPage /></ProtectedRoute>} />
              <Route path="/farm/earnings" element={<ProtectedRoute role="farmer"><EarningsPage /></ProtectedRoute>} />
              <Route path="/farm/profile" element={<ProtectedRoute role="farmer"><FarmerProfileEditPage /></ProtectedRoute>} />
              {/* Protected — buyer */}
              <Route path="/buyer/dashboard" element={<ProtectedRoute role="buyer"><BuyerDashboard /></ProtectedRoute>} />
              <Route path="/buyer/orders" element={<ProtectedRoute role="buyer"><BuyerOrdersPage /></ProtectedRoute>} />
              <Route path="/buyer/cart" element={<CartPage />} />
              <Route path="/buyer/profile" element={<ProtectedRoute role="buyer"><BuyerProfilePage /></ProtectedRoute>} />
              {/* Protected — admin (redirects to /admin/login, not /login) */}
              <Route path="/admin" element={<ProtectedRoute role="admin" redirectTo="/admin/login"><AdminDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
