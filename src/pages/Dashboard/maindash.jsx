import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  LayoutDashboard,
  Users,
  CheckSquare,
  LibraryBig,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  LifeBuoy,
  ShieldCheck,
  BarChart3,
  Crown,
  Loader2,
} from 'lucide-react';

import DashHeader from './DashHeader.jsx';
import {
  getStoredUser,
  hasPermission,
  refreshCurrentUser,
} from '../../services/permissions';

const MainDash = () => {

  // =========================
  // CURRENT USER (role + permissions from the backend)
  // =========================
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  // Sessions saved before permissions existed must be refreshed before rendering pages
  const [ready, setReady] = useState(Boolean(getStoredUser()?.permissions));

  useEffect(() => {
    let cancelled = false;
    const sync = () => setCurrentUser(getStoredUser());

    refreshCurrentUser()
      .catch(() => {
        /* 401 is handled by the API interceptor (redirects to /login) */
      })
      .finally(() => {
        if (!cancelled) {
          sync();
          setReady(true);
        }
      });

    window.addEventListener('user-updated', sync);
    return () => {
      cancelled = true;
      window.removeEventListener('user-updated', sync);
    };
  }, []);

  // =========================
  // NAVIGATION LINKS
  // module → shown only when the user has <module>.view
  // =========================
  const allNavLinks = [
    {
      label: 'Super Admin',
      icon: Crown,
      path: '/superadmin/dashboard',
      superAdminOnly: true,
    },
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
    },
    {
      label: 'Users',
      icon: Users,
      path: '/dashboard/users',
      module: 'users',
    },
    {
      label: 'Tasks',
      icon: CheckSquare,
      path: '/dashboard/tasks',
      module: 'tasks',
    },
    {
      label: 'Task Bank',
      icon: LibraryBig,
      path: '/dashboard/task-bank',
      module: 'taskbank',
    },
    {
      label: 'Task Calendar',
      icon: CalendarDays,
      path: '/dashboard/task-calendar',
      module: 'calendar',
    },
    {
      label: 'MoM',
      icon: ClipboardList,
      path: '/dashboard/mom',
      module: 'communication',
    },
    {
      label: 'Chats',
      icon: MessageCircle,
      path: '/dashboard/chats',
      module: 'chat',
    },
    {
      label: 'Support',
      icon: LifeBuoy,
      path: '/dashboard/support',
      module: 'support',
    },
    {
      label: 'Roles',
      icon: ShieldCheck,
      path: '/dashboard/roles',
      module: 'users',
      action: 'assign',
      adminOnly: true,
    },
    {
      label: 'Reports',
      icon: BarChart3,
      path: '/dashboard/reports',
      module: 'reports',
    },
  ];

  const navLinks = allNavLinks.filter((link) => {
    if (link.superAdminOnly) return currentUser?.role === 'SuperAdmin';
    if (link.adminOnly && !['SuperAdmin', 'Admin'].includes(currentUser?.role)) return false;
    return !link.module || hasPermission(currentUser, link.module, link.action || 'view');
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1024;

  const activeLink =
    navLinks.find(
      (link) => location.pathname === link.path
    )?.label || 'Dashboard';

  const handleNavClick = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div style={styles.wrapper}>

      <DashHeader
        navLinks={navLinks}
        activeLink={activeLink}
        handleNavClick={handleNavClick}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <div
        style={{
          ...styles.pageArea,
          padding: isMobile ? '16px' : '28px',
        }}
      >
        {ready ? (
          // key → guards re-evaluate when role/permissions change
          <Outlet key={`${currentUser?.role}-${JSON.stringify(currentUser?.permissions || {})}`} />
        ) : (
          <div style={styles.loading}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
            Loading your workspace…
            <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
          </div>
        )}
      </div>

    </div>
  );
};

const styles = {
  wrapper: {
    backgroundColor: '#ffffff',
    minWidth: '320px',
  },

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    minHeight: '40vh',
    color: '#18B3B2',
    fontWeight: 600,
  },

  pageArea: {
    minHeight: 'calc(100vh - 132px)',
    backgroundColor: '#f7fbfb',
    boxSizing: 'border-box',
  },
};

export default MainDash;