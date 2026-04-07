import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateChallenge from './pages/CreateChallenge';
import Queue from './pages/Queue';
import Packages from './pages/Packages';
import SpecReview from './pages/SpecReview';
import BuildReview from './pages/BuildReview';
import JobDetail from './pages/JobDetail';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateChallenge />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/review/spec/:jobId" element={<SpecReview />} />
        <Route path="/review/build/:jobId" element={<BuildReview />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
      </Routes>
    </Layout>
  );
}
