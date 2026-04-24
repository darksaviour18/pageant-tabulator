import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { EventProvider } from './context/EventContext';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultMode="light">
        <EventProvider>
          <SocketProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </SocketProvider>
        </EventProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}