import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";
import TopBar from "./AppHeader";
import { useTheme } from '../theme/ThemeContext';

const Layout: React.FC = () => {
  const { colors } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Cập nhật lại width cho khớp với Sidebar mới (75px và 260px)
  const marginLeft = sidebarCollapsed ? '75px' : '260px';

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: colors.background,
      overflowX: 'hidden'
    }}>
      {/* Sidebar cố định bên trái */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />
      
      {/* Vùng nội dung chính */}
      <div style={{ 
        flex: 1, 
        marginLeft: marginLeft, 
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0 // Ngăn chặn flex item bị tràn
      }}>
        
        <TopBar />
        
        <main style={{ 
          flex: 1, 
          padding: '2rem', // Tăng padding để nội dung "thở" hơn
          backgroundColor: colors.background,
          color: colors.textPrimary,
          minHeight: 'calc(100vh - 64px - 45px)', // Trừ đi chiều cao TopBar và Footer
        }}>
          {/* Container để giới hạn chiều rộng nội dung nếu cần */}
          <div className="container-fluid p-0">
             <Outlet /> 
          </div>
        </main>
        
        {/* Footer thiết kế lại gọn gàng hơn */}
        <footer style={{ 
          padding: '0.75rem 2rem', 
          backgroundColor: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '0.75rem', 
          color: colors.textMuted,
          letterSpacing: '0.025em'
        }}>
          <div className="d-flex gap-3">
            <span>© 2026 <strong>BusTrack</strong> • SOICT, HUST</span>
            <span className="d-none d-md-inline opacity-50">|</span>
            <a href="https://soict.hust.edu.vn" target="_blank" rel="noreferrer" 
               className="text-decoration-none text-gray-500 hover-white transition-all">
              soict.hust.edu.vn
            </a>
          </div>
          
          <div className="d-flex align-items-center gap-2">
            <span className="status-indicator shadow-green"></span>
            <span style={{ color: colors.success, fontWeight: 600, textTransform: 'uppercase', fontSize: '10px' }}>
              System Operational
            </span>
          </div>
        </footer>
      </div>

      <style>{`
        .hover-white:hover { color: ${colors.textPrimary} !important; }
        .transition-all { transition: all 0.2s ease-in-out; }
        .status-indicator {
          width: 8px;
          height: 8px;
          background-color: ${colors.success};
          border-radius: 50%;
          display: inline-block;
        }
        .shadow-green {
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }
        /* Custom scrollbar cho toàn trang */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${colors.background}; }
        ::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${colors.borderLight}; }
      `}</style>
    </div>
  );
};

export default Layout;