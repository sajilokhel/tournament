import { ReactNode } from "react";
import ManagerGuard from "@/components/ManagerGuard";

const ManagerLayout = ({ children }: { children: ReactNode }) => {
  return (
    <ManagerGuard>
      <div>
        {/* <header>
          <h1>Manager Dashboard</h1>
        </header> */}
        <main>{children}</main>
      </div>
    </ManagerGuard>
  );
};

export default ManagerLayout;
