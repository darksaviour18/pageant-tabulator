import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { SocketProvider } from './context/SocketContext';

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </BrowserRouter>
  );
}
