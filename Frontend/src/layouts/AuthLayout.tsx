import React, { useState, useEffect } from 'react';

const images = [
  "https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=2000", // Hạ Long
  "https://images.unsplash.com/photo-1504457047772-27fad17438ef?q=80&w=2000", // Ruộng bậc thang
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2000"  // Hội An
];

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="auth-container p-2 p-md-4">
      <div className="auth-card shadow-lg border-0">
        <div className="row g-0">
          
          <div className="col-5 auth-left-slideshow d-flex flex-column h-100 position-relative">
            {images.map((img, index) => (
              <div 
                key={index}
                className={`slideshow-img ${index === activeIndex ? 'active' : ''}`}
                style={{ 
                  backgroundImage: `url(${img})`,
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
                {images.map((_, index) => (
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