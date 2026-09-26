import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  loginAsAdmin: (id: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: (email: string, displayName?: string, avatarUrl?: string) => Promise<{ success: boolean; isNewUser?: boolean; isPending?: boolean }>;
  logout: () => void;
  updateProfile: (displayName: string) => Promise<boolean>;
  changeAdminPassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  refreshCurrentUser: () => Promise<void>;
  syncCloudData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storageService.getCurrentUser());
  const { success, error, info } = useToast();

  const syncCloudData = useCallback(async () => {
    const user = storageService.getCurrentUser();
    if (!user) return;

    try {
      // 1. Sync User Profile and Approval Status from Cloudflare D1
      if (user.role !== 'admin') {
        const remoteUser = await d1SyncService.fetchUserByEmail(user.email);
        if (remoteUser) {
          setCurrentUser(remoteUser);
          storageService.setCurrentUser(remoteUser);
          storageService.updateUser(remoteUser);
        }
      }

      // 2. Full Sync with D1 for user's own exams and scans (or all if admin)
      await storageService.syncWithD1(user);
    } catch {
      // Offline fallback silent
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const user = storageService.getCurrentUser();
    if (user) {
      if (user.role !== 'admin') {
        try {
          const remote = await d1SyncService.fetchUserByEmail(user.email);
          if (remote) {
            setCurrentUser(remote);
            storageService.setCurrentUser(remote);
            storageService.updateUser(remote);
            return;
          }
        } catch {}
      }
      const stored = storageService.getUserByEmail(user.email);
      if (stored) {
        setCurrentUser(stored);
        storageService.setCurrentUser(stored);
      }
    }
  }, []);

  useEffect(() => {
    // Initial sync on app mount
    syncCloudData();

    // Auto sync periodically every 20 seconds to catch Admin approvals or changes from other devices
    const interval = setInterval(() => {
      syncCloudData();
    }, 20000);

    return () => clearInterval(interval);
  }, [syncCloudData]);

  const loginAsAdmin = async (id: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const normalizedId = id.trim().toLowerCase();
    const storedPass = storageService.getAdminPassword();

    if (normalizedId !== 'admin') {
      return { success: false, message: 'รหัสผู้ใช้ไม่ถูกต้อง (ค่าเริ่มต้นคือ Admin)' };
    }

    if (password !== storedPass) {
      return { success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' };
    }

    let adminUser = storageService.getUserByEmail('admin@system.local');
    if (!adminUser) {
      adminUser = {
        id: 'admin_root',
        email: 'admin@system.local',
        displayName: 'ผู้ดูแลระบบ (Admin)',
        role: 'admin',
        status: 'approved',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
        storageBytes: 154000,
      };
      storageService.updateUser(adminUser);
    } else {
      adminUser.lastLoginAt = new Date().toISOString();
      storageService.updateUser(adminUser);
    }

    setCurrentUser(adminUser);
    storageService.setCurrentUser(adminUser);
    success('เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับ ผู้ดูแลระบบ (Admin)');

    // Trigger admin cloud sync
    setTimeout(() => {
      storageService.syncWithD1(adminUser).catch(() => {});
    }, 100);

    return { success: true };
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

    // Try check server first so that if user was already approved from another browser, we know!
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
      storageService.updateUser(user);
    } else {
      let existingLocal = storageService.getUserByEmail(trimmedEmail);
      if (!existingLocal) {
        // New user registered with Google -> Default status is PENDING approval
        isNew = true;
        user = {
          id: 'user_' + Math.random().toString(36).substring(2, 10),
          email: trimmedEmail,
          displayName: displayName || trimmedEmail.split('@')[0],
          role: 'member',
          status: 'pending', // Pending Admin approval!
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || trimmedEmail)}`,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          storageBytes: 0,
        };
        storageService.updateUser(user);
      } else {
        user = {
          ...existingLocal,
          lastLoginAt: new Date().toISOString(),
          displayName: displayName || existingLocal.displayName,
        };
        storageService.updateUser(user);
      }
    }

    setCurrentUser(user);
    storageService.setCurrentUser(user);

    // Sync cloud state for this user
    storageService.syncWithD1(user).catch(() => {});

    if (user.status === 'pending') {
      info(
        'บัญชีของคุณอยู่ระหว่างรอการอนุมัติ',
        'ผู้ดูแลระบบ (Admin) ต้องอนุมัติสิทธิ์ก่อนเริ่มสร้างหรือสแกนข้อสอบ (ระบบจะซิงค์ให้อัตโนมัติเมื่อได้รับการอนุมัติ)'
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
    storageService.updateUser(updated);
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

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.role === 'admin',
        isApproved: currentUser?.status === 'approved',
        isPending: currentUser?.status === 'pending',
        loginAsAdmin,
        loginWithGoogle,
        logout,
        updateProfile,
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
