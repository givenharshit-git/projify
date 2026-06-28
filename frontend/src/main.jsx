// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './app/store.js'
import { ClerkProvider } from '@clerk/react'

createRoot(document.getElementById('root')).render(
    // <StrictMode>
    //   <App />
    // </StrictMode>,

    <BrowserRouter>
        <ClerkProvider>
            <Provider store={store}>
                <App />
            </Provider>
        </ClerkProvider>

    </BrowserRouter>,
)
