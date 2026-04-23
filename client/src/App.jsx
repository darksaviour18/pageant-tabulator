import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultMode="light">
        <SocketProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </SocketProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}