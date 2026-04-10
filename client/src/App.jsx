import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </SocketProvider>
    </BrowserRouter>
  );
}
