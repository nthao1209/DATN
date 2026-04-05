import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";
import TopBar from "./AppHeader";

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const marginLeft = sidebarCollapsed ? '70px' : '250px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#020617' }}>
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />
      
      <div style={{ 
        flex: 1, 
        marginLeft: marginLeft, 
        transition: 'margin-left 0.3s ease', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <TopBar />
        
        <main style={{ 
          flex: 1, 
          padding: '1rem',
          backgroundColor: '#0b1220',
          color: '#e2e8f0'
        }}>
          <Outlet /> {/* 🔥 FIX ở đây */}
        </main>
        
        <footer style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: '#0f172a',
          borderTop: '1px solid #1e293b',
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '0.875rem', 
          color: '#94a3b8'
        }}>
          <span>Copyright @ 2025 SOICT, HUST - All right reserved</span>
          <span>soict.hust.edu.vn</span>
          <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Status: Online</span>
        </footer>
      </div>
    </div>
  );
};

export default Layout;