import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; 
import './index.css';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <SnackbarProvider
          maxSnack={3}
          autoHideDuration={1000}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >          
           <App />
        </SnackbarProvider>
      </Provider>
    </QueryClientProvider>
  </React.StrictMode>
);