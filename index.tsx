import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- ERROR BOUNDARY COMPONENT (Starts here) ---
// This will catch the crash and show the error message on screen
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: 'white', height: '100vh' }}>
          <h1>App Crashed</h1>
          <h3>Error Message:</h3>
          <pre>{this.state.error?.toString()}</pre>
          <h3>Possible Fixes:</h3>
          <ul>
             <li>If the error mentions "Router", change BrowserRouter to HashRouter in App.tsx</li>
             <li>If the error mentions "process is not defined", remove process.env references.</li>
          </ul>
        </div>
      );
    }
    return this.props.children;
  }
}
// --- ERROR BOUNDARY COMPONENT (Ends here) ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary> {/* Wrap App in the error catcher */}
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);