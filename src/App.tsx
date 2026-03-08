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
const MyListingsPage = lazy(() => import("./pages/MyListingsPage"));
const NewListingPage = lazy(() => import("./pages/NewListingPage"));
const FarmerOrdersPage = lazy(() => import("./pages/FarmerOrdersPage"));
const EarningsPage = lazy(() => import("./pages/EarningsPage"));
const FarmerProfileEditPage = lazy(() => import("./pages/FarmerProfileEditPage"));
const BuyerOrdersPage = lazy(() => import("./pages/BuyerOrdersPage"));
const BuyerProfilePage = lazy(() => import("./pages/BuyerProfilePage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
            <Route path="/farm/listings" element={<MyListingsPage />} />
            <Route path="/farm/listings/new" element={<NewListingPage />} />
            <Route path="/farm/orders" element={<FarmerOrdersPage />} />
            <Route path="/farm/earnings" element={<EarningsPage />} />
            <Route path="/farm/profile" element={<FarmerProfileEditPage />} />
            <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
            <Route path="/buyer/orders" element={<BuyerOrdersPage />} />
            <Route path="/buyer/cart" element={<CartPage />} />
            <Route path="/buyer/profile" element={<BuyerProfilePage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
