import { BrowserRouter } from 'react-router-dom';
import { AdventureProvider } from './context/AdventureProvider';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AdventureProvider><AppRoutes /></AdventureProvider>
    </BrowserRouter>
  );
}
