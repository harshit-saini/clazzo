import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { RootRoute } from "./pages/RootRoute";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterInstitutePage } from "./pages/auth/RegisterInstitutePage";
import { StudentSignupPage } from "./pages/auth/StudentSignupPage";
import { ConsentConfirmPage } from "./pages/auth/ConsentConfirmPage";
import { DashboardLayout } from "./dashboard/DashboardLayout";
import { DashboardHome } from "./dashboard/pages/DashboardHome";
import { StudentsPage } from "./dashboard/pages/StudentsPage";
import { StudentDetailPage } from "./dashboard/pages/StudentDetailPage";
import { BatchesPage } from "./dashboard/pages/BatchesPage";
import { BatchDetailPage } from "./dashboard/pages/BatchDetailPage";
import { AttendanceMarkPage } from "./dashboard/pages/AttendanceMarkPage";
import { FeesPage } from "./dashboard/pages/FeesPage";
import { StaffPage } from "./dashboard/pages/StaffPage";
import { GradesPage } from "./dashboard/pages/GradesPage";
import { PortalLayout } from "./portal/PortalLayout";
import { PortalHome } from "./portal/pages/PortalHome";
import { InstituteDetailPage } from "./portal/pages/InstituteDetailPage";
import { AttendanceHistoryPage } from "./portal/pages/AttendanceHistoryPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterInstitutePage />} />
          <Route path="/student/signup" element={<StudentSignupPage />} />
          <Route path="/consent/confirm" element={<ConsentConfirmPage />} />

          <Route element={<RequireAuth kind="STAFF" />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="students/:id" element={<StudentDetailPage />} />
              <Route path="batches" element={<BatchesPage />} />
              <Route path="batches/:id" element={<BatchDetailPage />} />
              <Route path="attendance/:sessionId" element={<AttendanceMarkPage />} />
              <Route path="fees" element={<FeesPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="grades" element={<GradesPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth kind="STUDENT" />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="institutes/:instituteId" element={<InstituteDetailPage />} />
              <Route path="institutes/:instituteId/attendance" element={<AttendanceHistoryPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
