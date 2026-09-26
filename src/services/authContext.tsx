import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole, UserStatus } from '../types';
import { storageService } from './storageService';
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
  refreshCurrentUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => storageService.getCurrentUser());
  const { success, error, info } = useToast();

  useEffect(() => {
    // Initial sync
    const user = storageService.getCurrentUser();
    if (user) {
      // Refresh user from storage list to ensure status updates (like admin approval) are synced
      const stored = storageService.getUserByEmail(user.email);
      if (stored) {
        setCurrentUser(stored);
        storageService.setCurrentUser(stored);
      }
    }
  }, []);

  const refreshCurrentUser = useCallback(() => {
    const user = storageService.getCurrentUser();
    if (user) {
      const stored = storageService.getUserByEmail(user.email);
      if (stored) {
        setCurrentUser(stored);
        storageService.setCurrentUser(stored);
      }
    }
  }, []);

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

    let user = storageService.getUserByEmail(trimmedEmail);
    let isNew = false;

    if (!user) {
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
      user.lastLoginAt = new Date().toISOString();
      if (displayName && user.displayName === user.email.split('@')[0]) {
        user.displayName = displayName;
      }
      storageService.updateUser(user);
    }

    setCurrentUser(user);
    storageService.setCurrentUser(user);

    if (user.status === 'pending') {
      info(
        'บัญชีของคุณอยู่ระหว่างรอการอนุมัติ',
        'เจ้าหน้าที่/ผู้ดูแลระบบ (Admin) ต้องอนุมัติสิทธิ์ก่อนเริ่มสร้างหรือสแกนข้อสอบ'
      );
    } else if (user.status === 'approved') {
      success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${user.displayName}`);
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
