import React, { useState } from "react";
import { ConfigProvider } from "./context/ConfigContext";
import UserScreen from "./screens/UserScreen";
import AdminScreen from "./screens/AdminScreen";

const App: React.FC = () => {
  const [view, setView] = useState<"user" | "admin">("user");

  return (
    <ConfigProvider>
      <div className="min-h-screen bg-gray-50/50">
        <header className="bg-white border-b border-border mb-8">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-tight">
                Incentive Pro
              </h1>
              <p className="text-sm text-gray-500">BFL SM Term Calculator</p>
            </div>
            <nav className="flex gap-6">
              <button
                className={`text-sm font-medium transition-colors ${
                  view === "user"
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => setView("user")}
              >
                Calculator
              </button>
              <button
                className={`text-sm font-medium transition-colors ${
                  view === "admin"
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => setView("admin")}
              >
                Admin Construct
              </button>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-6 pb-12">
          {view === "user" ? <UserScreen /> : <AdminScreen />}
        </main>

        <footer className="py-8 text-center text-sm text-gray-500 border-t border-border mt-auto bg-white">
          &copy; 2026 Incentive Pro. Built for excellence.
        </footer>
      </div>
    </ConfigProvider>
  );
};

export default App;
