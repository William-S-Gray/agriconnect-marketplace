import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const FarmerProfilePage = lazy(() => import("./pages/FarmerProfilePage"));
const MarketPricesPage = lazy(() => import("./pages/MarketPricesPage"));
const FarmerRegisterPage = lazy(() => import("./pages/FarmerRegisterPage"));
const FarmerLoginPage = lazy(() => import("./pages/FarmerLoginPage"));
const BuyerRegisterPage = lazy(() => import("./pages/BuyerRegisterPage"));
const BuyerLoginPage = lazy(() => import("./pages/BuyerLoginPage"));
const FarmerDashboard = lazy(() => import("./pages/FarmerDashboard"));
const BuyerDashboard = lazy(() => import("./pages/BuyerDashboard"));
const CartPage = lazy(() => import("./pages/CartPage"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />
            <Route path="/farmer/:id" element={<FarmerProfilePage />} />
            <Route path="/prices" element={<MarketPricesPage />} />
            <Route path="/farmer/register" element={<FarmerRegisterPage />} />
            <Route path="/farmer/login" element={<FarmerLoginPage />} />
            <Route path="/buyer/register" element={<BuyerRegisterPage />} />
            <Route path="/buyer/login" element={<BuyerLoginPage />} />
            <Route path="/farm/dashboard" element={<FarmerDashboard />} />
            <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
            <Route path="/buyer/cart" element={<CartPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
