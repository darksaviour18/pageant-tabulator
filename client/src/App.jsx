import { BrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import AppRoutes from './AppRoutes';
import { SocketProvider } from './context/SocketContext';

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <Layout>
          <AppRoutes />
        </Layout>
      </SocketProvider>
    </BrowserRouter>
  );
}
