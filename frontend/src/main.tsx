import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RequireAuth from "./components/RequireAuth";
import Admin from "./pages/Admin";
import SuperAdmin from "./pages/SuperAdmin";
import HashtagsPage from "./pages/Hashtags";
import Todos from "./pages/Todos";
import GlobalLoadingOverlay from "./components/ui/GlobalLoadingOverlay";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GlobalLoadingOverlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/hashtags-checker" element={<HashtagsPage />} />

        <Route path="/login" element={<Login />} />
        
        {/* <Route path="/dev/admin" element={<Admin />} /> */}
        {/* <Route path="/dev/superadmin" element={<SuperAdmin />} /> */}

        <Route
          path="/admin"
          element={
            <RequireAuth allowRoles={["superadmin", "admin", "editor"]}>
              <Admin />
            </RequireAuth>
          }
        />

        <Route
          path="/superadmin"
          element={
            <RequireAuth allowRoles={["superadmin"]}>
              <SuperAdmin />
            </RequireAuth>
          }
        />
      </Routes>

    </BrowserRouter>
  </React.StrictMode>
);
