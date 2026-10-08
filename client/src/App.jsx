import { Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import Spinner from "./components/ui/Spinner.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import RoleRoute from "./components/auth/RoleRoute.jsx";

const Launch = lazy(() => import("./pages/Launch.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail.jsx"));
const Verification = lazy(() => import("./pages/provider/Verification.jsx"));
const SkillsManager = lazy(() => import("./pages/provider/SkillsManager.jsx"));
const AdminVerifications = lazy(() => import("./pages/admin/AdminVerifications.jsx"));
const PricingRules = lazy(() => import("./pages/admin/PricingRules.jsx"));
const BookingFlow = lazy(() => import("./pages/customer/BookingFlow.jsx"));
const MyBookings = lazy(() => import("./pages/customer/MyBookings.jsx"));
const BookingDetail = lazy(() => import("./pages/customer/BookingDetail.jsx"));
const TrackBooking = lazy(() => import("./pages/customer/TrackBooking.jsx"));
const Jobs = lazy(() => import("./pages/provider/Jobs.jsx"));
const Inbox = lazy(() => import("./pages/customer/Inbox.jsx"));
const Checkout = lazy(() => import("./pages/customer/Checkout.jsx"));
const PaymentHistory = lazy(() => import("./pages/customer/PaymentHistory.jsx"));
const Invoice = lazy(() => import("./pages/customer/Invoice.jsx"));
const Earnings = lazy(() => import("./pages/provider/Earnings.jsx"));
const ProviderProfile = lazy(() => import("./pages/ProviderProfile.jsx"));
const RaiseDispute = lazy(() => import("./pages/customer/RaiseDispute.jsx"));
const DisputeThread = lazy(() => import("./pages/customer/DisputeThread.jsx"));
const CustomerDashboard = lazy(() => import("./pages/customer/CustomerDashboard.jsx"));
const ProviderDashboard = lazy(() => import("./pages/provider/ProviderDashboard.jsx"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminDisputes = lazy(() => import("./pages/admin/AdminDisputes.jsx"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices.jsx"));

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-midnight"><Spinner label="Loading Home Delivery" /></div>}>
      <Routes>
        <Route path="/" element={<Launch />} />
        <Route path="/app" element={<Home />} />
        <Route path="/services" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/providers/:id" element={<ProviderProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/bookings" element={<MyBookings />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:bookingId" element={<Inbox />} />
          <Route path="/disputes" element={<DisputeThread />} />
          <Route path="/disputes/:id" element={<DisputeThread />} />
          <Route path="/bookings/:id/dispute" element={<RaiseDispute />} />
          <Route element={<RoleRoute roles={["customer"]} />}>
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/my-home" element={<CustomerDashboard />} />
            <Route path="/bookings/:id/track" element={<TrackBooking />} />
            <Route path="/services/:id/book" element={<BookingFlow />} />
            <Route path="/bookings/:bookingId/checkout" element={<Checkout />} />
            <Route path="/payments" element={<PaymentHistory />} />
            <Route path="/payments/history" element={<PaymentHistory />} />
            <Route path="/payments/:paymentId/invoice" element={<Invoice />} />
          </Route>
          <Route element={<RoleRoute roles={["provider"]} />}>
            <Route path="/provider" element={<ProviderDashboard />} />
            <Route path="/provider/jobs" element={<Jobs />} />
            <Route path="/provider/earnings" element={<Earnings />} />
            <Route path="/provider/verification" element={<Verification />} />
            <Route path="/provider/skills" element={<SkillsManager />} />
          </Route>
          <Route element={<RoleRoute roles={["admin"]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/pricing" element={<PricingRules />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<PlaceholderPage page="home" />} />
      </Routes>
    </Suspense>
  );
}
