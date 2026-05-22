import React, { useState, useEffect } from 'react';

const slides = [
  {
    background:
      'linear-gradient(135deg, rgba(15,23,42,0.35), rgba(2,6,23,0.8)), radial-gradient(circle at top left, rgba(37,99,235,0.32), transparent 45%), linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #0b1120 100%)',
  },
  {
    background:
      'linear-gradient(135deg, rgba(15,23,42,0.2), rgba(2,6,23,0.82)), radial-gradient(circle at 20% 20%, rgba(14,165,233,0.28), transparent 36%), linear-gradient(160deg, #11263f 0%, #1f3a5f 48%, #0b1120 100%)',
  },
  {
    background:
      'linear-gradient(135deg, rgba(15,23,42,0.18), rgba(2,6,23,0.86)), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.24), transparent 34%), linear-gradient(160deg, #123024 0%, #1f3a2f 48%, #0b1120 100%)',
  },
];

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5000); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="auth-container p-2 p-md-4">
      <div className="auth-card shadow-lg border-0">
        <div className="row g-0">
          
          <div className="col-5 auth-left-slideshow d-flex flex-column h-100 position-relative">
            {slides.map((slide, index) => (
              <div 
                key={index}
                className={`slideshow-img ${index === activeIndex ? 'active' : ''}`}
                style={{ 
                  background: slide.background,
                  transform: index === activeIndex ? 'scale(1.1)' : 'scale(1)'}}
              />
            ))}

            {/* Nội dung bên trái */}
            <div className="auth-left-content" style={{ zIndex: 10 }}>
              <div className="d-flex align-items-center gap-2">
                <div className="bg-white rounded-circle p-1 d-flex align-items-center justify-content-center">
                  <img
                    src="/favicon.svg"
                    alt="logo"
                    width="30"
                    height="30"
                  />
                </div>
                <h4 className="fw-bold m-0 text-white shadow-sm">BusTrack</h4>
              </div>
            </div>

            <div className="tourism-frame position-relative shadow" style={{ zIndex: 10 }}>
              <h3 className="fw-bold text-white mb-2">Trải nghiệm hành trình</h3>
              <p className="small text-white-50 m-0">
                Kết nối vạn dặm, quản lý thông minh.
              </p>
              
              <div className="d-flex gap-1 mt-3">
                {slides.map((_, index) => (
                  <div 
                    key={index} 
                    className={`indicator ${index === activeIndex ? 'active' : ''}`}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* BÊN PHẢI: FORM NHẬP LIỆU */}
          <div className="col-7 auth-right bg-dark-surface h-100 overflow-auto">
            <div className="auth-form-wrapper py-5 px-3 px-md-5">
              {children}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AuthLayout;