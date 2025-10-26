// This file has been refactored into server/client components for SSR optimization
// The main logic is now split between ServerDashboard and ClientDashboard
// Import the server version for SSR compatibility
export { default } from './ServerDashboard'