import type { ReactNode } from 'react';
import './adminReusable.css';

type PageTitleProps = {
  icon: ReactNode;
  title: string;
};

const PageTitle = ({ icon, title }: PageTitleProps) => {
  return (
    <div className="admin-page-title">
      <div className="admin-page-title-main">
        <div className="admin-page-title-icon">
          {icon}
        </div>
        <h1 className="admin-page-title-text">
          {title}
        </h1>
      </div>
    </div>
  );
};

export default PageTitle;
