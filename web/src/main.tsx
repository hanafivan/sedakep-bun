import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Alibi } from './pages/Alibi';
import { AgendaDetail } from './pages/AgendaDetail';
import { AgendaForm } from './pages/AgendaForm';
import { Agendas } from './pages/Agendas';
import { AlibiDetail } from './pages/AlibiDetail';
import { AlibiForm } from './pages/AlibiForm';
import { AlibiPrint } from './pages/AlibiPrint';
import { Approvals } from './pages/Approvals';
import { AdminBackup } from './pages/AdminBackup';
import { AssignmentDetail } from './pages/AssignmentDetail';
import { AssignmentForm } from './pages/AssignmentForm';
import { Assignments } from './pages/Assignments';
import { AssignmentPrint } from './pages/AssignmentPrint';
import { Dashboard } from './pages/Dashboard';
import { DispositionPrint } from './pages/DispositionPrint';
import { Faq } from './pages/Faq';
import { IncomingLetterDetail } from './pages/IncomingLetterDetail';
import { IncomingLetterForm } from './pages/IncomingLetterForm';
import { IncomingLetters } from './pages/IncomingLetters';
import { LeaveAdmin } from './pages/LeaveAdmin';
import { LeaveDetail } from './pages/LeaveDetail';
import { LeaveForm } from './pages/LeaveForm';
import { LeaveHistory } from './pages/LeaveHistory';
import { LeaveList } from './pages/LeaveList';
import { LeavePrint } from './pages/LeavePrint';
import { LeaveFormPrint } from './pages/LeaveFormPrint';
import { LetterClassifications } from './pages/LetterClassifications';
import { Letters } from './pages/Letters';
import { Login } from './pages/Login';
import { MasterData } from './pages/MasterData';
import { Migration } from './pages/Migration';
import { Panduan } from './pages/Panduan';
import { Profile } from './pages/Profile';
import { Quota } from './pages/Quota';
import { QuotaPrint } from './pages/QuotaPrint';
import { Riwayat } from './pages/Riwayat';
import { ServiceRequestDetail } from './pages/ServiceRequestDetail';
import { ServiceRequestForm } from './pages/ServiceRequestForm';
import { ServiceRequests } from './pages/ServiceRequests';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { Verify } from './pages/Verify';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root tidak ditemukan');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="verify/:code" element={<Verify />} />

          <Route element={<RequireAuth />}>
            <Route path="assignments/:id/print" element={<AssignmentPrint />} />
            <Route path="alibi/:id/print" element={<AlibiPrint />} />
            <Route path="leave/:id/print" element={<LeavePrint />} />
            <Route path="leave/:id/print-form" element={<LeaveFormPrint />} />
            <Route path="quota/print/:userId" element={<QuotaPrint />} />
            <Route element={<RequireAuth roles={['verifikator', 'atasan']} />}>
              <Route path="incoming-letters/:id/print" element={<DispositionPrint />} />
            </Route>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="leave" element={<LeaveList />} />
              <Route path="leave/new" element={<LeaveForm />} />
              <Route path="leave/history" element={<LeaveHistory />} />
              <Route
                path="leave/letters"
                element={<RequireAuth roles={['verifikator', 'atasan']} />}
              >
                <Route index element={<Letters />} />
              </Route>
              <Route path="leave/:id" element={<LeaveDetail />} />
              <Route path="leave/:id/edit" element={<LeaveForm />} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="assignments/new" element={<AssignmentForm />} />
              <Route path="assignments/:id" element={<AssignmentDetail />} />
              <Route path="assignments/:id/edit" element={<AssignmentForm />} />
              <Route path="alibi" element={<Alibi />} />
              <Route path="alibi/new" element={<AlibiForm />} />
              <Route path="alibi/:id" element={<AlibiDetail />} />
              <Route path="alibi/:id/edit" element={<AlibiForm />} />
              <Route path="agenda" element={<Agendas />} />
              <Route path="agenda/new" element={<AgendaForm />} />
              <Route path="agenda/:id" element={<AgendaDetail />} />
              <Route path="agenda/:id/edit" element={<AgendaForm />} />
              <Route path="services" element={<ServiceRequests />} />
              <Route path="services/new" element={<ServiceRequestForm />} />
              <Route path="services/:id" element={<ServiceRequestDetail />} />
              <Route path="services/:id/edit" element={<ServiceRequestForm />} />
              <Route path="riwayat" element={<Riwayat />} />
              <Route path="panduan/pdf" element={<Panduan mode="pdf" />} />
              <Route path="panduan/video" element={<Panduan mode="video" />} />
              <Route path="profile" element={<Profile />} />
              <Route element={<RequireAuth roles={['admin']} />}>
                <Route path="admin/users" element={<Users />} />
                <Route path="admin/master" element={<MasterData />} />
                <Route path="admin/settings" element={<Settings />} />
                <Route path="admin/backup" element={<AdminBackup />} />
              </Route>
              <Route element={<RequireAuth roles={['verifikator', 'atasan']} />}>
                <Route path="incoming-letters" element={<IncomingLetters />} />
                <Route path="incoming-letters/new" element={<IncomingLetterForm />} />
                <Route path="incoming-letters/:id" element={<IncomingLetterDetail />} />
                <Route path="incoming-letters/:id/edit" element={<IncomingLetterForm />} />
                <Route path="letter-classifications" element={<LetterClassifications />} />
              </Route>
              <Route path="quota" element={<Quota />} />
              <Route path="faq" element={<Faq />} />
              <Route
                path="approvals"
                element={<RequireAuth roles={['verifikator', 'atasan']} />}
              >
                <Route index element={<Approvals />} />
              </Route>
              <Route path="migration" element={<RequireAuth roles={['verifikator']} />}>
                <Route index element={<Migration />} />
              </Route>
              <Route path="admin/leave" element={<RequireAuth roles={['admin']} />}>
                <Route index element={<LeaveAdmin />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
