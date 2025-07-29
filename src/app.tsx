
import { LocationProvider, Router, Route } from 'preact-iso';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/settings" component={Settings} />
      </Router>
    </LocationProvider>
  );
}
