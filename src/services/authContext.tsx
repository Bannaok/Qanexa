import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, UserRole, UserStatus } from '../types';
import { storageService } from './storageService';
import { d1SyncService } from './d1SyncService';
import { useToast } from './toastContext';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  isPending: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginAsAdmin: (id: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: (email: string, displayName?: string, avatarUrl?: string) => Promise<{ success: boolean; isNewUser?: boolean; isPending?: boolean }>;
  logout: () => void;
  updateProfile: (displayName: string) => Promise<boolean>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; message?: string }>;
  changeAdminPassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  refreshCurrentUser: () => Promise<void>;
  syncCloudData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storageService.getCurrentUser());
  const { success, error, info } = useToast();
  const isSyncingRef = useRef(false);

  const syncCloudData = useCallback(async () => {
    const user = storageService.getCurrentUser();
    if (!user || isSyncingRef.current) return;

    isSyncingRef.current = true;
    try {
      // 1. Sync User Profile and Approval Status from Cloudflare D1
      if (user.role !== 'admin') {
        const lookup = user.email || user.username || user.id;
        const remoteUser = await d1SyncService.fetchUserByEmail(lookup);
        if (remoteUser) {
          if (remoteUser.status !== user.status || remoteUser.role !== user.role || remoteUser.displayName !== user.displayName) {
            setCurrentUser(remoteUser);
            storageService.setCurrentUser(remoteUser);
          }
          storageService.updateUserLocalOnly(remoteUser);
        }
      }

      // 2. High-speed Mirror Sync with D1 for user's own exams and scans (deletions reflected instantly!)
      await storageService.syncWithD1(user);

      // Trigger custom window event so App.tsx and other components instantly refresh their UI
      window.dispatchEvent(new CustomEvent('examscan_cloud_synced'));
    } catch {
      // Silent error handler
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const user = storageService.getCurrentUser();
    if (user) {
      if (user.role !== 'admin') {
        try {
          const lookup = user.email || user.username || user.id;
          const remote = await d1SyncService.fetchUserByEmail(lookup);
          if (remote) {
            setCurrentUser(remote);
            storageService.setCurrentUser(remote);
            storageService.updateUserLocalOnly(remote);
            return;
          }
        } catch {}
      }
      const lookup = user.email || user.username || user.id;
      const stored = storageService.getUserByEmail(lookup);
      if (stored) {
        setCurrentUser(stored);
        storageService.setCurrentUser(stored);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Initial fast sync on app mount
    syncCloudData();

    // 2. High-speed automatic sync polling:
    // Syncs every 4 seconds when the user is actively viewing the tab!
    // Much faster than 20 seconds so changes from other browsers appear almost in real-time.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncCloudData();
      }
    }, 4000);

    // 3. Instant sync whenever the user switches back to this browser tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncCloudData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // 4. Cross-tab BroadcastChannel listener for instant same-browser multi-tab sync
    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('examscan_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'auth_changed') {
          setCurrentUser(event.data.payload);
        }
        // When any tab deletes or adds an exam/scan, immediately sync
        syncCloudData();
      };
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (bc) bc.close();
    };
  }, [syncCloudData]);

  const login = async (rawUsername: string, rawPassword: string): Promise<{ success: boolean; message?: string }> => {
    const username = rawUsername.trim();
    const password = rawPassword.trim();

    if (!username || !password) {
      return { success: false, message: 'กรุณากรอกรหัสผู้ใช้ (ID) และรหัสผ่าน' };
    }

    const lowerUser = username.toLowerCase();

    // 1. Check if logging in as Admin
    if (lowerUser === 'admin') {
      const adminPass = storageService.getAdminPassword();
      if (password !== adminPass) {
        return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
      }

      let adminUser = storageService.getUsers().find((u) => u.role === 'admin' || u.username === 'admin');
      if (!adminUser) {
        adminUser = {
          id: 'admin_root',
          username: 'admin',
          password: adminPass,
          email: 'admin@system.local',
          displayName: 'ผู้ดูแลระบบ (Admin)',
          role: 'admin',
          status: 'approved',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastLoginAt: new Date().toISOString(),
          storageBytes: 154000,
        };
        await storageService.updateUser(adminUser);
      } else {
        adminUser = {
          ...adminUser,
          lastLoginAt: new Date().toISOString(),
        };
        await storageService.updateUser(adminUser);
      }

      setCurrentUser(adminUser);
      storageService.setCurrentUser(adminUser);
      success('เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับ ผู้ดูแลระบบ (Admin)');
      setTimeout(() => syncCloudData(), 50);
      return { success: true };
    }

    // 2. Check Member Login (ID and password)
    let allUsers = storageService.getUsers();
    let matchedUser = allUsers.find(
      (u) =>
        (u.username && u.username.toLowerCase() === lowerUser) ||
        u.id.toLowerCase() === lowerUser ||
        (u.email && u.email.toLowerCase() === lowerUser)
    );

    // If not found in local cache, attempt D1 sync to check if Admin created it on another machine
    if (!matchedUser) {
      try {
        const remoteUsers = await d1SyncService.fetchUsers();
        if (remoteUsers) {
          storageService.saveUsers(remoteUsers);
          matchedUser = remoteUsers.find(
            (u) =>
              (u.username && u.username.toLowerCase() === lowerUser) ||
              u.id.toLowerCase() === lowerUser ||
              (u.email && u.email.toLowerCase() === lowerUser)
          );
        }
      } catch {}
    }

    if (!matchedUser) {
      return { success: false, message: 'ไม่พบรหัสผู้ใช้ (ID) นี้ในระบบ กรุณาตรวจสอบหรือติดต่อ Admin' };
    }

    // Check password
    if (matchedUser.password && matchedUser.password !== password) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }

    // Check status
    if (matchedUser.status === 'rejected') {
      return { success: false, message: 'บัญชีนี้ถูกระงับสิทธิ์การใช้งาน กรุณาติดต่อ Admin' };
    }

    matchedUser = {
      ...matchedUser,
      lastLoginAt: new Date().toISOString(),
    };
    await storageService.updateUser(matchedUser);

    setCurrentUser(matchedUser);
    storageService.setCurrentUser(matchedUser);

    if (matchedUser.status === 'pending') {
      info(
        'บัญชีของคุณอยู่ระหว่างรอการอนุมัติ',
        'ผู้ดูแลระบบ (Admin) ต้องอนุมัติสิทธิ์ก่อนเริ่มสร้างหรือสแกนข้อสอบ'
      );
    } else {
      success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${matchedUser.displayName || matchedUser.username}`);
    }

    setTimeout(() => syncCloudData(), 50);
    return { success: true };
  };

  const loginAsAdmin = async (id: string, password: string): Promise<{ success: boolean; message?: string }> => {
    return login(id, password);
  };

  const loginWithGoogle = async (
    email: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<{ success: boolean; isNewUser?: boolean; isPending?: boolean }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      return { success: false };
    }

    // Try check server first
    let remoteUser: UserProfile | null = null;
    try {
      remoteUser = await d1SyncService.fetchUserByEmail(trimmedEmail);
    } catch {}

    let user: UserProfile;
    let isNew = false;

    if (remoteUser) {
      user = {
        ...remoteUser,
        lastLoginAt: new Date().toISOString(),
        displayName: displayName || remoteUser.displayName,
      };
      await storageService.updateUser(user);
    } else {
      let existingLocal = storageService.getUserByEmail(trimmedEmail);
      if (!existingLocal) {
        isNew = true;
        user = {
          id: 'user_' + Math.random().toString(36).substring(2, 10),
          username: trimmedEmail.split('@')[0],
          password: 'password123',
          email: trimmedEmail,
          displayName: displayName || trimmedEmail.split('@')[0],
          role: 'member',
          status: 'pending',
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || trimmedEmail)}`,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          storageBytes: 0,
        };
        await storageService.updateUser(user);
      } else {
        user = {
          ...existingLocal,
          lastLoginAt: new Date().toISOString(),
          displayName: displayName || existingLocal.displayName,
        };
        await storageService.updateUser(user);
      }
    }

    setCurrentUser(user);
    storageService.setCurrentUser(user);

    // Immediate sync
    setTimeout(() => {
      syncCloudData();
    }, 50);

    if (user.status === 'pending') {
      info(
        'บัญชีของคุณอยู่ระหว่างรอการอนุมัติ',
        'ผู้ดูแลระบบ (Admin) ต้องอนุมัติสิทธิ์ก่อนเริ่มสร้างหรือสแกนข้อสอบ (ระบบจะซิงค์ให้อัตโนมัติทันทีที่ได้รับการอนุมัติ)'
      );
    } else if (user.status === 'approved') {
      success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${user.displayName}`);
    } else if (user.status === 'rejected') {
      error('บัญชีถูกระงับสิทธิ์', 'บัญชีนี้ถูกปฏิเสธหรือระงับการเข้าใช้งานโดยผู้ดูแลระบบ');
    }

    return {
      success: true,
      isNewUser: isNew,
      isPending: user.status === 'pending',
    };
  };

  const logout = () => {
    setCurrentUser(null);
    storageService.setCurrentUser(null);
    info('ออกจากระบบเรียบร้อย');
  };

  const updateProfile = async (displayName: string): Promise<boolean> => {
    if (!currentUser) return false;
    const updated: UserProfile = {
      ...currentUser,
      displayName: displayName.trim(),
    };
    await storageService.updateUser(updated);
    setCurrentUser(updated);
    storageService.setCurrentUser(updated);
    success('อัปเดตข้อมูลส่วนตัวสำเร็จ');
    return true;
  };

  const changeAdminPassword = async (
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเปลี่ยนรหัสผ่านนี้ได้' };
    }

    const storedPass = storageService.getAdminPassword();
    if (currentPass !== storedPass) {
      return { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
    }

    if (newPass.length < 6) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' };
    }

    storageService.setAdminPassword(newPass);
    success('เปลี่ยนรหัสผ่าน Admin สำเร็จ', 'รหัสผ่านใหม่ถูกบันทึกเรียบร้อย');
    return { success: true };
  };

  const changePassword = async (
    newPass: string,
    currentPass?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };

    if (currentUser.role === 'admin') {
      return changeAdminPassword(currentPass || '', newPass);
    }

    if (newPass.length < 4) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
    }

    const updated: UserProfile = {
      ...currentUser,
      password: newPass,
    };
    await storageService.updateUser(updated);
    setCurrentUser(updated);
    storageService.setCurrentUser(updated);
    success('เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านใหม่ถูกบันทึกเรียบร้อย');
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.role === 'admin',
        isApproved: currentUser?.status === 'approved',
        isPending: currentUser?.status === 'pending',
        login,
        loginAsAdmin,
        loginWithGoogle,
        logout,
        updateProfile,
        changePassword,
        changeAdminPassword,
        refreshCurrentUser,
        syncCloudData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
