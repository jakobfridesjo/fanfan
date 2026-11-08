import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
}

function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex h-full justify-center">
      <div className="h-full w-full px-5 pt-3 pb-5">
        <div className="flex h-full flex-col">{children}</div>
      </div>
    </div>
  );
}

export default PageLayout;
